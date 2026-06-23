-- Migration: 20260624000005_sprint2_performance_indexes
-- Descrição: Índices para acelerar paginação, ordenação e filtros (Etapa 5 da Sprint de Performance)

-- 1. operacoes_producao (listagens e dashboard operacional)
CREATE INDEX IF NOT EXISTS idx_operacoes_producao_status ON operacoes_producao(status);
CREATE INDEX IF NOT EXISTS idx_operacoes_producao_empresa_id ON operacoes_producao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_producao_data_operacao ON operacoes_producao(data_operacao DESC);

-- 2. registros_ponto (listagens RH)
CREATE INDEX IF NOT EXISTS idx_registros_ponto_status_processamento ON registros_ponto(status_processamento);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_empresa_id ON registros_ponto(empresa_id);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_colaborador_id ON registros_ponto(colaborador_id);

-- 3. lancamentos_diaristas (listagens RH)
CREATE INDEX IF NOT EXISTS idx_lancamentos_diaristas_status ON lancamentos_diaristas(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_diaristas_empresa_id ON lancamentos_diaristas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_diaristas_data_lancamento ON lancamentos_diaristas(data_lancamento DESC);

-- 4. rh_financeiro_lotes (Listagem Financeira)
CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lotes_status ON rh_financeiro_lotes(status);
CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lotes_competencia ON rh_financeiro_lotes(competencia DESC);

-- 5. operacoes (legado - para as Views unificadas e buscas antigas)
CREATE INDEX IF NOT EXISTS idx_operacoes_status ON operacoes(status);
CREATE INDEX IF NOT EXISTS idx_operacoes_data ON operacoes(data DESC);

-- 6. cnab_remessas_arquivos (Bancário)
CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_status ON cnab_remessas_arquivos(status);
CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_data_envio ON cnab_remessas_arquivos(data_envio DESC);
