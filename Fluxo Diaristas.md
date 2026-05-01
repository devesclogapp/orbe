````md
# IMPLEMENTAÇÃO — MÓDULO DIARISTAS OPERACIONAL + RH

## Contexto

No ERP Orbe, o usuário operacional Carlos acessará o sistema pelo caminho:

`http://localhost:8080/producao`

Carlos deverá ter login criado pelo Admin, com vínculo de usuário e função específica.

Ele só poderá acessar a opção:

- Diaristas

Todas as outras opções da tela de produção deverão ficar bloqueadas.

---

# 1. Regra de Acesso

## Perfil do Carlos

Criar/usar o perfil:

`encarregado_diaristas`

Permitir acesso apenas a:

```txt
/producao
/producao/diaristas
````

Bloquear acesso a:

```txt
Descarga pgto. imediato (CAIXA)
Descarga corporativa (BOLETO)
Operações com a DISMELO
Transbordo e Serviço Extra
Custos (CLT)
```

## Comportamento visual

Na tela `/producao`:

* Card **Diaristas** ativo
* Demais cards desabilitados
* Cards bloqueados com aparência opaca/cinza
* Ao clicar em card bloqueado, exibir:

```txt
Você não tem permissão para acessar este lançamento.
```

---

# 2. Cadastro Base pelo RH

Os diaristas NÃO serão cadastrados pelo Carlos.

O RH será responsável por cadastrar e manter os diaristas, funções e valores.

Criar tela:

```txt
/rh/diaristas/cadastros
```

## Campos do cadastro

```txt
Nome completo
CPF
Telefone
Função
Valor da diária
Status: ativo/inativo
Empresa vinculada
Observações
```

## Funções possíveis

```txt
Diarista
Auxiliar de carga
Ajudante
Conferente
Operador eventual
Serviço extra
```

## Permissões do RH

O RH pode:

```txt
Cadastrar diaristas
Editar função
Alterar valor da diária
Ativar/inativar diarista
Consultar histórico
Fechar período para pagamento
Exportar planilha quinzenária
```

---

# 3. Tela Operacional — Diaristas

Criar rota:

```txt
/producao/diaristas
```

## Objetivo

Substituir a aba DIARISTAS da planilha 01 JANEIRO.

Carlos deverá registrar diariamente quem trabalhou, usando marcações simples.

---

# 4. Regra de carregamento dos diaristas

Na tela `/producao/diaristas`, o formulário de Carlos deverá puxar automaticamente apenas os diaristas:

```txt
Cadastrados pelo RH
Ativos
Vinculados à mesma empresa do usuário logado
Permitidos para lançamento operacional
```

Carlos NÃO pode:

```txt
Cadastrar diarista
Editar diarista
Editar função
Alterar valor da diária
Excluir diarista
Fechar pagamento
```

---

# 5. Fluxo da Tela do Carlos

## Etapa 1 — Dados do lançamento

Campos:

```txt
Data do lançamento
Cliente/Unidade
Operação/Serviço
Encarregado responsável
Observações gerais
```

O campo `Encarregado responsável` deve vir automaticamente do usuário logado.

---

## Etapa 2 — Lista de diaristas

Exibir lista dos diaristas cadastrados pelo RH.

Cada linha deve ter:

```txt
Nome do diarista
CPF ou identificador
Função
Valor da diária
Botões de marcação:
- Ausente
- P
- MP
Campo de observação
Valor gerado no dia
```

---

# 6. Regras de Marcação

```txt
P = diária completa
MP = meia diária
Ausente = sem valor
```

O valor deve ser calculado automaticamente com base no valor da diária cadastrado pelo RH.

Exemplo:

```txt
Valor da diária: R$ 120,00

P = R$ 120,00
MP = R$ 60,00
Ausente = R$ 0,00
```

---

# 7. Resumo em tempo real

Na lateral ou rodapé da tela, exibir:

```txt
Total de diaristas listados
Total de presentes
Total de meias diárias
Total de ausentes
Valor total gerado no dia
```

---

# 8. Salvamento dos lançamentos

Ao clicar em salvar, criar registros individuais para cada diarista marcado como `P` ou `MP`.

Cada registro deve salvar:

```txt
id
empresa_id
colaborador_id
nome_colaborador
cpf_colaborador
funcao_colaborador
data_lancamento
tipo_lancamento = diarista
codigo_marcacao = P | MP
quantidade_diaria = 1 | 0.5
valor_diaria_base
valor_calculado
cliente_unidade
operacao_servico
encarregado_id
encarregado_nome
status = em_aberto
observacao
created_at
updated_at
```

Ausentes podem ser ignorados no banco ou salvos com valor `0`, conforme padrão atual do app.

---

# 9. Tela RH — Painel de Diaristas

Criar tela:

```txt
/rh/diaristas
```

## Objetivo

Exibir as informações em formato semelhante a uma planilha, com linhas e colunas.

## Tabela principal

Colunas:

```txt
Diarista
Função
Dias do período
Quantidade de P
Quantidade de MP
Total de diárias equivalentes
Valor total acumulado
Status
Ações
```

Exemplo:

```txt
Antônio Sergio | Auxiliar de carga | P | P | MP | - | P | 3 P | 1 MP | 3.5 | R$ 420,00 | Em aberto
```

---

# 10. Filtros do RH

Adicionar filtros:

```txt
Período
Nome do diarista
Função
Status
Cliente/Unidade
Encarregado
```

---

# 11. Detalhamento do diarista

Ao clicar em um diarista, abrir modal ou drawer com:

```txt
Nome do diarista
CPF
Função
Período consultado
Dias trabalhados
Código marcado em cada dia
Cliente/unidade
Operação/serviço
Responsável pelo lançamento
Valor por dia
Valor total
Observações
Histórico de alterações
Status do fechamento
```

---

# 12. Fechamento para pagamento

Na tela `/rh/diaristas`, permitir que o RH selecione um período e clique em:

```txt
Fechar período para pagamento
```

Ao fechar:

```txt
Agrupar registros em aberto
Gerar lote de pagamento
Alterar status dos registros para fechado_para_pagamento
Impedir que esses valores continuem no acumulado aberto
```

Status possíveis:

```txt
em_aberto
fechado_para_pagamento
pago
cancelado
```

---

# 13. Exportação — Planilha Quinzenária

Após fechar o período, disponibilizar ação:

```txt
Exportar planilha quinzenária
```

Formato da exportação:

```txt
Colaborador
CPF
Função
Período
Quantidade P
Quantidade MP
Total diárias equivalentes
Valor da diária
Valor total
Status pagamento
```

---

# 14. Segurança e RBAC

Garantir que:

```txt
Carlos só acesse /producao e /producao/diaristas
Carlos só visualize diaristas ativos da empresa dele
Carlos não edite cadastro, função ou valor
Carlos não veja tela de RH
RH cadastre e gerencie diaristas
RH veja painel consolidado
Admin cadastre usuários e vincule função
Todas as queries respeitem empresa_id
Policies/RLS do Supabase respeitem o perfil do usuário
```

---

# 15. Fluxo final esperado

```txt
Admin cadastra Carlos como encarregado_diaristas
↓
RH cadastra diaristas, funções e valores
↓
Carlos acessa /producao
↓
Carlos só consegue abrir Diaristas
↓
Sistema carrega diaristas ativos cadastrados pelo RH
↓
Carlos marca P, MP ou Ausente diariamente
↓
ERP calcula valores automaticamente
↓
RH acompanha em /rh/diaristas em formato de planilha
↓
RH detalha informações por diarista
↓
RH fecha período
↓
ERP gera lote de pagamento
↓
RH exporta planilha quinzenária
```

---

# 16. Resultado esperado

Implementar um módulo completo onde:

```txt
O RH controla a base de diaristas.
Carlos apenas registra presença produtiva diária.
O ERP calcula automaticamente os valores.
O RH recebe os dados em formato de planilha.
O RH fecha períodos e exporta para pagamento quinzenário.
```

```
```
