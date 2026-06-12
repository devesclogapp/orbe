-- Adicionar campos de carga horária individual na tabela de vínculo `production_entry_collaborators`

ALTER TABLE public.production_entry_collaborators 
ADD COLUMN IF NOT EXISTS entrada_ponto TIME NULL,
ADD COLUMN IF NOT EXISTS saida_almoco TIME NULL,
ADD COLUMN IF NOT EXISTS retorno_almoco TIME NULL,
ADD COLUMN IF NOT EXISTS saida_ponto TIME NULL;
