# PLANO DE IMPLEMENTAÇÃO CONSOLIDADO (HARDENING) — SERVIÇOS EXTRAS

Este documento aglutina e organiza todas as correções e melhorias identificadas nas Fases de Imersão (07.1), Auditoria Arquitetural (07.2) e Homologação Funcional E2E (07.3). Ele serve como roteiro único para a execução do Hardening Definitivo (Fase 07.5).

---

## BLOCO A — Segurança e Governança

### 1. Correção de Client-Trust Leak e Evolução RLS (Pipeline)
- **Identificação:** A tabela `servicos_extras_operacionais` permite update para Autenticados com `USING (true) WITH CHECK (true)`, confiando a lógica de permissões ao frontend (`useAccessControl`).
- **Causa Raiz:** Ausência de regras server-side para alteração do status.
- **Impacto no Negócio:** Usuários mal intencionados ou interceptadores podem avançar o pipeline de serviços via API sem ser de fato do Financeiro.
- **Impacto Técnico:** Fuga das restrições de pipeline estabelecidas no domínio.
- **Prioridade:** 🔴 Crítica.
- **Componentes Afetados:** Tabela `servicos_extras_operacionais`.
- **Estratégia de Implementação:** Refinar a RLS (`UPDATE`) ou criar uma RPC estrita para transição de estágios (`rpc_avancar_servico_extra`) que verifique o papel de admin (claim de JWT) antes de escrever status como `FATURADO` e `CONCLUIDO`.

### 2. Imutabilidade Financeira (Congelamento de Faturamento)
- **Identificação:** Se o faturamento for editado no Back-End, não existe bloqueio na Database no update de `valor_unitario` após status `APROVADO_FINANCEIRO`.
- **Estratégia de Implementação:** Criar uma Trigger `BEFORE UPDATE` que lance `EXCEPTION` se houver tentativa de mudar campos geradores de valor (`quantidade`, `valor_unitario`) quando o `pipeline_status` estiver em instâncias avançadas (apenas deixar alterar `observacao`).

---

## BLOCO B — Fluxo Operacional

### 1. Desbloqueio e Tratamento do Pipeline "Devolvido"
- **Identificação:** Registros devolvidos não permitem novo avanço na interface.
- **Causa Raiz:** Em `ServicosExtrasTableBlock.tsx` e `OperationalPipelineContext.tsx`, o enum de avanço não suporta logicamente o step de saída `DEVOLVIDO` indo para nova validação (falha silenciosa de click sem erro console).
- **Impacto no Negócio:** Serviço fica fisicamente travado.
- **Impacto Técnico:** Loop de vida (lifecycle) quebrado.
- **Prioridade:** 🔴 Crítica.
- **Componentes:** `ServicosExtrasTableBlock.tsx`, `useOperationalPipeline`.
- **Estratégia de Implementação:** Implementar a lógica de switch-case em JavaScript para o status "DEVOLVDO" e "EM_BALANCO", permitindo a rota original (ex: `DEVOLVIDO -> EM_VALIDACAO`) quando o usuário clicar `Avançar Pipeline`.

---

## BLOCO C — Financeiro

### 1. Erro Consolidar Competência (Bloqueio CORS Edge Function)
- **Identificação:** Falha de CORS na Edge function `process-day` que impossibilita a criação do espelho consolidado financeiro do DRE.
- **Causa Raiz:** O backend (Supabase Edge Function / API proxy) não tem o cabeçalho `Access-Control-Allow-Origin` para o local origin, configurado imperfeitamente ou ocorrendo *cold-start preflight failure*.
- **Impacto no Negócio:** Dashboards cegos; CFO não tem KPIs processados.
- **Prioridade:** 🔴 Crítica.
- **Componentes:** `Supabase Edge Functions`, `CentralFinanceira.tsx`.
- **Estratégia de Implementação:** Revisar cabeçalhos CORS na chamada `fetch` ou aplicar proxy. Caso não seja cliente (CORS real do edge), implementar a RPC na database (`plpgsql`) local se o `process-day` basear-se no banco, acionando a RPC através da chamada de fetch tradicional.

### 2. Automação do Cálculo de ISS (Backend)
- **Identificação:** O imposto de ISS é computado no formulário Front-End usando lógica TypeScript em `ServicosExtrasLancamento.tsx`.
- **Prioridade:** 🟡 Média (Arquitetura).
- **Estratégia de Implementação:** Criar / Evoluir a `trg_calcular_total_servico_extra` para que aplique o deduzido do `iss_percentual` sobre o `total` bruto, chegando ao master revenue se necessário.

---

## BLOCO D — Dashboard

### 1. Invalidação de Cache Ineficiente (Dessincronia de Status)
- **Identificação:** Após clicar ações em modais (como devolução de estágio em `ServicosExtrasTableBlock`), o grid se mantém com a badge visual antiga exigindo reload (F5) pelo usuário.
- **Causa Raiz:** Ausência de `queryClient.invalidateQueries({ queryKey: [...] })` após a resposta da mutação `updatePipelineMutation` ter sucesso.
- **Prioridade:** 🟡 Média (UX e Data Flow).
- **Componentes Afetados:** `ServicosExtrasTableBlock.tsx`.
- **Estratégia de Implementação:** No `onSuccess` do React Query mutation, disparar invalidação pontual do cache da listagem de serviços extras.

---

## BLOCO E — UX

### 1. Bloqueio Excessivo na Edição Operacional 
- **Identificação:** O form "Editar" só permite alterar `Observação`/`Descrição`. 
- **Causa Raiz:** O input field de formulário é renderizado como `disabled={true}` e os controllers não suportam edição.
- **Impacto Técnico:** Engessa correções triviais na janela em que deveriam ser livres.
- **Prioridade:** 🟡 Média.
- **Componentes Afetados:** `NovoServicoExtraDialog.tsx` (edit mode).
- **Estratégia de Implementação:** Liberar habilitadores (`disabled={false}`) apenas para status `PENDENTE` e `EM_VALIDACAO`.

### 2. Erro de Concatenação de Quantidade (`11`)
- **Identificação:** O formulário preenche Quantidade: `1` default. Ao digitar, ele não apaga, virando `11`.
- **Prioridade:** 🟢 Baixa (UX, mas pode gerar faturamento altíssimo falso).
- **Estratégia de Implementação:** Ajustar input control (usando `onFocus={(e) => e.target.select()}` ou lidando perfeitamente com valores numéricos no hook form).

---

## BLOCO F — Arquitetura

### 1. Organização do Core Service
- **Identificação:** `ServicosExtrasOperacionaisService` importado em `src/services/domain/despesas.service.ts`.
- **Causa Raiz:** Decisão legada baseada no contexto inicial (serviços costumavam agrupar por infra) desrespeitando o pilar contábil atual de que *Serviço Extra = Receita Faturada*.
- **Impacto Arquitetural:** Confusão de importação.
- **Prioridade:** 🟢 Baixa (Refactoring de Clean Code).
- **Componentes Afetados:** `/domain/despesas.service.ts` e `/domain/receitas.service.ts`.
- **Estratégia de Implementação:** Migrar o construtor da classe e sua importação para `receitas.service.ts`, alterando as chamadas em todas as telas em que está presente (atualização de referências via IDE).

---

## ORDEM CORRETA DE IMPLEMENTAÇÃO E DEPENDÊNCIAS

A implementação (Hardening) deve seguir rigorosamente a cascata abaixo para preservar a segurança antes da experiência, sem causar regressões.

### Passo 1: Banco / Segurança / Governança
- **Ação:** Criar migrations seguras definindo gatilhos contra Update congelado e definindo Políticas RLS / RPC robustas para proteger as abas Faturáveis contra API Postman injects. Imutabilidade e cálculo financeiro server-side.

### Passo 2: Fluxo Operacional
- **Ação:** Arrumar as telas e o `OperationalPipelineContext`. Corrigir os botões falhos da transição de estorno (Status "Devolvido") e liberar edição apenas em status seguro (PENDENTE/EM_VALIDACAO).

### Passo 3: Financeiro / Dashboard
- **Ação:** Invalidações do React Query (para o refetch imediato na Grid) e mapeamento da chamada CORS impeditiva da função Edge `process-day`.

### Passo 4: UX
- **Ação:** Consertar o glitch numérico Quantity `1` -> `11`. Melhorar feedbacks visuais de carregamento e sucesso.

### Passo 5: Refino Arquitetural
- **Ação:** Migrar `ServicosExtrasOperacionaisService` de `despesas.service.ts` para o domínio de receitas. Garantir que os imports do app não quebrem e validar links.

### Estratégia de Validação Pós-Implementação:
Para que isso seja finalizado (Fase 07.5), em cada sub-etapa uma re-leitura pontual da funcionalidade deve ser executada sem depender de pipeline completo. Após todo o bloco, os relatórios unificados comprovarão o endurecimento (domain hardening) do módulo, alçando o projeto à aptidão máxima.
