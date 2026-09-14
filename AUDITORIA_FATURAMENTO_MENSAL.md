# AUDITORIA TÉCNICA E ARQUITETURAL
# FATURAMENTO MENSAL DE OPERAÇÕES POR VOLUME — ERP ORBE

> **Status:** AUDITORIA EXCLUSIVA DE LEITURA (Nenhuma alteração de código, banco, dados ou migração foi executada).  
> **Data:** 13/09/2026  
> **Sistema Auditado:** ERP ORBE (Frontend React/Vite/TS + Backend Supabase PostgreSQL)

---

## 1. RESUMO EXECUTIVO

Esta auditoria foi realizada com o objetivo de dissecar minuciosamente como o ERP ORBE implementa hoje o fluxo de **Operações por Volume** sob a modalidade **FATURAMENTO MENSAL**, rastreando todo o caminho desde o input pelo Encarregado até a Cobrança, Recebimento e Conciliação.

### Principais Conclusões da Auditoria:
1. **O que é a "Regra do Dia 30":**  
   Não existe no código nem no banco nenhuma regra comercial com o valor fixo `30` para faturamento mensal. O que existe é a aplicação da função de final de mês corrente:  
   - Frontend: `endOfMonth(data_operacao)` ([src/utils/financeiro.ts:173](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/utils/financeiro.ts#L173))  
   - Banco: `date_trunc('month', p_data_operacao) + INTERVAL '1 month' - INTERVAL '1 day'` ([20260505_regras_financeiras_nova_tabela.sql:131](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260505_regras_financeiras_nova_tabela.sql#L131)).  
   Como os testes foram realizados na competência de **Setembro**, e Setembro possui 30 dias, o cálculo resultou em `30/09/2026`. Em Outubro resultará em `31/10`, e em Fevereiro em `28/02` (ou `29/02`).  
   **Conclusão da causa-raiz:** O sistema está tratando a **data de corte/fechamento da competência** (`fim do mês`) como se fosse a **data de vencimento da cobrança** (`data_vencimento`).
2. **Duas Arquiteturas Coexistindo (Desconectadas):**  
   O ERP ORBE possui atualmente dois sistemas financeiros concorrentes:
   - **Arquitetura Antiga / Legada:** Baseada em `ciclos_operacionais`, `financeiro_consolidados_cliente` e no `MotorFinanceiro.ts`. É a essa tabela que a tela `/financeiro/faturamento` (`FaturamentoCliente.tsx`) responde. Esse motor só roda quando um ciclo operacional de fechamento é aprovado no RH.
   - **Novo Pipeline de Receitas Operacionais:** Baseada em `receitas_operacionais`, `receitas_operacionais_itens` e na trigger autônoma `fn_gerar_receita_operacional_automatica()`. É o pipeline que alimenta o Kanban `/financeiro/receitas` (`ReceitasPipeline.tsx`).
3. **Ausência de Consolidação no Pipeline Ativo:**  
   No novo pipeline homologado (`ReceitasPipeline.tsx`), **FATURAMENTO_MENSAL NÃO CONSOLIDA OPERAÇÕES**.  
   Cada operação por volume com forma de pagamento mensal gera **uma Receita Operacional individual** no momento em que a operação é validada/aprovada. Se houver 30 operações de uma empresa no mês, nascerão 30 receitas individuais no Kanban sob a coluna "Em aberto" (`aguardando_fechamento`).

---

## 2. COMO FUNCIONA ATUALMENTE

### 2.1 Ponto de Seleção da Modalidade
O formulário de lançamento de produção ([OperacaoForm.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/lancamento/OperacaoForm.tsx)) apresenta os presets de seleção inicial ([FormStepSelector.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/lancamento/FormStepSelector.tsx)):
- Preset 1: *À Vista* (`CAIXA_IMEDIATO`)
- Preset 2: *Boleto / Faturamento* (`DUPLICATA`)

Na Etapa 3 do formulário, o usuário escolhe a **Forma de Pagamento** (tabela `formas_pagamento_operacional`).  
Se a forma de pagamento selecionada tiver:
- A coluna `modalidade = 'FATURAMENTO_MENSAL'` (ou nome contendo as palavras `"FATURAMENTO"` ou `"MENSAL"`):
  - A função síncrona `classificarFinanceiroSync` ([src/utils/financeiro.ts:136-137](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/utils/financeiro.ts#L136-L137)) detecta a modalidade como `FECHAMENTO_MENSAL_EMPRESA`.
  - Executa: `vencimento: endOfMonth(dataOp)` ([src/utils/financeiro.ts:173](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/utils/financeiro.ts#L173)).
  - O formulário atribui esse vencimento à coluna física `data_vencimento` do payload que será inserido em `operacoes_producao` ([OperacaoForm.tsx:241-248](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/operacoes/lancamento/OperacaoForm.tsx#L241-L248)).

### 2.2 Onde o Valor é Persistido
- **Tabela `operacoes_producao`:**  
  - Não possui coluna `modalidade_financeira`.
  - Salva `forma_pagamento_id` (UUID referenciando `formas_pagamento_operacional`).
  - Salva `data_vencimento` (DATE = último dia do mês, ex: `2026-09-30`).
  - Salva `status = 'RECEBIDO'` (ou `'pendente'`).

### 2.3 Como a Receita Nasce
A Receita Operacional **não nasce no momento do fechamento mensal**.  
Ela nasce **imediatamente** quando a operação é validada/aprovada e muda de status:
1. O usuário clica em "Validar e Aprovar" na tabela de operações.
2. A RPC `public.rpc_operacao_validar_aprovar` ([20260707190003_fix_rpc_domain_operacoes_atualizado_por.sql:35-38](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260707190003_fix_rpc_domain_operacoes_atualizado_por.sql#L35-L38)) atualiza `operacoes_producao.status = 'AGUARDANDO_FATURAMENTO'`.
3. A trigger `trg_gerar_receita_operacional_automatica` dispara e chama `public.fn_gerar_receita_operacional_automatica()` ([20260912233000_hotfix_receita_trigger_schema_real.sql:11-115](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260912233000_hotfix_receita_trigger_schema_real.sql#L11-L115)).
4. A trigger lê `formas_pagamento_operacional`. Se identificar `FATURAMENTO_MENSAL`:
   - Atribui `v_modalidade := 'FATURAMENTO_MENSAL'`.
   - Atribui `v_status := 'aguardando_fechamento'`.
   - Atribui `v_vencimento := NEW.data_vencimento` (herdado diretamente da operação).
   - Atribui `v_competencia := to_char(NEW.data_operacao, 'YYYY-MM')`.
   - Executa:
     ```sql
     INSERT INTO public.receitas_operacionais (
         tenant_id, empresa_id, unidade_id, modalidade, valor_total, status, competencia, vencimento
     ) VALUES (
         NEW.tenant_id, NEW.empresa_id, NEW.unidade_id, 'FATURAMENTO_MENSAL', NEW.valor_total, 'aguardando_fechamento', '2026-09', NEW.data_vencimento
     );
     INSERT INTO public.receitas_operacionais_itens (
         tenant_id, receita_id, operacao_id, valor_item
     ) VALUES (
         NEW.tenant_id, v_receita_id, NEW.id, NEW.valor_total
     );
     ```

---

## 3. DUPLICATA × FATURAMENTO MENSAL (COMPARAÇÃO LADO A LADO)

| Critério | DUPLICATA | FATURAMENTO MENSAL |
| :--- | :--- | :--- |
| **Quando nasce a Receita?** | Imediatamente ao aprovar a operação (`AGUARDANDO_FATURAMENTO`) | Imediatamente ao aprovar a operação (`AGUARDANDO_FATURAMENTO`) |
| **Gera uma Receita por operação?** | **SIM** (1 operação = 1 receita operacional) | **SIM** (1 operação = 1 receita operacional) *(Bug conceitual)* |
| **Operações são agrupadas?** | Não (cobrança individual) | **NÃO** no pipeline atual |
| **Quando é definido o vencimento?** | No formulário de lançamento | No formulário de lançamento |
| **Quem calcula o vencimento?** | `classificarFinanceiroSync` (`data_operacao + prazo_dias`) | `classificarFinanceiroSync` (`endOfMonth(data_operacao)`) |
| **Regra de cálculo do vencimento** | Prazo em dias (D+N): D+7 global ou override da empresa | Último dia do mês civil da operação |
| **Status inicial da Receita** | `pendente_cobranca` | `aguardando_fechamento` |
| **Quando a cobrança fica disponível?** | Imediatamente na coluna "Cobrança gerada" | Apenas após o usuário clicar em "Consolidar" no card individual |
| **Status da Operação de origem** | `AGUARDANDO_FATURAMENTO` | `AGUARDANDO_FATURAMENTO` |
| **Depende de Lote para nascer?** | Não | Não |
| **Depende de Fechamento para nascer?** | Não | Não |
| **Passa por RH antes?** | Sim (`rpc_rh_aprovar_operacao` / `rpc_operacao_validar_aprovar`) | Sim (idêntico) |
| **Qual tela exibe o registro?** | `/financeiro/receitas` (Aba Duplicata) | `/financeiro/receitas` (Aba Faturamento Mensal) |
| **Aparece em `FaturamentoCliente.tsx`?** | Não | Não |

---

## 4. O QUE SIGNIFICA O "DIA 30" (DESMISTIFICAÇÃO)

> [!IMPORTANT]
> **Evidência Central:** O "dia 30" NÃO é uma regra comercial explícita. Ele é o resultado matemático de `endOfMonth(data_operacao)` para o mês de **Setembro**.

### Evidências no Código:
1. **Frontend (`src/utils/financeiro.ts`, linhas 172-174):**
   ```typescript
   if (modalidade === "FECHAMENTO_MENSAL_EMPRESA") {
     return { modalidade, vencimento: endOfMonth(dataOp) };
   }
   ```
2. **Backend Postgres (`supabase/migrations/20260505_regras_financeiras_nova_tabela.sql`, linhas 130-131):**
   ```sql
   IF v_regra.tipo_liquidacao = 'mensal' THEN
       v_data_vencimento := date_trunc('month', p_data_operacao) + INTERVAL '1 month' - INTERVAL '1 day';
   ```

### Comportamento Real por Mês:
- Operação em `01/09/2026`: Vencimento = `30/09/2026` (29 dias após)
- Operação em `13/09/2026`: Vencimento = `30/09/2026` (17 dias após)
- Operação em `29/09/2026`: Vencimento = `30/09/2026` (1 dia após!)
- Operação em `30/09/2026`: Vencimento = `30/09/2026` (**Vence no mesmo dia da execução!**)
- Operação em `15/10/2026`: Vencimento = `31/10/2026`
- Operação em `10/02/2026`: Vencimento = `28/02/2026` (Fevereiro não possui dia 30)

### Respostas Objetivas:
- **Existe realmente uma regra "vencimento dia 30"?** Não. Existe a regra "vencimento = último dia do mês corrente".
- **É dia 30 do mesmo mês?** Sim, é o fim do mesmo mês em que a operação ocorreu.
- **É D+30?** Não.
- **É dia 30 do mês seguinte?** Não. O código não adiciona 1 mês.
- **É apenas fechamento mensal?** Sim. O desenvolvedor usou a data de término da competência como se fosse a data de vencimento da fatura.
- **Existe configuração por empresa?** Não para faturamento mensal.
- **Existe configuração global?** Apenas o tipo `mensal` cadastrado na migration inicial.
- **A regra está hardcoded?** Sim, `endOfMonth(dataOp)` está hardcoded no frontend e `date_trunc + 1 month - 1 day` no backend.

---

## 5. FUNÇÃO REAL DE "FATURAMENTO POR CLIENTE" (`FaturamentoCliente.tsx`)

A tela [FaturamentoCliente.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/FaturamentoCliente.tsx) (rota `/financeiro/faturamento`) permaneceu **vazia** durante a homologação de DUPLICATA e permanecerá vazia para FATURAMENTO_MENSAL no fluxo atual.

### Por que ela está vazia?
1. **Tabela Consultada:**  
   Ela consulta exclusivamente a tabela `financeiro_consolidados_cliente` via `ConsolidadoService.getByCompetencia()` ([src/services/domain/producao.service.ts:303-306](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/producao.service.ts#L303-L306)).
2. **Quem popula essa tabela:**  
   Apenas o método `MotorFinanceiro.processarFechamento()` ([src/services/operationalEngine/MotorFinanceiro.ts:229](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/operationalEngine/MotorFinanceiro.ts#L229)).
3. **Quem chama `MotorFinanceiro.processarFechamento()`:**  
   Apenas o método `CicloOperacionalService.validarFinanceiro()` ([src/services/operationalEngine/CicloOperacionalService.ts:362](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/operationalEngine/CicloOperacionalService.ts#L362)), que exige que uma linha da tabela `ciclos_operacionais` seja criada operacionalmente, fechada e validada pelo RH.
4. **Desconexão Total do Novo Pipeline:**  
   O novo pipeline de Receitas Operacionais (criado na migration `20260701100000_receitas_operacionais.sql` e evoluído nas migrações de setembro) **não utiliza** `financeiro_consolidados_cliente`. Ele utiliza `receitas_operacionais`.

### O que o botão "Aprovar Lote" faz em `FaturamentoCliente.tsx`?
Executa `ConsolidadoService.approveBatch(ids)`, que roda:
```typescript
await supabase.from('financeiro_consolidados_cliente').update({ status: 'aprovado' }).in('id', ids);
```
**Efeito prático posterior:** **Nenhum.** Não gera contas a receber, não gera boleto, não dispara envio e não se comunica com a tela `/financeiro/receitas`.

---

## 6. COMO OCORRE A CONSOLIDAÇÃO (ANÁLISE DE CENÁRIO)

### Cenário de Teste:
- Empresa: BENEVIDES
- 01/09: Operação A - R$ 100
- 05/09: Operação B - R$ 200
- 13/09: Operação C - R$ 150
- **Resultado Esperado pelo Negócio:** Faturamento Mensal Setembro consolidado em **R$ 450** com 1 única cobrança.

### Diagnóstico Técnico no ORBE:
**Classificação: B) Existe parcialmente / D) Existe de outra maneira desconectada.**

1. **No Pipeline Ativo (`ReceitasPipeline.tsx` / `receitas_operacionais`):**  
   **NÃO CONSOLIDA.**  
   O sistema criará:
   - 1 registro em `receitas_operacionais` de R$ 100 (`aguardando_fechamento`)
   - 1 registro em `receitas_operacionais` de R$ 200 (`aguardando_fechamento`)
   - 1 registro em `receitas_operacionais` de R$ 150 (`aguardando_fechamento`)  
   Todas com vencimento `30/09/2026`.  
   Ao abrir o card no Kanban e clicar no botão "Consolidar Competência & Fechamento" ([ModalReceitaOperacional.tsx:541](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/components/ModalReceitaOperacional.tsx#L541)), o modal executa `updateReceitaMutation` **apenas sobre aquela receita individual**, alterando seu status para `pendente_cobranca`. As 3 operações continuam como 3 faturas separadas.

2. **Na Camada Legada (`MotorFinanceiro.ts`):**  
   O código do `MotorFinanceiro.ts` (linhas 120-155 e 228-250) possui a lógica de somar `total += opTotal` agrupando por `clienteFatId` e gerando 1 consolidado em `financeiro_consolidados_cliente` e 1 linha em `faturas`. Porém:
   - Esse motor não é executado no fluxo de Operações por Volume;
   - Não está conectado ao novo módulo de Receitas;
   - Não possui motor de cobrança ou conciliação bancária acoplado.

---

## 7. COMPETÊNCIA × VENCIMENTO

O ORBE possui os campos no banco, mas **confunde as regras de preenchimento**:
- Na tabela `receitas_operacionais`, existem:
  - `competencia VARCHAR(7)`: gravada como `to_char(NEW.data_operacao, 'YYYY-MM')` (ex: `'2026-09'`). Correto.
  - `vencimento DATE`: gravada como `endOfMonth(data_operacao)` (ex: `'2026-09-30'`). **Incorreto conceitualmente.**

### A falha de negócio:
- Fechamento da competência: `30/09/2026` (data de corte para apuração dos serviços do mês).
- Vencimento do pagamento: Deveria ser uma data posterior acordada com o cliente (ex: dia 10 do mês subsequente, ou D+15 após o fechamento, ou dia 30 do mês seguinte).
- O código atual tratou a data de término do ciclo de apuração como se fosse a data em que o dinheiro deve cair na conta da ESC Log.

---

## 8. CONFIGURAÇÕES EXISTENTES

Auditando [TabMeiosPagamento.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/TabMeiosPagamento.tsx) e a tabela `regras_financeiras`:

1. **Configuração de Duplicatas (Boleto):**  
   - Suporta Prazo Comercial em Dias (D+N).
   - Suporta regra padrão Global (ex: D+7).
   - Suporta override personalizado por Empresa (ex: D+15, D+30).
   - Totalmente funcional e operante no lançamento e no Kanban.
2. **Configuração de Faturamento Mensal:**  
   - **NÃO EXISTE na UI.** A tela `TabMeiosPagamento.tsx` não exibe nem permite editar regras de Faturamento Mensal.
   - Não existe campo de "Dia de Corte/Fechamento" (ex: dia 25, dia 30 ou último dia).
   - Não existe campo de "Dia de Vencimento da Fatura" (ex: dia 05, dia 10 ou dia 15 do mês seguinte).
   - Não existe override de Faturamento Mensal por Empresa.
   - O banco possui apenas um registro seed criado na migration `20260505_regras_financeiras_nova_tabela.sql` com `tipo_liquidacao = 'mensal'` e `prazo_dias = NULL`.

---

## 9. MÁQUINA DE ESTADOS REAL (FLUXO ATUAL)

```
[ Lançamento Encarregado ]
(OperacaoForm.tsx)
  │  Forma de Pgto: Faturamento Mensal
  │  Vencimento calculado: endOfMonth(data_op) -> ex: 30/09/2026
  ▼
[ Operação Gravada ]
(operacoes_producao: status = 'RECEBIDO', data_vencimento = '2026-09-30')
  │
  │  Validação Operacional / RH:
  │  rpc_operacao_validar_aprovar()
  ▼
[ Operação Aprovada ]
(operacoes_producao: status = 'AGUARDANDO_FATURAMENTO')
  │
  │  Trigger de Banco:
  │  trg_gerar_receita_operacional_automatica
  ▼
[ Receita Operacional Gerada ]
(receitas_operacionais: modalidade = 'FATURAMENTO_MENSAL', status = 'aguardando_fechamento')
(receitas_operacionais_itens: 1 item para a operação)
  │
  │  Exibição no Kanban (/financeiro/receitas):
  │  Coluna "Em aberto" (aguardando_fechamento)
  ▼
[ Ação no Modal de Receita ]
(ModalReceitaOperacional.tsx)
  │  Usuário clica em "Consolidar Competência & Fechamento"
  │  Informa/confirma vencimento (default: 30/09/2026)
  │  Status passa para 'pendente_cobranca'
  ▼
[ Cobrança Gerada ]
(Coluna "Cobrança gerada": pendente_cobranca)
  │  Usuário gera PDF da Cobrança / Doc Consolidado
  │  Usuário clica em "Registrar como Enviado" (rpc_receita_registrar_envio)
  ▼
[ Cobrança Enviada ]
(Coluna "Cobrança enviada": cobranca_enviada)
  │  Usuário clica em "Confirmar Recebimento" (rpc_receita_confirmar_recebimento)
  ▼
[ Recebido ]
(receitas_operacionais: status = 'recebido', data_recebimento = CURRENT_DATE)
(operacoes_producao: status_pagamento = 'RECEBIDO', status = 'CONCLUIDO')
  │
  │  Ação de Conciliação Financeira (rpc_receita_conciliar)
  ▼
[ Conciliado ]
(receitas_operacionais: status = 'conciliado' - Ciclo finalizado)
```

---

## 10. ARQUIVOS, TABELAS E RPCS ENVOLVIDOS

### Tabelas do Banco de Dados:
- `public.operacoes_producao` (colunas `forma_pagamento_id`, `data_vencimento`, `data_operacao`, `status`, `status_rh`, `status_pagamento`)
- `public.formas_pagamento_operacional` (colunas `nome`, `modalidade`, `ativo`)
- `public.regras_financeiras` (colunas `modalidade_financeira`, `tipo_liquidacao`, `prazo_dias`, `empresa_id`)
- `public.receitas_operacionais` (colunas `modalidade`, `status`, `competencia`, `vencimento`, `valor_total`)
- `public.receitas_operacionais_itens` (colunas `receita_id`, `operacao_id`, `valor_item`)
- `public.receitas_operacionais_historico` (auditoria das transições financeiras)
- `public.financeiro_consolidados_cliente` (tabela do motor legado consultada por `FaturamentoCliente.tsx`)

### Triggers e Funções do Banco:
- `public.fn_gerar_receita_operacional_automatica()` ([20260912233000_hotfix_receita_trigger_schema_real.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260912233000_hotfix_receita_trigger_schema_real.sql))
- `public.rpc_operacao_validar_aprovar()` ([20260707190003_fix_rpc_domain_operacoes_atualizado_por.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260707190003_fix_rpc_domain_operacoes_atualizado_por.sql))
- `public.rpc_receita_gerar_cobranca()` ([20260707191000_rpc_domain_financeiro.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260707191000_rpc_domain_financeiro.sql))
- `public.rpc_receita_registrar_envio()` ([20260707191000_rpc_domain_financeiro.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260707191000_rpc_domain_financeiro.sql))
- `public.rpc_receita_confirmar_recebimento()` ([20260707191000_rpc_domain_financeiro.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260707191000_rpc_domain_financeiro.sql))
- `public.rpc_receita_conciliar()` ([20260707191000_rpc_domain_financeiro.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20260707191000_rpc_domain_financeiro.sql))

### Arquivos Frontend e Services:
- `src/components/operacoes/lancamento/OperacaoForm.tsx` (cálculo e payload do lançamento)
- `src/utils/financeiro.ts` (funções `classificarFinanceiroSync`, `resolverPrazoDias`, `endOfMonth`)
- `src/pages/Financeiro/ReceitasPipeline.tsx` (Kanban de Receitas)
- `src/pages/Financeiro/components/ModalReceitaOperacional.tsx` (detalhe, botões de ação e transição)
- `src/pages/Financeiro/TabMeiosPagamento.tsx` (gestão de meios de pagamento e prazos)
- `src/pages/Financeiro/FaturamentoCliente.tsx` (tela isolada que lê `financeiro_consolidados_cliente`)
- `src/services/operationalEngine/MotorFinanceiro.ts` (motor antigo de consolidação)

---

## 11. BUGS E INCONSISTÊNCIAS ENCONTRADAS

1. **Falsa Consolidação:**  
   O Kanban de Receitas exibe a aba "Faturamento Mensal", mas cada operação por volume vira uma receita unitária. Não existe agregação por cliente ou por competência.
2. **Confusão Fechamento vs Vencimento:**  
   O sistema preenche `data_vencimento` com `endOfMonth(data_operacao)`. Operações no fim do mês vencem no mesmo dia de sua execução.
3. **Tela `/financeiro/faturamento` Fantasma:**  
   A tela `FaturamentoCliente.tsx` está desprovida de dados porque depende de um fluxo antigo (`ciclos_operacionais`), enquanto todo o desenvolvimento recente de Operações por Volume transita via `receitas_operacionais`.
4. **Ausência de Configuração na UI:**  
   Em `TabMeiosPagamento.tsx`, é impossível configurar qualquer regra para `FATURAMENTO_MENSAL`.
5. **Modal "Consolidar" Ilusório:**  
   O botão "Consolidar Competência & Fechamento" no `ModalReceitaOperacional.tsx` sugere na mensagem que vai agrupar as operações da empresa, mas no código ele apenas muda o status daquela única receita para `pendente_cobranca`.

---

## 12. LACUNAS DE REGRA DE NEGÓCIO

1. **Momento da Geração da Fatura Mensal:**  
   Deverá ser gerada uma única fatura no último dia do mês (ou no primeiro dia do mês seguinte) contendo todas as operações daquele cliente? Ou o encarregado lança normalmente e o sistema cria um lote de faturamento no fechamento?
2. **Dia de Corte vs Dia de Vencimento:**  
   Qual é o dia de corte da competência (ex: todo dia 30, ou último dia do mês civil)?  
   E qual é a regra de vencimento para o cliente pagar a fatura mensal (ex: dia 10 do mês seguinte, D+15 após o fechamento, etc.)?
3. **Agrupamento por Empresa Contratante ou Transportadora:**  
   Na operação logística, quem é faturado no mensal: a Empresa contratante (ex: BENEVIDES) ou a Transportadora que descarregou?
4. **Papel da tela `FaturamentoCliente.tsx`:**  
   Ela deve ser descontinuada em favor do `ReceitasPipeline.tsx` (com aba Faturamento Mensal verdadeiramente consolidada) ou ela deve ser o Hub oficial de fechamento de faturas?

---

## 13. PERGUNTAS PARA O RESPONSÁVEL DA ESC LOG

1. **Na contratação em "Faturamento Mensal", qual é a data de vencimento real do boleto/fatura?**  
   *(Exemplo: fecha no dia 30 e vence no dia 10 do mês seguinte? Ou vence 30 dias após o fechamento?)*
2. **Existe um "Dia de Vencimento" fixo por cliente?**  
   *(Exemplo: Cliente Benevides vence todo dia 10; Cliente Y vence todo dia 15?)*
3. **O cliente que opera no Faturamento Mensal recebe UMA ÚNICA fatura/boleto consolidando todas as operações do mês?**  
   *(Exemplo: 20 descargas no mês de setembro somando R$ 15.000,00 geram 1 boleto de R$ 15.000,00 com relatório anexo?)*
4. **A tela "Faturamento por Cliente" deve ser o local onde o Financeiro confere o consolidado do mês e emite a fatura única?**

---

## 14. FLUXOGRAMA TEXTUAL COMPLETO

```text
[ ENCARREGADO ]
      │
      ├─ Lança Operação por Volume (data: 13/09/2026, valor: R$ 150,00)
      ├─ Seleciona Forma de Pagamento: "Faturamento Mensal"
      │
      ▼
[ CÁLCULO SÍNCRONO NO FORMULÁRIO ]
      │
      ├─ classificarFinanceiroSync() detecta "MENSAL"
      ├─ Vencimento calculado: endOfMonth(13/09/2026) = 30/09/2026
      ├─ operacoes_producao.data_vencimento = '2026-09-30'
      ├─ operacoes_producao.status = 'RECEBIDO'
      │
      ▼
[ VALIDAÇÃO OPERACIONAL / RH ]
      │
      ├─ Encarregado / RH clica em "Validar e Aprovar"
      ├─ rpc_operacao_validar_aprovar() executa
      ├─ operacoes_producao.status = 'AGUARDANDO_FATURAMENTO'
      │
      ▼
[ TRIGGER DO BANCO DE DADOS ]
      │
      ├─ trg_gerar_receita_operacional_automatica dispara
      ├─ Cria 1 registro em receitas_operacionais:
      │    modalidade = 'FATURAMENTO_MENSAL'
      │    status = 'aguardando_fechamento'
      │    vencimento = '2026-09-30'
      │    competencia = '2026-09'
      │    valor_total = R$ 150,00
      ├─ Cria 1 registro em receitas_operacionais_itens vinculando a operação
      │
      ▼
[ KANBAN DE RECEITAS OPERACIONAIS ]
      │
      ├─ Aba "FATURAMENTO MENSAL" (/financeiro/receitas)
      ├─ Coluna "Em aberto" (status: aguardando_fechamento)
      ├─ Exibe o card individual daquela operação
      │
      ▼
[ TRANSIÇÃO DE COBRANÇA ]
      │
      ├─ Financeiro abre o card no modal
      ├─ Clica em "Consolidar Competência & Fechamento"
      ├─ Status passa para 'pendente_cobranca' (Coluna "Cobrança gerada")
      ├─ Financeiro clica em "Gerar Doc. Consolidado" (emite PDF)
      ├─ Financeiro clica em "Registrar como Enviado" -> status: 'cobranca_enviada'
      │
      ▼
[ LIQUIDAÇÃO E CONCILIAÇÃO ]
      │
      ├─ Financeiro clica em "Confirmar Recebimento"
      │    -> receitas_operacionais.status = 'recebido'
      │    -> operacoes_producao.status_pagamento = 'RECEBIDO'
      │    -> operacoes_producao.status = 'CONCLUIDO'
      ├─ Financeiro executa conciliação bancária
      │    -> receitas_operacionais.status = 'conciliado'
```

---

## RESPOSTA OBJETIVA À PERGUNTA PRÁTICA

> **"Se hoje eu lançar uma Operação por Volume em FATURAMENTO MENSAL para BENEVIDES em 13/09/2026, o que exatamente acontecerá?"**

Seguindo estritamente o código e as regras ativas hoje no sistema:

1. **No Lançamento:**  
   O formulário calculará automaticamente `data_vencimento = '2026-09-30'` (último dia do mês civil de setembro, calculado via `endOfMonth`). A operação será gravada na tabela `operacoes_producao` com status `'RECEBIDO'` (ou `'pendente'`).
2. **Na Validação/Aprovação:**  
   Ao ser clicado em "Validar e Aprovar", o status da operação passará para `'AGUARDANDO_FATURAMENTO'`.
3. **No Banco de Dados (Trigger):**  
   A trigger `fn_gerar_receita_operacional_automatica` será disparada imediatamente e criará:
   - **Uma Receita Operacional individual** na tabela `receitas_operacionais` com:
     - `modalidade = 'FATURAMENTO_MENSAL'`
     - `status = 'aguardando_fechamento'`
     - `competencia = '2026-09'`
     - `vencimento = '2026-09-30'`
     - `valor_total = valor daquela operação`
   - Uma linha em `receitas_operacionais_itens` ligando essa receita à operação.
4. **No ERP Interno:**  
   - Na tela **/financeiro/faturamento** (`FaturamentoCliente.tsx`): **NÃO APARECERÁ NADA.** Permanecerá vazia.
   - Na tela **/financeiro/receitas** (`ReceitasPipeline.tsx`): O registro aparecerá na aba **"Faturamento Mensal"**, na coluna **"Em aberto"** (`aguardando_fechamento`).
5. **Na Ação Financeira:**  
   O registro não se agrupará com outras operações da BENEVIDES. Para avançar, o operador financeiro terá que abrir esse card individualmente no modal, clicar em "Consolidar Competência & Fechamento" (que apenas mudará seu status individual para `pendente_cobranca`), depois gerar a cobrança, registrar o envio e confirmar o recebimento de forma unitária. Ao confirmar o recebimento, a operação de origem em `operacoes_producao` será atualizada para `status_pagamento = 'RECEBIDO'` e `status = 'CONCLUIDO'`.
