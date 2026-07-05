-- Script de Correção RLS para production_entry_collaborators e operacao_producao_materiais
-- Resolve os seguintes problemas:
-- 1. A policy pec_tenant_all fazia referência a 'entry_id' em vez de 'production_entry_id', causando bloqueio silencioso em SELECT / DELETE
-- 2. operacao_producao_materiais não possuía policy permitindo DELETE / UPDATE (apenas SELECT e INSERT).
-- 
-- Copie e cole este script no Editor SQL (SQL Editor) do seu Dashboard Supabase.

BEGIN;

-- 1. CORREÇÃO PRODUCTION_ENTRY_COLLABORATORS
-- ====================================================

ALTER TABLE public.production_entry_collaborators ENABLE ROW LEVEL SECURITY;

-- Limpa a policy incorreta caso exista
DROP POLICY IF EXISTS "pec_tenant_all" ON public.production_entry_collaborators;
-- Limpa policies legadas (caso tenham sobrado)
DROP POLICY IF EXISTS "Acesso leitura autenticado production_entry_collaborators" ON public.production_entry_collaborators;
DROP POLICY IF EXISTS "Acesso insert autenticado production_entry_collaborators" ON public.production_entry_collaborators;
DROP POLICY IF EXISTS "production_entry_collaborators_tenant_all" ON public.production_entry_collaborators;


-- Cria uma policy global FOR ALL com nome de coluna corrigido: 'production_entry_id'
CREATE POLICY "pec_tenant_all" ON public.production_entry_collaborators
  FOR ALL TO authenticated
  USING (
    production_entry_id IN (
      SELECT id FROM public.operacoes_producao
      WHERE tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    production_entry_id IN (
      SELECT id FROM public.operacoes_producao
      WHERE tenant_id = public.current_tenant_id()
    )
  );


-- 2. CORREÇÃO OPERACAO_PRODUCAO_MATERIAIS
-- ====================================================

-- Limpar as policies antigas para os materiais
DROP POLICY IF EXISTS "Acesso leitura autenticado operacao_producao_materiais" ON public.operacao_producao_materiais;
DROP POLICY IF EXISTS "Acesso insert autenticado operacao_producao_materiais" ON public.operacao_producao_materiais;
DROP POLICY IF EXISTS "opm_tenant_all" ON public.operacao_producao_materiais;

-- Cria uma única policy FOR ALL pros materiais atrelados à operação autorizada
CREATE POLICY "opm_tenant_all" ON public.operacao_producao_materiais
  FOR ALL TO authenticated
  USING (
    operacao_id IN (
      SELECT id FROM public.operacoes_producao
      WHERE tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    operacao_id IN (
      SELECT id FROM public.operacoes_producao
      WHERE tenant_id = public.current_tenant_id()
    )
  );

COMMIT;
