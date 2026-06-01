---
trigger: always_on
---

# PROMPT MASTER — AUDITORIA, CORREÇÃO E IMPLEMENTAÇÃO INTELIGENTE DO ERP ORBE

Você atuará como **arquiteto técnico, auditor de fluxos, QA operacional e engenheiro de estabilização** do ERP Orbe.

O objetivo NÃO é refatorar cegamente.

O objetivo é:

1. Entender a estrutura atual.
2. Mapear pontos exatos de correção.
3. Identificar o que ainda falta implementar.
4. Corrigir e implementar por etapas.
5. Validar todos os fluxos por tipo de input.
6. Auditar segurança, tenants, permissões, redundâncias, bugs e robustez.

---

# 0. CONTEXTO DO NEGÓCIO

O Orbe é um ERP de **operações logísticas**, onde RH e Financeiro existem para dar suporte ao fluxo operacional.

O sistema deve controlar:

* entrada de dados operacionais
* processamento
* validação RH
* aprovação financeira
* faturamento
* custos
* pagamentos
* CNAB
* conciliação
* relatórios
* DRE operacional
* auditoria

A lógica macro do Orbe é:

CAPTURA
→ PROCESSAMENTO
→ RH
→ FINANCEIRO
→ BANCÁRIO/CNAB
→ CONCILIAÇÃO
→ RELATÓRIOS
→ AUDITORIA

---

# 1. TIPOS DE INPUT DO ORBE

Existem dois grandes canais de entrada.

## 1.1 Input automático

### Pontos CLT

Origem:

Coletor de ponto
→ automação diária às 7h
→ importa pontos do dia anterior
→ Orbe

O ponto possui:

* entrada da manhã
* saída para almoço
* retorno do almoço
* saída final

Finalidade:

* calcular jornada
* faltas
* horas extras
* banco de horas
* compensações
* descontos
* folha mensal CLT

Importante:

Ponto CLT não é operação faturável.

Ele pertence ao domínio de RH / banco de horas / folha.

---

## 1.2 Inputs do encarregado

O encarregado possui acesso próprio, separado do admin/RH/financeiro.

Ele lança:

1. Operações por Volume
2. Serviços Específicos
3. Serviços Extras
4. Custos Extras
5. Diaristas

Esses lançamentos usam dados previamente cadastrados no Orbe:

* empresas
* unidades
* colaboradores
* transportadoras
* fornecedores
* produtos
* serviços
* formas de pagamento
* taxas
* impostos
* regras operacionais

---

# 2. PAPÉIS DE USUÁRIOS E ACESSOS

## Admin

Responsável por:

* cadastrar usuários
* convidar RH
* convidar financeiro
* convidar encarregados
* configurar sistema
* cadastrar empresas
* cadastrar colaboradores
* cadastrar fornecedores
* cadastrar transportadoras
* cadastrar produtos
* cadastrar taxas e impostos
* definir permissões
* auditar sistema

## RH

Responsável por:

* validar diaristas
* validar pontos
* processar banco de horas
* conferir cadastros de colaboradores
* aprovar ou devolver inconsistências
* fechar ciclos RH

## Financeiro

Responsável por:

* aprovar pagamentos
* controlar faturamento
* controlar despesas
* gerar CNAB
* acompanhar remessas
* importar retorno bancário
* conciliar pagamentos
* gerar relatórios financeiros

## Encarregado

Responsável por:

* lançar operações por volume
* lançar serviços específicos
* lançar serviços extras
* lançar custos extras
* lançar presença de diaristas
* informar colaboradores envolvidos
* informar empresa, produto, serviço, transportadora, fornecedor, forma de pagamento e observações

O encarregado NÃO deve acessar áreas administrativas, financeiras ou de governança.

---

# 3. DEFINIÇÕES CONCEITUAIS OBRIGATÓRIAS

Antes de alterar o código, validar se o sistema usa corretamente os conceitos abaixo.

## Lançamento

Menor unidade registrada no sistema.

Exemplos:

* uma operação por volume
* um apontamento de ponto
* uma diária
* um custo extra
* um serviço extra
* um serviço específico

## Operação

Atividade logística realizada para uma empresa.

Exemplos:

* descarga
* carregamento
* transbordo
* movimentação
* conserto de pallet
* serviço específico

## Ciclo

Período de apuração.

Exemplos:

* semana dos diaristas
* competência mensal CLT
* período financeiro
* período de faturamento

## Lote

Conjunto processável de lançamentos.

Exemplos:

* lote de diaristas semanal
* lote CNAB
* lote de faturamento mensal
* lote de folha
* lote financeiro

Regra importante:

Não chamar lançamento individual de lote.

Se a tela estiver mostrando registros individuais, usar “lançamentos”.

Se estiver mostrando agrupamento, usar “lotes”.

---

# 4. MOTORES OPERACIONAIS DO ORBE

O sistema possui múltiplos motores.

## 4.1 Operações por Volume

Fluxo:

Encarregado
→ lança operação
→ seleciona empresa
→ seleciona transportadora
→ seleciona fornecedor
→ seleciona produto/serviço
→ informa volume
→ informa valor unitário
→ informa forma de pagamento
→ seleciona colaboradores envolvidos
→ salva
→ Orbe calcula valor da operação

Regra:

Valor da operação = volume × valor unitário

Também podem existir:

* ISS
* filme stretch
* custos extras
* serviços adicionais
* forma de pagamento à vista
* boleto
* pagamento mensal

Validar:

* operação salva corretamente
* colaboradores vinculados são persistidos
* colaboradores aparecem na expansão da operação
* forma de pagamento é resolvida corretamente
* empresa, unidade, fornecedor e transportadora aparecem corretamente
* valor bruto, impostos, custos e valor líquido são calculáveis

---

## 4.2 Serviços Específicos

Exemplos:

CN5C = Carregamento Noturno com 5 colaboradores
CN4C = Carregamento Noturno com 4 colaboradores
N1 = Primeiro Período Noturno
N2 = Segundo Período Noturno

Esses serviços são tabelados por regra operacional.

Fluxo:

Encarregado
→ seleciona serviço específico
→ seleciona período
→ informa quantidade de colaboradores
→ sistema calcula subtotal/total conforme regra cadastrada

Validar se existe estrutura para:

* código do serviço
* descrição
* período
* quantidade de colaboradores
* valor tabelado
* valor por período
* valor total
* vínculo com colaboradores
* vínculo com empresa
* vínculo com faturamento

---

## 4.3 Diaristas

Fluxo:

Encarregado
→ marca presença semanal
→ indica presença, falta, meia diária ou horas
→ fecha período/ciclo semanal
→ sistema gera lote semanal
→ RH valida
→ financeiro aprova
→ CNAB é gerado
→ retorno bancário concilia
→ lote fica pago/concluído

Diaristas recebem semanalmente.

O pagamento nasce da presença/ciclo, não de lançamento financeiro manual.

Validar:

* ciclo semanal
* fechamento de período
* lote de diaristas
* validação RH
* aprovação financeira
* CNAB
* retorno conciliado
* status PAGO somente após retorno/conciliação
* histórico operacional

---

## 4.4 Pontos CLT / Banco de Horas

Fluxo:

Coletor
→ automação diária às 7h
→ importa pontos do dia anterior
→ RH processa
→ banco de horas calcula
→ folha mensal consolida

Validar:

* importação diária
* pontos do dia anterior
* entrada/saída/retorno/saída final
* horas trabalhadas
* carga horária contratual
* saldo positivo
* saldo negativo
* falta
* atraso
* compensação
* banco de horas
* folha mensal

Pendente de descoberta:

* quando hora vira pagamento
* quando vira compensação
* quando vira desconto
* validade do banco de horas

Não implementar regra definitiva sem confirmação.

---

## 4.5 Custos Extras

Custos extras representam despesas administrativas ou operacionais.

Exemplos:

* lanche
* ferramentas
* telefone
* crédito
* energia
* botas
* EPIs
* uniformes
* conserto de paleteira
* compra de materiais
* custos com fornecedor

Validar:

* quem lança
* qual empresa recebe o custo
* qual categoria
* se é custo operacional ou administrativo
* se impacta DRE
* se impacta margem da operação
* se precisa aprovação
* se vira conta a pagar
* se aparece em relatórios por empresa

---

## 4.6 Serviços Extras

Serviços extras são serviços realizados fora da operação padrão.

Exemplos:

* conserto de pallet
* pintura de pallet
* transbordo
* movimentação extraordinária
* apoio logístico

Validar:

* se são faturáveis
* se são despesas
* se geram pagamento para colaboradores
* se compõem faturamento da empresa
* se possuem regra própria
* se entram no financeiro como receita

---

# 5. FATURAMENTO, PAGAMENTO E RESULTADO

O Orbe deve separar claramente:

## Receita / Faturamento

Valores que a empresa vai receber dos clientes.

Exemplos:

* operação por volume
* serviços específicos
* serviços extras faturáveis
* transbordos
* adicionais

## Despesas / Pagamentos

Valores que a empresa vai pagar.

Exemplos:

* diaristas
* intermitentes
* CLT
* custos extras
* fornecedores
* despesas operacionais

## Resultado

O Orbe deve permitir calcular:

Receita Bruta
(-) ISS
(-) custos extras
(-) serviços terceirizados
(-) mão de obra
(-) despesas administrativas
= Resultado operacional

---

# 6. CADASTRO DE COLABORADORES E REMUNERAÇÃO

Verificar o cadastro atual de colaboradores.

Ele já possui:

* tipo de colaborador
* modelo de cálculo
* salário base
* dados bancários
* gera faturamento

Avaliar necessidade de incluir ou corrigir:

* participa de produção operacional
* participa de rateio
* peso operacional
* modelo de remuneração
* valor por diária
* valor por hora
* valor por operação
* percentual fixo
* vínculo com cargo/função
* regra individual de pagamento

Importante:

A remuneração não deve ser calculada manualmente dentro da operação se puder ser derivada do cadastro do colaborador e das regras operacionais.

---

# 7. REGRAS OPERACIONAIS

Auditar a tela de regras operacionais.

Ela deve suportar:

* operações por volume
* serviços específicos
* diaristas
* meios de pagamento
* taxas e impostos
* rateio operacional
* tabela de preços por fornecedor/transportadora/produto
* tabela de serviços por código

Implementar apenas se faltar:

## Tabela de Serviços Específicos

Campos sugeridos:

* código
* descrição
* tipo de serviço
* período
* quantidade de colaboradores
* valor padrão
* empresa vinculada
* ativo/inativo

Exemplo:

CN5C
Carregamento Noturno com 5 Colaboradores
Período N1
Valor R$ X

---

# 8. PIPELINE OPERACIONAL

A tela Pipeline Operacional NÃO deve ser uma tabela de lançamentos.

Ela deve ser uma torre de controle.

Ela deve responder:

* o que entrou
* onde está
* quem está segurando
* qual etapa está atrasada
* quanto dinheiro está parado
* qual empresa tem gargalo
* qual fluxo está travado

Remover redundância com telas de entrada.

Exibir:

* total de lançamentos
* total de lotes
* valor total
* horas totais
* atrasados
* SLA médio
* valor processado
* gargalos por etapa
* gargalos por empresa
* gargalos por responsável
* pendências críticas
* distribuição por tipo
* distribuição por empresa
* distribuição por competência

Não repetir lista de lançamentos que já existe nas telas especialistas.

---

# 9. ETAPA 1 — IDENTIFICAR ESTRUTURA ATUAL DO PROJETO

Primeiro, mapear:

* rotas
* telas
* componentes
* services
* hooks
* stores
* contexts
* tabelas Supabase
* migrations
* policies RLS
* edge functions
* queries principais
* fluxo de autenticação
* controle de tenants
* permissões por perfil

Gerar relatório:

.agent/orbe_audit_estrutura_atual.md

O relatório deve conter:

* mapa de pastas
* mapa de rotas
* módulos existentes
* tabelas utilizadas
* services principais
* dependências críticas
* riscos de regressão
* pontos com duplicidade
* pontos com alto acoplamento

---

# 10. ETAPA 1.1 — VERIFICAR NECESSIDADE DE REFATORAÇÃO

Não refatorar imediatamente.

Antes, classificar:

## Sem refatoração

Código funcional, seguro e compreensível.

## Refatoração leve

Nomes, componentes, organização visual, pequenas duplicações.

## Refatoração média

Services com responsabilidades misturadas, queries duplicadas, hooks redundantes.

## Refatoração crítica

Lógica de negócio duplicada, status divergentes, rotas quebradas, falha de segurança, tenant leak.

Gerar relatório:

.agent/orbe_refactor_assessment.md

Toda sugestão deve conter:
* arquivo
* problema
* risco
* impacto
* prioridade
* plano seguro de correção

---

# 11. ETAPA 2 — MAPEAR CORREÇÕES EXATAS

Mapear, por módulo:

## Operações por Volume

* colaboradores vinculados
* cálculo de valor
* forma de pagamento
* ISS
* filme stretch
* custos extras
* serviços extras agregados
* faturamento
* pagamento dos colaboradores

## Diaristas

* ciclo semanal
* presença
* valor diário
* fechamento
* RH
* financeiro
* CNAB
* retorno

## Pontos CLT

* importação
* jornada
* banco