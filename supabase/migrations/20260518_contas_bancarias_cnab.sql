-- ============================================================
-- MIGRAÇÃO: Contas Bancárias Empresariais para CNAB
-- ============================================================
-- Objetivo: Garantir que a tabela contas_bancarias_empresa
-- suporte os campos necessários para o fluxo de remessa CNAB,
-- incluindo: favorecido, chave_pix, permite_cnab.
-- ============================================================

-- 1. Adicionar colunas novas (se ainda não existirem)
-- ============================================================

DO $$
BEGIN
  -- favorecido: nome de exibição do favorecido no CNAB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contas_bancarias_empresa'
      AND column_name = 'favorecido'
  ) THEN
    ALTER TABLE public.contas_bancarias_empresa
      ADD COLUMN favorecido TEXT NULL;
    RAISE NOTICE 'Coluna favorecido adicionada.';
  END IF;

  -- chave_pix: chave PIX opcional (CNPJ, email, telefone, aleatória)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contas_bancarias_empresa'
      AND column_name = 'chave_pix'
  ) THEN
    ALTER TABLE public.contas_bancarias_empresa
      ADD COLUMN chave_pix TEXT NULL;
    RAISE NOTICE 'Coluna chave_pix adicionada.';
  END IF;

  -- permite_cnab: flag que controla elegibilidade para remessas CNAB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contas_bancarias_empresa'
      AND column_name = 'permite_cnab'
  ) THEN
    ALTER TABLE public.contas_bancarias_empresa
      ADD COLUMN permite_cnab BOOLEAN NOT NULL DEFAULT true;
    RAISE NOTICE 'Coluna permite_cnab adicionada.';
  END IF;
END $$;

-- 2. Índice para consultas frequentes: empresa + ativo + permite_cnab
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contas_empresa_cnab
  ON public.contas_bancarias_empresa (empresa_id, ativo, permite_cnab)
  WHERE ativo = true AND permite_cnab = true;

-- 3. Índice para filtro por tenant
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contas_tenant
  ON public.contas_bancarias_empresa (tenant_id);

-- 4. Comentários para documentação
-- ============================================================

COMMENT ON COLUMN public.contas_bancarias_empresa.favorecido IS
  'Nome do favorecido/alias exibido no arquivo CNAB. Se vazio, usa cedente_nome.';

COMMENT ON COLUMN public.contas_bancarias_empresa.chave_pix IS
  'Chave PIX opcional da conta (CNPJ, email, telefone ou aleatória).';

COMMENT ON COLUMN public.contas_bancarias_empresa.permite_cnab IS
  'Quando true, a conta está habilitada para uso em remessas CNAB240.';

-- 5. Validação: verificar que a tabela existe e tem as colunas
-- ============================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'contas_bancarias_empresa'
    AND column_name IN ('favorecido', 'chave_pix', 'permite_cnab');

  IF v_count = 3 THEN
    RAISE NOTICE '✅ Migração concluída: todas as 3 colunas presentes.';
  ELSE
    RAISE EXCEPTION '❌ Migração incompleta: esperava 3 colunas, encontrou %', v_count;
  END IF;
END $$;
