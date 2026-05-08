-- Migration: Corrige reset demo para remover fornecedor_valores_servico
-- mesmo quando o tenant_id residual estiver inconsistente, evitando
-- bloqueio ao excluir tipos_regra_operacional e outros catálogos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'build_reset_plan'
      AND pg_get_function_identity_arguments(p.oid) = 'p_mode text'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'build_reset_plan_v1'
      AND pg_get_function_identity_arguments(p.oid) = 'p_mode text'
  ) THEN
    ALTER FUNCTION public.build_reset_plan(text) RENAME TO build_reset_plan_v1;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.build_reset_plan(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
DECLARE
  v_plan jsonb;
  v_fvs_count_sql text := 'SELECT COUNT(*) FROM public.fornecedor_valores_servico fvs
    WHERE fvs.tenant_id = $1
       OR fvs.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = $1)
       OR fvs.unidade_id IN (SELECT id FROM public.unidades WHERE tenant_id = $1)
       OR fvs.fornecedor_id IN (SELECT id FROM public.fornecedores WHERE tenant_id = $1)
       OR fvs.transportadora_id IN (SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1)
       OR fvs.produto_carga_id IN (SELECT id FROM public.produtos_carga WHERE tenant_id = $1)
       OR fvs.tipo_servico_id IN (SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1)
       OR fvs.tipo_regra_id IN (SELECT id FROM public.tipos_regra_operacional WHERE tenant_id = $1)
       OR fvs.forma_pagamento_id IN (SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1)';
  v_fvs_delete_sql text := 'DELETE FROM public.fornecedor_valores_servico fvs
    WHERE fvs.tenant_id = $1
       OR fvs.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = $1)
       OR fvs.unidade_id IN (SELECT id FROM public.unidades WHERE tenant_id = $1)
       OR fvs.fornecedor_id IN (SELECT id FROM public.fornecedores WHERE tenant_id = $1)
       OR fvs.transportadora_id IN (SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1)
       OR fvs.produto_carga_id IN (SELECT id FROM public.produtos_carga WHERE tenant_id = $1)
       OR fvs.tipo_servico_id IN (SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1)
       OR fvs.tipo_regra_id IN (SELECT id FROM public.tipos_regra_operacional WHERE tenant_id = $1)
       OR fvs.forma_pagamento_id IN (SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1)';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'build_reset_plan_v1'
      AND pg_get_function_identity_arguments(p.oid) = 'p_mode text'
  ) THEN
    v_plan := public.build_reset_plan_v1(p_mode);
  ELSE
    RAISE EXCEPTION 'Função base public.build_reset_plan_v1(text) não encontrada para aplicar o patch do reset demo.';
  END IF;

  IF upper(coalesce(p_mode, '')) = 'DEMO' THEN
    SELECT jsonb_agg(
             CASE
               WHEN item->>'table_name' = 'fornecedor_valores_servico' THEN
                 item || jsonb_build_object(
                   'count_sql', v_fvs_count_sql,
                   'delete_sql', v_fvs_delete_sql
                 )
               ELSE item
             END
             ORDER BY (item->>'delete_priority')::int
           )
      INTO v_plan
      FROM jsonb_array_elements(v_plan) AS item;
  END IF;

  RETURN v_plan;
END;
$function$;
