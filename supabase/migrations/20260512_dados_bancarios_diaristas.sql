-- Migration: 20260512_dados_bancarios_diaristas
-- Objetivo: Adicionar campos bancários ao cadastro de colaboradores (diaristas)
-- para viabilizar geração de CNAB240 com dados reais dos favorecidos.

-- Adiciona colunas bancárias na tabela colaboradores (IF NOT EXISTS para idempotência)
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS banco_codigo    TEXT,
  ADD COLUMN IF NOT EXISTS agencia         TEXT,
  ADD COLUMN IF NOT EXISTS agencia_digito  TEXT,
  ADD COLUMN IF NOT EXISTS conta           TEXT,
  ADD COLUMN IF NOT EXISTS digito_conta    TEXT,
  ADD COLUMN IF NOT EXISTS tipo_conta      TEXT DEFAULT 'corrente',
  ADD COLUMN IF NOT EXISTS nome_completo   TEXT,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT;

-- Índice para facilitar busca de diaristas com dados bancários completos
CREATE INDEX IF NOT EXISTS idx_colaboradores_banco_codigo
  ON public.colaboradores (empresa_id, banco_codigo)
  WHERE tipo_colaborador = 'DIARISTA' AND deleted_at IS NULL;

-- Comentários descritivos
COMMENT ON COLUMN public.colaboradores.banco_codigo   IS 'Código do banco FEBRABAN (ex: 341=Itaú, 033=Santander)';
COMMENT ON COLUMN public.colaboradores.agencia        IS 'Número da agência (sem dígito)';
COMMENT ON COLUMN public.colaboradores.agencia_digito IS 'Dígito verificador da agência';
COMMENT ON COLUMN public.colaboradores.conta          IS 'Número da conta (sem dígito)';
COMMENT ON COLUMN public.colaboradores.digito_conta   IS 'Dígito verificador da conta';
COMMENT ON COLUMN public.colaboradores.tipo_conta     IS 'corrente ou poupanca';
COMMENT ON COLUMN public.colaboradores.nome_completo  IS 'Nome completo do favorecido como consta na conta bancária';
COMMENT ON COLUMN public.colaboradores.observacoes    IS 'Observações internas sobre o colaborador';
