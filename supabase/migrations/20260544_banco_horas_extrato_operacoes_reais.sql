-- Banco de Horas: suporte operacional para ações reais no extrato do colaborador

ALTER TABLE public.banco_horas_eventos
  ADD COLUMN IF NOT EXISTS referencia_evento_id UUID NULL REFERENCES public.banco_horas_eventos(id),
  ADD COLUMN IF NOT EXISTS executado_por UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS executado_por_nome TEXT NULL,
  ADD COLUMN IF NOT EXISTS data_folga DATE NULL,
  ADD COLUMN IF NOT EXISTS reflexo_financeiro_pendente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contexto_operacao JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bh_eventos_referencia_evento
  ON public.banco_horas_eventos (tenant_id, referencia_evento_id);

CREATE INDEX IF NOT EXISTS idx_bh_eventos_executor
  ON public.banco_horas_eventos (tenant_id, executado_por, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bh_eventos_reflexo_financeiro
  ON public.banco_horas_eventos (tenant_id, reflexo_financeiro_pendente, tipo_evento);

COMMENT ON COLUMN public.banco_horas_eventos.referencia_evento_id IS 'Evento de origem consumido ou relacionado pela ação operacional do extrato';
COMMENT ON COLUMN public.banco_horas_eventos.executado_por IS 'Usuário autenticado que executou a ação manual no extrato';
COMMENT ON COLUMN public.banco_horas_eventos.executado_por_nome IS 'Nome humano do executor preservado para auditoria';
COMMENT ON COLUMN public.banco_horas_eventos.data_folga IS 'Data efetiva da folga quando a ação do extrato gera evento tipo folga';
COMMENT ON COLUMN public.banco_horas_eventos.reflexo_financeiro_pendente IS 'Indica que o pagamento do banco de horas ainda precisa refletir no fluxo financeiro futuro';
COMMENT ON COLUMN public.banco_horas_eventos.contexto_operacao IS 'Metadados auditáveis da ação operacional executada no extrato';

NOTIFY pgrst, 'reload schema';
