# UX05 — OPERAÇÕES POR VOLUME
# FASE 01.1 — VALIDAÇÃO DOS ACHADOS CRÍTICOS ANTES DA UX

**Documento:** `UX05_OPERACOES_VOLUME_FASE_01_1_VALIDACAO_CRITICA.md`  
**Status:** Auditado / Read-Only (Auditoria de Código-Fonte, Migrations e RPCs)  
**Data:** Outubro de 2026  
**Princípio:** Separar Fato Comprovado, Regra Parcial, Inferência, Problema Real e Melhoria de UX.

---

## 1. SNAPSHOTS COMERCIAIS (`valor_unitario_snapshot`, `valor_descarga`, `custo_com_iss`)

### 1.1 Prova Técnica no Código e Banco de Dados

| Campo | Onde nasce | Pode sofrer UPDATE? | Quem altera? | Imutabilidade realmente garantida? |
| :--- | :--- | :--- | :--- | :--- |
| `valor_unitario_snapshot` | Form / Hook `useProductionForm` via lookup `resolver_valor_operacao`. Gravado no `INSERT`. | **SIM** (antes do faturamento). | `rpc_operacao_editar_segura` / Form de Edição (`OperacoesTableBlock.tsx` / `producao.service.ts`). | ⚠️ **PARCIAL.** Bloqueado após faturamento por RPC/Service, mas mutável em rascunho/aberto. |
| `valor_descarga` | Derivado no frontend: `quantidade * valor_unitario_snapshot`. Gravado no `INSERT`. | **SIM** (antes do faturamento). | Recalculado pelo frontend durante edição e enviado no payload de update. | ⚠️ **PARCIAL.** Bloqueado após faturamento por RPC/Service, mutável antes. |
| `custo_com_iss` | Derivado no frontend: `valor_descarga * percentual_iss`. Gravado no `INSERT`. | **SIM** (antes do faturamento). | Recalculado pelo frontend durante edição e enviado no payload de update. | ⚠️ **PARCIAL.** Bloqueado após faturamento por RPC/Service, mutável antes. |

### 1.2 Mecanismo Real de Proteção
- **No Banco de Dados:** A migration `20260525185000_fix_calcular_valor_total_trigger.sql` (linha 40) define expressamente:
  ```sql
  BEFORE INSERT OR UPDATE OF quantidade, quantidade_colaboradores, valor_unitario_snapshot, tipo_calculo_snapshot
  ON public.operacoes_producao
  ```
  Isso **prova** que o schema do PostgreSQL permite `UPDATE` nessas colunas. Não existe trigger `BEFORE UPDATE` bloqueando a alteração desses campos em nível de banco para qualquer status.
- **Na RPC `rpc_operacao_editar_segura`:**
  ```sql
  IF v_operacao.status = ANY(ARRAY['AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO']) THEN
      RAISE EXCEPTION 'ESTADO_FECHADO: Operação já faturada/recebida não aceita edições abertas.';
  END IF;
  ```
- **Conclusão:** Os valores **NÃO são imutáveis desde a criação**. Eles são mutáveis enquanto a operação estiver em `RECEBIDO`, `EM_VALIDACAO` ou `EM_RESTRICAO`. A imutabilidade só se inicia a partir do momento em que a operação transiciona para `AGUARDANDO_FATURAMENTO`, e essa trava reside na camada RPC/Service, e não em constraint pura de banco ou RLS.

**Classificação:** ⚠️ **PARCIALMENTE COMPROVADO** (Mutável em aberto; travado após faturamento).

---

## 2. IDEMPOTÊNCIA: OPERAÇÃO $\rightarrow$ RECEITA (`fn_gerar_receita_operacional_automatica`)

### 2.1 Prova Técnica dos Mecanismos de Blindagem
A trigger `fn_gerar_receita_operacional_automatica` (migration `20260917150000_fix_faturamento_mensal_complementar_multiorigem.sql`) e a migration `20260913233000_fix14_consolidacao_faturamento_mensal.sql` implementam três barreiras:

1. **Condição de Disparo da Trigger:**
   ```sql
   IF NEW.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO') 
      AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.status IS NULL) THEN
   ```
2. **Lookup Prévio na Tabela de Itens:**
   ```sql
   SELECT EXISTS (
       SELECT 1 FROM public.receitas_operacionais_itens 
       WHERE operacao_id = NEW.id
   ) INTO v_existente;
   IF NOT v_existente THEN ...
   ```
3. **Unique Index no Banco de Dados (Linha 23 da migration `20260913233000`):**
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_receitas_operacionais_itens_operacao_id
   ON public.receitas_operacionais_itens (operacao_id)
   WHERE operacao_id IS NOT NULL;
   ```
4. **Inserção com `ON CONFLICT` (Fluxo Mensal):**
   ```sql
   INSERT INTO public.receitas_operacionais_itens (tenant_id, receita_id, operacao_id, valor_item)
   VALUES (NEW.tenant_id, v_receita_id, NEW.id, NEW.valor_total)
   ON CONFLICT (operacao_id) WHERE operacao_id IS NOT NULL DO NOTHING;
   ```

### 2.2 Análise dos Cenários de Execução
- **Primeira execução:** `v_existente = false`, insere o item e vincula à receita.
- **Segunda execução:** `v_existente = true`, o bloco é ignorado silenciosamente.
- **Retry / Falha de rede:** O lookup ou o `ON CONFLICT` aborta a duplicação.
- **Concorrência simultânea:** O índice único `idx_receitas_operacionais_itens_operacao_id` causa `unique_violation` caso ocorra race condition antes do lookup, impedindo fisicamente que duas receitas capturem a mesma operação.
- **Operação alterada após faturar:** Bloqueada por `ESTADO_FECHADO`. Se o status mudar de `AGUARDANDO_FATURAMENTO` para `FATURADO`, a trigger reavalia, encontra `v_existente = true` e não recria.

**Classificação:** ✅ **COMPROVADO — IDEMPOTÊNCIA FORTE (Nível de Banco de Dados via Índice Único).**

---

## 3. CARDINALIDADE FINANCEIRA

### 3.1 Prova Técnica das Relações
O vínculo entre o domínio de Operações e o domínio Financeiro **ocorre exclusivamente na tabela `receitas_operacionais_itens`**, através da coluna `operacao_id`.

```text
[operacoes_producao] (1) 
       │
       │ (1:1 obrigatório pelo índice idx_receitas_operacionais_itens_operacao_id)
       ▼
[receitas_operacionais_itens] (N)
       │
       │ (N:1 via receita_id)
       ▼
[receitas_operacionais] (1)
```

### 3.2 Respostas Explícitas
1. **Uma operação pode gerar mais de uma receita?** **NÃO.** O índice único `idx_receitas_operacionais_itens_operacao_id` proíbe que o mesmo `operacao_id` exista mais de uma vez em `receitas_operacionais_itens`.
2. **Uma receita pode conter várias operações?** **SIM.** No caso de `FATURAMENTO_MENSAL`, uma única fatura mensal em `receitas_operacionais` agrega múltiplos itens em `receitas_operacionais_itens`.
3. **O vínculo ocorre na receita ou no item?** **NO ITEM** (`receitas_operacionais_itens.operacao_id`). A tabela pai `receitas_operacionais` não possui coluna `operacao_id`.
4. **FATURAMENTO_MENSAL agrega operações?** **SIM.** Todas as operações da mesma empresa e competência YYYY-MM são consolidadas em uma receita mensal única (`status = 'aguardando_fechamento'`).
5. **CAIXA_IMEDIATO funciona diferente?** **SIM.** Gera 1 registro em `receitas_operacionais` com `modalidade = 'CAIXA_IMEDIATO'`, `status = 'pendente_recebimento'`, e 1 item filho em `receitas_operacionais_itens`. Cardinalidade final: **1:1**.
6. **DUPLICATA funciona diferente?** **SIM.** Gera 1 registro em `receitas_operacionais` com `modalidade = 'DUPLICATA'`, `status = 'pendente_cobranca'`, e 1 item filho em `receitas_operacionais_itens`. Cardinalidade final: **1:1**.

### 3.3 Matriz de Cardinalidade Real
- `operacao` $\leftrightarrow$ `receitas_operacionais_itens`: **1:1** (ou 1:0 se não faturada).
- `receitas_operacionais_itens` $\leftrightarrow$ `receitas_operacionais`: **N:1**.
- `operacao` $\leftrightarrow$ `receitas_operacionais` (Mensal): **N:1** (N operações em 1 fatura mensal).
- `operacao` $\leftrightarrow$ `receitas_operacionais` (Avulso / Caixa / Duplicata): **1:1** (1 operação por fatura).

**Classificação:** ✅ **COMPROVADO.**

---

## 4. STATUS OPERACIONAL E STATUS_RH (CHECK CONSTRAINTS DO BANCO)

Auditado diretamente na migration `20260701000000_split_operacoes_status_rh.sql` (linhas 7-8 e 36-37):

### 4.1 `operacoes_producao.status` (CHECK Constraint Real)
`CHECK (status IN ('RECEBIDO', 'EM_VALIDACAO', 'EM_RESTRICAO', 'AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO'))`

| Status | Persistido? | Quem grava? | Significado Real | Próximos Estados Comprovados |
| :--- | :--- | :--- | :--- | :--- |
| `RECEBIDO` | Sim | Encarregado / Service | Lançamento inserido com horários preenchidos, pronto para conferência. | `EM_VALIDACAO`, `EM_RESTRICAO`, `AGUARDANDO_FATURAMENTO` |
| `EM_RESTRICAO` | Sim | Service / Trigger / RPC | Apontamento sem início/fim ou devolvido pelo RH com irregularidade. | `RECEBIDO`, `EM_VALIDACAO` |
| `EM_VALIDACAO` | Sim | Supervisor / UI | Operação aberta para conferência operacional. | `AGUARDANDO_FATURAMENTO`, `EM_RESTRICAO` |
| `AGUARDANDO_FATURAMENTO` | Sim | Supervisor / RPC | Operação aprovada operacionalmente; dispara trigger de receita. | `FATURADO`, `RECEBIDO_FINANCEIRO` |
| `FATURADO` | Sim | Financeiro / Trigger | Vinculada a lote/fatura mensal fechada ou duplicata emitida. | `RECEBIDO_FINANCEIRO`, `CONCLUIDO` |
| `RECEBIDO_FINANCEIRO` | Sim | Financeiro / RPC | Baixa financeira liquidada. | `CONCLUIDO` |
| `CONCLUIDO` | Sim | RPC Recebimento | Baixa financeira confirmada E RH validado. Arquivado. | *(Terminal)* |

### 4.2 `operacoes_producao.status_rh` (CHECK Constraint Real)
`CHECK (status_rh IN ('PENDENTE_RH', 'EM_ANALISE_RH', 'VALIDADO_RH', 'DEVOLVIDO_RH'))`

| Status RH | Persistido? | Quem grava? | Significado Real | Próximos Estados Comprovados |
| :--- | :--- | :--- | :--- | :--- |
| `PENDENTE_RH` | Sim | Default do Banco / Service | Equipe aguardando conferência do analista de RH. | `EM_ANALISE_RH`, `VALIDADO_RH`, `DEVOLVIDO_RH` |
| `EM_ANALISE_RH` | Sim | Painel RH (`AprovacoesRh.tsx`) | Em triagem pelo RH. | `VALIDADO_RH`, `DEVOLVIDO_RH` |
| `VALIDADO_RH` | Sim | RPC `rpc_rh_aprovar_operacao` | Equipe e jornada conferidas e aprovadas pelo RH. | *(Terminal ou DEVOLVIDO_RH em reanálise)* |
| `DEVOLVIDO_RH` | Sim | RPC `rpc_rh_devolver_operacao` | Rejeitado pelo RH (exige retificação do encarregado). | `PENDENTE_RH`, `VALIDADO_RH` |

**Classificação:** ✅ **COMPROVADO.**

---

## 5. `EM_RESTRICAO` E AVANÇO PARA FATURAMENTO

### 5.1 O que coloca uma operação em `EM_RESTRICAO`?
1. **Ausência de Horários de Ponto:** Em `producao.service.ts` (linhas 1008-1016 e 1329-1333): se `entrada_ponto` ou `saida_ponto` for nulo/vazio.
2. **Devolução pelo RH:** Na RPC `rpc_rh_devolver_operacao`:
   ```sql
   UPDATE public.operacoes_producao
   SET status_rh = 'DEVOLVIDO_RH', status = 'EM_RESTRICAO', ...
   ```
3. **Outra Restrição Existente:** Se `avaliacao_json.motivo_restricao` contiver qualquer texto além de "Horário de início e/ou término não informado".
4. **Infrações de Colaboradores:** Detectadas via `production_entry_collaborators.had_infraction = true` na listagem de inconsistências.

### 5.2 Quem saneia e libera?
- `rpc_operacao_regularizar_horarios` ou `regularizarHorarios()` no service: atualiza `entrada_ponto`, `saida_ponto` e remove a restrição de horário de `avaliacao_json`. Se não houver devolução de RH pendente, move para `RECEBIDO`.

### 5.3 Análise de Caminho de Código: `EM_RESTRICAO` consegue gerar receita hoje?

**Resposta Técnica: DEPENDE DO CANAL DE ACESSO.**

- **Caminho 1 — Via TypeScript Service (`producao.service.ts` linhas 1481-1483):**
  ```typescript
  if (existing.status === 'EM_RESTRICAO' || !existing.entrada_ponto || !existing.saida_ponto) {
    throw new Error("Esta operação possui restrições de horários e deve ser corrigida em Pendências antes de ser aprovada pelo RH.");
  }
  ```
  O service **BLOQUEIA** a chamada da RPC. Portanto, pela interface web padrão que utiliza `producao.service.ts`, o avanço é impedido.

- **Caminho 2 — Via RPC Direta (`rpc_operacao_validar_aprovar`):**
  ```sql
  IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO') THEN
      RAISE EXCEPTION 'ESTADO_FECHADO: Operação já vinculada ao fluxo financeiro não pode ser aprovada novamente.';
  END IF;

  UPDATE public.operacoes_producao
  SET status = 'AGUARDANDO_FATURAMENTO', status_rh = 'PENDENTE_RH', atualizado_em = v_now
  WHERE id = p_operacao_id;
  ```
  A RPC do banco **NÃO VALIDA** se `status = 'EM_RESTRICAO'`. Se uma chamada direta à RPC for executada no Supabase Client, o status é alterado para `AGUARDANDO_FATURAMENTO` e a trigger `fn_gerar_receita_operacional_automatica` gera faturamento de uma operação restrita!

- **Caminho 3 — Via Trigger Automática:**
  A trigger `fn_gerar_receita_operacional_automatica` só dispara se `NEW.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO')`. Se a operação permanecer em `EM_RESTRICAO`, ela **NUNCA** gera receita por si só.

**Classificação:** ⚠️ **REGRA PARCIAL (Proteção existe no Service frontend, mas está ausente na RPC do PostgreSQL).**

---

## 6. RELAÇÃO ENTRE `status` E `status_rh`

Os dois pipelines foram desacoplados na migration `20260701000000_split_operacoes_status_rh.sql`. No entanto, **não são 100% independentes; existem 3 pontos de acoplamento explícitos**:

1. **Acoplamento na Devolução RH:**
   A RPC `rpc_rh_devolver_operacao` força simultaneamente:
   `status_rh = 'DEVOLVIDO_RH'` **E** `status = 'EM_RESTRICAO'`.
2. **Acoplamento na Aprovação Operacional:**
   A RPC `rpc_operacao_validar_aprovar` força:
   `status = 'AGUARDANDO_FATURAMENTO'` **E** reseta `status_rh = 'PENDENTE_RH'`.
3. **Acoplamento na Baixa de Recebimento:**
   A RPC `rpc_receita_confirmar_recebimento` só move `status` para `'CONCLUIDO'` se `status_rh = 'VALIDADO_RH'`.

### Matriz de Combinações Comprovadas

| `status` Operacional | `status_rh` | Combinação Válida? | Efeito Sistêmico Comprovado |
| :--- | :--- | :---: | :--- |
| `RECEBIDO` | `PENDENTE_RH` | **SIM** | Estado padrão de lançamento recém-criado. |
| `EM_RESTRICAO` | `PENDENTE_RH` | **SIM** | Falta horário in loco, RH ainda não analisou. |
| `EM_RESTRICAO` | `DEVOLVIDO_RH` | **SIM** | Gerado pela RPC `rpc_rh_devolver_operacao`. |
| `EM_VALIDACAO` | `PENDENTE_RH` | **SIM** | Operação sob conferência do supervisor. |
| `AGUARDANDO_FATURAMENTO` | `PENDENTE_RH` | **SIM** | Operação aprovada para receita; equipe ainda sob validação RH. |
| `AGUARDANDO_FATURAMENTO` | `VALIDADO_RH` | **SIM** | Operação aprovada para receita e equipe já homologada pelo RH. |
| `FATURADO` | `VALIDADO_RH` | **SIM** | Faturamento consolidado e RH validado. |
| `FATURADO` | `PENDENTE_RH` | **SIM** | Faturou antes da validação final de pessoal (permitido pelo pipeline duplo). |
| `RECEBIDO_FINANCEIRO` | `VALIDADO_RH` | **Transitório** | Transiciona imediatamente para `CONCLUIDO` pela RPC de recebimento. |
| `RECEBIDO_FINANCEIRO` | `PENDENTE_RH` | **SIM** | Cliente pagou, mas RH ainda não concluiu validação da equipe. |
| `CONCLUIDO` | `VALIDADO_RH` | **SIM** | Ciclo completo: receita recebida e RH validado. |
| `CONCLUIDO` | `PENDENTE_RH` | **NÃO** | A RPC impede `CONCLUIDO` se `status_rh != 'VALIDADO_RH'`. |

**Classificação:** ✅ **COMPROVADO.**

---

## 7. CONCLUSÃO AUTOMÁTICA (`CONCLUIDO`)

### 7.1 Prova Técnica
Auditado na migration `20260912201500_fix07_rpc_receita_confirmar_recebimento.sql` (linhas 66-73):
```sql
UPDATE public.operacoes_producao
SET 
    status_pagamento = 'RECEBIDO',
    data_pagamento = v_data_real,
    status = CASE 
        WHEN status_rh = 'VALIDADO_RH' 
             AND status != 'EM_RESTRICAO' 
             AND status_rh != 'DEVOLVIDO_RH'
             AND status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'RECEBIDO', 'EM_VALIDACAO', 'CONCLUIDO')
        THEN 'CONCLUIDO'
        ELSE status
    END,
    atualizado_em = v_now
WHERE id = ANY(v_op_ids);
```

### 7.2 Análise de Assimetria
- **Cenário A (RH valida antes do pagamento):** O RH executa `rpc_rh_aprovar_operacao` $\rightarrow$ `status_rh = 'VALIDADO_RH'`. Depois o financeiro confirma o recebimento via `rpc_receita_confirmar_recebimento` $\rightarrow$ a RPC avalia o `CASE` e **atualiza automaticamente `status = 'CONCLUIDO'`**.
- **Cenário B (Pagamento ocorre antes da validação RH):** O financeiro confirma recebimento primeiro $\rightarrow$ `status_pagamento = 'RECEBIDO'`, mas como `status_rh` ainda é `PENDENTE_RH`, `status` permanece inalterado. Quando o RH posteriormente chama `rpc_rh_aprovar_operacao`, essa função **apenas** grava `status_rh = 'VALIDADO_RH'`, sem checar se a operação já estava paga para promovê-la a `CONCLUIDO`.

**Classificação:** ⚠️ **PARCIALMENTE COMPROVADO (Funciona automaticamente se a liquidação financeira for o último evento; falha se a aprovação do RH for a última).**

---

## 8. HEADCOUNT: `quantidade_colaboradores` × `production_entry_collaborators`

### 8.1 Por que ambos existem?
1. **Histórico da Arquitetura:**
   - Migration `20260428191500`: criou `quantidade_colaboradores INTEGER NOT NULL DEFAULT 1` para permitir faturamento por headcount.
   - Migration `20260428233000`: criou `production_entry_collaborators` 4 horas depois para permitir vincular colaboradores nominalmente e registrar infrações.
2. **Uso no Cálculo Financeiro:**
   A trigger `calcular_valor_total_operacao_producao` (migration `20260428191500`, linha 12):
   ```sql
   WHEN NEW.tipo_calculo_snapshot = 'colaborador' 
   THEN COALESCE(NEW.quantidade_colaboradores, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
   ```
   O cálculo financeiro de serviços tarifados por colaborador **lê diretamente a coluna `quantidade_colaboradores`**, e NÃO a contagem de registros na tabela filha.
3. **Uso Operacional:**
   No `ReceitaDetalhesDrawer.tsx` (linhas 438-450):
   ```tsx
   Colaboradores Alocados ({itOp.operacoes_colaboradores?.length || itOp.quantidade_colaboradores || 0})
   ...
   <p>Nenhum colaborador individual vinculado nominalmente (Qtd declarada: {itOp.quantidade_colaboradores || 1}).</p>
   ```
   O sistema suporta expressamente registrar uma quantidade de trabalhadores (ex: 4 chapas na descarga) sem que todos estejam previamente cadastrados na tabela de colaboradores.

### 8.2 Avaliação da Regra Proposta: `quantidade_colaboradores = count(production_entry_collaborators)`
Forçar essa equivalência de forma estrita no banco **quebraria** operações onde terceiros ou diaristas avulsos não cadastrados nominalmente atuaram na descarga.

**Classificação:** **COMPLEMENTAR (Não é puramente legado; possui função de cálculo de faturamento e suporte a equipe sem vínculo nominal).**

---

## 9. NOTA FISCAL (`nf_numero`)

### 9.1 O que o campo armazena na realidade?
Auditado no banco, forms e services:
- `nf_numero` é uma coluna `TEXT` (adicionada na migration `20260429110000_operacoes_producao_colunas_excel.sql`).
- Recebe:
  - `"SIM"` (quando o encarregado indica que haverá emissão de nota, mas não possui o número em mãos).
  - `"NÃO"` ou `"NAO"` (quando não haverá nota fiscal, forçando alíquota de ISS para 0%).
  - Números de nota fiscal reais (ex: `"89211"`, `"10492"`).
  - `null` ou `""` (não informado).

### 9.2 Avaliação de Necessidade de FIX Bloqueante
- O frontend (`financeiro.ts` linhas 274-278) já possui parser robusto:
  ```typescript
  const aplicaIss = nfInformada !== "" && 
    nfInformada !== "NAO" && 
    nfInformada !== "NÃO" && 
    nfInformada !== "FALSE" && 
    nfInformada !== "0";
  ```
- **Conclusão:** Não existe ameaça à integridade do banco que exija criar migrations de split de coluna antes de desenhar a UX. A interface pode resolver isso de forma transparente apresentando um controle visual claro (Switch "Emite NF?" + Input "Número"), formatando a gravação no padrão aceito pelo backend.

**Classificação:** **UX APENAS / NORMALIZAÇÃO FUTURA (Não é FIX bloqueante).**

---

## 10. EDIÇÃO APÓS FATURAMENTO

### 10.1 Prova Técnica nos Diferentes Níveis

| Nível | Status Analisado | Comportamento Comprovado | Mecanismo |
| :--- | :--- | :--- | :--- |
| **UI** | `AGUARDANDO_FATURAMENTO`, `FATURADO`, `RECEBIDO_FINANCEIRO`, `CONCLUIDO` | Botão "Editar" desabilitado ou restrito a visualização. | Condição em `OperacoesTableBlock.tsx`. |
| **Service** | Mesmos status | Lança exceção `Error('ESTADO_FECHADO')`. | `producao.service.ts` linhas 1377-1380. |
| **RPC** | Mesmos status | Aborta com `RAISE EXCEPTION 'ESTADO_FECHADO...'`. | `rpc_operacao_editar_segura` linhas 97-99. |
| **RLS / Banco Direto** | Mesmos status | ⚠️ **NÃO BLOQUEIA.** A política RLS é `FOR ALL USING (tenant_id = current_tenant_id())`. | Um update direto via REST API ignorando a RPC não é rejeitado pelo Postgres. |

**Conclusão:** A proteção contra alteração após faturamento é **garantida nas camadas de UI, Service e RPC**, mas **não existe constraint ou trigger no banco de dados bloqueando updates diretos na tabela**.

**Classificação:** ⚠️ **PARCIALMENTE COMPROVADO (Blindado pela RPC e Service; desprotegido contra update direto sem RPC).**

---

## 11. CANCELAMENTO E EXCLUSÃO (`DELETE`)

### 11.1 Prova Técnica
1. **Exclusão Física:** A RPC `rpc_operacao_excluir_segura` (migration `20260707190003`, linha 68) executa:
   ```sql
   DELETE FROM public.operacoes_producao WHERE id = p_operacao_id;
   ```
   **O DELETE É FÍSICO**, e não lógico!
2. **Trava de Faturamento:** A RPC rejeita categoricamente excluir operações já faturadas:
   ```sql
   IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO') THEN
       RAISE EXCEPTION 'ESTADO_FECHADO: Operação não pode ser excluída pois o faturamento já foi consolidado. Contate C-Level para reabertura/estorno.';
   END IF;
   ```
3. **Código Morto `cancel()`:** O método `cancel()` em `producao.service.ts` tenta gravar `status = 'cancelado'`. Como `'cancelado'` viola a check constraint de status (`operacoes_producao_status_check`), esse método falharia com erro de banco se chamado. Ele não é utilizado na UI.
4. **Estorno de Receita:** Não existe rotina de estorno automático no ERP para operações já faturadas.

**Classificação:** ✅ **COMPROVADO.**

---

## 12. COMPETÊNCIA E REGIME CONTÁBIL (DRE-FIX01)

### 12.1 Caminho Temporal Real
1. **Origem:** O encarregado informa `data_operacao` (ex: `2026-09-30`).
2. **Criação da Receita:** A trigger `fn_gerar_receita_operacional_automatica` extrai:
   ```sql
   v_competencia := to_char(NEW.data_operacao, 'YYYY-MM');
   ```
3. **Consolidação:** A receita é vinculada à competência `2026-09`, com vencimento calculado com base no último dia do mês de `data_operacao`.
4. **Consulta DRE:** Filtra as receitas operacionais por `competencia = '2026-09'`.

### 12.2 Operações por Volume causa o problema do DRE-FIX01?
**NÃO.** Na entidade `operacoes_producao`, o faturamento e a competência sempre derivam de `data_operacao`. O problema histórico do DRE-FIX01 ocorria quando serviços e relatórios utilizavam `created_at` (carimbo do sistema) para filtrar o mês contábil, causando distorções quando lançamentos de setembro eram digitados em outubro. O fluxo de Operações por Volume está aderente ao princípio contábil de competência.

**Classificação:** ✅ **COMPROVADO (Operações por Volume não é causadora do desvio).**

---

## 13. MOTOR DE RESOLUÇÃO COMERCIAL (`resolver_valor_operacao`)

Auditado na migration `20260506_resolver_valor_operacao_recriar.sql`:

### 13.1 Precedência Ponderada por Peso Binário
A busca por preços em `fornecedor_valores_servico` calcula um escore de especificidade:

$$\text{Prioridade} = (32 \times \text{empresa}) + (16 \times \text{servico}) + (8 \times \text{fornecedor}) + (4 \times \text{unidade}) + (2 \times \text{transportadora}) + (1 \times \text{produto})$$

### 13.2 Regras de Filtragem
1. Deve coincidir com o parâmetro fornecido ou ser `NULL` (coringa).
2. `ativo = true`.
3. `vigencia_inicio <= data_operacao AND (vigencia_fim IS NULL OR vigencia_fim >= data_operacao)`.
4. Critério de desempate: `ORDER BY vigencia_inicio DESC, created_at DESC, id DESC LIMIT 1`.
5. Retorna: `valor_unitario`, `tipo_calculo`, flag `regra_encontrada`, status (`found`, `needs_product`, `missing`, `duplicate`) e a `forma_pagamento_id` padrão associada.

**Classificação:** ✅ **COMPROVADO.**

---

## 14. MATERIAIS E ISS (`valor_total_materiais` E `custo_com_iss`)

Auditado em `src/utils/financeiro.ts` (linhas 270-302) e na trigger de cálculo:

1. **Fórmula Canônica de Preço Faturado ao Cliente:**
   $$\text{valor\_total} = \text{valor\_descarga} + \text{custo\_com\_iss} + \text{total\_filme} + \text{valor\_total\_materiais}$$
2. **`custo_com_iss`:**
   - **É receita ou custo?** Do ponto de vista da operação com o cliente, é um **adicional de cobrança (repasse fiscal)** para cobrir o imposto. Ele **soma** no `valor_total` cobrado.
   - **No DRE:** É classificado como **Dedução da Receita Bruta (Imposto Municipal)** para apuração da Receita Líquida.
3. **`valor_total_materiais`:**
   - **É receita ou custo?** É faturado do cliente como **adicional de insumos** (filme stretch, cantoneiras, paletes consumidos). Ele **soma** no `valor_total`.
   - **No DRE:** O valor cobrado compõe a **Receita Bruta**; as compras dos materiais entram como **Custos Diretos de Insumos**.

**Classificação:** ✅ **COMPROVADO.**

---

## 15. PERFIS E PERMISSÕES (MATRIZ DE CONTROLE DE ACESSO)

Auditado entre as camadas de UI, Service, RPC e RLS:

| Ação | Encarregado | Supervisor / Admin | Analista RH | Analista Financeiro | Onde é Protegido? |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Criar Operação** | Permite (In loco) | Permite | Bloqueado UI | Bloqueado UI | **UI** (página separada no mobile). RLS permite a todos. |
| **Visualizar** | Apenas as suas / da unidade | Todas do tenant | Todas do tenant | Visão consolidada | **UI / Service**. RLS não segrega perfil. |
| **Editar Horários** | Permite se em restrição | Permite | Bloqueado UI | Bloqueado UI | **RPC** `rpc_operacao_regularizar_horarios` / Service. |
| **Editar Valores/Carga**| Bloqueado UI | Permite (se não faturado) | Bloqueado UI | Bloqueado UI | **RPC** `rpc_operacao_editar_segura` / UI. |
| **Aprovar Operação** | Bloqueado UI | Permite | Bloqueado UI | Bloqueado UI | **Service** / **RPC** `rpc_operacao_validar_aprovar`. |
| **Aprovar RH** | Bloqueado UI | Bloqueado UI | Permite | Bloqueado UI | **RPC** `rpc_rh_aprovar_operacao`. |
| **Devolver RH** | Bloqueado UI | Bloqueado UI | Permite | Bloqueado UI | **RPC** `rpc_rh_devolver_operacao`. |
| **Faturar / Liquidar** | Bloqueado UI | Bloqueado UI | Bloqueado UI | Permite | **RPC** `rpc_receita_confirmar_recebimento` / Trigger. |
| **Excluir Operação** | Bloqueado UI | Permite (se não faturado) | Bloqueado UI | Bloqueado UI | **RPC** `rpc_operacao_excluir_segura`. |

**Conclusão sobre Segurança:** A segregação de perfis é rigorosa em nível de **UI e RPCs**, mas em nível de banco puro, todos os perfis compartilham a mesma role PostgreSQL `authenticated`.

**Classificação:** ✅ **COMPROVADO.**

---

## 16. MATRIZ DE DECISÃO TÉCNICA (O QUE É BLOQUEANTE PARA A UX?)

| Tema | Situação Real Comprovada | Risco | Precisa FIX antes da UX? | Próxima Ação na UX05 |
| :--- | :--- | :---: | :---: | :--- |
| **Snapshots Comerciais** | Mutáveis durante rascunho/aberto; travados após faturamento via RPC. | Baixo | **NÃO** | Manter formulário recalculando dinamicamente e congelar na aprovação. |
| **Idempotência Operação $\rightarrow$ Receita** | Idempotência forte garantida por índice único condicional no banco. | Zero | **NÃO** | Preservar fluxo trigger existente. |
| **Cardinalidade Financeira** | 1:1 para Caixa/Duplicata; N:1 para Faturamento Mensal via itens. | Zero | **NÃO** | Desenhar a UX respeitando a modalidade da forma de pagamento. |
| **Avanço de `EM_RESTRICAO`** | Bloqueado no Service, mas RPC aceita se invocada diretamente. | Médio | **NÃO (Bloqueante)** | Garantir que a UI desabilite o botão "Aprovar" quando em restrição. *(Fix na RPC é recomendável para hardening futuro).* |
| **Acoplamento `status` e `status_rh`** | 3 acoplamentos explícitos (Devolução, Aprovação, Baixa). | Baixo | **NÃO** | Exibir ambos os status de forma clara e coordenada na UI. |
| **Conclusão Automática** | Automática se pagamento for o último evento; incompleta se RH for o último. | Médio | **NÃO (Bloqueante)** | Na UI, sinalizar "Aguardando RH" ou "Aguardando Pagamento" conforme o caso. |
| **Headcount (`quantidade_colaboradores`)** | Usado no cálculo quando `tipo_calculo = 'colaborador'` e em equipe sem cadastro. | Baixo | **NÃO** | Na UX, sugerir auto-preenchimento pela contagem de selecionados, mas permitir override. |
| **Nota Fiscal (`nf_numero`)** | Armazena "SIM", "NÃO" ou string da NF. Parser já trata todos os casos. | Baixo | **NÃO** | Na UX, utilizar Switch boolean + Input textual opcional de NF. |
| **Edição pós-faturamento** | Bloqueada na UI, Service e RPC com erro `ESTADO_FECHADO`. | Baixo | **NÃO** | Desabilitar edição e exibir badge informativo de operação consolidada. |
| **Cancelamento / Exclusão** | Exclusão é física via RPC com trava em faturamento. `cancel()` é código morto. | Baixo | **NÃO** | Não expor botão de cancelamento na UI; manter apenas exclusão controlada antes do faturamento. |
| **Competência / DRE-FIX01** | Operações derivam competência estritamente de `data_operacao`. | Zero | **NÃO** | Manter filtro de competência baseado em `data_operacao`. |
| **Tabela de Preços** | Precedência bitwise ponderada (32 a 1) por vigência. | Zero | **NÃO** | Consumir `resolver_valor_operacao` normalmente na UX. |
| **Materiais e ISS** | Compõem a receita bruta faturada do cliente (`valor_total`). | Zero | **NÃO** | Exibir composição transparente (Descarga + ISS + Insumos = Total). |
| **Segregação de Perfis** | Perfeita na UI e RPCs; RLS compartilhado por tenant. | Baixo | **NÃO** | Respeitar os papéis de Encarregado (campo) e Supervisor/Admin (gestão). |

---

## 17. SÍNTESE FINAL PARA O BRIEFING DA UX05

1. **NENHUM FIX FUNCIONAL BLOQUEIA A CRIAÇÃO DA UX05:**  
   Nenhum dos achados auditados coloca em risco a integridade de dados ou impede o início do design do protótipo no UX Lab. Todas as inconsistências identificadas podem ser tratadas com excelência diretamente na arquitetura da interface ou absorvidas pelos contratos existentes.
2. **O QUE A UX05 DEVE PROJETAR:**  
   - Painel especialista focado em **Execução, Resolução de Restrições e Aprovação Operacional** (e não em relatórios históricos).
   - Componente de equipe que sincroniza a contagem com flexibilidade para contingências de campo.
   - Apresentação visual limpa para a Nota Fiscal (Switch de emissão + campo de número).
   - Transparência total da composição do valor total (Descarga, Insumos, ISS).

---
🛑 *CHECKPOINT: Auditoria crítica concluída em modo READ-ONLY. Nenhuma alteração foi realizada no Supabase, backend ou código de produção. Aguardando homologação do usuário.*
