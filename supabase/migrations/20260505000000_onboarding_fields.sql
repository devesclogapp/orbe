-- Adiciona campos de onboarding na tabela profiles
-- Este arquivo adiciona o suporte ao sistema de onboarding guiado

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'cadastro_base',
ADD COLUMN IF NOT EXISTS onboarding_completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed, onboarding_step) WHERE onboarding_completed = false;

COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Indica se o usuário completou o onboarding';
COMMENT ON COLUMN public.profiles.onboarding_step IS 'Etapa atual do onboarding';
COMMENT ON COLUMN public.profiles.onboarding_completed_steps IS 'Lista de etapas já concluídas';