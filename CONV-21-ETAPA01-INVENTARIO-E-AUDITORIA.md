# ERP ORBE — CONV-21 / ETAPA 01
## Identificação do Próximo Módulo e Auditoria de Convergência Visual

**Data:** 11/10/2026  
**Responsável:** Arquiteto Sênior de Frontend & Auditor de UI/UX  
**Status do Repositório:** Pós-homologação de CONV-19 (`66f4782`) e CONV-20 (`8eddc81` / `5307ee8`)  
**Natureza da Auditoria:** Estritamente LEITURA (Read-Only) — Sem alterações em código de produção, banco, RPCs ou regras de negócio.  

---

## 1. Contexto e Resumo Executivo

O ERP ORBE encontra-se na fase final da convergência progressiva para o Design System oficial originado no UX Lab e homologado no Dashboard Executivo.

Os marcos mais recentes consolidaram:
- **CONV-19 (Commit `66f4782`):** Central de Cadastros (`/cadastros`) e Gestão Detalhada de Colaboradores (`/colaboradores`), introduzindo 4 `OrbeKpiCard`, abas pill unificadas, paginação ergonômica e desacoplamento de entidades.
- **CONV-20 (Commit `8eddc81` e `5307ee8`):** Regras & Tabelas Operacionais (`/cadastros/regras-operacionais`), cobrindo tanto a estrutura principal (aba Operacional com wizard de regras) quanto as abas complementares (Diaristas, Meios de Pagamento, Taxas & Impostos, Períodos Operacionais), com padronização rigorosa de badges e microindicadores.

O objetivo da presente **CONV-21 / Etapa 01** é auditar minuciosamente o inventário completo de convergências, classificar todas as rotas e telas do sistema, priorizar tecnicamente o próximo módulo e apresentar um diagnóstico profundo e visual antes de qualquer intervenção em código.

---

## 2. Matriz Geral de Convergências (CONV-01 a CONV-20)

| Código | Módulo / Domínio | Rota Canônica | Arquivo Principal | Commit / Evidência Base | Testes Automatizados | Classificação Oficial |
|---|---|---|---|---|---|---|
| **CONV-01** | Dashboard Executivo | `/operacional/dashboard` | `Dashboard.tsx` | Commit `0b7fcca` | `conv01_dashboard_executivo.test.tsx` (12/12) | ✅ Homologado e consolidado |
| **CONV-02** | Torre Operacional | `/operacional/pipeline` | `PipelineOperacional.tsx` | Commit `7ad38a3` | `conv02_torre_operacional.test.tsx` (8/8) | ✅ Homologado e consolidado |
| **CONV-03** | Operações por Volume | `/operacoes-volume` | `Operacoes.tsx` | Commit `fe30d32` | `conv03_operacoes_volume.test.tsx` (11/11) | ✅ Homologado e consolidado |
| **CONV-04** | Serviços Extras | `/operacional/servicos-extras` | `ServicosExtrasRecebidos.tsx` | Commit `0eef6fe` | `conv04_servicos_extras.test.tsx` (10/10) | ✅ Homologado e consolidado |
| **CONV-05** | Custos Extras | `/operacional/custos-extras` | `CustosExtrasRecebidos.tsx` | Commit `60737ad` | `conv05_custos_extras.test.tsx` (8/8) | ✅ Homologado e consolidado |
| **CONV-CLT** | Ponto & Jornadas CLT | `/clt/pontos` | `PontoJornadasClt.tsx` | Commits `32d4e07`, `f4f3d15` | Suíte de testes CLT integrada | ✅ Homologado e consolidado |
| **CONV-06** | Central de Aprovações RH | `/rh/aprovacoes` | `AprovacoesRh.tsx` | Commit `ba98e4a` | `conv06_central_aprovacoes.test.tsx` (32/32) | ✅ Homologado e consolidado |
| **CONV-07** | Central de Inconsistências | `/inconsistencias` | `Inconsistencias.tsx` | Commit `278c3f5` | `conv07_central_inconsistencias.test.tsx` (17/17) | ✅ Homologado e consolidado |
| **CONV-08** | Fechamento de Ciclos | `/fechamento` | `Fechamento.tsx` | Commit `0c626cd` | `conv08_fechamento_ciclos.test.tsx` (19/19) | ✅ Homologado e consolidado |
| **CONV-09** | Receitas Operacionais | `/financeiro/receitas` | `ReceitasPipeline.tsx` | Commit `c80ea8f` | `conv09_receitas_operacionais.test.tsx` (40/40) | ✅ Homologado e consolidado |
| **CONV-10** | Despesas & Contas a Pagar | `/financeiro` | `CentralFinanceira.tsx` | Commit `ed518f5` | `conv10_despesas_contas_pagar.test.tsx` (57/57) | ✅ Homologado e consolidado |
| **CONV-11** | Central Bancária & CNAB | `/bancario` | `CentralBancaria.tsx` | Commit `472e781` | `conv11_central_bancaria.test.tsx` (25/25) | ✅ Homologado e consolidado |
| **CONV-12** | Inadimplência & Cobrança | `/financeiro/inadimplencia` | `Inadimplencia.tsx` | Commit `84fdfea` | `conv12_inadimplencia.test.ts` (16/16) | ✅ Homologado e consolidado |
| **CONV-13** | Resultado Operacional (DRE) | `/financeiro/dre` | `RelatorioDRE.tsx` | Commit `c0521ae` | `conv13_resultado_operacional_dre.test.tsx` (21/21) | ✅ Homologado e consolidado |
| **CONV-14** | Central de Relatórios | `/relatorios` | `CentralRelatoriosOficial.tsx` | Commit `9f5399d` | `conv14_central_relatorios_oficial.test.tsx` (8/8) | ✅ Homologado e consolidado |
| **CONV-15** | Fechamento Mensal CLT | `/banco-horas/fechamento` | `FechamentoMensalCLT.tsx` | Commit `12dc301` | `conv15_fechamento_mensal_clt.test.tsx` (13/13) | ✅ Homologado e consolidado |
| **CONV-16** | Diaristas (Painel & Lotes) | `/operacional/diaristas` | `RhDiaristasPainel.tsx` | Commit `14b8b1c` | `conv16_rh_diaristas_painel_visual.test.tsx` (10/10) | ✅ Homologado e consolidado |
| **CONV-17** | Intermitentes (Jornadas & Lotes) | `/operacional/intermitentes`<br>`/operacional/intermitentes/lotes` | `IntermitentesRecebidos.tsx`<br>`IntermitentesLotes.tsx` | Commits `98a2f92`, `43c7386` | 10 arquivos / 74 testes CONV-17 (74/74) | ✅ Homologado e consolidado |
| **CONV-18** | Inventário Geral de Pendências | *N/A (Documento)* | `CONV-18-INVENTARIO-PENDENCIAS.md` | Commit `7b36f8a` | Inventário Técnico Formal | ✅ Homologado e consolidado |
| **CONV-19** | Central de Cadastros | `/cadastros` | `CentralCadastros.tsx` | Commit `66f4782` | `conv19_central_cadastros_ui.test.tsx` (16/16) | ✅ Homologado e consolidado |
| **CONV-20** | Regras & Tabelas Operacionais | `/cadastros/regras-operacionais` | `RegrasOperacionais.tsx` | Commits `8eddc81`, `5307ee8` | `conv20_regras_operacionais_ui.test.tsx`<br>`conv20_etapa03_abas_complementares.test.tsx` | ✅ Homologado e consolidado |
| **CONV-21 (Candidato)** | **Preferências & Configurações** | `/configuracoes` | `Configuracoes.tsx` | *Em auditoria (Etapa 01)* | *Ainda sem testes de convergência* | ⚠️ **Ainda não iniciado (Último item pendente do Sidebar)** |
| **Secundário** | Governança Executiva | `/governanca` | `CentralGovernanca.tsx` | *Fora do menu lateral primário* | Sem testes de convergência | 🔒 Isolado (Acesso restrito superadmin) |
| **Secundário** | Portal do Cliente | `/cliente/*` | `ClientDashboard.tsx` | *Portal externo independente* | Sem testes de convergência | 🌐 Externo (Isolado via `PortalGuard`) |
| **Secundário** | Lançamentos de Produção | `/producao/*` | `LancamentoProducao.tsx` | *Ponto de entrada mobile encarregado* | Testes de integração de campo | 📱 Contexto Mobile / Armazém |

---

## 3. Avaliação dos Módulos Candidatos e Critérios de Priorização

Para determinar a priorização técnica do próximo módulo, foram analisados os 6 critérios regulamentares:

| Critério | Peso | Candidato A: Preferências (`/configuracoes`) | Candidato B: Governança (`/governanca`) | Candidato C: Portal Cliente (`/cliente`) |
|---|---|---|---|---|
| **1. Importância Operacional** | Alta | **Muito Alta**: Governa fuso, tolerância de ponto, motor operacional, jornadas, regras de banco de horas e modelos de planilha. | **Média**: Visão consolidada para auditoria gerencial e logs. | **Baixa**: Apenas clientes externos, sem impacto nas operações diárias internas. |
| **2. Frequência de Utilização** | Alta | **Muito Alta**: Acessado por todos os usuários para tema claro/escuro, visão de entrada, perfil e matrícula, e por gestores para parâmetros. | **Baixa**: Acessado esporadicamente por compliance/diretoria. | **Baixa**: Acesso restrito a clientes externos com credenciais próprias. |
| **3. Divergência em relação ao DS** | Alta | **Crítica**: Utiliza classes legadas `esc-card`, `esc-table-header`, cores desalinhadas, tabela HTML crua, botões azuis e ausência de KPIs executivos. | **Média**: Já utiliza alguns `MetricCard`, embora sem `OrbeKpiCard` canônico. | **Alta**: Possui tema próprio simplificado para clientes. |
| **4. Risco de Regressão** | Crítica | **Baixo a Médio**: Serviços bem desacoplados (`ConfiguracaoOperacionalService`, `ImportacaoModelosService`, `PreferencesContext`). Sem impacto em cálculos financeiros do RH. | **Alto**: Envolve timeline corporativa transversal de múltiplos módulos e auditoria global. | **Médio**: Risco de impactar visão externa contratual. |
| **5. Dependências Funcionais** | Alta | **Nula**: Totalmente autônomo, não bloqueia e não depende de outros módulos pendentes. | **Alta**: Depende de RPCs transversais e agrega dados de múltiplos módulos. | **Alta**: Depende de permissões e escopos de faturamento do cliente. |
| **6. Esforço Estimado** | Média | **Médio**: Monolito de 1.040 linhas + 3 seções filhas, perfeitamente modularizável em 3 etapas controladas. | **Alto**: Envolve 4 sub-rotas administrativas distintas. | **Médio**: Telas de visualização passiva. |

### Conclusão e Recomendação:
O módulo **Preferências & Configurações (`/configuracoes`)** é a **escolha mandatória e prioritária para a CONV-21**. 

**Justificativa Técnica:**
1. É o **último módulo presente no menu lateral oficial (Sidebar)** que ainda não foi convergido.
2. Sua convergência sela **100% de cobertura do menu principal do ERP ORBE**.
3. O módulo concentra utilitários vitais de usabilidade diária (alternância de tema, navegação padrão, perfil pessoal) e governança operacional (fuso horário, tolerâncias de ponto, jornadas de trabalho CLT, regras de banco de horas, reset operacional seguro e links de modelos no Google Drive).

---

## 4. Diagnóstico Detalhado do Módulo Escolhido (`/configuracoes`)

### 4.1 Rota e Componentes Envolvidos
- **Rota:** `/configuracoes`
- **Arquivo Principal:** `src/pages/Configuracoes.tsx` (1.040 linhas)
- **Subcomponentes Diretos:**
  - `src/pages/Configuracoes/ResetOperacional.tsx` (745 linhas)
  - `src/pages/Configuracoes/JornadasTrabalhoSection.tsx` (867 linhas)
  - `src/pages/Configuracoes/RegrasBancoHorasSection.tsx` (1.189 linhas)
  - `src/pages/Configuracoes/jornadaFormUtils.ts` (235 linhas)
- **Contextos e Serviços Consumidos:**
  - `usePreferences` (`PreferencesContext.tsx`)
  - `useAuth` (`AuthContext.tsx`)
  - `ConfiguracaoOperacionalService`
  - `ImportacaoModelosService`
  - `ResetOperacionalService`
  - `StorageService` (upload de avatar)

---

### 4.2 Estrutura Visual Atual vs. Design System Canônico

#### A. Cabeçalho de Página
- **Atual:** Apenas `<AppShell title="Preferências e Conta" subtitle="Ajustes pessoais de uso e perfil do ERP">`.
- **Divergência:** Não possui barra executiva de contexto, badge institucional nem ações rápidas consolidadas.
- **Canônico:** Adotar cabeçalho estruturado com H1, badge de ambiente corporativo (`v2026` / `Base de Produção`), e painel superior com 4 cards de síntese executiva (`OrbeKpiCard`).

#### B. Painel Superior de KPIs (`OrbeKpiCard`)
- **Atual:** Inexistente. A tela abre diretamente no seletor de abas.
- **Canônico Proposto (4 KPIs Executivos):**
  1. **Ambiente & Tenant:** Nome da empresa/unidade ativa e status da base de produção.
  2. **Tema & Workspace:** Visual em uso (Claro/Escuro) e visão inicial configurada (Ponto vs. Operações).
  3. **Motor Operacional:** Fuso horário ativo, tolerância de apuração e arredondamento financeiro.
  4. **Segurança & Perfil:** Usuário conectado, papel de acesso e indicador de autenticação.

#### C. Barra de Navegação por Abas
- **Atual:** `<TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50">` com botões trigger genéricos.
- **Canônico:** Trilha de abas padronizada com tokens canônicos (`rounded-lg`, `border-border/60`, texto com peso adequado, ícones padronizados e microbadges contextuais).

#### D. Diagnóstico Aba por Aba:

1. **Aba "Preferências" (`tab=preferencias`):**
   - *Conteúdo:* Seções "Aparência" (Modo Claro vs Modo Escuro) e "Navegação Padrão" (Ponto vs Operações), além do atalho para Manutenção do Ambiente.
   - *Problemas:* Cards de opção com bordas azuis saturadas (`border-blue-600` / `ring-2`), tipografia fora da escala corporativa, e ausência de acabamento sutil em hover/focus.
   - *Correção:* Alinhar os seletores de preferência aos tokens do Design System, com contraste neutro refinado e estados ativos sutis.

2. **Aba "Configurações Operacionais" (`tab=config_operacional`):**
   - *Conteúdo:* Motor Operacional (moeda padrão, fuso horário, tolerância de ponto, limite de escopo, notificação), Jornadas de Trabalho CLT, Regras de Banco de Horas e Filtros de Colaboradores por tela do Encarregado.
   - *Problemas:* Uso de botões azuis chamativos (`bg-blue-600`), classes `.esc-card`, inputs empilhados sem espaçamento harmônico, ausência de feedback de salvamento consistente por seção.
   - *Correção:* Preservar 100% dos formulários e mutações, mas envelopar cada bloco em superfícies canônicas com cabeçalhos consistentes.

3. **Aba "Manutenção do Ambiente" (`tab=manutencao`):**
   - *Conteúdo:* Painel de `ResetOperacional.tsx` com 4 categorias de reset (Operacional, Financeiro, Completo do Tenant e Ambiente Demo).
   - *Problemas:* Embora possua arquitetura robusta de segurança e confirmação dupla, apresenta cards com alturas assimétricas e badges de severidade despadronizados.
   - *Correção:* Preservar as travas de dupla confirmação e o preview de tabelas afetadas, ajustando o layout dos cards para o padrão executivo.

4. **Aba "Modelos de Importação" (`tab=modelos`):**
   - *Conteúdo:* Tabela de links do Google Drive para modelos de planilha ("Baixar modelo").
   - *Problemas:* Tabela HTML crua com `.esc-table-header`, botão "+ Novo modelo" em azul saturado, badges de status usando cores primárias não-canônicas (`bg-green-100 text-green-700`), botões de ação sem tooltips unificados e uso de `confirm()` nativo do browser na exclusão.
   - *Correção:* Aplicar a tabela canônica com cabeçalhos em caixa alta tracking sutil, badges de status padronizados com microindicadores circulares, botões de ação neutros com hover discreto e modal de confirmação.

5. **Aba "Meu Perfil" (`tab=conta`):**
   - *Conteúdo:* Foto de perfil / upload de avatar, nome, e-mail, perfil de acesso, matrícula e atalhos de segurança.
   - *Problemas:* Container com largura fixa `max-w-2xl` destoando do grid da aplicação, bordas azuis saturadas no avatar, inputs inline sem estilização formal.
   - *Correção:* Alinhar o perfil ao padrão de visualização de colaboradores (similar ao Drawer da CONV-19), mantendo o upload funcional via Supabase Storage.

---

## 5. Evidências Visuais Capturadas

As capturas de tela foram realizadas de forma automatizada pelo Playwright em duas resoluções regulamentares:

### Resolução 1440×900:
- **01. Aba Preferências Gerais:** [`01_preferencias_geral_1440x900.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/01_preferencias_geral_1440x900.png)
- **02. Aba Configurações Operacionais:** [`02_config_operacional_1440x900.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/02_config_operacional_1440x900.png)
- **03. Aba Manutenção do Ambiente:** [`03_manutencao_ambiente_1440x900.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/03_manutencao_ambiente_1440x900.png)
- **04. Aba Modelos de Importação:** [`04_modelos_importacao_1440x900.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/04_modelos_importacao_1440x900.png)
- **05. Aba Meu Perfil / Conta:** [`05_meu_perfil_1440x900.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/05_meu_perfil_1440x900.png)

### Resolução 1366×768:
- **06. Aba Preferências Gerais (Responsivo):** [`06_preferencias_geral_1366x768.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/06_preferencias_geral_1366x768.png)

### Contraste com Governança Executiva:
- **07. Governança Executiva (Referência de Comparação):** [`07_governanca_executiva_1440x900.png`](file:///C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e/07_governanca_executiva_1440x900.png)

---

## 6. Mapeamento de Riscos e Salvaguardas

| Risco Mapeado | Severidade | Impacto Potencial | Estratégia de Mitigação Obrigatória |
|---|---|---|---|
| **Quebra de persistência de Tema ou Aba Padrão** | Alta | Usuário perder configuração de tema escuro ou página inicial. | Preservar integralmente o `PreferencesContext` e as chaves de `localStorage` (`theme`, `default_tab`). |
| **Regressão nos Parâmetros do Motor Operacional** | Crítica | Alterar moeda, fuso ou tolerância de ponto indevidamente. | Manter intacta a mutação `ConfiguracaoOperacionalService.upsert` e validação por tenant/empresa. |
| **Disparo indevido de Reset Operacional** | Crítica | Perda acidental de dados transacionais. | Não tocar na lógica de `ResetOperacionalService`. Preservar dialog de dupla confirmação, preview de tabelas e justificativa obrigatória. |
| **Falha em Upload de Foto de Perfil** | Média | Erro ao salvar avatar do usuário no Supabase Storage. | Manter `StorageService.uploadFile` e `StorageService.getPublicUrl` intactos. |
| **Quebra de responsividade em 1366×768** | Média | Quebra de linha nas abas ou transbordamento dos cards. | Utilizar scroll horizontal suave na barra de abas (`overflow-x-auto`) e grid responsivo de 1 a 4 colunas. |

---

## 7. Plano de Implementação em Etapas (Proposta para CONV-21)

### **Etapa 01 — Auditoria e Inventário (Concluída)**
- Mapeamento completo de CONV-01 a CONV-20.
- Justificativa e seleção do próximo módulo (`/configuracoes`).
- Diagnóstico detalhado de divergências e riscos.
- Capturas de tela Playwright em 1440×900 e 1366×768.

### **Etapa 02 — Estrutura Principal, Cabeçalho Executivo e Abas de Uso Geral**
- Envelopar `Configuracoes.tsx` no padrão executivo oficial.
- Implementar o cabeçalho oficial e os 4 `OrbeKpiCard` executivos de síntese.
- Padronizar a trilha de abas para o padrão pill canônico.
- Convergir visualmente a aba **Preferências** (Aparência e Navegação) e a aba **Meu Perfil** (Avatar, dados cadastrais e segurança).
- Preservar 100% dos hooks e contextos.

### **Etapa 03 — Convergência das Abas Especializadas**
- Padronizar a aba **Configurações Operacionais** (cards do motor operacional, filtros de encarregado, jornadas e regras).
- Padronizar a aba **Modelos de Importação** (tabela com badges canônicos, botões de ação e modal de formulário).
- Refinar visualmente a aba **Manutenção do Ambiente** (`ResetOperacional.tsx`), mantendo intactas todas as regras de segurança e dupla confirmação.

### **Etapa 04 — Validação de Regressão, Suíte de Testes e Homologação Final**
- Criar a suíte automatizada `src/test/conv21_configuracoes_ui.test.tsx`.
- Executar `tsc --noEmit` e validação cruzada no Vitest.
- Gerar capturas pós-convergência e relatório final de entrega.

---

## 8. Parecer Técnico Final

> **PARECER DA AUDITORIA:**  
> Todos os módulos de **CONV-01 a CONV-20 estão homologados, estáveis e testados**.  
> O módulo **Preferências & Configurações (`/configuracoes`)** é a escolha ideal e prioritária para a **CONV-21**, completando a convergência de 100% dos itens da Sidebar oficial do ERP ORBE.  
>  
> **Nenhuma alteração em código de produção, banco de dados ou regras foi realizada nesta Etapa 01.**  
> O diagnóstico está consolidado e o sistema encontra-se pronto para a autorização da **CONV-21 / Etapa 02**.
