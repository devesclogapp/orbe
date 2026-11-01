# PLANO DE ESTABILIZAÇÃO — FIX CEX-01
## Auditoria Técnica das Transições de Custos Extras (GATE 1)
**ERP ORBE | ESC LOG 2026**  
**Data da Auditoria:** 21 de Outubro de 2026  
**Modo:** 100% Read-Only (Zero alterações em código, banco, RPC ou registros)  
**Status do Portão:** **GATE 1 CONCLUÍDO — AGUARDANDO AUTORIZAÇÃO PARA IMPLEMENTAÇÃO**  

---

## 1. DIAGNÓSTICO COMPROVADO DAS INCONSISTÊNCIAS

A investigação técnica aprofundada confirmou categoricamente as três inconsistências levantadas na auditoria preliminar, detalhando o mecanismo exato da falha, causas-raízes e consequências sistêmicas.

### Inconsistência 1: Ação Incompatível no Drawer Financeiro (`reprovar` vs `devolver`)
* **Diagnóstico:** **COMPROVADO COM CERTEZA TÉCNICA ABSOLUTA.**
* **Local:** `src/pages/Financeiro/components/DespesaDrawerOficial.tsx` (linhas 150–157).
* **Mecanismo:** Ao clicar em *"Devolver"* no Drawer de Despesas Financeiras e confirmar o diálogo, a mutação invoca:
  ```typescript
  CustoExtraOperacionalService.transicionar(
    despesa.canonicalId,
    "reprovar", // <- ERRO CRÍTICO DE CONTRATO
    despesa.rawItem?.atualizado_em || new Date().toISOString(),
    motivoDevolucao.trim()
  );
  ```
* **Confronto com o Banco:** A função `public.rpc_custo_extra_transicionar` (migration `20260918130000_fase1_custos_extras_origem_recurso_rpc.sql`, linhas 179–185 e 334–336) implementa um controle *fail-closed* estrito de ações permitidas:
  ```plpgsql
  ELSIF p_acao IN ('avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver') THEN
  ...
  ELSE
      RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao;
  END IF;
  ```
* **Consequência em Produção:** Toda tentativa de devolução de um Custo Extra a partir da Central Financeira **falha com erro 500 no Supabase** e exibe toast de erro ao usuário: *"Erro ao devolver item: Açao de transicao desconhecida: reprovar"*.

---

### Inconsistência 2: Fila do RH com UPDATE Direto Bypasando a RPC
* **Diagnóstico:** **COMPROVADO COM CERTEZA TÉCNICA ABSOLUTA.**
* **Local:** `src/pages/Rh/AprovacoesRh.tsx` (linhas 564–571).
* **Mecanismo:** Enquanto a aprovação (`aprovarMutation`, linhas 450–465) invoca corretamente a RPC `rpc_custo_extra_transicionar(..., 'aprovar')` com controle OCC, a devolução (`devolverMutation`) executa um UPDATE direto no PostgREST:
  ```typescript
  // 4. CUSTO EXTRA
  if (item.tipo === "CUSTO EXTRA") {
    const { error } = await supabase
      .from("custos_extras_operacionais" as any)
      .update({ pipeline_status: "REPROVADO", atualizado_em: new Date().toISOString() })
      .eq("id", item.id);
    if (error) throw error;
    return;
  }
  ```
* **Vulnerabilidades e Desvios:**
  1. **Perda de Dados:** O parâmetro `motivo` preenchido no diálogo é sumariamente ignorado e descartado; não é gravado em `justificativa_devolucao`.
  2. **Quebra de RBAC e OCC:** Bypassa o controle de concorrência otimista (`atualizado_em`) e a validação de permissões da RPC.
  3. **Travamento Terminal Irreversível (Bloqueio da RPC):** No banco, o registro fica com `pipeline_status = 'REPROVADO'`. O contrato da RPC define:
     ```plpgsql
     ELSIF p_acao = 'aprovar' THEN
         IF v_registro.pipeline_status NOT IN ('EM_VALIDACAO', 'RECEBIDO') THEN
             RAISE EXCEPTION 'Estado atual (%) não permite acao de aprovar. Registro deve estar em RECEBIDO ou EM_VALIDACAO.', v_registro.pipeline_status;
         END IF;
     ```
     Portanto, **um item com status `REPROVADO` NUNCA MAIS pode ser aprovado pela RPC** caso seja reanalisado!
  4. **Semântica Correta:** A RPC já implementa nativamente a ação `'devolver'`, que move o item de volta para `'RECEBIDO'`, grava `justificativa_devolucao = p_justificativa` e permite que o Encarregado faça as correções operacionais necessárias e o submeta novamente à aprovação.

---

### Inconsistência 3: View `vw_aprovacoes_rh` Mapeando `status_pagamento` como `raw_status`
* **Diagnóstico:** **COMPROVADO EMPIRICAMENTE NO BANCO OFICIAL ATIVO.**
* **Local:** `supabase/migrations/20261018130100_fix_dia_02_vw_aprovacoes_rh_diaristas_lotes.sql` (linha 74).
* **Definição Atual na View:**
  ```sql
  -- 3. CUSTOS EXTRAS
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
      ce.status_pagamento AS raw_status, -- <- ERRO ARQUITETURAL
      ce.empresa_id AS empresa_id,
      ce.data AS filter_data,
      NULL::uuid AS raw_lote_id
  FROM custos_extras_operacionais ce
  LEFT JOIN empresas e ON e.id = ce.empresa_id
  ```
* **Evidência no Banco Real (Executada em 21/10/2026):**
  Consulta à view `public.vw_aprovacoes_rh` para os 4 registros de Outubro/2026:
  - `f6c3685e-c17e...` (`total = 380`, `pipeline_status = APROVADO_OPERACAO`): View retorna `raw_status = 'A_PAGAR'` e `situacao = 'Em análise'`.
  - `c1aa8f36-6c75...` (`total = 85`, `pipeline_status = APROVADO_OPERACAO`): View retorna `raw_status = 'A_PAGAR'` e `situacao = 'Em análise'`.
  - `98c5defd-0e75...` (`total = 380`, `pipeline_status = APROVADO_OPERACAO`): View retorna `raw_status = 'A_PAGAR'` e `situacao = 'Em análise'`.
  - `1837369f-f460...` (`total = 150`, `pipeline_status = FINALIZADO`, `status_pagamento = PAGO`): View retorna `raw_status = 'PAGO'` e `situacao = 'Aprovado'`.
* **Impacto Operacional Comprovado:**
  1. Três registros que **já foram formalmente aprovados** pelo gestor/RH (`APROVADO_OPERACAO`) continuam aparecendo como *"Em análise"* (Aguardando Decisão) na fila do RH.
  2. **Distorção de Indicadores:** Na tela `AprovacoesRh.tsx`, o KPI *"Aguardando Decisão"* conta 3 itens a mais, e o *"Impacto Financeiro"* soma indevidamente R$ 845,00 que já foram aprovados.
  3. **Tentativa de Aprovação Duplicada:** Se o usuário RH clicar para aprovar novamente um desses itens, a RPC rejeita a transição com erro: *"Estado atual (APROVADO_OPERACAO) não permite acao de aprovar"*.
  4. O item só sai da fila do RH quando o Financeiro quita a despesa (`status_pagamento = 'PAGO'`), misturando aprovação de escopo operacional com liquidação financeira.

---

## 2. EVIDÊNCIAS DE CÓDIGO E BANCO DE DADOS

| Componente / Objeto | Arquivo / Linha | Evidência Identificada |
| :--- | :--- | :--- |
| **Drawer Financeiro** | `src/pages/Financeiro/components/DespesaDrawerOficial.tsx` (L150-156) | Chama `CustoExtraOperacionalService.transicionar(..., "reprovar", ...)` |
| **Fila RH** | `src/pages/Rh/AprovacoesRh.tsx` (L564-571) | Executa `.update({ pipeline_status: "REPROVADO" })` descartando `motivo` |
| **View RH** | `supabase/migrations/20261018130100_fix_dia_02_vw_aprovacoes_rh_diaristas_lotes.sql` (L74) | Projeta `ce.status_pagamento AS raw_status` em vez de `ce.pipeline_status` |
| **RPC Canônica** | `supabase/migrations/20260918130000_fase1_custos_extras_origem_recurso_rpc.sql` (L179-185, L311-335) | Valida `p_acao IN ('avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver')` e `finalizar_pagamento` |
| **Service Frontend** | `src/services/domain/despesas.service.ts` (L87-105) | Método `transicionar` chama `rpc_custo_extra_transicionar` repassando `p_acao` inalterado |
| **Testes Contratuais** | `src/test/fase1_custos_extras_rpc_contrato.test.ts` (L146-152, L229-242) | Suite oficial testando exaustivamente que a ação canônica é `'devolver'` |

---

## 3. CONTRATO COMPLETO DA RPC `public.rpc_custo_extra_transicionar`

A RPC é a **autoridade central e exclusiva** para alteração de status de Custos Extras no ERP ORBE.

### Assinatura e Parâmetros
```sql
FUNCTION public.rpc_custo_extra_transicionar(
   p_id UUID,
   p_acao TEXT,
   p_updated_at TIMESTAMPTZ,
   p_justificativa TEXT DEFAULT NULL
) RETURNS JSONB
```

### Ações Aceitas e Permissões (RBAC Fail-Closed)
1. `'avancar_validacao'`: Perfis autorizados: `admin`, `rh`, `financeiro`.
2. `'aprovar'`: Perfis autorizados: `admin`, `rh`, `financeiro`.
3. `'enviar_financeiro'`: Perfis autorizados: `admin`, `rh`, `financeiro`.
4. `'devolver'`: Perfis autorizados: `admin`, `rh`, `financeiro`.
5. `'finalizar_pagamento'`: Perfis autorizados: `admin`, `financeiro` (proibido para `rh`).

### Validações de Segurança Embutidas
- **Autenticação:** `auth.uid() IS NOT NULL` (ou `service_role`).
- **Isolamento de Tenant:** `registro.tenant_id = user_tenant_id` (lança `TENANT_MISMATCH`).
- **Lock Concorrencial:** `SELECT ... FOR UPDATE` no registro para evitar *race conditions*.
- **Controle de Concorrência Otimista (OCC):** `registro.atualizado_em = p_updated_at` (lança `CONCORRENCIA` caso outro usuário tenha alterado o registro).
- **Soft Delete:** Bloqueia operação se `deleted_at IS NOT NULL`.

---

## 4. MATRIZ DE ESTADOS, AÇÕES E TRANSIÇÕES

A máquina de estados varia segundo a **Origem do Recurso** (`origem_recurso`):

### Cenário 1: `PAGO_EMPRESA` (Modelo A — Desembolso Imediato pela Empresa)
*Gasto corporativo já pago via cartão corporativo, caixa da empresa ou PIX operacional.*

| Estado Atual (`pipeline_status` / `status_pagamento`) | Ação RPC | Perfil Autorizado | Estado Resultante | Efeito Financeiro | Efeito na DRE | Comportamento na UI |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RECEBIDO` / `A_PAGAR` | `avancar_validacao` | RH / Gestor / Admin | `EM_VALIDACAO` / `A_PAGAR` | Nenhum | Nenhum | Em triagem operacional |
| `RECEBIDO` ou `EM_VALIDACAO` / `A_PAGAR` | `aprovar` | RH / Gestor / Admin | `FINALIZADO` / `PAGO` | **Sem Contas a Pagar** | **Reconhece Despesa (-)** | Sai da fila de aprovação; concluído |
| `RECEBIDO` ou `EM_VALIDACAO` / `A_PAGAR` | `devolver` | RH / Gestor / Admin | `RECEBIDO` / `A_PAGAR` | Nenhum | Nenhum | Volta para correção com justificativa |
| `FINALIZADO` / `PAGO` | `enviar_financeiro` | — | **BLOQUEADO** | — | — | Erro na RPC: já finalizado |
| `FINALIZADO` / `PAGO` | `finalizar_pagamento`| — | **BLOQUEADO** | — | — | Erro na RPC: gasto já liquidado |
| `FINALIZADO` / `PAGO` | `devolver` | — | **BLOQUEADO** | — | — | Erro na RPC: estado terminal |

---

### Cenário 2: `REEMBOLSO_COLABORADOR` (Obrigação com Colaborador)
*Colaborador utilizou recurso próprio; empresa deverá ressarci-lo.*

| Estado Atual (`pipeline_status` / `status_pagamento`) | Ação RPC | Perfil Autorizado | Estado Resultante | Efeito Financeiro | Efeito na DRE | Comportamento na UI |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RECEBIDO` / `A_PAGAR` | `avancar_validacao` | RH / Gestor / Admin | `EM_VALIDACAO` / `A_PAGAR` | Nenhum | Nenhum | Em triagem operacional |
| `RECEBIDO` ou `EM_VALIDACAO` / `A_PAGAR` | `aprovar` | RH / Gestor / Admin | `APROVADO_OPERACAO` / `A_PAGAR` | Gera Obrigação | **Reconhece Despesa (-)** | Sai de pendente no RH; vai para Financeiro |
| `APROVADO_OPERACAO` / `A_PAGAR` | `enviar_financeiro` | RH / Financeiro / Admin| `ENVIADO_FINANCEIRO` / `A_PAGAR` | Confirma Liberação | Mantido na DRE | Disponível em "Prontas p/ Execução" |
| `ENVIADO_FINANCEIRO` / `A_PAGAR` | `finalizar_pagamento`| Financeiro / Admin | `FINALIZADO` / `PAGO` | **Baixa Financeira Efetuada** | Mantido na DRE | Movido para Despesas Pagas (sem CNAB) |
| Qualquer estado não-pago | `devolver` | RH / Financeiro / Admin| `RECEBIDO` / `A_PAGAR` | Suspende Obrigação| Exclui da DRE | Retorna à operação com justificativa |

---

### Cenário 3: `PAGAMENTO_PENDENTE` (Obrigação com Fornecedor / Boleto a Prazo)
*Despesa faturada a prazo por fornecedor parceiro.*

| Estado Atual (`pipeline_status` / `status_pagamento`) | Ação RPC | Perfil Autorizado | Estado Resultante | Efeito Financeiro | Efeito na DRE | Comportamento na UI |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RECEBIDO` / `A_PAGAR` | `avancar_validacao` | RH / Gestor / Admin | `EM_VALIDACAO` / `A_PAGAR` | Nenhum | Nenhum | Em triagem operacional |
| `RECEBIDO` ou `EM_VALIDACAO` / `A_PAGAR` | `aprovar` | RH / Gestor / Admin | `APROVADO_OPERACAO` / `A_PAGAR` | Conta a Pagar Aberta| **Reconhece Despesa (-)** | Sai de pendente no RH; vai para Financeiro |
| `APROVADO_OPERACAO` / `A_PAGAR` | `enviar_financeiro` | RH / Financeiro / Admin| `ENVIADO_FINANCEIRO` / `A_PAGAR` | Pronta Liquidação | Mantido na DRE | Aparece em A Pagar com Favorecido |
| `ENVIADO_FINANCEIRO` / `A_PAGAR` | `finalizar_pagamento`| Financeiro / Admin | `FINALIZADO` / `PAGO` | **Baixa Financeira Efetuada** | Mantido na DRE | Movido para Despesas Pagas (sem CNAB) |
| Qualquer estado não-pago | `devolver` | RH / Financeiro / Admin| `RECEBIDO` / `A_PAGAR` | Suspende Duplicata | Exclui da DRE | Retorna à operação com justificativa |

---

## 5. CAUSAS-RAÍZES IDENTIFICADAS

1. **Dessincronização Léxica de Ações:** O frontend (`DespesaDrawerOficial.tsx`) utilizou a nomenclatura semântica informal `"reprovar"`, enquanto o backend (`rpc_custo_extra_transicionar`) foi padronizado na migration `20260918130000` com a nomenclatura canônica `"devolver"`.
2. **Atalho de Implementação no RH:** Na mutação `devolverMutation` de `AprovacoesRh.tsx`, para simplificar o código em vez de consultar `atualizado_em` para invocar a RPC (como foi feito com maestria no `aprovarMutation`), foi inserido um `.update()` direto.
3. **Legado Semântico na View:** A view `public.vw_aprovacoes_rh` foi criada originalmente antes da separação estrutural entre `pipeline_status` e `status_pagamento`. Quando os dois conceitos foram formalmente segregados em junho de 2026, a view foi ajustada para Serviços Extras (`se.pipeline_status AS raw_status`), mas permaneceu com `ce.status_pagamento AS raw_status` para Custos Extras.

---

## 6. ESTRATÉGIA MÍNIMA DE CORREÇÃO (PLANO TO-BE PARA FASE 2)

A intervenção requer **apenas três alterações cirúrgicas mínimas**, sem qualquer reestruturação ou efeito colateral em outros módulos:

### Correção 1 — Alinhar Ação no Drawer Financeiro
- **Arquivo:** `src/pages/Financeiro/components/DespesaDrawerOficial.tsx` (linha 153).
- **Alteração:**
  ```diff
  - "reprovar",
  + "devolver",
  ```
- **Impacto:** Restabelece o contrato com a RPC. A devolução financeira passa a transicionar o item perfeitamente para `RECEBIDO` com justificativa registrada.

### Correção 2 — Unificar Devolução no RH via RPC
- **Arquivo:** `src/pages/Rh/AprovacoesRh.tsx` (linhas 564–571).
- **Alteração:** Substituir o `.update()` direto pela chamada à RPC `rpc_custo_extra_transicionar` com `p_acao: "devolver"`, `p_updated_at` (obtido via fetch do item como no `aprovarMutation`) e `p_justificativa: motivo`.
- **Impacto:** Garante auditabilidade, preserva OCC e evita que o registro fique travado no estado órfão `REPROVADO`.

### Correção 3 — Atualizar Projeção da View `vw_aprovacoes_rh`
- **Migration:** Criar migration canônica `fix_cex_01_vw_aprovacoes_rh_pipeline_status.sql`.
- **Alteração na Definição da View (bloco Custos Extras):**
  ```diff
  - ce.status_pagamento AS raw_status,
  + COALESCE(ce.pipeline_status, 'RECEBIDO') AS raw_status,
  ```
- **Impacto:** Custos Extras em `APROVADO_OPERACAO` passam a refletir `raw_status = 'APROVADO_OPERACAO'` e `situacao = 'Aprovado'`, saneando os indicadores do painel do RH e removendo itens já aprovados da fila de pendências.

---

## 7. ANÁLISE DE RISCOS E REGRESSÃO

| Área / Módulo | Nível de Risco | Mitigação / Justificativa |
| :--- | :---: | :--- |
| **Mão de Obra (Diaristas / Intermitentes / CLT)** | **ZERO** | Nenhuma alteração nas tabelas, serviços ou blocos da view que tratam de diaristas ou CLT. |
| **Central Bancária / CNAB 240** | **ZERO** | Custos Extras permanecem com `readinessBancario: false` e `prontoParaBanco: false`. |
| **DRE (Demonstração do Resultado)** | **ZERO** | O critério da DRE (`isCustoExtraReconhecidoDRE`) continuará lendo `APROVADO_OPERACAO`, `ENVIADO_FINANCEIRO` e `FINALIZADO`. |
| **Registros Históricos Existentes** | **ZERO** | Os 4 registros de Outubro/2026 (R$ 380, R$ 380, R$ 85, R$ 150) não sofrerão mutação de dados ou valores. |

---

## 8. PLANO DE TESTES PARA A IMPLEMENTAÇÃO (FASE 2)

1. **Teste T-CEX-01 (Drawer Financeiro):** Devolver um custo extra via Drawer Financeiro e validar se a transição para `RECEBIDO` ocorre sem erro de RPC.
2. **Teste T-CEX-02 (Fila RH - Devolução):** Devolver um custo extra pela fila do RH e verificar se `justificativa_devolucao` é gravada no banco e o status vai para `RECEBIDO`.
3. **Teste T-CEX-03 (View RH - Consistência de Status):** Criar e aprovar um Custo Extra de teste (`PAGAMENTO_PENDENTE`). Verificar se na view `vw_aprovacoes_rh` a `situacao` vira imediatamente `'Aprovado'` e sai do contador de pendências do RH.
4. **Teste T-CEX-04 (Proteção de Registros de Outubro/2026):** Executar verificação automatizada garantindo que os 4 registros históricos permanecem intactos nos mesmos valores e estados.
5. **Teste T-CEX-05 (Regressão Geral Vitest):** Executar `npm test` garantindo 100% de aprovação na suite existente.

---

## 9. PARECER CONCLUSIVO DO GATE 1

### **PARECER: [ GO PARA IMPLEMENTAÇÃO ]**

**Fundamentação Técnica:**  
As causas-raízes foram 100% diagnosticadas e comprovadas no código e no banco de dados ativo. As três correções necessárias são mínimas, de baixo risco, estritamente localizadas e corrigem deficiências de contrato sem provocar nenhuma alteração estrutural nos domínios já homologados.

---
*Parada obrigatória no GATE 1 realizada. Aguardando autorização expressa do usuário para iniciar a aplicação das correções na Fase 2.*
