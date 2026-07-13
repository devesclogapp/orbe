-- ====================================================================================
-- SCRIPT DE SELEÇÃO: LISTA DE DADOS SINTÉTICOS PARA REVISÃO ANTES DO HARD DELETE
-- ====================================================================================

-- 1. Lançamentos que serão apagados (Critérios: mocks fixos e Cpfs de teste)
SELECT id, nome_colaborador, cpf_colaborador, departamento, empresa_id, lote_fechamento_id 
FROM lancamentos_intermitentes 
WHERE nome_colaborador IN ('Intermitente Sem Rumo', 'JOAO DAS COUVES (CASTANHAL)', 'Intermitente Existente', 'Colaborador Zumbi Novo', 'Colaborador Existente')
   OR cpf_colaborador IN ('11111111111', '22222222222')
   OR departamento IN ('Empresa Totalmente Nova e Fantasma SA', 'Departamento Desconhecido ZXZX', 'Castanhal,Operacional', 'Operacional,Castanhal');

-- 2. Lotes que serão apagados (Lotes que ficaram orfãos ou são compostos APENAS por esses laçamentos sintéticos)
SELECT id, tenant_id, empresa_id, status, observacoes, quantidade_registros 
FROM intermitentes_lotes_fechamento 
WHERE id IN (
    SELECT lote_fechamento_id 
    FROM lancamentos_intermitentes 
    WHERE nome_colaborador IN ('Intermitente Sem Rumo', 'JOAO DAS COUVES (CASTANHAL)', 'Intermitente Existente', 'Colaborador Zumbi Novo', 'Colaborador Existente')
       OR cpf_colaborador IN ('11111111111', '22222222222')
       OR departamento IN ('Empresa Totalmente Nova e Fantasma SA', 'Departamento Desconhecido ZXZX', 'Castanhal,Operacional', 'Operacional,Castanhal')
);

-- 3. Empresas temporárias Sujas/Sintéticas que serão apagadas (Estritamente pelos nomes sujos usados no teste)
SELECT id, nome, origem, cnpj 
FROM empresas 
WHERE nome IN (
    'Empresa Totalmente Nova e Fantasma SA', 
    'Departamento Desconhecido ZXZX',
    'Castanhal,Operacional',
    'Operacional,Castanhal'
);
