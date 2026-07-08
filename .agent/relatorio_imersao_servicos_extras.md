# RELATÓRIO EXECUTIVO: IMERSÃO CONCEITUAL — SERVIÇOS EXTRAS

## 1. Finalidade do Módulo
- **Problema resolvido:** Controla, autoriza e gera receita para serviços adicionais prestados que estão fora do escopo operacional padrão contratado, evitando evasão de receitas e garantindo a rastreabilidade desde a operação até o caixa.
- **Por que existe:** Para não misturar folha de pagamento CLT ou de Diaristas com serviços faturáveis aos clientes, separando claramente o que é mão de obra do que é faturamento adicional.
- **Diferenças conceituais:**
  - *Operações por Volume:* Base contratual, operação rotineira medida por volume (ex: caixas, pallets).
  - *Diaristas:* Pagamento de mão de obra eventual, não é faturamento direto.
  - *Custos Extras:* Despesas da base logística ou do fornecedor.
  - *Serviços Extras:* Receitas Operacionais Adicionais cobradas do cliente (carga extra, paletização, lavagem). Podem ou não repassar custos à mão de obra, mas o foco primário é a **Receita**.

## 2. Fluxo Operacional
- **Quem cria:** Encarregado operacional / Portal Operacional.
- **Quem pode editar:** Encarregado (se pendente), Gestor/Admin.
- **Quem aprova (Operação):** Operação/Gestor (Validação).
- **Quem aprova (Financeiro):** Financeiro (Aprovação e Consolidação).
- **Quem fatura:** Financeiro.
- **Quem recebe:** Financeiro.
- **Quem pode devolver (rejeitar/reabrir):** Gestor (devolve da Validação) e Financeiro (devolve da Aprovação/Faturamento). Todos exigem justificativa.
- **Quem pode excluir:** Apenas Admin ou Encarregado enquanto estiver com status PENDENTE.

## 3. Entrada de Dados
Os campos disponíveis no formulário de Lançamento incluem:
- Empresa (Obrigatório)
- Data (Obrigatório)
- Tipo de Serviço (ex: Lavagem, Paletização)
- Descrição do Serviço / Observações Extras
- Quantidade
- Unidade de Cobrança (op, un, etc. — snapshot)
- Quantidade de Colaboradores (Opcional)
- Período Operacional / Regra (multiplicador)
- Valor Unitário (calculado via tipo de serviço/multiplicador ou preenchido livremente se for 'manual')
- Forma de Pagamento (Forma Pagamento ID/nome)
- Modalidade Financeira (Caixa Imediato, Depósito, Fechamento Mensal, Duplicata)
- Emite NF? (Sim/Não) e Número da NF
- ISS (Percentual calculado automaticamente via fornecedor_valor_servico ou preenchido manualmente)
- Materiais Consumidos (Lista de materiais, quantidades e valores aplicados)
- Transportadora ou Colaboradores / Fornecedores vinculados
- Origem do Dado (manual, importacao, ajuste)
- Status do Pipeline e Status de Pagamento

## 4. Origem dos Valores
- **Tabelas base:** `tipos_servico_operacional` para o valor base e a métrica de cobrança.
- **Multiplicadores/Regras:** `servicos_especificos_regras` para definir pesos de acordo com os períodos ou condições (ex: Período Padrão = 1.00x, Noturno = 1.50x).
- **ISS:** Calculado automaticamente pelas regras cadastradas por Fornecedor x Tipo de Serviço x Empresa via a function RPC ou `FornecedorValorServicoService`. Se a NF for emitida e não houver regra, um fallback de 5% pode ser sugerido na UI.
- **Materiais:** `materiais_operacionais`. Snapshots do custo e nome da unidade são registrados para cálculo do Total.
- **Fórmula Base:** `(Quantidade × (Valor Unitário Base × Multiplicador Regra)) + Custo de Materiais = Valor Total Bruto`.
- **Fórmula Líquida:** `Valor Total Bruto - ISS (se houver)`.

## 5. Regras de Negócio
- **Obrigatoriedades:** Empresa, data, tipo_servico, descricao, quantidade, valor, forma de pagamento e responsavel_nome.
- **Nenhum serviço extra gera recebimento financeiro ou vai para o caixa de forma imediata e indiscriminada.** Eles passam obrigatoriamente pelas validações e aprovações.
- Falhas ou bloqueios num passo do pipeline bloqueiam os demais e devem ser tratados devolvendo (DEVOLVIDO) para o passo anterior mediante justificativa (anotada em `justificativa_devolucao`).
- Colunas calculadas como `total` são mantidas em sincronia com o banco por Triggers (ex: `trg_calcular_total_servico_extra`).
- Não se mistura o cadastro do serviço prestado à folha da CLT. Qualquer repasse a trabalhador deve ser registrado em módulo à parte (banco de horas, premiações) ou como regras de intermitentes/diaristas independentes.

## 6. Fluxo Financeiro (Receita)
O Serviço Extra é primordialmente **uma ferramenta para gerar cobranças (Receita)**.
- Pertence ao `Pipeline Operacional`, que desemboca na conta de "Receitas Operacionais".
- Possui check e modalidade vinculada (`CAIXA_IMEDIATO`, `DEPOSITO_IMEDIATO`, `DUPLICATA_FORNECEDOR`, `FECHAMENTO_MENSAL_EMPRESA`).
- **Dashboard / DRE:** A receita calculada (`Total - ISS`) compõe os indicadores Financeiros (Dashboard Adm / KPI Finance).
- Não há automação cega de despesas em contrapartida, exceto se houver gatilho de custo específico (via materiais, ou registro intencional de custo operacional), mas a definição principal do fluxo financeiro é **Receita / Contas a Receber**.

## 7. Integração com RH
- Serviço extra **NÃO** calcula a folha da equipe e não reflete no RH de forma explícita de remuneração CLT no Orbe.
- Lançar um serviço extra informando "quantidade de colaboradores" serve como indicativo histórico de esforço logístico do fornecedor/centro de custo.
- Pagamento relacionado e vínculos nominais com a folha são tratados no módulo de Custos, RH, ou Diaristas. Os Serviços Extras visam primordialmente rastrear a prestação do serviço ao Tomador e cobrar adequadamente.
- Não existem gatilhos automatizados gerando Lotes RH provenientes de `servicos_extras_operacionais` (verificado via triggers).

## 8. Auditoria
- **Quem lançou / atualizou:** Registrado via `criado_por` (auth.uid), `criado_em`, e `atualizado_em`.
- **Histórico (Timeline):** Tudo orquestrado pelo `OperationalPipelineModal`, com registros no `receita_operacional_historico` ou tabelas agregadas quando evolui ao financeiro.
- Snapshots: O valor dos itens e configurações no momento do registro é salvo em `materiais_snapshot`, `valor_unitario_snapshot`, `tipo_calculo_snapshot`, e `unidade_cobranca_snapshot`, protegendo o cálculo anterior se as tabelas bases de preço mudarem futuramente.

## 9. Governança
- Imutabilidade Controlada:
  - Uma vez `CONCLUIDO`, não é possível alterar descrições ou quantidades. 
  - Todo retorno de status (`DEVOLVIDO`) exige inserção de texto na coluna `justificativa_devolucao`.
- Sem Edição Paralela e Sem "Soft Delete" falso; se precisar estornar um concluído, requereria autorização máxima via Cancelamento da pipeline, atualmente o sistema depende fortemente do conceito State Machine na coluna `pipeline_status`.

## 10. Segurança
- Há **Row Level Security (RLS)** ativa na tabela `servicos_extras_operacionais`.
- Inserção autônoma de `tenant_id` por meio do trigger `set_tenant_id_servicos_extras()` baseando-se no `auth.uid()` e Profile para prevenir _Tenant Leak_.
- Proteções robustas baseadas na role: Encarregados não podem aprovar lançamentos financeiramente, não têm permissões de pular o pipeline (controlado Client-Side pelo AccessControl e via Triggers no Supabase).

## 11. Arquitetura Envolvida
- **Tabelas / Vínculos:**
  - `servicos_extras_operacionais` (Base Principal)
  - `tipos_servico_operacional` (Serviços e regras base)
  - `servicos_especificos_regras` (Períodos e Pesos)
  - `materiais_operacionais` (Insumos agregados ao serviço)
  - `transportadoras` / `empresas` / `formas_pagamento_operacional`
- **Front-end UI / UX:**
  - `ServicosExtrasLancamento.tsx` (Tela encarregado/admin)
  - `NovoServicoExtraDialog.tsx` (Componente Form)
  - `ServicosExtrasRecebidos.tsx` (Portal de Recebimentos e Dashboard base)
  - `ServicosExtrasTableBlock.tsx` (Controle do Pipeline: avanço/devolução)
- **Camada de Serviços (Service):**
  - `ServicosExtrasOperacionaisService` no `base.service.ts` encapsula chamadas e manipulação do CRUD com tipagem apropriada.
- **Pipeline Abstraction:**
  - `OperationalPipelineContext` orquestra a evolução de um card em cada step.

## 12. Estados do Fluxo
Estes são perfeitamente espelhados no Enum de pipeline do Supabase:
1. `PENDENTE` (Rascunho / Entrada / Aguardando)
2. `EM_VALIDACAO` (Completado no local, requer validação pela Operação/RH)
3. `APROVADO_OPERACAO` (Em mãos do Financeiro Administrativo para aceite de fatura)
4. `APROVADO_FINANCEIRO` (Valores e contratos conferidos)
5. `FATURADO` (Títulos e NFs emitidas)
6. `CONCLUIDO` (Recebido ou totalmente processado)
7. `DEVOLVIDO` (Recusado nas etapas 2 a 5 com retorno para correção).

*Status de pagamento satélite:* `PENDENTE`, `RECEBIDO`, `ATRASADO`.

## 13. Pipeline Completo
Encarregado Lança Novo Serviço (ex: Carga Extra, c/ 3 materiais e NF ligada) 
-> `PENDENTE` 
-> Revisor da Conta/Operacional avalia e avança 
-> `EM_VALIDACAO` 
-> Gestor confirma legitimidade (Serviço realmente ocorreu, qtd correta) 
-> `APROVADO_OPERACAO` 
-> Financeiro recebe e prepara cobrança ao Cliente Base 
-> `APROVADO_FINANCEIRO` 
-> Faturamento gerado, NF anexada, integração à Conta a Receber gerida 
-> `FATURADO` 
-> Conciliação e Baixa de Pagamento do Cliente 
-> `CONCLUIDO` (+Dashboard reflete aumento do Mês).

## 14. Dependências Relacionais (Banco)
Depende obrigatoriamente de:
- Cadastro de Empresa / Tenant (`empresa_id`)
- Formulário Base Financeira (`forma_pagamento_id`)
- Catálogo de Serviços (`tipo_servico_id`)
- Cadastro de Materiais
- Configuração de Regras / Períodos (Noturno, FDS)
Tabelas: `empresas`, `tipos_servico_operacional`, `formas_pagamento_operacional`, `servicos_especificos_regras`, `operacoes_producao` (opcional).

## 15. Possíveis Pontos Críticos (A serem homologados a seguir)
1. **Divergência entre Preço Base vs Snapshots:** Como o front-end e os services gerenciam "tipo_calculo_snapshot" == "manual" versus recalculagens backend se a tabela mãe for alterada?
2. **Inconsistência UI de ISS vs Checkbox `nf_emite`**: A regra de fallback 5% em `ServicosExtrasLancamento.tsx` (quando não há tabela para a empresa) não recai no backend, ela depende exclusivamente do front-end injetar. Risco de requests API arbitrárias com ISS em branco/zerado caso sejam forjados além da interface web.
3. **Imutabilidade Operacional Pós-Faturamento:** Há pouca amarra SQL explícita prevenindo UPDATE em campos de valores (qtd, val unitário) após o `pipeline_status` evoluir para `FATURADO`. No UI o botão de "Pencil" esconde edição se não for encarregado e afins, mas a Policy SQL Update atual no Banco apenas tem `USING (true) WITH CHECK (true)`, delegando totalmente a validação para RPCs ou UI.
4. **Acoplamento de Módulos (Financeiro x Extra):** Garantir que a integração para gerar Registros Oficiais em `Contas a Receber` ocorre pontualmente na trigger certa (`APROVADO_OPERACAO` -> `FINANCEIRO`) sem duplicação caso um serviço extra sofra transição PENDENTE <-> APROVADO sequencialmente.

> **Status:** Imersão finalizada e compreendida. Pronta para evolução lógica e arquitetural baseada nestas restrições.
