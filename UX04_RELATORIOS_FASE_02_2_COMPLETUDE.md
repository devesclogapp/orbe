# UX04 — RELATÓRIOS V2
## FASE 02.2 — COMPLETUDE DO NÚCLEO | R02 + R04 + R07
### Relatório Oficial de Homologação da Prototipação Canônica (UX Lab)

---

## 1. RESUMO EXECUTIVO

Em conformidade com as diretrizes da **Fase 02.2 — Completude do Núcleo**, o protótipo da Central de Relatórios V2 no UX Lab foi expandido para atingir a meta de **6/6 relatórios funcionais**:

- **OPERACIONAL**:
  - `R01` — Analítico de Operações por Volume *(já homologado)*
  - `R04` — Custos Extras Operacionais *(implementado nesta fase)*
  - `R07` — Analítico de Serviços Extras *(implementado nesta fase)*
- **PESSOAS & RH**:
  - `R02` — Fechamento de Diaristas *(implementado nesta fase)*
  - `R05` — Consolidado de Banco de Horas *(já homologado)*
- **FINANCEIRO & FATURAMENTO**:
  - `R03` — Faturamento e Receitas *(já homologado no Hotfix 02.1)*

Todos os seis relatórios herdam estritamente a **arquitetura canônica congelada**:
- Breadcrumb hierárquico com navegação de retorno à Central e identificação por código mono.
- Barra de filtros com obrigatoriedade estrutural de Empresa (Castanhal, Benevides, Belém).
- Parâmetro temporal semântico fiel à entidade (competência mensal, ciclo semanal ou intervalo de datas).
- Síntese contextual pequena (2 a 4 indicadores discretos, sem se tornar dashboard).
- Tabela analítica de alta densidade (alinhamento: texto à esquerda, números/moeda à direita, monospace para códigos).
- Contador de registros localizados no topo da tabela.
- Exportação client-side em CSV estruturado (UTF-8 BOM, delimitador `;`) e Impressão/PDF via folha de estilo padronizada `@media print`.

---

## 2. R02 — FECHAMENTO DE DIARISTAS

- **Pergunta de Negócio respondida:** *"Quem trabalhou como diarista, em qual período, função, quantidade de diárias, por qual valor e em qual situação de fechamento?"*
- **Escopo e Limites:** Focado estritamente na liquidação e fechamento de diárias. Não possui vínculo artificial com caminhão, placa, carga ou produtividade individual.
- **Síntese Contextual (KPIs):**
  - Diaristas no Período (contagem única de colaboradores apurados)
  - Total de Diárias (soma de `quantidadeDiarias`)
  - Valor Consolidado (soma de `total` em R$)
  - Lotes de Pagamento (contagem única de códigos de lotes)

---

## 3. FONTES REAIS AUDITADAS — R02

- **Tabelas do Banco:** `lancamentos_diaristas` e `diaristas_lotes_fechamento`.
- **Migrations de Referência:**
  - `supabase/migrations/20260530_create_lancamentos_diaristas.sql`
  - `supabase/migrations/20260533_create_diaristas_lotes_fechamento.sql`
  - `supabase/migrations/20260550_rpc_validar_e_encerrar_diaristas.sql`
- **Campos Mapeados:**
  - `data_lancamento` -> Data do apontamento
  - `nome_colaborador` / `colaborador_id` -> Colaborador
  - `cpf_colaborador` -> CPF
  - `funcao_colaborador` -> Função
  - `codigo_marcacao` (`P` = 1.0, `MP` = 0.5) -> Código
  - `quantidade_diaria` -> Quantidade de diárias
  - `valor_diaria_base` -> Valor unitário da diária
  - `valor_calculado` -> Total
  - `lote_fechamento_id` -> Código do lote
  - `status` -> Status do lote

---

## 4. R04 — CUSTOS EXTRAS OPERACIONAIS

- **Pergunta de Negócio respondida:** *"Quais custos extraordinários foram lançados, quando, em qual empresa/unidade, por qual motivo/categoria, para quem e em qual situação?"*
- **Princípio Arquitetural Inegociável:** Custos Extras são **estritamente despesas**, nunca faturamento ou receita. Estão completamente isolados da DRE de faturamento.
- **Síntese Contextual (KPIs):**
  - Lançamentos de Custos (total de lançamentos registrados)
  - Despesas Consolidadas (soma de `total` em R$)
  - Categorias Ativas (quantidade de categorias de gasto presentes no filtro)
  - Despesas Pendentes (valor aguardando quitação)

---

## 5. FONTES REAIS AUDITADAS — R04

- **Tabelas do Banco:** `custos_extras_operacionais`.
- **Migrations de Referência:**
  - `supabase/migrations/20260430170000_custos_extras_operacionais.sql`
  - `supabase/migrations/20260608150000_update_custos_extras_schema.sql`
  - `supabase/migrations/20260918130000_fase1_custos_extras_origem_recurso_rpc.sql`
- **Campos Mapeados:**
  - `data` -> Data do desembolso
  - `unidade_id` / nome da unidade -> Unidade
  - `categoria_custo` -> Categoria
  - `descricao` -> Descrição do custo
  - `favorecido_colaborador_id` / `favorecido_fornecedor_id` -> Favorecido com badge discreto indicando Colaborador ou Fornecedor
  - `quantidade` e `valor_unitario` -> Quantidade e Preço Unitário
  - `total` -> Valor total
  - `origem_recurso` -> Origem do recurso
  - `criado_por` / nome encarregado -> Lançador
  - `status_pagamento` -> Status de pagamento

---

## 6. R07 — ANALÍTICO DE SERVIÇOS EXTRAS

- **Pergunta de Negócio respondida:** *"Quais serviços adicionais foram executados/faturados, para qual cliente, em qual período, quantidade, valor e situação?"*
- **Domínio:** OPERACIONAL (não confundir com Operação por Volume, entidade completamente independente).
- **Síntese Contextual (KPIs):**
  - Total de Serviços Extras (contagem de atendimentos)
  - Volume / Unidades Executadas (soma das quantidades físicas: pallets, carretas, diárias de serviço)
  - Total Operacional (soma de `total` em R$)
  - Faturado / Concluído (volume financeiro que já transitou para faturamento ou conclusão)

---

## 7. FONTES REAIS AUDITADAS — R07

- **Tabelas do Banco:** `servicos_extras_operacionais`.
- **Migrations de Referência:**
  - `supabase/migrations/20260608999999_repair_servicos_extras.sql`
  - `supabase/migrations/20260708000000_servicos_extras_hardening.sql`
  - `supabase/migrations/20260917110000_fix_servicos_extras_pipeline_financeiro.sql`
  - `supabase/migrations/20260917120000_fix_servicos_extras_trigger_multitenant.sql`
- **Campos Mapeados:**
  - `data` -> Data da execução
  - `tipo_servico_id` / `tipo_servico` -> Tipo de serviço
  - `descricao_servico` / `descricao` -> Descrição
  - `transportadora_id` / cliente tomador -> Cliente / Tomador
  - `quantidade` -> Quantidade
  - `valor_unitario` -> Valor unitário
  - `total` -> Total bruto
  - `modalidade_financeira` -> Modalidade financeira de cobrança
  - `nf_numero` -> Número real da NF emitida ou "—" quando não faturado
  - `pipeline_status` -> Estágio do ciclo de vida

---

## 8. ENUMS E STATUS AUDITADOS POR DOMÍNIO

| Relatório | Campo Auditado | Valores Comprovados e Suportados |
| :--- | :--- | :--- |
| **R02** | `funcao` | `"Diarista"`, `"Auxiliar de carga"`, `"Ajudante"`, `"Conferente"`, `"Operador eventual"`, `"Serviço extra"` |
| **R02** | `codigo_marcacao` | `P` (1.0 diária), `MP` (0.5 diária) |
| **R02** | `status` (Lote) | `'em_aberto'`, `'fechado_para_pagamento'`, `'enviado_financeiro'`, `'pago'`, `'cancelado'` |
| **R04** | `categoria_custo` | `'MERENDA'`, `'OPERACIONAL'`, `'ADMINISTRATIVO'`, `'FORNECEDOR'` |
| **R04** | `origem_recurso` | `'CAIXINHA'`, `'TRANSFERENCIA'`, `'BOLETO'`, `'REEMBOLSO'` |
| **R04** | `status_pagamento` | `'PENDENTE'`, `'ATRASADO'`, `'PAGO'` |
| **R07** | `tipo_servico` | `"Conserto de Pallets"`, `"Transbordo de Carga"`, `"Pintura de Pallets"`, `"Enlonamento de Carga"`, `"Montagem de Estrutura"`, `"Apoio Operacional Noturno"` |
| **R07** | `modalidade_financeira` | `'DEPOSITO_IMEDIATO'`, `'CAIXA_IMEDIATO'`, `'DUPLICATA'`, `'FATURAMENTO_MENSAL'` |
| **R07** | `pipeline_status` | `'PENDENTE'`, `'APROVADO_RH'`, `'APROVADO_FINANCEIRO'`, `'FATURADO'`, `'CONCLUIDO'` |

---

## 9. FILTROS ESTRUTURAIS E ESPECÍFICOS

1. **R02 — Diaristas**:
   - Empresa / Filial: `Matriz Castanhal`, `CD Benevides`, `Operações Belém` *(Obrigatório)*
   - Ciclo / Período Semanal: `Todos os Ciclos`, `Ciclo 39/2026 (21/09 a 27/09)`, `Ciclo 38/2026 (14/09 a 20/09)`
   - Função: `Todas as Funções`, `Diarista`, `Auxiliar de carga`, `Ajudante`, `Conferente`, `Operador eventual`, `Serviço extra`
   - Status do Lote: `Todos os Status`, `Pago`, `Enviado Financeiro`, `Fechado p/ Pgto`, `Em Aberto`, `Cancelado`

2. **R04 — Custos Extras**:
   - Empresa / Filial *(Obrigatório)*
   - Intervalo Temporal: `Data Inicial (De)` e `Data Final (Até)`
   - Categoria de Custo: `Todas as Categorias`, `Merenda / Lanche`, `Operacional`, `Administrativo`, `Fornecedor`
   - Status do Pagamento: `Todos os Status`, `Pago`, `Pendente`, `Atrasado`

3. **R07 — Serviços Extras**:
   - Empresa / Filial *(Obrigatório)*
   - Intervalo Temporal: `Data Inicial (De)` e `Data Final (Até)`
   - Tipo de Serviço: `Todos os Serviços`, `Conserto de Pallets`, `Transbordo de Carga`, `Pintura de Pallets`, `Enlonamento de Carga`, etc.
   - Status do Pipeline: `Todos os Status`, `Concluído`, `Faturado`, `Aprov. Financeiro`, `Aprovado RH`, `Pendente`

---

## 10. COLUNAS HOMOLOGADAS NAS TABELAS CANÔNICAS

- **R02**: Data | Colaborador | CPF (Minimizado) | Função (Monocromático) | Código (P/MP) | Qtd Diárias | Valor Diária | Total | Lote | Status do Lote
- **R04**: Data | Unidade | Categoria (Monocromático) | Descrição | Favorecido (com tag Colaborador/Fornecedor) | Qtd | Valor Unit. | Total | Origem Recurso | Lançador | Status
- **R07**: Data | Tipo de Serviço (Monocromático) | Descrição | Cliente / Tomador | Qtd | Valor Unit. | Total | Modalidade | NF (número ou "—") | Status Pipeline

---

## 11. SEGREGAÇÃO POR EMPRESA (SEM RATEIO)

Cada empresa possui conjunto de dados próprio, sem qualquer fator multiplicador fictício (`companyFactor`), rateio ou duplicação indevida:
- `emp-01` (ESC LOG — Matriz Castanhal)
- `emp-02` (ESC LOG — CD Benevides)
- `emp-03` (ESC LOG — Operações Belém)

Ao selecionar uma filial, o dataset é filtrado de forma limpa, isolando completamente as operações e registros.

---

## 12. EXPORTAÇÃO CSV PADRONIZADA

Implementado para todos os relatórios:
- Prefixo UTF-8 BOM (`\uFEFF`) para compatibilidade nativa com Excel.
- Delimitador padronizado `;` (ponto e vírgula).
- Sanitização de aspas duplas em strings.
- Nome do arquivo dinâmico no formato: `{CODIGO}_{EMPRESA}_{DATA}.csv`.
- Exporta estritamente o dataset resultante dos filtros ativos.

---

## 13. IMPRESSÃO E PDF

Estruturado via folha de estilo canônica `@media print`:
- Oculta menus, breadcrumb, sidebar, botões e controles de filtro (`.no-print`).
- Apresenta cabeçalho institucional: `ORBE ERP — ESC LOGÍSTICA`, código, título, empresa ativa com CNPJ, data/hora de geração e período filtrado.
- Renderiza tabela com bordas sóbrias em fundo branco de alto contraste para arquivamento ou geração de PDF limpo.

---

## 14. POLÍTICA DE PRIVACIDADE DO CPF (DECISÃO UX)

No relatório R02 (Fechamento de Diaristas), adotou-se a decisão de **minimização visual**:
- O CPF é exibido como `***.***.812-44` tanto na interface visual quanto na exportação CSV do UX Lab.
- Esta decisão evita exposição desnecessária de dados pessoais no protótipo, sem inventar regras definitivas de autorização de segurança ou ACL que pertencem à camada de integração.

---

## 15. EVIDÊNCIAS DE VALIDAÇÃO TÉCNICA E TESTES

A suíte de testes automatizados foi expandida em `src/test/ux_relatorios_v2_proto1.test.tsx` com 12 baterias de testes abrangentes:
1. Central possui os 3 domínios e lista exatamente os 6 relatórios autorizados.
2. Busca rápida localiza relatórios por código, nome e palavra-chave.
3. R01 renderiza colunas homologadas e KPIs.
4. R05 opera estritamente em Horas e Minutos (sem R$ e sem passivo trabalhista).
5. R03 exibe faturamento correto e NÃO inclui custos extras.
6. Nenhum relatório apresenta o badge "Em Preparação" (todos os 6 relatórios estão ativos e navegáveis).
7. R02 abre, renderiza colunas homologadas, minimiza CPF e não inventa vínculo com caminhão/carga.
8. R04 abre, segrega despesas, exibe favorecido com distinção de colaborador/fornecedor e não aparece como receita.
9. R07 abre, preserva o domínio operacional e exibe tipos/status auditados.
10. Filtro de Empresa segrega dados entre filiais sem rateio.
11. R03 mantém modalidade/status auditados e estado derivado de atraso.
12. R01 mantém número de NF real ou travessão e status operacional real.

### Execuções Realizadas:
- `npx vitest run src/test/ux_relatorios_v2_proto1.test.tsx`: **12/12 PASSING** (100% de sucesso).
- `npx tsc --noEmit`: **Código 0** (0 erros de tipagem TypeScript).
- `npm run build:dev`: **Código 0** (`✓ built in 25.18s`, sem falhas de bundle).

---

## 16. LIMITAÇÕES E AUDITORIA VISUAL DO BROWSER

- **Validação Visual Automatizada (Playwright / Browser Subagent):**
  - Conforme já documentado nos checkpoints anteriores, o ambiente do subagent no Windows não possui runtime do Chromium headless funcional para disparo via `open_browser_url`.
  - Em obediência estrita ao princípio de integridade da Fase 02.2 ("Não declarar validação visual automatizada executada se não ocorreu"), declaramos formalmente que a validação de renderização e integridade de estilos foi atestada via compilação do Vite dev server, testes em React Testing Library e inspeção de código-fonte.
- **R06 (Produtividade da Equipe Operacional):**
  - Permanece categoricamente **BLOQUEADO**. Não foi criado, não figura no catálogo e não há referências a ele na UI.

---

## 17. ARQUIVOS ALTERADOS / CRIADOS

1. `src/pages/UxLab/relatoriosMockData.ts` *(expandido com interfaces, helpers e datasets para R02, R04 e R07)*
2. `src/pages/UxLab/UxLabRelatorioView.tsx` *(expandido com filtros, KPIs, tabelas e exportações para R02, R04 e R07)*
3. `src/pages/UxLab/UxLabRelatoriosHub.tsx` *(badge de "Em Preparação" removido, todos os 6 relatórios prontos)*
4. `src/test/ux_relatorios_v2_proto1.test.tsx` *(expandido para cobrir os 16 requisitos da Fase 02.2)*
5. `UX04_RELATORIOS_FASE_02_2_COMPLETUDE.md` *(documento oficial desta fase)*

---

## 18. CONCLUSÃO DA FASE 02.2

A Central de Relatórios V2 atinge o estado de **completude total de protótipo funcional no UX Lab** com 6 de 6 relatórios operando sob uma única arquitetura canônica e consistente.

**PARADA OBRIGATÓRIA:** Conforme a diretriz do checkpoint final, o trabalho nesta etapa é interrompido aqui, sem alterar código de produção e sem iniciar a Fase 03, aguardando a homologação do Product Owner.
