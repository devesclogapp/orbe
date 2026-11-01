-- ==============================================================================
-- MIGRATION: 20260930203000_registros_ponto_decisoes.sql
-- DOMÍNIO: RH / CLT - CAMADA AUDITÁVEL DE DECISÃO RH DO PONTO (FIX CP06.6-A)
-- OBJETIVO: Permitir que Admin/RH registre decisões formais de governança sobre
--           pontos retidos (falta pendente de justificativa ou trabalho em DSR)
--           como um overlay auditável, sem sobrescrever o ponto factual bruto.
--
-- PRINCÍPIO: DECISÃO RH = OVERLAY DE GOVERNANÇA ≠ SOBRESCRITA DO DADO FACTUAL.
-- ==============================================================================

-- 1. Criação da Tabela public.registros_ponto_decisoes
CREATE TABLE IF NOT EXISTS public.registros_ponto_decisoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    registro_ponto_id UUID NOT NULL REFERENCES public.registros_ponto(id) ON DELETE CASCADE,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    tipo_decisao TEXT NOT NULL,
    justificativa TEXT NOT NULL,
    executado_por UUID NOT NULL REFERENCES auth.users(id),
    executado_por_nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    substituido_por UUID REFERENCES public.registros_ponto_decisoes(id) ON DELETE SET NULL,
    revogado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revogado_em TIMESTAMPTZ,
    motivo_revogacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints de Integridade
    CONSTRAINT chk_ponto_decisao_tipo CHECK (tipo_decisao IN (
        'FALTA_INJUSTIFICADA_CONFIRMADA',
        'FALTA_JUSTIFICADA_ABONADA',
        'DSR_DIRECIONADO_BANCO_HORAS',
        'DSR_DIRECIONADO_HORA_EXTRA'
    )),
    CONSTRAINT chk_ponto_decisao_justificativa CHECK (char_length(trim(justificativa)) >= 5)
);

COMMENT ON TABLE public.registros_ponto_decisoes IS
'Decisões auditáveis do RH sobre inconsistências de pontos bloqueados (abono de falta, confirmação de falta, direcionamento de DSR). Funciona como overlay de governança sem sobrescrever dados factuais.';

-- 2. Índices de Busca e Performance
CREATE INDEX IF NOT EXISTS idx_ponto_decisoes_registro 
  ON public.registros_ponto_decisoes(registro_ponto_id, ativo);

CREATE INDEX IF NOT EXISTS idx_ponto_decisoes_colaborador_data 
  ON public.registros_ponto_decisoes(colaborador_id, data);

CREATE INDEX IF NOT EXISTS idx_ponto_decisoes_tenant 
  ON public.registros_ponto_decisoes(tenant_id);

-- 3. Índice Único Parcial: Apenas UMA decisão ATIVA por registro de ponto
CREATE UNIQUE INDEX IF NOT EXISTS idx_ponto_decisao_ativa_unica 
  ON public.registros_ponto_decisoes (registro_ponto_id) 
  WHERE ativo = true;

-- 4. Trigger de Consistência Cross-Tenant (registros_ponto_decisoes x registros_ponto x colaboradores)
CREATE OR REPLACE FUNCTION public.trg_validate_ponto_decisao_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_ponto_tenant UUID;
  v_colab_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_ponto_tenant
  FROM public.registros_ponto
  WHERE id = NEW.registro_ponto_id;

  IF v_ponto_tenant IS NOT NULL AND v_ponto_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'registro_ponto_id % pertence ao tenant %, incompatível com a decisão (tenant %)',
      NEW.registro_ponto_id, v_ponto_tenant, NEW.tenant_id;
  END IF;

  SELECT tenant_id INTO v_colab_tenant
  FROM public.colaboradores
  WHERE id = NEW.colaborador_id;

  IF v_colab_tenant IS NOT NULL AND v_colab_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'colaborador_id % pertence ao tenant %, incompatível com a decisão (tenant %)',
      NEW.colaborador_id, v_colab_tenant, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_ponto_decisao_tenant ON public.registros_ponto_decisoes;
CREATE TRIGGER trg_check_ponto_decisao_tenant
  BEFORE INSERT OR UPDATE OF registro_ponto_id, colaborador_id, tenant_id ON public.registros_ponto_decisoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_ponto_decisao_tenant();

-- 5. Trigger de Auto-preenchimento de tenant_id
DROP TRIGGER IF EXISTS trg_auto_tenant_ponto_decisoes ON public.registros_ponto_decisoes;
CREATE TRIGGER trg_auto_tenant_ponto_decisoes
  BEFORE INSERT ON public.registros_ponto_decisoes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

-- 6. RLS (Row Level Security)
ALTER TABLE public.registros_ponto_decisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ponto_decisoes_tenant_all" ON public.registros_ponto_decisoes;
CREATE POLICY "ponto_decisoes_tenant_all" ON public.registros_ponto_decisoes
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ==============================================================================
-- GARANTIAS DA MIGRATION:
-- 1. Ponto original e status factual em registros_ponto permanecem intactos.
-- 2. Tabela nasce vazia (0 registros).
-- 3. Suporta substituição com histórico (ativo = false para antigas) e revogação.
-- ==============================================================================
