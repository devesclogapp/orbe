-- Migração para atualização das Regras de Serviços Específicos
-- Alinhamento conceitual conforme solicitação: Período + C + Quantidade de colaboradores

-- 1. ADICIONAR COLUNAS DE CONFIGURAÇÃO DE PERÍODO NA TABELA DE REGRAS
ALTER TABLE public.servicos_especificos_regras 
ADD COLUMN IF NOT EXISTS tipo_periodo text DEFAULT 'DIURNO' CHECK (tipo_periodo IN ('DIURNO', 'NOTURNO')),
ADD COLUMN IF NOT EXISTS peso_multiplicador numeric NOT NULL DEFAULT 1.00;

-- 2. AJUSTAR A TABELA DE LANÇAMENTOS PARA GUARDAR O CÓDIGO GERADO E A QUANTIDADE DE COLABORADORES REAL
ALTER TABLE public.servicos_especificos_lancamentos
ADD COLUMN IF NOT EXISTS codigo_operacional text,
ADD COLUMN IF NOT EXISTS quantidade_colaboradores integer NOT NULL DEFAULT 1;

-- 3. ATUALIZAR COMENTÁRIOS
COMMENT ON COLUMN public.servicos_especificos_regras.codigo IS 'Código do período (ex: D1, N1)';
COMMENT ON COLUMN public.servicos_especificos_regras.peso_multiplicador IS 'Multiplicador de cálculo conforme o período';
COMMENT ON COLUMN public.servicos_especificos_lancamentos.codigo_operacional IS 'Código gerado automaticamente no lançamento (ex: N1C5)';
COMMENT ON COLUMN public.servicos_especificos_lancamentos.quantidade_colaboradores IS 'Número de colaboradores envolvidos neste lançamento';

-- 4. EXEMPLOS DE INSERT (PARA CADA TENANT)
-- INSERT INTO public.servicos_especificos_regras (codigo, descricao, tipo_periodo, peso_multiplicador, tenant_id)
-- VALUES 
-- ('D1', 'Primeiro período diurno', 'DIURNO', 1.00, 'UUID_DO_TENANT'),
-- ('D2', 'Segundo período diurno', 'DIURNO', 1.00, 'UUID_DO_TENANT'),
-- ('N1', 'Primeiro período noturno', 'NOTURNO', 1.25, 'UUID_DO_TENANT'),
-- ('N2', 'Segundo período noturno', 'NOTURNO', 1.50, 'UUID_DO_TENANT');
