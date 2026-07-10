-- =============================================================================
-- MIGRATION: Correção dos 3 Bugs Críticos — Domínio Intermitentes
-- Data: 2026-07-10
-- Contexto: Identificados na Auditoria Arquitetural (Etapa 2 da Homologação E2E)
-- IDEMPOTENTE: usa DROP IF EXISTS antes de cada CREATE para re-execução segura
-- =============================================================================

-- =============================================================================
-- BUG CRÍTICO 01 — RLS SEM ISOLAMENTO DE TENANT
-- A policy anterior usava USING(true), permitindo acesso cross-tenant.
-- Substituir por isolamento com current_tenant_id().
-- =============================================================================

-- Remover TODAS as policies antigas (permissivas ou anteriores desta migration)
DROP POLICY IF EXISTS "Acesso total autenticado para lancamentos_intermitentes" ON public.lancamentos_intermitentes;
DROP POLICY IF EXISTS "lancamentos_intermitentes_select_tenant" ON public.lancamentos_intermitentes;
DROP POLICY IF EXISTS "lancamentos_intermitentes_insert_tenant" ON public.lancamentos_intermitentes;
DROP POLICY IF EXISTS "lancamentos_intermitentes_update_tenant" ON public.lancamentos_intermitentes;
DROP POLICY IF EXISTS "lancamentos_intermitentes_delete_tenant" ON public.lancamentos_intermitentes;

-- Policy correta: SELECT isolado por tenant
CREATE POLICY "lancamentos_intermitentes_select_tenant"
ON public.lancamentos_intermitentes
FOR SELECT
TO authenticated
USING (tenant_id = public.current_tenant_id());

-- Policy correta: INSERT isolado por tenant
CREATE POLICY "lancamentos_intermitentes_insert_tenant"
ON public.lancamentos_intermitentes
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_tenant_id());

-- Policy correta: UPDATE isolado por tenant
CREATE POLICY "lancamentos_intermitentes_update_tenant"
ON public.lancamentos_intermitentes
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

-- Policy correta: DELETE isolado por tenant
CREATE POLICY "lancamentos_intermitentes_delete_tenant"
ON public.lancamentos_intermitentes
FOR DELETE
TO authenticated
USING (tenant_id = public.current_tenant_id());

-- NOTA: service_role bypassa RLS por padrão no Supabase — Edge Functions com
-- service_role key continuam funcionando sem alteração.


-- =============================================================================
-- BUG CRÍTICO 02 — STATUS 'PAGO' AUSENTE NO CHECK CONSTRAINT
-- O CnabConciliacaoService tenta setar status_pipeline='PAGO' mas o constraint
-- rejeita o valor, causando falha silenciosa.
-- Solução: remover o constraint antigo e criar um novo mais abrangente.
-- =============================================================================

-- Identificar e remover constraint antigo (nome gerado no CREATE TABLE)
ALTER TABLE public.lancamentos_intermitentes
  DROP CONSTRAINT IF EXISTS lancamentos_intermitentes_status_pipeline_check;

-- Recriar constraint com todos os status do ciclo de vida completo
ALTER TABLE public.lancamentos_intermitentes
  ADD CONSTRAINT lancamentos_intermitentes_status_pipeline_check
  CHECK (status_pipeline IN (
    'RECEBIDO',
    'EM_ANALISE_RH',
    'APROVADO_RH',
    'DEVOLVIDO',
    'ENVIADO_FINANCEIRO',
    'PAGO'
  ));


-- =============================================================================
-- BUG CRÍTICO 03 — `cpf_colaborador` NÃO EXISTE EM `lancamentos_intermitentes`
-- O cnabRetorno.service.ts faz select de cpf_colaborador, mas a coluna não existe.
-- Opção escolhida: A — adicionar coluna para manter snapshot histórico do CPF
-- no momento do lançamento (rastreabilidade de pagamento).
-- =============================================================================

-- Adicionar coluna cpf_colaborador
ALTER TABLE public.lancamentos_intermitentes
  ADD COLUMN IF NOT EXISTS cpf_colaborador TEXT NULL;

-- Backfill: preencher cpf_colaborador para registros existentes que tenham colaborador_id
UPDATE public.lancamentos_intermitentes li
SET cpf_colaborador = c.cpf
FROM public.colaboradores c
WHERE li.colaborador_id = c.id
  AND li.cpf_colaborador IS NULL
  AND c.cpf IS NOT NULL;

-- Índice para busca por CPF no retorno bancário
CREATE INDEX IF NOT EXISTS idx_lancamentos_intermitentes_cpf
  ON public.lancamentos_intermitentes (cpf_colaborador)
  WHERE cpf_colaborador IS NOT NULL;


-- =============================================================================
-- NOTIFICAÇÃO POSTGREST (reload schema cache)
-- =============================================================================
NOTIFY pgrst, 'reload schema';
