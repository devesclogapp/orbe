-- Migration: Fase 08.2.5 - Hardening Funcional de Custos Extras
-- TIPO: DDL e DML seguras para auditoria e controle de corretagem

-- 1. ADD SOFT DELETE
ALTER TABLE public.custos_extras_operacionais ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. TABELA DE HISTORICO E AUDITORIA
CREATE TABLE IF NOT EXISTS public.custos_extras_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    custo_extra_id UUID NOT NULL REFERENCES public.custos_extras_operacionais(id) ON DELETE CASCADE,
    tenant_id UUID, 
    usuario_id UUID,
    acao TEXT NOT NULL,
    status_anterior TEXT,
    status_novo TEXT,
    justificativa TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativar RLS no histórico
ALTER TABLE public.custos_extras_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso leitura historico autenticado"
  ON public.custos_extras_historico FOR SELECT TO authenticated USING (true);


-- 3. TRIGGER DE AUDITORIA DE TRANSIÇÕES
CREATE OR REPLACE FUNCTION public.custos_extras_registrar_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario UUID := auth.uid();
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.pipeline_status IS DISTINCT FROM OLD.pipeline_status OR NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento) THEN
             INSERT INTO public.custos_extras_historico(
                 custo_extra_id, tenant_id, usuario_id, acao, status_anterior, status_novo, justificativa
             )
             VALUES(
                 NEW.id, NEW.tenant_id, v_usuario, 'MUDANCA_DE_STATUS', OLD.pipeline_status, NEW.pipeline_status, NEW.justificativa
             );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
         INSERT INTO public.custos_extras_historico(
             custo_extra_id, tenant_id, usuario_id, acao, status_novo
         )
         VALUES(
             NEW.id, NEW.tenant_id, v_usuario, 'CRIACAO', NEW.pipeline_status
         );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custos_extras_historico ON public.custos_extras_operacionais;
CREATE TRIGGER trg_custos_extras_historico
AFTER INSERT OR UPDATE ON public.custos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.custos_extras_registrar_historico();


-- 4. TRIGGER DE IMUTABILIDADE CONDICIONAL
CREATE OR REPLACE FUNCTION public.trg_custos_extras_imutabilidade_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
   -- Ignora soft delete action
   IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        RETURN NEW;
   END IF;
   
   -- Somente checar se estava aprovado antes
   IF (OLD.pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')) THEN
       IF (
           NEW.empresa_id IS DISTINCT FROM OLD.empresa_id OR
           NEW.unidade_id IS DISTINCT FROM OLD.unidade_id OR
           NEW.data IS DISTINCT FROM OLD.data OR
           NEW.categoria_custo IS DISTINCT FROM OLD.categoria_custo OR
           NEW.valor_unitario IS DISTINCT FROM OLD.valor_unitario OR
           NEW.quantidade IS DISTINCT FROM OLD.quantidade OR
           NEW.forma_pagamento_id IS DISTINCT FROM OLD.forma_pagamento_id OR
           NEW.total IS DISTINCT FROM OLD.total
       ) THEN
           RAISE EXCEPTION 'IMUTABILIDADE_VIOLADA: Custo Extra não pode ter valores operacionais e estruturais alterados após aprovação (% -> %). Apenas campos administrativos e de pipeline são permitidos.', OLD.pipeline_status, NEW.pipeline_status;
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


-- 5. RPC UNIFICADA DE TRANSIÇÃO (COM OCC)
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
   v_registro RECORD;
   v_novo_pipeline_status TEXT;
   v_novo_status_pagamento TEXT;
BEGIN
   SELECT * INTO v_registro
   FROM public.custos_extras_operacionais
   WHERE id = p_id;
   
   IF v_registro IS NULL THEN
      RAISE EXCEPTION 'Registro não encontrado: %', p_id;
   END IF;

   -- Optimistic Concurrency Control (OCC)
   IF v_registro.atualizado_em IS DISTINCT FROM p_updated_at THEN
      RAISE EXCEPTION 'CONCORRENCIA: Registro modificado por outro usuário. Recarregue a página.';
   END IF;
   
   IF v_registro.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO: Registro foi excluído logicamente.';
   END IF;

   v_novo_pipeline_status := v_registro.pipeline_status;
   v_novo_status_pagamento := v_registro.status_pagamento;

   IF p_acao = 'avancar_validacao' THEN
       IF v_registro.pipeline_status != 'RECEBIDO' THEN
           RAISE EXCEPTION 'Estado atual (%) não permite acao de avancar_validacao', v_registro.pipeline_status;
       END IF;
       v_novo_pipeline_status := 'EM_VALIDACAO';
       
   ELSIF p_acao = 'aprovar' THEN
       IF v_registro.pipeline_status != 'EM_VALIDACAO' AND v_registro.pipeline_status != 'RECEBIDO' THEN
           RAISE EXCEPTION 'Estado atual (%) não permite acao de aprovar', v_registro.pipeline_status;
       END IF;
       v_novo_pipeline_status := 'APROVADO_OPERACAO';

   ELSIF p_acao = 'enviar_financeiro' THEN
       IF v_registro.pipeline_status != 'APROVADO_OPERACAO' THEN
           RAISE EXCEPTION 'Estado atual (%) não permite acao de enviar_financeiro', v_registro.pipeline_status;
       END IF;
       v_novo_pipeline_status := 'ENVIADO_FINANCEIRO';

   ELSIF p_acao = 'finalizar_pagamento' THEN
       IF v_registro.status_pagamento = 'PAGO' THEN
           RAISE EXCEPTION 'Idempotente: O registro já está pago.';
       END IF;
       -- Em um fluxo real, a transição para FINALIZADO acompanharia status_pagamento PAGO
       v_novo_pipeline_status := 'FINALIZADO';
       v_novo_status_pagamento := 'PAGO';

   ELSIF p_acao = 'devolver' THEN
       IF p_justificativa IS NULL OR p_justificativa = '' THEN
           RAISE EXCEPTION 'Justificativa obrigatoria para devolução.';
       END IF;
       v_novo_pipeline_status := 'RECEBIDO';
       
   ELSE
       RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao;
   END IF;

   UPDATE public.custos_extras_operacionais
   SET 
      pipeline_status = v_novo_pipeline_status,
      status_pagamento = v_novo_status_pagamento,
      justificativa = COALESCE(p_justificativa, justificativa)
   WHERE id = p_id;
   
   RETURN jsonb_build_object(
      'success', true,
      'pipeline_status', v_novo_pipeline_status,
      'status_pagamento', v_novo_status_pagamento
   );
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_custo_extra_transicionar(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- 6. SOFT DELETE IMPORT (Refatoração da RPC replace_imported_custos_extras_operacionais)
-- Ajustaremos a exclusao fisica:
CREATE OR REPLACE FUNCTION public.replace_imported_custos_extras_operacionais(
  p_empresa_id UUID,
  p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa e obrigatoria para reimportacao de custos extras.';
  END IF;

  -- SOFT DELETE em vez de DELETE Fisico
  UPDATE public.custos_extras_operacionais
  SET deleted_at = NOW()
  WHERE empresa_id = p_empresa_id
    AND origem_dado = 'importacao'
    AND deleted_at IS NULL; 

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.custos_extras_operacionais (
    data,
    empresa_id,
    empresa_nome,
    categoria_custo,
    descricao,
    valor_unitario,
    quantidade,
    total,
    forma_pagamento,
    data_vencimento,
    status_pagamento,
    operacao_id,
    tipo_lancamento,
    avaliacao_json,
    origem_dado
  )
  SELECT
    NULLIF(item->>'data', '')::date,
    p_empresa_id,
    NULLIF(item->>'empresa_nome', ''),
    COALESCE(NULLIF(item->>'categoria_custo', ''), 'OPERACIONAL'),
    COALESCE(NULLIF(item->>'descricao', ''), 'Sem descricao'),
    COALESCE((item->>'valor_unitario')::numeric, 0),
    COALESCE((item->>'quantidade')::numeric, 0),
    COALESCE((item->>'total')::numeric, 0),
    NULLIF(item->>'forma_pagamento', ''),
    NULLIF(item->>'data_vencimento', '')::date,
    NULLIF(item->>'status_pagamento', ''),
    NULLIF(item->>'operacao_id', '')::uuid,
    COALESCE(NULLIF(item->>'tipo_lancamento', ''), 'DESPESA'),
    item->'avaliacao_json',
    COALESCE(NULLIF(item->>'origem_dado', ''), 'importacao')
  FROM jsonb_array_elements(p_items) AS item;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;
