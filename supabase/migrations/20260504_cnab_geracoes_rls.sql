-- Add RLS to cnab_geracoes table
ALTER TABLE public.cnab_geracoes ENABLE ROW LEVEL SECURITY;

-- Política de leitura (apenas usuário logado)
CREATE POLICY "Leitura autenticada cnab_geracoes" 
ON public.cnab_geracoes 
FOR SELECT USING (auth.role() = 'authenticated');

-- Política de insert (apenas usuário logado)
CREATE POLICY "Insert autenticado cnab_geracoes" 
ON public.cnab_geracoes 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política de update (apenas usuário logado)
CREATE POLICY "Update autenticado cnab_geracoes" 
ON public.cnab_geracoes 
FOR UPDATE USING (auth.role() = 'authenticated');

-- Política de delete (apenas usuário logado)
CREATE POLICY "Delete autenticado cnab_geracoes" 
ON public.cnab_geracoes 
FOR DELETE USING (auth.role() = 'authenticated');