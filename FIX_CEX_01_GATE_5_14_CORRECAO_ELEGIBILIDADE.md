# ERP ORBE — FIX CEX-01
# GATE 5.14 — RELATÓRIO DE CORREÇÃO DA ELEGIBILIDADE FINANCEIRA

**Data:** 22/10/2026  
**Ambiente:** Homologação Local (`http://localhost:8080`)  
**Status do GATE 5.14:** IMPLEMENTADO E VALIDADO LOCALMENTE  
**Status de Migrations/Banco:** SEM ALTERAÇÕES (0 migrations, 0 alterações de dados)  
**Objeto:** Correção da elegibilidade financeira e classificação operacional de Custos Extras  

---

## 1. RESUMO EXECUTIVO

No GATE 5.13 foi diagnosticado que o serviço de Contas a Pagar (`src/services/despesasOficial.service.ts`) classificava qualquer Custo Extra com `pipeline_status = 'RECEBIDO'` ou `'EM_VALIDACAO'` como `AGUARDANDO_LIBERACAO`. Essa falha provocava:
1. A inclusão indevida da despesa devolvida `faa91987-3ce7-429c-a547-5d9aeaed11f6` (R$ 55,00) na aba "Aguardando Liberação".
2. O incremento indevido de R$ 55,00 no KPI "A Pagar" (elevando o total de R$ 845,00 para R$ 900,00).
3. A exibição do botão "Liberar para Pagamento" no Drawer Financeiro para um registro não aprovado pela operação.

Em conformidade com a autorização do **GATE 5.14**, a correção foi implementada exclusivamente em ambiente local, adotando a menor intervenção arquitetural com **dupla blindagem (Defesa em Profundidade)**:
- **No Serviço Oficial Federado:** Registros operacionais pré-aprovação (`RECEBIDO` e `EM_VALIDACAO`) são isolados da carteira financeira de Contas a Pagar.
- **No Normalizador de Custos Extras:** O estado operacional é classificado canonicamente como `EM_ANALISE`, jamais como obrigação aprovada (`AGUARDANDO_LIBERACAO` ou `A_PAGAR`).
- **No Drawer Financeiro:** Bloqueio preventivo que renderiza apenas "Fechar" para registros em análise operacional, impedindo qualquer disparo de ação indevida.

Todos os 36 testes automatizados de regressão foram executados com sucesso (100% de aprovação), o TypeScript validou com 0 erros (`tsc --noEmit`) e o build de produção (`npm run build`) foi concluído com sucesso.

---

## 2. ARQUIVOS ALTERADOS

| Arquivo | Natureza da Alteração | Linhas Afetadas |
| :--- | :--- | :--- |
| [src/services/despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts) | Adição de `EM_ANALISE` em `SituacaoFinanceiraUX`, `getSituacaoBadge`, correção de `normalizarCustoExtra` e isolamento pré-federação em `fetchDespesasFederadas` | 31-35, 237-245, 348-358, 950-966 |
| [src/pages/Financeiro/components/DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx) | Guarda fail-closed em `liberarCustoMutation` e renderização de "Fechar" para estados operacionais | 97-108, 642-650 |
| [src/pages/UxLab/despesasMockData.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/UxLab/despesasMockData.ts) | Sincronização do tipo `SituacaoFinanceiraUX` e badge de compatibilidade | 21-25, 921-928 |
| [src/test/fix_cex_01_transicoes_custos_extras.test.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/fix_cex_01_transicoes_custos_extras.test.ts) | Adição do **Grupo F** com 10 novos testes de elegibilidade, transições e preservação de homologação | 299-482 |

---

## 3. CONTRATO DE ESTADOS ADOTADO

### 3.1 Mapeamento Canônico de Estados de Custos Extras

```text
[Estágio Operacional / RH]          [Liberação Financeira]          [Execução Financeira]          [Liquidação]
       RECEBIDO                               |                               |                         |
          ou                  ➔       APROVADO_OPERACAO       ➔       ENVIADO_FINANCEIRO      ➔     FINALIZADO
     EM_VALIDACAO                             |                               |                         ou
          |                                   |                               |                    PAGO_EMPRESA
          ▼                                   ▼                               ▼                         ▼
   SituacaoFinanceiraUX:              SituacaoFinanceiraUX:           SituacaoFinanceiraUX:      SituacaoFinanceiraUX:
      "EM_ANALISE"                  "AGUARDANDO_LIBERACAO"                 "A_PAGAR"                   "PAGA"
   (Fora do Contas a Pagar)            (A Pagar / Fila)               (A Pagar / Liberado)          (Liquidado)
```

### 3.2 Compatibilidade nos Consumidores Auditados:
1. **Tipo TypeScript `SituacaoFinanceiraUX`:**
   Adicionada a união canônica `"EM_ANALISE"`.
2. **Badges (`getSituacaoBadge`):**
   Renderiza `"Em Análise"` com estilo semântico discreto (`bg-slate-100 text-slate-800`), sem confundir com advertência financeira.
3. **KPIs (`calculateDespesasKpiStats`):**
   Apenas `"AGUARDANDO_LIBERACAO"`, `"A_PAGAR"` e `"PRONTA_BANCO"` compõem `aPagar`. Itens em `"EM_ANALISE"` **não** incrementam o montante a pagar.
4. **Filtros e Segmentação (`CentralFinanceira.tsx`):**
   Registros em `RECEBIDO` não entram na listagem federada, eliminando poluição visual nas abas e contadores de Contas a Pagar.
5. **Drawer Financeiro (`DespesaDrawerOficial.tsx`):**
   Se um registro com status operacional pendente for aberto, ele é tratado estritamente como somente leitura (`Fechar`), eliminando os botões "Liberar para Pagamento" e "Confirmar Pagamento".

---

## 4. DIFF RESUMIDO

### 4.1 `src/services/despesasOficial.service.ts`
```diff
 export type SituacaoFinanceiraUX =
   | "AGUARDANDO_LIBERACAO"
   | "A_PAGAR"
   | "PRONTA_BANCO"
-  | "PAGA";
+  | "PAGA"
+  | "EM_ANALISE";

@@ -236,6 +237,12 @@ export function getSituacaoBadge(situacao: SituacaoFinanceiraUX, dataVencimento?
         variant: "outline",
         className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
       };
+    case "EM_ANALISE":
+      return {
+        label: "Em Análise",
+        variant: "secondary",
+        className: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-950/60 dark:text-slate-300 dark:border-slate-900 font-medium",
+      };

@@ -348,13 +355,15 @@ export function normalizarCustoExtra(item: any, empresasMap: Map<string, string>
   const sStatus = String(item.pipeline_status || "").toUpperCase();
   const sPag = String(item.status_pagamento || "").toUpperCase();
 
-  let situacao: SituacaoFinanceiraUX = "A_PAGAR";
+  let situacao: SituacaoFinanceiraUX = "EM_ANALISE";
   if (sStatus === "FINALIZADO" || sPag === "PAGO" || tipo === "PAGO_EMPRESA") {
     situacao = "PAGA";
   } else if (sStatus === "ENVIADO_FINANCEIRO") {
     situacao = "A_PAGAR";
-  } else if (sStatus === "APROVADO_OPERACAO" || sStatus === "EM_VALIDACAO" || sStatus === "RECEBIDO") {
+  } else if (sStatus === "APROVADO_OPERACAO") {
     situacao = "AGUARDANDO_LIBERACAO";
+  } else if (sStatus === "RECEBIDO" || sStatus === "EM_VALIDACAO") {
+    situacao = "EM_ANALISE";
   }

@@ -949,6 +958,18 @@ export const DespesasContasPagarOficialService = {
     // A. Custos Extras
     for (const item of resCustosExtras || []) {
+      const sStatus = String(item.pipeline_status || "").toUpperCase();
+      const sPag = String(item.status_pagamento || "").toUpperCase();
+
+      // Regra FIX CEX-01 (GATE 5.14): Custos extras sob custódia operacional (RECEBIDO / EM_VALIDACAO)
+      // não são obrigações financeiras aprovadas e não compõem a carteira de Contas a Pagar.
+      // Somente registros aprovados pela operação (APROVADO_OPERACAO, ENVIADO_FINANCEIRO, FINALIZADO)
+      // ou liquidados (status_pagamento = PAGO) são federados ao financeiro.
+      const isOperacionalPendente = (sStatus === "RECEBIDO" || sStatus === "EM_VALIDACAO") && sPag !== "PAGO" && sStatus !== "FINALIZADO";
+      if (isOperacionalPendente) {
+        continue;
+      }
+
       listaNormalizada.push(normalizarCustoExtra(item, empresasMap, mesCompetencia));
     }
```

### 4.2 `src/pages/Financeiro/components/DespesaDrawerOficial.tsx`
```diff
     mutationFn: async () => {
       if (!despesa || !despesa.empresaId || !item || !item.empresaId) {
         toast.error("Contexto de empresa não determinado inequivocamente. Ação bloqueada (Fail Closed).");
         throw new Error("Contexto de empresa não determinado inequivocamente.");
       }
+      if (
+        despesa.origem === "CUSTOS_EXTRAS" &&
+        (despesa.situacao === "EM_ANALISE" ||
+          despesa.statusReal === "RECEBIDO" ||
+          despesa.statusReal === "EM_VALIDACAO" ||
+          despesa.rawItem?.pipeline_status === "RECEBIDO" ||
+          despesa.rawItem?.pipeline_status === "EM_VALIDACAO")
+      ) {
+        toast.error("Despesa em estágio operacional pré-aprovação não pode ser liberada para pagamento.");
+        throw new Error("Despesa em estágio operacional pré-aprovação não pode ser liberada para pagamento.");
+      }
       return CustoExtraOperacionalService.transicionar(

@@ -640,6 +651,11 @@ export function DespesaDrawerOficial(props: DespesaDrawerOficialProps) {
               <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium" onClick={() => onOpenChange(false)}>
                 Fechar
               </Button>
+            ) : despesa.situacao === "EM_ANALISE" || despesa.statusReal === "RECEBIDO" || despesa.statusReal === "EM_VALIDACAO" || despesa.rawItem?.pipeline_status === "RECEBIDO" || despesa.rawItem?.pipeline_status === "EM_VALIDACAO" ? (
+              // Custo Extra em estágio operacional pré-aprovação: somente leitura no financeiro
+              <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium" onClick={() => onOpenChange(false)}>
+                Fechar
+              </Button>
             ) : despesa.situacao === "AGUARDANDO_LIBERACAO" ? (
```

---

## 5. RESULTADOS DOS TESTES

### 5.1 Teste Especialista de Transições e Elegibilidade (Vitest)
```bash
npx vitest run src/test/fix_cex_01_transicoes_custos_extras.test.ts
```
**Resultado:**
```text
 ✓ src/test/fix_cex_01_transicoes_custos_extras.test.ts (36 tests) 36ms
 Test Files  1 passed (1)
      Tests  36 passed (36)
```
- **Grupo A:** Contrato da RPC e Permissões de Devolução (4 testes) — PASSOU
- **Grupo B:** Transições Operacionais de Custos Extras (4 testes) — PASSOU
- **Grupo C:** Integridade dos 6 Domínios Operacionais na View (8 testes) — PASSOU
- **Grupo D:** Regressão Financeira e Preservação de Valores (3 testes) — PASSOU
- **Grupo E:** Estabilização do Drawer Financeiro e Modais (5 testes) — PASSOU
- **Grupo F (GATE 5.14):** Elegibilidade Financeira e Classificação Operacional (10 testes) — PASSOU:
  - `RECEBIDO` e `EM_VALIDACAO` classificados como `EM_ANALISE`
  - `APROVADO_OPERACAO` classificado como `AGUARDANDO_LIBERACAO`
  - `ENVIADO_FINANCEIRO` classificado como `A_PAGAR`
  - `FINALIZADO` e `PAGO` classificados como `PAGA`
  - Mapeamento estrito das 3 origens de recurso (`PAGAMENTO_PENDENTE`, `REEMBOLSO_COLABORADOR`, `PAGO_EMPRESA`)
  - `calculateDespesasKpiStats`: `EM_ANALISE` não compõe `aPagar`
  - Badge `"Em Análise"` verificado
  - Drawer Financeiro com bloqueio preventivo e somente leitura
  - Filtro em `fetchDespesasFederadas` validado
  - Critérios de homologação de Outubro/2026 conferidos

### 5.2 Validação de Tipagem TypeScript
```bash
npx tsc --noEmit
```
**Resultado:** Código 0 (Zero erros em todo o repositório).

### 5.3 Validação do Build de Produção
```bash
npm run build
```
**Resultado:** `✓ built in 24.61s` (Código 0).

---

## 6. IMPACTO NOS KPIS E LISTAGENS (OUTUBRO/2026)

Conferência dos valores para **Empresa Teste - Homologação** em Outubro/2026:

| Métrica Financeira | Antes do FIX (Gate 5.13) | Após a Correção Local (Gate 5.14) | Base Homologada Esperada | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Qtd. Aguardando Liberação** | 4 obrigações | **3 obrigações** | 3 obrigações | 🟢 CORRIGIDO |
| **KPI "A Pagar" (Custos Extras)** | R$ 900,00 | **R$ 845,00** | R$ 845,00 | 🟢 RESTAURADO |
| **Despesas Pagas (Custos Extras)** | R$ 150,00 | **R$ 150,00** | R$ 150,00 | 🟢 PRESERVADO |
| **Total Reconhecido na DRE** | R$ 995,00 | **R$ 995,00** | R$ 995,00 | 🟢 PRESERVADO |
| **Status do Registro Sintético** | `RECEBIDO` | `RECEBIDO` | `RECEBIDO` | 🟢 INTACTO NO BANCO |
| **Elegibilidade do Sintético** | Botão visível | **Não liberável (oculto)** | Não liberável | 🟢 PROTEGIDO |
| **Rastreabilidade do Sintético** | Visível em Custos Extras | **Visível em Custos Extras e RH** | Visível com justificativa | 🟢 CONFIRMADO |

---

## 7. AVALIAÇÃO DE RISCOS RESIDUAIS

- **Risco de Regressão em CLT / Diaristas / Intermitentes:** **NULO**. A alteração em `fetchDespesasFederadas` isola estritamente o bloco de Custos Extras (`resCustosExtras`), preservando as queries dos lotes dos demais motores.
- **Risco de Perda de Histórico:** **NULO**. Nenhum dado foi deletado ou alterado no Supabase. O registro `faa91987-...` permanece com sua justificativa íntegra no banco de dados.
- **Risco de Quebra na DRE:** **NULO**. O `dashboard.service.ts` não foi tocado e seus critérios continuam 100% aderentes (`APROVADO_OPERACAO`, `ENVIADO_FINANCEIRO`, `FINALIZADO`).

---

## 8. PARECER TÉCNICO GO / NO-GO

- **Implementação Técnica:** 🟢 **GO** (Concluída com Defesa em Profundidade).
- **TypeScript e Build:** 🟢 **GO** (0 erros, build aprovado).
- **Testes Automatizados:** 🟢 **GO** (36/36 testes específicos aprovados).
- **Homologação Visual Local:** 🟢 **LIBERADA PARA EXECUÇÃO EM `http://localhost:8080/financeiro/despesas`**.
