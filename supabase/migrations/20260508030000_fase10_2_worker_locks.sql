-- FASE 10.2 - EXECUCAO EM BACKGROUND + TRAVAS SOBERANAS

-- 1. Alterar automacao_execucoes para suportar Locks, Heartbeat e Retentativas
ALTER TABLE public.automacao_execucoes
ADD COLUMN locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN locked_by VARCHAR(255),
ADD COLUMN heartbeat_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN tentativas INTEGER DEFAULT 0;

-- 2. Alterar ciclos_operacionais para adicionar status_automacao (Trava Soberana)
ALTER TABLE public.ciclos_operacionais
ADD COLUMN status_automacao VARCHAR(50) DEFAULT 'aguardando_validacao';

-- Valores esperados: 'aguardando_validacao', 'inconsistencias_detectadas', 'pronto_para_fechamento', 'bloqueado_automacao'
