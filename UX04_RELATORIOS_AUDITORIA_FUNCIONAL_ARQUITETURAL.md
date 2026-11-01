# UX04 — RELATÓRIOS V2
# FASE 01 — AUDITORIA FUNCIONAL, ARQUITETURAL E DE UTILIDADE

> **Status:** Concluído — Read-Only / Auditoria / Diagnóstico  
> **Data:** 03 de Outubro de 2026  
> **Ambiente:** ERP ORBE (ESC LOG 2026)  
> **Princípio:** Nenhuma linha de código ou interface alterada. Estritamente diagnóstico e mapeamento de evidências.

---

## 1. RESUMO EXECUTIVO

O módulo de Relatórios do ERP ORBE passou por uma auditoria completa de ponta a ponta (código-fonte, rotas, services, banco de dados Supabase, controle de acesso e componentes visuais).

### Principais Constatações Técnicas:

1. **O Módulo Atual é um "Módulo Depósito / Frankenstein":**  
   A rota principal `/relatorios` (`CentralRelatoriosIntegracoes.tsx`) agrupa recursos completamente heterogêneos em abas:
   - Um catálogo de relatórios genéricos com dados mockados/desconectados;
   - Uma tela de automação/agendamentos (`Agendamentos.tsx`) cuja execução é apenas uma simulação em memória (`setTimeout(..., 1500)`);
   - Um construtor de colunas de exportação (`LayoutsExportacao.tsx` / `LayoutEditorModal.tsx`) desconectado de qualquer motor real de exportação;
   - Três telas de configuração técnica e integração contábil (`IntegracaoContabil.tsx`, `MapeamentoContabil.tsx`, `LogsIntegracao.tsx`) que pertencem ao domínio fiscal/contábil (Domínio Sistemas), e não ao usuário final de relatórios.

2. **Desconexão Radical entre o Catálogo e os Dados Reais:**  
   O catálogo oficial no Supabase (`relatorios_catalogo`) possui exatamente 7 itens cadastrados. No entanto, ao abrir a tela de detalhe (`RelatorioDetalhe.tsx`):
   - Apenas 3 relatórios possuem desvio de rota por slug/nome (`log-auditoria`, `inconsistencias-ponto` e `faturamento-cliente`).
   - Os outros 4 relatórios ("Movimentação Diária", "Espelho de Ponto Mensal", "Extrato de Banco de Horas", "Lançamentos Contábeis") caem no fallback: executam `OperacaoService.getAll()` e exibem colunas de **operações logísticas** (`transportadora`, `tipo_servico`, `valor_total_materiais`, `valor_total`). Um relatório de "Espelho de Ponto" exibe dados de descarga e materiais!
   - O relatório "Inconsistências de Ponto" executa `OperacaoService.getInconsistencies()`, que consulta a tabela legada de **operações logísticas** (`operacoes`), e não os apontamentos de ponto do RHID / `registros_ponto`.

3. **Ausência de Filtro de Empresa / Risco de Vazamento Multi-tenant:**  
   Na tela `RelatorioDetalhe.tsx`, os filtros disponíveis são apenas Mês e Ano (`competencia`). **Não existe filtro por Empresa** (`empresa_id`). Ao emitir o relatório ou exportar CSV, dados de todas as empresas do tenant são consolidados indistintamente na mesma lista.

4. **Duplicação com Módulos Especialistas Estabilizados:**  
   Os recursos com real valor funcional já existem e operam com muito mais maturidade dentro de suas próprias telas especialistas:
   - *Log de Auditoria:* já existe em `/governanca/auditoria` com busca por usuário, filtro por módulo, filtro por impacto e exportação CSV funcional.
   - *Faturamento por Cliente:* já existe em `/financeiro/faturamento` com seletor de empresa, aprovação em lote, impressão e emissão de PDF formal (`generateFaturaLotePDF`).
   - *Extrato de Banco de Horas:* já existe em `/banco-horas` com timeline, filtro de status, cálculo de saldo em minutos e exportação CSV robusta.
   - *Espelho de Ponto / Ponto CLT:* o domínio oficial é gerido pelo motor RH e `/operacional/pontos`.

5. **Exportação Fictícia x Realidade:**  
   Todos os 7 itens do catálogo anunciam suportar `["PDF", "Excel", "CSV"]`. Porém, no código de `RelatorioDetalhe.tsx`, existe exclusivamente um botão "Exportar CSV" que formata uma string em memória. Não existe geração de PDF nem de XLSX no módulo de Relatórios.

---

## 2. ARQUITETURA ATUAL DO MÓDULO

### 2.1 Rotas Registradas (`src/App.tsx`)

| Rota | Componente | Arquivo de Origem | Papel Declarado |
|---|---|---|---|
| `/relatorios` | `CentralRelatoriosIntegracoes` | `src/pages/CentralRelatoriosIntegracoes.tsx` | Hub principal com tabs: Catálogo, Agendamentos, Layouts, Integração, Mapeamento, Logs |
| `/relatorios/legado` | `RelatoriosHub` | `src/pages/Relatorios/RelatoriosHub.tsx` | Versão anterior do hub (grid simples com sidebar de categorias) |
| `/relatorios/detalhe/:id` | `RelatorioDetalhe` | `src/pages/Relatorios/RelatorioDetalhe.tsx` | Visualização de tabela/grid, filtros de competência e exportação CSV |
| `/relatorios/agendamentos` | `Agendamentos` | `src/pages/Relatorios/Agendamentos.tsx` | Gestão de disparos periódicos de relatórios por e-mail |
| `/relatorios/layouts` | `LayoutsExportacao` | `src/pages/Relatorios/LayoutsExportacao.tsx` | Cadastro de templates customizados de colunas para exportação |
| `/relatorios/integracao` | `IntegracaoContabil` | `src/pages/Relatorios/IntegracaoContabil.tsx` | Painel de sincronização contábil (Domínio Sistemas) |
| `/relatorios/mapeamento` | `MapeamentoContabil` | `src/pages/Relatorios/MapeamentoContabil.tsx` | De-para de tipos operacionais para contas contábeis |
| `/relatorios/integracao/logs`| `LogsIntegracao` | `src/pages/Relatorios/LogsIntegracao.tsx` | Histórico de envios da integração contábil |
| `/cliente/relatorios` | `ClientReports` | `src/pages/Cliente/ClientReports.tsx` | Portal externo do cliente (faturas e consolidados mensais) |

---

## 3. INVENTÁRIO COMPLETO DE RECURSOS

| Recurso | Rota | Componente | Fonte de Dados | Filtros | Exportação | Perfil Autorizado | Situação Real |
|---|---|---|---|---|---|---|---|
| **Catálogo Central** | `/relatorios` | `CentralRelatoriosIntegracoes.tsx` | Supabase `relatorios_catalogo` + `relatorios_favoritos` | Categoria, Busca texto, Foco (todos, favoritos, decisão) | Não possui direta | Admin, Financeiro, Gestor | Funcional na listagem; dados do catálogo estáticos |
| **Atalhos do Dia** | `/relatorios` (tab catálogo) | `CentralRelatoriosIntegracoes.tsx` | `reports_catalog` (filtro local por palavras-chave) | Busca rápida | Botão "Gerar agora" (dispara apenas toast mock) | Admin, Financeiro, Gestor | Mock / Ação decorativa (apenas `toast.success`) |
| **Agendamentos** | `/relatorios` & `/relatorios/agendamentos` | `Agendamentos.tsx` | Supabase `relatorios_agendamentos` | Nenhum (apenas modal de criação) | Não possui | Admin, Financeiro, Gestor | **Simulação**: Disparo manual faz `setTimeout(1500)` e toast de sucesso. Não há backend cron. |
| **Layouts de Exportação** | `/relatorios` & `/relatorios/layouts` | `LayoutsExportacao.tsx` | Supabase `relatorios_layouts_exportacao` | Nenhum | Construtor de colunas CSV | Admin, Financeiro, Gestor | **Desconectado**: CRUD existe no banco, mas nenhum serviço de exportação consome essa tabela. |
| **Integração Contábil** | `/relatorios` & `/relatorios/integracao` | `IntegracaoContabil.tsx` | Supabase `contabil_configuracao` | Nenhum | Disparo manual "Mensal" / "Parcial" | Admin, Financeiro, Gestor | **Simulação**: grava linha de "sucesso" em `contabil_logs_integracao` sem payload contábil real. |
| **Mapeamento Contábil** | `/relatorios` & `/relatorios/mapeamento` | `MapeamentoContabil.tsx` | Supabase `contabil_mapeamento` | Busca texto | De-Para de conta | Admin, Financeiro, Gestor | Parcial: Interface de plano de contas, isolada do fluxo operacional. |
| **Logs de Integração** | `/relatorios` & `/relatorios/integracao/logs`| `LogsIntegracao.tsx` | Supabase `contabil_logs_integracao` | Origens, Últimos 30 dias (estático) | Não possui | Admin, Financeiro, Gestor | Funcional na listagem de execuções da tabela `contabil_logs_integracao`. |
| **Relatório Detalhe** | `/relatorios/detalhe/:id` | `RelatorioDetalhe.tsx` | Condicional por slug/nome no código React | Competência (Mês/Ano) | CSV Client-Side | Admin, Financeiro, Gestor | **Crítico**: colunas e datasets desconectados do propósito do catálogo; sem filtro de empresa. |
| **Relatório DRE** | `/financeiro/dre` | `RelatorioDRE.tsx` | `DashboardConsolidadoService.getKpisAggregate` | Ano, Mês | Não possui | Admin, Financeiro | Pertence ao módulo Financeiro (UX03 finalizada no UX Lab). |
| **Relatórios do Cliente** | `/cliente/relatorios` | `ClientReports.tsx` | `PortalService.getConsolidados` + `FaturaService` | Competência, Status, Data Range | Download PDF/Extrato | Cliente Externo | Estabilizado no Portal do Cliente. |

---

## 4. FONTES DE DADOS E SERVICES

### 4.1 Tabelas no Banco Supabase

1. `relatorios_catalogo`:
   - Registros reais encontrados no banco: **7 linhas**
   - Campos: `id`, `nome`, `descricao`, `categoria`, `formatos_disponiveis`, `filtros_suportados`, `created_at`, `updated_at`.
   - Políticas RLS: A migration `20260511_multitenant_correct_model.sql` executou `DROP POLICY IF EXISTS "Read access for authenticated" ON public.relatorios_catalogo;` e **não recriou** uma policy explícita, mantendo a leitura restrita ou herdada.
2. `relatorios_favoritos`:
   - Relaciona `user_id` com `relatorio_id`.
3. `relatorios_agendamentos`:
   - Campos: `nome`, `relatorio_id`, `frequencia`, `destinatarios`, `status`.
   - Situação real: Tabela atualmente vazia (`[]`).
4. `relatorios_layouts_exportacao`:
   - Campos: `nome`, `tipo`, `destino`, `status`, `colunas` (JSONB).
   - Situação real: Tabela atualmente vazia (`[]`).
5. `contabil_configuracao`:
   - Armazena status e configuração para o sistema contábil de destino.
6. `contabil_mapeamento`:
   - Armazena `operacao_tipo`, `conta_contabil`, `classificacao`, `empresa_id`.
7. `contabil_logs_integracao`:
   - Registros de disparos de integração com status, data de execução e detalhe de erro.

### 4.2 Services Mapeados

- `ReportService` (`src/services/report.service.ts`):
  - `getAll()`: consulta `relatorios_catalogo`.
  - `getFavorites(userId)`: consulta `relatorios_favoritos`.
  - `toggleFavorite(userId, reportId)`: insere/remove favorito.
  - `getAgendamentos()`: consulta `relatorios_agendamentos`.
  - `createAgendamento()`, `updateAgendamento()`, `deleteAgendamento()`.
- `LayoutService` (`src/services/report.service.ts`):
  - Herda de `BaseService<'relatorios_layouts_exportacao'>`. CRUD genérico sem acoplamento a gerador de CSV.
- `AccountingService` (`src/services/accounting.service.ts`):
  - `getMapeamentos(empresaId)`: consulta `contabil_mapeamento`.
  - `getLogs()`: consulta `contabil_logs_integracao`.
  - `triggerIntegration(tipo, sistema)`: insere linha com status `'sucesso'` direto na tabela de logs.

---

## 5. CLASSIFICAÇÃO FUNCIONAL OBRIGATÓRIA (CATEGORIAS A até H)

| Item Avaliado | Categoria Atribuída | Justificativa Técnica Baseada no Código |
|---|---|---|
| **Catálogo de Relatórios** | **G — REDUNDANTE / DUPLICADO** & **H — NÃO COMPROVADA** | Lista títulos estáticos sem conexão com os pipelines reais das operações e do RH. Os itens apontam para tabelas genéricas. |
| **Relatório: "Log de Auditoria"** | **G — REDUNDANTE / DUPLICADO** | Idêntico ao módulo nativo `/governanca/auditoria`. A tela nativa possui filtros superiores e exportação completa. |
| **Relatório: "Faturamento por Cliente"** | **G — REDUNDANTE / DUPLICADO** | Idêntico à tela `/financeiro/faturamento` (`FaturamentoCliente.tsx`), que já possui filtro de empresa, aprovação em lote e PDF formal. |
| **Relatório: "Inconsistências de Ponto"** | **B — CONSULTA OPERACIONAL** (com bug estrutural) | O usuário precisa corrigir batidas, não apenas ver uma tabela. Além disso, busca a tabela errada (`operacoes` em vez de `registros_ponto`). |
| **Relatório: "Movimentação Diária"** | **B — CONSULTA OPERACIONAL** | Trata-se de uma listagem operacional diária de entradas e saídas que pertence à Central Operacional ou ao Diário de Bordo. |
| **Relatório: "Espelho de Ponto Mensal"** | **D — DOCUMENTO** | Espelho de ponto é um documento formal legal da CLT para assinatura de colaboradores, pertencente ao Motor RH/Folha. |
| **Relatório: "Extrato de Banco de Horas"** | **G — REDUNDANTE / DUPLICADO** | Já existe com profundidade técnica e rastreabilidade na tela `/banco-horas` (`PainelGeral.tsx`). |
| **Relatório: "Lançamentos Contábeis"** | **E — EXPORTAÇÃO** | Trata-se de um layout de exportação de dados para software contábil, e não de um relatório gerencial para tomada de decisão. |
| **Aba Agendamentos** | **H — FINALIDADE NÃO COMPROVADA** | O disparo é simulado via front-end (`setTimeout`). Não há worker, cron ou Edge Function enviando e-mails. |
| **Aba Layouts de Exportação** | **H — FINALIDADE NÃO COMPROVADA** | Cria esquemas de colunas em banco que não são consumidos por nenhuma rotina do sistema. |
| **Abas Integração / Mapeamento / Logs** | **F — AÇÃO OPERACIONAL / CONFIGURAÇÃO TÉCNICA** | Pertencem à área de "Governança / Integrações", e não ao módulo de Relatórios de Negócio. |

---

## 6. AUDITORIA DA TELA ATUAL (`CentralRelatoriosIntegracoes.tsx` e `RelatorioDetalhe.tsx`)

### 6.1 `CentralRelatoriosIntegracoes.tsx`
- **Header:** Título "Central de Relatórios e Integrações" e subtítulo de autoajuda ("Menos varredura, mais decisão...").
- **Cards de Ação Rápida:**
  - "Gerar relatório": abre o primeiro favorito ou detalhe do catálogo.
  - "Ajustar automação": alterna para a aba Agendamentos.
  - "Ver integração": alterna para aba Logs ou Integração.
- **Métricas:** 5 cards numéricos (Total de relatórios, Favoritos, Agendamentos ativos, Integrações ativas, Falhas recentes). Representam a saúde da infraestrutura de relatórios, não a saúde da operação.
- **Tabs:** 6 abas (Catálogo, Agendamentos, Layouts, Integração Contábil, Mapeamento, Logs do Sistema). Mistura parametrização técnica com consulta de dados.
- **Filtros do Catálogo:** Barra de busca textual e botões de filtro por categoria (Operacional, Financeiro, Faturamento, Banco de horas, Auditoria, Contábil/Fiscal).

### 6.2 `RelatorioDetalhe.tsx`
- **Header e Controles:** Botões "Editar Filtros" (Popover com Mês e Ano), "Agendar" (redireciona para `/relatorios/agendamentos`), "Exportar CSV" e botão de configuração de layouts.
- **Indicadores no Topo:** "Total de Registros", "Valor Consolidado" (soma matemática simples da coluna de valores), "Inconsistências" e "Competência Ref.".
- **Tabela / Grid:** Alternador entre visão de tabela e cards (grid).
- **Roteamento de Dados no Front-end (`RelatorioDetalhe.tsx`, Linhas 72-88):**
  ```typescript
  if (report.slug === "log-auditoria" || report.nome === "Log de Auditoria") {
      const logs = await AuditoriaService.getAll();
      return Array.isArray(logs) ? logs : [];
  }
  if (report.slug === "inconsistencias-ponto" || report.nome === "Inconsistências de Ponto") {
      const incs = await OperacaoService.getInconsistencies();
      return Array.isArray(incs) ? incs : [];
  }
  if (report.slug === "faturamento-cliente" || report.nome === "Faturamento por Cliente") {
      const data = await ConsolidadoService.getByCompetencia(competencia);
      return (data as any)?.colaboradores || (data as any)?.clientes || [];
  }

  // FALLBACK PARA TODOS OS DEMAIS RELATÓRIOS DO SISTEMA:
  const ops = await OperacaoService.getAll();
  return Array.isArray(ops) ? ops : [];
  ```
  **Conclusão da Auditoria Visual e Funcional:** A tela foi construída como um template genérico estático que não reflete a realidade das entidades do ORBE.

---

## 7. O QUE É "RELATÓRIO" PARA O ORBE?

### Princípio Testado:
> *"Relatório é uma visão parametrizada de dados históricos ou consolidados, destinada a consulta, conferência, prestação de informação ou extração, sem ser o principal ambiente de execução do processo."*

### O que um relatório no ORBE DEVE responder:
- **O que aconteceu?** (Ex: 1.450 toneladas descarregadas; 42 diaristas pagos; 180 horas extras realizadas).
- **Quanto custou ou faturou?** (R$ Bruto, ISS retido, Custos extras agregados, R$ Líquido).
- **Quando?** (Período / competência / semana).
- **Onde?** (Unidade / filial / centro logístico).
- **Com quem?** (Transportadora, Cliente tomador, Fornecedor ou Equipe de colaboradores).
- **Qual a situação?** (Conciliado, faturado, pago, homologado).

### O que NÃO deve acontecer dentro de Relatórios:
- **Aprovar lotes** (função das telas de Aprovações RH / Financeiro).
- **Corrigir batidas de ponto** (função da Regularização de Ponto).
- **Lançar operações, custos ou serviços** (função do Portal do Encarregado / Lançamentos).
- **Gerar e transmitir remessas bancárias** (função da Central Bancária / CNAB).
- **Cadastrar de-para contábil** (função de Configurações / Governança).

---

## 8. IDENTIFICAÇÃO DE DUPLICIDADES NO SISTEMA

| Recurso em Relatórios | Também Existe em | Mesmo Propósito? | Duplicação? | Recomendação Arquitetural |
|---|---|---|---|---|
| **Log de Auditoria** | `/governanca/auditoria` | Sim (Auditoria de ações do sistema) | **Sim (100% duplicado)** | **Remover de Relatórios**. Manter em Governança / Auditoria com exportação contextual. |
| **Faturamento por Cliente** | `/financeiro/faturamento` | Sim (Visão mensal faturada por cliente) | **Sim (Duplicado e incompleto)** | Manter a execução e emissão de faturas no **Financeiro**. Criar em Relatórios apenas o *Relatório Gerencial de Faturamento e Receitas* parametrizado. |
| **Extrato de Banco de Horas** | `/banco-horas` | Sim (Consulta de saldos de BH) | **Sim (Duplicado)** | Manter o cockpit de tratamento em `/banco-horas`. Manter em Relatórios apenas o *Relatório Consolidado de Banco de Horas* para conferência da folha. |
| **Inconsistências de Ponto** | `/inconsistencias` & `/operacional/pontos` | Sim (Batidas inválidas) | **Sim (Conceitual e técnico)** | **Remover de Relatórios**. A resolução de inconsistência é uma tarefa operacional que exige ação corretiva. |
| **Mapeamento e Integração Contábil** | `/configuracoes` & `/governanca` | Não é relatório, é configuração de integração externa | **Indevidamente alocado** | Mover para **Governança / Automação / Integrações**. Retirar do módulo de Relatórios. |
| **DRE Operacional** | `/financeiro/dre` & UX Lab DRE V2 | Não é relatório estático, é análise econômica multidimensional | **Risco de sobreposição** | Não duplicar DRE em Relatórios. Manter como módulo de inteligência econômica independente. |

---

## 9. RELATÓRIO × CONSULTA OPERACIONAL × DOCUMENTO × EXPORTAÇÃO

Para evitar que a V2 recrie os mesmos erros, definimos com rigor as 4 fronteiras operacionais:

1. **CONSULTA OPERACIONAL:**
   - *Exemplo:* "Localizar a placa ABC-1234 do dia 15/09 para conferir o peso da carga."
   - *Lugar ideal:* Tabela com busca rápida na própria tela da **Operação por Volume** ou na **Central Operacional**.
2. **RELATÓRIO:**
   - *Exemplo:* "Extrato analítico de todas as operações realizadas para o Cliente X no 3º Trimestre de 2026, com volume, valor unitário, ISS retido e margem, exportável em CSV e PDF."
   - *Lugar ideal:* **Módulo Relatórios V2**.
3. **DOCUMENTO (FORMAL):**
   - *Exemplo:* "Ficha de Fechamento da Operação", "Espelho de Ponto Individual com Assinatura", "Fatura de Cobrança em PDF", "Comprovante de Pagamento CNAB".
   - *Lugar ideal:* Gerado de forma contextual dentro do registro/lote de origem (ex: botão "Emitir PDF" na fatura).
4. **EXPORTAÇÃO:**
   - *Exemplo:* Botão "Exportar CSV" presente no topo de uma tabela de diaristas para abrir no Excel.
   - *Lugar ideal:* Componente utilitário presente em qualquer tabela do sistema. Não justifica a criação de uma tela chamada "Relatório".

---

## 10. DOMÍNIOS REPORTÁVEIS DO ORBE REAL

Mapeamento baseado estritamente nas tabelas reais do banco de dados e nos motores já homologados:

| Domínio do Negócio | Tabelas de Dados Reais | Visão Histórica? | Segregação por Empresa? | Segregação por Período? | Status de Homologação dos Dados | Exportável Atualmente? |
|---|---|---|---|---|---|---|
| **Operações por Volume** | `operacoes_producao`, `operacoes_colaboradores` | Sim (`data_operacao`) | Sim (`empresa_id`) | Sim (`competencia`) | Homologado | Parcial (via PDF de Ficha ou Telas) |
| **Serviços Extras** | `servicos_extras_operacionais` | Sim (`data_servico`) | Sim (`empresa_id`) | Sim (`competencia`) | Homologado | Parcial (via PDF Cobrança) |
| **Custos Extras** | `custos_extras_operacionais` | Sim (`data_custo`) | Sim (`empresa_id`) | Sim (`competencia`) | Homologado | Não centralizado |
| **Diaristas (Mão de Obra)** | `ciclos_diaristas`, `lote_pagamento_diaristas`, `lote_pagamento_itens` | Sim (`data_inicio`, `data_fim`) | Sim (`empresa_id`) | Sim (Ciclo semanal) | Homologado E2E | Não há relatório consolidado de diárias |
| **Ponto CLT & Apontamentos** | `registros_ponto`, `registros_ponto_decisoes` | Sim (`data`) | Sim (`empresa_id`) | Sim (`competencia`) | Em homologação (Workflow B) | Somente via tela de batidas |
| **Banco de Horas** | `banco_horas_regras`, `resultados_processamento` | Sim (`data`) | Sim (`empresa_id`) | Sim (Mensal) | Homologado | Sim (CSV nativo em `/banco-horas`) |
| **Intermitentes** | `lotes_intermitentes`, `itens_intermitentes` | Sim (`data`) | Sim (`empresa_id`) | Sim (Período) | Homologado | Parcial |
| **Faturamento / Receitas** | `financeiro_receitas`, `faturas_clientes` | Sim (`vencimento`, `emissao`) | Sim (`empresa_id`) | Sim (`competencia`) | Homologado | Sim (PDF Fatura e PDF Cobrança) |
| **Despesas & Pagamentos** | `cnab_remessas`, `cnab_retornos` | Sim (`data_geracao`) | Sim (`empresa_id`) | Sim (Mensal) | Homologado | Sim (Arquivos CNAB / Histórico) |

---

## 11. INVENTÁRIO E ANÁLISE DE FILTROS

1. **Filtros Atuais em `RelatorioDetalhe.tsx`:**
   - `competencia`: Mês (01 a 12) e Ano (2025, 2026, 2027).
   - **Diagnóstico:** Incompleto. Não possui filtro de datas customizadas (de/até) nem seleção semanal.
2. **Filtros Ausentes (Essenciais para o Negócio Logístico):**
   - **Empresa / Unidade:** Fundamental para qualquer operação multi-unidade.
   - **Cliente Tomador:** Necessário para conferência comercial e faturamento.
   - **Transportadora / Fornecedor:** Necessário para conferência de descargas e serviços.
   - **Colaborador:** Essencial para relatórios de RH e produção.
   - **Status da Operação / Lote:** Filtrar apenas o que foi aprovado/homologado.

---

## 12. ANÁLISE DE MULTI-TENANT E ISOLAMENTO POR EMPRESA

1. **Isolamento por `tenant_id`:**
   - O Supabase aplica RLS via `tenant_id = public.current_tenant_id()`.
   - **Risco Auditado:** As consultas em `RelatorioDetalhe.tsx` utilizam os services base que respeitam o tenant autenticado. Não há vazamento entre diferentes inquilinos de infraestrutura.
2. **Isolamento por `empresa_id` (Operações ESC LOG):**
   - **VULNERABILIDADE FUNCIONAL:** O ORBE opera com múltiplas empresas sob o mesmo tenant (ex: Benevides, Castanhal, etc.).
   - A tela atual de detalhe do relatório **não aplica cláusula `.eq('empresa_id', ...)`**.
   - **Impacto:** Um usuário visualizando o relatório de faturamento ou operações vê dados misturados de todas as empresas do grupo, sem possibilidade de isolar a prestação de contas de uma filial específica.

---

## 13. PERMISSÕES E ACESSO POR PERFIL

Mapeamento no arquivo `src/lib/access-control.ts`:

- **Admin:** Acesso total a `/relatorios` e suas subrotas.
- **Financeiro:** Possui `central_de_relatorios: allowActions(["ver", "exportar"])`. Acesso liberado no Sidebar e nas rotas.
- **Gestor:** Possui `central_de_relatorios: allowActions(["ver", "exportar"])`. Acesso liberado.
- **RH:** **NÃO POSSUI** o módulo `central_de_relatorios` no preset padrão (linhas 77-84). Ou seja, o usuário com perfil de RH não enxerga a opção "Relatórios" no menu, apesar de precisar emitir relatórios de Ponto, Banco de Horas e Diaristas!
- **Encarregado:** Não tem acesso a relatórios (correto, perfil focado em apontamento operacional mobile/desktop).

---

## 14. EXPORTAÇÕES E INFRAESTRUTURA REUTILIZÁVEL

### 14.1 O que já existe e pode ser reaproveitado:
1. **Geração de PDF Vetorial:**
   - Bibliotecas: `jspdf` e `jspdf-autotable`.
   - Utilitários existentes e homologados:
     - `src/utils/pdfOperacao.ts` (`generateOperacaoFichaPDF`)
     - `src/utils/pdfFaturamento.ts` (`generateFaturaLotePDF`)
     - `src/utils/pdfCobranca.ts` (`generateCobrancaPDF`)
   - Podem ser reaproveitados para desenhar relatórios formais em PDF com cabeçalho padrão ESC LOG.
2. **Geração de CSV com Compatibilidade Excel:**
   - Padrão já validado em `src/pages/Governanca/Auditoria.tsx` e `src/pages/BancoHoras/PainelGeral.tsx`:
     - Uso de `\uFEFF` (BOM UTF-8 para evitar caracteres corrompidos no Excel brasileiro).
     - Delimitador ponto e vírgula (`;`).
     - Escape de aspas duplas com `csvEscape`.
3. **Formatadores Padronizados:**
   - `formatCurrency` (`Intl.NumberFormat('pt-BR')`)
   - `date-fns` (`ptBR`)
   - `formatTotal` (conversão de minutos para `Xh Ym`)

---

## 15. VOLUME E RISCOS DE PERFORMANCE

| Ponto Auditado | Comportamento Atual | Risco Técnico | Justificativa |
|---|---|---|---|
| `OperacaoService.getAll()` no detalhe | Carrega 100% da tabela `operacoes` na memória do navegador | **ALTO** | Sem paginação no banco (LIMIT/OFFSET). Com o crescimento da base logística, causará lentidão extrema ou estouro de memória no cliente. |
| `AuditoriaService.getAll()` | Carrega todos os logs de auditoria | **MÉDIO / ALTO** | Tabela de auditoria tende a crescer exponencialmente. Necessita paginação e filtro obrigatório por data. |
| Ausência de View Agregada | O cálculo do totalizador soma linhas no front-end (`calculateTotalConsolidado`) | **MÉDIO** | Deveria ser computado via RPC ou View agregada no PostgreSQL. |

---

## 16. MATRIZ DE UTILIDADE DOS RECURSOS ATUAIS

| Recurso Auditado | Usuário-Alvo | Pergunta que Responde | Frequência | Valor Operacional | Melhor Localização | Decisão Preliminar |
|---|---|---|---|---|---|---|
| **Movimentação Diária** | Encarregado / Operações | "Quais cargas foram movimentadas hoje?" | Diária | Alto | Central Operacional | **TRANSFORMAR EM CONSULTA OPERACIONAL** |
| **Inconsistências de Ponto** | RH | "Quais colaboradores estão com batidas faltando?" | Diária | Crítico | Painel RH / Ponto | **MOVER PARA MÓDULO ESPECIALISTA (RH)** |
| **Espelho de Ponto** | RH / Colaborador | "Qual o documento oficial de batidas do mês?" | Mensal | Legal / Crítico | Gestão de Colaboradores / RH | **MANTER COMO DOCUMENTO CONTEXTUAL** |
| **Faturamento por Cliente** | Financeiro / Diretoria | "Qual o valor total a receber por cliente?" | Mensal | Crítico | Relatórios / Financeiro | **MANTER EM RELATÓRIOS (Refatorado como Relatório Gerencial)** |
| **Extrato de Banco de Horas** | RH / Gestor | "Qual o passivo de horas por filial?" | Mensal | Alto | Relatórios / RH | **MANTER EM RELATÓRIOS (Visão consolidada da competência)** |
| **Log de Auditoria** | Admin / Governança | "Quem alterou o valor do lote X?" | Eventual | Auditoria | Governança | **MOVER PARA GOVERNANÇA (Já existe lá)** |
| **Lançamentos Contábeis** | Financeiro / Contabilidade | "Exportar arquivo para o Domínio Sistemas" | Mensal | Médio | Governança / Integrações | **MOVER PARA ÁREA DE INTEGRAÇÕES** |
| **Agendamentos** | Diretoria | "Enviar relatório semanal por e-mail" | Não funcional | Nulo hoje | Backlog Futuro | **DESATIVAR (Evitar promessa de recurso inexistente)** |
| **Layouts de Exportação** | Usuário Avançado | "Personalizar colunas do CSV" | Não conectado | Nulo hoje | Backlog Futuro | **DESATIVAR (Desconectado do sistema)** |

---

## 17. OS 6 RELATÓRIOS-CHAVE CENTRAIS PARA O ORBE

Com base nas dores operacionais e financeiras reais da ESC LOG, o módulo de Relatórios deve ser composto por um núcleo enxuto de **6 relatórios essenciais**:

### 1. Relatório Analítico de Operações e Descargas
- **Quem usa:** Gerente Operacional, Encarregado Geral, Financeiro.
- **Objetivo:** Auditar volume físico (toneladas/caixas), quantidade de caminhões, colaboradores envolvidos e valores apurados.
- **Fonte de Dados:** `operacoes_producao` + `operacoes_colaboradores` + `unidades` + `transportadoras_clientes`.
- **Filtros Essenciais:** Empresa, Unidade, Período (de/até), Transportadora, Tipo de Operação.
- **Saída:** Tabela paginada + CSV detalhado + PDF consolidado.

### 2. Relatório de Fechamento de Diaristas (Mão de Obra Avulsa)
- **Quem usa:** RH e Financeiro.
- **Objetivo:** Conferência dos ciclos semanais pagos aos diaristas, cruzando diárias trabalhadas, funções e valores liquidados.
- **Fonte de Dados:** `ciclos_diaristas` + `lote_pagamento_diaristas` + `lote_pagamento_itens`.
- **Filtros Essenciais:** Empresa, Semana/Ciclo, Status (Aprovado, Pago, Pendente).
- **Saída:** Tabela analítica + CSV para conciliação + Comprovante de fechamento.

### 3. Relatório Gerencial de Faturamento e Receitas Operacionais
- **Quem usa:** Financeiro e Diretoria.
- **Objetivo:** Demonstrativo das receitas auferidas por cliente, separando Operação por Volume, Serviços Extras, Custos Extras repassados e ISS.
- **Fonte de Dados:** `financeiro_receitas` + `faturas_clientes` + `clientes`.
- **Filtros Essenciais:** Empresa, Competência (Mês/Ano), Cliente, Forma de Pagamento.
- **Saída:** Tabela executiva + CSV completo + Relatório em PDF.

### 4. Relatório Consolidado de Custos Extras Operacionais
- **Quem usa:** Financeiro, Auditoria e Operações.
- **Objetivo:** Fiscalizar todos os gastos extraordinários lançados na ponta (refeições, equipamentos, materiais, despesas não operacionais) por unidade.
- **Fonte de Dados:** `custos_extras_operacionais` + `unidades` + `empresas`.
- **Filtros Essenciais:** Empresa, Período, Categoria de Custo, Encarregado Lançador.
- **Saída:** Tabela com totalizadores por categoria + CSV.

### 5. Relatório de Banco de Horas e Passivo Trabalhista (CLT)
- **Quem usa:** RH e Diretoria.
- **Objetivo:** Monitorar saldos acumulados, colaboradores em débito crítico, horas prestes a vencer e impacto financeiro previsto.
- **Fonte de Dados:** `banco_horas_regras` + `resultados_processamento` + `colaboradores`.
- **Filtros Essenciais:** Empresa, Competência, Faixa de Saldo (positivo, crítico, a vencer).
- **Saída:** Tabela sintética por colaborador + Exportação para conferência da folha de pagamento.

### 6. Relatório de Produtividade da Equipe Operacional
- **Quem usa:** RH e Gestor Operacional.
- **Objetivo:** Levantar a participação de cada colaborador nas operações (CLT, diaristas e intermitentes), dias trabalhados e horas computadas.
- **Fonte de Dados:** `operacoes_colaboradores` + `colaboradores`.
- **Filtros Essenciais:** Empresa, Período, Colaborador, Tipo de Contrato (CLT/Diarista/Intermitente).
- **Saída:** Extrato individual e coletivo de produção.

---

## 18. O QUE NÃO DEVE SER RESPONSABILIDADE DO MÓDULO RELATÓRIOS

Para manter o ORBE estável, limpo e previsível, declaramos formalmente o que **NÃO** pertencerá ao módulo Relatórios:

1. **NÃO É MÓDULO DE INTEGRAÇÃO:** Configuração de webservices contábeis, mapeamento de planos de contas (de-para) e logs de API externa pertencem a **Governança / Integrações**.
2. **NÃO É MOTOR DE CRON OU AGENDAMENTO:** Sem backend real para filas de e-mail (ex: Supabase pg_cron + Edge Functions de envio), a aba "Agendamentos" deve ser retirada para não iludir o usuário.
3. **NÃO É AMBIENTE DE RESOLUÇÃO DE PENDÊNCIAS:** Regularizar batidas de ponto, justificar faltas ou aprovar divergências de despesas deve ocorrer exclusivamente dentro dos módulos de RH e Financeiro.
4. **NÃO É EMISSOR INDIVIDUAL DE DOCUMENTOS TRANSACIONAIS:** A emissão de uma fatura de cobrança unitária ou de uma ficha de descarga individual é gerada diretamente no registro da transação.
5. **NÃO É UMA CÓPIA DO BANCO DE DADOS (DUMP VIEWER):** Relatório não é visualizador de tabelas brutas sem filtro e sem propósito. Cada relatório deve ter uma finalidade de negócio explícita.

---

## 19. FRONTEIRA ARQUITETURAL ENTRE OS MÓDULOS

| Necessidade de Negócio | Dashboard | Torre Operacional | DRE V2 | Relatórios V2 | Módulo Especialista | Documento Formal |
|---|---|---|---|---|---|---|
| "Quanto faturamos este mês?" | **Sim (KPI)** | Não | Sim (Receita Bruta) | Sim (Extrato de Faturamento) | Sim (Financeiro Geral) | Não |
| "A operação do caminhão XYZ foi finalizada?" | Não | **Sim (Status em tempo real)** | Não | Não | Sim (Operações por Volume) | Não |
| "Qual a margem líquida da empresa no trimestre?" | Não | Não | **Sim (Resultado Econômico)** | Não | Não | Não |
| "Lista de todos os diaristas pagos na semana 38" | Não | Não | Não | **Sim (Relatório de Diaristas)** | Sim (Ciclos Diaristas) | Não |
| "Aprovar o pagamento da semana dos diaristas" | Não | Não | Não | **NÃO** | **Sim (Aprovações RH / Fin)** | Não |
| "Imprimir o espelho de ponto para o colaborador assinar" | Não | Não | Não | Não | Sim (Ponto CLT) | **Sim (Espelho A4)** |
| "Emitir a fatura unificada com boleto para envio ao cliente" | Não | Não | Não | Não | Sim (Faturamento) | **Sim (Fatura PDF)** |
| "Exportar dados das descargas para auditoria externa" | Não | Não | Não | **Sim (Exportação CSV parametrizada)** | Não | Não |

---

## 20. PROPOSTA DE TAXONOMIA PARA A V2

Eliminando abas técnicas e categorias vazias, a taxonomia do módulo deve refletir diretamente as 3 grandes áreas de negócio da ESC LOG:

```text
CENTRAL DE RELATÓRIOS V2
│
├── 1. OPERACIONAL
│   ├── Analítico de Operações por Volume
│   ├── Produtividade da Equipe Operacional
│   └── Custos Extras Operacionais
│
├── 2. PESSOAS & RH
│   ├── Fechamento Semanal de Diaristas
│   └── Consolidado de Banco de Horas & Saldos CLT
│
└── 3. FINANCEIRO & FATURAMENTO
    └── Faturamento e Receitas por Cliente
```

---

## 21. MATRIZ DE RISCOS TÉCNICOS E OPERACIONAIS

| Risco | Classificação | Impacto | Mitigação Obrigatória na Fase 02 |
|---|---|---|---|
| **Vazamento entre Empresas (Tenant compartilhado)** | **CRÍTICO** | Um operador de uma unidade visualizar números de outra filial | Tornar o filtro `empresa_id` obrigatório em todos os relatórios do sistema. |
| **Gargalo de Performance (Queries sem LIMIT)** | **ALTO** | Queda do front-end por consumo excessivo de memória ao carregar histórico anual | Paginação server-side e filtros temporais obrigatórios (máx. 12 meses). |
| **Quebra de Expectativa (Agendamentos e Layouts Fakes)** | **MÉDIO** | Usuário configurar automações e os relatórios não serem entregues | Ocultar ou desativar as abas de Agendamentos e Layouts até que exista infraestrutura backend real. |
| **Permissão Incorreta para o Perfil RH** | **MÉDIO** | Analista de RH não conseguir acessar relatórios de mão de obra e ponto | Incluir o módulo `central_de_relatorios` no preset de permissões do RH em `access-control.ts`. |
| **Regressão nos Módulos Estabilizados** | **BAIXO (Controlado)** | Tentar "reaproveitar" services de RH/Financeiro e corromper cálculos existentes | **Criar camada de serviço de relatórios desacoplada (`reports.service.ts` V2) com queries limpas e otimizadas.** |

---

## 22. RECOMENDAÇÕES PARA UX04 — FASE 02

1. **Desacoplamento Estrutural:** Não alterar nenhuma regra de cálculo do motor RH, das diárias ou do faturamento. O módulo de relatórios deve ser puramente consumidor (read-only) de dados já consolidados no banco.
2. **Substituição da Tela Atual:** A tela `CentralRelatoriosIntegracoes.tsx` e suas abas de integração contábil e agendamentos devem ser aposentadas, dando lugar a uma interface focada nos 6 relatórios-chave.
3. **Padrão Unificado de Filtros:** Todos os relatórios devem compartilhar um componente padrão de filtro contendo: Empresa (obrigatório), Competência/Período (obrigatório) e filtros específicos da entidade (cliente, transportadora, etc.).
4. **Padronização da Saída:** Toda tela de relatório deve oferecer visualização em tela (tabela responsiva com paginação) e duas opções de saída: **CSV Universal (compatível com Excel pt-BR)** e **PDF Executivo Formatado**.

---

## 🛑 CHECKPOINT DE CONCLUSÃO

- [x] O que existe hoje em Relatórios? *(Mapeado: Hub central com 6 tabs heterogêneas, 7 itens genéricos no catálogo, 3 telas contábeis e 2 simuladores sem backend)*.
- [x] O que cada recurso realmente faz? *(Identificado em detalhes com evidências de código e chamadas de serviço)*.
- [x] Quem utiliza? *(Admin e Financeiro no preset atual; RH bloqueado incorretamente)*.
- [x] De onde vêm os dados? *(Mapeadas as tabelas Supabase e queries de services)*.
- [x] Quais recursos são realmente relatórios? *(Somente visões consolidadas parametrizadas de Operações, Diárias, Faturamento e Banco de Horas)*.
- [x] O que está duplicado com Dashboard, Torre, DRE ou Módulos Especialistas? *(Mapeado: Auditoria, DRE, Inconsistências, Faturamento em Lote e Extrato individual de BH)*.
- [x] Quais relatórios têm maior valor para a operação? *(Os 6 Relatórios-Chave documentados na Seção 17)*.
- [x] O que deve sair conceitualmente de Relatórios? *(Mapeado na Seção 18)*.
- [x] Qual arquitetura devemos levar para a Fase 02? *(Taxonomia em 3 pilares: Operacional, Pessoas & RH, Financeiro; segregação estrita por empresa e saídas em CSV/PDF)*.

---
**FIM DA FASE 01 — AGUARDANDO HOMOLOGAÇÃO DO PRODUCT OWNER ANTES DE QUALQUER ALTERAÇÃO OU PROTÓTIPO.**
