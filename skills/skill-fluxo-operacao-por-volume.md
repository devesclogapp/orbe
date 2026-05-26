---
trigger: always_on
---

# ORBE_SKILL_OPERACAO_VOLUME.md

# SKILL — Fluxo Operação por Volume / Faturamento / Financeiro

> Skill oficial do fluxo de Operações por Volume do ERP ORBE.
>
> Esta skill define:
>
> - entrada operacional logística
> - faturamento por volume
> - modalidades de cobrança
> - validação operacional
> - financeiro
> - dashboard
> - rastreabilidade
> - pipeline visual
>
> Toda implementação relacionada a:
>
> - operações logísticas
> - carga/descarga
> - volume operacional
> - faturamento
> - boleto
> - à vista
> - faturamento mensal
>
> deve obrigatoriamente consultar:
>
> 1. ORBE_MASTER_FLOW_ARCHITECTURE.md
> 2. ORBE_SKILL_OPERACAO_VOLUME.md

---

# 1. OBJETIVO DO FLUXO

Controlar operações logísticas faturadas por volume operacional:

```text
Lançamento Operacional
↓
Validação Operacional
↓
Consolidação Financeira
↓
Faturamento
↓
Recebimento
↓
Dashboard
```

Garantindo:
- rastreabilidade
- cálculo correto
- coerência financeira
- separação operacional
- auditabilidade

---

# 2. DEFINIÇÃO OFICIAL

## Operação por Volume é UM ÚNICO FLUXO.

As modalidades:
- à vista
- boleto
- faturamento mensal

NÃO representam fluxos diferentes.

Mudam apenas:
# forma de cobrança/pagamento.

---

# PROIBIDO

- criar telas separadas
- criar pipelines separados
- duplicar regras
- duplicar dashboards

---

# 3. INPUT OFICIAL

## Origem permitida

- encarregado operacional
- portal operacional
- integração futura

---

# Campos mínimos obrigatórios

| Campo | Obrigatório |
|---|---|
| empresa | sim |
| cliente | sim |
| operação | sim |
| tipo operação | sim |
| volume | sim |
| valor unitário | sim |
| modalidade cobrança | sim |
| competência YYYY-MM | sim |
| encarregado origem | sim |

---

# 4. MODALIDADES OFICIAIS

| Modalidade | Comportamento |
|---|---|
| À vista | cobrança imediata |
| Boleto | título financeiro |
| Faturamento mensal | consolidação competência |

---

# 5. PIPELINE OFICIAL

```text
Lançamento Operacional
↓
Validação Operacional
↓
Consolidação Financeira
↓
Faturamento
↓
Recebimento
↓
Dashboard
```

---

# 6. RESPONSABILIDADE POR ETAPA

| Etapa | Responsável |
|---|---|
| Lançamento | Encarregado |
| Validação | Operação |
| Consolidação | Financeiro |
| Faturamento | Financeiro |
| Recebimento | Financeiro |
| Dashboard | ADM |

---

# 7. TELAS OFICIAIS

---

# 7.1 LANÇAMENTO OPERACIONAL

## Objetivo

Entrada operacional da operação logística.

---

## Deve permitir

- lançar operação
- selecionar cliente
- selecionar modalidade
- definir volume
- calcular valor

---

## NÃO deve

- aprovar financeiro
- gerar título bancário
- gerar CNAB

---

# 7.2 VALIDAÇÃO OPERACIONAL

## Objetivo

Validar:
- volume
- operação
- cliente
- valores
- consistência operacional

---

## Deve permitir

- aprovar operação
- devolver operação
- justificar devolução

---

# 7.3 CENTRAL FINANCEIRA

## Objetivo

Receber:
- operações aprovadas
- valores consolidados
- modalidade financeira

---

## Deve permitir

- consolidar faturamento
- gerar títulos
- preparar recebimento

---

# 7.4 RECEBIMENTO

## Objetivo

Controlar:
- pagamentos recebidos
- boletos
- liquidações
- inadimplência

---

## Deve permitir

- conciliar recebimento
- registrar pagamento
- atualizar dashboard

---

# 8. PIPELINE VISUAL

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
Faturamento
↓
Recebimento
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

# 9. UX OPERACIONAL

O sistema deve:
- conduzir operador
- indicar próxima ação
- evitar duplicidade
- evitar telas paralelas

---

# IMPORTANTE

Após:
- validação operacional →
abrir pipeline direcionando Financeiro

Após:
- consolidação financeira →
direcionar faturamento

Após:
- faturamento →
direcionar recebimento

---

# 10. REGRAS FINANCEIRAS

---

# À vista

- gera recebimento imediato
- pode gerar caixa direto

---

# Boleto

- gera título financeiro
- aguarda liquidação

---

# Faturamento mensal

- consolida competência
- gera cobrança mensal

---

# IMPORTANTE

Todos permanecem:
# MESMO FLUXO OPERACIONAL

---

# 11. REGRAS PROIBIDAS

---

# PROIBIDO

- separar módulos por modalidade
- recalcular faturamento no front-end
- financeiro alterar operação original
- operador aprovar financeiro

---

# 12. REFLEXOS SISTÊMICOS

| Ação | Impacta |
|---|---|
| lançamento operacional | validação |
| validação | financeiro |
| financeiro | faturamento |
| faturamento | recebimento |
| recebimento | dashboard |

---

# 13. TRATAMENTO DE FALHAS

---

# Falha operacional

Exemplos:
- volume inválido
- cliente inexistente
- valor zerado

Comportamento:
- bloquear validação
- exigir correção

---

# Falha financeira

Exemplos:
- modalidade inválida
- título inconsistente

Comportamento:
- bloquear faturamento
- devolver operação

---

# Falha recebimento

Exemplos:
- boleto rejeitado
- pagamento não conciliado

Comportamento:
- abrir pendência financeira
- manter rastreabilidade

---

# 14. DASHBOARD

## Deve mostrar

- volume total
- faturamento total
- recebimentos
- inadimplência
- operações por cliente
- operações por modalidade

---

## NÃO deve

- recalcular operação no front-end
- duplicar receita

---

# 15. CHECKLIST AUTOMÁTICO

---

# Operacional

- [ ] operação lançada corretamente
- [ ] volume correto
- [ ] modalidade correta

---

# Validação

- [ ] operação validada
- [ ] inconsistências tratadas

---

# Financeiro

- [ ] faturamento correto
- [ ] títulos corretos

---

# Recebimento

- [ ] pagamento conciliado
- [ ] status atualizado

---

# Dashboard

- [ ] receita correta
- [ ] rastreabilidade correta

---

# 16. CRITÉRIOS DE ACEITE

O fluxo Operação por Volume será considerado válido quando:

- o encarregado consegue lançar
- a operação valida corretamente
- o financeiro consolida
- o faturamento ocorre corretamente
- o recebimento é rastreável
- o dashboard reflete corretamente
- não existem módulos duplicados por modalidade

---

# 17. OBJETIVO FINAL

O fluxo Operação por Volume do ORBE deve funcionar como:

# PIPELINE OPERACIONAL → FINANCEIRO → FATURAMENTO

Onde:
- o operacional lança
- a operação valida
- o financeiro consolida
- o faturamento cobra
- o recebimento concilia
- o dashboard audita

Sem:
- duplicidade
- múltiplos fluxos
- perda de rastreabilidade
- confusão financeira

---

# FIM DA SKILL