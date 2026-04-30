---
trigger: always_on
---

````md
# PROMPT ANTIGRAVITY — ERP OPERAÇÕES + FINANCEIRO + KPIs DINÂMICOS

## 🎯 OBJETIVO
Construir uma tela única de **Operações** com:
- Cálculo financeiro fiel à planilha
- Classificação por **modalidade de pagamento**
- **Filtros inteligentes** (substituem abas)
- **KPIs dinâmicos** que reagem aos filtros

---

## 🧱 ESTRUTURA DE DADOS

```ts
Operacao {
  data_operacao: Date
  empresa: string
  transportadora: string

  tipo_servico: "DESCARGA" | "VOLUME" | "SERVIÇO"

  qtd_colaboradores: number
  quantidade_volume: number
  valor_unitario: number

  valor_descarga: number
  custo_com_iss: number
  total_e_filme: number
  total_final: number

  meio_pagamento: "PIX" | "DEPÓSITO" | "TRANSFERÊNCIA" | "BOLETO"

  modalidade_financeira:
    | "CAIXA_IMEDIATO"
    | "DUPLICATA_FORNECEDOR"
    | "FECHAMENTO_MENSAL_EMPRESA"
    | "TRANSBORDO_30D"

  data_vencimento: Date

  status_pagamento: "PENDENTE" | "RECEBIDO" | "ATRASADO"
}
````

---

## ⚙️ CÁLCULO OPERACIONAL

```ts
valor_descarga = quantidade_volume * valor_unitario
custo_com_iss = 0
total_e_filme = 0
total_final = valor_descarga
```

---

## 🧠 CONFIGURAÇÃO DE EMPRESAS

```ts
Empresa {
  nome: string
  tem_fechamento_mensal: boolean
}
```

---

## 🔁 LÓGICA DE CLASSIFICAÇÃO FINANCEIRA

```ts
function classificarFinanceiro(operacao, empresa) {
  if (operacao.meio_pagamento === "BOLETO") {
    return {
      modalidade: "DUPLICATA_FORNECEDOR",
      vencimento: adicionarDias(operacao.data_operacao, 5 a 10)
    };
  }

  if (
    empresa.tem_fechamento_mensal === true &&
    ["DEPÓSITO", "PIX", "TRANSFERÊNCIA"].includes(operacao.meio_pagamento)
  ) {
    return {
      modalidade: "FECHAMENTO_MENSAL_EMPRESA",
      vencimento: ultimoDiaDoMes(operacao.data_operacao)
    };
  }

  if (
    ["DEPÓSITO", "PIX", "TRANSFERÊNCIA"].includes(operacao.meio_pagamento)
  ) {
    return {
      modalidade: "CAIXA_IMEDIATO",
      vencimento: operacao.data_operacao
    };
  }
}
```

---

## ⚠️ REGRA CRÍTICA

Prioridade:

1. BOLETO
2. EMPRESA COM FECHAMENTO
3. CAIXA IMEDIATO

---

## 🧩 TELA: OPERAÇÕES

### Colunas:

```md
Data
Empresa
Transportadora
Tipo Serviço
Qtd Col
Qtd Volume
Valor Unitário
Valor Descarga
Meio Pagamento
Modalidade Financeira
Vencimento
Status
```

---

## 🔍 FILTROS (SUBSTITUEM ABAS)

```md
Modalidade Financeira
Empresa
Período (data_operacao)
Status
Meio de pagamento
```

### Visões rápidas:

```md
Caixa Imediato → modalidade = CAIXA_IMEDIATO
Duplicatas → modalidade = DUPLICATA_FORNECEDOR
Fechamento Mensal → modalidade = FECHAMENTO_MENSAL_EMPRESA
Transbordo → modalidade = TRANSBORDO_30D
```

---

## 📊 KPIs (CARDS DO TOPO)

### REGRA:

> KPIs usam exatamente os dados filtrados da tabela

---

### 💰 Faturamento Total

```ts
total = SUM(total_final)
```

---

### ⚡ Caixa Imediato

```ts
caixa = SUM(total_final WHERE modalidade === "CAIXA_IMEDIATO")
```

---

### 🧾 Provisionado

```ts
provisionado = total - caixa
```

---

### ⏳ A Receber

```ts
pendente = SUM(total_final WHERE status_pagamento === "PENDENTE")
```

---

### 🚨 Atrasado

```ts
atrasado = SUM(total_final WHERE status_pagamento === "ATRASADO")
```

---

### 📊 Por Modalidade

```ts
caixa_imediato = SUM(modalidade === "CAIXA_IMEDIATO")
duplicatas = SUM(modalidade === "DUPLICATA_FORNECEDOR")
fechamento = SUM(modalidade === "FECHAMENTO_MENSAL_EMPRESA")
transbordo = SUM(modalidade === "TRANSBORDO_30D")
```

---

### 📈 Ticket Médio

```ts
ticket_medio = total / quantidade_operacoes
```

---

### ⚙️ Produtividade

```ts
produtividade = SUM(quantidade_volume) / SUM(qtd_colaboradores)
```

---

### 📦 Valor por Volume

```ts
valor_por_volume = total / SUM(quantidade_volume)
```

---

## 🔄 ATUALIZAÇÃO DOS CARDS

Recalcular sempre que mudar:

* filtros
* busca
* período
* empresa
* modalidade

---

## 🧠 STATUS AUTOMÁTICO

```ts
if (status !== "RECEBIDO" && hoje > data_vencimento) {
  status = "ATRASADO";
}
```

---

## 🧱 FUNÇÃO CENTRAL

```ts
function processarOperacao(operacao, empresa) {
  const valor_descarga = operacao.quantidade_volume * operacao.valor_unitario;

  const total_final = valor_descarga;

  const financeiro = classificarFinanceiro(operacao, empresa);

  return {
    ...operacao,
    valor_descarga,
    total_final,
    modalidade_financeira: financeiro.modalidade,
    data_vencimento: financeiro.vencimento,
    status_pagamento: "PENDENTE"
  };
}
```

---

## 🚀 RESULTADO ESPERADO

* Uma única base de operações
* Mesma lógica da planilha
* Separação por filtros (não abas)
* Controle financeiro real
* KPIs dinâmicos e confiáveis
* Escalável para novas empresas

---

## ❌ NÃO FAZER

* Não criar múltiplas telas duplicadas
* Não misturar cálculo com pagamento
* Não fixar regras em nomes de empresa
* Não alterar lógica da planilha original

---

```
```
