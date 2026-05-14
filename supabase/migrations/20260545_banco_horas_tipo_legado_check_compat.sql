-- Compatibiliza o check legado da coluna tipo em banco_horas_eventos
-- para aceitar os tipos operacionais modernos sem quebrar consumidores antigos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'banco_horas_eventos_tipo_check'
  ) THEN
    ALTER TABLE public.banco_horas_eventos
      DROP CONSTRAINT banco_horas_eventos_tipo_check;
  END IF;
END $$;

ALTER TABLE public.banco_horas_eventos
  ADD CONSTRAINT banco_horas_eventos_tipo_check
  CHECK (
    tipo IS NULL OR tipo IN (
      'hora_extra',
      'atraso',
      'falta',
      'compensacao',
      'folga',
      'pagamento',
      'ajuste_manual',
      'vencimento',
      'hora',
      'diaria',
      'operacao'
    )
  );

COMMENT ON CONSTRAINT banco_horas_eventos_tipo_check ON public.banco_horas_eventos IS
  'Compatibilidade entre a coluna tipo legada e os tipos operacionais atuais do banco de horas';

NOTIFY pgrst, 'reload schema';
