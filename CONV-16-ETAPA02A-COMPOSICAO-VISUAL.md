# CONV-16 — DIARISTAS
## ETAPA 02A — Composição Visual Controlada do Painel RH

**Projeto:** ERP ORBE — ESC Logística  
**Módulo:** Pessoas & RH → Diaristas  
**Rota oficial:** `/operacional/diaristas`  
**Componente:** `src/pages/Rh/RhDiaristasPainel.tsx`  
**Referência:** `CONV-16-ETAPA01-AUDITORIA-DIARISTAS.md`  
**Natureza:** Convergência visual controlada, sem alteração do domínio funcional  
**Data:** 08/10/2026  

---

## 1. RESUMO EXECUTIVO

A **ETAPA 02A** realizou a reestruturação visual controlada da tela oficial de gestão de Diaristas (`/operacional/diaristas`), integrando a interface ao padrão executivo homologado do ORBE (Design System, paleta Royal Blue `#2563EB`, canvas neutro `#F8FAFC`, cards `#FFFFFF` com bordas `#E2E8F0`, tipografia Inter/Outfit e densidade balanceada).

Conforme as diretrizes obrigatórias de governança:
- **Nenhuma regra de negócio foi alterada.**
- O serviço `diaristas.service.ts` e a rota do Encarregado `/producao/diaristas` **não foram tocados**.
- Nenhuma RPC, cálculo financeiro ou migration foi modificado.
- Os **modais funcionais existentes (Dialogs)** foram 100% preservados em seu comportamento e assinaturas (sem substituição precoce por Drawers, reservada para a ETAPA 02B).
- Todos os testes de tipagem TypeScript (`tsc --noEmit`) e suítes Vitest de Diaristas passaram com **100% de sucesso (24/24 testes)**.

---

## 2. ARQUIVOS MODIFICADOS E CRIADOS

| Arquivo | Natureza | Descrição |
|---|---|---|
| `src/pages/Rh/RhDiaristasPainel.tsx` | Modificado | Composição visual das 4 regiões canônicas, unificação de abas compactas, integração dos 4 KPIs com `ExecutiveMetricCard`. |
| `src/test/conv16_rh_diaristas_painel_visual.test.tsx` | Criado | Suíte de testes estruturais automatizados validando a presença e integridade das 4 regiões, KPIs e modais. |
| `CONV-16-ETAPA02A-COMPOSICAO-VISUAL.md` | Criado | Relatório executivo da etapa 02A. |

---

## 3. ESTRUTURA VISUAL IMPLEMENTADA

A interface foi estruturada em **quatro regiões canônicas** em um container com largura máxima contida (`max-w-[1560px] mx-auto p-4 md:p-6 space-y-6`), eliminando vazamentos de layout e scrollbars concorrentes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ REGIÃO 01: CABEÇALHO, CONTEXTO & BARRA DE FILTROS COMPACTA                  │
│ [Empresa] [Período] [Início] [Fim] [Situação] [Função] [Buscar]             │
│                                            [Atualizar] [Exportar] [Fechar]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ REGIÃO 02: INDICADORES EXECUTIVOS (4 KPIS)                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│ │Diárias       │ │Diaristas     │ │Valor Apurado │ │Situação dos Lotes    │ │
│ │Apuradas      │ │Ativos        │ │R$ X.XXX,XX   │ │X lote(s) pendente(s) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ REGIÃO 03: ÁREA PRINCIPAL DE TRABALHO (ABAS COMPACTAS)                      │
│ [ Grade Semanal ]   [ Por Diarista ]   [ Lotes & Ciclos ]   [ Auditoria ]   │
│                                                                             │
│ • Grade Semanal: Matriz Seg–Dom, Legenda P/MP/-, Totais por Colaborador     │
│ • Por Diarista: Consolidação por Pessoa, Expansão e Edição Administrativa   │
│ • Lotes & Ciclos: Resumo do Ciclo, Tabela de Lotes, Ações Validar/Reabrir   │
│ • Auditoria: Timeline de Governança, Exportar Planilha, Políticas do Ciclo │
├─────────────────────────────────────────────────────────────────────────────┤
│ REGIÃO 04: DETALHES CONTEXTUAIS & MODAIS PRESERVADOS (DIALOGS)              │
│ • Modal 1: Reabertura (Operacional / Administrativa com Motivo)             │
│ • Modal 2: Edição Administrativa (Snapshot Original, Recálculo, Motivo)     │
│ • Modal 3: Fechamento de Período (Confirmação digitando FECHAR)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### REGIÃO 01 — Cabeçalho e Contexto
- **Título:** `Diaristas`
- **Subtítulo:** `Acompanhe os lançamentos semanais, confira as apurações e valide os lotes da operação.`
- **Banners de Alerta Discretos:**
  - Aviso de revisão administrativa ativa (quando o encarregado está bloqueado e o RH/Admin assume a correção).
  - Aviso de período bloqueado para novos lançamentos.
- **Barra de Filtros Retangular e Compacta:**
  - **Empresa:** Seletor com ícone `Building2` (`empresaFiltroId`), permitindo selecionar empresa específica ou visão consolidada.
  - **Período Rápido:** Seletor com semana atual, semana anterior e personalizado.
  - **Datas Início / Fim:** Inputs compactos `h-9` com máscara nativa.
  - **Situação / Status:** Seletor com ícone `Filter` (Todos, Em aberto, Aguardando Validação RH, Validado RH, Fechado Financeiro, Pago).
  - **Função:** Seletor dinâmico baseado nas funções registradas no período.
  - **Colaborador:** Input de busca com ícone `Search` em tempo real.
  - **Ações à Direita:**
    - `Atualizar`: Botão com spinner animado durante fetch (`refetch()`).
    - `Exportar`: Botão com download em planilha XLSX (`exportarXlsx()`).
    - `Fechar Período`: Botão em tom âmbar com badge numérico de apontamentos em aberto (`rawEmAberto`), trava se `0` e abertura do modal de confirmação.

---

### REGIÃO 02 — Indicadores Executivos (4 KPIs)
Implementados utilizando o componente oficial homologado `ExecutiveMetricCard`:

| KPI | Label | Valor Exibido | Subtítulo | Fonte de Dados Real |
|---|---|---|---|---|
| **KPI 01** | **Diárias Apuradas** | `totalDiariasApuradas.toFixed(1)` | `${totalGeral.totalRegistros} apontamentos no escopo` | Soma ponderada das diárias respeitando multiplicadores (P = 1.0, MP = 0.5) de `dadosAgrupados` |
| **KPI 02** | **Diaristas Ativos** | `String(totalGeral.totalDiaristas)` | `Colaboradores apurados` | Contagem de diaristas distintos no escopo filtrado |
| **KPI 03** | **Valor Apurado** | `formatCurrency(totalGeral.valorTotal)` | `Custo total de diárias` | Soma real de `valor_calculado` dos registros ativos no escopo |
| **KPI 04** | **Situação dos Lotes** | `${lotesPendentesRh} pendente(s) RH` (ou status do ciclo) | `Ciclo: ${statusCicloAtual}` | Filtro real em `lotes` por `status === "AGUARDANDO_VALIDACAO_RH"` com badge semântico |

---

### REGIÃO 03 — Área Principal de Trabalho (Navegação Compacta)

Unificação das visualizações anteriores em quatro abas limpas e intuitivas:

#### 1. Aba: Grade Semanal
- **Matriz visual Seg–Dom:** Colunas organizadas por dia com nome do dia da semana, data formatada (`dd/MM`) e destaque visual sutil para o dia atual (`Hoje`).
- **Legenda Compacta:** `P` = Diária completa (1.0), `MP` = Meia diária (0.5), `–` = Sem apontamento.
- **Linhas:** Nome do colaborador, função, marcações em cada dia (com badges semânticos verde e âmbar e tooltips de cálculo), Total de Diárias ponderadas e Valor Apurado.

#### 2. Aba: Por Diarista
- Consolidação totalizadora por pessoa com ordenação alfabética.
- Colunas: Nome, Função, Resumo de Marcações (ex: `4x P`, `1x MP`), Total Diárias, Valor Total e Status.
- **Expansão Detalhada (Chevron):** Ao clicar na linha, expande a lista de lançamentos individuais do diarista exibindo data, diária base, valor calculado, cliente/unidade, observação e **botão contextual para acionar a Edição Administrativa**.
- Alternância rápida para visualização agrupada por data.

#### 3. Aba: Lotes & Ciclos
- **Card do Ciclo Selecionado:** Período de apuração, indicador de status do ciclo com pulso animado, diaristas, total apurado, pendências RH e pendências Financeiro.
- **Tabela de Lotes Semanais:** Período, Empresa, Registros, Valor Total, Status e botões de ação:
  - `Validar RH`: Ação disponível para RH/Admin em lotes `AGUARDANDO_VALIDACAO_RH`.
  - `Aprovar Financeiro`: Ação disponível para Admin em lotes `VALIDADO_RH`.
  - `Reabrir`: Ação com contador de reaberturas realizadas e limite configurável.
- **Tabela de Ciclos Históricos Consolidados:** Histórico de ciclos com totais consolidados e navegação direta para os lotes correspondentes.

#### 4. Aba: Auditoria & Governança
- **Timeline de Governança:** Apresentação cronológica dos eventos de governança (`logsFechamento`) com ícones semânticos para fechamento, validação, aprovação, pagamento e reaberturas, usuário responsável, IP, dispositivo e motivo registrado.
- Botão para **Exportar Planilha de Auditoria (XLSX)** e botão para **Sincronizar**.
- **Configurações Operacionais do Ciclo:** Parâmetros de dia padrão de fechamento, bloqueio operacional da grade, permissão de reabertura, limite máximo de reaberturas e travas de governança financeira (`updateRegraMutation`).

---

### REGIÃO 04 — Detalhes Contextuais & Modais Funcionais Preservados

Conforme a diretriz da ETAPA 02A, **todos os modais Dialog existentes foram mantidos intactos em sua integridade funcional e assinaturas**, sem substituição precoce por Drawers:

1. **Modal de Reabertura de Período (`Dialog open={openReabertura}`):**
   - Seletor de Tipo de Reabertura: **Operacional** (devolve para o encarregado) vs. **Administrativa** (bloqueia o encarregado e transfere a correção para RH/Admin).
   - Campo obrigatório de justificativa/motivo da reabertura.
   - Integração com `reabrirMutation`.

2. **Modal de Edição Administrativa (`Dialog open={openEdicao}`):**
   - Contexto do lote e snapshot imutável pré-mutação.
   - Campos: Marcação (P, MP, AUS), Quantidade, Data, Valor Base, Valor Final Calculado em tempo real e Observação.
   - Justificativa obrigatória (mínimo 5 caracteres) para gravação na trilha de auditoria.
   - Disparo da RPC `recalcular_valor_lote` para atualização imediata do lote no banco de dados.

3. **Modal de Confirmação de Fechamento (`Dialog open={openFechamento}`):**
   - Confirmação explícita de segurança exigindo digitação da palavra `FECHAR`.
   - Campo opcional de observações do fechamento.
   - Agrupamento idempotente de todos os lançamentos em aberto no período em um novo lote para o RH.

---

## 4. MAPEAMENTO DOS DADOS E PRESERVAÇÃO DE CONTRATOS

| Elemento Visual | Origem no Código | Serviço / Fonte DB |
|---|---|---|
| Lista de Empresas | `empresas` | `EmpresaService.getAll()` |
| Lotes do Período | `lotes` | `LoteFechamentoDiaristaService.getLotesPorPeriodo()` |
| Lançamentos por Período | `lancamentosPorPeriodo` | `LancamentoDiaristaService.getByPeriodo()` |
| Lançamentos por Lote | `lancamentosPorLote` | `LoteFechamentoDiaristaService.getLancamentosByLoteIds()` |
| Deduplicação de Registros | `lancamentos` (useMemo Map) | Precedência para registro de lote atualizado |
| Regras do Ciclo | `regraFechamento` | `DiaristaCicloService.getRegraFechamento()` |
| Trilha de Governança | `logsFechamento` | Supabase `diaristas_logs_fechamento` |
| Bloqueio do Período | `periodoBloqueado` | Validação de lotes ativos em status de governança |

---

## 5. RESULTADO DOS TESTES E VALIDAÇÃO TÉCNICA

### 5.1 Compilação TypeScript
```bash
npx tsc --noEmit
# Resultado: EXIT CODE 0 (Zero erros de compilação)
```

### 5.2 Suítes de Teste Automatizadas
```bash
npx vitest run src/test/cnab_fechamento_lote_diaristas_fail_closed.test.ts src/test/diaristas_segregation.test.ts src/test/conv16_rh_diaristas_painel_visual.test.tsx
```

**Resultado:**
- `src/test/cnab_fechamento_lote_diaristas_fail_closed.test.ts`: **6 passed (6)**
- `src/test/diaristas_segregation.test.ts`: **11 passed (11)**
- `src/test/conv16_rh_diaristas_painel_visual.test.tsx`: **7 passed (7)**
- **Total: 24 passed (100% dos testes da suíte passaram)**

---

## 6. LIMITAÇÃO DE AMBIENTE IDENTIFICADA

Durante a execução da ferramenta `browser_subagent` para captura automatizada de telas no navegador headless:
- O runner do Playwright falhou ao tentar baixar o driver binário do CDN da Microsoft (`HTTP 404 from playwright.azureedge.net`).
- Conforme o protocolo do sistema de agentes, a execução foi interrompida e registrada.
- A integridade e montagem da página foram rigorosamente validadas via testes estruturais em `conv16_rh_diaristas_painel_visual.test.tsx` e verificação estática do TypeScript.

---

## 7. PONTOS DE DECISÃO PARA A ETAPA 02B

A ETAPA 02A entrega a estrutura visual e os contratos congelados. Para a próxima etapa (ETAPA 02B), recomenda-se avaliar:

1. **Conversão de Modais para Drawers:**
   - Avaliar a conversão do Dialog de Edição Administrativa para um `Drawer` lateral (padrão de inspeção contextual do ORBE).
   - Avaliar se o Modal de Reabertura deve permanecer como Dialog modal de segurança (devido ao seu caráter crítico de devolução) ou se também segue para Drawer.
2. **Navegação Contextual para Financeiro:**
   - Adicionar atalho contextual direto para `/bancario?tab=diaristas` quando o lote atingir status `FECHADO_FINANCEIRO` ou `PAGO`.

---

## 8. CONCLUSÃO DA ETAPA 02A

A ETAPA 02A está **CONCLUÍDA** com sucesso:
- O layout do Painel RH de Diaristas está 100% alinhado à identidade executiva do ORBE.
- As 4 regiões canônicas foram estabelecidas com clareza operacional.
- Todos os contratos, serviços e fluxos homologados foram rigorosamente preservados.
- Nenhum código de negócio ou RPC foi modificado.
- Execução interrompida para avaliação e validação pelo usuário antes de qualquer ação na ETAPA 02B.
