# FICHA TÉCNICA — FIX-DASH-02-SQL-01
## Correção da Consulta SQL de Receitas Operacionais (Coluna Inexistente)

---

### 1. IDENTIFICAÇÃO E METADADOS

- **Identificador Único:** `FIX-DASH-02-SQL-01`
- **Título:** Correção da Coluna Inexistente `receitas_operacionais.data_operacao`
- **Módulo:** Dashboard Executivo / Reconciliação Financeira
- **Serviço Central:** `src/services/dashboardReconciliacaoSemanal.service.ts`
- **Origem da Demanda:** Homologação funcional da Etapa 2.1 em produção/homologação de Setembro/2026.
- **Data de Conclusão Técnica:** 10/11/2026
- **Status Funcional:** **HOMOLOGADO** (Ambiente local, suite de testes Vitest aprovada)
- **Status Git:** **NÃO COMMITADO** (Integrado no arquivo `src/services/dashboardReconciliacaoSemanal.service.ts`)
- **Status de Deploy:** **NÃO PUBLICADO** (Retido em workspace local)

---

### 2. CONTEXTO E DIAGNÓSTICO DO PROBLEMA

Durante a execução da auditoria funcional em banco real para a competência de setembro/2026, o gráfico semanal do Dashboard Executivo interceptou e exibiu corretamente o estado de erro gerencial:
```text
[DashboardReconciliacao] Erro ao consultar receitas: column receitas_operacionais.data_operacao does not exist
```

**Causa Raiz Identificada:**
1. A tabela `public.receitas_operacionais` representa o cabeçalho/fatura consolidada de faturamento e possui apenas as colunas `id`, `tenant_id`, `empresa_id`, `competencia`, `valor_total`, `status`, `data_emissao`, `data_vencimento`, `created_at`, entre outras.
2. A coluna temporal `data_operacao` pertence à tabela `public.operacoes_producao`, que é referenciada nos itens filhos de receita (`receita_itens`).
3. O `SELECT` raiz do serviço solicitava indevidamente `receitas_operacionais(..., data_operacao)`, gerando erro de sintaxe SQL no PostgREST/Supabase.

---

### 3. SOLUÇÃO TÉCNICA IMPLEMENTADA

1. **Remoção da Referência Inexistente:**
   - O `SELECT` principal em `src/services/dashboardReconciliacaoSemanal.service.ts` foi retificado, removendo `data_operacao` da tabela raiz `receitas_operacionais`.
2. **Resolução de Datas Canônicas:**
   - A data operacional canônica é extraída diretamente dos itens filhos (`itens.operacoes_producao.data_operacao` ou `itens.servicos_extras_operacionais.data_execucao`).
   - Caso a receita não possua itens filhos (ou seja um registro avulso/migrado), aplica-se o fallback seguro e documentado para `data_emissao` ou `created_at`.
3. **Adição de Teste de Regressão Anti-Coluna:**
   - Criado teste automatizado no Vitest garantindo que a string da query montada pelo serviço nunca mais referencie `data_operacao` na entidade raiz.

---

### 4. ARQUIVOS ENVOLVIDOS

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `src/services/dashboardReconciliacaoSemanal.service.ts` | **Modificado** | Retificação do SELECT PostgREST e resolução segura da data |
| `src/test/conv01_dashboard_reconciliacao_semanal.test.ts` | **Modificado** | Teste de regressão específico para a query de receitas |

---

### 5. EVIDÊNCIAS DE HOMOLOGAÇÃO E TESTES

- **Testes Automatizados (Vitest):**
  - Teste de regressão SQL aprovado garantindo integridade das colunas.
  - Total de 25 testes unitários e de integração sintética aprovados sem regressões.
- **Auditoria de Tipos:**
  - `npm run type-check` aprovado com 0 erros.

---

### 6. PENDÊNCIAS E PRÓXIMOS PASSOS

- Validação em banco real integrada na esteira do **GATE 06**.

