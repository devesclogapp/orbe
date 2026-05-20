---
trigger: always_on
---

# ORBE_SKILL_SERVICOS_EXTRAS.md

# SKILL — Fluxo Serviços Extras / Receita Extra / Financeiro

> Skill oficial do fluxo de Serviços Extras do ERP ORBE.
>
> Esta skill define:
>
> - entrada de serviços extras
> - aprovação operacional
> - geração de receita adicional
> - reflexo financeiro
> - faturamento
> - dashboard
> - rastreabilidade
> - pipeline visual
>
> Toda implementação relacionada a:
>
> - serviços extras
> - adicionais operacionais
> - receitas extras
> - serviços fora de contrato
> - faturamento adicional
>
> deve obrigatoriamente consultar:
>
> 1. ORBE_MASTER_FLOW_ARCHITECTURE.md
> 2. ORBE_SKILL_SERVICOS_EXTRAS.md

---

# 1. OBJETIVO DO FLUXO

Controlar serviços extras executados fora do escopo operacional padrão:

```text
Lançamento
↓
Validação Operacional
↓
Aprovação
↓
Financeiro
↓
Faturamento
↓
Recebimento
↓
Dashboard
```

Garantindo:
- rastreabilidade
- autorização operacional
- geração correta de receita
- governança financeira
- auditabilidade

---

# 2. DEFINIÇÃO OFICIAL

Serviços Extras representam:
# RECEITAS OPERACIONAIS ADICIONAIS

Exemplos:
- carga adicional
- descarga adicional
- lavagem
- palletização
- separação
- etiquetagem
- armazenamento extra
- movimentação extraordinária

---

# IMPORTANTE

Serviços Extras:
- podem gerar receita
- podem gerar custo operacional
- podem gerar pagamento operacional futuro

Mas:
# NÃO pertencem diretamente ao RH CLT.

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
| cliente | sim |
| operação relacionada | sim |
| tipo serviço | sim |
| quantidade | sim |
| valor unitário | sim |
| valor total | sim |
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
Aprovação
↓
Financeiro
↓
Faturamento
↓
Recebimento
↓
Dashboard
```

---

# 5. RESPONSABILIDADE POR ETAPA

| Etapa | Responsável |
|---|---|
| Lançamento | Encarregado |
| Validação operacional | Operação |
| Aprovação | ADM / Gestor |
| Consolidação financeira | Financeiro |
| Faturamento | Financeiro |
| Recebimento | Financeiro |
| Dashboard | ADM |

---

# 6. TELAS OFICIAIS

---

# 6.1 LANÇAMENTO SERVIÇO EXTRA

## Objetivo

Registrar serviço adicional executado.

---

## Deve permitir

- selecionar cliente
- selecionar operação
- selecionar serviço
- definir quantidade
- calcular valor
- justificar lançamento

---

## NÃO deve

- aprovar financeiro
- gerar recebimento
- gerar CNAB

---

# 6.2 VALIDAÇÃO OPERACIONAL

## Objetivo

Validar:
- legitimidade
- execução operacional
- quantidade
- valores
- vínculo com operação

---

## Deve permitir

- aprovar operacionalmente
- devolver
- justificar devolução

---

# 6.3 APROVAÇÃO

## Objetivo

Autorizar oficialmente cobrança/faturamento.

---

## Deve permitir

- aprovar receita
- bloquear faturamento indevido
- validar impacto financeiro

---

## IMPORTANTE

Nenhum serviço extra deve:
# entrar no financeiro sem aprovação.

---

# 6.4 CENTRAL FINANCEIRA

## Objetivo

Receber:
- serviços aprovados
- valores consolidados
- receita operacional

---

## Deve permitir

- consolidar receita
- preparar faturamento
- gerar títulos

---

# 6.5 FATURAMENTO

## Objetivo

Gerar:
- cobrança
- título
- boleto
- faturamento mensal

---

# 6.6 RECEBIMENTO

## Objetivo

Controlar:
- liquidação
- inadimplência
- recebimento efetivo

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
Aprovação
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

# 8. UX OPERACIONAL

O sistema deve:
- conduzir usuário
- mostrar etapa atual
- indicar responsável
- evitar faturamento indevido

---

# IMPORTANTE

Após:
- validação operacional →
abrir pipeline direcionando Aprovação

Após:
- aprovação →
direcionar Financeiro

Após:
- faturamento →
direcionar Recebimento

---

# 9. REGRAS FINANCEIRAS

---

# Serviços Extras geram:

- receita adicional
- faturamento adicional
- impacto em margem
- reflexo dashboard

---

# Serviços Extras podem gerar:

- custo operacional
- pagamento operacional futuro

Mas isso:
# NÃO deve ser automático.

---

# 10. REGRAS PROIBIDAS

---

# PROIBIDO

- faturar sem aprovação
- financeiro validar execução operacional
- encarregado aprovar receita
- recalcular receita no front-end
- misturar com folha CLT

---

# 11. REFLEXOS SISTÊMICOS

| Ação | Impacta |
|---|---|
| lançamento serviço | validação |
| validação | aprovação |
| aprovação | financeiro |
| financeiro | faturamento |
| faturamento | recebimento |
| recebimento | dashboard |

---

# 12. TRATAMENTO DE FALHAS

---

# Falha operacional

Exemplos:
- quantidade inválida
- serviço inexistente
- valor zerado

Comportamento:
- bloquear validação
- exigir correção

---

# Falha aprovação

Exemplos:
- cobrança indevida
- serviço não autorizado

Comportamento:
- bloquear financeiro
- devolver operacional

---

# Falha financeira

Exemplos:
- título inválido
- faturamento divergente

Comportamento:
- bloquear cobrança
- abrir alerta financeiro

---

# Falha recebimento

Exemplos:
- inadimplência
- boleto rejeitado

Comportamento:
- abrir pendência financeira
- manter rastreabilidade

---

# 13. DASHBOARD

## Deve mostrar

- receita extra total
- serviços por cliente
- margem adicional
- recebimentos
- inadimplência

---

## NÃO deve

- recalcular receita no front-end
- misturar receita extra com folha

---

# 14. CHECKLIST AUTOMÁTICO

---

# Operacional

- [ ] serviço lançado corretamente
- [ ] valores corretos
- [ ] competência correta

---

# Validação

- [ ] serviço validado
- [ ] inconsistências tratadas

---

# Aprovação

- [ ] receita aprovada
- [ ] autorização registrada

---

# Financeiro

- [ ] faturamento correto
- [ ] títulos corretos

---

# Recebimento

- [ ] recebimento conciliado
- [ ] inadimplência controlada

---

# Dashboard

- [ ] receita refletida
- [ ] margem atualizada

---

# 15. CRITÉRIOS DE ACEITE

O fluxo Serviços Extras será considerado válido quando:

- o encarregado consegue lançar
- a validação operacional funciona
- a aprovação controla a receita
- o financeiro consolida corretamente
- o faturamento ocorre corretamente
- o recebimento é rastreável
- o dashboard reflete corretamente

---

# 16. OBJETIVO FINAL

O fluxo Serviços Extras do ORBE deve funcionar como:

# PIPELINE OPERACIONAL → APROVAÇÃO → FINANCEIRO → FATURAMENTO

Onde:
- o operacional lança
- a operação valida
- a gestão aprova
- o financeiro consolida
- o faturamento cobra
- o dashboard audita

Sem:
- faturamento indevido
- perda de rastreabilidade
- receitas invisíveis
- confusão operacional

---

# FIM DA SKILL