# UX04 — RELATÓRIOS V2
# FASE 01.1 — AUDITORIA DE VIABILIDADE DOS RELATÓRIOS CANDIDATOS

> **Status:** Concluído — Read-Only / Auditoria / Diagnóstico Estrutural  
> **Data:** 03 de Outubro de 2026  
> **Ambiente:** ERP ORBE (ESC LOG 2026)  
> **Diretriz:** Nenhuma linha de código, migration, query, service ou interface foi alterada. Investigação técnica estritamente fundamentada no schema real do PostgreSQL e nas regras de negócio homologadas.

---

## 1. RESUMO EXECUTIVO

A Fase 01 diagnosticou a heterogeneidade da Central de Relatórios legada e homologou a taxonomia macro em três pilares: **Operacional**, **Pessoas & RH** e **Financeiro & Faturamento**.

Nesta Fase 01.1, submetemos os **seis relatórios candidatos** a um teste rigoroso de viabilidade de dados:
> *"O ORBE possui hoje dados, relacionamentos e granularidade suficientes para produzir este relatório sem inferir, ratear, inventar ou reconstruir informações de maneira insegura?"*

### Resultado Consolidado da Auditoria:

1. **R01 — Analítico de Operações por Volume:**  
   **Classificação: A — SUPORTADO HOJE.**  
   A entidade `operacoes_producao` possui granularidade completa por operação, vínculos fortes com empresa, cliente/transportadora, produto, tipo de serviço, quantidade, valor unitário, valor total, materiais e ISS.

2. **R02 — Fechamento de Diaristas:**  
   **Classificação: A — SUPORTADO HOJE.**  
   A cadeia `lancamentos_diaristas` $\rightarrow$ `ciclos_diaristas` $\rightarrow$ `lote_pagamento_diaristas` $\rightarrow$ `lote_pagamento_itens` $\rightarrow$ `cnab_remessas` está 100% íntegra, permitindo visão tanto analítica (por diária/colaborador) quanto consolidada (por lote/semana).

3. **R03 — Faturamento e Receitas:**  
   **Classificação: B — SUPORTADO COM COMPOSIÇÃO SEGURA.**  
   Totalmente suportado pela composição de `receitas_operacionais` com `receitas_operacionais_itens` (que referencia diretamente `operacoes_producao` e `servicos_extras_operacionais`).  
   *Nota crítica comprovada no banco:* Custos extras NÃO participam da receita/faturamento; são despesas/contas a pagar.

4. **R04 — Custos Extras Operacionais:**  
   **Classificação: A — SUPORTADO HOJE.**  
   A tabela `custos_extras_operacionais` possui todos os campos necessários por lançamento: empresa, unidade, data do fato gerador, categoria de custo, descrição, favorecido, responsável e status de pagamento/pipeline.

5. **R05 — Consolidado de Banco de Horas:**  
   **Classificação: A — SUPORTADO HOJE (Estritamente em Horas/Minutos).**  
   O motor de Banco de Horas (`banco_horas_saldos` + `banco_horas_eventos`) e o serviço `BHEventoService.getSaldosGerais` fornecem saldos atuais, créditos, débitos, horas a vencer (janela D+30) e status de débito crítico por colaborador.  
   *Nota crítica comprovada:* O conceito de "passivo financeiro em R$" NÃO possui modelo de cálculo homologado nem campo persistido no banco de dados. O relatório deve ser 100% baseado em horas e minutos.

6. **R06 — Produtividade da Equipe Operacional:**  
   **Classificação: D — NÃO SUPORTADO / NÃO RECOMENDADO (No escopo proposto).**  
   Não existe vínculo estrutural entre a produção física individual e os colaboradores. A operação possui apenas a quantidade total da carga (dividida informalmente entre uma equipe). Além disso, diaristas e intermitentes possuem apontamentos desvinculados de `operacoes_producao`. Calcular "produtividade individual/hora" exigiria inventar taxas de rateio fictícias.

7. **Candidato Adicional Identificado: R07 — Analítico de Serviços Extras:**  
   A tabela `servicos_extras_operacionais` está madura, homologada e desacoplada, sendo um candidato natural para o pilar Operacional.

---

## 2. METODOLOGIA DE RASTREIO TÉCNICO

Para cada candidato, foi percorrida a cadeia estrita:
$$\text{Pergunta de Negócio} \longrightarrow \text{Informação Requerida} \longrightarrow \text{Campo Real} \longrightarrow \text{Tabela/Relacionamento} \longrightarrow \text{Evidência no Código/Schema}$$

Toda afirmação sem evidência direta no banco Supabase ou nos services foi carimbada como **NÃO COMPROVADO**, descartando presunções e dados inferidos.

---

## 3. AUDITORIA DETALHADA: R01 — ANALÍTICO DE OPERAÇÕES POR VOLUME

### 3.1 Pergunta de Negócio
*"Quais operações foram realizadas em determinado período para determinada empresa/cliente, com qual volume físico, qual equipe de apoio e qual valor financeiro gerado?"*

### 3.2 Granularidade
**LINHA = Uma Operação Logística (`operacoes_producao.id`).**

### 3.3 Matriz de Evidência de Dados

| Informação Requerida | Campo Real | Tabela / Relacionamento | Evidência Técnica |
|---|---|---|---|
| Identificador da Operação | `id`, `codigo_operacional` | `operacoes_producao` | Migration `20260707190001_fix_rpc_domain_operacoes.sql` |
| Empresa Contratada | `empresa_id` | `operacoes_producao.empresa_id` $\rightarrow$ `empresas.id` | FK direta; filtro puro por filial |
| Unidade / Filial | `unidade_id` | `operacoes_producao.unidade_id` $\rightarrow$ `unidades.id` | FK direta |
| Data da Realização | `data_operacao` | `operacoes_producao.data_operacao` (DATE) | Campo físico de negócio |
| Tipo de Serviço | `tipo_servico_id` | `operacoes_producao.tipo_servico_id` $\rightarrow$ `tipos_servico_operacional.id` | Descrição cadastrada |
| Transportadora / Cliente | `transportadora_id` | `operacoes_producao.transportadora_id` $\rightarrow$ `transportadoras_clientes.id` | Identifica tomador/transportador |
| Fornecedor da Carga | `fornecedor_id` | `operacoes_producao.fornecedor_id` $\rightarrow$ `fornecedores.id` | Identifica remetente |
| Produto / Carga | `produto_carga_id` | `operacoes_producao.produto_carga_id` $\rightarrow$ `produtos_carga.id` | Categoria de carga |
| Quantidade / Volume | `quantidade` | `operacoes_producao.quantidade` (NUMERIC) | Volume físico total descarregado |
| Valor Unitário | `valor_unitario_snapshot` | `operacoes_producao.valor_unitario_snapshot` (NUMERIC) | Valor contratado congelado |
| Valor Total Bruto | `valor_total` | `operacoes_producao.valor_total` (NUMERIC) | Cálculo: $qtd \times unitário$ |
| Custos de Materiais (Filme) | `valor_total_filme`, `valor_total_materiais` | `operacoes_producao` | Insumos cobrados à parte |
| Retenção de Imposto | `percentual_iss`, `custo_com_iss` | `operacoes_producao` | Alíquota e valor do imposto |
| Placa do Veículo | `placa` | `operacoes_producao.placa` (VARCHAR) | Rastreabilidade do caminhão |
| Documento Fiscal | `nf_numero`, `ctrc` | `operacoes_producao` | Identificadores fiscais |
| Equipe Envolvida | `quantidade_colaboradores` | `operacoes_producao.quantidade_colaboradores` | Quantitativo da equipe |
| Detalhe dos Colaboradores | `production_entry_collaborators` | `pec.production_entry_id = op.id` | Colaboradores associados à operação |
| Modalidade Financeira | `modalidade_financeira` | `operacoes_producao.modalidade_financeira` | CAIXA_IMEDIATO, DUPLICATA, etc. |
| Status Operacional / RH | `status`, `status_rh` | `operacoes_producao` | `CONCLUIDO`, `VALIDADO_RH`, etc. |
| Status Financeiro | `status_pagamento`, `data_vencimento` | `operacoes_producao` | Rastreio da liquidação |

### 3.4 Conclusão de Viabilidade: **A — SUPORTADO HOJE**
O ORBE armazena integralmente todos os fatos geradores da operação na granularidade correta. A relação com a receita é direta através do pipeline financeiro.

---

## 4. AUDITORIA DETALHADA: R02 — FECHAMENTO DE DIARISTAS

### 4.1 Pergunta de Negócio
*"Quais foram os valores apurados e liquidados de diárias por colaborador, empresa e semana operacional, e qual a situação de aprovação e conciliação bancária de cada lote?"*

### 4.2 Granularidade
- **Visão Analítica (Detalhamento):** LINHA = Um Apontamento de Diária (`lancamentos_diaristas.id`).
- **Visão Sintética (Fechamento):** LINHA = Um Lote Semanal de Pagamento (`lote_pagamento_diaristas.id`).

### 4.3 Matriz de Evidência de Dados

| Informação Requerida | Campo Real | Tabela / Relacionamento | Evidência Técnica |
|---|---|---|---|
| Identificador do Lançamento | `id` | `lancamentos_diaristas` | Migration `20260510_ciclo_fechamento_diaristas.sql` |
| Empresa / Filial | `empresa_id` | `lancamentos_diaristas.empresa_id` | FK direta |
| Colaborador Diarista | `diarista_id`, `nome_colaborador`, `cpf_colaborador` | `lancamentos_diaristas` $\rightarrow$ `colaboradores.id` | Dados de identificação |
| Função Exercida | `funcao_colaborador` | `lancamentos_diaristas.funcao_colaborador` | Texto da função na diária |
| Data da Diária | `data_lancamento` | `lancamentos_diaristas.data_lancamento` (DATE) | Data em que o diarista trabalhou |
| Código de Marcação | `codigo_marcacao` | `lancamentos_diaristas.codigo_marcacao` | 'P' (Presença), 'MP' (Meia), 'F' (Falta) |
| Quantidade de Diárias | `quantidade_diaria` | `lancamentos_diaristas.quantidade_diaria` | 1.0, 0.5 ou 0 |
| Valor Base da Diária | `valor_diaria_base` | `lancamentos_diaristas.valor_diaria_base` | R$ da diária cadastrada |
| Valor Calculado | `valor_calculado` | `lancamentos_diaristas.valor_calculado` | $quantidade \times valor\_base$ |
| Lote de Fechamento | `lote_fechamento_id` | `lancamentos_diaristas.lote_fechamento_id` $\rightarrow$ `lote_pagamento_diaristas.id` | Agrupador do ciclo semanal |
| Ciclo Semanal | `ciclo_id`, `data_inicio`, `data_fim` | `ciclos_diaristas` | Período de apuração semanal |
| Status do Fechamento | `status` | `lote_pagamento_diaristas.status` | `pendente`, `aprovado_rh`, `enviado_financeiro`, `pago` |
| Vínculo Bancário (CNAB) | `diaristas_lote_id` | `cnab_remessa_itens` / `cnab_retorno_itens` | `20260928150000_cnab_retorno_itens_diaristas_lote_id.sql` |

### 4.4 Fronteira Funcional Estrita
O relatório **NÃO** executa fechamento de semana nem aprova lotes. O relatório é uma consulta histórica consolidada das diárias prestadas e dos lotes já homologados pelo RH e pelo Financeiro.

### 4.5 Conclusão de Viabilidade: **A — SUPORTADO HOJE**
Fluxo maduro, auditado de ponta a ponta e homologado no módulo de Diaristas.

---

## 5. AUDITORIA DETALHADA: R03 — FATURAMENTO E RECEITAS

### 5.1 Pergunta de Negócio
*"Qual o faturamento emitido e as receitas reconhecidas por cliente tomador em determinada competência, segregando por tipo de serviço e status de recebimento/inadimplência?"*

### 5.2 Granularidade
**LINHA = Uma Receita Operacional (`receitas_operacionais.id`) com seus itens vinculados (`receitas_operacionais_itens`).**

### 5.3 Matriz de Evidência de Dados

| Informação Requerida | Campo Real | Tabela / Relacionamento | Evidência Técnica |
|---|---|---|---|
| Identificador da Receita | `id` | `receitas_operacionais` | Migration `20260701100000_receitas_operacionais.sql` |
| Empresa | `empresa_id` | `receitas_operacionais.empresa_id` $\rightarrow$ `empresas.id` | FK direta |
| Unidade | `unidade_id` | `receitas_operacionais.unidade_id` $\rightarrow$ `unidades.id` | FK direta |
| Modalidade de Cobrança | `modalidade` | `receitas_operacionais.modalidade` | `CAIXA_IMEDIATO`, `DUPLICATA`, `FATURAMENTO_MENSAL` |
| Competência Financeira | `competencia` | `receitas_operacionais.competencia` (VARCHAR 'YYYY-MM') | Mês de competência econômica |
| Data de Vencimento | `vencimento` | `receitas_operacionais.vencimento` (DATE) | Vencimento acordado |
| Data de Liquidação | `data_recebimento` | `receitas_operacionais.data_recebimento` (DATE) | Data efetiva do crédito em conta |
| Valor Total da Receita | `valor_total` | `receitas_operacionais.valor_total` (NUMERIC) | Total líquido da fatura |
| Status do Recebimento | `status` | `receitas_operacionais.status` | `pendente`, `aguardando_faturamento`, `faturado`, `pago`, `cancelado` |
| Origem: Operação por Volume | `operacao_id` | `receitas_operacionais_itens.operacao_id` $\rightarrow$ `operacoes_producao.id` | Vincula a descarga faturada |
| Origem: Serviço Extra | `servico_extra_id` | `receitas_operacionais_itens.servico_extra_id` $\rightarrow$ `servicos_extras_operacionais.id` | Vincula o serviço complementar |
| Valor por Item Faturado | `valor_item` | `receitas_operacionais_itens.valor_item` | Valor individual de cada item na fatura |
| Cliente Tomador | `transportadora_id` / `cliente` | Resolvido via join da operação de origem | Nome do tomador do serviço |

### 5.4 Semântica Contábil Comprovada: Custos Extras NÃO são Receitas
A auditoria no schema comprovou que a tabela `custos_extras_operacionais` **NÃO possui** coluna na tabela `receitas_operacionais_itens`.  
*Custos extras representam despesas pagas pela ESC LOG (refeições, combustíveis, botas, materiais operacionais).* Tentar incluir custos extras como "linhas de receita" seria um erro de interpretação contábil gravíssimo. Custos extras pertencem exclusivamente a Contas a Pagar / Despesas.

### 5.5 Conclusão de Viabilidade: **B — SUPORTADO COM COMPOSIÇÃO SEGURA**
O modelo é consistente, mas exige join entre `receitas_operacionais` e `receitas_operacionais_itens` para expor o detalhe dos serviços que compõem o faturamento.

---

## 6. AUDITORIA DETALHADA: R04 — CUSTOS EXTRAS OPERACIONAIS

### 6.1 Pergunta de Negócio
*"Quais despesas extraordinárias foram lançadas na ponta pelos encarregados em determinada filial/período, por categoria de gasto, favorecido e situação de aprovação?"*

### 6.2 Granularidade
**LINHA = Um Lançamento de Custo Extra (`custos_extras_operacionais.id`).**

### 6.3 Matriz de Evidência de Dados

| Informação Requerida | Campo Real | Tabela / Relacionamento | Evidência Técnica |
|---|---|---|---|
| Identificador do Custo | `id` | `custos_extras_operacionais` | Schema ativo verificado via script |
| Empresa / Filial | `empresa_id`, `empresa_nome` | `custos_extras_operacionais.empresa_id` | FK direta |
| Unidade Física | `unidade_id` | `custos_extras_operacionais.unidade_id` | FK direta |
| Data do Fato Gerador | `data` | `custos_extras_operacionais.data` (DATE) | Data em que o gasto ocorreu |
| Categoria do Gasto | `categoria_custo` | `custos_extras_operacionais.categoria_custo` | REFEICAO, COMBUSTIVEL, EPI, FERRAMENTAS, etc. |
| Descrição Detalhada | `descricao`, `observacao` | `custos_extras_operacionais` | Justificativa do encarregado |
| Quantidade e Unitário | `quantidade`, `valor_unitario` | `custos_extras_operacionais` | Composição quantitativa |
| Valor Total do Gasto | `total` | `custos_extras_operacionais.total` (NUMERIC) | Valor final da despesa |
| Favorecido (Colaborador) | `favorecido_colaborador_id` | `custos_extras_operacionais` $\rightarrow$ `colaboradores.id` | Reembolso a funcionário |
| Favorecido (Fornecedor) | `favorecido_fornecedor_id` | `custos_extras_operacionais` $\rightarrow$ `fornecedores.id` | Pagamento a comércio local |
| Encarregado Solicitante | `responsavel_nome`, `responsavel_id` | `custos_extras_operacionais` | Quem lançou a despesa |
| Origem do Recurso | `origem_recurso` | `custos_extras_operacionais.origem_recurso` | CAIXINHA, REEMBOLSO, DIRETO_EMPRESA |
| Status no Pipeline | `pipeline_status` | `custos_extras_operacionais.pipeline_status` | `LANCADO`, `EM_ANALISE_RH`, `APROVADO_RH`, `DEVOLVIDO`, `APROVADO_FINANCEIRO` |
| Status do Pagamento | `status_pagamento`, `data_vencimento` | `custos_extras_operacionais` | Situação da liquidação da despesa |
| Operação Vinculada (se houver) | `operacao_id` | `custos_extras_operacionais.operacao_id` | Relação opcional com descarga específica |

### 6.4 Conclusão de Viabilidade: **A — SUPORTADO HOJE**
Entidade limpa, autocontida, com filtros naturais por empresa, período e categoria de custo.

---

## 7. AUDITORIA DETALHADA: R05 — CONSOLIDADO DE BANCO DE HORAS

### 7.1 Pergunta de Negócio
*"Qual o saldo consolidado de banco de horas por colaborador e empresa, quantos minutos estão em débito crítico e quantas horas expirarão nos próximos 30 dias pela regra de vigência?"*

### 7.2 Granularidade
**LINHA = Um Colaborador com Saldo Consolidado (`colaboradores.id`).**

### 7.3 Matriz de Evidência de Dados

| Informação Requerida | Campo Real | Tabela / Relacionamento | Evidência Técnica |
|---|---|---|---|
| Colaborador | `id`, `nome`, `matricula`, `cpf` | `colaboradores` | Cadastro oficial CLT |
| Empresa | `empresa_id` | `colaboradores.empresa_id` $\rightarrow$ `empresas.id` | FK direta |
| Saldo Atual Consolidado | `saldo_atual_minutos` | `banco_horas_saldos.saldo_atual_minutos` | Saldo corrente em minutos |
| Total de Horas Positivas | `horas_positivas_minutos` | `banco_horas_saldos.horas_positivas_minutos` | Créditos acumulados |
| Total de Horas Negativas | `horas_negativas_minutos` | `banco_horas_saldos.horas_negativas_minutos` | Débitos acumulados |
| Próximo Vencimento (D+180) | `data_vencimento` | `banco_horas_eventos.data_vencimento` | Calculado por ciclo trimestral |
| Minutos Prestes a Vencer (30d) | `minutos_a_vencer_30d` | Agregação em `BHEventoService.getSaldosGerais` | Janela de alerta operacional |
| Minutos já Vencidos | `minutos_vencidos` | Agregação em `BHEventoService.getSaldosGerais` | Horas expiradas sem compensação |
| Classificação de Risco | `smartStatus` / `status_label` | Regra de negócio em `PainelGeral.tsx`: `debito_critico`, `a_vencer`, `saldo_positivo` | Status para priorização do RH |
| Data da Última Movimentação | `ultima_movimentacao` | `banco_horas_saldos.ultima_movimentacao` | Timestamp da última batida/ajuste |

### 7.4 Veto Técnico: Conceito de "Passivo Financeiro"
A auditoria procurou evidências de cálculo financeiro de passivo trabalhista (R$) derivado de Banco de Horas:
- **Resultado:** **NÃO COMPROVADO**.
- Não há no schema do ORBE nenhuma tabela com provisão financeira em R$ calculada sobre o saldo de BH.
- Transformar minutos em Reais exigiria regras de encargos (FGTS, INSS, DSR sobre HE, convenção coletiva, reflexos de 13º e férias) que **não estão modeladas no sistema**.
- **Diretriz:** O relatório deve ser intitulado e mantido estritamente como **Consolidado de Banco de Horas (Horas e Minutos)**, sem projetar valores financeiros fictícios.

### 7.5 Conclusão de Viabilidade: **A — SUPORTADO HOJE (Em Horas/Minutos)**
O motor já alimenta o `PainelGeral.tsx` perfeitamente via `BHEventoService.getSaldosGerais`.

---

## 8. AUDITORIA DETALHADA: R06 — PRODUTIVIDADE DA EQUIPE OPERACIONAL

### 8.1 Pergunta de Negócio Originalmente Proposta
*"Qual a produtividade individual de cada colaborador (CLT, Diarista e Intermitente), cruzando volume movimentado, descargas participadas e horas trabalhadas?"*

### 8.2 Auditoria de Relacionamentos no Schema Real

1. **CLT $\longleftrightarrow$ Operação:**
   - O vínculo existe apenas através de `production_entry_collaborators` (`production_entry_id`, `collaborator_id`).
   - Essa tabela registra que o colaborador esteve presente na operação.
   - **Lacuna Técnica:** O volume (`operacoes_producao.quantidade`) pertence à operação global (ex: 3.000 caixas de leite descarregadas por 4 pessoas). O sistema **NÃO registra** quantas caixas cada um movimentou individualmente.
   - Dividir 3.000 por 4 seria uma média aritmética artificial, não uma aferição de produtividade real.

2. **Diarista $\longleftrightarrow$ Operação:**
   - A presença dos diaristas é apontada na grade semanal (`lancamentos_diaristas`).
   - O campo `operacao_servico` é um texto livre (ex: "DESCARGA").
   - **Lacuna Técnica:** Não existe chave estrangeira `operacao_id` em `lancamentos_diaristas`. O diarista não está estruturalmente amarrado à linha de `operacoes_producao`.

3. **Intermitente $\longleftrightarrow$ Operação:**
   - Os dados residem em `lancamentos_intermitentes`, importados do sistema externo Tio Digital.
   - A tabela possui apenas `data_referencia`, `convocacao`, `horas_trabalhadas`, `he_50`, etc.
   - **Lacuna Técnica:** **Vínculo com operação inexistente.** O intermitente é convocado por turno, não por carga descarregada.

### 8.3 Conclusão de Viabilidade: **D — NÃO SUPORTADO / NÃO RECOMENDADO**
- A tentativa de produzir um "Relatório de Produtividade Unificado" misturando CLT, Diaristas e Intermitentes com volume individual é **inviável e enganosa** com os dados que o ORBE possui hoje.
- Geraria relatórios com números ficcionais que prejudicariam a tomada de decisão da diretoria e poderiam causar litígios trabalhistas.
- **Decisão:** **BLOQUEADO.** Não deve entrar no escopo da V2.

---

## 9. CANDIDATO ADICIONAL IDENTIFICADO: R07 — ANALÍTICO DE SERVIÇOS EXTRAS

Durante a auditoria das origens de faturamento, constatou-se que a tabela `servicos_extras_operacionais` está 100% estruturada, possui regras de aprovação RH e financeira maduras e é frequentemente demandada pela operação:

- **Pergunta de Negócio:** *"Quais serviços extraordinários (transbordo, paletização, enlonamento, limpeza) foram prestados em determinado período, para qual cliente e qual valor foi faturado?"*
- **Tabela:** `servicos_extras_operacionais`.
- **Campos Reais:** `id`, `empresa_id`, `data`, `cliente`, `tipo_servico`, `descricao`, `quantidade`, `valor_unitario`, `total`, `pipeline_status`.
- **Relação com Faturamento:** Possui vínculo direto com `receitas_operacionais_itens.servico_extra_id`.
- **Classificação:** **A — SUPORTADO HOJE.**  
  *(Candidato elegível para compor o pilar Operacional no lugar do inviável R06).*

---

## 10. MATRIZ DE SEGREGACÃO POR EMPRESA (MULTI-TENANT)

| Relatório Candidato | Possui `empresa_id`? | Entidade Portadora | Propagação Confiável? | Suporta Filtro sem Rateio? | O Consolidado é Soma Pura? | Avaliação |
|---|---|---|---|---|---|---|
| **R01 — Operações por Volume** | Sim | `operacoes_producao` | Direta na tabela principal | Sim (`.eq('empresa_id', ...)`) | Sim | **SUPORTADO** |
| **R02 — Fechamento Diaristas** | Sim | `lancamentos_diaristas` e `ciclos_diaristas` | Direta | Sim | Sim | **SUPORTADO** |
| **R03 — Faturamento e Receitas**| Sim | `receitas_operacionais` | Direta | Sim | Sim | **SUPORTADO** |
| **R04 — Custos Extras** | Sim | `custos_extras_operacionais` | Direta | Sim | Sim | **SUPORTADO** |
| **R05 — Consolidado de BH** | Sim | `colaboradores` e `banco_horas_saldos` | Direta por colaborador | Sim | Sim | **SUPORTADO** |
| **R06 — Produtividade** | Parcial | Descentralizada entre 4 tabelas | Frágil / Inexistente no diarista | Não | Não | **NÃO SUPORTADO** |

---

## 11. MATRIZ TEMPORAL (SEMÂNTICA CORRETA)

Aplicando o princípio validado no DRE-FIX01, `created_at` nunca deve ser utilizado como data do relatório:

| Relatório Candidato | Dimensão Temporal Correta | Campo no Banco | Justificativa de Negócio |
|---|---|---|---|
| **R01 — Operações por Volume** | Data da Operação | `data_operacao` (DATE) | Representa o momento físico da descarga |
| **R02 — Fechamento Diaristas** | Data da Diária / Ciclo | `data_lancamento` (DATE) e `ciclo.data_fim` | Data do trabalho e semana de corte |
| **R03 — Faturamento e Receitas**| Competência / Vencimento | `competencia` (YYYY-MM) e `vencimento` (DATE) | Competência econômica e regime financeiro |
| **R04 — Custos Extras** | Data do Fato Gerador | `data` (DATE) | Dia em que a despesa ocorreu |
| **R05 — Consolidado de BH** | Data de Vencimento / Competência | `data_vencimento` e `ciclo_trimestral` | Vigência legal do banco de horas |

---

## 12. MATRIZ DE FILTROS REALMENTE SUPORTADOS

| Relatório | Filtro Essencial (Obrigatório) | Filtros Úteis Suportados | Filtros NÃO Suportados (Bloquear) |
|---|---|---|---|
| **R01 — Operações** | `empresa_id`, `data_operacao` (De/Até) | `transportadora_id`, `tipo_servico_id`, `status` | Produtividade individual de colaborador |
| **R02 — Diaristas** | `empresa_id`, `ciclo_id` ou Período | `status`, `funcao_colaborador`, `diarista_id` | Número de carga / caminhão (sem FK) |
| **R03 — Faturamento**| `empresa_id`, `competencia` | `modalidade`, `status`, `cliente` | Custos extras agregados (são despesas) |
| **R04 — Custos Extras**| `empresa_id`, `data` (De/Até) | `categoria_custo`, `pipeline_status`, `origem_recurso` | Linha de produção (sem amarração obrigatória) |
| **R05 — Banco de Horas**| `empresa_id`, Competência Ref. | `smartStatus` (débito crítico, a vencer), busca colaborador | Saldo em Reais / Passivo financeiro |

---

## 13. MATRIZ DE COLUNAS VIÁVEIS PARA O PROTÓTIPO

### R01 — Analítico de Operações por Volume
- **Colunas Seguras:** Data, Código, Unidade, Transportadora, Tipo de Serviço, Produto, Quantidade, Unitário (R$), Total Bruto (R$), Materiais (R$), ISS (R$), Placa, NF, Status.
- **Colunas Não Suportadas:** Produtividade individual por colaborador, % de contribuição por operador.

### R02 — Fechamento de Diaristas
- **Colunas Seguras:** Data, Colaborador, CPF, Função, Código Marcação (P/MP/F), Quantidade de Diárias, Valor Diária (R$), Total Apurado (R$), Lote Semanal, Status do Lote.
- **Colunas Não Suportadas:** Operação logística associada, Carga associada.

### R03 — Faturamento e Receitas
- **Colunas Seguras:** Competência, Cliente Tomador, Modalidade de Cobrança, Origem (Operação / Serviço Extra), Valor Faturado (R$), Data de Vencimento, Data de Pagamento, Status Financeiro.
- **Colunas Não Suportadas:** Custos extras repassados.

### R04 — Custos Extras Operacionais
- **Colunas Seguras:** Data, Unidade, Categoria de Custo, Descrição, Favorecido, Quantidade, Valor Unitário (R$), Total (R$), Origem Recurso, Responsável Lançador, Status Pagamento.
- **Colunas Não Suportadas:** Centro de custo contábil complexo (plano de contas não preenchido nos lançamentos da ponta).

### R05 — Consolidado de Banco de Horas
- **Colunas Seguras:** Matrícula, Colaborador, Empresa, Saldo Corrente (Horas/Minutos), Créditos do Período, Débitos do Período, Horas a Vencer (30d), Horas Vencidas, Status de Risco (OK, A Vencer, Débito Crítico).
- **Colunas Não Suportadas:** Passivo em Reais (R$), Provisão Contábil de Encargos.

---

## 14. EXPORTABILIDADE (CSV × PDF)

| Relatório | Dataset Vocacionado para CSV | Vocacionado para PDF? | Formato de Saída Recomendado |
|---|---|---|---|
| **R01 — Operações** | Sim (Analítico completo com todas as variáveis) | Sim (Relatório sintético com totalizadores) | **CSV + PDF** |
| **R02 — Diaristas** | Sim (Linha a linha para conciliação bancária) | Sim (Espelho de fechamento semanal por equipe) | **CSV + PDF** |
| **R03 — Faturamento**| Sim (Base para conciliação contábil externa) | Sim (Demonstrativo gerencial de receitas) | **CSV + PDF** |
| **R04 — Custos Extras**| Sim (Listagem completa para auditoria de notas) | Não (Excessivamente granular) | **Apenas CSV** |
| **R05 — Banco de Horas**| Sim (Exportação direta para o sistema de folha) | Sim (Extrato de conferência de saldos por filial) | **CSV + PDF** |

---

## 15. RASTREABILIDADE E PERFORMANCE

| Candidato | Nível de Rastreabilidade Estrutural | Risco de Performance | Mitigação Obrigatória na Consulta |
|---|---|---|---|
| **R01 — Operações** | **COMPLETA ESTRUTURAL** (Linha aponta para `operacoes_producao.id`) | **MÉDIO** | Obrigar filtro de período (máx. 90 dias) e paginação. |
| **R02 — Diaristas** | **COMPLETA ESTRUTURAL** (Linha aponta para `lancamentos_diaristas.id`) | **BAIXO** | Consulta filtrada por semana operacional/ciclo. |
| **R03 — Faturamento**| **COMPLETA ESTRUTURAL** (Linha aponta para `receitas_operacionais.id`) | **BAIXO** | Filtrado estritamente por competência mensal. |
| **R04 — Custos Extras**| **COMPLETA ESTRUTURAL** (Linha aponta para `custos_extras_operacionais.id`) | **BAIXO** | Filtrado por data de fato gerador. |
| **R05 — Banco de Horas**| **COMPLETA ESTRUTURAL** (Linha aponta para `colaboradores.id`) | **MÉDIO** | `BHEventoService` deve consultar apenas colaboradores da empresa selecionada. |
| **R06 — Produtividade**| **INEXISTENTE** | **ALTO** | Cruzamento sem chave causará queries complexas e imprecisas. |

---

## 16. PERMISSÕES REAIS POR PERFIL

| Relatório Candidato | ADMIN | RH | FINANCEIRO | ENCARREGADO |
|---|---|---|---|---|
| **R01 — Operações por Volume** | Acesso Total | Consulta | Consulta / Faturamento | Sem Acesso |
| **R02 — Fechamento Diaristas** | Acesso Total | Acesso Total | Acesso Total (Pagamento) | Sem Acesso |
| **R03 — Faturamento e Receitas**| Acesso Total | Sem Acesso | Acesso Total | Sem Acesso |
| **R04 — Custos Extras** | Acesso Total | Consulta | Acesso Total | Sem Acesso |
| **R05 — Consolidado de BH** | Acesso Total | Acesso Total | Consulta | Sem Acesso |

*Lembrete da Fase 01:* O perfil `RH` precisa ter o módulo `central_de_relatorios` adicionado ao seu preset em `access-control.ts` para poder emitir R02 e R05.

---

## 17. CLASSIFICAÇÃO FINAL DOS SEIS CANDIDATOS

| ID | Nome do Relatório Candidato | Pergunta Central de Negócio | Granularidade | Classificação Final | Situação para o Protótipo |
|---|---|---|---|---|---|
| **R01** | **Analítico de Operações por Volume** | Volume, fretes e valores faturados por operação e caminhão | Uma Operação | **A — SUPORTADO HOJE** | **LIBERADO** |
| **R02** | **Fechamento de Diaristas** | Total de diárias e valores liquidados por ciclo e equipe | Uma Diária / Lote | **A — SUPORTADO HOJE** | **LIBERADO** |
| **R03** | **Faturamento e Receitas** | Faturamento bruto e recebimentos por cliente tomador | Uma Receita Operacional | **B — SUPORTADO COM COMPOSIÇÃO** | **LIBERADO** |
| **R04** | **Custos Extras Operacionais** | Despesas extraordinárias da ponta por categoria e unidade | Um Lançamento de Custo | **A — SUPORTADO HOJE** | **LIBERADO** |
| **R05** | **Consolidado de Banco de Horas** | Saldos acumulados em horas, débitos críticos e vencimentos | Um Colaborador | **A — SUPORTADO HOJE (Horas)** | **LIBERADO** |
| **R06** | **Produtividade da Equipe Operacional** | Produtividade individual comparada entre CLT, Diaristas e Intermitentes | Misto / Indefinido | **D — NÃO SUPORTADO** | **BLOQUEADO** |

---

## 18. RELATÓRIOS APROVADOS PARA O PROTÓTIPO V2

A Central de Relatórios V2 deve avançar para o Protótipo 1 baseada em **5 relatórios essenciais sólidos e comprovados**, acrescida do candidato adicional R07 (Serviços Extras), se desejado:

```text
CENTRAL DE RELATÓRIOS V2 (ESCOPO HOMOLOGADO)
│
├── 1. OPERACIONAL
│   ├── R01: Analítico de Operações por Volume
│   ├── R04: Custos Extras Operacionais
│   └── [R07]: Analítico de Serviços Extras (Opcional - Candidato Aprovado)
│
├── 2. PESSOAS & RH
│   ├── R02: Fechamento Semanal de Diaristas
│   └── R05: Consolidado de Banco de Horas (Horas & Minutos)
│
└── 3. FINANCEIRO & FATURAMENTO
    └── R03: Faturamento e Receitas por Cliente
```

---

## 19. RELATÓRIOS BLOQUEADOS E EVOLUÇÕES NECESSÁRIAS

- **R06 (Produtividade):**  
  **Motivo do Bloqueio:** Ausência de apontamento de volume individual por trabalhador e ausência de amarração de Diaristas e Intermitentes às operações de descarga.  
  *Evolução Futura Necessária:* Se a empresa desejar mensurar produtividade individual, será necessário evoluir o formulário do encarregado para que este aponte a cota de produção de cada operador na carga (ex: Colaborador A descarregou 500 caixas, Colaborador B descarregou 700 caixas).

- **Conceito de Passivo Financeiro de BH:**  
  **Motivo do Bloqueio:** Inexistência de motor financeiro e atuarial homologado para converter saldo de BH em passivo de balanço.  
  *Evolução Futura Necessária:* Desenvolvimento conjunto com o setor contábil/fiscal de uma fórmula de provisão de encargos trabalhistas antes de exibir valores em moeda corrente.

---

🛑 **CHECKPOINT DE CONCLUSÃO — PARADA OBRIGATÓRIA**

1. Todos os 6 candidatos auditados diretamente contra o banco de dados e services reais.
2. 5 relatórios liberados com sustentação completa de dados; 1 relatório bloqueado categoricamente por falta de amarração no schema.
3. 1 relatório adicional de alto valor identificado (Serviços Extras).
4. Proibições respeitadas: código de produção, rotas, protótipos e banco permanecem 100% inalterados.
