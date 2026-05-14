-- Evolucao operacional do banco de horas para controle persistido e auditavel.
-- Mantem compatibilidade com as colunas legadas enquanto introduz o modelo novo.

ALTER TABLE public.banco_horas_eventos
  ADD COLUMN IF NOT EXISTS data_evento DATE,
  ADD COLUMN IF NOT EXISTS tipo_evento TEXT,
  ADD COLUMN IF NOT EXISTS minutos INTEGER,
  ADD COLUMN IF NOT EXISTS saldo_resultante INTEGER,
  ADD COLUMN IF NOT EXISTS ciclo_trimestral TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS observacao TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'banco_horas_eventos_tipo_evento_check'
  ) THEN
    ALTER TABLE public.banco_horas_eventos
      ADD CONSTRAINT banco_horas_eventos_tipo_evento_check
      CHECK (
        tipo_evento IS NULL OR tipo_evento IN (
          'hora_extra',
          'atraso',
          'falta',
          'compensacao',
          'folga',
          'pagamento',
          'ajuste_manual',
          'vencimento'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'banco_horas_eventos_status_check'
  ) THEN
    ALTER TABLE public.banco_horas_eventos
      ADD CONSTRAINT banco_horas_eventos_status_check
      CHECK (
        status IS NULL OR status IN (
          'ativo',
          'compensado',
          'pago',
          'vencido',
          'ajustado',
          'cancelado'
        )
      );
  END IF;
END $$;

UPDATE public.banco_horas_eventos
SET
  data_evento = COALESCE(
    data_evento,
    CASE
      WHEN data IS NOT NULL THEN data::date
      ELSE created_at::date
    END
  ),
  minutos = COALESCE(minutos, quantidade_minutos, 0),
  saldo_resultante = COALESCE(
    saldo_resultante,
    saldo_atual,
    COALESCE(saldo_anterior, 0) + COALESCE(quantidade_minutos, 0),
    COALESCE(quantidade_minutos, 0)
  ),
  tipo_evento = COALESCE(
    tipo_evento,
    CASE
      WHEN tipo IN (
        'hora_extra',
        'atraso',
        'falta',
        'compensacao',
        'folga',
        'pagamento',
        'ajuste_manual',
        'vencimento'
      ) THEN tipo
      WHEN lower(COALESCE(descricao, '')) LIKE '%falta%' THEN 'falta'
      WHEN COALESCE(quantidade_minutos, 0) >= 0 THEN 'hora_extra'
      ELSE 'atraso'
    END
  ),
  ciclo_trimestral = COALESCE(
    ciclo_trimestral,
    CASE
      WHEN COALESCE(data_evento, data::date, created_at::date) IS NULL THEN NULL
      ELSE concat(
        extract(year from COALESCE(data_evento, data::date, created_at::date))::int,
        '-T',
        extract(quarter from COALESCE(data_evento, data::date, created_at::date))::int
      )
    END
  ),
  observacao = COALESCE(observacao, descricao),
  status = COALESCE(
    status,
    CASE
      WHEN tipo_evento = 'vencimento' OR tipo = 'vencimento' THEN 'vencido'
      WHEN tipo_evento = 'pagamento' OR tipo = 'pagamento' THEN 'pago'
      WHEN tipo_evento = 'ajuste_manual' OR tipo = 'ajuste_manual' THEN 'ajustado'
      ELSE 'ativo'
    END
  );

CREATE INDEX IF NOT EXISTS idx_bh_eventos_data_evento
  ON public.banco_horas_eventos (tenant_id, colaborador_id, data_evento);

CREATE INDEX IF NOT EXISTS idx_bh_eventos_ciclo_trimestral
  ON public.banco_horas_eventos (tenant_id, colaborador_id, ciclo_trimestral);

CREATE INDEX IF NOT EXISTS idx_bh_eventos_vencimento_status
  ON public.banco_horas_eventos (tenant_id, status, data_vencimento);

COMMENT ON COLUMN public.banco_horas_eventos.data_evento IS 'Data efetiva do evento do banco de horas';
COMMENT ON COLUMN public.banco_horas_eventos.tipo_evento IS 'Tipo operacional auditavel do evento';
COMMENT ON COLUMN public.banco_horas_eventos.minutos IS 'Quantidade de minutos do evento, positiva ou negativa';
COMMENT ON COLUMN public.banco_horas_eventos.saldo_resultante IS 'Saldo acumulado do colaborador imediatamente apos o evento';
COMMENT ON COLUMN public.banco_horas_eventos.ciclo_trimestral IS 'Identificador do ciclo trimestral do evento no formato YYYY-Tn';
COMMENT ON COLUMN public.banco_horas_eventos.status IS 'Estado operacional do evento: ativo, compensado, pago, vencido, ajustado, cancelado';
COMMENT ON COLUMN public.banco_horas_eventos.observacao IS 'Observacao auditavel do evento';
