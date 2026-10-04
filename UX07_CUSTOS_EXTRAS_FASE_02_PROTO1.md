# UX07 — CUSTOS EXTRAS V2 — FASE 02 — PROTÓTIPO 1

**Rota:** `/ux-lab/custos-extras` (isolada no UX Lab)
**Status:** Protótipo 1 entregue para homologação visual.

## 1. Arquitetura

| Arquivo | Papel |
| :--- | :--- |
| `src/pages/UxLab/UxLabCustosExtras.tsx` | Página especialista (cards, filtros, tabela) |
| `src/pages/UxLab/custosExtrasMockData.ts` | Dataset explícito + helpers de labels |
| `src/components/ux-lab/UxLabCustoExtraDrawer.tsx` | Drawer Consultar → Diagnosticar → Despachar |
| `src/components/ux-lab/UxLabSidebar.tsx` | Rota `custos-extras` em `UX_LAB_ROUTES` |
| `src/App.tsx` | Registro da rota `/ux-lab/custos-extras` |
| `src/test/ux_custos_extras_v2_proto1.test.tsx` | Suíte UX07 (24 testes) |
| `src/test/ux_lab_navigation_e2e.test.tsx` | Atualizado para incluir a nova rota |

Reutiliza: `UxLabShell`, `UxLabFiltroTemporal` (campo `data`), `max-w-[1560px]`, Sheet/Badge/Select homologados.

## 2. Cards (R$ principal + contagem secundária)

| Card | Composição | Cor |
| :--- | :--- | :--- |
| Custos no Período | Todos os registros filtrados | Neutro/institucional |
| Requer Ação | `REPROVADO`, `EM_VALIDACAO`, `RECEBIDO` (R$ 1.775,00 / 5) | Âmbar |
| A Pagar / Financeiro | `APROVADO_OPERACAO`/`ENVIADO_FINANCEIRO` com `A_PAGAR`/`ATRASADO` e `origem ≠ PAGO_EMPRESA` (R$ 2.600,00 / 3) | Índigo |
| Pagos / Liquidados | `PAGO_EMPRESA` finalizado ou `status_pagamento = PAGO` (R$ 2.080,00 / 4) | Verde |

Card ≠ Badge ≠ Highlight: o destaque da linha usa o estado real (REPROVADO/ATRASADO → rose; EM_VALIDACAO → âmbar; RECEBIDO → azul; etc.).
Navegação: busca só dentro dos filtros ativos, `scrollIntoView` suave, destaque temporário, ciclo circular (prioridade REPROVADO → EM_VALIDACAO → RECEBIDO), reset ao mudar filtros, toast quando vazio. Filtros nunca são alterados pelos cards.

## 3. Filtros
Busca (código, descrição, categoria, favorecido, unidade/empresa), período (`UxLabFiltroTemporal` sobre `data`), categoria, origem do recurso, pipeline, empresa (cabeçalho) e botão Limpar.

## 4. Tabela
Código · Data · Empresa/Unidade · Categoria · Descrição/Favorecido · Origem do Recurso · Valor Total · Pipeline · Pagamento · Ação. Pipeline e Pagamento são colunas e badges independentes (sem superstatus). Categorias em badge monocromático.

## 5. Origem do recurso
`PAGO_EMPRESA` → Pago pela Empresa · `REEMBOLSO_COLABORADOR` → Reembolso · `PAGAMENTO_PENDENTE` → Pagamento a Fornecedor · `LEGACY` → Registro Legado.

## 6. Drawer
Header (código, categoria, empresa/unidade, data, badges Pipeline e Pagamento; sem X superior; Fechar no rodapé + ESC) · Diagnóstico (justificativa destacada se REPROVADO) · Origem do Recurso (bloco por tipo) · Despesa & Contexto · Composição do Valor (Qtd × Unitário = Total) · Fluxo Financeiro (obrigação vs. desembolsado) · Integridade ("Valores protegidos após aprovação."). Ações apenas de despacho (Ir para Aprovações, Resolver pendência, Abrir no Financeiro, Consultar pagamento) via toast; sem dropdown de status, sem edição, sem Imprimir.

## 7. Mocks (12 registros, valores explícitos)
CE-001 RECEBIDO+PAGO_EMPRESA · 002 EM_VALIDACAO+PAGO_EMPRESA · 003 REPROVADO · 004 APROVADO_OPERACAO+REEMBOLSO · 005 ENVIADO_FINANCEIRO+FORNECEDOR · 006 ATRASADO · 007 FINALIZADO+PAGO_EMPRESA · 008 FINALIZADO+REEMBOLSO+PAGO · 009 FINALIZADO+FORNECEDOR+PAGO · 010 LEGACY · 011 RECEBIDO+REEMBOLSO · 012 EM_VALIDACAO+FORNECEDOR. Total R$ 6.455,00.

## 8. Testes
- `npx vitest run src/test/ux_custos_extras_v2_proto1.test.tsx` → 24/24
- `npx vitest run src/test/ux_lab_navigation_e2e.test.tsx` → 3/3
- `npx tsc --noEmit` → exit 0

## 9. Isolamento
Nenhuma alteração em produção, backend, Supabase, migrations, RPCs, RLS ou services. Apenas arquivos do UX Lab, rota em `App.tsx` e teste de navegação.
