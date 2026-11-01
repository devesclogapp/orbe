# ERP ORBE — FIX CEX-01
# GATE 5.13 — RELATÓRIO DE AUDITORIA DE ELEGIBILIDADE FINANCEIRA

**Data:** 22/10/2026  
**Ambiente:** Homologação Local (`http://localhost:8080`) / Supabase Oficial (`lifgjtcflzmspilhryap.supabase.co`)  
**Status do GATE 5.13:** CONCLUÍDO (READ-ONLY)  
**Objeto Auditado:** Registro sintético de Custo Extra `faa91987-3ce7-429c-a547-5d9aeaed11f6` (R$ 55,00, out/2026, Empresa Teste - Homologação)  

---

## 1. RESUMO EXECUTIVO

Durante a homologação funcional do ciclo de devolução (GATE 5.7 / GATE 5.8 / GATE 5.9), o registro sintético de Custo Extra `faa91987-3ce7-429c-a547-5d9aeaed11f6` foi devolvido com sucesso pela RPC `rpc_custo_extra_transicionar`, assumindo no banco o estado canônico:
- `pipeline_status = 'RECEBIDO'`
- `status_pagamento = 'A_PAGAR'`
- `justificativa_devolucao = 'HML FIX CEX-01 — Devolucao para validacao do fluxo de aprovacao'`

Entretanto, na tela `/financeiro/despesas`, observou-se que o lançamento:
1. Permaneceu visível na aba **Aguardando Liberação** (4 registros em vez de 3).
2. Permaneceu somado no KPI **A Pagar** (elevando o total de R$ 845,00 para R$ 900,00).
3. Apresentou o botão **"Liberar para Pagamento"** disponível no Drawer Financeiro.

A presente auditoria investigou minuciosamente toda a cadeia (Telas, Services, Normalização, Mapeamento, DRE e RPCs de Backend).

### Conclusão Principal:
- **Origem do Problema:** Bug puramente de **apresentação e mapeamento de frontend** no serviço [despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts#L356-L358).
- **Segurança do Backend:** **FAIL-CLOSED E 100% BLINDADO**. Se o usuário clicar no botão "Liberar para Pagamento", o backend rejeita a transação via exceção PostgreSQL imediata (`Estado atual (RECEBIDO) não permite acao de enviar_financeiro. Registro deve estar em APROVADO_OPERACAO`), impedindo qualquer liberação indevida.
- **Impacto na DRE:** **ZERO**. O serviço de DRE filtra estritamente por `['APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO']`. O registro em `RECEBIDO` **não** é contabilizado na DRE (base histórica de R$ 995,00 intacta).

---

## 2. ETAPA 1 — RASTREIO DA ORIGEM DOS DADOS

### 2.1 Qual consulta alimenta a listagem financeira?
A listagem de Despesas do ERP é orquestrada pela função `fetchDespesasFederadas` em [src/services/despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts#L142-L233).
Para o domínio de Custos Extras, ela invoca:
```typescript
// despesasOficial.service.ts: linha 190
const custosExtrasRaw = await CustoExtraOperacionalService.getByCompetencia(competencia, empresaId);
```
Em [src/services/despesas.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesas.service.ts#L189-L195):
```typescript
async getByCompetencia(competencia: string, empresaId?: string) {
  // Converte competência YYYY-MM em intervalo de datas
  const { data, error } = await supabase
    .from('custos_extras')
    .select('*, fornecedores(*)')
    .gte('data', startDate)
    .lte('data', endDate)
    .order('data', { ascending: false });
  // Retorna todos os custos extras da competência sem filtrar pipeline_status
}
```
A query busca **todos** os custos extras do mês, transferindo a responsabilidade de classificação para o normalizador da camada de serviço.

---

### 2.2 Qual regra classifica "Aguardando Liberação"? (CAUSA RAIZ)
Após buscar os dados, `fetchDespesasFederadas` passa cada registro por `normalizarCustoExtra(c)` ([src/services/despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts#L339-L397)):

```typescript
// despesasOficial.service.ts: linhas 353-366
if (pStatus === "PAGO") {
  situacao = "PAGO";
} else if (pStatus === "CANCELADO") {
  situacao = "CANCELADO";
} else if (sStatus === "APROVADO_OPERACAO" || sStatus === "EM_VALIDACAO" || sStatus === "RECEBIDO") {
  situacao = "AGUARDANDO_LIBERACAO"; // <--- CAUSA RAIZ AQUI!
} else if (sStatus === "ENVIADO_FINANCEIRO") {
  situacao = "A_PAGAR";
} else if (sStatus === "FINALIZADO") {
  situacao = pStatus === "PAGO" ? "PAGO" : "PRONTA_BANCO";
} else {
  situacao = "A_PAGAR";
}
```

#### Análise da Causa Raiz:
- A linha 356 agrupa `APROVADO_OPERACAO`, `EM_VALIDACAO` e `RECEBIDO` sob a situação `"AGUARDANDO_LIBERACAO"`.
- Conceitualmente no ERP ORBE:
  - `RECEBIDO` é um registro recém-criado pelo encarregado ou **devolvido** pela operação/RH. Ele pertence ao **domínio operacional / aprovação RH**, e **não** é uma obrigação financeira liberável.
  - Ao mapear `RECEBIDO` para `AGUARDANDO_LIBERACAO`, o frontend assume que a despesa já passou pelo crivo operacional e está pronta para o financeiro dar o aceite ("Liberar para Pagamento"), o que viola o ciclo de vida.

---

### 2.3 Qual regra compõe o KPI "A Pagar"?
Em [src/services/despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts#L261-L285), a função `calculateDespesasKpiStats`:
```typescript
// despesasOficial.service.ts: linhas 271-274
if (sit === "AGUARDANDO_LIBERACAO" || sit === "A_PAGAR" || sit === "PRONTA_BANCO") {
  aPagar += val;
  qtdAPagar += 1;
}
```
Como o registro em `RECEBIDO` recebeu `situacao = "AGUARDANDO_LIBERACAO"`, ele é automaticamente somado no montante `aPagar`:
- Base homologada real: R$ 845,00 (3 registros `ENVIADO_FINANCEIRO` / `A_PAGAR`).
- Registro sintético devolvido: R$ 55,00 (`RECEBIDO`).
- Total exibido: R$ 845,00 + R$ 55,00 = **R$ 900,00** (e 4 obrigações em vez de 3).

---

### 2.4 Qual regra controla a exibição do botão "Liberar para Pagamento"?
No drawer financeiro [src/pages/Financeiro/components/DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx#L630-L651):
```tsx
{/* Linhas 630-651 */}
{despesa.situacao === "AGUARDANDO_LIBERACAO" && onLiberar && (
  <Button
    size="sm"
    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-sm"
    onClick={handleLiberar}
    disabled={isSubmitting}
  >
    <CheckCircle2 className="w-3.5 h-3.5" />
    Liberar para Pagamento
  </Button>
)}
```
O botão é renderizado exclusivamente baseado na propriedade calculada `despesa.situacao === "AGUARDANDO_LIBERACAO"`.

---

## 3. ETAPA 2 — AUDITORIA DE SEGURANÇA DA TRANSIÇÃO (BACKEND)

### 3.1 O que acontece ao clicar em "Liberar para Pagamento"?
1. No drawer [DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx#L162), `handleLiberar` chama o callback `onLiberar(despesa)`.
2. Em [CentralFinanceira.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/CentralFinanceira.tsx#L327-L345), `onLiberar` dispara a mutation `liberarCustoMutation.mutate({ id: item.id })`.
3. Essa mutation chama `CustoExtraOperacionalService.transicionar(id, 'enviar_financeiro', ...)`.
4. A service invoca a RPC PostgreSQL canônica: `supabase.rpc('rpc_custo_extra_transicionar', { p_id, p_acao: 'enviar_financeiro' })`.

### 3.2 O backend permite liberar um Custo Extra com `pipeline_status = 'RECEBIDO'`?
Inspecionando a migration oficial que criou a RPC [supabase/migrations/20260408220000_fase04_rpc_custos_extras.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260408220000_fase04_rpc_custos_extras.sql#L267-L269):
```sql
ELSIF p_acao = 'enviar_financeiro' THEN
    IF v_registro.pipeline_status != 'APROVADO_OPERACAO' THEN
        RAISE EXCEPTION 'Estado atual (%) não permite acao de enviar_financeiro. Registro deve estar em APROVADO_OPERACAO.', v_registro.pipeline_status;
    END IF;
```

### 3.3 Classificação de Risco:
| Categoria | Classificação | Justificativa |
| :--- | :--- | :--- |
| **Apresentação** | 🔴 Inconsistente | Exibe registro operacional na fila de obrigações financeiras |
| **Cálculo Financeiro** | 🔴 Inconsistente | Superestima o KPI "A Pagar" em R$ 55,00 no frontend |
| **Elegibilidade na Interface** | 🔴 Incorreta | Exibe botão "Liberar para Pagamento" que está fadado a falhar |
| **Segurança no Backend** | 🟢 **BLINDADO (Fail-Closed)** | O banco rejeita categoricamente com `RAISE EXCEPTION`. Nenhuma alteração financeira indevida é permitida no banco |

---

## 4. ETAPA 3 — VERIFICAÇÃO DE IMPACTO NA DRE

### 4.1 Regra de Inclusão na DRE
Em [src/services/dashboard.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/dashboard.service.ts#L250-L263):
```typescript
export const CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE: readonly CustoExtraPipelineStatus[] = [
  'APROVADO_OPERACAO',
  'ENVIADO_FINANCEIRO',
  'FINALIZADO',
] as const;
```
A função que calcula a DRE operacional filtra:
```typescript
.in('pipeline_status', CUSTOS_EXTRAS_PIPELINE_STATUS_RECONHECIDOS_DRE as unknown as string[])
```

### 4.2 Verificação Empírica no Supabase Oficial (Outubro/2026)
Executada query de auditoria contra a base oficial:
```sql
SELECT 
  id, 
  valor, 
  pipeline_status, 
  status_pagamento,
  (pipeline_status = ANY(ARRAY['APROVADO_OPERACAO','ENVIADO_FINANCEIRO','FINALIZADO'])) AS entra_na_dre
FROM custos_extras 
WHERE data BETWEEN '2026-10-01' AND '2026-10-31';
```

**Resultado:**
- 4 Registros Homologados:
  - `...0190`: R$ 220,00 (`ENVIADO_FINANCEIRO`) ➔ `DRE: true`
  - `...d391`: R$ 350,00 (`ENVIADO_FINANCEIRO`) ➔ `DRE: true`
  - `...cbe1`: R$ 275,00 (`ENVIADO_FINANCEIRO`) ➔ `DRE: true`
  - `...2954`: R$ 150,00 (`FINALIZADO`) ➔ `DRE: true`
  - **Total DRE Homologado = R$ 995,00**
- 1 Registro Sintético Devolvido:
  - `faa91987-...`: R$ 55,00 (`RECEBIDO`) ➔ **`DRE: false`**

**Conclusão da DRE:**
A DRE está **100% protegida**. O registro devolvido `RECEBIDO` não compõe a DRE e os R$ 995,00 homologados estão preservados.

---

## 5. DISTINÇÃO CONCEITUAL: POR QUE OCORREU O PROBLEMA?

A arquitetura do ERP ORBE possui 3 camadas de ciclo de vida para despesas:

```text
[Operação / Encarregado]       [Aprovação RH / Operação]         [Financeiro / Contas a Pagar]
      RECEBIDO             ➔        APROVADO_OPERACAO         ➔        ENVIADO_FINANCEIRO
 (Em edição ou Devolvido)          (Aguardando Liberação)                 (A Pagar)
```

No módulo de **Diaristas** e **Fechamentos CLT**, o Financeiro só enxerga o lote **depois** que o RH aprova (quando nasce o lote financeiro).  
No módulo de **Custos Extras**, o endpoint `getByCompetencia` retorna todos os registros da tabela `custos_extras`, e o frontend em [despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts#L356) incorretamente incluiu `sStatus === "RECEBIDO"` na condição de `AGUARDANDO_LIBERACAO`.

---

## 6. PROPOSTA MÍNIMA DE CORREÇÃO (PLANO CIRÚRGICO)

A correção exige apenas **uma alteração pontual no frontend**, alinhando o mapeamento de situações ao contrato de negócio.

### 6.1 Correção no Mapeamento (`normalizarCustoExtra`)
Arquivo: [src/services/despesasOficial.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/despesasOficial.service.ts#L356-L358)

**Código Atual:**
```typescript
} else if (sStatus === "APROVADO_OPERACAO" || sStatus === "EM_VALIDACAO" || sStatus === "RECEBIDO") {
  situacao = "AGUARDANDO_LIBERACAO";
}
```

**Correção Proposta:**
```typescript
} else if (sStatus === "APROVADO_OPERACAO") {
  situacao = "AGUARDANDO_LIBERACAO";
} else if (sStatus === "RECEBIDO" || sStatus === "EM_VALIDACAO") {
  situacao = "PENDENTE"; // Ou tratado como status operacional não-financeiro
}
```

### 6.2 Filtro na Federação de Despesas Financeiras
Para despesas financeiras em `fetchDespesasFederadas`:
- Registros em `pipeline_status === 'RECEBIDO'` ou `'EM_VALIDACAO'` estão sob custódia operacional/RH (estão na Central de Aprovações RH).
- Eles **não devem ser listados** na visão executiva de Contas a Pagar (da mesma forma que um apontamento de Diarista não fechado não aparece no Contas a Pagar).
- Ao filtrar para que somente registros com `pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')` componham a federação de despesas financeiras:
  1. A listagem de "Aguardando Liberação" volta a ter exatamente os 3 registros homologados.
  2. O KPI "A Pagar" retorna imediatamente para **R$ 845,00**.
  3. O botão "Liberar para Pagamento" desaparece para itens devolvidos.
  4. O item devolvido continua 100% visível na tela de Custos Extras da Operação e na Central de Aprovações RH (com status `RECEBIDO` e justificativa exibida).

---

## 7. PLANO DE TESTES DE REGRESSÃO

1. **Teste Automatizado de Unidade / Integração:**
   - Adicionar caso de teste em `src/test/fix_cex_01_transicoes_custos_extras.test.ts` testando `normalizarCustoExtra` com `pipeline_status = 'RECEBIDO'` e `'EM_VALIDACAO'`.
   - Garantir que não recebam `AGUARDANDO_LIBERACAO` e não somem no KPI `calculateDespesasKpiStats`.
2. **Teste de Interface Local (`localhost:8080`):**
   - Acessar `/financeiro/despesas`:
     - Conferir KPI "A Pagar": R$ 845,00.
     - Conferir aba "Aguardando Liberação": 3 registros (excluindo o sintético `faa91987-...`).
   - Acessar `/operacional/custos-extras`:
     - O registro `faa91987-...` deve estar visível como `RECEBIDO`.
   - Acessar `/rh/aprovacoes`:
     - O registro deve estar disponível para o fluxo de reanálise operacional.
3. **Validação de Build e Tipagem:**
   - `npx vitest run` (26+ testes).
   - `npx tsc --noEmit`.
   - `npm run build`.

---

## 8. PARECER TÉCNICO GO / NO-GO

- **Segurança Operacional:** 🟢 **GO** (Backend já é Fail-Closed; não há risco de liberação financeira inadvertida no banco).
- **Diagnóstico da Causa Raiz:** 🟢 **GO** (Identificada exatamente na linha 356 de `despesasOficial.service.ts`).
- **Impacto em Dados Homologados:** 🟢 **ZERO** (R$ 995,00 de DRE e R$ 845,00 de despesas preservados).
- **Prontidão para Implementação:** 🟡 **AGUARDANDO AUTORIZAÇÃO** (Conforme restrições estritas do GATE 5.13).
