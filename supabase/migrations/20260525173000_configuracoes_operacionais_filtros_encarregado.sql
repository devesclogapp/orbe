-- Configuração de filtros de colaboradores por tela do encarregado
-- Salva um mapa JSON por fluxo/preset, permitindo que o frontend e o
-- lançamento operacional compartilhem a mesma regra.

ALTER TABLE public.configuracoes_operacionais
  ADD COLUMN IF NOT EXISTS filtros_colaboradores_encarregado JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.configuracoes_operacionais.filtros_colaboradores_encarregado IS
  'Mapa JSON com filtros de colaboradores por fluxo do encarregado, ex: grupo_volume, preset_custos_mensais, preset_transbordo e preset_diaristas.';

NOTIFY pgrst, 'reload schema';
