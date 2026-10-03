# UX03 — AUDITORIA TÉCNICA DO DRAWER E INTEGRIDADE DA DECOMPOSIÇÃO FINANCEIRA
**Projeto:** ERP ESC LOG (ORBE)  
**Domínio:** Resultado Operacional (DRE) V2 — UX Lab  
**Fase:** FASE 02.2 — Correção do Drawer e Integridade da Decomposição Financeira  
**Data:** Outubro / 2026  
**Status:** Auditado e Validado  

---

## 1. PRINCÍPIO E DIRETRIZ FUNDAMENTAL

> **"O UX não pode criar uma granularidade financeira que o domínio e o backend ainda não conseguem provar."**  
> *Uma interface visualmente convincente não transforma um mock em capacidade funcional.*

Esta auditoria inspecionou individualmente cada informação, número, coluna, agregação e dimensão apresentada no Drawer do protótipo DRE V2, rastreando a sua existência no banco PostgreSQL/Supabase, nos serviços de domínio (`dashboard.service.ts`, `rhFinanceiro.service.ts`, `financial.service.ts`) e no pipeline homologado do ORBE.

---

## 2. MATRIZ GERAL DE AUDITORIA E CLASSIFICAÇÃO

### Categorias Oficiais:
- **A — REAL E DISPONÍVEL:** O dado existe diretamente no modelo atual e pode ser consultado com segurança.
- **B — DERIVÁVEL COM SEGURANÇA:** Não existe como campo pronto na agregação da DRE, mas pode ser obtido deterministicamente a partir de dados já homologados, sem criar nova regra de negócio ou inferência financeira.
- **C — APENAS MOCK UX:** Foi criado apenas para simular layout e estética no protótipo, sem fonte homologada. Deve ser identificado inequivocamente como simulação ou removido.
- **D — NÃO SUPORTADO:** O modelo e o backend não possuem dados para produzir essa informação de forma confiável. Não deve ser inferido nem estimado. **Remoção obrigatória.**

---

### Tabela Matriz de Elementos da Folha CLT e Encargos

| Elemento | Classificação | Tabela / Fonte Técnica | Coluna / Campo | Service / Cálculo / Regra | Competência | Evidência Técnica | Decisão UX |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **Total do Grupo (Folha CLT)** | **A** | `rh_financeiro_lotes` | `valor_total` | `dashboard.service.ts` (`folhaFlow.finAprovado`) | `competencia` (ex: `2026-10`) | Query em `rh_financeiro_lotes` com `tipo != 'INTERMITENTES'` e status aprovado/pago | **MANTER** com destaque no Drawer e no card de síntese. |
| **Quantidade de Colaboradores** | **A** | `rh_financeiro_lotes` | `total_colaboradores` | `rhFinanceiro.service.ts` (`summarizeItems`) | `competencia` (ex: `2026-10`) | Coluna persistida calculada por contagem distinta de `colaborador_id` no fechamento do lote | **MANTER** como informação de contexto do lote. |
| **Percentual sobre Receita Operacional** | **B** | `dashboard.service.ts` | `folhaValorAprovado / faturamentoTotal` | Divisão matemática direta | `competencia` | Relação determinística entre duas grandezas financeiras consolidadas | **MANTER** no card de síntese do Drawer. |
| **Variação vs Mês Anterior (Δ %)** | **B** | `dashboard.service.ts` | `valorCompetenciaAtual` vs `valorCompetenciaAnterior` | Fórmula padrão de delta percentual | `competencia` vs `competencia - 1` | Derivação histórica matemática direta sem heurísticas | **MANTER** no card de síntese do Drawer. |
| **Salário Base Consolidado** | **B** | `rh_financeiro_lotes` / `rh_financeiro_lote_itens` | `tipo = 'FOLHA_BASE'` / `tipo_evento = 'SALARIO_BASE'`, `valor_calculado` | `rhFinanceiro.service.ts` (`buildFolhaBaseItems`) | `competencia` | Itens gerados a partir do cadastro de colaboradores CLT ativos (`modelo_calculo = 'CLT_MENSAL'`) vinculados ao lote de base | **MANTER** como subconta legítima da Folha (Lote FOLHA_BASE). |
| **Horas Extras (Total Consolidado)** | **B** | `rh_financeiro_lotes` / `rh_financeiro_lote_itens` | `tipo = 'FOLHA_VARIAVEL'`, `tipo_evento = 'hora_extra'`, `minutos`, `horas`, `valor_calculado` | `rhFinanceiro.service.ts` (`buildFolhaVariavelItems`) | `competencia` | Lote de variáveis de ponto apuradas de `registros_ponto` com status `PROCESSADO` | **MANTER** como subconta agregada de Horas Extras e Variáveis. |
| **Liquidação Banco de Horas** | **B** | `rh_financeiro_lotes` / `rh_financeiro_lote_itens` | `tipo = 'BANCO_HORAS'`, `origem_evento = 'banco_horas_eventos'`, `valor_calculado` | `rhFinanceiro.service.ts` (`buildBancoHorasItems`) | `competencia` | Lote gerado para eventos com `reflexo_financeiro_pendente = true` | **MANTER** como subconta de Banco de Horas indenizado em folha. |
| **Horas extras 50% (Valor e Horas)** | **C** | Nenhuma separação persistida no lote | Inexistente em `rh_financeiro_lote_itens` (campo único `tipo_evento = 'hora_extra'`) | Regra de cálculo na apuração de ponto | `competencia` | A tabela `rh_financeiro_lote_itens` **não possui** coluna de percentual de adicional (50% vs 100%). Os valores chegam unificados como `hora_extra`. | **REMOVER da estrutura contábil real**. Se simulado no UX Lab, etiquetar como `DADO SIMULADO — UX LAB`. |
| **Horas extras 100% (Valor e Horas)** | **C** | Nenhuma separação persistida no lote | Inexistente em `rh_financeiro_lote_itens` | Regra de cálculo na apuração de ponto | `competencia` | Idem acima. O lote financeiro não segrega o multiplicador da hora extra. | **REMOVER da estrutura contábil real**. Se simulado no UX Lab, etiquetar como `DADO SIMULADO — UX LAB`. |
| **Adicional Noturno (Valor e Horas)** | **D** | NENHUMA | Inexistente em `rh_financeiro_lote_itens` | Inexistente em `buildFolhaVariavelItems` | N/A | Em `rhFinanceiro.service.ts` (linha 330), os eventos são estritamente `["hora_extra", "atraso", "falta"]`. Adicional noturno sequer é gerado como item financeiro no modelo atual. | **REMOVER IMEDIATAMENTE** do Drawer. Proibido inventar valor. |
| **INSS (Provisão / Encargo Patronal)** | **D** | NENHUMA | Inexistente no modelo de dados | Inexistente no backend | N/A | O ORBE não calcula guia de previdência nem alíquotas patronais (20% CPP, RAT, FAP, Terceiros). O sistema processa a folha líquida para remessa bancária CNAB. | **REMOVER IMEDIATAMENTE** do Drawer. Proibido inventar percentual estimado. |
| **FGTS (Depósito 8%)** | **D** | NENHUMA | Inexistente no modelo de dados | Inexistente no backend | N/A | Não existe tabela de competência nem controle de conectividade social / FGTS no ORBE. | **REMOVER IMEDIATAMENTE** do Drawer. Proibido estimar 8%. |
| **Encargos Trabalhistas Estimados** | **D** | NENHUMA | Inexistente no modelo de dados | Inexistente no backend | N/A | Não existem provisões de 13º, férias ou encargos patronais homologadas na DRE. | **REMOVER IMEDIATAMENTE** do Drawer. Proibido estimar provisões. |
| **Botão Imprimir no Drawer** | **C** | Protótipo frontend (`window.print()`) | Inexistente | Sem motor de impressão homologado | N/A | Regra 11 proíbe infraestrutura prematura de exportação / impressão. | **REMOVER TEMPORARIAMENTE** do Drawer. |

---

## 3. AUDITORIA DA DIMENSÃO “POR EMPRESA” vs CLIENTE

### 3.1. Validação Técnica das 4 Fontes Operacionais Diretas
A auditoria confirmou que a dimensão **Empresa Operadora** possui suporte técnico direto em todas as tabelas transacionais que alimentam a DRE:
1. `receitas_operacionais.empresa_id` (FK obrigatória para `empresas.id`)
2. `rh_financeiro_lotes.empresa_id` (FK obrigatória para `empresas.id`)
3. `diaristas_lotes_fechamento.empresa_id` (FK obrigatória para `empresas.id`)
4. `custos_extras_operacionais.empresa_id` (FK obrigatória para `empresas.id`)

No serviço `src/services/dashboard.service.ts` (linhas 323, 330, 341, 381), o parâmetro `empresaId?: string` é aplicado diretamente nas queries do Supabase:
```typescript
if (empresaId) qReceitas = qReceitas.eq('empresa_id', empresaId);
if (empresaId) qLotesD = qLotesD.eq('empresa_id', empresaId);
if (empresaId) qLotesRh = qLotesRh.eq('empresa_id', empresaId);
if (empresaId) qCustos = qCustos.eq('empresa_id', empresaId);
```
**Conclusão:** O cálculo de Receita, Custos, Resultado e Margem por **Empresa Operadora** é **REAL E DISPONÍVEL**, realizado com atribuição direta, sem qualquer rateio indireto ou estimativa arbitrária.

### 3.2. Proibição Conceitual: Empresa Operadora ≠ Cliente / Tomador
- **Empresa Operadora:** É a unidade de negócio / CNPJ operacional do Grupo ESC Log (ex: ESC Log Matriz, Filial RJ, Operação SP).
- **Cliente / Tomador:** É a transportadora, armazém ou embarcador contratante do serviço (ex: Mercado Livre, DHL, B2W).
- **Status de Margem por Cliente:** **NÃO SUPORTADO.** O ORBE não possui apropriação de mão de obra CLT por cliente ou por ordem de serviço individual, apenas por empresa operadora.
- **Ajuste de Cópia da Interface:** A frase anterior *"Quebra do resultado por unidade de negócio. Receita e custos atribuídos diretamente por empresa operadora"* foi ajustada para refletir factualidade estrita:
  > *"Quebra do resultado por empresa operadora. Receitas e custos operacionais diretos alocados por unidade contratante (sem rateio de sede ou margem por cliente tomador)."*

---

## 4. DEGRADAÇÃO ELEGANTE DO DRAWER (FOLHA CLT)

Seguindo a diretriz de que **"é preferível um Drawer simples e verdadeiro a um Drawer sofisticado com granularidade fictícia"**, a composição da Folha CLT no protótipo foi purificada:

### O que foi REMOVIDO:
1. ❌ Encargos INSS / FGTS (estimativa R$ 20.000) — *Classificação D (Não Suportado)*
2. ❌ Adicional Noturno (R$ 9.100 / 98h) — *Classificação D (Não Suportado no Financeiro)*
3. ❌ Segregação artificial HE 50% vs HE 100% — *Classificação C (Apenas Mock)*
4. ❌ Botão "Imprimir" — *Classificação C (Ação Prematura)*

### O que PERMANECE (Composição Real e Derivável):
A decomposição do valor total de **R$ 180.500** da Folha CLT passa a espelhar **exatamente a estrutura física de lotes do ORBE**:
1. **Lote Folha Base (Salários Contratuais • 74 colaboradores)**  
   - Valor: **R$ 142.500** (78,9% do grupo)  
   - *Origem:* Lote `FOLHA_BASE` / Tabela `rh_financeiro_lote_itens` (`tipo_evento = 'SALARIO_BASE'`)  
   - *Status:* **B — DERIVÁVEL COM SEGURANÇA**

2. **Lote Folha Variável (Horas Extras & Ajustes de Ponto)**  
   - Valor: **R$ 26.000** (14,4% do grupo)  
   - *Origem:* Lote `FOLHA_VARIAVEL` / Tabela `rh_financeiro_lote_itens` (`tipo_evento = 'hora_extra'`)  
   - *Status:* **B — DERIVÁVEL COM SEGURANÇA**

3. **Lote Banco de Horas (Liquidação Financeira)**  
   - Valor: **R$ 12.000** (6,6% do grupo)  
   - *Origem:* Lote `BANCO_HORAS` / Tabela `banco_horas_eventos` (`reflexo_financeiro_pendente = true`)  
   - *Status:* **B — DERIVÁVEL COM SEGURANÇA**

*Total do Grupo: R$ 180.500 (100% do grupo | 37,4% da Receita Operacional).*  
Cada linha possui rastreabilidade comprovada e espelho funcional no backend do ORBE.

---

## 5. CONCLUSÃO TÉCNICA E GOVERNANÇA

1. O protótipo DRE V2 passa a operar em conformidade estrita com o princípio da integridade informacional.
2. Nenhuma estimativa arbitrária ou provisão fictícia permanece visível como se fosse dado real.
3. A integridade estrutural, a linguagem visual monocromática Azul ORBE e a coerência entre light e dark mode permanecem 100% preservadas.
