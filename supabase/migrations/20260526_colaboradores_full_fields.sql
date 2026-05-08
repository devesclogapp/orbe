-- Migration: Adiciona campos completos para colaboradores (CPF, telefone, dados bancários, tipo)
-- Data: 2026-05-26
-- Objetivo: Suportar o formulário completo de cadastro de colaboradores

-- 1. Remover CHECK constraint antigo do tipo_contrato e adicionar novo com 'Mensal'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'colaboradores_tipo_contrato_check'
    AND table_name = 'colaboradores'
  ) THEN
    ALTER TABLE public.colaboradores DROP CONSTRAINT colaboradores_tipo_contrato_check;
  END IF;
END $$;

ALTER TABLE public.colaboradores
  ADD CONSTRAINT colaboradores_tipo_contrato_check
  CHECK (tipo_contrato IN ('Hora', 'Operação', 'Mensal'));

-- 2. Adicionar campos de identificação
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS tipo_colaborador TEXT DEFAULT 'CLT';

COMMENT ON COLUMN public.colaboradores.cpf IS 'CPF do colaborador (apenas números)';
COMMENT ON COLUMN public.colaboradores.telefone IS 'Telefone do colaborador (apenas números)';
COMMENT ON COLUMN public.colaboradores.tipo_colaborador IS 'Tipo: CLT, DIARISTA, INTERMITENTE, PRODUÇÃO, TERCEIRIZADO';

-- 3. Adicionar campos de lançamento operacional
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS permitir_lancamento_operacional BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.colaboradores.permitir_lancamento_operacional IS 'Se diarista pode ser usado em lançamentos operacionais';

-- 4. Adicionar campos de dados bancários
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS nome_completo TEXT,
  ADD COLUMN IF NOT EXISTS banco_codigo TEXT,
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS agencia_digito TEXT,
  ADD COLUMN IF NOT EXISTS conta TEXT,
  ADD COLUMN IF NOT EXISTS conta_digito TEXT,
  ADD COLUMN IF NOT EXISTS tipo_conta TEXT DEFAULT 'corrente';

COMMENT ON COLUMN public.colaboradores.nome_completo IS 'Nome completo para dados bancários (titular da conta)';
COMMENT ON COLUMN public.colaboradores.banco_codigo IS 'Código do banco (ex: 001 para BB, 033 para Santander)';
COMMENT ON COLUMN public.colaboradores.agencia IS 'Número da agência bancária';
COMMENT ON COLUMN public.colaboradores.agencia_digito IS 'Dígito da agência';
COMMENT ON COLUMN public.colaboradores.conta IS 'Número da conta bancária';
COMMENT ON COLUMN public.colaboradores.conta_digito IS 'Dígito da conta';
COMMENT ON COLUMN public.colaboradores.tipo_conta IS 'Tipo de conta: corrente ou poupanca';

-- 5. Atualizar tipo_colaborador existente para padrão CLT
UPDATE public.colaboradores SET tipo_colaborador = 'CLT' WHERE tipo_colaborador IS NULL;

ALTER TABLE public.colaboradores ALTER COLUMN tipo_colaborador SET DEFAULT 'CLT';
ALTER TABLE public.colaboradores ALTER COLUMN tipo_colaborador SET NOT NULL;

-- 6. Criar índice para busca por CPF
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON public.colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_colaboradores_telefone ON public.colaboradores(telefone);
CREATE INDEX IF NOT EXISTS idx_colaboradores_tipo_colaborador ON public.colaboradores(tipo_colaborador);

-- 7. Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260526_colaboradores_full_fields completed successfully';
END $$;
