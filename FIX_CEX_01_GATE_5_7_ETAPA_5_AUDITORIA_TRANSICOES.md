# ERP ORBE — FIX CEX-01
## GATE 5.7 — ETAPA 5: AUDITORIA DAS TRANSIÇÕES
### Inspeção de Contratos da RPC, Comportamento dos Botões da Central e Matriz de Estados

**Data:** 21 de Outubro de 2026  
**Ambiente:** Supabase Oficial (`lifgjtcflzmspilhryap`) / Desenvolvimento Local (`http://localhost:8080`)  
**Modo de Execução:** **READ-ONLY ESTRITO** (Nenhum dado modificado, nenhuma transição executada)  
**Registro Sintético sob Análise:**  
- **ID:** `faa91987-3ce7-429c-a547-5d9aeaed11f6` (`CE-FAA919`)  
- **Descrição:** `HML CEX-01 - Teste Sintetico de Devolucao`  
- **Empresa:** `Empresa Teste - Homologação` (`28a560b5-37ef-403d-ae4f-b28a608b6a68`)  
- **Valor:** `R$ 55,00`  
- **Origem do Recurso:** `PAGAMENTO_PENDENTE`  
- **Pipeline Atual:** `RECEBIDO`  
- **Status de Pagamento:** `A_PAGAR`  
- **Status do Portão:** **AUDITORIA CONCLUÍDA — PARADA OBRIGATÓRIA PARA AVALIAÇÃO**

---

## 1. ETAPA A — CONTRATO REAL DA RPC (`public.rpc_custo_extra_transicionar`)

A consulta ao catálogo do Supabase oficial comprovou que a RPC instalada corresponde com exatidão à definição da migration [20260918130000_fase1_custos_extras_origem_recurso_rpc.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260918130000_fase1_custos_extras_origem_recurso_rpc.sql).

### 1.1 Assinatura e Parâmetros
```sql
public.rpc_custo_extra_transicionar(
   p_id UUID,
   p_acao TEXT,
   p_updated_at TIMESTAMPTZ,
   p_justificativa TEXT DEFAULT NULL
) RETURNS JSONB
```

### 1.2 Regras de Segurança, Concorrência e Isolamento
1. **Autenticação Obrigatória (Fail-Closed):** Requer `auth.uid() IS NOT NULL` (ou contexto `service_role`).
2. **RBAC:**
   - Ação `finalizar_pagamento`: Restrita a perfis `'admin'` e `'financeiro'`.
   - Ações `avancar_validacao`, `aprovar`, `enviar_financeiro`, `devolver`: Restritas a perfis `'admin'`, `'rh'`, `'financeiro'`.
3. **Isolamento Multi-Tenant Estrito:** Valida `v_registro.tenant_id = v_user_tenant_id`. Se divergente, lança `TENANT_MISMATCH`.
4. **Optimistic Concurrency Control (OCC):** Exige `v_registro.atualizado_em = p_updated_at`. Se houver divergência, aborta com `CONCORRENCIA: Registro modificado por outro usuário. Recarregue a página.`.
5. **Soft Delete Check:** Registros com `deleted_at IS NOT NULL` lançam `ESTADO_INVALIDO`.

### 1.3 Contrato Específico por Ação da Máquina de Estados

| Ação (`p_acao`) | Estados Origem Válidos | Origem de Recurso | Destino `pipeline_status` | Destino `status_pagamento` | Justificativa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`avancar_validacao`** | Somente `RECEBIDO` | Qualquer | `EM_VALIDACAO` | Inalterado | Opcional |
| **`aprovar`** | **`RECEBIDO`** ou **`EM_VALIDACAO`** | • `PAGO_EMPRESA`<br>• `REEMBOLSO_COLABORADOR`<br>• `PAGAMENTO_PENDENTE`<br>• `LEGACY` | • `PAGO_EMPRESA`: **`FINALIZADO`**<br>• `REEMBOLSO_COLABORADOR`: **`APROVADO_OPERACAO`**<br>• `PAGAMENTO_PENDENTE`: **`APROVADO_OPERACAO`**<br>• `LEGACY`: **`APROVADO_OPERACAO`** | • `PAGO_EMPRESA`: **`PAGO`**<br>• Demais: **`A_PAGAR`** | Opcional |
| **`enviar_financeiro`** | Somente `APROVADO_OPERACAO` | `REEMBOLSO_COLABORADOR`, `PAGAMENTO_PENDENTE`, `LEGACY` | `ENVIADO_FINANCEIRO` | `A_PAGAR` | Opcional |
| **`finalizar_pagamento`** | Somente `ENVIADO_FINANCEIRO` | Bloqueia `PAGO_EMPRESA` | `FINALIZADO` | `PAGO` | Opcional |
| **`devolver`** | **`EM_VALIDACAO`**, **`APROVADO_OPERACAO`**, **`ENVIADO_FINANCEIRO`** | Qualquer com `status_pagamento != 'PAGO'` e `pipeline_status != 'FINALIZADO'` | **`RECEBIDO`** | Inalterado (preserva `A_PAGAR`) | **OBRIGATÓRIA** *(não vazia)* |

---

## 2. ETAPA B — BOTÃO "APROVAR DECISÃO" NA CENTRAL DE APROVAÇÕES

A inspeção do componente [AprovacoesRh.tsx (linhas 448-466)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L448-L466) responde às 7 questões:

1. **Qual função é executada?**  
   O botão no Drawer dispara `aprovarMutation.mutate(item)`. A mutação consulta previamente `atualizado_em` em `custos_extras_operacionais` e dispara a RPC.
2. **Qual ação RPC é enviada?**  
   É enviada a ação canônica **`"aprovar"`**.
3. **O botão pode aprovar diretamente um registro em `RECEBIDO`?**  
   **SIM.** A linha 237 da RPC estabelece explicitamente:  
   `IF v_registro.pipeline_status NOT IN ('EM_VALIDACAO', 'RECEBIDO') THEN RAISE EXCEPTION ...`  
   Portanto, registros em `RECEBIDO` são 100% elegíveis para aprovação direta na Central de Aprovações.
4. **Existe transição intermediária para `EM_VALIDACAO`?**  
   Não na Central de Aprovações. A Central permite que o RH aprove diretamente da triagem operacional (`RECEBIDO`). A transição para `EM_VALIDACAO` é opcional e existe na Torre Operacional do Encarregado.
5. **Qual é o resultado esperado para o registro sintético?**  
   Como sua origem é `PAGAMENTO_PENDENTE`, o resultado é:  
   - `pipeline_status`: **`APROVADO_OPERACAO`**  
   - `status_pagamento`: **`A_PAGAR`**  
   - `atualizado_em`: renovado com timestamp atual.
6. **O frontend atualiza os dados após a ação?**  
   **SIM.** O `onSuccess` invalida `["aprovacoes-rh"]` e `["aprovacoes-kpis"]`. Na view `vw_aprovacoes_rh`, o registro passa a ter `situacao = 'Aprovado'`. Como a visão padrão filtra `PENDENTE`, ele sai automaticamente da fila de trabalho (Inbox Zero) e o contador decrementa para `0`.
7. **Existe risco de aprovação financeira prematura?**  
   **NÃO.** Despesas com `PAGAMENTO_PENDENTE` não são liquidadas (`PAGO`). Elas apenas avançam para `A_PAGAR`, entrando na Central Financeira / Despesas para auditoria antes de qualquer emissão de CNAB ou pagamento.

---

## 3. ETAPA C — BOTÃO "DEVOLVER" NA CENTRAL DE APROVAÇÕES

A inspeção de [AprovacoesRh.tsx (linhas 563-585)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L563-L585) e do modal [AprovacaoDecisaoDrawer.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/components/AprovacaoDecisaoDrawer.tsx) responde às 7 questões:

1. **A ação enviada é exatamente `devolver`?**  
   **SIM.** A chamada repassa `p_acao: "devolver"`.
2. **A justificativa é transmitida corretamente?**  
   **SIM.** Há bloqueio preventivo se vazio no modal e no hook: `if (!motivo || !motivo.trim()) throw new Error("Justificativa obrigatória...");`, enviado como `p_justificativa`.
3. **O registro em `RECEBIDO` é elegível para devolução pela RPC?**  
   **NÃO.** A linha 322 da RPC estabelece:  
   `IF v_registro.pipeline_status NOT IN ('EM_VALIDACAO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO') THEN RAISE EXCEPTION 'Estado atual (%) não permite devolução.', v_registro.pipeline_status;`  
   Como o registro está em `RECEBIDO`, a RPC rejeitará a chamada.
4. **Se não for elegível em `RECEBIDO`, por que a interface apresenta o botão?**  
   Porque o componente `AprovacaoDecisaoDrawer.tsx` é uma casca genérica compartilhada entre os 6 domínios (Diaristas, Pontos CLT, Intermitentes, Operações, Serviços Extras e Custos Extras). Ele renderiza "Aprovar" e "Devolver" para qualquer registro pendente, sem checar previamente as regras de máquina de estado específicas de cada domínio.  
   *Nota de negócio:* O estado de destino da ação `devolver` é justamente `RECEBIDO`. Portanto, devolver um lançamento que já se encontra em `RECEBIDO` seria uma transição redundante (`RECEBIDO` -> `RECEBIDO`). A devolução faz sentido semântico para itens que já avançaram (`EM_VALIDACAO`, `APROVADO_OPERACAO`, `ENVIADO_FINANCEIRO`) e precisam retornar para a estaca zero operacional.
5. **Qual mensagem será exibida caso o operador tente clicar em Devolver agora?**  
   O toast de erro capturado exibirá:  
   `"Erro ao devolver: Estado atual (RECEBIDO) não permite devolução."`.
6. **A falha preserva integralmente o registro?**  
   **SIM.** Em caso de exceção no PostgreSQL, a transação sofre rollback total. O registro permanece intocado no estado `RECEBIDO` / `A_PAGAR`.
7. **Existe divergência entre a Central e o módulo especialista?**  
   **SIM.** No módulo especialista (`CustosExtrasTableBlock.tsx`), o operador avança o item primeiro para `EM_VALIDACAO`. E na Central Financeira ([DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx)), o item é auditado quando já está em `APROVADO_OPERACAO`, momento em que o botão "Devolver" funciona com 100% de sucesso.

---

## 4. ETAPA D — MATRIZ DE TRANSIÇÕES CANÔNICAS

| Estado Atual | Ação Disparada | Estado Destino Esperado | Permitida pela RPC? | Disponível na Interface? | Componente de Origem |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **`RECEBIDO`** | `avancar_validacao` | `EM_VALIDACAO` | **SIM** | **SIM** | Torre Operacional (`CustosExtrasTableBlock.tsx`) |
| **`RECEBIDO`** | **`aprovar`** | **`APROVADO_OPERACAO`** | **SIM** | **SIM** | Central de Aprovações RH (`AprovacoesRh.tsx`) |
| **`RECEBIDO`** | `devolver` | N/A *(Rejeição)* | ❌ **NÃO** *(Lança exceção)* | ⚠️ **SIM (Incompatível)** | Central de Aprovações RH (Botão genérico) |
| **`EM_VALIDACAO`** | `aprovar` | `APROVADO_OPERACAO` | **SIM** | **SIM** | Central RH / Torre Operacional |
| **`EM_VALIDACAO`** | `devolver` | `RECEBIDO` | **SIM** | **SIM** | Central RH / Torre Operacional |
| **`APROVADO_OPERACAO`**| **`devolver`** | **`RECEBIDO`** | **SIM** | **SIM** | Central Financeira / Despesas ([DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx)) |
| **`APROVADO_OPERACAO`**| `enviar_financeiro` | `ENVIADO_FINANCEIRO` | **SIM** | **SIM** | Fechamento Financeiro / Torre Operacional |
| **`ENVIADO_FINANCEIRO`** | `devolver` | `RECEBIDO` | **SIM** | **SIM** | Central Financeira / Despesas (`DespesaDrawerOficial.tsx`) |
| **`FINALIZADO`** / `PAGO`| `devolver` | N/A *(Terminal)* | ❌ **NÃO** | ❌ **NÃO** | Bloqueado na interface para pagamentos liquidados |

---

## 5. ETAPA E — PARECER TÉCNICO E PRÓXIMA AÇÃO RECOMENDADA

### 5.1 Classificação
> ### **CLASSIFICAÇÃO: DIVERGÊNCIA CONCEITUAL PONTUAL ENTRE UI E RPC NO ESTADO `RECEBIDO`.**
> - A RPC protege a integridade e impede devolução redundante de um item que já está em `RECEBIDO`.
> - A aprovação a partir de `RECEBIDO` é **100% suportada e aderente**.
> - A devolução é plenamente suportada assim que o registro avança (`EM_VALIDACAO`, `APROVADO_OPERACAO` ou `ENVIADO_FINANCEIRO`).

---

### 5.2 Roteiro Seguro para a Próxima Ação Manual no Registro `CE-FAA919`

Para validar integralmente as correções do FIX CEX-01 sem esbarrar na restrição da RPC, a sequência lógica de homologação é:

#### Opção Recomendada: Homologação do Ciclo Completo (Aprovar no RH -> Devolver no Financeiro)
1. **Passo 1 (Central de Aprovações RH):**  
   - Acessar `http://localhost:8080/rh/aprovacoes` no modo Homologação.  
   - Abrir o registro `CE-FAA919` (`R$ 55,00`).  
   - Clicar em **"Aprovar Decisão"**.  
   - *Resultado esperado:* Registro transiciona para `APROVADO_OPERACAO` e sai da fila RH.
2. **Passo 2 (Central Financeira / Contas a Pagar):**  
   - Acessar `http://localhost:8080/financeiro/despesas`.  
   - Localizar a despesa de R$ 55,00 (`CE-FAA919`) em Contas a Pagar.  
   - Abrir o Drawer Financeiro ([DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx)).
3. **Passo 3 (Validação do FIX CEX-01 — Ação Devolver Corrigida):**  
   - Clicar no botão **"Devolver"**.  
   - Preencher a justificativa: `"HML FIX CEX-01 — Devolução para validação do fluxo de aprovação"`.  
   - Confirmar a devolução.  
   - *Resultado esperado:* Como o registro está em `APROVADO_OPERACAO`, a RPC aceita a chamada `p_acao: "devolver"`, grava a justificativa e o retorna para `RECEBIDO`. A correção de `reprovar` para `devolver` é validada com sucesso absoluto!

#### Opção Alternativa: Teste de Defesa Negativa da RPC
- Se o operador desejar comprovar a proteção fail-closed da RPC, basta clicar em "Devolver" agora no registro em `RECEBIDO`.  
- O sistema exibirá o toast `"Estado atual (RECEBIDO) não permite devolução."` e preservará 100% do registro.

---

## 🛑 PARADA OBRIGATÓRIA

Em cumprimento estrito às instruções recebidas:
> **RESTRIÇÕES ABSOLUTAS:**  
> - Somente leitura executada.  
> - Nenhuma RPC de transição foi disparada pelo agente.  
> - Nenhum registro foi alterado ou criado.  
> - Os quatro registros históricos de R$ 995,00 permanecem 100% intocados.  
>  
> **PARAR AO FINAL DA AUDITORIA E AGUARDAR AUTORIZAÇÃO.**

Aguardando a decisão do operador para autorizar o próximo passo do teste manual.
