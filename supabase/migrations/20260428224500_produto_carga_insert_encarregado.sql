DROP POLICY IF EXISTS "Acesso insert Admin Financeiro produtos_carga" ON public.produtos_carga;

CREATE POLICY "Acesso insert Admin Financeiro Encarregado produtos_carga"
  ON public.produtos_carga
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('Admin', 'Financeiro', 'Encarregado'));
