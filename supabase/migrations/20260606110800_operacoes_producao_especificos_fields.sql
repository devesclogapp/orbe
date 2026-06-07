-- Migração para unificar Serviços Específicos na tabela principal de operações
-- Adicionando colunas necessárias para rastreamento de códigos gerados e regras de período

ALTER TABLE public.operacoes_producao 
ADD COLUMN IF NOT EXISTS codigo_operacional text,
ADD COLUMN IF NOT EXISTS regra_id uuid REFERENCES public.servicos_especificos_regras(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.operacoes_producao.codigo_operacional IS 'Código gerado automaticamente para serviços específicos (ex: N1C5)';
COMMENT ON COLUMN public.operacoes_producao.regra_id IS 'Referência à regra de serviço específico/período aplicada';

-- Garantir que o cache do PostgREST seja atualizado
NOTIFY pgrst, 'reload schema';
