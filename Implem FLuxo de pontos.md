````markdown
# SKILL — INPUT PONTOS
## ORBE ERP — IMPLEMENTAÇÃO, PROCESSAMENTO, VALIDAÇÃO E GOVERNANÇA COMPLETA DO FLUXO DE PONTO

---

# OBJETIVO DA SKILL

Esta Skill define toda a arquitetura operacional, regras de negócio, processamento, automações, validações, correções, comportamento esperado e testes ponta a ponta do fluxo de PONTOS do ERP Orbe.

O objetivo é permitir que o sistema:

- receba planilhas operacionais de ponto
- detecte automaticamente novos colaboradores
- crie pré-cadastros inteligentes
- processe banco de horas
- execute regras RH
- gere competência
- entregue lotes ao financeiro
- prepare faturamento
- gere governança operacional
- detecte inconsistências
- execute processamento em massa
- funcione sem necessidade de intervenção manual excessiva

---

# FILOSOFIA DO FLUXO

A planilha representa:

```txt
EVENTOS OPERACIONAIS
````

O cadastro representa:

```txt
IDENTIDADE OPERACIONAL
```

O motor representa:

```txt
INTELIGÊNCIA DO ERP
```

A planilha NÃO deve carregar:

* salário
* contrato
* banco
* PIX
* regras financeiras
* modelo cálculo

O motor do Orbe deve inferir automaticamente o contexto operacional.

---

# OBJETIVO OPERACIONAL

Fluxo ideal:

```txt
Planilha de ponto
↓
Importação
↓
Detecção de colaboradores
↓
Pré-cadastro automático
↓
Vinculação empresarial
↓
Processamento banco de horas
↓
Apuração RH
↓
Fechamento competência
↓
Lote financeiro
↓
Financeiro
↓
CNAB / pagamento
↓
Governança
```

---

# ESTRUTURA DA PLANILHA

## COLUNAS OBRIGATÓRIAS

```txt
ID
EMPRESA
COLABORADOR
MATRICULA
CPF
CARGO
DATA
ENTRADA
SAIDA ALMOCO
RETORNO ALMOCO
SAIDA
HORAS TRABALHADAS
HORA EXTRA
FALTA
ATRASO
STATUS
OBSERVACOES
```

---

# REGRAS DA IMPORTAÇÃO

## REGRA 1 — IMPORTAÇÃO NÃO DEVE FALHAR POR DADOS INCOMPLETOS

Mesmo sem:

* CPF
* matrícula
* empresa existente

o sistema deve:

* importar registros operacionais
* detectar colaboradores
* criar pré-cadastro
* criar empresa mínima se necessário

---

# REGRA 2 — DETECÇÃO DE COLABORADOR

Prioridade de identificação:

```txt
1. CPF
2. Matrícula
3. Nome normalizado + empresa
```

Normalização:

* remover acentos
* lowercase
* trim
* remover espaços duplicados

Evitar duplicidade.

---

# REGRA 3 — EMPRESA AUTOMÁTICA

Se empresa não existir:

criar automaticamente:

```ts
{
  nome,
  cnpj_placeholder,
  status: "ativa",
  origem: "ponto",
  cadastro_provisorio: true,
  unidade: "Não informado",
  cidade: "Não informado"
}
```

---

# REGRA 4 — CNPJ PLACEHOLDER

Gerar automaticamente:

Formato:

```txt
00000 + timestamp + random
```

Requisitos:

* UNIQUE
* NOT NULL
* identificável como provisório

---

# REGRA 5 — PRÉ-CADASTRO AUTOMÁTICO

Quando colaborador não existir:

criar automaticamente:

```ts
{
  origem: "ponto",
  status: "pendente_complemento",
  gera_faturamento: true
}
```

---

# REGRA 6 — INFERÊNCIA INTELIGENTE

## ORIGEM = PONTO

Aplicar automaticamente:

```ts
tipo_colaborador = "clt"
tipo_contrato = "mensal"
modelo_calculo = "CLT_MENSAL"
gera_faturamento = true
```

Resultado:

* colaborador entra no banco de horas
* RH não bloqueia contrato
* processamento automático possível

---

# REGRA 7 — NÃO SOBRESCREVER DADOS

Se colaborador já existir:

NÃO alterar:

* banco
* PIX
* salário
* contrato
* modelo cálculo
* tipo colaborador

Atualizar apenas:

* eventos operacionais
* jornadas
* movimentações

---

# REGRA 8 — DADOS FINANCEIROS

Banco/PIX NÃO vêm da planilha.

Devem ser preenchidos posteriormente no cadastro.

Campos mínimos obrigatórios:

```txt
Banco
Agência
Conta
Tipo conta
```

PIX opcional.

---

# REGRA 9 — COMPLETUDE CADASTRAL

## RH

Valida:

* tipo colaborador
* tipo contrato
* modelo cálculo

## Financeiro

Valida:

* banco
* agência
* conta
* tipo conta

---

# REGRA 10 — BLOQUEIOS

## BLOQUEIO RH

Somente se faltar:

* contrato
* modelo cálculo
* tipo colaborador

## BLOQUEIO FINANCEIRO

Somente se faltar:

* dados bancários mínimos

---

# REGRA 11 — CENTRAL DE CADASTROS

Após importação:

* badges devem atualizar
* contadores devem atualizar
* lista deve aparecer automaticamente
* sem refresh manual

Indicadores:

* pendentes
* críticos
* sem banco
* sem contrato

---

# REGRA 12 — TOASTS / ALERTAS

Após importação:

mostrar:

```txt
10 colaboradores detectados
10 pré-cadastros criados
1 empresa criada automaticamente
```

---

# REGRA 13 — PROCESSAMENTO RH

Tela:
`/banco-horas/processamento`

Botão:
`Processar Pendentes`

Deve:

* processar válidos
* ignorar bloqueados
* gerar processamento parcial

Exemplo:

```txt
10 encontrados
8 processados
2 pendentes cadastrais
```

---

# REGRA 14 — BANCO DE HORAS

Motor deve:

* calcular saldo dia
* calcular extras
* calcular faltas
* calcular atrasos
* acumular banco

Persistir:

* saldo diário
* saldo acumulado
* status processamento

---

# REGRA 15 — APROVAÇÃO RH

Botão:
`Aprovar Competência`

Só permitir se:

* sem bloqueio RH crítico
* processamento concluído
* competência válida

Ao aprovar:

```txt
criar lote financeiro
status = AGUARDANDO_FINANCEIRO
```

---

# REGRA 16 — LOTE FINANCEIRO

Tabela:
`rh_financeiro_lotes`

Deve conter:

* empresa
* competência
* quantidade
* valor
* origem
* status

Constraint:

```sql
UNIQUE (
  tenant_id,
  empresa_id,
  competencia,
  origem,
  tipo
)
```

Evitar duplicidade.

---

# REGRA 17 — FINANCEIRO

Financeiro deve receber automaticamente:

* lotes RH
* faturamentos
* diaristas

Sem exportação manual.

---

# REGRA 18 — FATURAMENTO

Tela:
`/financeiro/faturamento`

Deve:

* consolidar competência
* mostrar clientes
* mostrar bases
* mostrar regras
* calcular faturável

---

# REGRA 19 — CNAB

Tela:
`/financeiro/bancario`

Preparar:

* remessa
* retorno
* pagamento

Fluxo:

```txt
Lote RH
↓
Validação financeira
↓
CNAB
↓
Pagamento
↓
Baixa
↓
Governança
```

---

# REGRA 20 — GOVERNANÇA

Registrar:

* logs
* auditoria
* eventos
* processamento
* aprovações
* erros

---

# REGRA 21 — REPROCESSAMENTO

Botão:
`Reprocessar Período`

Deve:

* apagar processamento anterior
* recalcular banco
* recalcular saldos
* manter integridade

---

# REGRA 22 — RESILIÊNCIA

Importação nunca deve:

* quebrar por campo vazio
* falhar por empresa inexistente
* parar processamento inteiro por 1 linha inválida

Linhas inválidas:

* registrar inconsistência
* continuar processamento

---

# REGRA 23 — UX

Sistema deve:

* atualizar em tempo real
* evitar reload manual
* manter contexto
* mostrar feedback visual

---

# REGRA 24 — PERFORMANCE

Sistema deve suportar:

* processamento em lote
* múltiplas empresas
* milhares de linhas

Evitar:

* loops duplicados
* invalidations excessivas
* recriações desnecessárias

---

# REGRA 25 — VALIDAÇÃO PONTA A PONTA

## TESTE 1 — BASE LIMPA

```txt
limpar sistema
importar planilha
```

Esperado:

```txt
empresa criada
colaboradores criados
pré-cadastros criados
badges atualizados
```

---

# TESTE 2 — RH

Esperado:

```txt
contrato automático CLT mensal
sem bloqueio RH
```

---

# TESTE 3 — FINANCEIRO

Esperado:

```txt
bloqueio financeiro presente
aguardando dados bancários
```

---

# TESTE 4 — PROCESSAMENTO

Esperado:

```txt
banco horas processado
saldo calculado
```

---

# TESTE 5 — APROVAÇÃO

Esperado:

```txt
competência aprovada
lote financeiro criado
```

---

# TESTE 6 — FINANCEIRO

Esperado:

```txt
lote aparece no financeiro
```

---

# TESTE 7 — REIMPORTAÇÃO

Esperado:

```txt
sem duplicações
colaboradores reconhecidos
empresa reconhecida
```

---

# TESTE 8 — EMPRESA INEXISTENTE

Esperado:

```txt
empresa provisória criada
sem erro NOT NULL
```

---

# TESTE 9 — ENCODING

Esperado:

```txt
sem caracteres quebrados
UTF-8 correto
```

---

# TESTE 10 — BUILD

Esperado:

```txt
build sem erros
sem warnings críticos
```

---

# CHECKLIST FINAL

```txt
[ ] importação funciona
[ ] empresa automática funciona
[ ] colaborador automático funciona
[ ] deduplicação funciona
[ ] CLT mensal automático funciona
[ ] banco horas funciona
[ ] RH aprova competência
[ ] lote financeiro criado
[ ] financeiro recebe lote
[ ] CNAB preparado
[ ] governança registrada
[ ] reprocessamento funciona
[ ] sem duplicações
[ ] sem encoding quebrado
[ ] sem crashes
[ ] build OK
```

```
```
