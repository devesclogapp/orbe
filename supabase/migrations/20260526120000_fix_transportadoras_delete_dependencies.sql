-- Migration: Corrige dependências para exclusão de transportadoras por tenant
-- Data: 2026-05-26
-- Objetivo:
--   1. Corrigir invalidate_ciclo_operacional() para usar tenant_id em ciclos_operacionais
--   2. Tornar operacoes_producao.transportadora_id anulável com FK ON DELETE SET NULL
--   3. Limpar referências em operacoes_producao e excluir transportadoras_clientes do tenant alvo

CREATE OR REPLACE FUNCTION public.invalidate_ciclo_operacional()
RETURNS TRIGGER AS $BODY$
DECLARE
    v_payload JSONB;
    v_data DATE;
    v_empresa_id UUID;
    v_tenant_id UUID;
    v_ciclo_id UUID;
    v_status_antigo VARCHAR;
BEGIN
    v_payload := CASE
        WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        ELSE to_jsonb(NEW)
    END;

    IF TG_TABLE_NAME NOT IN ('registros_ponto', 'operacoes_producao') THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    v_data := COALESCE(
        NULLIF(v_payload->>'data_registro', '')::date,
        NULLIF(v_payload->>'data_operacao', '')::date,
        NULLIF(v_payload->>'data', '')::date
    );

    v_empresa_id := NULLIF(v_payload->>'empresa_id', '')::uuid;
    v_tenant_id := NULLIF(v_payload->>'tenant_id', '')::uuid;

    IF v_tenant_id IS NULL AND v_empresa_id IS NOT NULL THEN
        SELECT e.tenant_id
          INTO v_tenant_id
          FROM public.empresas e
         WHERE e.id = v_empresa_id
         LIMIT 1;
    END IF;

    IF v_data IS NULL OR v_tenant_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    SELECT c.id, c.status_automacao
      INTO v_ciclo_id, v_status_antigo
      FROM public.ciclos_operacionais c
     WHERE c.tenant_id = v_tenant_id
       AND v_data >= c.data_inicio
       AND v_data <= c.data_fim
     ORDER BY c.data_inicio DESC
     LIMIT 1;

    IF v_ciclo_id IS NOT NULL AND v_status_antigo IN ('pronto_para_fechamento') THEN
        UPDATE public.ciclos_operacionais
           SET status_automacao = 'aguardando_validacao',
               status_automacao_atualizado_em = NOW(),
               updated_at = NOW()
         WHERE id = v_ciclo_id;

        IF v_empresa_id IS NOT NULL THEN
            INSERT INTO public.automacao_alertas (
                empresa_id,
                tenant_id,
                tipo,
                severidade,
                mensagem,
                contexto_json
            ) VALUES (
                v_empresa_id,
                v_tenant_id,
                'ciclo_invalidado_automaticamente',
                'warning',
                'Ciclo reaberto automaticamente devido a alterações em ' || TG_TABLE_NAME || ' no dia ' || v_data,
                jsonb_build_object(
                    'ciclo_id', v_ciclo_id,
                    'tenant_id', v_tenant_id,
                    'tabela', TG_TABLE_NAME,
                    'data', v_data,
                    'acao', TG_OP
                )
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT c.conname
      INTO v_constraint_name
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.operacoes_producao'::regclass
       AND c.contype = 'f'
       AND a.attname = 'transportadora_id'
     LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE public.operacoes_producao DROP CONSTRAINT %I',
            v_constraint_name
        );
    END IF;
END $$;

ALTER TABLE public.operacoes_producao
    ALTER COLUMN transportadora_id DROP NOT NULL;

ALTER TABLE public.operacoes_producao
    ADD CONSTRAINT operacoes_producao_transportadora_id_fkey
    FOREIGN KEY (transportadora_id)
    REFERENCES public.transportadoras_clientes(id)
    ON DELETE SET NULL;

DO $$
DECLARE
    v_target_tenant UUID;
    v_match_count INTEGER;
    v_transportadoras_count INTEGER;
    v_operacoes_updated INTEGER := 0;
    v_transportadoras_deleted INTEGER := 0;
BEGIN
    SELECT COUNT(*)
      INTO v_match_count
      FROM public.tenants t
     WHERE t.id::text ILIKE 'f34143ea%';

    IF v_match_count <> 1 THEN
        RAISE NOTICE 'Cleanup de transportadoras ignorado: encontrados % tenants com prefixo f34143ea.', v_match_count;
        RETURN;
    END IF;

    SELECT t.id
      INTO v_target_tenant
      FROM public.tenants t
     WHERE t.id::text ILIKE 'f34143ea%'
     LIMIT 1;

    SELECT COUNT(*)
      INTO v_transportadoras_count
      FROM public.transportadoras_clientes tc
     WHERE tc.tenant_id = v_target_tenant;

    UPDATE public.operacoes_producao op
       SET transportadora_id = NULL
     WHERE op.transportadora_id IN (
         SELECT tc.id
           FROM public.transportadoras_clientes tc
          WHERE tc.tenant_id = v_target_tenant
     );

    GET DIAGNOSTICS v_operacoes_updated = ROW_COUNT;

    DELETE FROM public.transportadoras_clientes tc
     WHERE tc.tenant_id = v_target_tenant;

    GET DIAGNOSTICS v_transportadoras_deleted = ROW_COUNT;

    RAISE NOTICE 'Tenant %: % operacoes_producao atualizadas para NULL; %/% transportadoras_clientes removidas.',
        v_target_tenant,
        v_operacoes_updated,
        v_transportadoras_deleted,
        v_transportadoras_count;
END $$;
