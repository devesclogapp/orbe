# FICHA TÉCNICA — EVOL-DASH-02-P01
## Reconciliação Financeira Semanal do Dashboard Executivo

---

### 1. IDENTIFICAÇÃO E METADADOS

- **Identificador Único:** `EVOL-DASH-02-P01`
- **Título:** Reconciliação Financeira Semanal do Gráfico do Dashboard Executivo
- **Módulo:** Dashboard Executivo (`src/pages/Dashboard.tsx`)
- **Serviço Central:** `src/services/dashboardReconciliacaoSemanal.service.ts`
- **Origem da Demanda:** Homologação funcional GATE 05 / Auditoria ENC-01 (Identificação de divergência conceitual e de valores entre os cartões mensais de KPI e o gráfico de evolução semanal).
- **Data de Conclusão Técnica:** 10/11/2026
- **Status Funcional:** **HOMOLOGADO** (Ambiente local e dados sintéticos de teste)
- **Status Git:** **NÃO COMMITADO** (Alterações locais prontas para empacotamento com GATE 06)
- **Status de Deploy:** **NÃO PUBLICADO** (Retido em workspace local aguardando homologação final)

---

### 2. CONTEXTO E DIAGNÓSTICO DO PROBLEMA

No Dashboard Executivo, os cartões de KPI mensal (Receita Bruta, Custos Operacionais e Resultado Operacional) eram calculados com base nas regras contábeis consolidadas:
- **Receita Oficial:** Agrupada via `receitas_operacionais` aprovadas, vinculadas à competência `YYYY-MM` e segregando ambiente de produção versus homologação sintética (`is_teste`).
- **Custos Operacionais:** Agrupamento estrito de quatro fontes canônicas de despesa (Lotes de Diaristas aprovados, Lotes de Intermitentes aprovados, Folha CLT processada e Custos Extras operacionais).

Por outro lado, o gráfico de evolução semanal (`getEvolucaoSemanal`) utilizava uma consulta direta legada sobre a tabela `operacoes_producao`:
- Considerava lançamentos operacionais brutos ainda não aprovados pela governança financeira.
- Não aplicava os mesmos filtros de segregação de ambiente (`is_teste`).
- Utilizava divisão de datas arbitrária que não garantia paridade aritmética com a competência mensal.
- **Impacto:** Divergência visível entre a soma das semanas do gráfico e o valor exibido nos cartões de KPI do cabeçalho do Dashboard.

---

### 3. SOLUÇÃO TÉCNICA IMPLEMENTADA

Foi criado o serviço desacoplado `DashboardReconciliacaoSemanalService`, aplicando os seguintes princípios:
1. **Fonte Única de Verdade:** As receitas semanais são obtidas a partir de `receitas_operacionais` (com itens decompostos de `operacoes_producao` ou `servicos_extras_operacionais`). Os custos semanais agregam as quatro fontes canônicas elegíveis.
2. **Aritmética Inteira em Centavos:** Todos os somatórios e rateios internos são processados em centavos inteiros (`Math.round(val * 100)`), convertidos para reais apenas na projeção de saída, prevenindo erros de ponto flutuante IEEE 754.
3. **Distribuição Semanal Canônica:** Modelo fixo de 4 semanas no mês (S1: 01 a 07, S2: 08 a 14, S3: 15 a 21, S4: 22 até o último dia do mês).
4. **Tratamento de Estados Canônicos:**
   - `ok`: Dados reconciliados com sucesso.
   - `sem_dados`: Nenhuma movimentação financeira elegível encontrada na competência (gráfico zerado com alerta informativo).
   - `inconsistente`: Divergência entre cabeçalho de receita e itens ou total negativo (gráfico bloqueia exibição de valores e exibe aviso de auditoria).
   - `erro`: Falha na consulta Supabase (gráfico exibe alerta de erro explícito sem projetar valores anteriores).
5. **Blindagem Visual no Componente:** `Dashboard.tsx` atualizado para reagir expressamente aos estados da reconciliação, desabilitando `placeholderData` estático para evitar a apresentação de dados de competências anteriores durante falhas.

---

### 4. ARQUIVOS ENVOLVIDOS

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `src/services/dashboardReconciliacaoSemanal.service.ts` | **Criado** | Motor de reconciliação semanal desacoplado e cálculo financeiro |
| `src/services/dashboard.service.ts` | **Modificado** | Integração em `getEvolucaoSemanal` (preserva visão anual `YYYY-all`) |
| `src/pages/Dashboard.tsx` | **Modificado** | Renderização dos alertas de estado (`inconsistente`, `sem_dados`, `erro`) |
| `src/test/conv01_dashboard_reconciliacao_semanal.test.ts` | **Criado** | 22 testes unitários e de paridade financeira com dados sintéticos |

---

### 5. EVIDÊNCIAS DE HOMOLOGAÇÃO E TESTES

- **Testes Automatizados (Vitest):**
  - 22 testes unitários em `conv01_dashboard_reconciliacao_semanal.test.ts` aprovados com 100% de sucesso.
  - Testes de paridade confirmaram: $\sum \text{Receitas Semanal} = \text{Receita Cartão}$, $\sum \text{Custos Semanal} = \text{Custos Cartão}$ e $\sum \text{Lucro Semanal} = \text{Lucro Cartão}$.
- **Auditoria de Build:**
  - `npm run type-check` aprovado sem erros de tipagem.
  - `npm run build` aprovado sem quebra de artefatos.
- **Preservação de Escopo:**
  - A rota anual `YYYY-all` permaneceu intacta chamando os KPIs canônicos dos 12 meses.
  - Nenhum cálculo do RH, Diaristas, CLT ou Motor de Despesas foi alterado.

---

### 6. PENDÊNCIAS E PRÓXIMOS PASSOS

- Executar validação de não-regressão transversal no **GATE 06**.
- Empacotamento para commit/deploy sob aprovação da coordenação.

