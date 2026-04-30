CREATE POLICY "Acesso insert autenticado tipos_servico_operacional"
  ON public.tipos_servico_operacional
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Acesso insert autenticado transportadoras_clientes"
  ON public.transportadoras_clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Acesso insert autenticado fornecedores"
  ON public.fornecedores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
