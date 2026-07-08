# RELATÓRIO EXECUTIVO: AUDITORIA ARQUITETURAL — SERVIÇOS EXTRAS

## 1. Mapeamento da Interface (Front-end, UI)
- **Painel de Lançamento (Encarregado):** `src/pages/Producao/ServicosExtrasLancamento.tsx`
  - Responsabilidade: Tela principal para inserção de Serviços Extras (com snapshot de período, materiais, ISS e prévia financeira no footer).
- **Modal de Lançamento:** `src/components/operacoes/NovoServicoExtraDialog.tsx`
  - Responsabilidade: Alternativa em formato modal para criação rápida do serviço extra.
- **Tabela e Bloco de Controle (Pipeline):** `src/components/operacoes/ServicosExtrasTableBlock.tsx`
  - Responsabilidade: Renderização da tabela, controles de edição, status de pagamento e acionamento logístico de avanço ou devolução no pipeline (via Context).
- **Dashboard de Recebimentos Financeiros:** `src/pages/Operacional/ServicosExtrasRecebidos.tsx`
  - Responsabilidade: Painel gerencial, KPIs Financeiros consolidados e tabela agregada.
- **Central Financeira (Faturamento):** `src/pages/CentralFinanceira.tsx`
  - Responsabilidade: Integração final onde serviços `APROVADO_OPERACAO`/`APROVADO_FINANCEIRO` entram nas abas de aprovação e acompanhamento de receita.

## 2. Mapeamento dos Hooks
- **useOperationalPipeline:** Utilizado fortemente no `ServicosExtrasTableBlock.tsx` e `CentralFinanceira.tsx` para guiar o usuário visualmente na transição dos estágios (UI Pipeline Modal).
- **useQuery / useMutation (TanStack/React-Query):**
  - Buscas de dados em caching: `["servicos_extras_hoje"]`, `["servicos_extras_historico"]`, `["servicos_extras_faturaveis"]`.
  - Mutações de transição: `updatePipelineMutation` (altera pipeline_status), `updateStatusMutation` (altera status_pagamento).

## 3. Mapeamento dos Contexts
- **OperationalPipelineContext (`src/contexts/OperationalPipelineContext.tsx`):**
  - **Responsabilidade:** Gerenciar a modal/sheet de pipeline na tela, fornecendo visualizações progressivas do status (`PENDENTE` > `EM_VALIDACAO` > `APROVADO_OPERACAO` > `APROVADO_FINANCEIRO` > `FATURADO` > `CONCLUIDO`).
  - Funções auxiliares (arquitetura factory): `buildServicosExtrasPipeline`, `buildServicosExtrasDevolvidoPipeline`.
- **AccessControlContext (`useAccessControl`):** Utilizado em `ServicosExtrasTableBlock` para bloquear UI limits: `canAdvance` / `canDevolve` dependente de role (encarregado, gestor, admin, financeiro).

## 4. Mapeamento dos Services
- **ServicosExtrasOperacionaisService (`src/services/domain/despesas.service.ts`):** 
  - *Nota*: Curiosamente ele foi instanciado dentro do `despesas.service.ts` embora represente primariamente uma Receita Operacional.
  - Herda de `BaseService<'servicos_extras_operacionais'>`.
  - Métodos principais: `getMonthsWithData`, `getWithEmpresas` (resolve perfis de auth na query), `create` com higienização de payload (sanitização, `tenant_id` fallback na API proxy, pipeline force `'PENDENTE'`).

## 5. Mapeamento do Banco
- **Tabela Principal:** `public.servicos_extras_operacionais` (conforme `20260520_servicos_extras_operacionais.sql` e a migration de repair `20260608999999_repair_servicos_extras.sql`).
- **Relacionamentos (FK):**
  - `empresa_id` -> `empresas(id)`
  - `tipo_servico_id` -> `tipos_servico_operacional(id)`
  - `forma_pagamento_id` -> `formas_pagamento_operacional(id)`
  - `operacao_id` -> `operacoes_producao(id)` (Vínculo de rastreio de carga principal).
  - `transportadora_id` -> `transportadoras_clientes(id)`
- **Campos críticos integrados:** 
  - `pipeline_status` (Enum), `modalidade_financeira` (Enum restrito a 'CAIXA_IMEDIATO', 'DEPOSITO_IMEDIATO', 'DUPLICATA_FORNECEDOR', 'FECHAMENTO_MENSAL_EMPRESA'), `materiais_snapshot` (JSONB).

## 6. Mapeamento das RPCs
- O sistema principal não depende de RPCs para o fluxo central do pipeline de Serviços Extras, a lógica financeira pesada depende ainda de hooks / clientside mutations ou triggers simples. Há menção de uma action genérica de consolidação (`replace_imported_custos_extras_operacionais` e `processDay` AICore) que afetam tabelas parceiras, mas sem RPC dedicada só para o avanço dos status do serviço extra.

## 7. Mapeamento das Triggers
- **`trg_calcular_total_servico_extra`:** Dispara `BEFORE INSERT OR UPDATE` recaulculando obrigatoriamente `NEW.total := COALESCE(NEW.quantidade, 1) * COALESCE(NEW.valor_unitario, 0)`.
- **`update_servicos_extras_operacionais_updated_at`:** Dispara atualização de data da interação.
- **`trg_set_tenant_id_servicos_extras`:** Previne bypass no frontend; tenta puxar tenant_id logado via `profiles` com segurança definida.

## 8. Mapeamento do Pipeline Técnico
1. **[UI]** `ServicosExtrasLancamento` monta payload + ISS + Materiais ->
2. **[Mutations]** `salvarMutation` -> 
3. **[API]** `ServicosExtrasOperacionaisService.create` ->
4. **[Supabase Filter]** Force Pipeline status = 'PENDENTE' ->
5. **[PL/PGSQL]** Trigger auto-calcula `total` -> Trigger force `tenant_id` -> Insert 
6. **[Operacional / Tabela]** `ServicosExtrasTableBlock` chama Mutações `updatePipelineMutation` passando param states `EM_VALIDACAO` -> ... -> `APROVADO_FINANCEIRO`.
7. **[Central Financeira]** Módulo Financeiro escuta itens com estado pipeline alto e exibe aba.
8. **[UI]** Avanços disparam Visual Flow via `OperationalPipelineContext`.

## 9. Mapeamento das Integrações
- Integra com **Operações Base**: Pode registrar qual OS/Operação mãe disparou a venda do extra (campo `operacao_id`).
- Integra com **Financeiro / Contas a Receber**: Representa títulos faturáveis. Depende das abas no `CentralFinanceira.tsx` p/ puxar as queryes.
- Integra com **Dashboards (Metabase/Analytics)**: A enumeração de status pagamentos garante KPI dinâmico.

## 10. Mapeamento da Segurança
- **RLS (`Row Level Security`):** Proteção baseada em `tenant_id` garantida na base. Profile Tenant Leak evitado pela trigger `set_tenant_id_servicos_extras`.
- **Isolamento e Bloqueio Frontend:** Encarregados não podem evoluir a etapa financeira no Frontend `canAdvance(item)`, restringido via `useAccessControl`. Contudo, é uma proteção estritamente *Client-Side* sem correspondente *Server-Side* nas SQL Policies do Supabase.

## 11. Mapeamento da Auditoria
- Campos de timestamp estrita (`criado_em`, `atualizado_em`).
- Rastreio de Responsabilidade via `criado_por` (Auth UID) mapeado na API service via lookup rápido de join na struct de Profile.
- Coluna `justificativa_devolucao` salva rastreio base. Faltam tabelas de **Log Temporal Histórico Contínuo** para evidenciar horários das transições do `pipeline_status`.

## 12. Mapeamento de Performance
- A Service `getWithEmpresas` realiza *Eager Loading* de quatro tabelas com `select('*, empresas(nome), ...')` que é aceitável, mas realiza um Map secundário brutal para iterar sobre `profiles` de forma linear com um grande `.in('id', array)`. 
- As Queries TanStack têm `queryClient.invalidateQueries({ queryKey: ["operacoes-base"] })` que pode desencadear fetches redundantes do app inteiro.

## 13. Mapeamento de Acoplamento
- A Model `ServicosExtrasOperacionaisService` encontra-se acoplada dentro do arquivo `despesas.service.ts` apesar do serviço extra ser tipificado conceitualmente no negócio como uma Receita. Pode causar fragmentação para a equipe (violação arquitetural cosmética).
- Regra de negócio (Cálculo do ISS e Matérias Primas Extras) operando quase exclusivamente via TypeScript UI no component `ServicosExtrasLancamento.tsx`, passível de ser evadido se uma API key bater direto na API GraphQL/REST do Supabase.

## 14. Fluxo Financeiro (Técnico Real)
1. Inserção pela UI de lançamento -> 
2. Trigger no Postgres (Cálculo Unitário * Qtd) -> (ISS não é validado na DB, é aceito cego do Front) ->
3. Update Pipeline (Client side call para PATCH em 'EM_VALIDACAO' -> 'APROVADO_OPERACAO') ->
4. Na tela *Central Financeira*: Aparecem via Query `ServicosExtrasOperacionaisService.getWithEmpresas`. Lá são filtrados `["APROVADO_OPERACAO", "APROVADO_FINANCEIRO"].includes(s.pipeline_status)` -> 
5. Processamento (RPC Server side / AI Batching) via `AIService.processDay` pode eventualmente amarrá-los ao relatório de Faturamento / Consolidado.

## 15. Riscos Arquiteturais Atuais (Achados)
1. **Client-Trust Security Leak:** As validações de `canAdvance` operam em React. O Postgres expõe a Policy livre para updates: `USING (true) WITH CHECK (true)`, permitindo que qualquer Autenticado force a mudança do campo `pipeline_status` se souber a URI da API.
2. **Separação de Preocupações:** Arquitetura expõe dependência profunda de serviços de Receita sendo definidos em arquivos listados para `despesas`.
3. **Imutabilidade Operacional:** Edit/Update não tem restrição baseada em Status na Database. Se um serviço está em `FATURADO`, o backend base (services/SQL) aceita mudar `valor_unitario` sem bloqueios (confia no Frontend esconder a UI caneta de edit).
4. **Calculadora Cega:** O Back-End re-calcula o total Bruto (QTD * Unitário) com Triggers, **mas NÃO possui** checks/constraints ou triggers para deduzir o ISS ou conferir o *Master Total Líquido*, baseando-se apenas num payload gigante do Front.

> **Status:** Mapeamento concluído com sucesso. A arquitetura foi documentada integralmente baseada na codebase atual sem manipulação do código.
