-- =============================================================================
-- Migration: Fix historico_importacoes para suportar origem 'rhid_api' e adicionar campos ausentes de ciclos_operacionais
-- Data: 2026-05-23
-- =============================================================================

-- 1. CORRIGIR CONSTRAINT DE ORIGEM EM historico_importacoes
ALTER TABLE public.historico_importacoes
  DROP CONSTRAINT IF EXISTS historico_importacoes_origem_check;

ALTER TABLE public.historico_importacoes
  ADD CONSTRAINT historico_importacoes_origem_check
  CHECK (origem IN ('manual', 'google_drive', 'api', 'rhid_api'));

-- 2. ADICIONAR CAMPOS AUSENTES A ciclos_operacionais
--    Isso previne diretamente os ERROS 400 de colunas não encontradas (se não rodaram a migration original)
ALTER TABLE public.ciclos_operacionais
  ADD COLUMN IF NOT EXISTS status_rh VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status_rh IN ('pendente', 'validado_rh', 'rejeitado_rh')),
  ADD COLUMN IF NOT EXISTS status_financeiro VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status_financeiro IN ('pendente', 'validado_financeiro', 'rejeitado_financeiro')),
  ADD COLUMN IF NOT EXISTS status_remessa VARCHAR(50) NOT NULL DEFAULT 'nao_gerada' CHECK (status_remessa IN ('nao_gerada', 'pronta', 'remetida', 'retornada')),
  ADD COLUMN IF NOT EXISTS status_automacao VARCHAR(50) NOT NULL DEFAULT 'ok' CHECK (status_automacao IN ('ok', 'aguardando_validacao', 'bloqueado_automacao', 'inconsistencias_detectadas'));

-- 3. COMENTÁRIOS E RELOAD DO CACHE DA API PARA OS ERROS 400 SUMIREM
COMMENT ON CONSTRAINT historico_importacoes_origem_check ON public.historico_importacoes
  IS 'Origens válidas: manual, google_drive, api, rhid_api';

NOTIFY pgrst, 'reload schema';
