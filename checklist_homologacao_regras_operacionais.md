# Checklist de Homologação — Regras Operacionais

## Pré-requisito

- Aplicar a migration `supabase/migrations/20260428213000_regras_operacionais_forma_pagamento.sql`.

## Acesso

- Acessar `/cadastros/regras-operacionais` com usuário `Admin`.
- Acessar `/cadastros/regras-operacionais` com usuário `Financeiro`.
- Confirmar que outros perfis veem bloqueio de acesso.

## Cadastro rápido

- Em `Transportadora / Cliente`, digitar um nome inexistente.
- Confirmar exibição da ação `Cadastrar novo`.
- Salvar o cadastro rápido com `Nome`, `Tipo` e `CNPJ` opcional.
- Verificar se o item recém-criado fica selecionado automaticamente.

- Em `Fornecedor`, digitar um nome inexistente.
- Confirmar exibição da ação `Cadastrar novo`.
- Salvar o cadastro rápido com `Nome` e `CNPJ` opcional.
- Verificar se o item recém-criado fica selecionado automaticamente.

- Em `Produto / Carga`, selecionar um fornecedor e digitar um nome inexistente.
- Confirmar exibição da ação `Cadastrar novo`.
- Salvar o cadastro rápido com `Nome` e `Categoria` opcional.
- Verificar se o item recém-criado fica selecionado automaticamente.

- Em `Forma de pagamento padrão`, digitar um nome inexistente.
- Confirmar exibição da ação `Cadastrar novo`.
- Salvar o cadastro rápido.
- Verificar se o item recém-criado fica selecionado automaticamente.

## Duplicidade

- Tentar cadastrar `Ponteland` quando `PONTELAND` já existir.
- Confirmar alerta de similaridade.
- Confirmar que existe opção de usar o cadastro existente.

- Tentar cadastrar `Mira Transportes` quando `Mira` já existir.
- Confirmar alerta de similaridade antes de salvar.

## Regra operacional

- Criar regra com:
  Empresa, Tipo de serviço, Transportadora, Fornecedor, Produto/Carga, Tipo de cálculo, Valor unitário, Vigência inicial e Status.
- Confirmar gravação com sucesso.
- Confirmar exibição da regra na tabela.

- Tentar criar outra regra ativa com a mesma combinação e vigência sobreposta.
- Confirmar bloqueio por duplicidade.

- Editar uma regra existente.
- Confirmar persistência das alterações.

- Inativar uma regra existente.
- Confirmar mudança de status na listagem.

## Reflexo em Produção

- Abrir `/producao`.
- Confirmar que a nova transportadora aparece no campo correspondente.
- Confirmar que o novo fornecedor aparece no campo correspondente.
- Confirmar que o novo produto/carga aparece após selecionar o fornecedor correto.

- Selecionar a mesma combinação usada na regra operacional.
- Confirmar preenchimento automático de `Valor Unitário`.
- Confirmar preenchimento automático da `Forma de pagamento`, quando houver padrão.
- Confirmar que o botão `Registrar Produção` fica habilitado quando não houver outras pendências.

## Falha esperada sem regra

- Selecionar combinação sem regra cadastrada.
- Confirmar mensagem `Fornecedor sem valor cadastrado`.
- Confirmar bloqueio do botão `Registrar Produção`.
