---
trigger: always_on
---

# ORBE_MASTER_FLOW_ARCHITECTURE.md

# ORBE ERP — Arquitetura Mestre de Fluxos Operacionais

> Documento mestre de arquitetura operacional do ERP ORBE.
>
> Este documento define:
>
> - os fluxos oficiais do sistema
> - responsabilidades por setor
> - regras sistêmicas
> - impacto entre módulos
> - condução operacional
> - pipelines obrigatórios
> - restrições arquiteturais
>
> Toda implementação futura DEVE obrigatoriamente consultar este documento antes de alterar:
>
> - telas
> - serviços
> - pipelines
> - regras financeiras
> - regras RH
> - banco de horas
> - CNAB
> - dashboard
> - relatórios

---

# 1. PRINCÍPIO CENTRAL DO ERP

O ORBE NÃO é um conjunto de telas.

O ORBE é um:
# PIPELINE OPERACIONAL GUIADO

Toda ação executada:
- deve gerar consequência sistêmica
- deve atualizar os módulos relacionados
- deve conduzir o usuário para a próxima etapa
- deve possuir rastreabilidade
- deve possuir responsabilidade setorial

---

# 2. PILARES DO SISTEMA

| Pilar | Objetivo |
|---|---|
| RH | Processamento operacional humano |
| Financeiro | Consolidação financeira |
| Operacional | Entrada operacional logística |
| Bancário | Remessas e retorno |
| Governança | Auditoria e rastreabilidade |
| Dashboard | Consolidação estratégica |

---

# 3. SETORIZAÇÃO OFICIAL

## ADMIN

Possui acesso:
- total
- global
- multiempresa
- auditoria
- governança
- parametrização

Pode:
- visualizar tudo
- corrigir tudo
- liberar acessos
- criar usuários
- visualizar pipelines

---

## RH

Responsável por:
- pontos
- banco de horas
- processamento RH
- compensações
- ajustes manuais
- fechamento RH
- diaristas

NÃO pode:
- gerar CNAB
- aprovar financeiro
- conciliar bancário

---

## FINANCEIRO

Responsável por:
- aprovação financeira
- consolidação
- contas bancárias
- remessas
- CNAB
- retorno bancário
- pagamentos

NÃO pode:
- alterar processamento RH
- alterar ponto original
- alterar ajustes operacionais RH

---

## ENCARREGADO / PORTAL

Responsável por:
- lançamentos operacionais
- serviços extras
- custos extras
- diaristas
- operações logísticas

NÃO pode:
- visualizar financeiro
- visualizar RH consolidado
- visualizar dashboards estratégicos

---

# 4. INPUTS OFICIAIS DO SISTEMA

---

# 4.1 PONTOS COLETADOS (CLT)

## Entrada

Origem:
- API
- Importação de planilha
- Integração futura relógio ponto

## Fluxo oficial

```text
Importação →
Processamento RH →
Banco de Horas →
Fechamento RH →
Central Financeira →
CNAB →
Pagamento →
Dashboard →
Relatórios
```

## Responsabilidade

| Etapa | Responsável |
|---|---|
| Importação | RH |
| Processamento | RH |
| Ajustes | RH |
| Aprovação financeira | Financeiro |
| Remessa | Financeiro |
| Relatórios | ADM |

---

# 4.2 DIARISTAS

## Entrada

Origem:
- lançamento encarregado
- importação
- lote manual

## Fluxo oficial

```text
Lançamento →
Fechamento lote →
Validação RH →
Aprovação Financeira →
CNAB/Pagamento →
Dashboard
```

---

# 4.3 OPERAÇÃO POR VOLUME

## Tipos

- À vista
- Boleto
- Faturamento mensal

## IMPORTANTE

Os 3 tipos:
# pertencem ao MESMO fluxo operacional

O que muda:
- apenas forma de pagamento

NÃO criar:
- telas separadas
- pipelines separados
- módulos separados

---

## Fluxo oficial

```text
Lançamento operacional →
Conferência →
Financeiro →
Faturamento →
Recebimento →
Dashboard
```

---

# 4.4 CUSTOS EXTRAS

## Objetivo

Registrar:
- combustível
- avaria
- diária extra
- despesas operacionais

## Fluxo oficial

```text
Lançamento →
Validação →
Financeiro →
Centro de custo →
Dashboard
```

---

# 4.5 SERVIÇOS EXTRAS

## Objetivo

Registrar:
- serviços fora do escopo
- carga extra
- lavagem
- pallet
- adicionais

## Fluxo oficial

```text
Lançamento →
Validação →
Financeiro →
Faturamento →
Dashboard
```

---

# 5. TELAS E RESPONSABILIDADES

---

# 5.1 PONTOS RECEBIDOS

## Objetivo

Tela de:
- entrada
- rastreabilidade
- importação
- sincronização

## NÃO deve:

- processar RH
- compensar banco
- fechar competência

---

# 5.2 PROCESSAMENTO RH

## Objetivo

CENTRAL OPERACIONAL RH

## Responsável por:

- processamento
- regras
- ajustes individuais
- compensações
- justificativas
- reprocessamento
- inconsistências

## Deve possuir:

- drawer operacional
- histórico
- rastreabilidade
- ações rápidas

## NÃO deve:

- aprovar financeiro
- gerar CNAB
- consolidar pagamento

---

# 5.3 BANCO DE HORAS

## Objetivo

VISÃO CONSOLIDADA RH

## Responsável por:

- visão financeira RH
- saldos acumulados
- fechamento
- exportações
- risco financeiro

## NÃO deve:

- editar individualmente
- ajustar manualmente
- lançar créditos individuais

---

# 5.4 FECHAMENTO RH

## Objetivo

Validar competência RH antes do financeiro.

## Responsável por:

- fechamento oficial RH
- travamento operacional
- envio ao financeiro

---

# 5.5 CENTRAL FINANCEIRA

## Objetivo

Consolidar:
- lotes
- aprovações
- valores
- competências

## Responsável por:

- aprovação financeira
- consolidação
- preparação bancária

---

# 5.6 CENTRAL BANCÁRIA

## Objetivo

Gerar:
- remessas
- CNAB
- retorno
- conciliação

---

# 5.7 DASHBOARD

## Objetivo

VISÃO ESTRATÉGICA

## Deve consumir:

- somente dados consolidados
- somente fontes oficiais
- nunca recalcular regras no front-end

---

# 6. PIPELINE VISUAL OBRIGATÓRIO

Toda etapa operacional deve:

- abrir pipeline modal
- mostrar progresso
- mostrar responsável
- mostrar próxima ação
- permitir navegação guiada

---

# 7. REGRA DE CONDUÇÃO UX

O usuário:
# NUNCA deve adivinhar o próximo passo.

O sistema:
- conduz
- recomenda
- desbloqueia
- direciona

---

# 8. REGRAS ARQUITETURAIS CRÍTICAS

---

# 8.1 PROIBIDO

## NÃO criar:
- novas telas duplicadas
- novos fluxos paralelos
- novas competências artificiais
- regras financeiras no front
- múltiplos fechamentos

---

# 8.2 SEMPRE

## Toda alteração deve:
- atualizar pipeline
- atualizar auditoria
- atualizar dashboard
- atualizar logs
- atualizar financeiro

---

# 9. MATRIZ DE IMPACTO

| Alteração | Impacta |
|---|---|
| Ajuste RH | Banco de Horas |
| Banco de Horas | Financeiro |
| Financeiro | CNAB |
| CNAB | Dashboard |
| Operação | Financeiro |
| Custos Extras | Centro de custo |
| Serviços Extras | Receita |

---

# 10. GOVERNANÇA

Toda ação operacional deve possuir:

- usuário executor
- timestamp
- justificativa
- origem
- rastreabilidade

---

# 11. COMPETÊNCIA OFICIAL

Formato obrigatório:
```text
YYYY-MM
```

Exemplo:
```text
2026-06
```

## PROIBIDO

- hardcode
- timezone divergente
- múltiplos formatos

---

# 12. RELATÓRIOS

Os relatórios devem refletir:
- somente dados consolidados
- somente dados oficiais
- nunca dados intermediários

---

# 13. FLUXO OFICIAL DE IMPLEMENTAÇÃO

Toda task futura deve seguir:

```text
1. Consultar ORBE_MASTER_FLOW_ARCHITECTURE.md
2. Identificar fluxo afetado
3. Identificar impacto sistêmico
4. Atualizar pipeline
5. Atualizar auditoria
6. Atualizar rastreabilidade
7. Validar reflexos
8. Validar dashboard
9. Executar build
10. Executar checklist manual
```

---

# 14. OBJETIVO FINAL DO ORBE

O ORBE deve funcionar como:

# ERP OPERACIONAL GUIADO

Onde:
- o usuário não se perde
- os setores se conectam
- os fluxos são rastreáveis
- os dados são consolidados
- os pipelines conduzem a operação
- o financeiro herda do operacional
- o dashboard herda do financeiro
- toda ação possui reflexo sistêmico

---

# FIM DO DOCUMENTO