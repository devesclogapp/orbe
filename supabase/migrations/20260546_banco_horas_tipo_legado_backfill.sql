-- Saneia valores legados de banco_horas_eventos.tipo antes de reaplicar o CHECK

UPDATE public.banco_horas_eventos
SET tipo = CASE
  WHEN COALESCE(tipo_evento, '') IN (
    'hora_extra',
    'atraso',
    'falta',
    'compensacao',
    'folga',
    'pagamento',
    'ajuste_manual',
    'vencimento'
  ) THEN tipo_evento
  WHEN lower(COALESCE(tipo, '')) IN (
    'hora_extra',
    'extra',
    'credito',
    'crédito',
    'positivo',
    'hora',
    'horas'
  ) THEN 'hora_extra'
  WHEN lower(COALESCE(tipo, '')) IN (
    'atraso',
    'debito',
    'débito',
    'negativo',
    'compensado'
  ) THEN 'atraso'
  WHEN lower(COALESCE(tipo, '')) IN ('falta', 'ausencia', 'ausência') THEN 'falta'
  WHEN lower(COALESCE(tipo, '')) IN ('pagamento', 'pago') THEN 'pagamento'
  WHEN lower(COALESCE(tipo, '')) IN ('folga') THEN 'folga'
  WHEN lower(COALESCE(tipo, '')) IN ('compensacao', 'compensação') THEN 'compensacao'
  WHEN lower(COALESCE(tipo, '')) IN ('ajuste_manual', 'ajuste', 'manual') THEN 'ajuste_manual'
  WHEN lower(COALESCE(tipo, '')) IN ('vencimento', 'vencido') THEN 'vencimento'
  WHEN COALESCE(minutos, quantidade_minutos, 0) >= 0 THEN 'hora_extra'
  ELSE 'atraso'
END
WHERE tipo IS DISTINCT FROM CASE
  WHEN COALESCE(tipo_evento, '') IN (
    'hora_extra',
    'atraso',
    'falta',
    'compensacao',
    'folga',
    'pagamento',
    'ajuste_manual',
    'vencimento'
  ) THEN tipo_evento
  WHEN lower(COALESCE(tipo, '')) IN (
    'hora_extra',
    'extra',
    'credito',
    'crédito',
    'positivo',
    'hora',
    'horas'
  ) THEN 'hora_extra'
  WHEN lower(COALESCE(tipo, '')) IN (
    'atraso',
    'debito',
    'débito',
    'negativo',
    'compensado'
  ) THEN 'atraso'
  WHEN lower(COALESCE(tipo, '')) IN ('falta', 'ausencia', 'ausência') THEN 'falta'
  WHEN lower(COALESCE(tipo, '')) IN ('pagamento', 'pago') THEN 'pagamento'
  WHEN lower(COALESCE(tipo, '')) IN ('folga') THEN 'folga'
  WHEN lower(COALESCE(tipo, '')) IN ('compensacao', 'compensação') THEN 'compensacao'
  WHEN lower(COALESCE(tipo, '')) IN ('ajuste_manual', 'ajuste', 'manual') THEN 'ajuste_manual'
  WHEN lower(COALESCE(tipo, '')) IN ('vencimento', 'vencido') THEN 'vencimento'
  WHEN COALESCE(minutos, quantidade_minutos, 0) >= 0 THEN 'hora_extra'
  ELSE 'atraso'
END;

ALTER TABLE public.banco_horas_eventos
  DROP CONSTRAINT IF EXISTS banco_horas_eventos_tipo_check;

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

NOTIFY pgrst, 'reload schema';
