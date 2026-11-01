# ERP ORBE — CONV-19 / ETAPA 02
## Relatório de Entrega: Convergência Visual da Central de Cadastros (`/cadastros`)

**Data:** 10 de Outubro de 2026  
**Status:** Concluído com Sucesso — Aguardando Validação Visual  
**Escopo:** Header Executivo Corporativo, 4 Cards Executivos Oficiais (`OrbeKpiCard`), Alinhamento Estrutural e Preservação Estrita das 8 Entidades Cadastradas.

---

### 1. ARQUIVOS ALTERADOS E CRIADOS

| Arquivo | Natureza | Descrição da Intervenção |
| :--- | :--- | :--- |
| `src/pages/CentralCadastros.tsx` | **Modificado** | • Convergência para o cabeçalho executivo institucional sob `AppShell` (max-w-[1560px], padding oficial 24px/md:p-6).<br>• Substituição dos 8 mini-indicadores legados por 4 cards oficiais do Design System (`OrbeKpiCard`).<br>• Cálculo matemático em tempo real com memoização e salvaguardas *fail-closed* baseadas na engine oficial (`getColaboradorCompletudeDetailed`).<br>• Preservação integral das 8 abas de entidades e seus contratos funcionais.<br>• Resolução de inconsistências pré-existentes de tipagem TypeScript no componente. |
| `src/test/conv19_central_cadastros_ui.test.tsx` | **Novo** | Suíte de testes automatizados com 10 testes cobrindo: Header institucional, 4 cards executivos, precisão matemática dos KPIs, regra fail-closed para cadastros provisórios, filtragem interativa por clique no KPI e preservação das 8 abas. |
| `CONV-19-ETAPA02-CENTRAL-CADASTROS-UI.md` | **Novo** | Relatório executivo oficial de entrega da Etapa 02. |

---

### 2. COMPONENTES REUTILIZADOS DO DESIGN SYSTEM

A convergência visual respeitou estritamente os componentes corporativos oficiais homologados nos módulos CONV-01 a CONV-17:

1. **`AppShell` (`@/components/layout/AppShell`)**:
   - Fornece a moldura corporativa com Topbar institucional, Sidebar retrátil e contenção em `max-w-[1560px]`.
   - Evitou a duplicação do cabeçalho de primeiro nível, padronizando o header interno como subseção de contexto.

2. **`OrbeKpiCard` (`@/components/ux-lab/design-system`)**:
   - Utilizado para renderizar os 4 indicadores executivos oficiais.
   - Respeita os tokens tipográficos `font-display`, `font-mono`, status dots (`info`, `success`, `warning`, `neutral`), bordas sutis (`border-border/80 dark:border-white/[0.06]`) e sombras executivas.
   - Configurado com `interactive={activeTab === "colaboradores"}` e feedback de seleção visual com anel de foco corporativo (`ring-1 ring-blue-600/40`).

3. **`Badge` & `Button` (`@/components/ui`)**:
   - Padronização de botões de ação global de cabeçalho (`Atualizar`, `Importar Planilha`, `Regras Operacionais`, `Gestão Detalhada`) utilizando ícones Lucide padronizados (`RefreshCw`, `Upload`, `Settings2`, `ExternalLink`).

---

### 3. CRITÉRIOS, FONTES E AUDITORIA DOS KPIS

Conforme as diretrizes obrigatórias, os 4 cards executivos utilizam exclusivamente dados reais de domínio, sem heurísticas visuais ou estimativas fabricadas:

```
                               ┌──────────────────────────────────────────────────────────┐
                               │           UNIVERSO MACRO DE COLABORADORES                │
                               │          (colaboradoresOperacionais.length)              │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                     ┌──────────────────────────────────────┼──────────────────────────────────────┐
                     ▼                                      ▼                                      ▼
      ┌──────────────────────────────┐       ┌──────────────────────────────┐       ┌──────────────────────────────┐
      │ 1. TOTAL DE COLABORADORES    │       │ 2. PRONTOS PARA OPERAÇÃO/FOLHA│      │ 3. PENDÊNCIAS CADASTRAIS/RH  │
      │ • Universo Total da Base     │       │ • Status !== 'inativo'       │       │ • Ativos com bloqueiaRh      │
      │ • Subtítulo: Ativos vs Total │       │ • !cadastro_provisorio       │       │ • Cadastro Provisório        │
      │ • Fonte: ColaboradorService  │       │ • !status pendente_complem.  │       │ • Incompletude RH/Operacional│
      └──────────────────────────────┘       │ • !bloqueiaRh                │       └──────────────────────────────┘
                                             │ • !bloqueiaFinanceiro        │                      │ (Cascateamento)
                                             │ • 100% Completude Geral      │                      ▼
                                             └──────────────────────────────┘       ┌──────────────────────────────┐
                                                                                    │ 4. PENDÊNCIAS BANCÁRIAS/FIN  │
                                                                                    │ • Ativos com bloqueio fin.   │
                                                                                    │ • !financeiro.completo       │
                                                                                    │ • Dados bancários inválidos  │
                                                                                    │ • Bloqueios herdados do RH   │
                                                                                    └──────────────────────────────┘
```

#### Detalhamento Técnico das Fontes e Regras:

1. **Card 1 — Total de Colaboradores**
   - **Valor:** `cadastrosKpiStats.total` (`colaboradoresOperacionais.length`).
   - **Subvalor:** `"${cadastrosKpiStats.ativos} colaboradores ativos"`.
   - **Status:** `neutral` (Informativo neutro).
   - **Fonte:** Query corporativa `colaboradores_list` via `ColaboradorService.getWithEmpresa()`.

2. **Card 2 — Prontos para Operação / Folha**
   - **Valor:** `cadastrosKpiStats.prontos`.
   - **Subvalor:** `"Zero bloqueios impeditivos"`.
   - **Status:** `"success"` se `prontos > 0`, senão `"neutral"`.
   - **Critério Fail-Closed Rigoroso:**
     - Exclusão de inativos (`status === 'inativo'`).
     - Exclusão absoluta de cadastros provisórios (`!cadastro_provisorio` e `status_cadastro !== 'pendente_complemento'`).
     - Ausência de bloqueios ativos (`!bloqueiaRh` e `!bloqueiaFinanceiro`).
     - Completude de 100% nas três dimensões avaliadas por `getColaboradorCompletudeDetailed`:
       * `operacional.completo === true` (Nome, CPF válido por módulo 11, Matrícula e Empresa UUID).
       * `rh.completo === true` (Cargo, PIS válido de 11 dígitos para CLT, Tipo Contrato, Valor Base > 0).
       * `financeiro.completo === true` (Titular, Código Banco, Agência, Conta e Tipo Conta válidos).

3. **Card 3 — Pendências Cadastrais / RH**
   - **Valor:** `cadastrosKpiStats.pendenciasRh`.
   - **Subvalor:** `"Bloqueiam fechamento RH"`.
   - **Status:** `"danger"` se `pendenciasRh > 0`, senão `"neutral"`.
   - **Critério:** Colaboradores ativos onde `bloqueiaRh === true`, ou `isProvisorio === true`, ou dados de RH/Operacional incompletos.

4. **Card 4 — Pendências Bancárias / Fin**
   - **Valor:** `cadastrosKpiStats.pendenciasFin`.
   - **Subvalor:** `"Gargalo bancário / CNAB"`.
   - **Status:** `"warning"` se `pendenciasFin > 0`, senão `"neutral"`.
   - **Critério e Cascateamento:** Colaboradores ativos onde `bloqueiaFinanceiro === true`, ou dados financeiros incompletos (`!financeiro.completo`), ou validação posicional bancária inválida (`!getColaboradorBankValidation(c).isValid`). *Observação de Domínio:* Como pendências de RH bloqueiam o fechamento de pagamentos, o motor propaga `bloqueiaFinanceiro = !financeiro.completo || bloqueiaRh`.

---

### 4. RESULTADO DOS TESTES E VALIDAÇÃO TÉCNICA

#### A. Teste Direcionado do Módulo (`src/test/conv19_central_cadastros_ui.test.tsx`)
Executado via Vitest:
```
 ✓ src/test/conv19_central_cadastros_ui.test.tsx (10 tests)
   ✓ 1. Renderiza o cabeçalho executivo institucional e as ações globais sob o AppShell
   ✓ 1.1 Botões de ação global navegam para as rotas corretas sem regressão
   ✓ 2. Renderiza exatamente os 4 cards executivos oficiais do Design System
   ✓ 2.1 Coerência rigorosa de dados: Total, Prontos e Pendências calculam com precisão
   ✓ 2.2 Regra Fail-Closed: Colaborador com cadastro provisório NUNCA é classificado como Pronto
   ✓ 3. Clicar nos cards filtra a tabela de colaboradores por status
   ✓ 4. Preserva integralmente as 8 abas funcionais do sistema
   ✓ 4.1 Alternância para a aba Empresas renderiza a tabela de empresas sem quebras
   ✓ 4.2 Alternância para a aba Transportadoras renderiza os parceiros cadastrados
   ✓ 4.3 Alternância para a aba Fornecedores renderiza os fornecedores cadastrados

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

#### B. Testes de Regressão em Módulos Homologados
Para garantir ausência total de efeitos colaterais nos fluxos existentes:
- `src/test/conv_fix02_drawer_cadastro_pendente.test.tsx`: **7/7 Aprovados** (Fluxo de regularização contextual da Central de Aprovações 100% preservado).
- `src/test/conv_shell_01_navigation.test.tsx`: **12/12 Aprovados** (Navegação estrutural e AppShell íntegros).
- `src/test/conv01_dashboard_executivo.test.tsx`: **7/7 Aprovados** (Design System Executivo de referência íntegro).
- `src/test/intermitentes_promocao_final_e2e.test.ts`: **15/15 Aprovados** (Módulo CONV-17 íntegro).
- `src/test/diaristas_segregation.test.ts`: **11/11 Aprovados** (Módulo Diaristas íntegro).

---

### 5. EVIDÊNCIAS DA ESTRUTURA VISUAL CONVERGIDA

1. **Header Executivo:**
   - Container contextual com fundo `bg-card dark:bg-[#15191F]`, borda sutil `border-border/80 dark:border-white/[0.06]` e cantos arredondados `rounded-xl`.
   - Breadcrumb/Eyebrow: Badge `Cadastros & Sistema` · `Gestão Mestre Centralizada`.
   - Título oficial: `Administração Operacional e Parametrização` com subtítulo funcional orientador.
   - Barra de ações globais alinhada à direita: botões compactos `Atualizar`, `Importar Planilha`, `Regras Operacionais` e `Gestão Detalhada`.

2. **Grid de 4 KPIs:**
   - Grid responsivo `grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4`.
   - Cards com indicadores de status colorido, tipografia monospace pesada para os números, subtítulos descritivos e ícones corporativos Lucide.
   - Interatividade bidirecional: ao clicar em "Prontos para Operação/Folha", a tabela filtra imediatamente apenas os colaboradores aptos; ao clicar em "Total", o filtro é limpo.

3. **Preservação das 8 Entidades:**
   - Aba 1: `Colaboradores` (equipe operacional, vínculos e completude).
   - Aba 2: `Empresas` (unidades, CNPJ, dados bancários de remessa).
   - Aba 3: `Coletores` (dispositivos REP, status de sincronização).
   - Aba 4: `Transportadoras` (parceiros de frete logístico).
   - Aba 5: `Fornecedores` (fornecedores de insumos e produtos de carga).
   - Aba 6: `Serviços` (tabela de tipos de serviço operacional).
   - Aba 7: `Materiais` (insumos operacionais e precificação).
   - Aba 8: `Parâmetros operacionais` (regras tarifárias do motor).

---

### 6. LIMITAÇÕES E OBSERVAÇÕES TÉCNICAS

1. **Auditoria de CPF e UUID nas Bases de Teste:**
   - A engine `getColaboradorCompletudeDetailed` aplica validação matemática restrita (módulo 11) para CPFs e checagem estrita de UUIDs para `empresa_id`. Registros com identificadores fictícios sem formatação válida são intencionalmente retidos em pendência por salvaguarda *fail-closed*.
2. **Formulários e Modais de Edição (Fora do Escopo da Etapa 02):**
   - Conforme instrução do usuário, os formulários internos de criação/edição (`Dialog` e `Sheet`) foram rigorosamente preservados sem modificação visual ou de fluxo nesta etapa, estando agendados para as próximas etapas (Etapa 03 / Etapa 04).
3. **Controle de Versão:**
   - Nenhuma alteração foi commitada ou enviada ao repositório remoto (`git push`).
