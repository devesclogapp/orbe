-- Política de delete para fornecedores
DROP POLICY IF EXISTS "Allow delete fornecedores" ON public.fornecedores;
CREATE POLICY "Allow delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (true);

-- Política de update para fornecedores
DROP POLICY IF EXISTS "Allow update fornecedores" ON public.fornecedores;
CREATE POLICY "Allow update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (true);

-- Política de delete para transportadoras_clientes
DROP POLICY IF EXISTS "Allow delete transportadoras_clientes" ON public.transportadoras_clientes;
CREATE POLICY "Allow delete transportadoras_clientes" ON public.transportadoras_clientes FOR DELETE TO authenticated USING (true);

-- Política de update para transportadoras_clientes
DROP POLICY IF EXISTS "Allow update transportadoras_clientes" ON public.transportadoras_clientes;
CREATE POLICY "Allow update transportadoras_clientes" ON public.transportadoras_clientes FOR UPDATE TO authenticated USING (true);

-- Política de delete para tipos_servico_operacional
DROP POLICY IF EXISTS "Allow delete tipos_servico_operacional" ON public.tipos_servico_operacional;
CREATE POLICY "Allow delete tipos_servico_operacional" ON public.tipos_servico_operacional FOR DELETE TO authenticated USING (true);

-- Política de update para tipos_servico_operacional
DROP POLICY IF EXISTS "Allow update tipos_servico_operacional" ON public.tipos_servico_operacional;
CREATE POLICY "Allow update tipos_servico_operacional" ON public.tipos_servico_operacional FOR UPDATE TO authenticated USING (true);