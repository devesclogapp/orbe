# UX03 — RESULTADO OPERACIONAL (DRE)
## FASE 01 — AUDITORIA FUNCIONAL E ARQUITETURAL

> **Status:** Concluído — Checkpoint de Alinhamento  
> **Ambiente:** Diagnóstico Técnico e Arquitetural (Sem alterações em código de produção)  
> **Data:** 2026-10-01  
> **Alvo:** ORBE ERP — Módulo Financeiro / Resultado Operacional (DRE)  

---

## 1. FUNÇÃO ATUAL DO DRE NO ORBE

O **Resultado Operacional (DRE)** no ORBE ERP atua como a demonstração financeira consolidada de curto prazo (mês/ano) que apura a viabilidade econômica direta das operações logísticas realizadas. 

Ao contrário de uma contabilidade estatutária tradicional (com plano de contas geral, depreciações complexas e provisões de balanço patrimonial), o DRE do ORBE é um **DRE Gerencial Operacional**. Sua missão central é confrontar:
1. O valor das receitas geradas pela prestação dos serviços operacionais e logísticos (descargas, transbordos, serviços extras);
2. Os custos diretos de mão de obra mobilizada (CLT, Intermitentes e Diaristas);
3. Os custos e despesas operacionais pontuais/eventuais lançados em campo e aprovados pelo financeiro.

A apuração resulta no **Resultado Operacional (Lucro Bruto)** e na correspondente **Margem Operacional (%)**, informando aos gestores se a prestação de serviços logísticos de uma determinada competência cobriu seus custos operacionais diretos e gerou sobra de caixa para a empresa.

---

## 2. MAPA TÉCNICO DA IMPLEMENTAÇÃO ATUAL

Abaixo está o inventário exaustivo de todos os ativos de software que compõem o DRE hoje:

### 2.1 Página Principal e Roteamento
* **Página:** [`src/pages/Financeiro/RelatorioDRE.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Financeiro/RelatorioDRE.tsx) (262 linhas).
* **Rotas Registradas:** `/financeiro/dre` em [`src/App.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/App.tsx#L220) sob proteção do `<AuthGuard>`.
* **Entrada de Menu:** Item *"Resultado (DRE)"* em [`src/components/layout/Sidebar.tsx`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/components/layout/Sidebar.tsx#L228), pertencente ao agrupamento `financeiro`, atrelado à permissão `central_financeira`.

### 2.2 Componentes e Camada Visual
* **Estrutura:** `AppShell` com título `"Resultado Operacional (DRE)"`.
* **Cards de Síntese:** Componente `Card` do Shadcn UI (`border-l-4`) exibindo 4 cards com ícones Lucide (`DollarSign`, `Activity`, `TrendingUp`, `TrendingDown`, `FileText`).
* **Estados de Espera:** Componente `Skeleton` para transições de carregamento assíncrono.
* **Tabela Cascata:** Elemento `<table>` simples com linhas estilizadas em Tailwind CSS simulando o balanço em cascata.
* **Feedback de Erro:** Bloco de aviso estilizado com `AlertCircle`.

### 2.3 Hooks e Gerenciamento de Estado
* **`useTenant`:** Contexto de multitenancy (`@/contexts/TenantContext`) que fornece o `tenant.id`.
* **`useState`:**
  * `year`: ano selecionado (padrão: ano corrente, opções: 2024, 2025, 2026, 2027).
  * `month`: mês selecionado (`'all'` ou `'01'` a `'12'`).
* **`useQuery`:** Query TanStack `['dre_kpis', year, month]` invocando `DashboardConsolidadoService.getKpisAggregate(year, month)`.
* **`useMemo`:** Cálculo dinâmico da margem percentual `(dreData.lucroReal / dreData.faturamentoTotal) * 100`.

### 2.4 Services e Camada de Domínio
* **Service Central:** `DashboardConsolidadoService` em [`src/services/dashboard.service.ts`](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/dashboard.service.ts) (874 linhas).
  * Método `getKpisByCompetencia(competencia, empresaId?)`: executa as 8 queries em paralelo no Supabase, processa acumuladores de fluxo (`folhaFlow`, `intermitenteFlow`, `diaristaFlow`) e apura o balanço.
  * Método `getKpisAggregate(year, month, empresaId?)`: caso `month === 'all'`, despacha 12 chamadas em paralelo para cada mês do ano (`Promise.all`) e faz a consolidação cumulativa anual em memória.
  * Função canônica `isCustoExtraReconhecidoDRE(item)`: filtra quais custos extras entram no cálculo contábil.
  * Função canônica `normalizeCompetencia(value)`: higienização da string de período (`YYYY-MM`).

### 2.5 Queries e Tabelas do Supabase Consultadas
O DRE atual consome diretamente **9 tabelas** do PostgreSQL via PostgREST:
1. `receitas_operacionais`: total faturado e recebido (status != cancelado).
2. `diaristas_lotes_fechamento`: lotes semanais de diaristas fechados/pagos.
3. `rh_financeiro_lotes`: lotes mensais de folha e quinzenais de intermitentes.
4. `rh_financeiro_lote_itens`: valores individuais de cada colaborador no lote RH.
5. `custos_extras_operacionais`: despesas pontuais aprovadas em campo.
6. `servicos_extras_operacionais`: serviços extraordinários para apuração de pendências.
7. `lotes_remessa`: lotes bancários de saída.
8. `cnab_remessas_arquivos`: arquivos bancários gerados.
9. `cnab_retorno_itens`: liquidações bancárias confirmadas via retorno.

### 2.6 RPCs e Views
* **Inexistentes para DRE:** Não existe nenhuma view (`VIEW` / `MATERIALIZED VIEW`) nem RPC (`FUNCTION plpgsql`) dedicada à consolidação do DRE. Toda a agregação é feita em tempo de execução via cliente TypeScript (`DashboardConsolidadoService`).

### 2.7 Filtros, Exports, Drawers e Navegação
* **Filtros na UI:** Apenas Ano e Mês.
  * *Observação crítica:* O backend/service aceita `empresaId`, mas a tela `RelatorioDRE.tsx` **não possui** o seletor de empresa.
* **Exports:** **Nenhum** (não há botão de exportar para PDF, CSV ou Excel).
* **Navegações e Drill-down:** **Nenhum** (clicar nas linhas da cascata não abre modais, nem filtra e nem navega para os lotes ou notas de origem).
* **Drawers / Modais:** Inexistentes na tela atual.

---

## 3. ORIGEM DAS RECEITAS

O resultado do DRE é alimentado pela **Receita Operacional Bruta** (`faturamentoTotal`).

```
OPERAÇÕES POR VOLUME
(operacoes_producao)
      │  Status: AGUARDANDO_FATURAMENTO, FATURADO, RECEBIDO_FINANCEIRO
      ▼
TRIGGER DE BANCO: fn_gerar_receita_operacional_automatica()
      │
      ├───────────────────────────────┐
      ▼                               ▼
receitas_operacionais        receitas_operacionais_itens
 (Registro consolidado)       (Vínculo 1:N com operações/serviços)
      ▲
      │ Status: APROVADO_OPERACAO / ENVIADO_FINANCEIRO
SERVIÇOS EXTRAS
(servicos_extras_operacionais)
```

### 3.1 Classificação e Modalidades de Receita
As receitas registradas no banco classificam-se em 3 modalidades:
1. **`CAIXA_IMEDIATO`:** Operações pagas à vista (dinheiro, PIX, cartão débito/crédito). Status inicial: `pendente_recebimento`.
2. **`DUPLICATA`:** Operações a prazo com cobrança individual por operação. Status inicial: `pendente_cobranca`.
3. **`FATURAMENTO_MENSAL`:** Operações consolidadas para faturamento mensal corporativo do cliente. Status inicial: `aguardando_fechamento`.

### 3.2 Regra de Reconhecimento Contábil no DRE
* **Condição:** Linhas da tabela `receitas_operacionais` onde `status != 'cancelado'`.
* **Filtro Temporal Atual:** `created_at >= startRange AND created_at < endRange`.
  * *Ponto de atenção:* Se o registro for criado em outubro com competência de setembro, a query atual em `dashboard.service.ts` aloca a receita pela data de criação (`created_at`) em vez da coluna `competencia`.

---

## 4. ORIGEM DOS CUSTOS E DESPESAS

Os custos operacionais confrontados no DRE segregam-se em duas grandes vertentes: **Mão de Obra** e **Gastos Extras**.

### 4.1 Mão de Obra Aprovada (`finValorAprovado`)
Composta por 3 pilares isolados (sem duplicação):

| Pilar | Tabela de Origem | Filtro de Status Reconhecido no DRE | Período de Apuração |
|---|---|---|---|
| **Folha CLT** | `rh_financeiro_lotes` (`tipo != 'INTERMITENTES'`) | `APROVADO_FINANCEIRO`, `PAGO`, `CNAB_GERADO` | `competencia = 'YYYY-MM'` |
| **Intermitentes** | `rh_financeiro_lotes` (`tipo == 'INTERMITENTES'`) | `APROVADO_FINANCEIRO`, `PAGO`, `CNAB_GERADO` | `competencia = 'YYYY-MM'` |
| **Diaristas** | `diaristas_lotes_fechamento` | `FECHADO_FINANCEIRO`, `AGUARDANDO_PAGAMENTO`, `PAGO`, `CNAB_GERADO` | `periodo_inicio >= startRange AND periodo_inicio < endRange` |

### 4.2 Gastos Extras / Logística Eventuais (`custosGerais`)
* **Tabela de Origem:** `custos_extras_operacionais`.
* **Regra Canônica de Reconhecimento (`isCustoExtraReconhecidoDRE`):**
  * `deleted_at IS NULL` (ignora soft-deleted);
  * `pipeline_status IN ('APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO', 'FINALIZADO')`;
  * `status_pagamento != 'CANCELADO'`;
  * Data do custo: `data >= startRange AND data < endRange`.

### 4.3 O que NÃO entra no DRE hoje (Lacunas Mapeadas)
* **ISS Dedutível / Impostos Diretos:** Na operação por volume, o ISS é calculado e embutido no valor faturado (`custo_com_iss`). O DRE atual reconhece o valor bruto integral e **não deduz impostos em linha destacada**.
* **Insumos e Materiais:** Filme stretch e paletes são somados na receita bruta faturada, mas não há linha de deduções de custos de insumos no DRE.
* **Custos Fixos Administrativos:** Aluguéis, sistemas e despesas de sede não passam por `custos_extras_operacionais` e, portanto, não constam na apuração.

---

## 5. FÓRMULAS ENCONTRADAS NO CÓDIGO

As regras matemáticas implementadas em `src/services/dashboard.service.ts` e `src/pages/Financeiro/RelatorioDRE.tsx` são:

$$\text{Receita Bruta} = \sum \text{receitas\_operacionais.valor\_total} \quad (\text{status} \neq \text{'cancelado'})$$

$$\text{Mão de Obra} = \text{Folha CLT} + \text{Intermitentes} + \text{Diaristas}$$

$$\text{Custos Extras} = \sum \text{custos\_extras\_operacionais.total} \quad (\text{aprovados no pipeline})$$

$$\text{Despesas Totais} = \text{Mão de Obra} + \text{Custos Extras}$$

$$\text{Resultado Operacional (Lucro Real)} = \text{Receita Bruta} - \text{Despesas Totais}$$

$$\text{Margem Operacional (\%)} = \left( \frac{\text{Resultado Operacional}}{\text{Receita Bruta}} \right) \times 100$$

$$\text{Caixa Recebido} = \sum \text{receitas\_operacionais.valor\_total} \quad (\text{status} \in [\text{'recebido', 'pago', 'conciliado'}])$$

---

## 6. FILTROS EXISTENTES NA TELA

| Filtro | Tipo de Controle | Valores Possíveis | Comportamento no Service |
|---|---|---|---|
| **Ano** | `<Select>` | `2024`, `2025`, `2026`, `2027` | Repassado para query de competência / range anual |
| **Mês** | `<Select>` | `all`, `01` a `12` | Se `all`, roda agregação anual (12 queries). Se mês, filtra a competência específica. |

*Limitação Crítica:* Não há filtro de **Empresa**, **Unidade**, **Cliente** ou **Modalidade** na interface, mesmo o service aceitando `empresaId`.

---

## 7. JORNADA DO USUÁRIO: O QUE O DRE RESPONDE VS. NÃO RESPONDE

Quando o Diretor de Operações ou Gestor Financeiro abre o DRE, busca respostas para perguntas estratégicas do negócio:

| Pergunta do Gestor | O Sistema Atual Responde? | Status / Diagnóstico |
|---|---|---|
| **1. Quanto faturamos no período?** | **SIM** | **[EXISTE HOJE]** Exibido no KPI "Receita Bruta" e na cascata. |
| **2. Quanto custou a operação?** | **SIM** | **[EXISTE HOJE]** Exibido no KPI "Despesas / Custos" e subdividido na cascata. |
| **3. Qual foi o resultado líquido operacional?** | **SIM** | **[EXISTE HOJE]** Exibido no KPI "Lucro Operacional" e linha final `[=]`. |
| **4. Qual margem percentual obtivemos?** | **SIM** | **[EXISTE HOJE]** Exibido no KPI "Margem (L. Op.)" (ex: 28.4%). |
| **5. Onde estamos ganhando ou perdendo margem?** | **NÃO** | **[NÃO EXISTE]** Não há quebra por cliente, operação ou unidade. |
| **6. Qual cliente ou empresa puxou o resultado?** | **NÃO** | **[EXISTE, MAS ESTÁ MAL EXPOSTO]** O banco tem o dado, mas a tela não expõe agrupamento por cliente/empresa. |
| **7. O resultado melhorou ou piorou em relação ao mês anterior?** | **NÃO** | **[NÃO EXISTE]** Não há indicador de variação $\Delta$ (MoM) nem comparativo gráfico. |
| **8. Quanto da receita foi efetivamente recebido vs. está em aberto?** | **NÃO** | **[EXISTE, MAS ESTÁ MAL EXPOSTO]** O service calcula `caixaRecebido`, mas o DRE omite esse número da tela. |
| **9. Existem custos de mão de obra ainda retidos no RH não computados?** | **PARCIAL** | **[EXISTE, MAS ESTÁ MAL EXPOSTO]** Exibe apenas texto estático *"Há pendências no controle RH"*, sem detalhar valor ou lote. |

---

## 8. AUDITORIA DA TELA ATUAL (TAXONOMIA EM 4 CATEGORIAS)

Separando rigorosamente os elementos da tela atual de DRE:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TELA ATUAL: RelatorioDRE                        │
├────────────────────────────────────────────────────────────────────────┤
│ [A] SÍNTESE EXECUTIVA                                                  │
│  - 4 Cards (Receita, Despesas, Lucro, Margem %)                        │
│  - Badge "DADOS AUDITADOS" (quando auditoriaCompetencia = 'ok')        │
├────────────────────────────────────────────────────────────────────────┤
│ [B] ANÁLISE                                                            │
│  - Tabela em Cascata com 6 linhas estáticas                            │
│  - (Ausência completa de gráficos, curvas de tendência ou comparativos)│
├────────────────────────────────────────────────────────────────────────┤
│ [C] INVESTIGAÇÃO (DRILL-DOWN)                                          │
│  - INEXISTENTE (Nenhum clique abre detalhes, lote ou nota)             │
├────────────────────────────────────────────────────────────────────────┤
│ [D] EXECUÇÃO                                                           │
│  - Nenhum botão de ação, geração de PDF ou link para regularização     │
└────────────────────────────────────────────────────────────────────────┘
```

### Problemas de UX Identificados na Tela Atual
1. **Redundância de Linhas:** A linha *"Receita Operacional Bruta"* e a sublinha *"Faturamentos / Acordos por Volume Validado"* mostram rigorosamente o mesmo valor, gerando poluição visual sem entregar distinção analítica.
2. **Nomenclatura Financeira Imprecisa:** O card de Lucro Operacional usa como subtítulo *"EBITDA Estimado"*. Como o ORBE não deduz depreciações, amortizações nem IRPJ/CSLL, chamar lucro bruto operacional de EBITDA gera confusão conceitual com a diretriz contábil.
3. **Falta de Hierarquia e Contexto:** O indicador de margem (ex.: `18.2%`) é apresentado em isolamento: o gestor não sabe se isso está acima da meta histórica ou em queda acentuada.
4. **Cegueira Operacional (Sem Drill-down):** Se o Lucro Operacional vier negativo (ex: `- R$ 4.250,00`), o usuário é incapaz de descobrir na tela qual foi a unidade, cliente ou despesa que causou o prejuízo.

---

## 9. CAPACIDADES REAIS DE DRILL-DOWN (ANÁLISE DO MODELO DE DADOS)

Mapeamento exaustivo das dimensões suportadas pelo PostgreSQL do ORBE hoje:

| Dimensão de Análise | Classificação | Evidência Técnica no Código / Banco |
|---|:---:|---|
| **Competência (Mês / Ano)** | **SUPORTADA** | Coluna `competencia` presente em `receitas_operacionais`, `rh_financeiro_lotes`, `lotes_remessa`. `DashboardConsolidadoService` já suporta agregação mensal e anual. |
| **Empresa (Contratante)** | **SUPORTADA** | Coluna `empresa_id` em todas as tabelas transacionais (`receitas_operacionais`, `rh_financeiro_lotes`, `diaristas_lotes_fechamento`, `custos_extras_operacionais`). O service já aceita `empresaId`. |
| **Unidade Operacional** | **PARCIAL** | `receitas_operacionais.unidade_id` e `operacoes_producao.unidade_id` existem. Custos extras possuem vínculo opcional; fechamentos de diaristas são consolidados por empresa. |
| **Cliente / Tomador** | **PARCIAL** | A tabela `financeiro_consolidados_cliente` possui faturamento mensal por cliente. Os itens de receita (`receitas_operacionais_itens`) relacionam-se com operações que possuem `cliente_id` e `transportadora_id`. Mão de obra (CLT/Diaristas) é alocada por empresa, não rateada por cliente individual. |
| **Operação / Tipo de Serviço** | **PARCIAL** | `operacoes_producao.servico_id` vincula a `tipos_servico_operacional` (descarga, transbordo, pallet). Serviços extras têm `tipo_servico`. A receita é 100% decomponível por serviço; custos de mão de obra não são rateados por serviço. |
| **Categoria de Receita** | **SUPORTADA** | Coluna `receitas_operacionais.modalidade` (`CAIXA_IMEDIATO`, `DUPLICATA`, `FATURAMENTO_MENSAL`) e origem via itens (Operação Normal vs Serviço Extra). |
| **Categoria de Custo / Despesa** | **SUPORTADA** | Segregação nativa de Mão de Obra (CLT, Intermitentes, Diaristas) e coluna `tipo_custo` em `custos_extras_operacionais` (alimentação, EPI, ferramentas, etc.). |
| **Mão de Obra Segregada** | **SUPORTADA** | Totalmente isolada via `rh_financeiro_lotes.tipo` (`FOLHA` vs `INTERMITENTES`) e `diaristas_lotes_fechamento`. Não há sobreposição. |
| **Período Temporal (MoM / Anual)** | **SUPORTADA** | `DashboardConsolidadoService.getKpisAggregate` já busca os 12 meses de uma vez. É possível calcular variações MoM e tendências sem novas chamadas de rede. |

---

## 10. RELAÇÃO ARQUITETURAL: DRE × DASHBOARD × TORRE

Para garantir a coesão do sistema sem sobreposições conceituais ou telas redundantes, o papel de cada artefato fica definido como:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ORBE ERP — TORRE TRIENE                         │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ DASHBOARD EXECUTIVO      │ TORRE OPERACIONAL       │ RESULTADO OP. DRE │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ "O QUE ACONTECEU?"       │ "COMO ESTÁ FLUINDO?"    │ "POR QUE DEU ISSO?"│
│                          │                         │                   │
│ • Visão macro global     │ • Saúde dos fluxos      │ • Decomposição    │
│ • KPIs executivos        │ • Gargalos e SLAs       │   econômica       │
│ • Alertas de liquidez    │ • Quem está com a bola  │ • Receitas vs     │
│ • Volume x Despesa       │ • Etapas travadas       │   Custos reais    │
│ • Foco: Navegação ampla  │ • Foco: Agilidade/Ação  │ • Foco: Margem    │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

* **Dashboard Executivo:** Visão panorâmica para a presidência/diretoria sobre o volume total movimentado e saúde geral da empresa.
* **Torre Operacional:** Sala de controle de tráfego que audita a esteira operacional (lançamento -> RH -> financeiro -> banco), prevenindo atrasos de SLA.
* **Resultado Operacional (DRE):** O demonstrativo de rentabilidade. Não olha para prazos operacionais, mas para a **equação econômica**: quanto cobramos, quanto custou mobilizar a equipe, quanto sobrou na última linha e qual unidade/cliente gerou o resultado.

---

## 11. LIMITAÇÕES DO MODELO ATUAL

1. **Filtro de Receita por `created_at` em vez de Competência:**
   Em `DashboardConsolidadoService.getKpisByCompetencia`, a query de `receitas_operacionais` filtra por `created_at`. Lançamentos retroativos ou fechamentos mensais gerados no início do mês seguinte correm risco de cair na competência incorreta na visualização mensal.
2. **DRE Monolítico na UI:**
   A tela atual trata o DRE como um bloco único imutável, sem permitir enxergar o resultado segregado por Empresa, Filial ou Cliente.
3. **Ausência de Deduções Fiscais em Linha Separada:**
   O ISS é hoje somado no faturamento bruto, sem uma linha correspondente de deduções tributárias diretas para apuração de Receita Líquida.
4. **Sem Indicadores de Caixa Realizado vs Competência:**
   Apesar de o serviço calcular `caixaRecebido`, a tela não informa quanto do resultado apurado já foi liquidado no banco e quanto ainda é conta a receber.

---

## 12. PROPOSTA CONCEITUAL: ARQUITETURA DRE V2 (SEM IMPLEMENTAÇÃO)

Para a futura fase de prototipagem no **UX Lab**, o DRE V2 deve ser estruturado em **3 Camadas Cognitivas Progressivas**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DRE V2 — VISÃO MACRO                          │
├────────────────────────────────────────────────────────────────────────┤
│ CAMADA 1: CABEÇALHO EXECUTIVO E HEALTH SCORE                           │
│ • Seletor Unificado: Ano / Competência / Empresa (Dropdown ativo)      │
│ • 4 Placas Executivas:                                                 │
│   1. Receita Operacional Bruta (com subtexto de Caixa Realizado)      │
│   2. Custos Diretos Totais (Mão de Obra + Gastos Gerais)               │
│   3. Margem Operacional Líquida (com indicador de variação MoM Δ)      │
│   4. Status de Auditoria e Integridade Contábil                        │
├────────────────────────────────────────────────────────────────────────┤
│ CAMADA 2: O BALANÇO EM CASCATA MODERNO (THE WATERFALL LEDGER)          │
│ • Formato Ledger Contábil com indentação, barras de participação %     │
│   [+] RECEITA OPERACIONAL BRUTA                                        │
│       ├─ Caixa Imediato (À Vista / PIX)                                │
│       ├─ Duplicatas Comerciais                                         │
│       └─ Faturamento Mensal Fechado                                    │
│   [-] CUSTOS DIRETOS DE MÃO DE OBRA                                    │
│       ├─ Folha CLT                                                     │
│       ├─ Intermitentes                                                 │
│       └─ Diaristas Semanals                                            │
│   [-] GASTOS EXTRAS E LOGÍSTICA OPERACIONAL                            │
│   [=] RESULTADO OPERACIONAL LÍQUIDO (Com destaque de cor Positivo/Neg) │
├────────────────────────────────────────────────────────────────────────┤
│ CAMADA 3: O BREAKDOWN HUB (DRILL-DOWN PROGRESSIVO POR ABAS)            │
│  [ Por Empresa / Unidade ]  [ Por Modalidade ]  [ Tendência Anual 12M ] │
│  Exibe tabela/gráfico que responde instantaneamente:                   │
│  "Qual cliente ou empresa gerou a maior margem este mês?"              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 13. SÍNTESE DA CLASSIFICAÇÃO DOS RECURSOS

* **EXISTE HOJE:**
  * Apuração unificada de Receitas Operacionais (`faturamentoTotal`).
  * Segregação de custos de mão de obra por CLT, Intermitentes e Diaristas (`rh_financeiro_lotes` e `diaristas_lotes_fechamento`).
  * Reconhecimento canônico de custos extras operacionais (`custos_extras_operacionais`).
  * Cálculo em memória de Resultado Operacional e Margem Percentual.
  * Agregação anual de 12 competências no service.

* **EXISTE, MAS ESTÁ MAL EXPOSTO:**
  * Filtro por Empresa (presente no service, ausente na tela).
  * Montante de Caixa Recebido / Liquidado (calculado no service, oculto na tela).
  * Status e pendências de auditoria de competência (apenas um badge binário sem detalhamento).
  * Decomposição por modalidades de receita (Caixa Imediato, Duplicata, Mensal).
  * Categorização dos gastos extras por tipo de despesa.

* **NÃO EXISTE / EXIGIRIA EVOLUÇÃO FUNCIONAL:**
  * Rateio de custos diretos por cliente tomador individual.
  * Linha contábil dedicada para deduções tributárias de ISS / impostos.
  * Comparativo automático mês contra mês anterior ($\Delta$ MoM).
  * Motor de exportação nativo (PDF executivo do DRE / Planilha Excel auditada).

---

## CHECKPOINT DE FINALIZAÇÃO

A presente auditoria mapeou integralmente o funcionamento contábil e técnico do Resultado Operacional (DRE) no ORBE ERP. Conforme a diretriz do projeto:
* Nenhuma tela de produção foi alterada;
* Nenhum componente foi modificado;
* Nenhuma regra financeira foi violada.

Aguardando a revisão deste diagnóstico técnico para autorização do início do **Protótipo 1 do DRE V2 no UX Lab**.
