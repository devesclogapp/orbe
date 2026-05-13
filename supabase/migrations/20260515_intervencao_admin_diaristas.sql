-- ==============================================================================
-- CAMADA DE INTERVENÇÃO ADMINISTRATIVA PARA DIARISTAS
-- ==============================================================================

-- 1. Tabela lancamentos_diaristas: Adicionar colunas de auditoria de edição
ALTER TABLE public.lancamentos_diaristas
  ADD COLUMN IF NOT EXISTS editado_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS editado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_edicao TEXT;

-- 2. Tabela diaristas_lotes_fechamento: Adicionar tipo_fechamento
ALTER TABLE public.diaristas_lotes_fechamento
  ADD COLUMN IF NOT EXISTS tipo_fechamento TEXT DEFAULT 'operacional' CHECK (tipo_fechamento IN ('operacional', 'administrativo'));

-- 3. Inserir ações permitidas na trigger ou apenas no frontend.
-- Como a tabela logs não tem Enum restrito para 'acao', o Frontend poderá
-- enviar 'CORRIGIDO_MANUALMENTE' e 'REFECHAMENTO_ADMINISTRATIVO' normalmente.

-- 4. Função auxiliar para edição de lançamento e geração de log (opcional, 
-- mas faremos via RPC/Front-end para melhor flexibilidade).
