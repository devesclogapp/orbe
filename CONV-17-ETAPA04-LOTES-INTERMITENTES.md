# ERP ORBE — CONV-17 / ETAPA 04
## Relatório de Convergência UI/UX — Lotes de Intermitentes

**Projeto:** ERP ESC Logística 2026  
**Módulo:** Pessoas & RH → Intermitentes  
**Tela:** `/operacional/intermitentes/lotes` (`src/pages/Operacional/IntermitentesLotes.tsx`)  
**Data:** 09/10/2026  
**Status:** ✅ IMPLEMENTADO & VALIDADO (TESTES 100% VERDES / TSC 0 ERROS) — AGUARDANDO HOMOLOGAÇÃO VISUAL

---

## 1. OBJETIVO E ESCOPO DA ETAPA 04

A **ETAPA 04** realizou a convergência integral da interface de **Lotes de Intermitentes** para o Design System oficial do ORBE, alinhando a experiência às telas homologadas de Fechamento de Ciclos (CONV-08), Diaristas (CONV-16) e Intermitentes Recebidos (CONV-17 / FIX 02), com estrita observância das seguintes premissas:

* **Extensão e Convergência Estética:** Nenhuma regra de negócio, serviço de domínio, RPC, query do banco de dados ou integração foi alterada.
* **Preservação Canônica de Contratos:** Todas as interfaces públicas, classes de tabela, métodos de drawer (`DrawerPrimarioShell`, `DrawerSecundarioShell`) e integrações bancárias (`/bancario?tab=intermitentes&origem=INTERMITENTE`) foram preservadas integralmente.
* **Padrão de Diagnóstico de Governança:** Implementação explícita do fluxo **PROBLEMA → DIAGNÓSTICO → IMPACTO → PRÓXIMA AÇÃO → DESTINO CORRETO** nos blocos de auditoria e governança dos Drawers.

---

## 2. ESTRUTURA VISUAL E COMPONENTES CONVERGIDOS

### 2.1 Cabeçalho Padronizado (`AppShell`)
* Integrado com o componente oficial `AppShell`:
  - `title="Lotes de Intermitentes"`
  - `subtitle="Acompanhamento de lotes fechados, consolidação contábil, aprovações e ciclo de pagamento"`
  - `badge="FECHAMENTOS / OPERAÇÃO"`
* **Barra de Ações e Contexto Superior:**
  - Chip semântico em azul suave (`bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20`): `Regime Intermitente (Lotes Fechados)`.
  - Exibição limpa da competência ativa: `Competência: MM/AAAA`.
  - **Atalhos Preservados:**
    - Botão *"Jornadas / Processamento"* direcionando para `/operacional/intermitentes` (ícone `Clock`).
    - Botão *"Pagamentos e Remessas"* direcionando para `/bancario?tab=intermitentes&origem=INTERMITENTE` (ícone `Banknote`, estilizado em verde do Design System).

### 2.2 Quatro Indicadores Executivos Semânticos (`ExecutiveMetricCard`)
Substituídos os cards legados ad-hoc pelos componentes oficiais `ExecutiveMetricCard`:

| Indicador | Componente | Valor / Formatação | Subtítulo / Badge | Ícone |
| :--- | :--- | :--- | :--- | :--- |
| **Total de Lotes** | `ExecutiveMetricCard` | `kpis.totalLotes` (numérico) | `Competência MM/AAAA` • Badge `N no ciclo` | `CalendarCheck` |
| **Registros Fechados** | `ExecutiveMetricCard` | `kpis.totalRegistros` (numérico) | `Total de jornadas no ciclo` | `Users` |
| **Horas Consolidadas** | `ExecutiveMetricCard` | `kpis.horasTrab` (`HH:MM`) | `${horasNorm} normais • ${he50} HE 50%` | `Clock` |
| **Montante Total** | `ExecutiveMetricCard` | `formatCurrency(kpis.totalValor)` | `Apurado operacionalmente` | `DollarSign` |

### 2.3 Barra Compacta de Filtros
Estruturada no container unificado do Design System (`bg-card border border-border rounded-xl p-4 shadow-xs space-y-3`):
* **Campos:**
  1. *Empresa:* `Select` com opção *"Todas as Empresas"* e listagem dinâmica via `EmpresaService.getAll()`.
  2. *Busca Rápida:* `Input` com lupa interna buscando por código visual do lote (`INT-AAAA-MM-XXXX`), referência do lote ou razão social da empresa.
  3. *Mês:* `Select` de meses em português (Janeiro a Dezembro).
  4. *Ano:* `Select` dos últimos 5 anos.
  5. *Status:* `Select` abrangendo `Em análise RH`, `Aprovado RH`, `Aprovado Financeiro`, `Remessa Gerada`, `Pago` e `Devolvido`.
* **Ações de Suporte:**
  - Botão de restauração do mês/ano corrente (`RefreshCw`).
  - Botão de limpeza integral de filtros (`FilterX`), exibido condicionalmente quando há filtros ativos.
  - Barra de tags informativas com os filtros aplicados em tempo real.

### 2.4 Listagem de Lotes em Padrão Oficial
* Container em card com bordas suaves e overflow controlado.
* Cabeçalho de tabela com colunas alinhadas semanticamente:
  - `Lote` (Código visual + Referência em negrito com hover em primary)
  - `Empresa` (Ícone de prédio + Razão social truncada com segurança)
  - `Competência` (Tipografia mono centralizada)
  - `Registros` (Contagem em destaque mono)
  - `Composição Horas` (Total trabalhado + discriminação normais e HE50)
  - `Valor Total` (Alinhado à direita em formato monetário BRL)
  - `Status RH` (Badge semântico)
  - `Status Financeiro` (Badge semântico)
  - `Situação` (Badge sintético de estado terminal/andamento)
  - `Ações` (Botão sutil de *"Detalhes"* com chevron)

### 2.5 Drawers Operacionais com Diagnóstico Canônico
1. **Drawer Primário (`DrawerPrimarioShell`):**
   - Header com identificador do lote, empresa e timestamp de fechamento.
   - **Pipeline do Lote:** 5 etapas horizontais com conectores (`Recebido → Fechamento → Validação RH → Financeiro → CNAB/Pago`).
   - **Blocos de Governança Estruturados no Padrão Canônico:**
     * **DIAGNÓSTICO:** Identifica o estado contábil e operacional exato do lote.
     * **IMPACTO:** Explica as travas ativas (ex: lançamentos congelados contra edição).
     * **PRÓXIMA AÇÃO:** Descreve a próxima decisão (ex: aprovação formal financeira ou remessa bancária).
     * **DESTINO CORRETO:** Indica para onde o fluxo deve avançar (ex: Central Bancária / Remessas).
   - Grid de 4 KPIs específicos do lote (`Valor Total`, `Registros`, `Horas Totais`, `Horas Extras 50%`).
   - Composição individual dos colaboradores vinculados ao lote.
   - Bloco de auditoria com dados de fechamento e validação RH.
   - **Rodapé de Continuidade:** Botões condicionais por estado (`Aprovar Financeiro`, `Avançar para Remessa`, `Ver Conciliação Bancária`, `Ver fluxo completo`).
2. **Drawer Secundário (`DrawerSecundarioShell`):**
   - Linha do tempo com stepper vertical de 6 etapas canônicas:
     1. *Importação Tio Digital*
     2. *Fechamento de Período*
     3. *Validação do RH*
     4. *Aprovação Financeira / Remessa*
     5. *Geração de Arquivo CNAB 240*
     6. *Retorno Bancário & Quitação (PAGO)*
   - Ação nativa de retorno *"← Voltar aos detalhes"* sem fechar a pilha.

### 2.6 Estado Vazio Compacto e Propositivo
* Reduzido o padding vertical de `py-16` para `py-12`, eliminando espaços brancos vazios desnecessários.
* Mensagem objetiva e contextualizada pela competência selecionada:
  *"Não foram localizados lotes fechados para a competência MM/AAAA com os filtros informados."*
* Orientação operacional com ação rápida:
  - Botão para limpar filtros ativos (se houver).
  - Botão *"Consultar Jornadas em Aberto"* redirecionando para `/operacional/intermitentes`.

---

## 3. VALIDAÇÃO TÉCNICA E TESTES AUTOMATIZADOS

### 3.1 Suíte Completa CONV-17 (Vitest)
Comando executado: `npx vitest run src/test/conv17`

```
Test Files  5 passed (5)
     Tests  32 passed (32)
  Duration  9.04s

Suítes validadas:
  ✓ src/test/conv17_etapa02_saneamento_contratos.test.ts (11 tests)
  ✓ src/test/conv17_fix01_cnab_rotas.test.tsx (6 tests)
  ✓ src/test/conv17_etapa03_intermitentes_recebidos.test.tsx (5 tests)
  ✓ src/test/conv17_fix02_acabamento_recebidos.test.tsx (4 tests)
  ✓ src/test/conv17_etapa04_lotes_intermitentes.test.tsx (6 tests)
```

### 3.2 Testes E2E Canônicos de Lotes
Comando executado: `npx vitest run src/test/intermitentes_lotes_etapa_e2e.test.ts -t "IntermitentesLotes.tsx implementa"`
- **Resultado:** ✅ 1 test passed (0 failures).

### 3.3 Validação TypeScript Completa
Comando executado: `npx tsc --noEmit`
- **Resultado:** **0 erros** (código de saída 0).

---

## 4. ARQUIVOS MODIFICADOS E CRIADOS

1. **Modificado:** `src/pages/Operacional/IntermitentesLotes.tsx`
   - Migrado para `AppShell`, `ExecutiveMetricCard`, filtros compactos e tabela de design system.
   - Refinados os blocos de governança dos drawers com padrão canônico.
   - Estado vazio reduzido e integrado a ações de busca/redirecionamento.
2. **Criado:** `src/test/conv17_etapa04_lotes_intermitentes.test.tsx`
   - Suíte de 6 testes cobrindo cabeçalho, KPIs, filtros, tabela, drawers e linha do tempo.
3. **Modificado:** `src/test/conv17_etapa02_saneamento_contratos.test.ts` e `src/test/conv17_fix01_cnab_rotas.test.tsx`
   - Ajustados timeouts individuais para garantir execução estável em concorrência pesada.
4. **Criado:** `CONV-17-ETAPA04-LOTES-INTERMITENTES.md`
   - Relatório técnico completo de homologação.

---

## 5. DIRETRIZES DE FINALIZAÇÃO

Conforme exigido pelo usuário:
* **Nenhum commit foi criado.**
* **Nenhum fechamento real ou operação bancária de produção foi executada.**
* **Interrompido após a implementação da ETAPA 04 para homologação visual do usuário.**
