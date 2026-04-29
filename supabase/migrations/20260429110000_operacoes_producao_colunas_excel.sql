-- Adição das novas colunas financeiras e operacionais para mapeamento exato da Planilha
-- Essa migration não quebra compatibilidade, apenas extende a tabela operacoes_producao.

ALTER TABLE public.operacoes_producao
  ADD COLUMN IF NOT EXISTS nf_numero TEXT,
  ADD COLUMN IF NOT EXISTS ctrc TEXT,
  ADD COLUMN IF NOT EXISTS percentual_iss NUMERIC(5, 4) CHECK (percentual_iss >= 0 AND percentual_iss <= 1),
  ADD COLUMN IF NOT EXISTS valor_descarga NUMERIC(15, 2) DEFAULT 0 CHECK (valor_descarga >= 0),
  ADD COLUMN IF NOT EXISTS custo_com_iss NUMERIC(15, 2) DEFAULT 0 CHECK (custo_com_iss >= 0),
  ADD COLUMN IF NOT EXISTS valor_unitario_filme NUMERIC(15, 4) DEFAULT 0 CHECK (valor_unitario_filme >= 0),
  ADD COLUMN IF NOT EXISTS quantidade_filme NUMERIC(15, 2) DEFAULT 0 CHECK (quantidade_filme >= 0),
  ADD COLUMN IF NOT EXISTS valor_total_filme NUMERIC(15, 2) DEFAULT 0 CHECK (valor_total_filme >= 0),
  ADD COLUMN IF NOT EXISTS valor_faturamento_nf NUMERIC(15, 2) DEFAULT 0 CHECK (valor_faturamento_nf >= 0);

-- Comentários para identificação de contexto
COMMENT ON COLUMN public.operacoes_producao.percentual_iss IS 'Fração decimal (Ex: 0.05 para 5%)';
COMMENT ON COLUMN public.operacoes_producao.valor_descarga IS 'Valor nominal de descarga antes dos impostos e adições de filme';
COMMENT ON COLUMN public.operacoes_producao.custo_com_iss IS 'Desconto ou Custo com base na alíquota do ISS';
COMMENT ON COLUMN public.operacoes_producao.valor_faturamento_nf IS 'Valor líquido do faturamento associado à NF/operação';
