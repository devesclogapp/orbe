CREATE POLICY "Acesso delete autenticado operacoes_producao"
  ON public.operacoes_producao
  FOR DELETE TO authenticated
  USING (status NOT IN ('fechado'));
