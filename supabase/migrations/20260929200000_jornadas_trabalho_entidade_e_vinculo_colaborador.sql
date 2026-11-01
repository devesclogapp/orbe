-- ==============================================================================
-- MIGRATION: 20260929200000_jornadas_trabalho_entidade_e_vinculo_colaborador.sql
-- DOMÍNIO: RH / CLT - ARQUITETURA DE JORNADA E ESCALA (FIX 04.2-A)
-- OBJETIVO: Criar a entidade jornadas_trabalho desacoplada de banco_horas_regras,
--           definir grade semanal atômica com validação estrutural e adicionar
--           vínculo opcional em colaboradores (sem preenchimento em dados legados).
-- ==============================================================================

-- 1. Função de Validação Estrutural da Grade Semanal (JSONB)
CREATE OR REPLACE FUNCTION public.validate_grade_semanal(p_grade jsonb)
RETURNS boolean AS $$
DECLARE
  v_dias text[] := ARRAY['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  v_dia text;
  v_dia_obj jsonb;
  v_minutos integer;
  v_trabalhavel boolean;
  v_tipo text;
BEGIN
  IF p_grade IS NULL OR jsonb_typeof(p_grade) <> 'object' THEN
    RETURN false;
  END IF;

  FOREACH v_dia IN ARRAY v_dias LOOP
    IF NOT (p_grade ? v_dia) THEN
      RETURN false; -- Dia obrigatório ausente
    END IF;

    v_dia_obj := p_grade -> v_dia;
    IF jsonb_typeof(v_dia_obj) <> 'object' THEN
      RETURN false;
    END IF;

    IF NOT (v_dia_obj ? 'trabalhavel') OR NOT (v_dia_obj ? 'minutos_previstos') THEN
      RETURN false;
    END IF;

    v_trabalhavel := (v_dia_obj ->> 'trabalhavel')::boolean;
    v_minutos := (v_dia_obj ->> 'minutos_previstos')::integer;
    v_tipo := COALESCE(v_dia_obj ->> 'tipo', '');

    -- Minutos não podem ser negativos
    IF v_minutos < 0 THEN
      RETURN false;
    END IF;

    -- Dia não trabalhável não pode ter minutos positivos
    IF NOT v_trabalhavel AND v_minutos > 0 THEN
      RETURN false;
    END IF;

    -- Tipos permitidos
    IF v_tipo NOT IN ('TRABALHO', 'FOLGA', 'DSR', 'COMPENSADO', '') THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.validate_grade_semanal IS 
'Valida se o JSONB da grade semanal possui os 7 dias, minutos não-negativos e consistência de dias não-trabalháveis.';

-- 2. Criação da Tabela public.jornadas_trabalho
CREATE TABLE IF NOT EXISTS public.jornadas_trabalho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL = Jornada Padrão Global do Tenant
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo_escala TEXT NOT NULL DEFAULT 'SEMANAL',
    carga_semanal_minutos INTEGER NOT NULL,
    grade_semanal JSONB NOT NULL,
    politica_feriado TEXT NOT NULL DEFAULT 'FOLGA_DSR',
    vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    vigencia_fim DATE,
    padrao BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints de Integridade
    CONSTRAINT chk_jornadas_tipo_escala CHECK (tipo_escala IN ('SEMANAL', '5X2', '6X1', '12X36')),
    CONSTRAINT chk_jornadas_status CHECK (status IN ('ativo', 'inativo')),
    CONSTRAINT chk_jornadas_politica_feriado CHECK (politica_feriado IN ('FOLGA_DSR', 'TRABALHA_NORMAL', 'TRABALHA_EXTRA')),
    CONSTRAINT chk_jornadas_carga_positiva CHECK (carga_semanal_minutos >= 0),
    CONSTRAINT chk_jornadas_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
    CONSTRAINT chk_jornadas_grade_valida CHECK (public.validate_grade_semanal(grade_semanal))
);

COMMENT ON TABLE public.jornadas_trabalho IS 
'Entidade de Jornada e Escala de Trabalho do ORBE (desacoplada de banco_horas_regras). Define dias trabalháveis e minutos previstos.';

-- 3. Índices de Busca e Performance
CREATE INDEX IF NOT EXISTS idx_jornadas_tenant_empresa_status 
  ON public.jornadas_trabalho(tenant_id, empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_jornadas_vigencia 
  ON public.jornadas_trabalho(vigencia_inicio, vigencia_fim);

CREATE INDEX IF NOT EXISTS idx_jornadas_status 
  ON public.jornadas_trabalho(status);

-- 4. Índices Únicos Parciais: Apenas UMA jornada padrão ATIVA por contexto
-- 4.1 Apenas uma padrão ativa por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_jornadas_padrao_empresa_unica 
  ON public.jornadas_trabalho (tenant_id, empresa_id) 
  WHERE padrao = true AND status = 'ativo' AND empresa_id IS NOT NULL;

-- 4.2 Apenas uma padrão ativa global do tenant (empresa_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jornadas_padrao_global_unica 
  ON public.jornadas_trabalho (tenant_id) 
  WHERE padrao = true AND status = 'ativo' AND empresa_id IS NULL;

-- 5. Trigger de Consistência Cross-Tenant (jornadas_trabalho x empresas)
CREATE OR REPLACE FUNCTION public.trg_validate_jornada_empresa_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_tenant UUID;
BEGIN
  IF NEW.empresa_id IS NOT NULL THEN
    SELECT tenant_id INTO v_empresa_tenant
    FROM public.empresas
    WHERE id = NEW.empresa_id;

    IF v_empresa_tenant IS NOT NULL AND v_empresa_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'empresa_id % pertence ao tenant %, incompatível com a jornada (tenant %)',
        NEW.empresa_id, v_empresa_tenant, NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_jornada_empresa_tenant ON public.jornadas_trabalho;
CREATE TRIGGER trg_check_jornada_empresa_tenant
  BEFORE INSERT OR UPDATE OF empresa_id, tenant_id ON public.jornadas_trabalho
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_jornada_empresa_tenant();

-- 6. Trigger de Auto-preenchimento de tenant_id (Padrão canônico do ORBE)
DROP TRIGGER IF EXISTS trg_auto_tenant_jornadas_trabalho ON public.jornadas_trabalho;
CREATE TRIGGER trg_auto_tenant_jornadas_trabalho
  BEFORE INSERT ON public.jornadas_trabalho
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

-- 7. RLS (Row Level Security) - Padrão Canônico do ORBE (current_tenant_id)
ALTER TABLE public.jornadas_trabalho ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jornadas_trabalho_tenant_all" ON public.jornadas_trabalho;
CREATE POLICY "jornadas_trabalho_tenant_all" ON public.jornadas_trabalho
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 8. Vínculo na Tabela public.colaboradores (Opcional, com FK e ON DELETE SET NULL)
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES public.jornadas_trabalho(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.colaboradores.jornada_id IS 
'Vínculo opcional com jornada de trabalho específica do colaborador. Se nulo, herda a jornada padrão da empresa.';

CREATE INDEX IF NOT EXISTS idx_colaboradores_jornada_id 
  ON public.colaboradores(tenant_id, jornada_id);

-- 9. Trigger de Consistência Cross-Tenant (colaboradores x jornadas_trabalho)
CREATE OR REPLACE FUNCTION public.trg_validate_colaborador_jornada_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_jornada_tenant UUID;
BEGIN
  IF NEW.jornada_id IS NOT NULL THEN
    SELECT tenant_id INTO v_jornada_tenant
    FROM public.jornadas_trabalho
    WHERE id = NEW.jornada_id;

    IF v_jornada_tenant IS NOT NULL AND v_jornada_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'jornada_id % pertence ao tenant %, incompatível com o colaborador (tenant %)',
        NEW.jornada_id, v_jornada_tenant, NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_colaborador_jornada_tenant ON public.colaboradores;
CREATE TRIGGER trg_check_colaborador_jornada_tenant
  BEFORE INSERT OR UPDATE OF jornada_id, tenant_id ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_colaborador_jornada_tenant();

-- ==============================================================================
-- GARANTIAS DA MIGRATION:
-- 1. Nenhuma jornada real é cadastrada automaticamente (tabela nasce com 0 linhas).
-- 2. Nenhum colaborador existente tem jornada_id preenchido (permanece NULL).
-- 3. Nenhum ponto, cálculo ou saldo é modificado.
-- ==============================================================================
