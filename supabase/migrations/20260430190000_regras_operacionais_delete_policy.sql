DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fornecedor_valores_servico'
      AND policyname = 'Acesso delete Admin Financeiro fornecedor_valores_servico'
  ) THEN
    CREATE POLICY "Acesso delete Admin Financeiro fornecedor_valores_servico"
      ON public.fornecedor_valores_servico
      FOR DELETE
      TO authenticated
      USING (public.get_user_role() IN ('Admin', 'Financeiro'));
  END IF;
END
$$;
