
-- Adicionar coluna nome_coletor na tabela coletores
ALTER TABLE public.coletores 
ADD COLUMN IF NOT EXISTS nome_coletor TEXT;

COMMENT ON COLUMN public.coletores.nome_coletor IS 'Nome identificador amigável do coletor (Ex: Coletor Dismelo - Entrada Principal)';

-- Atualizar coletores existentes para ter um nome baseado no modelo/série se estiverem vazios
UPDATE public.coletores 
SET nome_coletor = COALESCE(modelo, 'Coletor') || ' - ' || COALESCE(serie, id::text)
WHERE nome_coletor IS NULL;
