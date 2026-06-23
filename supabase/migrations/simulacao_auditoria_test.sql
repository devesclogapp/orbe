-- ==============================================================================
-- SIMULAÇÃO DE GOVERNANÇA: SPRINT 3
-- Objetivo: Demonstrar a rastreabilidade total (Cenários A, B, C)
-- Como executar: Execute no Supabase Studio SQL Editor
-- ==============================================================================

BEGIN; -- Inicia transação segura para teste (remova o rollback no fim se quiser persistir)

-- Cenário A: INSERT
-- Simula a criação de uma operação (apenas simulando campos que existem)
INSERT INTO public.operacoes_producao (
    id, tenant_id, status, quantidade
)
VALUES (
    '10000000-0000-0000-0000-000000000001'::uuid, 
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'pendente',
    10.5
);

-- Verificar: audit_log criado
-- Exibe o log criado pelo Insert
SELECT a.acao, a.entidade, a.valor_novo, a.descricao
FROM public.audit_log a
WHERE a.registro_id = '10000000-0000-0000-0000-000000000001'::uuid AND a.acao = 'INSERT';


-- Cenário B: UPDATE
-- Simula a alteração da quantidade e envio ao RH (mudando o status)
UPDATE public.operacoes_producao
SET quantidade = 15.0, status = 'processado'
WHERE id = '10000000-0000-0000-0000-000000000001'::uuid;

-- Verificar: valor_anterior, valor_novo
-- Exibe a diferença gerada pela trigger
SELECT a.acao, a.valor_anterior->>'quantidade' AS "Qtd Antiga", a.valor_novo->>'quantidade' AS "Qtd Nova",
       a.valor_anterior->>'status' AS "Status Antigo", a.valor_novo->>'status' AS "Status Novo"
FROM public.audit_log a
WHERE a.registro_id = '10000000-0000-0000-0000-000000000001'::uuid AND a.acao = 'UPDATE';


-- Cenário C: DELETE
-- Exclui a operação de teste
DELETE FROM public.operacoes_producao
WHERE id = '10000000-0000-0000-0000-000000000001'::uuid;

-- Verificar: snapshot preservado
SELECT a.acao, a.entidade, a.valor_anterior, a.descricao
FROM public.audit_log a
WHERE a.registro_id = '10000000-0000-0000-0000-000000000001'::uuid AND a.acao = 'DELETE';

-- Governança - Simulações Exclusivas com Audit Log
-- Pergunta 1: Quem alterou a operação X?
SELECT usuario_nome, perfil_usuario, created_at, descricao
FROM public.audit_log
WHERE registro_id = '10000000-0000-0000-0000-000000000001'::uuid AND acao = 'UPDATE'
ORDER BY created_at DESC;

-- Pergunta 3: Quem aprovou o lote Y? (Exemplo com financeiro_lotes_pagamento)
/*
SELECT usuario_nome, created_at 
FROM public.audit_log 
WHERE registro_id = 'ID_DO_LOTE' 
  AND acao = 'UPDATE' 
  AND valor_novo->>'status' = 'Aprovado'
ORDER BY created_at ASC LIMIT 1;
*/

ROLLBACK; -- Desfaz o teste para não poluir a base
