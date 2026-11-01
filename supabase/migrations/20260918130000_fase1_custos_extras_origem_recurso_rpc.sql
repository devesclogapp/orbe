-- ==============================================================================
-- Migration: 20260918130000_fase1_custos_extras_origem_recurso_rpc.sql
-- Módulo: Custos Extras Operacionais (TO-BE - Fase 1)
-- Objetivo:
--   1. Adicionar classificação de origem do recurso (origem_recurso)
--   2. Garantir compatibilidade histórica: registros existentes classificados como 'LEGACY'
--   3. Proibir fallback silencioso no banco (sem DEFAULT, NOT NULL para novos registros)
--   4. Adicionar colunas de favorecido (colaborador e fornecedor) com FKs auditadas
--   5. Atualizar trigger de imutabilidade para proteger novos campos após aprovação
--   6. Endurecer RPC rpc_custo_extra_transicionar com:
--      - Autenticação obrigatória (auth.uid() fail-closed)
--      - Lookup estrito de tenant e role do operador em profiles
--      - Isolamento multi-tenant estrito (TENANT_MISMATCH)
--      - RBAC por ação: aprovação (admin/rh/financeiro), baixa (admin/financeiro)
--      - PAGO_EMPRESA -> Modelo A (aprovar resulta em FINALIZADO / PAGO)
--      - REEMBOLSO_COLABORADOR / PAGAMENTO_PENDENTE -> aprovar resulta em APROVADO_OPERACAO / A_PAGAR
--      - LEGACY -> preserva comportamento histórico (APROVADO_OPERACAO / A_PAGAR)
--      - enviar_financeiro restrito fail-closed a (REEMBOLSO_COLABORADOR, PAGAMENTO_PENDENTE, LEGACY)
--      - finalizar_pagamento bloqueado para PAGO_EMPRESA e restrito a obrigações liquidáveis
--      - devolver bloqueado para FINALIZADO e também para status_pagamento = 'PAGO'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADICIONAR COLUNA origem_recurso (Inicialmente nullable para backfill seguro)
-- ------------------------------------------------------------------------------
ALTER TABLE public.custos_extras_operacionais 
ADD COLUMN IF NOT EXISTS origem_recurso TEXT;

-- ------------------------------------------------------------------------------
-- 2. BACKFILL EXPLÍCITO DOS REGISTROS EXISTENTES COMO 'LEGACY'
--    Garante que nenhum registro histórico seja silenciosamente convertido em PAGO_EMPRESA.
-- ------------------------------------------------------------------------------
UPDATE public.custos_extras_operacionais 
SET origem_recurso = 'LEGACY' 
WHERE origem_recurso IS NULL;

-- ------------------------------------------------------------------------------
-- 3. APLICAR CONSTRAINT DE DOMÍNIO PARA origem_recurso
-- ------------------------------------------------------------------------------
ALTER TABLE public.custos_extras_operacionais 
DROP CONSTRAINT IF EXISTS custos_extras_operacionais_origem_recurso_check;

ALTER TABLE public.custos_extras_operacionais 
ADD CONSTRAINT custos_extras_operacionais_origem_recurso_check 
CHECK (origem_recurso IN ('PAGO_EMPRESA', 'REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY'));

-- ------------------------------------------------------------------------------
-- 4. TORNAR origem_recurso NOT NULL SEM DEFAULT
--    Novos INSERTs sem classificação explícita falharão no banco (fail-closed).
-- ------------------------------------------------------------------------------
ALTER TABLE public.custos_extras_operacionais 
ALTER COLUMN origem_recurso SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. ADICIONAR ESTRUTURAS DE FAVORECIDOS (COM FKS VERIFICADAS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.custos_extras_operacionais
ADD COLUMN IF NOT EXISTS favorecido_colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS favorecido_fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 6. CRIAR ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_custos_extras_origem_recurso 
ON public.custos_extras_operacionais (origem_recurso);

CREATE INDEX IF NOT EXISTS idx_custos_extras_favorecido_colab 
ON public.custos_extras_operacionais (favorecido_colaborador_id);

CREATE INDEX IF NOT EXISTS idx_custos_extras_favorecido_fornec 
ON public.custos_extras_operacionais (favorecido_fornecedor_id);

-- ------------------------------------------------------------------------------
-- 7. ATUALIZAR TRIGGER DE IMUTABILIDADE CONDICIONAL
--    Blindagem: impede alteração de origem_recurso e favorecidos após aprovação.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_custos_extras_imutabilidade_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
   -- Ignora soft delete
   IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        RETURN NEW;
   END IF;
   
   -- Checar imutabilidade se o registro já passou por aprovação
   IF (OLD.pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')) THEN
       IF (
           NEW.empresa_id IS DISTINCT FROM OLD.empresa_id OR
           NEW.unidade_id IS DISTINCT FROM OLD.unidade_id OR
           NEW.data IS DISTINCT FROM OLD.data OR
           NEW.categoria_custo IS DISTINCT FROM OLD.categoria_custo OR
           NEW.valor_unitario IS DISTINCT FROM OLD.valor_unitario OR
           NEW.quantidade IS DISTINCT FROM OLD.quantidade OR
           NEW.forma_pagamento_id IS DISTINCT FROM OLD.forma_pagamento_id OR
           NEW.total IS DISTINCT FROM OLD.total OR
           NEW.origem_recurso IS DISTINCT FROM OLD.origem_recurso OR
           NEW.favorecido_colaborador_id IS DISTINCT FROM OLD.favorecido_colaborador_id OR
           NEW.favorecido_fornecedor_id IS DISTINCT FROM OLD.favorecido_fornecedor_id
       ) THEN
           RAISE EXCEPTION 'IMUTABILIDADE_VIOLADA: Custo Extra não pode ter valores operacionais, origem de recurso ou favorecidos alterados após aprovação (% -> %). Apenas campos administrativos e de pipeline são permitidos.', OLD.pipeline_status, NEW.pipeline_status;
       END IF;
   END IF;

   RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_update_custos_aprovados ON public.custos_extras_operacionais;
CREATE TRIGGER trg_block_update_custos_aprovados
BEFORE UPDATE ON public.custos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.trg_custos_extras_imutabilidade_check();

-- ------------------------------------------------------------------------------
-- 8. RPC UNIFICADA DE TRANSIÇÃO (COM OCC, TENANT ISOLATION, RBAC E ESTADOS REFINADOS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_custo_extra_transicionar(
   p_id UUID,
   p_acao TEXT,
   p_updated_at TIMESTAMPTZ,
   p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
   v_user_id UUID := auth.uid();
   v_user_tenant_id UUID;
   v_user_role TEXT;
   v_is_service_role BOOLEAN := FALSE;
   v_registro RECORD;
   v_novo_pipeline_status TEXT;
   v_novo_status_pagamento TEXT;
BEGIN
   -- ---------------------------------------------------------------------------
   -- 1. VALIDAÇÃO DE AUTENTICAÇÃO (FAIL-CLOSED)
   -- ---------------------------------------------------------------------------
   IF v_user_id IS NULL THEN
       IF current_setting('role', true) = 'service_role' OR current_user = 'service_role' THEN
           v_is_service_role := TRUE;
       ELSE
           RAISE EXCEPTION 'AUTH_REQUIRED: Operação restrita a usuários autenticados.';
       END IF;
   END IF;

   -- ---------------------------------------------------------------------------
   -- 2. IDENTIFICAÇÃO DE TENANT E ROLE DO USUÁRIO (FAIL-CLOSED)
   -- ---------------------------------------------------------------------------
   IF NOT v_is_service_role THEN
       SELECT tenant_id, lower(role) INTO v_user_tenant_id, v_user_role
       FROM public.profiles
       WHERE user_id = v_user_id OR id = v_user_id
       LIMIT 1;

       -- Fallback seguro para tenant via função de sessão estável
       IF v_user_tenant_id IS NULL THEN
           v_user_tenant_id := public.current_tenant_id();
       END IF;

       -- Fail-closed: tenant DEVE ser obrigatoriamente determinado
       IF v_user_tenant_id IS NULL THEN
           RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível determinar o tenant do usuário autenticado.';
       END IF;

       -- Fail-closed: perfil DEVE estar cadastrado e autorizado
       IF v_user_role IS NULL THEN
           RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Usuário autenticado não possui perfil (role) configurado.';
       END IF;

       -- RBAC por Ação
       IF p_acao = 'finalizar_pagamento' THEN
           IF v_user_role NOT IN ('admin', 'financeiro') THEN
               RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem liquidar pagamentos de custos extras. Perfil atual: %', v_user_role;
           END IF;
       ELSIF p_acao IN ('avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver') THEN
           IF v_user_role NOT IN ('admin', 'rh', 'financeiro') THEN
               RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin, rh ou financeiro podem transicionar custos extras. Perfil atual: %', v_user_role;
           END IF;
       ELSE
           RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao;
       END IF;
   END IF;

   -- ---------------------------------------------------------------------------
   -- 3. LOCALIZAÇÃO E LOCK DO REGISTRO (CONCORRÊNCIA SEGURA)
   -- ---------------------------------------------------------------------------
   SELECT * INTO v_registro
   FROM public.custos_extras_operacionais
   WHERE id = p_id
   FOR UPDATE;
   
   IF NOT FOUND OR v_registro IS NULL THEN
      RAISE EXCEPTION 'REGISTRO_NOT_FOUND: Custo extra % não encontrado.', p_id;
   END IF;

   -- ---------------------------------------------------------------------------
   -- 4. ISOLAMENTO MULTI-TENANT ESTREITO (FAIL-CLOSED)
   -- ---------------------------------------------------------------------------
   IF NOT v_is_service_role AND v_registro.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Acesso negado. O registro de custo extra pertence a outro tenant.';
   END IF;

   -- ---------------------------------------------------------------------------
   -- 5. OPTIMISTIC CONCURRENCY CONTROL (OCC)
   -- ---------------------------------------------------------------------------
   IF v_registro.atualizado_em IS DISTINCT FROM p_updated_at THEN
      RAISE EXCEPTION 'CONCORRENCIA: Registro modificado por outro usuário. Recarregue a página.';
   END IF;
   
   -- ---------------------------------------------------------------------------
   -- 6. CHECAGEM DE SOFT DELETE
   -- ---------------------------------------------------------------------------
   IF v_registro.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO: Registro foi excluído logicamente.';
   END IF;

   v_novo_pipeline_status := v_registro.pipeline_status;
   v_novo_status_pagamento := v_registro.status_pagamento;

   -- ---------------------------------------------------------------------------
   -- 7. MÁQUINA DE ESTADOS REFINADA
   -- ---------------------------------------------------------------------------

   -- AÇÃO: avancar_validacao (RECEBIDO -> EM_VALIDACAO)
   IF p_acao = 'avancar_validacao' THEN
       IF v_registro.pipeline_status != 'RECEBIDO' THEN
           RAISE EXCEPTION 'Estado atual (%) não permite acao de avancar_validacao. Deve estar em RECEBIDO.', v_registro.pipeline_status;
       END IF;
       v_novo_pipeline_status := 'EM_VALIDACAO';

   -- AÇÃO: aprovar (Validação / Aprovação Operacional)
   ELSIF p_acao = 'aprovar' THEN
       IF v_registro.pipeline_status NOT IN ('EM_VALIDACAO', 'RECEBIDO') THEN
           RAISE EXCEPTION 'Estado atual (%) não permite acao de aprovar. Registro deve estar em RECEBIDO ou EM_VALIDACAO.', v_registro.pipeline_status;
       END IF;

       IF v_registro.origem_recurso = 'PAGO_EMPRESA' THEN
           -- Modelo A: Despesa já desembolsada pela empresa. A aprovação finaliza o ciclo e liquida o registro.
           v_novo_pipeline_status := 'FINALIZADO';
           v_novo_status_pagamento := 'PAGO';

       ELSIF v_registro.origem_recurso = 'REEMBOLSO_COLABORADOR' THEN
           -- Reembolso pendente: aprovação operacional confirma despesa e avança para aprovação/baixa financeira.
           v_novo_pipeline_status := 'APROVADO_OPERACAO';
           v_novo_status_pagamento := 'A_PAGAR';

       ELSIF v_registro.origem_recurso = 'PAGAMENTO_PENDENTE' THEN
           -- Obrigação pendente com fornecedor: avança para processamento financeiro como A_PAGAR.
           v_novo_pipeline_status := 'APROVADO_OPERACAO';
           v_novo_status_pagamento := 'A_PAGAR';

        ELSIF v_registro.origem_recurso = 'LEGACY' THEN
            -- LEGACY: preserva comportamento histórico sem reinterpretação forçada.
            v_novo_pipeline_status := 'APROVADO_OPERACAO';
            v_novo_status_pagamento := COALESCE(v_registro.status_pagamento, 'A_PAGAR');

        ELSE
            RAISE EXCEPTION 'ORIGEM_RECURSO_INVALIDA: Origem de recurso (%) não reconhecida para aprovação.', COALESCE(v_registro.origem_recurso, 'NULA');
        END IF;

   -- AÇÃO: enviar_financeiro (APROVADO_OPERACAO -> ENVIADO_FINANCEIRO)
   ELSIF p_acao = 'enviar_financeiro' THEN
       IF v_registro.pipeline_status != 'APROVADO_OPERACAO' THEN
           RAISE EXCEPTION 'Estado atual (%) não permite acao de enviar_financeiro. Registro deve estar em APROVADO_OPERACAO.', v_registro.pipeline_status;
       END IF;

       -- Fail-closed estrito na origem de recurso
       IF v_registro.origem_recurso NOT IN ('REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY') THEN
           IF v_registro.origem_recurso = 'PAGO_EMPRESA' THEN
               RAISE EXCEPTION 'Ação não permitida: registro com origem PAGO_EMPRESA já foi finalizado na aprovação e não deve ser enviado ao financeiro.';
           ELSE
               RAISE EXCEPTION 'Origem de recurso inválida para envio ao financeiro: %', COALESCE(v_registro.origem_recurso, 'NULA');
           END IF;
       END IF;

       v_novo_pipeline_status := 'ENVIADO_FINANCEIRO';
       v_novo_status_pagamento := 'A_PAGAR';

   -- AÇÃO: finalizar_pagamento (Baixa / Liquidação Financeira)
   ELSIF p_acao = 'finalizar_pagamento' THEN
       -- Defesa semântica contra tentativa de liquidar gasto de empresa
       IF v_registro.origem_recurso = 'PAGO_EMPRESA' THEN
           RAISE EXCEPTION 'Ação não permitida: despesa PAGO_EMPRESA já foi liquidada pela empresa e não gera pagamento adicional.';
       END IF;

       -- Apenas registros com obrigação efetiva podem ser baixados
       IF v_registro.origem_recurso NOT IN ('REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY') THEN
           RAISE EXCEPTION 'Origem de recurso inválida para liquidação financeira: %', v_registro.origem_recurso;
       END IF;

       IF v_registro.pipeline_status != 'ENVIADO_FINANCEIRO' THEN
           RAISE EXCEPTION 'Estado atual (%) não permite liquidação financeira. Registro deve estar em ENVIADO_FINANCEIRO.', v_registro.pipeline_status;
       END IF;

       IF v_registro.status_pagamento != 'A_PAGAR' THEN
           IF v_registro.status_pagamento = 'PAGO' THEN
               RAISE EXCEPTION 'Idempotente: O registro já está pago.';
           ELSE
               RAISE EXCEPTION 'Status de pagamento atual (%) não permite baixa. Deve estar A_PAGAR.', v_registro.status_pagamento;
           END IF;
       END IF;

       v_novo_pipeline_status := 'FINALIZADO';
       v_novo_status_pagamento := 'PAGO';

   -- AÇÃO: devolver (Devolução para Correção na Operação)
   ELSIF p_acao = 'devolver' THEN
       -- Estado FINALIZADO é terminal na máquina padrão (não admite devolução genérica)
       IF v_registro.pipeline_status = 'FINALIZADO' THEN
           RAISE EXCEPTION 'Estado FINALIZADO é terminal e não permite devolução pela ação padrão.';
       END IF;

       -- Despesa com pagamento já consumado/liquidado não pode ser devolvida à operação por ação genérica
       IF v_registro.status_pagamento = 'PAGO' THEN
           RAISE EXCEPTION 'Ação não permitida: despesa com status de pagamento PAGO não pode ser devolvida à operação. Requer estorno/reabertura financeira específica.';
       END IF;

       IF v_registro.pipeline_status NOT IN ('EM_VALIDACAO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO') THEN
           RAISE EXCEPTION 'Estado atual (%) não permite devolução.', v_registro.pipeline_status;
       END IF;

       IF p_justificativa IS NULL OR TRIM(p_justificativa) = '' THEN
           RAISE EXCEPTION 'Justificativa obrigatoria para devolução.';
       END IF;

       v_novo_pipeline_status := 'RECEBIDO';
       -- status_pagamento é preservado

   ELSE
       RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao;
   END IF;

   -- ---------------------------------------------------------------------------
   -- 8. EXECUÇÃO DO UPDATE COM INCREMENTO TEMPORAL DE ATUALIZAÇÃO (OCC)
   -- ---------------------------------------------------------------------------
   UPDATE public.custos_extras_operacionais
   SET 
      pipeline_status = v_novo_pipeline_status,
      status_pagamento = v_novo_status_pagamento,
      justificativa_devolucao = COALESCE(p_justificativa, justificativa_devolucao),
      atualizado_em = now()
   WHERE id = p_id;
   
   RETURN jsonb_build_object(
      'success', true,
      'pipeline_status', v_novo_pipeline_status,
      'status_pagamento', v_novo_status_pagamento
   );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_custo_extra_transicionar(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

COMMENT ON FUNCTION public.rpc_custo_extra_transicionar IS 'Transiciona status operacional e financeiro de Custos Extras garantindo regras de OCC, isolamento multi-tenant estrito, RBAC fail-closed, imutabilidade e separação de desembolso por origem_recurso.';
