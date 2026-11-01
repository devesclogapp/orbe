# ERP ORBE — CONV-17 / ETAPA 03
## Relatório de Convergência UI/UX — Intermitentes Recebidos

**Data de Execução:** 09/10/2026  
**Tela:** `/operacional/intermitentes`  
**Componentes Principais:**  
- `src/pages/Operacional/IntermitentesRecebidos.tsx`  
- `src/components/operacoes/IntermitentesTableBlock.tsx`  
**Status da Etapa:** Concluído com sucesso (Aguardando homologação visual)

---

## 1. Resumo Executivo

A interface de **Intermitentes Recebidos** (`/operacional/intermitentes`) foi totalmente convergida para o **Design System oficial do ORBE**, adotando as mesmas premissas de identidade visual, ergonomia, responsividade e governança já homologadas nos módulos anteriores (CONV-01 a CONV-16).

### Principais Ganhos:
1. **Consolidação dos KPIs:** Substituição dos 8 micro-cards assimétricos por **4 Indicadores Executivos Semânticos** (`ExecutiveMetricCard`), combinados a uma **Fita Secundária Contextual** que preserva **100% dos dados detalhados** (sem perda de granularidade de horas e apontamentos).
2. **Barra Compacta de Filtros:** Seletor de Empresa com busca integrada, campo de busca textual rápida (colaborador, cargo, convocação), competência (Mês/Ano) e botões de restauração/limpeza de filtros.
3. **Tabela Operacional Padronizada:** Densidade consistente, tipografia tabular monospaçada para valores e horários, badges de status semânticos (verde para aprovado, azul para lote/validação, amarelo para recebido, vermelho para devolvido), e paginação compacta (15/25/50/100 registros).
4. **Preservação Canônica Integral:** Todas as travas de domínio (como obrigatoriedade de seleção de empresa para fechamento de período com label `"Selecione uma Empresa para Fechar"`, filtros por `EnvironmentQueryFilter`, mutations e navegação para lotes) foram estritamente preservadas.

---

## 2. Arquivos Alterados e Criados

| Arquivo | Natureza | Descrição das Modificações |
| :--- | :--- | :--- |
| `src/pages/Operacional/IntermitentesRecebidos.tsx` | Alterado | Implementação dos 4 `ExecutiveMetricCard`, fita secundária de detalhamento de horas, barra compacta de filtros, badges de estado, banner de devolvidos e botões padronizados. |
| `src/components/operacoes/IntermitentesTableBlock.tsx` | Alterado | Inclusão de paginação interna (15/25/50/100 por página), cabeçalho de tabela alinhado ao Design System, badges semânticos oficiais e empty state refinado. |
| `src/test/conv17_etapa03_intermitentes_recebidos.test.tsx` | Criado | Suíte de testes unitários e comportamentais cobrindo contratos de UI, KPIs executivos, filtros, tabela e empty state (5/5 testes passando). |

---

## 3. Mapeamento dos Oito Indicadores Originais (Zero Perda de Dados)

Os oito micro-cards anteriores foram consolidados sem qualquer descarte de informação:

| Indicador Original | Indicador Consolidado no Design System | Localização / Mecanismo |
| :--- | :--- | :--- |
| **1. Colaboradores** | `ExecutiveMetricCard`: **Colaboradores Convocados** | **Card 1 (Executivo)** — Exibe a quantidade de colaboradores distintos apurados; subtítulo exibe total de apontamentos capturados; badge indica registros abertos. |
| **2. Registros** | Subtítulo do Card 1 + Fita Secundária (`Total Apontamentos: N`) | **Card 1 + Fita de Horas** — Mantido no subtítulo e na barra contextual detalhada. |
| **3. H. Trabalhadas** | `ExecutiveMetricCard`: **Jornada Total Trabalhada** | **Card 2 (Executivo)** — Exibe o volume total de horas trabalhadas apuradas; subtítulo exibe horas em jornada regular. |
| **4. H. Normais** | Subtítulo do Card 2 + Fita Secundária (`Normais: HH:MM`) | **Card 2 + Fita de Horas** — Visível no subtítulo do Card 2 e discriminado com destaque na fita contextual. |
| **5. HE 50%** | `ExecutiveMetricCard`: **Horas Extras & Noturna** + Fita Secundária (`HE 50%: HH:MM`) | **Card 3 (Executivo) + Fita de Horas** — Valor principal destaca HE 50%; fita exibe badge destacado em âmbar. |
| **6. HE 100%** | Subtítulo do Card 3 + Fita Secundária (`HE 100%: HH:MM`) | **Card 3 + Fita de Horas** — Subtítulo do Card 3 exibe HE 100%; fita contextual exibe badge em laranja. |
| **7. H. Noturna** | Subtítulo e Badge do Card 3 + Fita Secundária (`Noturna: HH:MM`) | **Card 3 + Fita de Horas** — Card 3 exibe badge "Turno Noturno" quando aplicável; fita contextual discrimina em violeta. |
| **8. Valor** | `ExecutiveMetricCard`: **Valor Total Apurado** | **Card 4 (Executivo)** — Exibe o valor financeiro apurado consolidado (R$); subtítulo exibe o custo médio por colaborador. |

---

## 4. Comparativo Antes x Depois

| Aspecto | Versão Anterior (Legado) | Nova Versão (Convergência ORBE) |
| :--- | :--- | :--- |
| **Largura e Layout** | Elementos com larguras ad-hoc e classes arbitrárias (`rounded-[12px]`, `#DEDEDE`). | Container oficial `max-w-[1560px]`, `px-6 py-6`, tokens semânticos `border-border`, `bg-card`. |
| **Cores e Temas** | Cores hexadecimais hardcoded (`#737373`, `#171717`, `#EBEBEB`, `#DEDEDE`). | Totalmente compatível com tema Claro e Escuro via tokens CSS HSL (`text-muted-foreground`, `bg-background`, `text-foreground`). |
| **Cards de Indicadores** | 8 micro-cards comprimidos em grid de 8 colunas, difíceis de ler em telas médias/pequenas. | 4 `ExecutiveMetricCard`s balanceados (grid 1/2/4 colunas) + Fita horizontal discriminando exatamente as horas normais, extras e noturnas. |
| **Barra de Filtros** | Borda cinza fixa, inputs sem ícones e espaçamento genérico. | Card compacto com ícones temáticos (`Building2`, `Search`, `CalendarIcon`), chip de filtros ativos e botão dedicado para limpar filtros. |
| **Navegação & Continuidade** | Sem atalho direto para gestão dos lotes gerados. | Botão no topo "Gestão de Lotes" direcionando diretamente para `/operacional/intermitentes/lotes`. |
| **Tabela Operacional** | Listagem corrida em tabela sem paginação (risco de travamento com muitos registros). | Tabela responsiva com overflow controlado, paginação em páginas configuráveis (15, 25, 50, 100) e badges com cores semânticas padronizadas. |
| **Empty State** | Linha simples de tabela com texto cinza. | Empty state ilustrado com ícone `FileSpreadsheet`, título claro e mensagem de orientação contextual. |
| **Banner de Devolvidos** | Fundo `#FFF1F2` e borda rosa dura. | Card suave `bg-rose-500/10` com semântica de alerta, motivo da devolução e botão "Reabrir Período". |

---

## 5. Resultados dos Testes

### 5.1 Testes da Etapa 03 (Vitest)
Executado: `npx vitest run conv17`
- `src/test/conv17_etapa03_intermitentes_recebidos.test.tsx` (5/5 passaram):
  - `1. Contrato Estático: IntermitentesRecebidos utiliza ExecutiveMetricCard e preserva restrições`: **PASS**
  - `2. Renderização: Exibe os 4 Indicadores Executivos Semânticos com valores corretos`: **PASS**
  - `3. Barra Compacta de Filtros: Contém Empresa, Busca Rápida, Mês e Ano`: **PASS**
  - `4. Tabela IntermitentesTableBlock: Renderiza colunas operacionais, badges e paginação`: **PASS**
  - `5. Tabela IntermitentesTableBlock: Renderiza empty state amigável quando vazia`: **PASS**
- Total da suíte CONV-17: **22/22 testes aprovados** (100% de sucesso).

### 5.2 Teste de Regressão de Domínio
Executado: `npx vitest run src/test/intermitentes_fechamento_periodo_e2e.test.ts`
- Total: **4/4 testes aprovados**. Assegura que o bloqueio de fechamento em "Todas as Empresas" e o escopo de `EnvironmentQueryFilter` permanecem intactos.

### 5.3 Validação de Compilação TypeScript
- Arquivos `src/pages/Operacional/IntermitentesRecebidos.tsx` e `src/components/operacoes/IntermitentesTableBlock.tsx`: **0 erros de tipagem**.

---

## 6. Verificação Visual e Observação do Subagente de Navegador

O servidor de desenvolvimento local está ativo e executando na porta `5173`.
Durante a tentativa de captura automatizada de screenshots via `browser_subagent`, o ambiente reportou falha externa no download do binário do driver do Playwright pelo host (`404 Not Found` no repositório de binários upstream do Playwright).

A tela pode ser validada visualmente de imediato no navegador acessando:
- **URL Local:** `http://localhost:5173/operacional/intermitentes`
- **Ambiente de Teste:** Autenticar com perfil Administrador ou Operacional.
- **Responsividade:** Validar em desktop (largura > 1280px) e em viewport móvel (< 640px).

---

## 7. Pendências e Próximos Passos

1. **Apresentação e Homologação Visual:** Aguardar a validação do usuário referente à estética, diagramação dos 4 cartões executivos e à fita secundária de jornada.
2. **Próxima Etapa (ETAPA 04):** Convergência da tela de **Lotes de Intermitentes** (`/operacional/intermitentes/lotes` e `src/pages/Operacional/IntermitentesLotes.tsx`), mantendo o isolamento estrito em relação à Central Bancária e aos serviços de pagamento.
