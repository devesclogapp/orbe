-- MIGRATION: Índices de performance para a tabela de operacoes_producao
-- Criado para suportar os filtros da Central Operacional de forma performática

CREATE INDEX IF NOT EXISTS idx_operacoes_producao_empresa_data ON public.operacoes_producao (empresa_id, data_operacao);
CREATE INDEX IF NOT EXISTS idx_operacoes_producao_status ON public.operacoes_producao (status);
CREATE INDEX IF NOT EXISTS idx_operacoes_producao_unidade ON public.operacoes_producao (unidade_id);
