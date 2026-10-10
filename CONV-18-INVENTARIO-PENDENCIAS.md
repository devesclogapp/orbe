# ERP ORBE — CONV-18 / INVENTÁRIO DOS MÓDULOS PENDENTES
## Relatório de Auditoria Arquitetural, Convergência UI/UX e Navegação Contextual

**Responsável:** Arquiteto Sênior de Frontend & Auditor de UI/UX  
**Data:** 10/10/2026  
**Status do Repositório:** Pós-conclusão da CONV-17 (Regime Intermitente / Lotes Fechados)  
**Natureza da Auditoria:** Estritamente LEITURA (Read-Only) — Sem alterações de código ou commits.

---

## 1. Resumo Executivo da Auditoria

A presente auditoria realizou uma varredura completa nas rotas oficiais (`src/App.tsx`), na arquitetura de navegação (`src/components/layout/Sidebar.tsx` e `navigationMeta.ts`), nas implementações das páginas e nas suítes automatizadas de teste (`src/test/conv*.test.*`), rastreando as evidências desde a **CONV-01** até a **CONV-17**.

### Principais Conclusões:
1. **Módulos Críticos Homologados e Preservados:**  
   Contrariando hipóteses de pendências não validadas, a auditoria comprovou documentalmente e por testes automatizados que os módulos **Fechamento Mensal CLT (CONV-15)**, **Central de Inconsistências (CONV-07)**, **Fechamento de Ciclos (CONV-08)**, **Central Bancária (CONV-11)**, **Receitas Operacionais (CONV-09)**, **Despesas & Contas a Pagar (CONV-10)**, **Inadimplência & Cobrança (CONV-12)**, **Resultado Operacional / DRE (CONV-13)** e **Central de Relatórios (CONV-14)** já passaram por suas sprints de migração visual, estão integrados ao Design System oficial e possuem suítes de teste ativas com alto índice de aprovação.
2. **Genuínas Pendências de Convergência Visual Identificadas:**  
   O núcleo que ainda carece de convergência com o padrão executivo oficial situa-se na seção **Cadastros & Sistema**:
   - **Central de Cadastros (`/cadastros`)**: Componente monolítico de 5.757 linhas utilizando layout legado (grid de 8 mini-cards, dezenas de modais `Dialog` sobrepostos em vez de Drawers contextuais, e ausência de `OrbeKpiCard`).
   - **Regras & Tabelas Operacionais (`/cadastros/regras-operacionais`)**: Componente monolítico de 3.150 linhas sem cards superiores de síntese corporativa e sem Drawer canônico de auditoria de tabelas/regras.
3. **Isolamento de Pendências de Dados vs. Defeitos de Interface:**  
   Bloqueios cadastrais observados (ex.: 89 bloqueios no Fechamento CLT ou bloqueio fail-closed no lote `6e48aa` de intermitentes) decorrem de governança de dados reais de colaboradores incompletos, e **não** de defeitos de UI/UX.

---

## 2. Matriz Geral de Módulos, Rotas e Classificação

| Módulo Oficial | Rota Canônica | Arquivo Principal | Sprint / Commit Base | Testes Automatizados | Status Oficial |
|---|---|---|---|---|---|
| **Dashboard Executivo** | `/operacional/dashboard` | `Dashboard.tsx` | CONV-01 (`0b7fcca`) | `conv01_dashboard_executivo.test.tsx` (12/12) | ✅ Homologado e preservado |
| **Torre Operacional** | `/operacional/pipeline` | `PipelineOperacional.tsx` | CONV-02 (`7ad38a3`) | `conv02_torre_operacional.test.tsx` (8/8) | ✅ Homologado e preservado |
| **Operações por Volume** | `/operacoes-volume` | `Operacoes.tsx` | CONV-03 (`fe30d32`) | `conv03_operacoes_volume.test.tsx` (11/11) | ✅ Homologado e preservado |
| **Serviços Extras** | `/operacional/servicos-extras` | `ServicosExtrasRecebidos.tsx` | CONV-04 (`0eef6fe`) | `conv04_servicos_extras.test.tsx` (10/10) | ✅ Homologado e preservado |
| **Custos Extras** | `/operacional/custos-extras` | `CustosExtrasRecebidos.tsx` | CONV-05 (`60737ad`) | `conv05_custos_extras.test.tsx` (8/8) | ✅ Homologado e preservado |
| **Ponto & Jornadas CLT** | `/clt/pontos` | `PontoJornadasClt.tsx` | CONV-CLT (`32d4e07`, `f4f3d15`) | Suíte CLT integrada | ✅ Homologado e preservado |
| **Fechamento Mensal CLT** | `/banco-horas/fechamento` | `FechamentoMensalCLT.tsx` | CONV-15 (`12dc301`) | `conv15_fechamento_mensal_clt.test.tsx` (13/13) | 🔒 Homologado e preservado (Regras Fail-Closed ativas) |
| **Diaristas (Painel & Lotes)** | `/operacional/diaristas` | `RhDiaristasPainel.tsx` | CONV-16 (`14b8b1c`) | `conv16_rh_diaristas_painel_visual.test.tsx` (10/10) | ✅ Homologado e preservado |
| **Intermitentes (Jornadas & Lotes)** | `/operacional/intermitentes`<br>`/operacional/intermitentes/lotes` | `IntermitentesRecebidos.tsx`<br>`IntermitentesLotes.tsx` | CONV-17 (`98a2f92`, `43c7386`) | 10 arquivos / 74 testes CONV-17 (74/74) | ✅ Homologado e preservado |
| **Central de Aprovações RH** | `/rh/aprovacoes` | `AprovacoesRh.tsx` | CONV-06 (`ba98e4a`) | `conv06_central_aprovacoes.test.tsx` (32/32) | ✅ Homologado e preservado |
| **Central de Inconsistências** | `/inconsistencias` | `Inconsistencias.tsx` | CONV-07 (`278c3f5`) | `conv07_central_inconsistencias.test.tsx` (17/17) | ✅ Homologado e preservado |
| **Fechamento de Ciclos (Hub)** | `/fechamento` | `Fechamento.tsx` | CONV-08 (`0c626cd`) | `conv08_fechamento_ciclos.test.tsx` (19/19) | ✅ Homologado e preservado |
| **Receitas Operacionais** | `/financeiro/receitas` | `ReceitasPipeline.tsx` | CONV-09 (`c80ea8f`) | `conv09_receitas_operacionais.test.tsx` (40/40) | ✅ Homologado e preservado |
| **Despesas & Contas a Pagar** | `/financeiro` | `CentralFinanceira.tsx` | CONV-10 (`ed518f5`) | `conv10_despesas_contas_pagar.test.tsx` (57/57) | ✅ Homologado e preservado |
| **Central Bancária & CNAB** | `/bancario` | `CentralBancaria.tsx` | CONV-11 (`472e781`) | `conv11_central_bancaria.test.tsx` (25/25) | ✅ Homologado e preservado |
| **Inadimplência & Cobrança** | `/financeiro/inadimplencia` | `Inadimplencia.tsx` | CONV-12 (`84fdfea`) | `conv12_inadimplencia.test.ts` (16/16) | ✅ Homologado e preservado |
| **Resultado Operacional (DRE)** | `/financeiro/dre` | `RelatorioDRE.tsx` | CONV-13 (`c0521ae`) | `conv13_resultado_operacional_dre.test.tsx` (21/21) | ✅ Homologado e preservado |
| **Central de Relatórios** | `/relatorios` | `CentralRelatoriosOficial.tsx` | CONV-14 (`9f5399d`) | `conv14_central_relatorios_oficial.test.tsx` (8/8) | ✅ Homologado e preservado |
| **Central de Cadastros** | `/cadastros` | `CentralCadastros.tsx` | Nenhuma sprint de convergência | Sem testes de convergência | ⚠️ **Implementado, mas com homologação visual pendente** |
| **Regras & Tabelas Operacionais** | `/cadastros/regras-operacionais` | `RegrasOperacionais.tsx` | Nenhuma sprint de convergência | Sem testes de convergência | ⚠️ **Implementado, mas com homologação visual pendente** |
| **Preferências / Configurações** | `/configuracoes` | `Configuracoes.tsx` | Legado | Sem testes de convergência | ⚙️ Utilitário do Sistema (Secundário) |
| **Governança Executiva** | `/governanca` | `CentralGovernanca.tsx` | Legado administrativo | Sem testes de convergência | 🛡️ Isolado fora do menu primário |

---

## 3. Evidências Detalhadas dos Módulos Auditados Especialmente

### 3.1 Fechamento Mensal CLT (`/banco-horas/fechamento`)
- **Evidência no Git:** Commit `12dc301` (*"Migração UX: Fechamento Mensal CLT"*).
- **Evidência no Código:**
  - Emprega `AppShell`, `OrbeKpiCard` com escala cromática corporativa, `FechamentoDrawer` e `FechamentoMensalCltAdapter`.
  - Tratamento cirúrgico de erros 400 (substituição de `ativo` por `bh_ativo` no select de regras).
- **Evidência de Testes:** Suíte [`src/test/conv15_fechamento_mensal_clt.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv15_fechamento_mensal_clt.test.tsx) contendo 13 testes, todos executados e **100% aprovados** (5.03s).
- **Status dos Bloqueios:** Os 89 bloqueios cadastrais em 9 empresas foram diagnosticados como colaboradores reais provenientes do coletor com `status_cadastro = 'pendente_complemento'`. Constitui salvaguarda correta de integridade fiscal e financeira (*Fail-Closed*).
- **Classificação:** **Homologado e preservado.**

### 3.2 Central de Inconsistências (`/inconsistencias`)
- **Evidência no Git:** Commit `278c3f5` (*"Migração UX: Central de Inconsistências"*).
- **Evidência no Código:**
  - Possui `InconsistenciaDrawer` padronizado.
  - Oferece suporte a rotas contextuais com travamento por domínio (ex.: `/intermitentes/inconsistencias`).
  - Despacho contextual seguro para `/cadastros`, `/clt/pontos` e `/operacoes-volume`.
- **Evidência de Testes:** Suíte [`src/test/conv07_central_inconsistencias.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv07_central_inconsistencias.test.tsx) contendo 17 testes, todos executados e **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.3 Fechamento de Ciclos (`/fechamento`)
- **Evidência no Git:** Commit `0c626cd` (*"Migração UX: Fechamento de Ciclos"*).
- **Evidência no Código:**
  - Atua como Torre Unificada e Hub Transversal dos 4 regimes operacionais (CLT, Diaristas, Intermitentes e Operações de Campo).
  - Emprega `FechamentoCiclosOficialService`, `FechamentoDrawer` e `JustificationModal`.
- **Evidência de Testes:** Suíte [`src/test/conv08_fechamento_ciclos.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv08_fechamento_ciclos.test.tsx) contendo 19 testes, todos executados e **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.4 Central Bancária & CNAB (`/bancario`)
- **Evidência no Git:** Commit `472e781` (*"Migração UX: Central Bancária e CNAB"*).
- **Evidência no Código:**
  - 5 abas integradas: Prontas para Banco, Remessas, Aguardando Retorno, Conciliação e Pendências.
  - Emprega `BancarioOficialAdapter`, `CentralBancariaDrawerOficial` e `ImportarRetornoModalOficial`.
  - Resolução robusta de conta bancária por empresa vinculada ao lote (sem tenant leak).
- **Evidência de Testes:** Suíte [`src/test/conv11_central_bancaria.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv11_central_bancaria.test.tsx) contendo 25 testes, todos **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.5 Receitas Operacionais (`/financeiro/receitas`)
- **Evidência no Git:** Commit `c80ea8f` (*"Migração UX: Receitas Operacionais"*).
- **Evidência no Código:**
  - Segregação estrita entre Pipeline de Despesas e Pipeline de Receitas.
  - Suporte completo às modalidades: À Vista, Duplicatas e Faturamento Mensal.
  - Drawers contextuais e modal de faturamento em lote.
- **Evidência de Testes:** Suíte [`src/test/conv09_receitas_operacionais.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv09_receitas_operacionais.test.tsx) contendo 40 testes, todos **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.6 Despesas & Contas a Pagar (`/financeiro`)
- **Evidência no Git:** Commit `ed518f5` (*"Migração UX: Despesas e Contas a Pagar"*).
- **Evidência no Código:**
  - Unificação de Lotes RH, Diaristas, Intermitentes, Custos Extras e Fornecedores.
  - Emprega `DespesaDrawerOficial` e `AprovarDespesaModalOficial`.
- **Evidência de Testes:** Suíte [`src/test/conv10_despesas_contas_pagar.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv10_despesas_contas_pagar.test.tsx) contendo 57 testes, todos **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.7 Inadimplência & Cobrança (`/financeiro/inadimplencia`)
- **Evidência no Git:** Commit `84fdfea` (*"Migração UX: Inadimplência e Cobrança"*).
- **Evidência no Código:**
  - Filtros por régua de cobrança (D+5, D+15, D+30, Contencioso).
  - Emprega `InadimplenciaDrawerOficial` com registro de ocorrências e contatos.
- **Evidência de Testes:** Suíte [`src/test/conv12_inadimplencia.test.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv12_inadimplencia.test.ts) contendo 16 testes, todos **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.8 Resultado Operacional (DRE) (`/financeiro/dre`)
- **Evidência no Git:** Commit `c0521ae` (*"Migração UX: Resultado Operacional (DRE)"*).
- **Evidência no Código:**
  - DRE em cascata: Receita Bruta (-) Deduções (-) Custos Diretos (=) Margem Contribuição (-) Despesas Operacionais (=) Resultado Líquido.
  - Gráficos comparativos e visão por unidade/empresa.
- **Evidência de Testes:** Suíte [`src/test/conv13_resultado_operacional_dre.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv13_resultado_operacional_dre.test.tsx) contendo 21 testes, todos **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

### 3.9 Central de Relatórios (`/relatorios`)
- **Evidência no Git:** Commit `9f5399d` (*"Migração UX: Central de Relatórios"*).
- **Evidência no Código:**
  - Visualizador Documental 50/50 (`RelatorioVisualizadorOficial.tsx`).
  - Cadernos de relatórios (Operacional, RH, Financeiro e Controladoria).
- **Evidência de Testes:** Suíte [`src/test/conv14_central_relatorios_oficial.test.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/test/conv14_central_relatorios_oficial.test.tsx) contendo 8 testes, todos **100% aprovados**.
- **Classificação:** **Homologado e preservado.**

---

## 4. Diagnóstico das Pendências Reais de Convergência

### 4.1 Central de Cadastros (`/cadastros`)
- **Arquivo:** [`src/pages/CentralCadastros.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/CentralCadastros.tsx) (5.757 linhas).
- **Diagnóstico Arquitetural e Visual:**
  1. **Discrepância Visual de KPIs:** Utiliza um grid de 8 mini-cards (`MetricCard`) que contrasta diretamente com o padrão do Design System corporativo (`OrbeKpiCard` em 4 blocos de síntese executiva).
  2. **Monolito de Alta Complexidade:** O arquivo concentra toda a lógica de 8 entidades em um único componente, com mais de 30 estados locais e formulários gigantescos renderizados inline.
  3. **Fragmentação de Modais:** Utiliza dezenas de `Dialog` modais flutuantes sobre a tela em vez de Drawers laterais deslizantes (`Sheet` / `Drawer`), divergindo da ergonomia adotada em todos os módulos já convergidos.
  4. **Navegação Contextual Receptora:** A tela já recebe links contextuais vindos da *Central de Inconsistências* e do *Fechamento Mensal CLT* (`?colaboradorId={id}&openModal=true`), porém o formulário aberto não apresenta o painel de diagnóstico / checklist de completude integrado em Drawer.
  5. **Ausência de Testes de Convergência:** Não existe nenhuma suíte `conv*_cadastros.test.tsx` garantindo a integridade visual e contratual desse módulo.
- **Classificação:** **Implementado, mas com homologação visual pendente.**

### 4.2 Regras & Tabelas Operacionais (`/cadastros/regras-operacionais`)
- **Arquivo:** [`src/pages/RegrasOperacionais.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/RegrasOperacionais.tsx) (3.150 linhas).
- **Diagnóstico Arquitetural e Visual:**
  1. **Ausência de KPIs Executivos:** A tela renderiza diretamente a barra de abas (`Tabs`), sem fornecer visibilidade superior sobre regras ativas, vigências a expirar ou tabelas por empresa/cliente.
  2. **Estrutura Heterogênea de Abas:** Combina abas fixas de sistema com módulos dinâmicos carregados via banco de dados sem padronização nos cabeçalhos de contexto.
  3. **Ausência de Drawer de Auditoria:** Edição e criação de regras operacionais utilizam modais tradicionais sem histórico visual de versões ou conferência de impacto tarifário.
  4. **Ausência de Testes:** Não possui suíte automatizada de validação de regressão visual.
- **Classificação:** **Implementado, mas com homologação visual pendente.**

---

## 5. Ordem Recomendada para Conclusão da Convergência

Com 17 etapas concluídas e homologadas com sucesso, a esteira de convergência do ERP ORBE encontra-se em sua reta final. A sequência ótima para selar o ecossistema sem risco de regressão é:

```text
CONV-18: Inventário Oficial de Pendências (Fase Atual)
   ↓
CONV-19: Central de Cadastros (Desacoplamento e Convergência ao Design System Oficial)
   ↓
CONV-20: Regras & Tabelas Operacionais (KPIs de Governança Tarifária e Drawer de Vigência)
   ↓
CONV-21: Homologação Final Integrada E2E (Varredura Transversal de Navegação e Encerramento)
```

---

## 6. Proposta de Apenas Uma Próxima Etapa de Implementação

### **CONV-19 — CONVERGÊNCIA VISUAL DA CENTRAL DE CADASTROS (`/cadastros`)**

#### Justificativa Técnica:
A Central de Cadastros é o módulo mais acionado transversalmente no ERP ORBE. Ela recebe despachos de resolução de bloqueios do **Fechamento CLT**, da **Central de Inconsistências**, da **Central de Aprovações RH** e da **Central Bancária**. Modernizar este módulo para o padrão canônico do Design System fechará o elo mais crítico de navegação e eliminará o maior débito visual do sistema.

#### Escopo Proposto da CONV-19:
1. **Preservação Absoluta:** Preservar 100% dos serviços existentes (`ColaboradorService`, `EmpresaService`, `TransportadoraClienteService`, etc.) e contratos com o banco Supabase.
2. **Quatro Cards Executivos de Síntese:** Substituir os 8 mini-cards pelo conjunto de 4 `OrbeKpiCard` (Total de Entidades Ativas, Colaboradores Operacionais, Clientes & Parceiros, Cadastros Pendentes/Incompletos).
3. **Drawer Canônico de Completude:** Substituir o modal inline de colaborador pelo `CadastroColaboradorDrawerOficial`, exibindo o checklist de dados pessoais, contrato, dados bancários e status fail-closed.
4. **Navegação Contextual Fluida:** Tratar parâmetros de URL (`?colaboradorId=...&from=...`) para focar a linha e abrir diretamente o Drawer com preservação de retorno.
5. **Suíte Automatizada:** Criação de `conv19_central_cadastros.test.tsx` com 100% de aprovação.

---

## 7. Parecer e Encerramento

> **PARECER FINAL:**  
> A auditoria confirma que **todos os módulos das CONV-01 a CONV-17 estão homologados, estáveis e preservados**. As únicas pendências reais de convergência visual estão isoladas no grupo **Cadastros & Sistema**, sendo a **Central de Cadastros (`/cadastros`)** a prioridade imediata e única para a próxima etapa.
>
> **Nenhuma alteração de código ou commit foi realizado nesta etapa.**  
> O sistema encontra-se íntegro e aguarda autorização para início da **CONV-19**.
