-- ============================================================================
-- MIGRATION: 20260930160000_banco_horas_regras_escopo_compartilhado.sql
-- DOMÍNIO: RH / BANCO DE HORAS — MOTOR OPERACIONAL
-- CHECKPOINT: CP05.4 — ESCOPO GERAL, COMPARTILHADO E ESPECÍFICO
-- FINALIDADE: Adicionar coluna 'escopo' a banco_horas_regras e criar a tabela
--             associativa normalizada banco_horas_regras_empresas para suportar
--             regras compartilhadas entre múltiplas empresas sem duplicação de políticas.
-- ============================================================================

-- 1. Adicionar coluna 'escopo' na tabela banco_horas_regras
ALTER TABLE public.banco_horas_regras
  ADD COLUMN IF NOT EXISTS escopo VARCHAR(20) NOT NULL DEFAULT 'ESPECIFICA';

-- Constraint de valores válidos de escopo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_bh_regras_escopo'
  ) THEN
    ALTER TABLE public.banco_horas_regras
      ADD CONSTRAINT chk_bh_regras_escopo
      CHECK (escopo IN ('TODAS_EMPRESAS', 'COMPARTILHADA', 'ESPECIFICA'));
  END IF;
END $$;

COMMENT ON COLUMN public.banco_horas_regras.escopo IS
  'Escopo de aplicação da política: TODAS_EMPRESAS (Geral do tenant), COMPARTILHADA (2+ empresas selecionadas), ESPECIFICA (1 única empresa)';

-- Atualizar regras legadas se houver: se empresa_id for nulo, define como TODAS_EMPRESAS; senão ESPECIFICA
UPDATE public.banco_horas_regras
SET escopo = 'TODAS_EMPRESAS'
WHERE empresa_id IS NULL AND escopo = 'ESPECIFICA';

-- 2. Criar a tabela associativa normalizada banco_horas_regras_empresas
CREATE TABLE IF NOT EXISTS public.banco_horas_regras_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  regra_id UUID NOT NULL REFERENCES public.banco_horas_regras(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_banco_horas_regras_empresas UNIQUE (regra_id, empresa_id)
);

COMMENT ON TABLE public.banco_horas_regras_empresas IS
  'Tabela associativa que vincula políticas de banco de horas (regras compartilhadas ou específicas) a empresas explicitamente selecionadas.';

-- 3. Índices de performance e integridade
CREATE INDEX IF NOT EXISTS idx_bh_regras_empresas_tenant
  ON public.banco_horas_regras_empresas(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bh_regras_empresas_lookup
  ON public.banco_horas_regras_empresas(empresa_id, regra_id);

CREATE INDEX IF NOT EXISTS idx_bh_regras_escopo_lookup
  ON public.banco_horas_regras(tenant_id, escopo, vigencia_inicio, vigencia_fim);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.banco_horas_regras_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bh_regras_empresas_tenant_all" ON public.banco_horas_regras_empresas;
CREATE POLICY "bh_regras_empresas_tenant_all" ON public.banco_horas_regras_empresas
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. Trigger de auto-atribuição de tenant_id
DROP TRIGGER IF EXISTS trg_auto_tenant_bh_regras_empresas ON public.banco_horas_regras_empresas;
CREATE TRIGGER trg_auto_tenant_bh_regras_empresas
  BEFORE INSERT ON public.banco_horas_regras_empresas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- 6. Trigger de proteção cross-tenant (Hardening)
CREATE OR REPLACE FUNCTION public.check_bh_regras_empresas_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar se regra pertence ao mesmo tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.banco_horas_regras r
    WHERE r.id = NEW.regra_id AND r.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Cross-tenant violation: regra_id não pertence ao mesmo tenant da associação.';
  END IF;

  -- Validar se empresa pertence ao mesmo tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = NEW.empresa_id AND e.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Cross-tenant violation: empresa_id não pertence ao mesmo tenant da associação.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_bh_regras_empresas_tenant ON public.banco_horas_regras_empresas;
CREATE TRIGGER trg_check_bh_regras_empresas_tenant
  BEFORE INSERT OR UPDATE ON public.banco_horas_regras_empresas
  FOR EACH ROW EXECUTE FUNCTION public.check_bh_regras_empresas_tenant();
