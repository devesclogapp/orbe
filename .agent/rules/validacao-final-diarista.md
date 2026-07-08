---
trigger: always_on
---

# ORBE ERP ESC LOG 2026
# DOMÍNIO 02 — DIARISTAS
# ETAPA 02 — HOMOLOGAÇÃO E2E (END-TO-END)

## Objetivo

Validar o Pipeline completo do módulo de Diaristas desde o lançamento pelo Encarregado até a conclusão do pagamento, garantindo que todas as etapas funcionem de forma integrada.

Nesta fase NÃO iremos procurar problemas de arquitetura.

A arquitetura já foi auditada.

Agora queremos validar exclusivamente o comportamento funcional do ERP.

---

# Metodologia

Atuar como:

- Auditor Funcional
- QA Sênior
- Especialista em ERP

Não atuar como programador.

Percorrer todo o pipeline sem interrupções.

Somente interromper caso exista erro impeditivo.

---

# PIPELINE A SER VALIDADO

Encarregado

↓

Grade Semanal

↓

Lançamentos

↓

Fechamento da Semana

↓

Lote RH

↓

Validação RH

↓

Financeiro

↓

CNAB

↓

Retorno Bancário

↓

Pagamento

↓

Dashboard

↓

Timeline

↓

Auditoria

---

# PASSO 01

## Lançamento pelo Encarregado

Validar:

- abertura da grade semanal;
- carregamento dos diaristas;
- carregamento dos códigos de marcação;
- alternância dos códigos (P, MP, F...);
- cálculo automático da diária;
- atualização visual da grade.

Responder:

✔ Tudo carregou corretamente?

✔ O valor foi calculado corretamente?

✔ O lançamento foi salvo?

✔ Houve alguma inconsistência visual?

---

# PASSO 02

## Fechamento da Semana

Validar:

Ao clicar em "Fechar Período":

- todos os lançamentos são agrupados;
- nasce apenas um lote;
- nenhum lançamento fica órfão;
- status muda para AGUARDANDO_VALIDACAO_RH.

Responder:

O lote foi criado corretamente?

Quantidade de registros.

Valor total.

Empresa.

Semana.

---

# PASSO 03

## Painel RH

Validar:

O lote aparece imediatamente?

As informações conferem?

Existe possibilidade de análise?

Existe possibilidade de rejeição?

Existe possibilidade de aprovação?

Validar:

- filtros;
- pesquisa;
- badges;
- KPIs.

---

# PASSO 04

## Aprovação RH

Ao aprovar:

Validar:

- alteração de status;
- atualização visual;
- criação do lote financeiro;
- ausência de duplicidade.

Responder:

O lote saiu corretamente da fila RH?

Foi criado apenas uma vez?

---

# PASSO 05

## Financeiro

Validar:

O lote aparece automaticamente?

As informações financeiras estão corretas?

Validar:

- empresa;
- período;
- quantidade de diaristas;
- valor total;
- status.

---

# PASSO 06

## CNAB

Validar:

Geração da remessa.

Responder:

Foi gerado apenas um arquivo?

Todos os colaboradores foram incluídos?

Existe divergência entre lote e remessa?

Há possibilidade de gerar remessa duplicada?

---

# PASSO 07

## Retorno Bancário

Validar:

Importação.

Liquidação.

Baixa.

Responder:

Todos os pagamentos foram conciliados?

Existe pagamento parcial?

Existe duplicidade?

---

# PASSO 08

## Pagamento

Validar:

Status do lote.

Status dos diaristas.

Status financeiro.

Dashboard.

KPIs.

---

# PASSO 09

## Timeline

Validar:

Todos os eventos foram registrados?

Ordem cronológica correta?

Usuário correto?

Datas corretas?

---

# PASSO 10

## Auditoria

Validar:

Audit Log.

Snapshots.

Histórico.

Justificativas.

Usuários.

---

# Critérios Obrigatórios

Durante toda a execução observar:

✔ Idempotência

✔ Concorrência

✔ Imutabilidade

✔ Governança

✔ Domain Hardening

✔ OCC

✔ Auditoria

✔ UX

✔ Navegação

✔ Performance

Não executar testes destrutivos nesta etapa.

---

# Entregável

Gerar um relatório contendo exclusivamente:

## PASSO

Objetivo

↓

Execução

↓

Resultado Esperado

↓

Resultado Obtido

↓

Evidências

↓

Bug encontrado (se houver)

↓

Criticidade

↓

Próximo passo

---

# Importante

Caso um bug crítico interrompa o pipeline, parar imediatamente a homologação e reportar:

- etapa interrompida;
- impacto;
- causa provável;
- risco operacional;
- proposta de correção.

Somente após autorização prosseguir.

O objetivo desta etapa é homologar o pipeline completo de Diaristas exatamente como um usuário real executaria em produção.