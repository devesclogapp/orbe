---
description: 
---

# PROMPT PARA IMPLEMENTAÇÃO — PRODUÇÃO IN-LOCO / ENGINE DE VALIDAÇÃO OPERACIONAL

Você é o Codex da OpenAI atuando como assistente de desenvolvimento no Antigravity.

Contexto:
Estou desenvolvendo o ERP Orbe. A rota atual da tela é:

/producao

Essa tela é usada pelo perfil ENCARREGADO para registrar operações in-loco como carga, descarga, transbordo e movimentações. A tela já possui um formulário visualmente estruturado, mas precisa ser refinada para funcionar com lógica operacional real, validações fortes e cálculo automático baseado em regras cadastradas previamente pelo Admin ou Financeiro.

Objetivo:
Implementar uma versão mais segura, guiada e profissional da tela Produção In-Loco, garantindo que o encarregado apenas registre os dados operacionais e nunca edite valores financeiros sensíveis.

---

# 1. PRINCÍPIO CENTRAL DA FEATURE

O valor unitário da operação NÃO deve ser digitado pelo encarregado.

O valor unitário deve vir automaticamente de uma regra previamente cadastrada no ERP pelo Admin ou Financeiro, com base em:

- empresa/unidade
- tipo de serviço
- transportadora/cliente, se aplicável
- fornecedor
- produto/carga, se aplicável
- tipo de cálculo
- vigência da regra
- status ativo/inativo

O encarregado apenas seleciona os campos operacionais. O sistema busca a regra e calcula automaticamente o total previsto.

---

# 2. AJUSTES OBRIGATÓRIOS NA TELA /producao

## 2.1 Campo Valor Unitário

O campo Valor Unitário deve ser somente leitura.

Substituir qualquer comportamento editável por um estado automático.

Estados possíveis:

1. Aguardando regra
- Quando fornecedor ainda não foi selecionado.
- Texto sugerido:
  "Aguardando regra"

2. Buscando regra
- Quando o sistema está consultando a regra.
- Texto sugerido:
  "Buscando valor..."

3. Regra encontrada
- Quando a regra for localizada.
- Exibir:
  "R$ 0,35 por volume"
  ou
  "R$ 120,00 por diária"
  ou
  "R$ 80,00 por operação"

4. Regra não configurada
- Quando não existir regra válida.
- Exibir:
  "Fornecedor sem valor cadastrado"

---

# 3. BLOQUEIO DE REGISTRO

O botão "Registrar Produção" deve ficar DESABILITADO quando:

- empresa não estiver selecionada
- data não estiver preenchida
- tipo de serviço não estiver selecionado
- colaborador não estiver selecionado
- transportadora/cliente não estiver selecionado
- fornecedor não estiver selecionado
- produto/carga for obrigatório e não estiver selecionado
- quantidade estiver vazia, zero ou negativa
- forma de pagamento não estiver selecionada
- valor unitário não estiver configurado
- regra operacional não for encontrada
- houver erro na busca da regra
- horário de saída for menor que horário de entrada, quando ambos forem informados

Quando o botão estiver desabilitado por ausência de regra, exibir aviso:

"Fornecedor sem valor cadastrado. Solicite ao Admin ou Financeiro o cadastro da regra operacional."

---

# 4. FLUXO GUIADO DO FORMULÁRIO

O formulário deve respeitar a seguinte ordem lógica:

1. Empresa
2. Data
3. Tipo de serviço
4. Colaborador
5. Transportadora / Cliente
6. Fornecedor
7. Produto / Carga
8. Quantidade
9. Forma de pagamento
10. Placa do veículo
11. Preview de cálculo
12. Registrar produção

Regras de habilitação:

- Transportadora / Cliente só deve ser habilitada após selecionar Tipo de Serviço.
- Fornecedor só deve ser habilitado após selecionar Tipo de Serviço e Transportadora / Cliente.
- Produto / Carga só deve ser habilitado após selecionar Fornecedor.
- Quantidade só deve ser habilitada quando uma regra válida for encontrada ou quando o tipo de cálculo exigir quantidade.
- Valor unitário sempre bloqueado.
- Preview de cálculo deve atualizar automaticamente.

---

# 5. LÓGICA DE CASCATA

Ao selecionar Tipo de Serviço:

- limpar transportadora selecionada
- limpar fornecedor selecionado
- limpar produto/carga selecionado
- limpar valor unitário
- limpar regra encontrada
- limpar preview de cálculo
- carregar transportadoras/clientes compatíveis com o tipo de serviço

Ao selecionar Transportadora / Cliente:

- limpar fornecedor selecionado
- limpar produto/carga selecionado
- limpar valor unitário
- limpar regra encontrada
- limpar preview de cálculo
- carregar fornecedores compatíveis com tipo de serviço + transportadora/cliente

Ao selecionar Fornecedor:

- limpar produto/carga selecionado, se necessário
- buscar produtos/cargas compatíveis
- buscar regra operacional válida
- preencher valor unitário automaticamente
- definir tipo de cálculo
- atualizar preview

Ao selecionar Produto / Carga:

- buscar novamente a regra, se a regra depender do produto/carga
- atualizar valor unitário
- atualizar preview

Ao alterar Quantidade:

- recalcular total previsto em tempo real

---

# 6. PREVIEW DE CÁLCULO

O card "Preview de Cálculo" deve ser mais claro e forte.

Exibir:

- tipo de cálculo
- valor unitário
- quantidade considerada
- total previsto
- status da regra

Exemplo com regra encontrada:

Tipo de cálculo: Por volume
Valor unitário: R$ 0,35
Quantidade: 1.000
Total previsto: R$ 350,00
Status: Regra ativa

Exemplo sem regra:

Tipo de cálculo: Não definido
Valor unitário: Não configurado
Total previsto: R$ 0,00
Status: Registro bloqueado

O total previsto deve ser calculado em tempo real.

---

# 7. TIPOS DE CÁLCULO SUPORTADOS

Implementar suporte inicial aos seguintes tipos:

## 7.1 Por volume

Formula:

valor_total = quantidade * valor_unitario

Exemplo:

quantidade = 1000
valor_unitario = 0.35
valor_total = 350.00

Label do campo quantidade:

"Quantidade de volumes"

## 7.2 Por diária

Formula:

valor_total = quantidade * valor_unitario

Neste caso, quantidade representa número de diárias.

Label do campo quantidade:

"Quantidade de diárias"

## 7.3 Por operação

Formula:

valor_total = valor_unitario

Neste caso, quantidade pode ser automaticamente 1.

Label do campo quantidade:

"Quantidade de operações"

## 7.4 Por colaborador

Formula:

valor_total = quantidade_colaboradores * valor_unitario

Caso ainda não exista múltipla seleção de colaboradores, manter estrutura pronta para evolução futura.

Label:

"Quantidade de colaboradores"

---

# 8. SNAPSHOT FINANCEIRO

Ao salvar a produção, o sistema deve gravar um snapshot do valor usado no momento do registro.

Nunca calcular o histórico apenas consultando a tabela atual de valores, pois os preços podem mudar no futuro.

Salvar no lançamento:

- rule_id
- valor_unitario_snapshot
- tipo_calculo_snapshot
- quantidade_snapshot
- valor_total_snapshot
- fornecedor_id
- tipo_servico_id
- transportadora_id
- produto_carga_id, se existir
- empresa_id
- data_operacao
- criado_por

---

# 9. TABELAS / ESTRUTURA ESPERADA

Verificar a estrutura atual do banco antes de criar novas tabelas.

Caso ainda não exista, propor ou implementar as seguintes tabelas.

## 9.1 operational_service_rules

Tabela responsável por armazenar as regras financeiras operacionais.

Campos sugeridos:

- id uuid primary key
- company_id uuid not null
- service_type_id uuid not null
- carrier_id uuid nullable
- supplier_id uuid not null
- product_cargo_id uuid nullable
- calculation_type text not null
- unit_value numeric(12,4) not null
- active boolean default true
- valid_from date not null
- valid_until date nullable
- created_by uuid nullable
- created_at timestamptz default now()
- updated_at timestamptz default now()

Valores permitidos para calculation_type:

- volume
- daily
- operation
- collaborator

Regra de vigência:

Uma regra válida deve ser:
- active = true
- valid_from <= data_operacao
- valid_until is null OR valid_until >= data_operacao

---

## 9.2 production_entries

Tabela de lançamentos da produção.

Campos sugeridos:

- id uuid primary key
- company_id uuid not null
- operation_date date not null
- service_type_id uuid not null
- collaborator_id uuid not null
- carrier_id uuid not null
- supplier_id uuid not null
- product_cargo_id uuid nullable
- payment_method_id uuid nullable
- vehicle_plate text nullable
- entry_time time nullable
- exit_time time nullable
- quantity numeric(12,2) not null
- rule_id uuid not null
- unit_value_snapshot numeric(12,4) not null
- calculation_type_snapshot text not null
- total_value_snapshot numeric(12,2) not null
- status text default 'registered'
- created_by uuid not null
- created_at timestamptz default now()
- updated_at timestamptz default now()

Status sugeridos:

- registered
- pending_review
- blocked
- cancelled
- approved

---

# 10. FUNÇÃO DE BUSCA DA REGRA

Criar uma função clara no frontend ou backend para buscar a regra operacional.

Nome sugerido:

findOperationalServiceRule

Entrada:

- companyId
- serviceTypeId
- carrierId
- supplierId
- productCargoId
- operationDate

Comportamento:

1. Buscar regra ativa mais específica.
2. Priorizar regra com product_cargo_id preenchido.
3. Se não encontrar, buscar regra geral do fornecedor para aquele tipo de serviço.
4. Respeitar vigência.
5. Retornar erro controlado se não existir regra.

Prioridade sugerida:

1. company + service_type + carrier + supplier + product_cargo
2. company + service_type + carrier + supplier
3. company + service_type + supplier
4. company + service_type

Não permitir resultado ambíguo. Se houver duas regras válidas concorrentes, exibir erro:

"Existem regras duplicadas para este fornecedor. Solicite revisão ao Financeiro."

---

# 11. MENSAGENS DE ERRO E FEEDBACK

Implementar mensagens claras:

## Sem regra

"Fornecedor sem valor cadastrado. Solicite ao Admin ou Financeiro o cadastro da regra operacional."

## Regra duplicada

"Existem regras duplicadas para esta combinação. Solicite revisão ao Financeiro."

## Quantidade inválida

"Informe uma quantidade maior que zero."

## Horário inválido

"O horário de saída não pode ser menor que o horário de entrada."

## Produto obrigatório

"Selecione o produto/carga para localizar a regra operacional."

## Registro salvo

"Produção registrada com sucesso."

---

# 12. MELHORIAS VISUAIS

Aplicar os seguintes ajustes na UI atual:

1. No campo Valor Unitário:
- manter badge "Automático"
- quando sem regra, usar estado visual de alerta
- quando regra encontrada, usar estado visual positivo

2. No Preview de Cálculo:
- destacar o total previsto
- exibir o tipo de cálculo em badge
- exibir status da regra
- exibir "Registro bloqueado" quando não houver regra

3. No botão Registrar Produção:
- quando desabilitado, mostrar visual claramente inativo
- quando habilitado, manter CTA laranja

4. No Fornecedor:
- transformar em campo de largura inteira, se possível
- Produto/Carga pode ficar abaixo

5. Na Quantidade:
- label deve mudar de acordo com calculation_type:
  - volume: Quantidade de volumes
  - daily: Quantidade de diárias
  - operation: Quantidade de operações
  - collaborator: Quantidade de colaboradores

---

# 13. LISTA DE LANÇAMENTOS DO DIA

Atualizar o card "Lançamentos do Dia" após salvar um registro.

Cada lançamento deve exibir:

- tipo de serviço
- colaborador
- transportadora/cliente
- fornecedor
- produto/carga, se houver
- quantidade
- valor unitário
- valor total
- status
- horário do lançamento

Estado vazio atual pode ser mantido:

"Nenhuma produção lançada hoje. Inicie um novo registro no formulário ao lado."

---

# 14. RESUMO DE HOJE

Atualizar o card "Resumo de Hoje" com:

- total de lançamentos
- quantidade total
- valor total produzido
- colaboradores envolvidos
- pendências/bloqueios

---

# 15. SEGURANÇA E PERMISSÕES

O perfil ENCARREGADO pode:

- criar produção
- visualizar lançamentos da sua empresa/unidade
- visualizar lançamentos do dia
- editar apenas registros não fechados, se a regra atual permitir

O perfil ENCARREGADO não pode:

- editar valor unitário
- criar regra operacional
- editar regra operacional
- cadastrar fornecedor
- cadastrar transportadora
- alterar lançamento aprovado ou fechado
- visualizar dados de outras empresas/unidades

Admin e Financeiro podem cadastrar ou revisar regras operacionais em tela própria.

---
# 16. CRITÉRIOS DE ACEITE

A implementação será considerada correta quando:
