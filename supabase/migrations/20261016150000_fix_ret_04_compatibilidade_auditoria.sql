-- ==============================================================================
-- ERP ORBE — FIX-RET-04: COMPATIBILIZAÇÃO DA CONSTRAINT DE AUDITORIA BANCÁRIA
-- Data: 2026-10-16 15:00:00
-- Objetivo: Expandir a check constraint cnab_auditoria_bancaria_acao_check
--           para comportar os eventos 'RETORNO_PROCESSADO_SIMULADO' e
--           'RETORNO_PROCESSADO_INTEGRAL' emitidos pela RPC rpc_aplicar_cnab_retorno,
--           preservando 100% dos valores históricos e garantindo imutabilidade.
-- ==============================================================================

-- 1. Remoção segura da constraint legada restritiva
ALTER TABLE public.cnab_auditoria_bancaria
  DROP CONSTRAINT IF EXISTS cnab_auditoria_bancaria_acao_check;

-- 2. Recriação da constraint com vocabulário canônico + novos enums de retorno
ALTER TABLE public.cnab_auditoria_bancaria
  ADD CONSTRAINT cnab_auditoria_bancaria_acao_check
  CHECK (
    acao IN (
      -- Ações históricas de Remessa e Encerramento
      'geracao',
      'download',
      'envio_manual',
      'homologacao',
      'erro_homologacao',
      'validacao',

      -- Ações históricas de Retorno e Conciliação
      'upload_retorno',
      'processamento_retorno',
      'erro_retorno',
      'divergencia_retorno',
      'conciliacao_aprovada',
      'conciliacao_rejeitada',
      'conciliacao_divergente',
      'conciliacao_revertida',
      'conciliacao_observacao',

      -- Ações atômicas de Retorno da FIX-RET-02 / FIX-RET-03
      'RETORNO_PROCESSADO_SIMULADO',
      'RETORNO_PROCESSADO_INTEGRAL',
      'retorno_processado_simulado',
      'retorno_processado_integral'
    )
  );

COMMENT ON CONSTRAINT cnab_auditoria_bancaria_acao_check ON public.cnab_auditoria_bancaria IS
  'ERP ORBE FIX-RET-04: Valida estritamente os tipos de ações permitidas na trilha de auditoria bancária.';
