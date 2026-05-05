# Auditoria STEP 1 - Correções Críticas Multi-Tenant

> **Data**: 2026-05-05
> **Status**: ❌ REPROVADO - Requer correções antes do STEP 2
> **Prioridade**: 🔴 CRÍTICA

---

## Contexto

A auditoria do STEP 1 verificou a estrutura de cadastros e regras do ERP Orbe. O sistema possui toda a estrutura necessária, mas apresenta **falhas críticas de isolamento multi-tenant** que devem ser corrigidas antes de avançado para próximas etapas.

---

## 🔴 CRÍTICO: Vazamento de Dados Entre Tenants

### Tabelas Afetadas

| Tabela | Policy Atual | Risco |
|--------|-------------|-------|
| `transportadoras_clientes` | `FOR SELECT USING (true)` | **ACESSO IRRESTRITO** - qualquer usuário vê todas as transportadoras de todos os tenants |
| `fornecedores` | `FOR SELECT USING (true)` | **ACESSO IRRESTRITO** - qualquer usuário vê todos os fornecedores de todos os tenants |
| `tipos_servico_operacional` | Sem RLS explícita | **ACESSO ABERTO** |
| `formas_pagamento_operacional` | Sem RLS explícita | **ACESSO ABERTO** |
| `regras_financeiras` | `FOR ALL TO authenticated USING (true)` | **ACESSO IRRESTRITO** |
| `fornecedor_valores_servico` | `FOR SELECT USING (true)` | **ACESSO ABERTO** |

### Ação Required - Aplicar ASAP

Execute os seguintes commands no Supabase SQL Editor:

```sql
-- ============================================================
-- 1. CORRIGIR RLS transportadoras_clientes (CRÍTICO)
-- ============================================================

-- Drop policy antiga aberta
DROP POLICY IF EXISTS "Acesso leitura autenticado transportadoras_clientes" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "Allow delete transportadoras_clientes" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "Allow update transportadoras_clientes" ON public.transportadoras_clientes;

-- Criar nova policy com isolamento por tenant
CREATE POLICY "tc_tenant_isolation_select" ON public.transportadoras_clientes
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "tc_tenant_isolation_insert" ON public.transportadoras_clientes
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "tc_tenant_isolation_update" ON public.transportadoras_clientes
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "tc_tenant_isolation_delete" ON public.transportadoras_clientes
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

-- ============================================================
-- 2. CORRIGIR RLS fornecedores
-- ============================================================

-- Drop policies antigas abertas
DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow delete fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow update fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedores" ON public.fornecedores;

-- Criar novas policies com isolamento por tenant
CREATE POLICY "fornecedor_tenant_isolation_select" ON public.fornecedores
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "fornecedor_tenant_isolation_insert" ON public.fornecedores
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "fornecedor_tenant_isolation_update" ON public.fornecedores
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "fornecedor_tenant_isolation_delete" ON public.fornecedores
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR auth.current_tenant_id() IS NULL
  );

-- ============================================================
-- 3. CORRIGIR RLS regras_financeiras
-- ============================================================

-- Drop policy aberta
DROP POLICY IF EXISTS "regras_financeiras_all_authenticated" ON public.regras_financeiras;

-- Criar nova policy permitindo regras globais (empresa_id IS NULL)
CREATE POLICY "rf_tenant_isolation" ON public.regras_financeiras
  FOR ALL TO authenticated USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR empresa_id IS NULL  -- permite regras globais do sistema
    OR auth.current_tenant_id() IS NULL
  );

-- ============================================================
-- 4. CORRIGIR RLS fornecedor_valores_servico
-- ============================================================

-- Drop policy aberta
DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso update Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;

-- Criar novas policies com isolamento por tenant
CREATE POLICY "fvs_tenant_isolation_select" ON public.fornecedor_valores_servico
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR empresa_id IS NULL  -- permite regras globais
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "fvs_tenant_isolation_insert" ON public.fornecedor_valores_servico
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR empresa_id IS NULL
    OR auth.current_tenant_id() IS NULL
  );

CREATE POLICY "fvs_tenant_isolation_update" ON public.fornecedor_valores_servico
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
    OR empresa_id IS NULL
    OR auth.current_tenant_id() IS NULL
  );

-- ============================================================
-- 5. CORRIGIR RLS tipos_servico_operacional
-- ============================================================

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.tipos_servico_operacional ENABLE ROW LEVEL SECURITY;

-- Criar policy de isolamento (tabela global, mas com RLS para futuro isolamento)
CREATE POLICY "tso_tenant_isolation" ON public.tipos_servico_operacional
  FOR ALL TO authenticated USING (true);

-- ============================================================
-- 6. CORRIGIR RLS formas_pagamento_operacional
-- ============================================================

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY;

-- Criar policy de isolamento (tabela global)
CREATE POLICY "fpo_tenant_isolation" ON public.formas_pagamento_operacional
  FOR ALL TO authenticated USING (true);

-- ============================================================
-- 7. CORRIGIR ponto table reference (empresa → empresas)
-- ============================================================

-- Primeiro verificar se a constraint existe com nome diferente
DO $$
BEGIN
  -- Tenta remover constraint com nome incorreto se existir
  ALTER TABLE ponto DROP CONSTRAINT IF EXISTS ponto_empresa_id_fkey;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Adicionar constraint correta
ALTER TABLE ponto ADD CONSTRAINT ponto_empresa_id_fkey 
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

-- ============================================================
-- 8. REMOVER FALLBACKS INSECURAS
-- ============================================================

-- As policies com fallback "auth.current_tenant_id() IS NULL" devem ser removidas após verificação
-- Manter apenas se necessário para modo demo/desenvolvimento
-- Recomendação: remover após estabilização
```

---

## 🟠 MÉDIO: Inconsistências de Schema

### Problema: Reference Incorreta na Tabela ponto

**Archivo**: `supabase/migrations/20260430220000_create_ponto_table.sql:7`

```sql
-- Erro (referencia 'empresa' singular que não existe):
empresa_id uuid REFERENCES public.empresa(id) ON DELETE CASCADE,

-- Correção (referencia 'empresas' plural):
empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
```

### Ação

```sql
-- Verificar e corrigir referência
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'ponto' 
  AND constraint_type = 'FOREIGN KEY';

-- Se existir referência incorreta, corrigir:
ALTER TABLE ponto DROP CONSTRAINT IF EXISTS ponto_empresa_id_fkey;
ALTER TABLE ponto ADD CONSTRAINT ponto_empresa_id_fkey 
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
```

---

## 🟢 MELHORIA: Reforçar Isolamento

### Adicionar Trigger para Popular tenant_id automaticente

```sql
-- Função para obter tenant_id da empresa automaticamente
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.empresa_id IS NOT NULL THEN
    NEW.tenant_id := (
      SELECT tenant_id 
      FROM empresas 
      WHERE id = NEW.empresa_id 
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em tabelas com both empresa_id and tenant_id
-- Exemplo para transportadoras_clientes
CREATE TRIGGER trigger_auto_tenant_tc
  BEFORE INSERT ON transportadoras_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

-- Repetir para outras tabelas conforme necessário
```

---

## 📋 Checklist de Verificação

Após aplicar as correções:

- [ ] Testar login de usuário de Tenant A
- [ ] Verificar que visualize apenas empresas/transportadoras/fornecedores do Tenant A
- [ ] Testar login de usuário de Tenant B
- [ ] Verificar que visualize apenas empresas/transportadoras/fornecedores do Tenant B
- [ ] Verificar que dados não vazam entre tenants
- [ ] Testar criação de nova transportadora/fornecedor em cada tenant
- [ ] Validar que ponto table não apresentam erros de FK

---

## 📌 Próximos Passos

1. **Aplicar correções SQL** acima no Supabase
2. **Realizar testes de isolamento** com múltiplos tenants
3. **Re-auditar** após correções
4. **Avançar para STEP 2** apenas após aprovação

---

*Documento gerado automaticamente pela auditoria STEP 1 do ERP Orbe*