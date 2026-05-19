---
trigger: always_on
---

# ORBE_SKILL_CLT_PIPELINE.md

# SKILL — Fluxo CLT / Pontos / Banco de Horas / Financeiro

> Skill oficial do fluxo CLT do ERP ORBE.
>
> Esta skill define:
>
> - comportamento oficial do fluxo CLT
> - processamento RH
> - banco de horas
> - fechamento
> - financeiro
> - CNAB
> - rastreabilidade
> - UX operacional
> - pipeline visual
>
> Toda implementação relacionada a:
>
> - pontos
> - processamento RH
> - banco de horas
> - fechamento RH
> - financeiro CLT
> - CNAB folha
>
> deve obrigatoriamente consultar:
>
> 1. ORBE_MASTER_FLOW_ARCHITECTURE.md
> 2. ORBE_SKILL_CLT_PIPELINE.md

---

# 1. OBJETIVO DO FLUXO

Controlar o ciclo completo do colaborador CLT:

```text
Ponto →
Processamento RH →
Banco de Horas →
Fechamento RH →
Financeiro →
CNAB →
Pagamento →
Dashboard
```

Garantindo:
- rastreabilidade
- auditabilidade
- responsabilidade setorial
- previsibilidade operacional
- reflexo financeiro correto

---

# 2. INPUT OFICIAL

## Origens permitidas

- API relógio ponto
- Importação de planilha
- Integração futura automática

---

# Estrutura mínima obrigatória

| Campo | Obrigatório |
|---|---|
| colaborador | sim |
| matrícula | sim |
| data | sim |
| entrada | sim |
| saída | sim |
| competência YYYY-MM | sim |
| empresa | sim |

---

# 3. PIPELINE OFICIAL

```text
Pontos Recebidos
↓
Processamento RH
↓
Banco de Horas
↓
Fechamento RH
↓
Central Financeira
↓
Central Bancária / CNAB
↓
Retorno Bancário
↓
Dashboard / Relatórios
```

---

# 4. RESPONSABILIDADE POR ETAPA

| Etapa | Responsável |
|---|---|
| Importação | RH |
| Processamento RH | RH |
| Ajustes manuais | RH |
| Banco de Horas | RH |
| Fechamento RH | RH |
| Aprovação Financeira | Financeiro |
| CNAB | Financeiro |
| Conciliação | Financeiro |
| Dashboard | ADM |

---

# 5. TELAS OFICIAIS

---

# 5.1 PONTOS RECEBIDOS

## Objetivo

Tela de:
- entrada
- sincronização
- rastreabilidade
- origem do ponto

---

## Deve permitir

- importar planilha
- visualizar status
- visualizar competência
- visualizar origem
- visualizar processamento RH

---

## NÃO deve

- processar RH
- compensar saldo
- aprovar financeiro

---

# 5.2 PROCESSAMENTO RH

## Objetivo

CENTRAL OPERACIONAL RH

---

## Responsável por

- cálculo diário
- regras
- tolerância
- saldo
- extras
- inconsistências
- compensações
- ajustes manuais
- reprocessamento

---

## Drawer operacional obrigatório

Ao clicar no colaborador:

Abrir:
- Visão Geral
- Ajustes RH
- Histórico/Auditoria

---

## Ajustes RH permitidos

- compensar saldo
- adicionar crédito
- lançar débito
- registrar folga
- zerar saldo
- recalcular individualmente
- converter saldo para financeiro

---

## Toda ação deve exigir

- justificativa
- usuário executor
- timestamp

---

# 5.3 BANCO DE HORAS

## Objetivo

VISÃO CONSOLIDADA RH

---

## Deve mostrar

- saldo acumulado
- risco financeiro
- créditos acumulados
- impacto financeiro
- fechamento RH

---

## NÃO deve

- editar saldo individual
- ajustar manualmente
- compensar individualmente

Essas ações pertencem exclusivamente ao:
- Processamento RH

---

# 5.4 FECHAMENTO RH

## Objetivo

Encerrar oficialmente a competência RH.

---

## Deve

- consolidar banco
- travar alterações
- liberar financeiro
- atualizar pipeline

---

## NÃO deve

- gerar pagamento
- gerar CNAB

---

# 5.5 CENTRAL FINANCEIRA

## Objetivo

Receber:
- competência RH validada
- valores consolidados
- créditos aprovados

---

## Deve permitir

- aprovar lote financeiro
- visualizar origem RH
- visualizar reflexos financeiros
- preparar bancário

---

# 5.6 CENTRAL BANCÁRIA / CNAB

## Objetivo

Gerar:
- remessa bancária
- CNAB240
- retorno bancário

---

## Deve bloquear

- divergência financeira
- favorecido inválido
- conta inválida
- lote inconsistente

---

# 6. PIPELINE VISUAL

Toda etapa deve abrir:
# OperationalPipelineModal

---

# Estados oficiais

| Estado | Significado |
|---|---|
| pendente | não iniciado |
| em_andamento | etapa atual |
| concluido | finalizado |
| bloqueado | erro operacional |
| devolvido | retornou etapa |
| cancelado | interrompido |

---

# Regras UX

O usuário:
# NÃO pode adivinhar o próximo passo.

O sistema deve:
- conduzir
- desbloquear
- orientar
- transferir responsabilidade

---

# 7. REGRAS DE CÁLCULO

---

# Tolerância

Toda tolerância aplicada deve:
- ser explicável
- aparecer no drawer RH
- mostrar cálculo completo

---

# Exemplo

```text
Jornada:
8h

Excedente:
20min

Tolerância:
10min

Banco gerado:
10min
```

---

# 8. REGRAS PROIBIDAS

---

# PROIBIDO

- RH aprovar pagamento
- RH gerar CNAB
- recalcular financeiro no front-end
- editar saldo individual fora do Processamento RH
- múltiplos fechamentos
- múltiplos bancos de horas

---

# 9. REFLEXOS SISTÊMICOS

| Ação | Impacta |
|---|---|
| Processamento RH | Banco de Horas |
| Ajuste RH | Banco de Horas |
| Banco de Horas | Fechamento RH |
| Fechamento RH | Financeiro |
| Financeiro | CNAB |
| CNAB | Dashboard |

---

# 10. TRATAMENTO DE FALHAS

---

# Falha RH

Exemplos:
- colaborador inválido
- jornada inválida
- regra ausente

Comportamento:
- bloquear processamento
- destacar inconsistência
- impedir fechamento

---

# Falha Financeira

Exemplos:
- divergência de lote
- saldo inválido

Comportamento:
- impedir aprovação
- devolver ao RH

---

# Falha CNAB

Exemplos:
- conta inválida
- favorecido inválido
- divergência total

Comportamento:
- bloquear remessa
- retornar financeiro
- abrir alerta

---

# 11. DASHBOARD

## Deve consumir

- somente dados consolidados
- somente competências fechadas
- somente fontes oficiais

---

## Nunca

- recalcular regras RH no front
- usar dados intermediários

---

# 12. CHECKLIST AUTOMÁTICO

---

# Pontos

- [ ] competência correta
- [ ] origem rastreável
- [ ] status sincronizado

---

# RH

- [ ] cálculo correto
- [ ] tolerância correta
- [ ] saldo correto
- [ ] drawer operacional funcionando

---

# Banco de Horas

- [ ] saldo consolidado correto
- [ ] reflexo financeiro correto

---

# Financeiro

- [ ] lote correto
- [ ] aprovação correta

---

# CNAB

- [ ] valor correto
- [ ] favorecidos válidos

---

# Dashboard

- [ ] KPI correto
- [ ] auditoria correta

---

# 13. CRITÉRIOS DE ACEITE

O fluxo CLT será considerado válido quando:

- o ponto entra corretamente
- o RH consegue operar individualmente
- o banco consolida corretamente
- o fechamento libera financeiro
- o financeiro gera CNAB
- o dashboard reflete o resultado
- o pipeline conduz o usuário
- não existem ações duplicadas
- não existem responsabilidades ambíguas

---

# 14. OBJETIVO FINAL

O fluxo CLT do ORBE deve funcionar como:

# PIPELINE OPERACIONAL RH → FINANCEIRO

Onde:
- o RH processa
- o banco consolida
- o financeiro aprova
- o bancário remete
- o dashboard audita

Sem:
- perda de rastreabilidade
- duplicidade operacional
- confusão de setor
- regressão sistêmica

---

# FIM DA SKILL