# ERP ORBE — FIX CEX-01
## GATE 3 — AUDITORIA PRÉ-MIGRATION
### Análise de Impacto, Segurança e Compatibilidade da Migration da View `public.vw_aprovacoes_rh`

**Data:** 21 de Outubro de 2026  
**Modo de Operação:** **READ-ONLY ESTRITO** (Nenhuma migration executada, nenhum dado alterado, nenhum DDL disparado)  
**Objeto Auditado:** `supabase/migrations/20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`  
**Status do Portão:** **GATE 3: PARADA OBRIGATÓRIA PARA AVALIAÇÃO TÉCNICA**  
**Parecer Técnico:** **GO HOMOLOGADO** (Migration 100% compatível, sem efeitos colaterais, pronta para aplicação supervisionada)

---

## 1. DEFINIÇÃO ATUAL VERSUS PROPOSTA

### 1.1 Definição Efetiva Ativa no Supabase Oficial
A view `public.vw_aprovacoes_rh` em operação no banco oficial foi provisionada pela migration `20261018130100_fix_dia_02_vw_aprovacoes_rh_diaristas_lotes.sql`.

No bloco referente a Custos Extras (bloco 3 da união):
```sql
    -- 3. CUSTOS EXTRAS (Definição Atual no Banco Oficial)
    SELECT 
        ce.id,
        'CUSTO EXTRA' AS tipo,
        'CE ' || substring(ce.id::text, 1, 6) AS referencia,
        COALESCE(ce.descricao, 'Custo Extra') AS colaborador,
        COALESCE(ce.categoria_custo, 'Custo operacional') AS descricao,
        COALESCE(e.nome, ce.empresa_nome, '—') AS empresa,
        COALESCE(ce.categoria_custo, '—') AS operacao,
        COALESCE(ce.total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(ce.data, 'YYYY-MM') AS competencia,
        ce.criado_em AS data_recebimento,
        ce.status_pagamento AS raw_status,                  -- << DEFEITO DE CONTRATO (status financeiro em vez de operacional)
        ce.empresa_id AS empresa_id,
        ce.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM custos_extras_operacionais ce
    LEFT JOIN empresas e ON e.id = ce.empresa_id
```

E no `SELECT` final com o cálculo de `situacao`:
```sql
    CASE
        WHEN upper(c.raw_status) IN (
            'EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 
            'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO'
        ) THEN 'Em análise'

        WHEN upper(c.raw_status) IN (
            'APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 
            'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 
            'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO'
        ) THEN 'Aprovado'

        WHEN upper(c.raw_status) IN (
            'DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO', 
            'RECUSADO', 'REPROVADO', 'DEVOLVIDO_RH'
        ) THEN 'Devolvido'

        ELSE 'Em análise'
    END AS situacao
```

### 1.2 Definição Proposta na Nova Migration (`20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`)
No bloco de Custos Extras:
```sql
    -- 3. CUSTOS EXTRAS (Definição Proposta)
    SELECT 
        ce.id,
        'CUSTO EXTRA' AS tipo,
        'CE ' || substring(ce.id::text, 1, 6) AS referencia,
        COALESCE(ce.descricao, 'Custo Extra') AS colaborador,
        COALESCE(ce.categoria_custo, 'Custo operacional') AS descricao,
        COALESCE(e.nome, ce.empresa_nome, '—') AS empresa,
        COALESCE(ce.categoria_custo, '—') AS operacao,
        COALESCE(ce.total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(ce.data, 'YYYY-MM') AS competencia,
        ce.criado_em AS data_recebimento,
        COALESCE(ce.pipeline_status, 'RECEBIDO') AS raw_status, -- << CORREÇÃO CANÔNICA (estado operacional do pipeline)
        ce.empresa_id AS empresa_id,
        ce.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM custos_extras_operacionais ce
    LEFT JOIN empresas e ON e.id = ce.empresa_id
    WHERE ce.deleted_at IS NULL                               -- << BLINDAGEM SOFT DELETE (padronizado com operacoes_producao)
```

E no `SELECT` final com o cálculo de `situacao`:
```sql
    CASE
        WHEN upper(c.raw_status) IN (
            'EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 
            'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO',
            'RECEBIDO'                                         -- << Adicionado explicitamente (estado inicial/devolvido)
        ) THEN 'Em análise'

        WHEN upper(c.raw_status) IN (
            'APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 
            'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 
            'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO',
            'ENVIADO_FINANCEIRO'                               -- << Adicionado explicitamente (estado já despachado ao financeiro)
        ) THEN 'Aprovado'

        WHEN upper(c.raw_status) IN (
            'DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO', 
            'RECUSADO', 'REPROVADO', 'DEVOLVIDO_RH'
        ) THEN 'Devolvido'

        ELSE 'Em análise'
    END AS situacao
```

---

## 2. DIFF SEMÂNTICO DETALHADO POR SEÇÃO

Foi executada análise semântica automatizada entre a migration em vigor (`20261018130100`) e a proposta (`20261021200000`):

| Seção da View | Situação Semântica | Modificações Identificadas |
| :--- | :--- | :--- |
| **1. Pontos CLT** | **100% IDÊNTICO** | Nenhuma alteração. Mesmos campos, joins e filtros. |
| **2. Operações por Volume** | **100% IDÊNTICO** | Nenhuma alteração. Mesmos campos, filtro `op.deleted_at IS NULL` e status de doca preservados. |
| **3. Custos Extras** | **ALTERAÇÃO PONTUAL** | 1. Substituição de `ce.status_pagamento` por `COALESCE(ce.pipeline_status, 'RECEBIDO') AS raw_status`.<br>2. Inclusão da cláusula `WHERE ce.deleted_at IS NULL`. |
| **4. Serviços Extras** | **100% IDÊNTICO** | Nenhuma alteração. Permanece projetando `se.pipeline_status AS raw_status`. |
| **5. Diaristas** | **100% IDÊNTICO** | Nenhuma alteração. Filtro restrito a lotes `AGUARDANDO_VALIDACAO_RH` e `VALIDADO_RH` preservado. |
| **6. Intermitentes** | **100% IDÊNTICO** | Nenhuma alteração. Lotes de fechamento de intermitentes preservados. |
| **7. Projeção `situacao`** | **EXTENSÃO SEGURA** | Adicionados `'RECEBIDO'` ao grupo `'Em análise'` e `'ENVIADO_FINANCEIRO'` ao grupo `'Aprovado'`. |
| **8. Governança e Permissões** | **100% IDÊNTICO** | `WITH (security_invoker = on)`, `REVOKE ALL FROM anon`, `GRANT SELECT TO authenticated`, `NOTIFY pgrst`. |

### Contrato de Colunas e Tipos (16 Colunas)
As 16 colunas projetadas mantêm ordem, tipos e nomenclaturas 100% inalterados:
1. `id` (`uuid`)
2. `tipo` (`text`)
3. `referencia` (`text`)
4. `colaborador` (`text`)
5. `descricao` (`text`)
6. `empresa` (`text`)
7. `operacao` (`text`)
8. `valor` (`numeric`)
9. `horas` (`text`)
10. `competencia` (`text`)
11. `data_recebimento` (`timestamptz`)
12. `raw_status` (`text`)
13. `empresa_id` (`uuid`)
14. `filter_data` (`date`)
15. `raw_lote_id` (`uuid`)
16. `situacao` (`text`)

---

## 3. EVIDÊNCIAS DAS CONSULTAS READ-ONLY NO BANCO OFICIAL

As consultas executadas no catálogo do Supabase oficial confirmaram os seguintes dados factuais:

### 3.1 Contagem Exata por Domínio na View Ativa
```
Tipo: [PONTO]           -> Fetched: 1000 | Total Exato: 3936  | Situações: Em análise (3920), Aprovado (16)
Tipo: [OPERAÇÃO]        -> Fetched: 11   | Total Exato: 11    | Situações: Aprovado (6), Em análise (5)
Tipo: [CUSTO EXTRA]     -> Fetched: 13   | Total Exato: 13    | Situações: Aprovado (10), Em análise (3)
Tipo: [SERVIÇO EXTRA]   -> Fetched: 8    | Total Exato: 8     | Situações: Aprovado (7), Em análise (1)
Tipo: [DIARISTA]        -> Fetched: 0    | Total Exato: 0     | Lote pago NSA 11 devidamente filtrado da fila RH
Tipo: [INTERMITENTE]    -> Fetched: 10   | Total Exato: 10    | Situações: Aprovado (6), Devolvido (3), Em análise (1)
```

### 3.2 Raio-X dos Custos Extras Atuais
Dos 13 registros históricos de Custos Extras existentes:
- **10 registros históricos** possuem `status_pagamento = 'PAGO'` ➔ aparecem como `'Aprovado'`.
- **3 registros de Outubro/2026** possuem `status_pagamento = 'A_PAGAR'` ➔ aparecem como `'Em análise'`, embora já tenham sido formalmente aprovados pela operação (`pipeline_status = 'APROVADO_OPERACAO'`).

---

## 4. IMPACTO ESPECÍFICO NOS QUATRO CUSTOS EXTRAS DE OUTUBRO/2026

Comparação dos 4 registros de Outubro de 2026:

| ID | Descrição | Valor | `pipeline_status` | `status_pagamento` | Situação Atual (Bug) | Situação Proposta | Efeito na Fila RH |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `f6c3685e...` | Manutenção de paleteira | R$ 380,00 | `APROVADO_OPERACAO` | `A_PAGAR` | `'Em análise'` (raw: `A_PAGAR`) | **`'Aprovado'`** (raw: `APROVADO_OPERACAO`) | **Sai da fila de pendências** |
| `c1aa8f36...` | Lanche equipe noturna | R$ 85,00 | `APROVADO_OPERACAO` | `A_PAGAR` | `'Em análise'` (raw: `A_PAGAR`) | **`'Aprovado'`** (raw: `APROVADO_OPERACAO`) | **Sai da fila de pendências** |
| `98c5defd...` | Manutenção de paleteira | R$ 380,00 | `APROVADO_OPERACAO` | `A_PAGAR` | `'Em análise'` (raw: `A_PAGAR`) | **`'Aprovado'`** (raw: `APROVADO_OPERACAO`) | **Sai da fila de pendências** |
| `1837369f...` | Gerador emergencial | R$ 150,00 | `FINALIZADO` | `PAGO` | `'Aprovado'` (raw: `PAGO`) | **`'Aprovado'`** (raw: `FINALIZADO`) | **Permanece Aprovado** |

### Preservação Financeira Rigorosa:
- **Valores financeiros:** Nenhum valor é alterado (R$ 380 + R$ 85 + R$ 380 + R$ 150 = R$ 995,00).
- **Contas a Pagar (`contas_pagar` / `status_pagamento = 'A_PAGAR'`):** As obrigações a pagar de **R$ 845,00** continuam 100% registradas e legítimas para pagamento financeiro. A view `vw_aprovacoes_rh` não interfere no motor de pagamentos.
- **DRE:** A DRE de Outubro/2026 permanece intocada em R$ 995,00 (R$ 150,00 pagos + R$ 845,00 provisionados).

---

## 5. IMPACTO NA TELA E INDICADORES DO RH (`AprovacoesRh.tsx`)

Inspecionando o código de [AprovacoesRh.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L280-L345):
```typescript
// 1. Aguardando Decisão
const pendentes = aprovacoesContextuais.filter(
  (i) => i.situacao !== "Aprovado" && i.situacao !== "Devolvido"
);
const aguardandoDecisao = pendentes.length;

// 4. Impacto Financeiro Pendente
const impactoFinanceiro = pendentes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

// Contadores por Domínio (Pílula CUSTO EXTRA)
CUSTO_EXTRA: pendentes.filter((i) => i.tipo === "CUSTO EXTRA").length,
```

### Comportamento Comprovado:
1. **Fila de Pendências:** Ao projetar `raw_status = 'APROVADO_OPERACAO'`, a view calcula `situacao = 'Aprovado'`. Com isso, `i.situacao !== "Aprovado"` resulta em `false`.
2. **Card "Aguardando Decisão":** O contador geral do RH reduzirá em 3 unidades.
3. **Pílula de Fila "Custo Extra":** O contador específico de custos pendentes em Outubro/2026 cairá de 3 para **0**.
4. **Card "Impacto Financeiro Pendente":** Reduzirá exatamente em **R$ 845,00**, zerando o valor retido indevidamente na fila de decisão do RH.
5. **Aba "Aprovados":** Os três registros passam a ser exibidos na aba de Aprovados/Histórico com status visual `"Aprovado"`.

---

## 6. ANÁLISE DO FILTRO DE EXCLUSÃO LÓGICA (`ce.deleted_at IS NULL`)

A inclusão da cláusula `WHERE ce.deleted_at IS NULL` no bloco de Custos Extras foi auditada detalhadamente:
- **Existência no Banco Oficial:** A coluna `deleted_at TIMESTAMPTZ DEFAULT NULL` existe fisicamente na tabela `public.custos_extras_operacionais` (criada pela migration `20260608200000_hardening_custos_extras.sql`).
- **Registros Atualmente Excluídos:** Foi executada a contagem no banco oficial:
  ```sql
  SELECT count(*) FROM public.custos_extras_operacionais WHERE deleted_at IS NOT NULL;
  ```
  **Resultado: 0 registros.**
- **Padronização Arquitetural:** O bloco 2 da view (`operacoes_producao`) já utiliza exatamente `WHERE op.deleted_at IS NULL`. A padronização em `custos_extras_operacionais` elimina uma brecha arquitetural, assegurando que exclusões lógicas operacionais nunca ressurjam indevidamente na fila do RH.
- **Conclusão:** A inclusão é 100% segura, não altera nenhum contador histórico e deve permanecer na migration.

---

## 7. REGRESSÃO DOS DEMAIS DOMÍNIOS OPERACIONAIS

Foi comprovado por comparação semântica e teste estático que os outros 5 domínios presentes na view não sofrem nenhuma alteração:
- **Pontos CLT:** Preservados integralmente os 3.936 registros (3.920 pendentes de processamento e 16 processados).
- **Operações por Volume:** Preservadas as 11 operações com o filtro estrito de doca (`AGUARDANDO_FATURAMENTO`, `FATURADO`, `RECEBIDO_FINANCEIRO`, `CONCLUIDO`).
- **Serviços Extras:** Preservados os 8 registros, mantendo `pipeline_status`.
- **Diaristas:** Preservado o modelo consolidado por lotes (`diaristas_lotes_fechamento`) filtrando exclusivamente `AGUARDANDO_VALIDACAO_RH` e `VALIDADO_RH`.
- **Intermitentes:** Preservados os 10 lotes de intermitentes.

---

## 8. ANÁLISE DE DEPENDÊNCIAS E SEGURANÇA DDL

1. **Dependências no Banco:**
   - Foi realizada busca exaustiva por objetos dependentes de `public.vw_aprovacoes_rh`.
   - **Zero views filhas** dependem de `vw_aprovacoes_rh`.
   - **Zero funções/triggers** dependem de `vw_aprovacoes_rh`.
2. **Compatibilidade do `CREATE OR REPLACE VIEW`:**
   - Como a lista de 16 colunas, seus nomes, ordem e tipos de dados são **rigorosamente idênticos**, o comando `CREATE OR REPLACE VIEW` executa sem conflito estrutural no PostgreSQL.
   - **Não há necessidade de `DROP VIEW ... CASCADE`.**
3. **Preservação de Permissões (SEC-01):**
   - A migration inclui explicitamente `WITH (security_invoker = on)`.
   - Inclui `REVOKE ALL ON public.vw_aprovacoes_rh FROM anon;`.
   - Inclui `GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;`.
   - Inclui `NOTIFY pgrst, 'reload schema';` para recarga imediata do PostgREST.
4. **Estratégia de Rollback Imediato:**
   - Em caso de qualquer anomalia inesperada, o rollback é 100% determinístico e idempotente: basta reexecutar `20261018130100_fix_dia_02_vw_aprovacoes_rh_diaristas_lotes.sql`, restaurando o estado anterior em milissegundos sem perda de dados.

---

## 9. MATRIZ DE RISCOS RESIDUAIS

| Risco Potencial | Severidade | Probabilidade | Mitigação Comprovada |
| :--- | :--- | :--- | :--- |
| Bloqueio ou Lock de Tabela | Nula | Nula | A instrução `CREATE OR REPLACE VIEW` não cria locks de escrita em tabelas transacionais. |
| Perda de Obrigações Financeiras | Nula | Nula | A view afeta apenas a fila de RH. A tabela `contas_pagar` e a coluna `status_pagamento` continuam intocadas. |
| Incompatibilidade de Cache Frontend | Baixa | Baixa | Inclusão de `NOTIFY pgrst, 'reload schema'` limpa a tipagem do PostgREST imediatamente. |
| Quebra de Tipagem TypeScript | Nula | Nula | O contrato de 16 colunas foi 100% mantido; `npx tsc --noEmit` aprovado com 0 erros. |

---

## 10. PARECER CONCLUSIVO — GATE 3

### Parecer Técnico: **GO HOMOLOGADO**

A migration `supabase/migrations/20261021200000_fix_cex_01_vw_aprovacoes_rh.sql`:
1. Resolve na causa-raiz o falso represamento dos 3 custos extras aprovados na fila do RH.
2. Mantém os R$ 845,00 legitimamente preservados em Contas a Pagar.
3. Não introduz nenhuma regressão nos outros 5 domínios operacionais.
4. Possui garantia de compatibilidade com o catálogo PostgreSQL (`CREATE OR REPLACE VIEW` sem `CASCADE`).
5. Mantém todas as políticas de segurança e contenção anônima (SEC-01).

---

## 🛑 PARADA OBRIGATÓRIA NO GATE 3

Em conformidade estrita com as restrições da ordem de serviço:
> **PARAR OBRIGATORIAMENTE NO GATE 3.**  
> Aguardar autorização expressa para qualquer alteração ou aplicação no banco oficial.

**Aguardando autorização expressa do usuário para aplicação supervisionada da migration no Supabase oficial e validação E2E final.**
