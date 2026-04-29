-- Produção In-Loco — modelo operacional do Encarregado
-- Esta migration cria os cadastros mínimos, as regras de valor por fornecedor/serviço
-- e a tabela de lançamentos operacionais preparada para evolução da tela /producao.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CADASTROS OPERACIONAIS

CREATE TABLE IF NOT EXISTS public.unidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT,
  cidade TEXT,
  estado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unidades_empresa_nome_unique UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.tipos_servico_operacional (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transportadoras_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  tipo_cadastro TEXT NOT NULL DEFAULT 'transportadora_cliente'
    CHECK (tipo_cadastro IN ('transportadora', 'cliente', 'transportadora_cliente')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transportadoras_clientes_empresa_nome_unique UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_empresa_nome_unique UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.produtos_carga (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produtos_carga_fornecedor_nome_unique UNIQUE (fornecedor_id, nome)
);

CREATE TABLE IF NOT EXISTS public.formas_pagamento_operacional (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fornecedor_valores_servico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  tipo_servico_id UUID NOT NULL REFERENCES public.tipos_servico_operacional(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
  transportadora_id UUID REFERENCES public.transportadoras_clientes(id) ON DELETE SET NULL,
  produto_carga_id UUID REFERENCES public.produtos_carga(id) ON DELETE SET NULL,
  valor_unitario NUMERIC(15, 4) NOT NULL CHECK (valor_unitario >= 0),
  tipo_calculo TEXT NOT NULL CHECK (tipo_calculo IN ('volume', 'fixo', 'colaborador')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  vigencia_inicio DATE NOT NULL DEFAULT current_date,
  vigencia_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fornecedor_valores_servico_vigencia_check
    CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedor_valores_servico_regra_ativa_unique
  ON public.fornecedor_valores_servico (
    fornecedor_id,
    tipo_servico_id,
    empresa_id,
    COALESCE(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(transportadora_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(produto_carga_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vigencia_inicio
  );

-- 2. LANÇAMENTOS OPERACIONAIS

CREATE TABLE IF NOT EXISTS public.operacoes_producao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  data_operacao DATE NOT NULL DEFAULT current_date,
  tipo_servico_id UUID NOT NULL REFERENCES public.tipos_servico_operacional(id) ON DELETE RESTRICT,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  entrada_ponto TIME,
  saida_ponto TIME,
  transportadora_id UUID NOT NULL REFERENCES public.transportadoras_clientes(id) ON DELETE RESTRICT,
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  produto_carga_id UUID REFERENCES public.produtos_carga(id) ON DELETE SET NULL,
  quantidade NUMERIC(15, 2) NOT NULL CHECK (quantidade > 0),
  valor_unitario_snapshot NUMERIC(15, 4) NOT NULL CHECK (valor_unitario_snapshot >= 0),
  tipo_calculo_snapshot TEXT NOT NULL CHECK (tipo_calculo_snapshot IN ('volume', 'fixo', 'colaborador')),
  valor_total NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  forma_pagamento_id UUID REFERENCES public.formas_pagamento_operacional(id) ON DELETE SET NULL,
  placa TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('processado', 'pendente', 'com_alerta', 'aguardando_validacao', 'bloqueado', 'fechado')),
  avaliacao_json JSONB,
  criado_por UUID DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  justificativa_retroativa TEXT,
  origem_dado TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem_dado IN ('manual', 'api_ponto', 'importacao', 'ajuste')),
  CONSTRAINT operacoes_producao_ponto_check
    CHECK (entrada_ponto IS NULL OR saida_ponto IS NULL OR saida_ponto >= entrada_ponto)
);

CREATE INDEX IF NOT EXISTS idx_operacoes_producao_empresa_unidade_data
  ON public.operacoes_producao (empresa_id, unidade_id, data_operacao);

CREATE INDEX IF NOT EXISTS idx_operacoes_producao_colaborador_data
  ON public.operacoes_producao (colaborador_id, data_operacao);

CREATE INDEX IF NOT EXISTS idx_operacoes_producao_status_data
  ON public.operacoes_producao (status, data_operacao);

CREATE INDEX IF NOT EXISTS idx_fornecedor_valores_servico_lookup
  ON public.fornecedor_valores_servico (empresa_id, fornecedor_id, tipo_servico_id, ativo, vigencia_inicio, vigencia_fim);

-- 3. FUNÇÕES

CREATE OR REPLACE FUNCTION public.resolver_valor_operacao(
  p_empresa_id UUID,
  p_unidade_id UUID,
  p_tipo_servico_id UUID,
  p_fornecedor_id UUID,
  p_transportadora_id UUID DEFAULT NULL,
  p_produto_carga_id UUID DEFAULT NULL,
  p_data_operacao DATE DEFAULT current_date
)
RETURNS TABLE (
  regra_id UUID,
  valor_unitario NUMERIC,
  tipo_calculo TEXT,
  regra_encontrada BOOLEAN,
  mensagem_bloqueio TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH regra_match AS (
    SELECT
      fvs.id,
      fvs.valor_unitario,
      fvs.tipo_calculo
    FROM public.fornecedor_valores_servico fvs
    WHERE fvs.empresa_id = p_empresa_id
      AND fvs.fornecedor_id = p_fornecedor_id
      AND fvs.tipo_servico_id = p_tipo_servico_id
      AND fvs.ativo = true
      AND (fvs.unidade_id IS NULL OR fvs.unidade_id = p_unidade_id)
      AND (fvs.transportadora_id IS NULL OR fvs.transportadora_id = p_transportadora_id)
      AND (fvs.produto_carga_id IS NULL OR fvs.produto_carga_id = p_produto_carga_id)
      AND fvs.vigencia_inicio <= COALESCE(p_data_operacao, current_date)
      AND (fvs.vigencia_fim IS NULL OR fvs.vigencia_fim >= COALESCE(p_data_operacao, current_date))
    ORDER BY
      CASE WHEN fvs.unidade_id IS NULL THEN 1 ELSE 0 END,
      CASE WHEN fvs.transportadora_id IS NULL THEN 1 ELSE 0 END,
      CASE WHEN fvs.produto_carga_id IS NULL THEN 1 ELSE 0 END,
      fvs.vigencia_inicio DESC,
      fvs.created_at DESC
    LIMIT 1
  )
  SELECT
    rm.id AS regra_id,
    rm.valor_unitario,
    rm.tipo_calculo,
    (rm.id IS NOT NULL) AS regra_encontrada,
    CASE
      WHEN rm.id IS NULL THEN 'Este fornecedor ainda não possui valor unitário configurado. Solicite cadastro ao Admin ou Financeiro.'
      ELSE NULL
    END AS mensagem_bloqueio
  FROM regra_match rm
  UNION ALL
  SELECT
    NULL::UUID,
    NULL::NUMERIC,
    NULL::TEXT,
    false,
    'Este fornecedor ainda não possui valor unitário configurado. Solicite cadastro ao Admin ou Financeiro.'
  WHERE NOT EXISTS (SELECT 1 FROM regra_match);
$$;

CREATE OR REPLACE FUNCTION public.calcular_valor_total_operacao_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.valor_total :=
    CASE
      WHEN NEW.tipo_calculo_snapshot = 'fixo' THEN COALESCE(NEW.valor_unitario_snapshot, 0)
      ELSE COALESCE(NEW.quantidade, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
    END;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.vw_operacoes_producao_resumo_dia AS
SELECT
  op.empresa_id,
  op.unidade_id,
  op.data_operacao,
  COUNT(*) AS total_lancamentos,
  COUNT(DISTINCT op.colaborador_id) AS total_colaboradores,
  COALESCE(SUM(op.quantidade), 0) AS total_quantidade,
  COALESCE(SUM(op.valor_total), 0) AS valor_total_produzido,
  COUNT(*) FILTER (WHERE op.status IN ('pendente', 'aguardando_validacao')) AS pendencias,
  COUNT(*) FILTER (WHERE op.status = 'com_alerta') AS alertas
FROM public.operacoes_producao op
GROUP BY op.empresa_id, op.unidade_id, op.data_operacao;

-- 4. TRIGGERS

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_unidades_updated_at') THEN
      CREATE TRIGGER update_unidades_updated_at
      BEFORE UPDATE ON public.unidades
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tipos_servico_operacional_updated_at') THEN
      CREATE TRIGGER update_tipos_servico_operacional_updated_at
      BEFORE UPDATE ON public.tipos_servico_operacional
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transportadoras_clientes_updated_at') THEN
      CREATE TRIGGER update_transportadoras_clientes_updated_at
      BEFORE UPDATE ON public.transportadoras_clientes
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fornecedores_updated_at') THEN
      CREATE TRIGGER update_fornecedores_updated_at
      BEFORE UPDATE ON public.fornecedores
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_produtos_carga_updated_at') THEN
      CREATE TRIGGER update_produtos_carga_updated_at
      BEFORE UPDATE ON public.produtos_carga
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_formas_pagamento_operacional_updated_at') THEN
      CREATE TRIGGER update_formas_pagamento_operacional_updated_at
      BEFORE UPDATE ON public.formas_pagamento_operacional
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fornecedor_valores_servico_updated_at') THEN
      CREATE TRIGGER update_fornecedor_valores_servico_updated_at
      BEFORE UPDATE ON public.fornecedor_valores_servico
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_calcular_valor_total_operacao_producao ON public.operacoes_producao;
CREATE TRIGGER trg_calcular_valor_total_operacao_producao
BEFORE INSERT OR UPDATE OF quantidade, valor_unitario_snapshot, tipo_calculo_snapshot
ON public.operacoes_producao
FOR EACH ROW
EXECUTE FUNCTION public.calcular_valor_total_operacao_producao();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'validate_admin_override'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fatal_admin_override_check_operacoes_producao') THEN
      CREATE TRIGGER fatal_admin_override_check_operacoes_producao
      BEFORE UPDATE ON public.operacoes_producao
      FOR EACH ROW EXECUTE FUNCTION public.validate_admin_override();
    END IF;
  END IF;
END $$;

-- 5. RLS

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_servico_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportadoras_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedor_valores_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso leitura autenticado unidades"
  ON public.unidades FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado tipos_servico_operacional"
  ON public.tipos_servico_operacional FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado transportadoras_clientes"
  ON public.transportadoras_clientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado fornecedores"
  ON public.fornecedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado produtos_carga"
  ON public.produtos_carga FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado formas_pagamento_operacional"
  ON public.formas_pagamento_operacional FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado fornecedor_valores_servico"
  ON public.fornecedor_valores_servico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso leitura autenticado operacoes_producao"
  ON public.operacoes_producao FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso insert autenticado operacoes_producao"
  ON public.operacoes_producao FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Acesso update autenticado operacoes_producao"
  ON public.operacoes_producao
  FOR UPDATE TO authenticated
  USING (status NOT IN ('fechado'))
  WITH CHECK (status NOT IN ('fechado'));

-- 6. SEEDS BÁSICOS

INSERT INTO public.tipos_servico_operacional (nome, descricao)
VALUES
  ('Descarga', 'Operação de descarga com cálculo por volume, operação fixa ou colaborador.'),
  ('Carga', 'Operação de carga com vínculo a cliente/transportadora.'),
  ('Transbordo', 'Operação de transbordo entre veículos ou pátios.'),
  ('Movimentação', 'Movimentação interna de mercadoria ou equipamento.'),
  ('Separação', 'Separação de itens e preparação operacional.'),
  ('Apoio operacional', 'Apoio de pátio, doca ou operação fixa.')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.formas_pagamento_operacional (nome, descricao)
VALUES
  ('Produção', 'Pagamento por produção operacional.'),
  ('Diária', 'Pagamento por diária operacional.'),
  ('Operação fixa', 'Pagamento fixo por operação.'),
  ('Ajuste interno', 'Uso interno para correções ou ajustes aprovados.')
ON CONFLICT (nome) DO NOTHING;
