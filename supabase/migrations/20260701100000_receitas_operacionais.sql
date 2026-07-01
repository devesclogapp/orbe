-- 20260701100000_receitas_operacionais.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.receitas_operacionais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
    modalidade VARCHAR(50) NOT NULL CHECK (modalidade IN ('CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL')),
    competencia VARCHAR(7),
    vencimento DATE,
    data_recebimento DATE,
    valor_total NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aguardando_faturamento', 'faturado', 'pago', 'cancelado')),
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.receitas_operacionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso leitura receitas_operacionais" ON public.receitas_operacionais;
CREATE POLICY "Acesso leitura receitas_operacionais"
  ON public.receitas_operacionais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Acesso insert receitas_operacionais" ON public.receitas_operacionais;
CREATE POLICY "Acesso insert receitas_operacionais"
  ON public.receitas_operacionais FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Acesso update receitas_operacionais" ON public.receitas_operacionais;
CREATE POLICY "Acesso update receitas_operacionais"
  ON public.receitas_operacionais FOR UPDATE TO authenticated USING (true);

-- Itens
CREATE TABLE IF NOT EXISTS public.receitas_operacionais_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receita_id UUID NOT NULL REFERENCES public.receitas_operacionais(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    operacao_id UUID REFERENCES public.operacoes_producao(id) ON DELETE SET NULL,
    servico_extra_id UUID, 
    valor_item NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.receitas_operacionais_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso leitura receitas_operacionais_itens" ON public.receitas_operacionais_itens;
CREATE POLICY "Acesso leitura receitas_operacionais_itens"
  ON public.receitas_operacionais_itens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Acesso insert receitas_operacionais_itens" ON public.receitas_operacionais_itens;
CREATE POLICY "Acesso insert receitas_operacionais_itens"
  ON public.receitas_operacionais_itens FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Acesso update receitas_operacionais_itens" ON public.receitas_operacionais_itens;
CREATE POLICY "Acesso update receitas_operacionais_itens"
  ON public.receitas_operacionais_itens FOR UPDATE TO authenticated USING (true);

-- Triggers for updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_receitas_operacionais_updated_at') THEN
      CREATE TRIGGER update_receitas_operacionais_updated_at
      BEFORE UPDATE ON public.receitas_operacionais
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
  END IF;
END $$;

-- Historico
CREATE TABLE IF NOT EXISTS public.receitas_operacionais_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receita_id UUID NOT NULL REFERENCES public.receitas_operacionais(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    usuario_id UUID,
    acao VARCHAR(255) NOT NULL,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50),
    detalhes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.receitas_operacionais_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso leitura receitas_operacionais_historico" ON public.receitas_operacionais_historico;
CREATE POLICY "Acesso leitura receitas_operacionais_historico"
  ON public.receitas_operacionais_historico FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Acesso insert receitas_operacionais_historico" ON public.receitas_operacionais_historico;
CREATE POLICY "Acesso insert receitas_operacionais_historico"
  ON public.receitas_operacionais_historico FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
