-- ============================================================
-- FIX: Trigger auto-tenant em tipos_servico_operacional
--      e formas_pagamento_operacional
-- Data: 2026-05-12
-- Objetivo: Inserções feitas pelo frontend sem tenant_id explícito
--           são automaticamente preenchidas com current_tenant_id()
-- ============================================================

-- Função genérica: seta tenant_id = current_tenant_id() se NULL
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger em tipos_servico_operacional
DROP TRIGGER IF EXISTS trg_auto_tenant_tipos_servico
  ON public.tipos_servico_operacional;

CREATE TRIGGER trg_auto_tenant_tipos_servico
  BEFORE INSERT ON public.tipos_servico_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- Trigger em formas_pagamento_operacional
DROP TRIGGER IF EXISTS trg_auto_tenant_formas_pagamento
  ON public.formas_pagamento_operacional;

CREATE TRIGGER trg_auto_tenant_formas_pagamento
  BEFORE INSERT ON public.formas_pagamento_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- Aplicar também nas demais tabelas operacionais (que usam auto_set_tenant_from_empresa)
-- Para tabelas SEM empresa_id (como ciclos, lotes, etc.)
DROP TRIGGER IF EXISTS trg_auto_tenant_ciclos_diaristas
  ON public.ciclos_diaristas;
CREATE TRIGGER trg_auto_tenant_ciclos_diaristas
  BEFORE INSERT ON public.ciclos_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lote_diaristas
  ON public.lote_pagamento_diaristas;
CREATE TRIGGER trg_auto_tenant_lote_diaristas
  BEFORE INSERT ON public.lote_pagamento_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lote_itens
  ON public.lote_pagamento_itens;
CREATE TRIGGER trg_auto_tenant_lote_itens
  BEFORE INSERT ON public.lote_pagamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lanc_adicionais
  ON public.lancamentos_adicionais_diaristas;
CREATE TRIGGER trg_auto_tenant_lanc_adicionais
  BEFORE INSERT ON public.lancamentos_adicionais_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_regras_fechamento
  ON public.regras_fechamento;
CREATE TRIGGER trg_auto_tenant_regras_fechamento
  BEFORE INSERT ON public.regras_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lancamentos_fin
  ON public.lancamentos_financeiros;
CREATE TRIGGER trg_auto_tenant_lancamentos_fin
  BEFORE INSERT ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- Verificação dos triggers criados
SELECT
  trigger_name,
  event_object_table AS tabela,
  action_timing,
  event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_auto_tenant_%'
ORDER BY event_object_table;
