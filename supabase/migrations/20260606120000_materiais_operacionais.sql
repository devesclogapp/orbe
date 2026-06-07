-- 1. Tabela de Cadastro de Materiais Operacionais
CREATE TABLE IF NOT EXISTS public.materiais_operacionais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    unidade_medida TEXT NOT NULL, -- Ex: Rolo, Unidade, KG
    valor_unitario NUMERIC(15, 4) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT materiais_operacionais_tenant_nome_unique UNIQUE (tenant_id, nome)
);

-- 2. Tabela de Vínculo de Materiais com Operações (Snapshot)
CREATE TABLE IF NOT EXISTS public.operacao_producao_materiais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operacao_id UUID NOT NULL REFERENCES public.operacoes_producao(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materiais_operacionais(id) ON DELETE SET NULL,
    nome_snapshot TEXT NOT NULL,
    unidade_snapshot TEXT NOT NULL,
    valor_unitario_snapshot NUMERIC(15, 4) NOT NULL DEFAULT 0,
    quantidade NUMERIC(15, 2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Adicionar coluna de total de materiais na tabela principal de produção
ALTER TABLE public.operacoes_producao 
ADD COLUMN IF NOT EXISTS valor_total_materiais NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- 4. Habilitar RLS
ALTER TABLE public.materiais_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_producao_materiais ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso
CREATE POLICY "Acesso leitura autenticado materiais_operacionais"
    ON public.materiais_operacionais FOR SELECT
    TO authenticated
    USING (tenant_id = (auth.uid_tenant_id()));

CREATE POLICY "Acesso total admin materiais_operacionais"
    ON public.materiais_operacionais
    FOR ALL
    TO authenticated
    USING (tenant_id = (auth.uid_tenant_id()));

CREATE POLICY "Acesso leitura autenticado operacao_producao_materiais"
    ON public.operacao_producao_materiais FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.operacoes_producao op
        WHERE op.id = operacao_producao_materiais.operacao_id
        AND op.tenant_id = (auth.uid_tenant_id())
    ));

CREATE POLICY "Acesso insert autenticado operacao_producao_materiais"
    ON public.operacao_producao_materiais FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.operacoes_producao op
        WHERE op.id = operacao_id
        AND op.tenant_id = (auth.uid_tenant_id())
    ));

-- 6. Trigger para atualizar updated_at
CREATE TRIGGER update_materiais_operacionais_updated_at
BEFORE UPDATE ON public.materiais_operacionais
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Atualizar trigger de cálculo do valor total da operação
-- O valor total da operação deve ser (quantidade * valor_unitario) + valor_total_materiais (se aplicável ao tipo de cálculo)
CREATE OR REPLACE FUNCTION public.calcular_valor_total_operacao_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS supabase/migrations/$migrationName
BEGIN
  -- Cálculo base do serviço/produção
  DECLARE
    v_valor_servico NUMERIC;
  BEGIN
    v_valor_servico := 
      CASE
        WHEN NEW.tipo_calculo_snapshot = 'fixo' THEN COALESCE(NEW.valor_unitario_snapshot, 0)
        ELSE COALESCE(NEW.quantidade, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
      END;

    -- Soma o valor dos materiais
    NEW.valor_total := v_valor_servico + COALESCE(NEW.valor_total_materiais, 0);
  END;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
supabase/migrations/$migrationName;
