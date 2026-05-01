# Plano de Implementação — Tela do Encarregado (`/producao`)

## Objetivo

Implementar a tela `Produção In-Loco` para o perfil `Encarregado`, transformando o fluxo atual de lançamento manual em um formulário operacional guiado, com cálculo automático, vínculos cadastrais controlados e persistência consistente no Supabase.

Este plano considera:

- a rota já existente `/producao`
- a tela atual em [src/pages/LancamentoProducao.tsx](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/LancamentoProducao.tsx)
- o design system em [src/pages/Styleguide.tsx](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Styleguide.tsx)
- o shell operacional em [src/components/layout/OperationalShell.tsx](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/src/components/layout/OperationalShell.tsx)
- o schema atual simplificado de `operacoes` em [supabase/schema.sql](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/supabase/schema.sql)

## Diagnóstico do estado atual

Hoje a tela já atende parte do fluxo de lançamento, mas ainda está abaixo da especificação:

- `Tipo de Serviço` usa uma lista curta e fixa, diferente da feature.
- `Transportadora` e `Produto` ainda são texto livre.
- `Valor Unitário` é editável, mas deveria ser automático e bloqueado.
- não existe separação entre `Fornecedor` e `Produto / Carga`.
- não existe `Forma de pagamento`.
- não existe preview de cálculo antes do envio.
- `Lançamentos do Dia` ainda refletem a estrutura antiga da tabela `operacoes`.
- o schema atual do banco não suporta os vínculos necessários para cálculo por fornecedor, empresa e tipo de serviço.

## Direção visual e UX

Seguir rigorosamente o styleguide:

- page title com `font-display`, caixa alta e peso forte
- cards com `bg-card`, `border-border`, `rounded-xl/2xl`, `shadow-sm`
- labels e metadados com tipografia compacta
- uso de badges de estado para `Processado`, `Pendente`, `Com alerta`, `Aguardando validação`, `Bloqueado`
- banner superior em tom informativo, reaproveitando a linguagem já presente na tela atual
- grid principal em duas colunas no desktop e empilhado no mobile

Decisão de layout recomendada:

- manter `OperationalShell`
- coluna esquerda: `Novo Registro` + `Resumo de Hoje`
- coluna direita: `Lançamentos do Dia`
- preservar a cadência visual da tela atual, mas trocar inputs livres por selects/autocomplete controlados

## Escopo funcional da tela

### 1. Cabeçalho

Usar o `OperationalShell` já existente, com estes refinamentos:

- título `PRODUÇÃO IN-LOCO`
- unidade atual vinda do vínculo do usuário
- nome do usuário logado
- perfil fixo `ENCARREGADO`
- botão de sair

### 2. Alerta superior

Manter o card/banner com a mensagem:

`Registros imediatos de carga, descarga e movimentações. Vincule o colaborador e registre a avaliação de conduta.`

### 3. Formulário `Novo Registro`

Campos finais do MVP:

- `Empresa / Unidade`
- `Data`
- `Tipo de Serviço`
- `Entrada (ponto)`
- `Saída (ponto)`
- `Colaborador`
- `Transportadora / Cliente`
- `Fornecedor`
- `Produto / Carga`
- `Quantidade`
- `Valor Unitário`
- `Forma de pagamento`
- `Placa do veículo`
- `Total previsto`

Regras de UX:

- `Valor Unitário` em somente leitura com selo `Automático`
- bloqueio de submit quando não houver preço cadastrado
- preview do cálculo em tempo real
- reset parcial do formulário após salvar, preservando contexto útil como unidade e data
- mensagens de erro inline para obrigatoriedade e ausência de regra financeira

### 4. Lançamentos do Dia

Cada item deve mostrar:

- horário do registro
- tipo de serviço
- colaborador
- transportadora/cliente
- fornecedor/produto
- quantidade
- valor unitário
- valor total
- status

### 5. Resumo de Hoje

Indicadores do card:

- total de lançamentos
- total de colaboradores envolvidos
- total de quantidade/volumes
- valor total produzido
- pendências
- alertas

## Estratégia de implementação

## Fase 1 — Refatorar a modelagem de domínio

Criar uma base de dados compatível com a feature. A tabela atual `operacoes` é simples demais para sustentar a tela.

### Tabelas necessárias

#### `operacoes_producao`

Tabela principal da tela.

Campos recomendados:

- `id`
- `empresa_id`
- `unidade_id`
- `data_operacao`
- `tipo_servico_id`
- `colaborador_id`
- `entrada_ponto`
- `saida_ponto`
- `transportadora_id`
- `fornecedor_id`
- `produto_carga_id`
- `quantidade`
- `valor_unitario_snapshot`
- `tipo_calculo_snapshot`
- `valor_total`
- `forma_pagamento`
- `placa`
- `status`
- `avaliacao_json`
- `criado_por`
- `criado_em`
- `atualizado_em`
- `justificativa_retroativa`

#### `fornecedor_valores_servico`

Tabela de regra financeira operacional.

Campos recomendados:

- `id`
- `fornecedor_id`
- `tipo_servico_id`
- `empresa_id`
- `unidade_id`
- `transportadora_id` nullable
- `produto_carga_id` nullable
- `valor_unitario`
- `tipo_calculo`
- `ativo`
- `vigencia_inicio`
- `vigencia_fim`
- `created_at`
- `updated_at`

### Tabelas de apoio esperadas

Antes da tela fechar funcionalmente, o projeto precisa ter ou evoluir cadastros equivalentes para:

- `unidades`
- `tipos_servico`
- `transportadoras_clientes`
- `fornecedores`
- `produtos_carga`
- `formas_pagamento`

Se parte disso já existir com outro nome, vale reaproveitar a estrutura em vez de duplicar cadastros.

## Fase 2 — Camada Supabase

### Migração SQL

Criar nova migration em `supabase/migrations/` com:

1. criação das tabelas novas
2. FKs para empresa, unidade, colaborador e usuário
3. `check constraints` para status e tipo de cálculo
4. índices compostos para busca operacional
5. auditoria temporal básica (`created_at`, `updated_at`)

Índices mínimos:

- `operacoes_producao (empresa_id, unidade_id, data_operacao)`
- `operacoes_producao (colaborador_id, data_operacao)`
- `operacoes_producao (status, data_operacao)`
- `fornecedor_valores_servico (empresa_id, fornecedor_id, tipo_servico_id, ativo)`

### RLS

Aplicar policies para:

- encarregado ver apenas lançamentos da própria unidade
- encarregado inserir apenas para unidades vinculadas
- encarregado atualizar apenas registros ainda não fechados
- bloquear alteração direta de `valor_unitario_snapshot` e `valor_total` após persistência

### RPC ou view recomendada

Para evitar lógica excessiva no frontend, criar um ponto único de consulta para precificação:

- `rpc_resolver_valor_operacao(...)`

Entradas:

- empresa
- unidade
- tipo de serviço
- fornecedor
- transportadora
- produto/carga
- data de operação

Saída:

- valor_unitario
- tipo_calculo
- regra_encontrada
- mensagem_bloqueio

Também é útil uma view ou RPC para resumo diário:

- `vw_operacoes_producao_resumo_dia`

## Fase 3 — Tipagem e serviços

### Tipagem

Atualizar o tipo gerado do banco em [src/types/database.ts](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/src/types/database.ts) depois da migration.

Observação:

- nesta sessão não há ferramenta MCP de Supabase disponível para eu aplicar ou regenerar isso automaticamente; o plano abaixo assume execução posterior da migration e refresh dos tipos.

### Serviços novos

Adicionar serviços específicos em [src/services/base.service.ts](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/src/services/base.service.ts) ou separar em arquivo próprio:

- `OperacaoProducaoService`
- `TipoServicoService`
- `TransportadoraClienteService`
- `FornecedorService`
- `ProdutoCargaService`
- `FormaPagamentoService`
- `FornecedorValorServicoService`

Métodos mínimos:

- `getFormContextByUser(userId)`
- `getTransportadorasByTipoServico(...)`
- `getFornecedoresByTipoServico(...)`
- `getProdutosByFornecedor(...)`
- `resolverValorUnitario(...)`
- `createOperacaoProducao(...)`
- `getLancamentosDoDia(...)`
- `getResumoDoDia(...)`

## Fase 4 — Refatoração da tela `/producao`

Refatorar [src/pages/LancamentoProducao.tsx](/abs/y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/LancamentoProducao.tsx) em vez de criar uma página paralela.

### Blocos da refatoração

#### 4.1 Estado do formulário

Trocar o shape atual por um modelo coerente com a feature:

- ids relacionais em vez de texto livre
- `data_operacao`
- `tipo_servico_id`
- `colaborador_id`
- `transportadora_id`
- `fornecedor_id`
- `produto_carga_id`
- `forma_pagamento_id` ou código equivalente
- `quantidade`
- `entrada_ponto`
- `saida_ponto`
- `placa`

#### 4.2 Queries dependentes

Encadear buscas com `react-query`:

1. carregar contexto do usuário
2. carregar unidades liberadas
3. carregar tipos de serviço
4. ao mudar tipo de serviço, filtrar transportadoras e fornecedores
5. ao mudar fornecedor, carregar produtos e resolver preço
6. ao mudar quantidade, recalcular preview

#### 4.3 Cálculo local do preview

Implementar helper puro:

- `calcularTotalPrevisto({ quantidade, valorUnitario, tipoCalculo, colaboradores })`

Regras:

- por volume: `quantidade * valor_unitario`
- operação fixa: `valor_unitario`
- por colaborador: `qtde_colaboradores * valor_unitario`

#### 4.4 Validação

Recomendação: usar `react-hook-form` + `zod` para consolidar validação.

Validações mínimas:

- unidade obrigatória
- data obrigatória
- tipo de serviço obrigatório
- colaborador obrigatório
- transportadora obrigatória
- fornecedor obrigatório
- produto/carga obrigatório quando aplicável
- quantidade > 0
- valor unitário resolvido
- horário consistente quando preenchido
- justificativa obrigatória para data retroativa, se a regra exigir

#### 4.5 Estados visuais

Adicionar estados explícitos:

- carregando contexto
- carregando preço
- sem preço cadastrado
- sem lançamentos no dia
- erro de permissão
- sucesso ao registrar

## Fase 5 — Ajustes de UI conforme o Styleguide

### Componentes a priorizar

- `Card`
- `Button`
- `Input`
- `Label`
- `Select`
- `Badge`
- `Table`

### Padrões visuais recomendados

- labels curtas e consistentes
- altura de campos `h-11` ou `h-12`
- cards com `rounded-xl`
- destaque do CTA principal em `bg-brand`
- cards informativos em `bg-muted/20` ou variações soft de estado
- badges coloridos para status operacionais

### Melhorias diretas sobre a tela atual

- trocar `Produto / Carga` livre por dois campos: `Fornecedor` e `Produto / Carga`
- trocar `Valor Unitário (Opt.)` por `Valor Unitário` com chip `Automático`
- adicionar `Forma de pagamento`
- adicionar `Placa do veículo`
- adicionar `Total previsto`
- remover dependência de digitação manual para campos governados por cadastro

## Fase 6 — Regras de negócio e consistência

### Regras obrigatórias do MVP

- encarregado não altera valor unitário
- sem valor cadastrado, não salva
- colaborador precisa estar ativo
- unidade deve respeitar escopo do usuário
- data retroativa pode exigir justificativa
- registro salvo com status inicial coerente, preferencialmente `pendente` ou `aguardando_validacao`

### Regras pós-MVP

- cruzar ponto real com `entrada_ponto` e `saida_ponto`
- alerta de quantidade fora da curva histórica
- múltiplos colaboradores por registro
- edição controlada de registros ainda não fechados
- envio para validação com trilha de auditoria

## Fase 7 — Compatibilidade e migração de legado

Como a tela atual usa `operacoes`, existem duas rotas possíveis:

### Opção recomendada

Criar `operacoes_producao` e migrar a tela para ela.

Vantagens:

- reduz risco de quebrar relatórios legados
- permite evolução sem contorcer a tabela antiga
- separa claramente o lançamento operacional novo do modelo simplificado inicial

### Opção alternativa

Expandir a tabela `operacoes`.

Risco:

- tende a misturar legado e nova regra operacional
- aumenta chance de regressão em telas já conectadas a `operacoes`

Conclusão:

- seguir com `operacoes_producao`
- manter `operacoes` apenas enquanto dependências antigas existirem

## Fase 8 — Testes e validação

### Testes funcionais

- criar lançamento com preço resolvido
- bloquear lançamento sem regra financeira
- filtrar transportadoras por tipo de serviço
- filtrar fornecedores por tipo de serviço
- recalcular preview ao alterar quantidade
- listar lançamentos do dia correto
- consolidar resumo do dia

### Testes de permissão

- encarregado não vê outra unidade
- encarregado não altera valor unitário
- encarregado não atualiza registro fechado

### Testes de interface

- estado vazio de lançamentos
- estado de loading de selects dependentes
- mensagem de bloqueio por ausência de cadastro
- responsividade mobile

## Sequência recomendada de execução

1. criar migration de domínio operacional
2. atualizar tipos do banco
3. criar serviços de lookup e gravação
4. refatorar formulário da tela
5. refatorar listagem e resumo do dia
6. aplicar validações e estados de bloqueio
7. validar RLS e permissões
8. testar fluxo completo com usuário encarregado

## Entregáveis

### Frontend

- tela `/producao` refatorada
- formulário guiado com selects dependentes
- preview de cálculo
- listagem do dia e resumo do dia aderentes à feature

### Backend/Supabase

- migration nova com `operacoes_producao` e `fornecedor_valores_servico`
- RLS por unidade
- RPC/view para resolução de valor unitário e resumo diário
- tipos atualizados do banco

### Operação

- fluxo sem cálculo manual
- bloqueio quando cadastro financeiro estiver incompleto
- base pronta para conferência, financeiro e relatórios

## Riscos e pontos de atenção

- hoje o projeto ainda não mostra cadastros explícitos para `fornecedores`, `transportadoras/clientes`, `produtos/carga` e `formas_pagamento`; isso pode exigir criação paralela ou adaptação de estruturas existentes
- a geração de tipos e a aplicação da migration via Supabase MCP não puderam ser executadas nesta sessão porque a ferramenta MCP correspondente não está disponível aqui
- o uso atual de `useMemo` para efeito colateral em `LancamentoProducao.tsx` deve ser corrigido na implementação, preferencialmente com `useEffect`

## Recomendação final

Implementar essa feature como evolução estrutural da tela atual, não como remendo incremental no formulário existente.

Resumo da decisão técnica:

- manter a rota `/producao`
- refatorar `LancamentoProducao.tsx`
- criar nova tabela `operacoes_producao`
- resolver preço por regra no Supabase
- deixar `Valor Unitário` sempre automático e imutável para o encarregado

---

Documento gerado em `2026-04-28`.
