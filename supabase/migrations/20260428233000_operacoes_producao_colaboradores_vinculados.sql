ALTER TABLE public.operacoes_producao
ALTER COLUMN colaborador_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.production_entry_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_entry_id UUID NOT NULL REFERENCES public.operacoes_producao(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  had_infraction BOOLEAN NOT NULL DEFAULT false,
  infraction_type_id TEXT,
  infraction_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT production_entry_collaborators_unique UNIQUE (production_entry_id, collaborator_id)
);

CREATE INDEX IF NOT EXISTS idx_production_entry_collaborators_entry
  ON public.production_entry_collaborators (production_entry_id);

CREATE INDEX IF NOT EXISTS idx_production_entry_collaborators_collaborator
  ON public.production_entry_collaborators (collaborator_id);

ALTER TABLE public.production_entry_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso leitura autenticado production_entry_collaborators"
  ON public.production_entry_collaborators
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Acesso insert autenticado production_entry_collaborators"
  ON public.production_entry_collaborators
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
