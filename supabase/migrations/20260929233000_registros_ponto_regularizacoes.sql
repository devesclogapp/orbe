-- ==============================================================================
-- MIGRATION: 20260929233000_registros_ponto_regularizacoes.sql
-- DOMÍNIO: RH / CLT - REGULARIZAÇÃO CONTROLADA DE MARCAÇÕES (FIX CP04.8)
-- OBJETIVO: Permitir que RH/Admin regularize marcações factuais incompletas
--           ou inválidas sem apagar ou sobrescrever a evidência original do RHiD.
--
-- PRINCÍPIO: BATIDA ORIGINAL IMPORTADA ≠ BATIDA REGULARIZADA PELO RH.
-- ==============================================================================

-- 1. Criação da Tabela public.registros_ponto_regularizacoes
CREATE TABLE IF NOT EXISTS public.registros_ponto_regularizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    registro_ponto_id UUID NOT NULL REFERENCES public.registros_ponto(id) ON DELETE CASCADE,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    campo_alterado TEXT NOT NULL,
    valor_original TEXT NULL,
    valor_regularizado TEXT NOT NULL,
    justificativa TEXT NOT NULL,
    executado_por UUID NOT NULL REFERENCES auth.users(id),
    executado_por_nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    substituido_por UUID REFERENCES public.registros_ponto_regularizacoes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints de Integridade
    CONSTRAINT chk_ponto_reg_campo CHECK (campo_alterado IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')),
    CONSTRAINT chk_ponto_reg_valor_format CHECK (valor_regularizado ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT chk_ponto_reg_justificativa CHECK (char_length(trim(justificativa)) >= 5)
);

COMMENT ON TABLE public.registros_ponto_regularizacoes IS
'Registros de intervenção controlada e auditável de regularização de batidas de ponto pelo RH/Admin. Preserva o valor original importado.';

-- 2. Índices de Busca e Performance
CREATE INDEX IF NOT EXISTS idx_ponto_regularizacoes_registro 
  ON public.registros_ponto_regularizacoes(registro_ponto_id, ativo);

CREATE INDEX IF NOT EXISTS idx_ponto_regularizacoes_colaborador_data 
  ON public.registros_ponto_regularizacoes(colaborador_id, data);

CREATE INDEX IF NOT EXISTS idx_ponto_regularizacoes_tenant 
  ON public.registros_ponto_regularizacoes(tenant_id);

-- 3. Índice Único Parcial: Apenas UMA regularização ATIVA por campo por registro de ponto
CREATE UNIQUE INDEX IF NOT EXISTS idx_ponto_regularizacao_ativa_unica 
  ON public.registros_ponto_regularizacoes (registro_ponto_id, campo_alterado) 
  WHERE ativo = true;

-- 4. Trigger de Consistência Cross-Tenant (registros_ponto_regularizacoes x registros_ponto x colaboradores)
CREATE OR REPLACE FUNCTION public.trg_validate_ponto_regularizacao_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_ponto_tenant UUID;
  v_colab_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_ponto_tenant
  FROM public.registros_ponto
  WHERE id = NEW.registro_ponto_id;

  IF v_ponto_tenant IS NOT NULL AND v_ponto_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'registro_ponto_id % pertence ao tenant %, incompatível com a regularização (tenant %)',
      NEW.registro_ponto_id, v_ponto_tenant, NEW.tenant_id;
  END IF;

  SELECT tenant_id INTO v_colab_tenant
  FROM public.colaboradores
  WHERE id = NEW.colaborador_id;

  IF v_colab_tenant IS NOT NULL AND v_colab_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'colaborador_id % pertence ao tenant %, incompatível com a regularização (tenant %)',
      NEW.colaborador_id, v_colab_tenant, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_ponto_regularizacao_tenant ON public.registros_ponto_regularizacoes;
CREATE TRIGGER trg_check_ponto_regularizacao_tenant
  BEFORE INSERT OR UPDATE OF registro_ponto_id, colaborador_id, tenant_id ON public.registros_ponto_regularizacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_ponto_regularizacao_tenant();

-- 5. Trigger de Auto-preenchimento de tenant_id
DROP TRIGGER IF EXISTS trg_auto_tenant_ponto_regularizacoes ON public.registros_ponto_regularizacoes;
CREATE TRIGGER trg_auto_tenant_ponto_regularizacoes
  BEFORE INSERT ON public.registros_ponto_regularizacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

-- 6. RLS (Row Level Security)
ALTER TABLE public.registros_ponto_regularizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ponto_regularizacoes_tenant_all" ON public.registros_ponto_regularizacoes;
CREATE POLICY "ponto_regularizacoes_tenant_all" ON public.registros_ponto_regularizacoes
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ==============================================================================
-- GARANTIAS DA MIGRATION:
-- 1. Nenhuma batida original de registros_ponto é alterada ou sobrescrita.
-- 2. Tabela nasce vazia (0 registros).
-- 3. Suporta substituição com histórico (ativo = false para antigas).
-- ==============================================================================
