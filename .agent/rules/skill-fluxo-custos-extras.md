---
trigger: always_on
---

# ORBE_SKILL_CUSTOS_EXTRAS.md

# SKILL — Fluxo Custos Extras / Despesas Operacionais / Financeiro

> Skill oficial do fluxo de Custos Extras do ERP ORBE.
>
> Esta skill define:
>
> - entrada de despesas operacionais
> - validação operacional
> - reflexo financeiro
> - centro de custo
> - dashboard
> - rastreabilidade
> - pipeline visual
>
> Toda implementação relacionada a:
>
> - custos extras
> - despesas operacionais
> - combustível
> - avarias
> - reembolsos
> - despesas logísticas
>
> deve obrigatoriamente consultar:
>
> 1. ORBE_MASTER_FLOW_ARCHITECTURE.md
> 2. ORBE_SKILL_CUSTOS_EXTRAS.md

---

# 1. OBJETIVO DO FLUXO

Controlar despesas operacionais extraordinárias geradas pelas operações logísticas:

```text
Lançamento
↓
Validação Operacional
↓
Financeiro
↓
Centro de Custo
↓
Dashboard
```

Garantindo:
- rastreabilidade
- controle financeiro
- governança operacional
- impacto contábil correto
- auditoria

---

# 2. DEFINIÇÃO OFICIAL

Custos Extras representam:
# DESPESAS OPERACIONAIS

Exemplos:
- combustível
- manutenção
- avaria
- diária extra
- alimentação
- hospedagem
- emergência operacional
- reembolso

---

# IMPORTANTE

Custos Extras:
- NÃO pertencem ao RH
- NÃO geram folha
- NÃO geram banco de horas
- NÃO geram pagamento colaborador CLT

Impactam:
# financeiro e centro de custo.

---

# 3. INPUT OFICIAL

## Origem permitida

- encarregado operacional
- portal operacional
- lançamento manual autorizado

---

# Campos mínimos obrigatórios

| Campo | Obrigatório |
|---|---|
| empresa | sim |
| operação relacionada | sim |
| tipo custo | sim |
| valor | sim |
| data | sim |
| competência YYYY-MM | sim |
| responsável lançamento | sim |
| justificativa | sim |

---

# 4. PIPELINE OFICIAL

```text
Lançamento
↓
Validação Operacional
↓
Financeiro
↓
Centro de Custo
↓
Dashboard
```

---

# 5. RESPONSABILIDADE POR ETAPA

| Etapa | Responsável |
|---|---|
| Lançamento | Encarregado |
| Validação operacional | Operação / ADM |
| Consolidação financeira | Financeiro |
| Centro de custo | Financeiro |
| Dashboard | ADM |

---

# 6. TELAS OFICIAIS

---

# 6.1 LANÇAMENTO DE CUSTO EXTRA

## Objetivo

Registrar despesa operacional extraordinária.

---

## Deve permitir

- selecionar operação
- selecionar tipo custo
- inserir valor
- anexar justificativa
- anexar evidência futura
- visualizar status

---

## NÃO deve

- aprovar financeiro
- gerar pagamento RH
- alterar folha

---

# 6.2 VALIDAÇÃO OPERACIONAL

## Objetivo

Validar:
- legitimidade do custo
- vínculo operacional
- valor
- justificativa

---

## Deve permitir

- aprovar custo
- devolver custo
- justificar devolução

---

## IMPORTANTE

Custos Extras:
# NÃO passam pelo RH.

---

# 6.3 CENTRAL FINANCEIRA

## Objetivo

Receber:
- despesas aprovadas
- valores consolidados
- centro de custo relacionado

---

## Deve permitir

- consolidar despesa
- classificar centro de custo
- liberar pagamento operacional

---

# 6.4 CENTRO DE CUSTO

## Objetivo

Consolidar impacto financeiro operacional.

---

## Deve permitir

- visualizar despesas por categoria
- visualizar despesas por operação
- visualizar impacto mensal
- visualizar custo por cliente

---

# 7. PIPELINE VISUAL

Toda etapa deve utilizar:
# OperationalPipelineModal

---

# Pipeline esperado

```text
Lançamento
↓
Validação Operacional
↓
Financeiro
↓
Centro de Custo
↓
Concluído
```

---

# Estados oficiais

| Estado | Significado |
|---|---|
| pendente | aguardando |
| em_andamento | etapa atual |
| concluido | finalizado |
| bloqueado | inconsistência |
| devolvido | retornou etapa |
| cancelado | encerrado |

---

# 8. UX OPERACIONAL

O sistema deve:
- conduzir usuário
- mostrar responsável atual
- explicar próxima etapa
- evitar ambiguidades financeiras

---

# IMPORTANTE

Após:
- validação operacional →
abrir pipeline direcionando Financeiro

Após:
- financeiro →
direcionar Centro de Custo

---

# 9. REGRAS FINANCEIRAS

---

# Custos Extras geram:

- despesa operacional
- reflexo financeiro
- impacto em margem
- impacto em resultado

---

# NÃO geram

- folha CLT
- banco de horas
- crédito RH

---

# 10. REGRAS PROIBIDAS

---

# PROIBIDO

- misturar com RH
- gerar folha automaticamente
- gerar banco de horas
- encarregado aprovar financeiro
- recalcular despesas no front-end

---

# 11. REFLEXOS SISTÊMICOS

| Ação | Impacta |
|---|---|
| lançamento custo | validação |
| validação | financeiro |
| financeiro | centro custo |
| centro custo | dashboard |

---

# 12. TRATAMENTO DE FALHAS

---

# Falha operacional

Exemplos:
- valor zerado
- justificativa ausente
- operação inexistente

Comportamento:
- bloquear validação
- exigir correção

---

# Falha financeira

Exemplos:
- centro custo inválido
- despesa inconsistente

Comportamento:
- bloquear consolidação
- devolver operação

---

# Falha de rastreabilidade

Exemplos:
- custo sem origem
- usuário inexistente

Comportamento:
- bloquear aprovação
- abrir alerta operacional

---

# 13. DASHBOARD

## Deve mostrar

- despesas totais
- despesas por categoria
- despesas por operação
- impacto financeiro
- margem operacional

---

## NÃO deve

- misturar custo com folha
- recalcular despesa no front-end

---

# 14. CHECKLIST AUTOMÁTICO

---

# Operacional

- [ ] custo lançado corretamente
- [ ] justificativa preenchida
- [ ] competência correta

---

# Validação

- [ ] custo validado
- [ ] inconsistências tratadas

---

# Financeiro

- [ ] despesa consolidada
- [ ] centro custo correto

---

# Dashboard

- [ ] despesa refletida
- [ ] margem atualizada

---

# 15. CRITÉRIOS DE ACEITE

O fluxo Custos Extras será considerado válido quando:

- o encarregado consegue lançar
- a validação operacional funciona
- o financeiro consolida corretamente
- o centro de custo reflete corretamente
- o dashboard mostra impacto real
- não existe mistura com RH

---

# 16. OBJETIVO FINAL

O fluxo Custos Extras do ORBE deve funcionar como:

# PIPELINE OPERACIONAL → FINANCEIRO → CENTRO DE CUSTO

Onde:
- o operacional lança
- a operação valida
- o financeiro consolida
- o dashboard audita

Sem:
- mistura com RH
- perda de rastreabilidade
- despesas invisíveis
- inconsistência financeira

---

# FIM DA SKILL