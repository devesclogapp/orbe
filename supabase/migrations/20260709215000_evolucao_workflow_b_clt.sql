-- y:\2026\ERP ESC LOG\Orbe\supabase\migrations\20260709215000_evolucao_workflow_b_clt.sql

-- 1. Evolução da tabela historico_importacoes
ALTER TABLE public.historico_importacoes
  ADD COLUMN IF NOT EXISTS quantidade_recebida INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_ignorada INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_importada INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS workflow TEXT,
  ADD COLUMN IF NOT EXISTS competencia TEXT,
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

-- Renomeia erro_processamento para erro caso precise? O user pediu 'erro'.
-- Vamos deixar erro_processamento em paz e apenas usa-lo.
-- metadata já foi coberto pelo campo "logs" de 20260528_enhance_historico_importacoes.sql

-- 2. Modificações em registros_ponto para idempotência forte
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS chave_importacao TEXT;

-- Criação do índice único garantindo idempotência real por tenant
CREATE UNIQUE INDEX IF NOT EXISTS uix_registros_ponto_chave_importacao_tenant
  ON public.registros_ponto (tenant_id, chave_importacao)
  WHERE chave_importacao IS NOT NULL;

-- Atualizar comentários para auditoria
COMMENT ON COLUMN public.registros_ponto.chave_importacao IS 'Hash SHA256 único (tenant+empresa+origem+matricula/cpf+data) para garantir idempotência rígida';
COMMENT ON COLUMN public.historico_importacoes.workflow IS 'Identificação do flow que executou (ex: importar-pontos-rhid, importar-pontos-manual)';

-- Recarregar schema postgREST
NOTIFY pgrst, 'reload schema';
