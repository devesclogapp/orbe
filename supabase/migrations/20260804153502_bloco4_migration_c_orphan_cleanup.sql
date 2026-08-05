-- ============================================================
-- BLOCO 4: ETAPA 4.2 — SANEAMENTO DE ÓRFÃOS (GATE) (CORREÇÃO DE TRIGGER)
-- ============================================================

-- A tentativa de deletar falhou porque a tabela cnab_auditoria_bancaria possui
-- um trigger estrito (block_audit_change) que impede o UPDATE disparado pelo 
-- "ON DELETE SET NULL" da chave estrangeira.
-- Como esses 2 arquivos de teste não podem ser deletados sem violar a regra de append-only
-- da auditoria, nós vamos vincular esses registros à primeira empresa do Tenant de forma 
-- forçada e marcá-los como erro, satisfazendo a constraint pacíficamente.

UPDATE public.cnab_remessas_arquivos r
SET 
  empresa_id = (SELECT e.id FROM public.empresas e WHERE e.tenant_id = r.tenant_id LIMIT 1),
  observacoes = 'REGISTRO ORFÃO VINCULADO AUTOMATICAMENTE DURANTE A MIGRATION DE IDEMPOTÊNCIA CNAB',
  status = 'erro_homologacao'
WHERE r.empresa_id IS NULL;
