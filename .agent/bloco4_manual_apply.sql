-- ============================================================
-- BLOCO 4: ETAPA 2 — MIGRATION A (ESTRUTURAS BASE NULLABLE)
-- ============================================================

-- 1. Adicionar colunas base em cnab_remessas_arquivos (NULLABLE para backfill)
ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- (O tenant_id já existe e já é NOT NULL)

-- 2. Criar tabela física de itens da remessa (Vínculo unificado)
CREATE TABLE IF NOT EXISTS public.cnab_remessa_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remessa_id UUID NOT NULL REFERENCES public.cnab_remessas_arquivos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    
    origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('CLT', 'INTERMITENTE', 'DIARISTA')),
    origem_id UUID NOT NULL, -- Pode apontar para rh_financeiro_lote_itens.id, lancamentos_intermitentes.id ou lancamentos_diaristas.id dependendo do tipo
    
    -- Cache financeiro
    fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL,
    lote_item_id UUID, 
    
    valor NUMERIC(15, 2) NOT NULL CHECK (valor > 0),
    status TEXT NOT NULL DEFAULT 'remetido' CHECK (status IN ('remetido', 'conciliado', 'rejeitado', 'divergente', 'cancelado', 'invalidado')),
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- RLS para a nova tabela
ALTER TABLE public.cnab_remessa_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessa_itens_select" ON public.cnab_remessa_itens;
CREATE POLICY "tenant_isolation_cnab_remessa_itens_select"
    ON public.cnab_remessa_itens FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessa_itens_insert" ON public.cnab_remessa_itens;
CREATE POLICY "tenant_isolation_cnab_remessa_itens_insert"
    ON public.cnab_remessa_itens FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessa_itens_update" ON public.cnab_remessa_itens;
CREATE POLICY "tenant_isolation_cnab_remessa_itens_update"
    ON public.cnab_remessa_itens FOR UPDATE
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessa_itens_delete" ON public.cnab_remessa_itens;
CREATE POLICY "tenant_isolation_cnab_remessa_itens_delete"
    ON public.cnab_remessa_itens FOR DELETE
    USING (tenant_id = (SELECT public.current_tenant_id()));

-- Indice parcial de idempotencia imediato (pois a tabela esta vazia e e' seguro aplicar constraint agora)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessa_itens_origem 
ON public.cnab_remessa_itens (tenant_id, origem_tipo, origem_id)
WHERE status NOT IN ('cancelado', 'invalidado');

-- Trigger de updated_at para a nova tabela
CREATE OR REPLACE FUNCTION public.update_cnab_remessa_itens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cnab_remessa_itens_updated_at ON public.cnab_remessa_itens;
CREATE TRIGGER update_cnab_remessa_itens_updated_at
    BEFORE UPDATE ON public.cnab_remessa_itens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cnab_remessa_itens_updated_at();
-- ============================================================
-- BLOCO 4: ETAPA 3 — BACKFILL (SANEAMENTO E VINCULAÇÃO)
-- ============================================================

-- 1. Tenta preencher empresa_id com base na Conta Bancaria relacionada
UPDATE public.cnab_remessas_arquivos r
SET empresa_id = c.empresa_id
FROM public.contas_bancarias_empresa c
WHERE r.conta_bancaria_id = c.id
  AND r.empresa_id IS NULL;

-- 2. Tenta preencher empresa_id com base no Lote (se lotes_remessa possuir empresa_id ou através de faturas)
UPDATE public.cnab_remessas_arquivos r
SET empresa_id = f.empresa_id
FROM public.faturas f
WHERE r.lote_id = f.lote_remessa_id
  AND r.empresa_id IS NULL
  AND f.empresa_id IS NOT NULL;

-- ============================================================
-- BLOCO 4: ETAPA 4 — GATE DO BACKFILL (AUDITORIA)
-- O sistema só poderá avançar para a Migration B se esta query retornar 0.
-- ============================================================
-- SELECT id, tenant_id, conta_bancaria_id, lote_id, nome_arquivo 
-- FROM public.cnab_remessas_arquivos 
-- WHERE empresa_id IS NULL;
-- ============================================================
-- BLOCO 4: ETAPA 4.2 — SANEAMENTO DE ÓRFÃOS (GATE) (CORREÇÃO DE TRIGGER)
-- ============================================================

-- A tentativa de deletar falhou porque a tabela cnab_auditoria_bancaria possui
-- um trigger estrito (block_audit_change) que impede o UPDATE disparado pelo 
-- "ON DELETE SET NULL" da chave estrangeira.
-- Como esses 2 arquivos de teste não podem ser deletados sem violar a regra de append-only
-- da auditoria, nós vamos vincular esses registros à primeira empresa do Tenant de forma 
-- forçada e marcá-los como erro, satisfazendo a constraint pacíficamente.

UPDATE public.cnab_remessas_arquivos r
SET 
  empresa_id = (SELECT e.id FROM public.empresas e WHERE e.tenant_id = r.tenant_id LIMIT 1),
  observacoes = 'REGISTRO ORFÃO VINCULADO AUTOMATICAMENTE DURANTE A MIGRATION DE IDEMPOTÊNCIA CNAB',
  status = 'erro_homologacao'
WHERE r.empresa_id IS NULL;
-- ============================================================
-- BLOCO 4: ETAPA 5 — MIGRATION B (CONSTRAINTS E NOT NULL)
-- ============================================================

-- 1. Aplicar restrição NOT NULL na coluna empresa_id (agora que o backfill garantiu 100% de preenchimento)
ALTER TABLE public.cnab_remessas_arquivos
ALTER COLUMN empresa_id SET NOT NULL;

-- 2. Constraints adicionais de Integridade (Foreign Keys que blindam cruzamento de Tenant)
-- NOTA: Isto obriga que a conta bancária pertença rigorosamente ao tenant de quem está inserindo
-- Se a tabela de lote/conta não suportar UNIQUE(id, tenant_id), essa restrição pode falhar (Depende da infra de Contas Bancarias)
-- (Vamos primeiro assegurar o basico: FK direta se já não houver, o que existe pelo CREATE)

-- 3. Blindagem de Idempotência do Arquivo (Evitar processar o mesmo CNAB físico)
-- Drop the less restrictive index if it exists, and apply the strict one
DROP INDEX IF EXISTS public.idx_cnab_remessas_arquivos_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessas_idempotency
ON public.cnab_remessas_arquivos (tenant_id, conta_bancaria_id, hash_arquivo);

-- 4. Retornos: Aplicar idempotência de Arquivo de Retorno
CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_retorno_idempotency
ON public.cnab_retorno_arquivos (tenant_id, banco_codigo, hash_arquivo);
-- ============================================================
-- BLOCO 4: ETAPA 6 — MIGRATION E — RPC DE GERAÇÃO (TRANSAÇÃO ATÔMICA)
-- ============================================================

-- Remover função anterior, se existir
DROP FUNCTION IF EXISTS public.rpc_registrar_cnab_remessa(UUID, UUID, UUID, UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(
    p_conta_bancaria_id UUID,
    p_lote_id UUID,
    p_empresa_id UUID,
    p_modo TEXT, -- 'producao' ou 'homologacao'
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_total_valor NUMERIC,
    p_total_registros INTEGER,
    p_itens JSONB -- Array of JSON containing {origem_tipo, origem_id, fatura_id, lote_item_id, valor}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_empresa_valida BOOLEAN;
    v_conta_valida BOOLEAN;
    v_remessa_id UUID;
    v_sequencial INTEGER;
    v_item JSONB;
    v_item_count INTEGER := 0;
    v_item_sum NUMERIC := 0;
BEGIN
    -- 1. Obter e validar o usuário e o Tenant atrelado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Obter o tenant correspondente ao contexto/usuário (ou via RLS config)
    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Tenant indisponível para o contexto atual.';
    END IF;

    -- 2. Validar Empresa e Tenant
    SELECT EXISTS (
        SELECT 1 FROM public.empresas 
        WHERE id = p_empresa_id AND tenant_id = v_tenant_id
    ) INTO v_empresa_valida;

    IF NOT v_empresa_valida THEN
        RAISE EXCEPTION 'Falha de Segurança: Empresa % não pertence ao Tenant %', p_empresa_id, v_tenant_id;
    END IF;

    -- 3. Validar Conta Bancária
    SELECT EXISTS (
        SELECT 1 FROM public.contas_bancarias_empresa 
        WHERE id = p_conta_bancaria_id 
          AND empresa_id = p_empresa_id 
          AND tenant_id = v_tenant_id 
          AND ativo = true
    ) INTO v_conta_valida;

    IF NOT v_conta_valida THEN
        RAISE EXCEPTION 'Falha de Segurança: Conta Bancária inválida, inativa ou pertencente a outra empresa/tenant.';
    END IF;

    -- 4. Validar Identidade contra o JSON de Itens (Sum verification)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_count := v_item_count + 1;
        v_item_sum := v_item_sum + (v_item->>'valor')::NUMERIC;
    END LOOP;

    IF v_item_count <> p_total_registros THEN
        RAISE EXCEPTION 'Divergência: Total de registros declarados (%) difere do payload (%)', p_total_registros, v_item_count;
    END IF;

    IF v_item_sum <> p_total_valor THEN
        RAISE EXCEPTION 'Divergência: Valor total declarado (%) difere da soma real dos itens (%)', p_total_valor, v_item_sum;
    END IF;

    -- 5. Criar a Remessa Fisicamente (O Banco vai rejeitar automático se o Hash já existir)
    -- O sequencial pode ser obtido atômico através da func `get_next_cnab_sequencial`
    v_sequencial := public.get_next_cnab_sequencial(v_tenant_id, p_conta_bancaria_id, '000'); -- Assumindo '000' ou buscar de configuracoes, aqui simplificado

    INSERT INTO public.cnab_remessas_arquivos (
        tenant_id, empresa_id, lote_id, conta_bancaria_id, nome_arquivo,
        sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, data_geracao
    ) VALUES (
        v_tenant_id, p_empresa_id, p_lote_id, p_conta_bancaria_id, p_nome_arquivo,
        v_sequencial, p_hash_arquivo, p_total_registros, p_total_valor,
        p_modo, 'gerado', v_user_id, timezone('utc', now())
    ) RETURNING id INTO v_remessa_id;

    -- 6. Inserir cnab_remessa_itens (Vínculo individual e Idempotência NATIVA de iten)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        -- Se o item_id e origem_tipo existirem e já estiverem faturados, 
        -- a UNIQUE KEY criada na Etapa 2 vai disparar uma FK Error ou Unique Violation que ativará ROLLBACK automático.
        INSERT INTO public.cnab_remessa_itens (
            remessa_id, tenant_id, empresa_id, origem_tipo, origem_id, 
            fatura_id, lote_item_id, valor, status, criado_por
        ) VALUES (
            v_remessa_id, v_tenant_id, p_empresa_id, 
            v_item->>'origem_tipo', (v_item->>'origem_id')::UUID,
            NULLIF(v_item->>'fatura_id', '')::UUID, NULLIF(v_item->>'lote_item_id', '')::UUID,
            (v_item->>'valor')::NUMERIC, 'remetido', v_user_id
        );
        
        -- Marcar origem como remetida / aguardando retorno
        IF (v_item->>'origem_tipo') = 'CLT' OR (v_item->>'origem_tipo') = 'INTERMITENTE' THEN
             UPDATE public.rh_financeiro_lote_itens
             SET status = 'AGUARDANDO_RETORNO', updated_at = now()
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        ELSIF (v_item->>'origem_tipo') = 'FATURA' THEN
             UPDATE public.faturas
             SET status = 'remetida_ao_banco', updated_at = now()
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        END IF;

    END LOOP;

    -- 7. Gravação de Auditoria (Append Only)
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, v_remessa_id, p_lote_id, 'geracao', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'REMESSA_GERADA_ATOMICAMENTE',
            'modo', p_modo,
            'registros', p_total_registros,
            'hash', p_hash_arquivo
        ),
        '127.0.0.1'
    );

    -- Se chegou aqui sem Exceptions (ex: violacoes UNIQUE não detectadas), submeterá COMMIT.
    RETURN jsonb_build_object(
        'sucesso', true,
        'remessa_id', v_remessa_id,
        'sequencial', v_sequencial,
        'linhas_afetadas', v_item_count
    );

END;
$$;

-- Restrição de Segurança: Somente usuários logados podem tentar executar
REVOKE ALL ON FUNCTION public.rpc_registrar_cnab_remessa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_cnab_remessa TO authenticated;
-- ============================================================
-- BLOCO 4: ETAPA 7 — MIGRATION F (IMUTABILIDADE)
-- ============================================================

-- Trigger defensiva para impedir alterações cruciais após a Remessa nascer.
-- Apenas status de processamento (ex: 'enviado', 'homologado') podem variar.

CREATE OR REPLACE FUNCTION public.check_cnab_remessa_imutabilidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se o registro já existir (UPDATE)
    IF TG_OP = 'UPDATE' THEN
        -- Proteção dos blocos fundamentais (Não podem mudar estruturalmente após 'gerado')
        IF OLD.status IN ('gerado', 'baixado', 'enviado', 'enviado_manual', 'homologado') THEN
            
            IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
                RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Tenants.';
            END IF;

            IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
                RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Empresas.';
            END IF;

            IF NEW.conta_bancaria_id IS DISTINCT FROM OLD.conta_bancaria_id THEN
                RAISE EXCEPTION 'Imutabilidade violada: Conta Bancária não pode ser alterada em arquivo já gerado.';
            END IF;

            IF NEW.hash_arquivo IS DISTINCT FROM OLD.hash_arquivo THEN
                RAISE EXCEPTION 'Imutabilidade violada: Hash do Arquivo (Checksum) corrompido ou alterado indevidamente.';
            END IF;

            IF NEW.conteudo_arquivo IS DISTINCT FROM OLD.conteudo_arquivo THEN
                RAISE EXCEPTION 'Imutabilidade violada: O conteúdo em texto do CNAB não pode ser alterado após registro.';
            END IF;

            IF NEW.total_valor IS DISTINCT FROM OLD.total_valor THEN
                RAISE EXCEPTION 'Imutabilidade violada: O Valor Total é imutável.';
            END IF;

            IF NEW.total_registros IS DISTINCT FROM OLD.total_registros THEN
                RAISE EXCEPTION 'Imutabilidade violada: O Volume de Registros (Linhas) é imutável.';
            END IF;

            IF NEW.sequencial_arquivo IS DISTINCT FROM OLD.sequencial_arquivo THEN
                RAISE EXCEPTION 'Imutabilidade violada: O Sequencial Bancário é estritamente fixo.';
            END IF;

            -- Bloquear certas mudanças de STATUS
            IF NEW.status = 'cancelado' AND OLD.status IN ('enviado', 'enviado_manual', 'homologado', 'processado') THEN
                 RAISE EXCEPTION 'Workflow violado: Arquivos submetidos / enviados não podem mais ser cancelados (exige tratar estorno/retorno bancário).';
            END IF;
            
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_cnab_remessa_imutabilidade ON public.cnab_remessas_arquivos;
CREATE TRIGGER enforce_cnab_remessa_imutabilidade
    BEFORE UPDATE ON public.cnab_remessas_arquivos
    FOR EACH ROW
    EXECUTE FUNCTION public.check_cnab_remessa_imutabilidade();
-- ============================================================
-- BLOCO 4: ETAPAS 8 & 9 — MIGRATION G (RPC CONCILIAÇÃO CNAB)
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_aplicar_cnab_retorno(UUID, UUID, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_aplicar_cnab_retorno(
    p_empresa_id UUID,
    p_conta_bancaria_id UUID,
    p_banco_codigo TEXT,
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_itens JSONB -- Array of JSON containing {remessa_id, remessa_item_id, origem_tipo, origem_id, status, data_ocorrencia, codigo_ocorrencia, descricao_ocorrencia, valor_pago}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_retorno_id UUID;
    v_item JSONB;
    v_item_count INTEGER := 0;
    v_linhas_afetadas INTEGER := 0;
    v_afetados_totais INTEGER := 0;
BEGIN
    -- 1. Identificar contexto
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Tenant indisponível para o contexto atual.';
    END IF;

    -- 2. Validar Empresa e Banco
    IF NOT EXISTS (
        SELECT 1 FROM public.contas_bancarias_empresa 
        WHERE id = p_conta_bancaria_id 
          AND empresa_id = p_empresa_id 
          AND tenant_id = v_tenant_id 
          AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Falha de Segurança: Conta Bancária % (Empresa %) não vinculada de forma válida.', p_conta_bancaria_id, p_empresa_id;
    END IF;

    -- 3. Registrar Cabeçalho do Retorno na tabela de Idempotência
    -- O índice unique idx_cnab_retorno_arquivos_hash abortará a transação automaticamente 
    -- se o hash_arquivo já foi processado neste tenant/banco.
    INSERT INTO public.cnab_retorno_arquivos (
        tenant_id, nome_arquivo, hash_arquivo, banco_codigo,
        status, usuario_processamento, data_processamento
    ) VALUES (
        v_tenant_id, p_nome_arquivo, p_hash_arquivo, p_banco_codigo,
        'processado', v_user_id, timezone('utc', now())
    ) RETURNING id INTO v_retorno_id;

    -- 4. Iterar sobre todos os itens detalhados no retorno
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_count := v_item_count + 1;

        -- 4.1 Inserir registro detalhado na cnab_retorno_itens
        INSERT INTO public.cnab_retorno_itens (
            tenant_id, retorno_arquivo_id, remessa_arquivo_id, 
            status, codigo_ocorrencia, descricao_ocorrencia, 
            valor_esperado, valor_retornado, linha_original, 
            data_ocorrencia
        ) VALUES (
            v_tenant_id, v_retorno_id, NULLIF(v_item->>'remessa_id', '')::UUID,
            v_item->>'status', v_item->>'codigo_ocorrencia', v_item->>'descricao_ocorrencia',
            (v_item->>'valor_esperado')::NUMERIC, (v_item->>'valor_pago')::NUMERIC, v_item->>'linha_original',
            NULLIF(v_item->>'data_ocorrencia', '')::DATE
        );

        -- 4.2 Lógica de Baixa Baseada em Status
        IF (v_item->>'status') = 'pago' THEN
            v_linhas_afetadas := 0;

            -- OCC Constraint: Atualizar APENAS SE o alvo pertencer ao tenant atual (Hard-Bounded)
            -- e o status não estiver cancelado.
            IF (v_item->>'origem_tipo') = 'CLT' OR (v_item->>'origem_tipo') = 'INTERMITENTE' THEN
                WITH updated AS (
                    UPDATE public.rh_financeiro_lote_itens
                    SET status = 'PAGO', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND tenant_id = v_tenant_id
                      AND status IN ('AGUARDANDO_RETORNO', 'PROCESSADO', 'ENVIADO') 
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;
                
            ELSIF (v_item->>'origem_tipo') = 'FATURA' THEN
                WITH updated AS (
                    UPDATE public.faturas
                    SET status = 'paga', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND tenant_id = v_tenant_id
                      AND status IN ('remetida_ao_banco') 
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;
            END IF;

            -- 4.3 Confirmação Estrutural OCC (Row Parity Check)
            -- Se v_linhas_afetadas for menor que 1, significa que o registro não foi 
            -- elegível (violou ambiente, tenant, ou já estava concialiado), forçando um Rollback integral.
            IF v_linhas_afetadas <> 1 THEN
                RAISE EXCEPTION 'Divergência Crítica: Tentativa de baixa de Origem ID % (TIPO %) falhou! Conta não elegível ou Tenant Violado. ROLLBACK ativado.', 
                    v_item->>'origem_id', v_item->>'origem_tipo';
            END IF;
            
            v_afetados_totais := v_afetados_totais + v_linhas_afetadas;
        END IF;

        -- Marcar o item da remessa subjacente
        IF (v_item->>'remessa_item_id') IS NOT NULL AND (v_item->>'remessa_item_id') <> '' THEN
             UPDATE public.cnab_remessa_itens
             SET status = (v_item->>'status')
             WHERE id = (v_item->>'remessa_item_id')::UUID
               AND tenant_id = v_tenant_id
               AND status = 'remetido';
        END IF;

    END LOOP;

    -- Auditoria
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, NULL, NULL, 'processamento_retorno', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'RETORNO_BANCARIO_ATOMICAMENTE',
            'hash', p_hash_arquivo,
            'linhas_recebidas', v_item_count,
            'baixas_realizadas', v_afetados_totais
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'retorno_arquivo_id', v_retorno_id,
        'linhas_recebidas', v_item_count,
        'baixas_efetuadas', v_afetados_totais
    );

END;
$$;

REVOKE ALL ON FUNCTION public.rpc_aplicar_cnab_retorno FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_cnab_retorno TO authenticated;
