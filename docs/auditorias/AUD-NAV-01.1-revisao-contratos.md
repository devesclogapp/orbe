# AUDITORIA TÉCNICA COMPLEMENTAR — AUD-NAV-01.1
## Revisão Técnica das 58 Navegações e Contratos de Contexto

---

### 1. IDENTIFICAÇÃO E METADADOS

- **Identificador Único:** `AUD-NAV-01.1`
- **Título:** Matriz Completa das 58 Navegações e Validação de Contratos
- **Módulo:** Transversal
- **Auditoria Relacionada:** `AUD-NAV-01`
- **Data da Auditoria:** 10/11/2026
- **Status Funcional:** **AUDITORIA CONCLUÍDA / PRONTA PARA IMPLEMENTAÇÃO**
- **Status Git:** **DOCUMENTADO**
- **Status de Deploy:** **NÃO PUBLICADO**

---

### 2. RECLASSIFICAÇÃO METODOLÓGICA DOS 40 APONTAMENTOS

Conforme diretriz técnica, os 40 apontamentos foram rigorosamente revisados e reclassificados:

1. **Defeito Funcional Confirmado (16 ocorrências):**
   - Casos em que a tela de origem possui explicitamente filtros ativos (ex: competência, empresa selecionada, lote selecionado) e a navegação descarta esses dados, abrindo a tela de destino em branco ou na data atual.
2. **Risco Potencial que Exige Teste Funcional (12 ocorrências):**
   - Casos em que a tela de destino possui suporte parcial a parâmetros (ex: aceita `?empresa=...` mas não aceita `?empresaId=...`, ou ignora parâmetro de destaque `highlight`).
3. **Melhoria de Usabilidade (8 ocorrências):**
   - Navegações a partir de cards informativos gerais que seriam aprimoradas caso preservassem a visão corrente da torre de controle.
4. **Comportamento Intencional / Sem Perda de Contexto (4 ocorrências):**
   - Transições de reset explícito ou retorno à visualização consolidada global.

---

### 3. MATRIZ CONSOLIDADA DE NAVEGAÇÕES CRÍTICAS (DEFEITOS CONFIRMADOS)

Abaixo estão relacionadas as 16 navegações com defeito funcional confirmado que requerem correção imediata na fase **NAV-02**:

| # | Arquivo Origem | Gatilho / Ação | Rota Destino | Contexto Perdido | Contrato Proposto para Destino |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **01** | `ExecutiveKpiDrawer.tsx` | "Abrir DRE Gerencial" | `/financeiro/dre` | `competencia`, `empresaId`, `ambiente` | `?competencia=YYYY-MM&empresaId=UUID&ambiente=prod` |
| **02** | `ExecutiveKpiDrawer.tsx` | "Ver Faturamento Oficial" | `/financeiro/receitas` | `competencia`, `empresaId` | `?competencia=YYYY-MM&empresaId=UUID` |
| **03** | `Dashboard.tsx` | Card "Ver Contas a Pagar" | `/financeiro/contas-pagar` | `competencia`, `empresaId` | `?competencia=YYYY-MM&empresaId=UUID` |
| **04** | `Dashboard.tsx` | Card "Lotes de Diaristas" | `/rh/diaristas` | `competencia` / ciclo | `?competencia=YYYY-MM` |
| **05** | `Dashboard.tsx` | Card "Folha CLT" | `/rh/fechamento-clt` | `competencia` | `?competencia=YYYY-MM` |
| **06** | `RelatorioDRE.tsx` | Linha "Receita Operacional" | `/financeiro/receitas` | `mes`, `ano`, `empresaId` | `?competencia=YYYY-MM&empresaId=UUID` |
| **07** | `RelatorioDRE.tsx` | Linha "Diaristas" | `/rh/diaristas` | `mes`, `ano`, `empresaId` | `?competencia=YYYY-MM&empresaId=UUID` |
| **08** | `RelatorioDRE.tsx` | Linha "Intermitentes" | `/operacional/intermitentes` | `mes`, `ano`, `empresaId` | `?competencia=YYYY-MM&empresaId=UUID` |
| **09** | `RelatorioDRE.tsx` | Linha "Custos Extras" | `/financeiro/despesas` | `mes`, `ano`, `empresaId` | `?competencia=YYYY-MM&categoria=custos_extras` |
| **10** | `PipelineOperacional.tsx` | Card de Gargalo de Empresa | `/producao/operacoes` | `empresaId`, `data` | `?empresaId=UUID&data=YYYY-MM-DD` |
| **11** | `PipelineOperacional.tsx` | Alerta de Custos Pendentes | `/producao/custos-extras` | `empresaId` | `?empresaId=UUID&status=pendente` |
| **12** | `CentralAprovacoes.tsx` | "Auditar Receita" | `/financeiro/receitas` | `receitaId` | `?id=UUID` |
| **13** | `CentralAprovacoes.tsx` | "Auditar Lote Diaristas" | `/rh/diaristas` | `loteId` | `?loteId=UUID` |
| **14** | `CentralAprovacoes.tsx` | "Auditar Lote Intermitente" | `/operacional/intermitentes` | `loteId` | `?loteId=UUID` |
| **15** | `CentralFinanceira.tsx` | Ação "Ver Extrato Bancário" | `/financeiro/extrato` | `contaBancariaId`, `competencia` | `?contaId=UUID&competencia=YYYY-MM` |
| **16** | `CentralCadastros.tsx` | "Editar Tabelas de Preço" | `/configuracoes/regras` | `empresaId` | `?empresaId=UUID&tab=precos` |

---

### 4. REVISÃO DO CONTRATO DE COMPETÊNCIA ANUAL (`YYYY-all`)

Na visão anual do Dashboard Executivo (`YYYY-all`):
- O parâmetro `competencia=2026-all` é válido apenas no Dashboard Executivo e na Torre de Fechamento Anual.
- Telas que operam estritamente sob competência mensal (como o DRE Gerencial ou Contas a Pagar) **não devem quebrar** ao receber `2026-all`.
- **Regra de Transição Homologada:** Quando a tela de destino suportar apenas mês:
  1. Identificar o ano (`2026`).
  2. Converter para o mês atual ou mês final consolidado (ex: `2026-10` ou `2026-12`).
  3. Apresentar badge ou aviso informativo: *"Exibindo Outubro/2026 (modo anual não aplicável a este módulo)"*.

---

### 5. PLANO DE EXECUÇÃO PRIORIZADO (NAV-02)

1. **Fase 1 (Caso Piloto & Dashboard):** Itens 01 a 05 da matriz (fluxo Dashboard → DRE / Receitas / Despesas).
2. **Fase 2 (DRE Reverso):** Itens 06 a 09 (auditoria detalhada das linhas do DRE para telas analíticas).
3. **Fase 3 (Torre Operacional & Aprovações):** Itens 10 a 14 (rastreabilidade de lotes e aprovações).
4. **Fase 4 (Financeiro & Cadastros):** Itens 15 e 16.

