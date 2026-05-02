# IMPLEMENTAÇÃO — FECHAMENTO DE PERÍODO + LOTE DE PAGAMENTO (DIARISTAS)

## Contexto

Já existe:

- Lançamento de diaristas (Carlos)
- Regras operacionais (P, MP)
- Consolidação no RH (tela tipo planilha)
- Status atual: "em_aberto"

Agora é necessário transformar isso em um fluxo financeiro real.

---

# 1. NOVO CONCEITO: LOTE DE PAGAMENTO

Criar entidade:

```txt
payment_batches
````

## Campos:

```txt
id
empresa_id
tipo = diaristas
periodo_inicio
periodo_fim
total_valor
status = aberto | fechado | pago
created_by
created_at
updated_at
```

---

# 2. BOTÃO — FECHAR PERÍODO

Na tela:

```txt
/rh/diaristas
```

Adicionar botão:

```txt
[ Fechar período ]
```

---

## Comportamento ao clicar

1. Abrir modal:

```txt
Selecionar período:
Data início
Data fim

Resumo:
Total diaristas
Total diárias
Valor total

[ Confirmar fechamento ]
```

---

## Ao confirmar:

```txt
1. Buscar todos os registros com:
   status = em_aberto
   dentro do período selecionado

2. Criar novo payment_batch

3. Atualizar registros:
   status = fechado_para_pagamento
   batch_id = id do lote

4. Salvar total consolidado no lote
```

---

# 3. CONGELAMENTO DE DADOS

Após fechamento:

* Registros não podem mais ser editados
* Não entram mais no acumulado
* Só leitura permitida

---

# 4. STATUS DOS REGISTROS

Atualizar status:

```txt
em_aberto
fechado_para_pagamento
pago
cancelado
```

---

# 5. TELA — LOTES DE PAGAMENTO

Criar tela:

```txt
/rh/diaristas/lotes
```

## Listagem:

```txt
ID do lote
Período
Quantidade de diaristas
Total valor
Status
Data de criação
Ações
```

---

# 6. DETALHE DO LOTE

Ao clicar:

Exibir:

```txt
Diarista
Função
Total de diárias
Valor total
Status individual
```

Resumo:

```txt
TOTAL GERAL: R$ X.XXX,00
```

---

# 7. EXPORTAÇÃO

Botão:

```txt
[ Exportar planilha ]
```

Formato:

```txt
Nome
CPF
Função
Quantidade P
Quantidade MP
Total diárias
Valor total
```

Formato compatível com Excel (.xlsx ou .csv)

---

# 8. MARCAR COMO PAGO

No lote:

```txt
[ Marcar como pago ]
```

Ao clicar:

```txt
Atualizar:
batch.status = pago

Atualizar todos os registros:
status = pago
```

---

# 9. INTEGRAÇÃO COM FINANCEIRO

Opcional (recomendado):

Ao fechar lote:

```txt
Criar lançamento financeiro:

tipo = saída
categoria = pagamento diaristas
valor = total do lote
referencia = batch_id
status = pendente
```

---

# 10. SEGURANÇA

* Apenas RH/Admin podem fechar período
* Carlos não vê lotes
* Registros respeitam empresa_id
* Após fechamento, bloqueio total de edição

---

# 11. RESULTADO FINAL

```txt
Carlos lança diariamente
↓
Sistema calcula automaticamente
↓
RH visualiza consolidado
↓
RH fecha período
↓
Sistema gera lote
↓
Dados ficam congelados
↓
RH exporta planilha
↓
RH realiza pagamento
↓
Marca como pago
```

---

# 12. OBJETIVO FINAL

Eliminar completamente:

* planilhas manuais
* cálculos externos
* erros operacionais

E transformar em:

```txt
fluxo automatizado + auditável + financeiro integrado
```

```

---

Se você implementar isso agora, você basicamente fecha o ciclo inteiro:

👉 Operação → RH → Financeiro  

Se quiser, no próximo passo eu posso te levar para:

**📊 Dashboard inteligente (custo por operação, margem, produtividade)**  

Só falar: *"quero o dashboard"*
```
