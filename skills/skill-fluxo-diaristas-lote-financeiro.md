---
trigger: always_on
---

# ORBE_SKILL_DIARISTAS_PIPELINE.md

# SKILL — Fluxo Diaristas / Lote / Financeiro

> Skill oficial do fluxo de Diaristas do ERP ORBE.
>
> Esta skill define:
>
> - entrada operacional dos diaristas
> - fechamento de lote
> - validação RH
> - aprovação financeira
> - remessa/pagamento
> - rastreabilidade
> - UX operacional
> - pipeline visual
>
> Toda implementação relacionada a:
>
> - diaristas
> - lotes diários
> - fechamento operacional
> - aprovação RH
> - financeiro diarista
> - CNAB diarista
>
> deve obrigatoriamente consultar:
>
> 1. ORBE_MASTER_FLOW_ARCHITECTURE.md
> 2. ORBE_SKILL_DIARISTAS_PIPELINE.md

---

# 1. OBJETIVO DO FLUXO

Controlar o ciclo completo operacional e financeiro dos diaristas:

```text
Lançamento →
Fechamento de Lote →
Validação RH →
Central Financeira →
CNAB/Pagamento →
Dashboard
```

Garantindo:
- rastreabilidade
- fechamento correto
- validação setorial
- pagamento controlado
- auditoria financeira

---

# 2. DEFINIÇÃO OFICIAL

## Diaristas NÃO pertencem ao fluxo CLT.

Por padrão:
- não usam folha CLT
- não usam banco de horas CLT
- possuem fechamento simplificado por lote

---

# Exceção futura

Caso exista diarista recorrente:
- créditos
- compensações
- controle contínuo

o sistema poderá futuramente utilizar:
# Banco Simplificado de Diaristas

Mas:
- separado do CLT
- separado do Banco de Horas principal

---

# 3. INPUT OFICIAL

## Origem permitida

- lançamento manual encarregado
- lote operacional
- importação futura

---

# Campos mínimos obrigatórios

| Campo | Obrigatório |
|---|---|
| diarista | sim |
| empresa | sim |
| data | sim |
| valor diária | sim |
| competência YYYY-MM | sim |
| encarregado origem | sim |

---

# 4. PIPELINE OFICIAL

```text
Lançamento Operacional
↓
Fechamento de Lote
↓
Validação RH
↓
Central Financeira
↓
Aprovação Financeira
↓
Central Bancária / CNAB
↓
Pagamento
↓
Dashboard / Relatórios
```

---

# 5. RESPONSABILIDADE POR ETAPA

| Etapa | Responsável |
|---|---|
| Lançamento | Encarregado |
| Fechamento lote | Encarregado |
| Validação RH | RH |
| Consolidação financeira | Financeiro |
| Remessa/CNAB | Financeiro |
| Dashboard | ADM |

---

# 6. TELAS OFICIAIS

---

# 6.1 LANÇAMENTO DIARISTAS

## Objetivo

Entrada operacional dos diaristas.

---

## Deve permitir

- lançar diarista
- selecionar empresa
- selecionar data
- definir valor
- visualizar lote atual

---

## NÃO deve

- aprovar financeiro
- gerar pagamento
- gerar CNAB

---

# 6.2 FECHAMENTO DE LOTE

## Objetivo

Encerrar lote operacional diário.

---

## Deve permitir

- validar quantidade
- validar valor total
- fechar lote
- bloquear edição após fechamento

---

## Após fechamento

Pipeline deve conduzir:
# RH

---

# 6.3 VALIDAÇÃO RH

## Objetivo

Validar:
- diaristas
- quantidades
- valores
- inconsistências

---

## Deve permitir

- aprovar lote
- devolver lote
- justificar devolução
- visualizar origem operacional

---

## NÃO deve

- pagar diarista
- gerar CNAB

---

# 6.4 CENTRAL FINANCEIRA

## Objetivo

Receber:
- lotes aprovados RH
- valores consolidados

---

## Deve permitir

- aprovar financeiramente
- visualizar origem diarista
- visualizar lote
- preparar pagamento

---

# 6.5 CENTRAL BANCÁRIA / CNAB

## Objetivo

Gerar:
- remessa
- pagamento
- CNAB diarista

---

## Deve bloquear

- conta inválida
- lote divergente
- valor inconsistente

---

# 7. PIPELINE VISUAL

Toda etapa deve abrir:
# OperationalPipelineModal

---

# Estados oficiais

| Estado | Significado |
|---|---|
| pendente | aguardando |
| em_andamento | etapa atual |
| concluido | finalizado |
| bloqueado | erro |
| devolvido | retornou etapa |
| cancelado | fluxo encerrado |

---

# Pipeline esperado

```text
Lançamento
↓
Lote fechado
↓
RH validado
↓
Financeiro aprovado
↓
CNAB/Pagamento
↓
Concluído
```

---

# 8. UX OPERACIONAL

O usuário:
# NÃO pode procurar a próxima tela.

O sistema deve:
- conduzir
- orientar
- abrir pipeline
- sugerir próxima ação

---

# Exemplos obrigatórios

Após:
- fechamento lote →
abrir pipeline direcionando RH

Após:
- aprovação RH →
abrir pipeline direcionando Financeiro

Após:
- aprovação financeira →
abrir pipeline direcionando CNAB

---

# 9. REGRAS PROIBIDAS

---

# PROIBIDO

- misturar diarista com CLT
- usar banco de horas CLT
- RH aprovar pagamento
- encarregado aprovar financeiro
- financeiro alterar lote operacional

---

# 10. REFLEXOS SISTÊMICOS

| Ação | Impacta |
|---|---|
| lançamento diarista | lote |
| lote fechado | RH |
| RH validado | financeiro |
| financeiro aprovado | CNAB |
| pagamento | dashboard |

---

# 11. TRATAMENTO DE FALHAS

---

# Falha operacional

Exemplos:
- diarista duplicado
- valor inválido
- lote vazio

Comportamento:
- bloquear fechamento
- destacar inconsistência

---

# Falha RH

Exemplos:
- diarista sem cadastro
- empresa inválida

Comportamento:
- devolver lote
- exigir justificativa

---

# Falha Financeira

Exemplos:
- divergência de valores
- lote inconsistente

Comportamento:
- bloquear aprovação
- devolver ao RH

---

# Falha CNAB

Exemplos:
- conta inválida
- favorecido inválido

Comportamento:
- bloquear remessa
- manter rastreabilidade
- abrir alerta operacional

---

# 12. DASHBOARD

## Deve mostrar

- total diaristas
- valor total diário
- valor mensal
- empresas envolvidas
- status financeiro

---

## NÃO deve

- recalcular lote no front-end
- misturar com CLT

---

# 13. CHECKLIST AUTOMÁTICO

---

# Operacional

- [ ] diarista lançado corretamente
- [ ] lote correto
- [ ] competência correta

---

# RH

- [ ] lote validado
- [ ] inconsistências tratadas

---

# Financeiro

- [ ] lote aprovado
- [ ] valor correto

---

# CNAB

- [ ] favorecidos válidos
- [ ] remessa correta

---

# Dashboard

- [ ] valores corretos
- [ ] rastreabilidade correta

---

# 14. CRITÉRIOS DE ACEITE

O fluxo diarista será considerado válido quando:

- o encarregado consegue lançar
- o lote fecha corretamente
- o RH valida
- o financeiro aprova
- o CNAB é gerado
- o dashboard reflete corretamente
- o pipeline conduz o usuário
- não existe mistura com CLT

---

# 15. OBJETIVO FINAL

O fluxo diarista do ORBE deve funcionar como:

# PIPELINE OPERACIONAL → RH → FINANCEIRO

Onde:
- o encarregado lança
- o RH valida
- o financeiro paga
- o dashboard audita

Sem:
- duplicidade
- mistura com CLT
- perda de rastreabilidade
- confusão setorial

---

# FIM DA SKILL