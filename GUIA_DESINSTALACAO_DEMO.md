# Guia de Desinstalação — Recurso de Base Demo

Este documento detalha todos os pontos de contato do Gerador de Base Demo no sistema Orbe e os passos necessários para sua remoção definitiva quando o recurso não for mais necessário.

## 📋 Inventário de Implementação

O recurso foi concentrado estrategicamente para facilitar a limpeza:

### 1. Frontend (React)
- **Pasta**: `src/pages/Simulacao/` (contém `DemoPage.tsx`)
- **Serviço**: `DemoService` (dentro de `src/services/base.service.ts`)
- **Navegação**: Item `simItems` no arquivo `src/components/layout/Sidebar.tsx`
- **Rotas**: Rota `/simulacao/demo` no arquivo `src/App.tsx`

### 2. Backend (Supabase Edge Functions)
- **Funções**: `generate-demo-data` e `delete-demo-data`

### 3. Banco de Dados (PostgreSQL)
- **Campos Extras**: `is_teste`, `origem_dado` e `lote_id` nas tabelas `empresas`, `colaboradores`, `registros_ponto` e `operacoes`
- **Tabela**: `demo_lotes`

---

## 🚀 Passos para Desinstalação Definitiva

Siga esta ordem para garantir uma remoção limpa e sem erros:

### Passo 1: Limpeza dos Dados
Antes de remover o código, use a própria ferramenta para zerar o banco:
1. Acesse o **Gerador de Demo** no sistema.
2. Clique em **Excluir tudo**.

### Passo 2: Remoção no Frontend
1. **Exclua a Pasta**: `src/pages/Simulacao`
2. **Remova a Navegação**: No arquivo `Sidebar.tsx`, apague o array `simItems` e sua renderização.
3. **Limpe as Rotas**: No arquivo `App.tsx`, delete a linha da rota `/simulacao/demo`.
4. **Limpe o Serviço**: Remova a classe `DemoService` do arquivo `base.service.ts`.

### Passo 3: Remoção no Backend
Delete as funções via terminal ou painel do Supabase:
```bash
supabase functions delete generate-demo-data
supabase functions delete delete-demo-data
```

### Passo 4: Reversão no Banco de Dados (SQL)
Execute este script no SQL Editor do Supabase para remover colunas e tabelas temporárias:

```sql
-- 1. Remover tabela de lotes
DROP TABLE IF EXISTS public.demo_lotes CASCADE;

-- 2. Remover colunas de metadados das tabelas principais
ALTER TABLE public.empresas DROP COLUMN IF EXISTS is_teste, DROP COLUMN IF EXISTS origem_dado, DROP COLUMN IF EXISTS lote_id;
ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS is_teste, DROP COLUMN IF EXISTS origem_dado, DROP COLUMN IF EXISTS lote_id;
ALTER TABLE public.registros_ponto DROP COLUMN IF EXISTS is_teste, DROP COLUMN IF EXISTS origem_dado, DROP COLUMN IF EXISTS lote_id;
ALTER TABLE public.operacoes DROP COLUMN IF EXISTS is_teste, DROP COLUMN IF EXISTS origem_dado, DROP COLUMN IF EXISTS lote_id;
```

---

> [!CAUTION]
> **Aviso Importante**: Não reverta o ajuste de Primary Key no financeiro (`empresa_id` + `competencia`), pois essa alteração é uma melhoria estrutural permanente que permite ao ERP funcionar corretamente com múltiplas empresas reais no futuro.
