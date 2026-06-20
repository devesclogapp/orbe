-- Correção de RLS baseada no desuso da tabela 'perfis_usuarios' substituída por 'profiles'

-- 1. Corrigir Policy para financeiro_consolidados_cliente
DROP POLICY IF EXISTS "financeiro_consolidados_cliente_crud_policy" ON public.financeiro_consolidados_cliente;
CREATE POLICY "financeiro_consolidados_cliente_crud_policy" ON public.financeiro_consolidados_cliente
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid() 
            AND p.tenant_id = financeiro_consolidados_cliente.tenant_id
        )
    );

-- 2. Corrigir Policy para financeiro_consolidados_colaborador
DROP POLICY IF EXISTS "financeiro_consolidados_colaborador_crud_policy" ON public.financeiro_consolidados_colaborador;
CREATE POLICY "financeiro_consolidados_colaborador_crud_policy" ON public.financeiro_consolidados_colaborador
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid() 
            AND p.tenant_id = financeiro_consolidados_colaborador.tenant_id
        )
    );

-- 3. Corrigir Policy para faturas
DROP POLICY IF EXISTS "faturas_crud_policy" ON public.faturas;
CREATE POLICY "faturas_crud_policy" ON public.faturas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid() 
            AND p.tenant_id = faturas.tenant_id
        )
    );
