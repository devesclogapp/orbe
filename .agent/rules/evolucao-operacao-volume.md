---
trigger: always_on
---

Perfeito. Na verdade, esse prompt é tão importante quanto a própria implementação. Neste momento do projeto, o ORBE já possui diversos módulos homologados, e qualquer alteração estrutural pode gerar regressões em funcionalidades que já estão estáveis.

Eu faria o pedido abaixo ao Antigravity:

---

# IMPLEMENTAÇÃO CONTROLADA — EVOLUÇÃO DO PIPELINE DE RECEITAS OPERACIONAIS

## Contexto

Estamos na fase final de homologação do ERP ORBE.

Durante a validação funcional foi identificado que o fluxo de **Operações por Volume** necessita evoluir para suportar corretamente o ciclo completo das **Receitas Operacionais**, desde a execução do serviço até a cobrança e o recebimento do cliente.

**Atenção:** este trabalho é uma **evolução da arquitetura**, não uma refatoração geral do sistema.

O projeto encontra-se em fase avançada de homologação e diversos módulos já foram estabilizados.

O objetivo é implementar as novas funcionalidades **sem provocar regressões**.

---

# Regra mais importante

## NÃO alterar funcionalidades já homologadas.

Antes de modificar qualquer arquivo:

* mapear toda a cadeia de dependências;
* identificar impactos;
* preservar contratos existentes;
* preservar APIs;
* preservar componentes compartilhados;
* preservar interfaces públicas;
* preservar nomenclaturas utilizadas pelos demais módulos.

A implementação deve ser **incremental**.

Não realizar reestruturações desnecessárias.

---

# Fluxos que NÃO devem sofrer alteração

Não modificar comportamento dos seguintes módulos:

### RH

* Processamento RH
* Aprovações RH
* Banco de Horas
* Pontos CLT
* Pontos Intermitentes
* Diaristas
* Horas Extras
* Adicional Noturno
* Fechamentos RH

---

### Financeiro de Despesas

Não alterar:

* Lotes RH
* CNAB
* Remessas
* Retornos Bancários
* Pagamentos
* Contas a Pagar

---

### Operacional

Não alterar:

* Cadastro de Empresas
* Cadastro de Transportadoras
* Cadastro de Fornecedores
* Cadastro de Produtos
* Cadastro de Colaboradores
* Onboarding
* Permissões
* Auditoria existente
* Histórico existente

---

### Automações

Não alterar:

* Integração TIO Digital
* Importação de Colaboradores
* Importação de Pontos
* REP
* N8N
* Edge Functions
* Integrações já homologadas

---

# O que será implementado

Somente a evolução do pipeline das **Receitas Operacionais**.

Este pipeline deverá contemplar:

```text
Receita Executada

↓

Classificação Financeira

↓

Caixa Imediato
ou
Duplicatas
ou
Faturamento Mensal

↓

Cobranças

↓

Contas a Receber

↓

Recebimento

↓

Conciliação
```

---

# Princípios obrigatórios

## 1.

Não reutilizar código do RH para controlar Receitas.

---

## 2.

Não alterar regras de pagamento de colaboradores.

---

## 3.

Não alterar processamento de horas.

---

## 4.

Não alterar regras dos intermitentes.

---

## 5.

Não alterar regras dos diaristas.

---

## 6.

Não alterar cálculos financeiros existentes.

---

## 7.

Toda nova funcionalidade deve ser desacoplada.

Se necessário:

* criar novos services;
* novos hooks;
* novas queries;
* novas tabelas auxiliares;
* novas views.

Evitar alterar estruturas utilizadas pelos módulos já estabilizados.

---

# Estratégia de implementação

Executar obrigatoriamente nesta ordem.

## Etapa 1

Mapear toda a arquitetura atual.

Entender:

* serviços;
* componentes;
* hooks;
* banco;
* relacionamentos;
* dependências.

Nenhuma alteração ainda.

---

## Etapa 2

Produzir relatório técnico contendo:

* pontos de impacto;
* riscos;
* módulos afetados;
* dependências.

---

## Etapa 3

Implementar somente a menor alteração possível.

Priorizar:

**Extensão**, nunca **substituição**.

---

## Etapa 4

Executar análise de regressão.

Validar que continuam funcionando:

* RH;
* Financeiro;
* Operações;
* Onboarding;
* Cadastros;
* Dashboards;
* Auditoria.

---

## Etapa 5

Executar varredura final.

Verificar:

* imports quebrados;
* tipos TypeScript;
* queries;
* RLS;
* permissões;
* migrations;
* componentes compartilhados;
* efeitos colaterais.

---

# Objetivo arquitetural

O ORBE deverá possuir dois pipelines completamente independentes.

## Pipeline de Despesas

```text
RH

↓

Financeiro

↓

CNAB

↓

Pagamento
```

---

## Pipeline de Receitas

```text
Operações

↓

Receita Executada

↓

Cobrança

↓

Recebimento

↓

Conciliação
```

Ambos poderão compartilhar apenas elementos genéricos da plataforma (autenticação, auditoria, permissões, componentes visuais), mas **jamais regras de negócio**.

---

# Entregáveis esperados

Ao final da implementação apresentar:

* Arquivos alterados.
* Novos arquivos criados.
* Migrations.
* Novas tabelas (se houver).
* Novas views (se houver).
* Novos services.
* Fluxograma atualizado.
* Relatório de impacto.
* Testes executados.
* Evidências de que não houve regressão.

---

## Diretriz final

**A estabilidade do ORBE é prioridade absoluta.**

Sempre que existir dúvida entre **alterar uma funcionalidade existente** ou **criar uma nova camada desacoplada**, optar pela segunda alternativa.

O objetivo desta implementação é **evoluir a arquitetura**, preservando tudo o que já foi homologado e garantindo compatibilidade com os módulos atuais e futuros.
