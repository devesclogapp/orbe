# Relatório de Auditoria: Pipeline de Operações por Volume (Orbe ERP)

## 0. Resumo Executivo
Esta auditoria avaliou o fluxo end-to-end do pipeline de "Operações por Volume", desde o input do encarregado até o faturamento na Central Financeira. A conclusão principal é que **o pipeline possui uma ruptura arquitetural gravíssima que impede a consolidação financeira**. As operações são salvas, validadas pelo RH, mas ficam "órfãs" e não progridem para os módulos de contas a pagar, faturamento ou CNAB.

---

## 1. Mapeamento do Pipeline de Dados

### 1.1 Entrada de Dados (Encarregado)
- **Frontend / Ação:** `NovaOperacaoDialog.tsx` → Motor Operacional V2
- **Tabela Relacional:** `operacoes_producao`
- **Comportamento:** A operação é criada corretamente e inicialmente atrelada ao status `aguardando_validacao`. Colaboradores envolvidos são vinculados diretamente (array json/b de `colaboradores_envolvidos`).
- **Sanitização Ativa:** Sim (`OperacaoProducaoService.sanitizeOperacaoPayload`).
- **Problema encontrado:** Nenhum. A entrada ocorre conforme esperado.

### 1.2 Recepção (Pipeline Operacional)
- **Frontend / Ação:** `PipelineOperacional.tsx` (Torre de Controle)
- **Comportamento:** O Pipeline de Produção lê `operacoes_producao` buscando exibir os dados conforme os estágios, utilizando uma abordagem reativa baseada em banco de dados isolado no componente `ProducaoGridBlock`.

### 1.3 Validação (RH)
- **Frontend / Ação:** `AprovacoesRh.tsx` → `OperacoesVolTabela`
- **Comportamento:** O RH consegue listar os dados que estão com status `aguardando_validacao`.
- **Ação Executada:** Ao clicar em 'Aprovar', o sistema executa um update direto (`status: 'validado_rh'`).
- **Problema encontrado:** Ao ser alterado para `validado_rh`, o dado da operação morre. Ele sai da fila do RH, porém não entra em nenhum outro lugar de forma automática, porque o motor não o capta.

### 1.4 Lotes e Semanas Operacionais (A Orquestração Perdida)
- **Frontend / Arquivo:** `Fechamento.tsx`, `CicloOperacionalService.ts`
- **Comportamento:** As "Semanas Operacionais" (tabela `ciclos_operacionais`) são desenhadas para orquestrar as métricas.
- **Problemas Graves:**
  1. No Browser, recebemos um erro HTTP 400 da Supabase API: `column ciclos_operacionais.empresa_id does not exist`. Assim, a listagem em `Fechamento.tsx` trava com tela vazia porque a Query de isolamento por `empresa_id` falha fatalmente, quebrando a listagem de ciclos.
  2. As operações *NÃO* são atreladas por uma Foreign Key ao Ciclo. Elas vivem de forma isolada pelas datas informadas (`data_operacao`), mas não são mapeadas a um lote físico, o que torna precário o conceito de "fechar" um lote.

### 1.5 Processamento Financeiro e Faturamento (O Vácuo)
- **Frontend / Arquivo Responsável (Teórico):** `MotorFinanceiro.ts` (método `processarFechamento`).
- **O Fato:** O código faz a orquestração perfeita de ler os dados de `operacoes_producao`, consolidar por cliente em `financeiro_consolidados_cliente` e em `financeiro_consolidados_colaborador`.
- **A Ruptura:** **ESSE CÓDIGO NUNCA É CHAMADO.** Fizemos um parse completo de dependência (grep) na base de código e `MotorFinanceiro` só é referenciado em uma index de indexação de serviços (`MotorIndex.ts`), e na própria declaração interna. Ele jamais executa. Como resultado, **as tabelas `financeiro_consolidados_cliente` ficam eternamente vazias no que tange a Operações por Volume**.

### 1.6 Dashboard e Relatórios (Consequências)
- **Telas:** `Dashboard.tsx`, `ClientDashboard.tsx`, `CentralRelatoriosIntegracoes.tsx`
- **Comportamento:** O Dashboard baseia seus KPIs (`faturamentoTotal`, `caixaRecebido`, `lucroReal`) lendo exclusivamente de `financeiro_consolidados_cliente` (`dashboard.service.ts`). Como o Motor Financeiro não envia as operações de volume para lá, os relatórios ficam silenciosos (zerados).

### 1.7 Central Financeira e Erros de Rede
- Na Central Financeira, o botão "Consolidar Competência" foi desenvolvido para acionar uma Edge Function (`/functions/v1/process-day`). Ao tentar executá-la no ambiente de staging/produção, a rede retorna `Failed to send a request to the Edge Function` e falha nos preflights de CORS. Esse botão, todavia, engatilha processos de sumarização para Inteligência Artificial (resultados sumários) e *não* executa o `MotorFinanceiro`.

---

## 2. A Matriz de Diagnóstico End-to-End

| Ponto de Validação | Status Atual | Causa / Comentário |
| :--- | :--- | :--- |
| Encarregado consegue lançar operação? | ✅ Sucesso | Funciona. Vai para `operacoes_producao` como `aguardando_validacao`. |
| RH consegue aprovar operação? | ✅ Sucesso | O update acontece para `validado_rh`. |
| RH/Fiscal visualiza os ciclos? | ❌ Quebrado | Erro de Schema: `column ciclos_operacionais.empresa_id does not exist`. |
| Operação gera Lançamento de Contas a Receber/Pagar? | ❌ Quebrado | Não há transição real de `operacoes_producao` para Faturamento e Pagamentos. `MotorFinanceiro.processarFechamento` está isolado e inativo. |
| Dashboard detecta Faturamento por Volume? | ❌ Oculto | Os dados em transição morrem antes de chegar no consolidado lido pelo Dashboard. |
| Integração Automática | ❌ Falha (CORS) | As edge functions atreladas a esse pipeline caem em bloqueios CORS (verificado em `process-day`). |

---

## 3. Classificação de Estabilidade (Project Stabilizer)
- **Classificação:** ❌ **Instável / Inoperável**
- O módulo de Entrada Operacional funciona, mas o módulo Financeiro que depende desses dados não as recebe. Do ponto de vista de negócios, uma Operação por Volume jamais vira faturamento se esse fluxo for executado como está.

## 4. Recomendações Críticas Correção:

**1. Correção Imediata do Schema do Banco de Dados:**
Adicionar e configurar a tabela de Semanas:
`ALTER TABLE ciclos_operacionais ADD COLUMN empresa_id uuid REFERENCES empresas(id);`

**2. Acoplamento de Fechamento (Gatilho do Motor):**
Embutir a chamada `MotorFinanceiro.processarFechamento` dentro do `CicloOperacionalService.validarFinanceiro`, passando os IDs corretamente após validação do supervisor, injetando efetivamente as faturas no sistema sem quebrar os processos atuais. Em caso de aprovação do batch que atende a operação.

**3. Revisão do CORS das Edge Functions:**
Ajustar no arquivo `cors.ts` (ou header default servido do Deno Deploy Supabase Edge Functions) para autorizar explicitamente requests OPTIONS sem barrá-los por ausência da header `Access-Control-Allow-Origin`.
