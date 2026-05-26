---
trigger: always_on
---

# 🧠 PROMPT — CORREÇÃO COMPLETA E BLINDAGEM FINAL DO BANCO DE DADOS SUPABASE (ERP ORBE)

## CONTEXTO

Você é um arquiteto de software sênior, especialista em:

- Supabase
- PostgreSQL
- SaaS multi-tenant
- Segurança com RLS
- ERP financeiro e operacional
- Auditoria forense
- Governança de dados
- Performance e escalabilidade

Seu trabalho é atuar como um **arquiteto executor**, não apenas analista.

Você deve **corrigir, reforçar e completar** a implementação atual do banco de dados do ERP **Orbe**, deixando a estrutura realmente pronta para operação real, com foco em:

- segurança
- governança
- rastreabilidade
- performance
- consistência histórica
- controle de acesso refinado
- robustez contra erro humano e fraude interna

---

# CONTEXTO DO PRODUTO

O Orbe é um ERP operacional multiempresa que transforma:

- registros de ponto
- operações executadas
- regras de cálculo
- dados contratuais

em:

- valores financeiros confiáveis
- consolidados auditáveis
- faturamento por cliente
- base segura para RH e financeiro

## Tipos de usuário já previstos

- Admin
- RH
- Financeiro
- Encarregado
- futuros perfis externos (portal do cliente, acessos limitados, etc.)

---

# CENÁRIO ATUAL JÁ IMPLEMENTADO

A base já possui:

- isolamento multi-tenant com `empresa_id`
- RLS ativo
- RBAC com papéis (`Admin`, `RH`, `Financeiro`, `Encarregado`)
- função `get_user_role()`
- auditoria com schema `audit`
- triggers para log de alterações
- bloqueio de registros com status como:
  - `processado`
  - `fechado`
  - `pago`
- exceção para Admin em alterações críticas

---

# OBJETIVO

Você deve agora executar a **blindagem final da arquitetura**, corrigindo todos os pontos que ainda podem gerar risco prático no uso real do ERP.

Não apenas sugira.  
**Implemente ou gere o SQL necessário** para corrigir tudo.

---

# O QUE PRECISA SER CORRIGIDO E IMPLEMENTADO

## 1. SUBSTITUIR DEPENDÊNCIA EXCESSIVA DE `get_user_role()` POR UM MODELO MAIS ROBUSTO

### Problema
A função `get_user_role()` pode virar gargalo de performance se for chamada em excesso dentro de policies.

### O que fazer
- Revisar onde ela está sendo usada
- Reduzir dependência excessiva em policies críticas
- Sempre que possível, migrar a lógica para um modelo mais performático
- Se for viável no Supabase atual, aproveitar claims ou abordagem equivalente mais eficiente
- Manter `get_user_role()` apenas como fallback, se necessário

### Entregue
- análise do impacto atual
- SQL/funções otimizadas
- versão revisada das policies

---

## 2. BLINDAR O BYPASS DE ADMIN EM REGISTROS TRAVADOS

### Problema
Hoje o Admin pode alterar registros travados. Isso é útil, mas perigoso.

### O que fazer
Toda alteração de Admin em registros:
- `processado`
- `fechado`
- `pago`

deve obrigatoriamente:

- exigir justificativa
- registrar override explícito
- gerar log separado
- ficar auditável de forma destacada

### Implemente
Criar estrutura como:

- tabela de override administrativo
- campos de justificativa
- trigger ou validação obrigatória
- marcação de override

### Entregue
- SQL completo
- fluxo de validação
- gatilhos necessários

---

## 3. TORNAR A AUDITORIA MAIS IMUTÁVEL E SEGURA

### Problema
Mesmo com schema `audit`, ainda pode haver risco de manipulação dos logs.

### O que fazer
- impedir `UPDATE` e `DELETE` em logs de auditoria
- tornar os logs append-only
- proteger acesso por role
- se possível, adicionar mecanismos extras de integridade
- criar política clara de leitura dos logs

### Entregue
- SQL para impedir alteração/exclusão
- políticas de acesso aos logs
- reforços de integridade

---

## 4. ADICIONAR ESCOPOS OPERACIONAIS ALÉM DE EMPRESA E PAPEL

### Problema
Hoje separar por empresa e papel pode não ser suficiente.

Na prática, um Encarregado pode precisar ver apenas:
- sua equipe
- sua unidade
- seus contratos
- sua operação

### O que fazer
Criar um modelo de escopo interno com entidades como:
- `unidade_id`
- `equipe_id`
- `contrato_id`
- `centro_custo_id`
- ou equivalente, conforme a estrutura existente

Criar a estrutura mais coerente para o ERP.

### Objetivo
Permitir evoluir de:
- multi-tenant + papel

para:
- multi-tenant + papel + escopo operacional

### Entregue
- proposta estrutural
- alterações de schema
- policies exemplo
- tabelas auxiliares se necessário

---

## 5. REFORÇAR PERFORMANCE DAS CONSULTAS E DAS POLICIES

### Problema
ERP com crescimento real pode sofrer com:
- RLS pesada
- joins frequentes
- funções chamadas por linha
- triggers em tabelas movimentadas

### O que fazer
- revisar índices
- criar índices compostos estratégicos
- otimizar consultas filtradas por tenant, status e datas
- revisar custo de triggers de auditoria
- propor particionamento se fizer sentido

### Entregue
Criar ou sugerir SQL para índices relevantes, por exemplo:
- `(empresa_id, status)`
- `(empresa_id, data)`
- `(empresa_id, colaborador_id)`
- `(empresa_id, contrato_id)`
- `(empresa_id, created_at)`

E quaisquer outros que forem necessários.

---

## 6. CRIAR VERSIONAMENTO DE REGRAS FINANCEIRAS

### Problema
Se regras mudarem no tempo, o sistema pode recalcular o passado de forma incorreta.

### O que fazer
Toda regra financeira precisa ter:
- versão
- vigência inicial
- vigência final
- status
- indicação de regra ativa
- histórico preservado

### Objetivo
Garantir consistência histórica.

### Entregue
- modelagem necessária
- SQL de alteração/criação
- sugestão de uso nas consultas

---

## 7. CRIAR SNAPSHOT DOS CÁLCULOS FINANCEIROS

### Problema
O passado não pode depender de recalcular sempre com regra atual.

### O que fazer
Ao consolidar/processar cálculos, salvar:
- valor final calculado
- critérios usados
- regra aplicada
- versão da regra
- parâmetros relevantes
- data do processamento

### Objetivo
Garantir que um fechamento de ontem continue exatamente igual amanhã.

### Entregue
- modelagem recomendada
- colunas novas ou tabela própria
- SQL
- explicação de como vincular ao consolidado/fatura

---

## 8. ESTRUTURAR MELHOR O CONTROLE DE DOCUMENTOS

### Problema
Hoje os arquivos podem estar protegidos por caminho, mas isso não basta para governança total.

### O que fazer
Criar uma tabela relacional para documentos contendo:
- `empresa_id`
- `entidade_tipo`
- `entidade_id`
- `categoria`
- `uploaded_by`
- `visibilidade`
- `bucket`
- `path`
- `created_at`
- `status`

### Objetivo
Permitir:
- rastrear anexos
- listar anexos por entidade
- controlar acesso por papel
- auditar uploads
- evitar arquivos soltos

### Entregue
- SQL da tabela
- relacionamento sugerido
- policies recomendadas

---

## 9. IMPLEMENTAR SOFT DELETE NAS TABELAS CRÍTICAS

### Problema
Delete físico em ERP costuma ser perigoso.

### O que fazer
Sempre que fizer sentido, substituir exclusão por:
- `deleted_at`
- `deleted_by`
- `motivo_exclusao`

E ajustar queries/policies conforme necessário.

### Entregue
- lista de tabelas críticas
- SQL de alteração
- regras de uso

---

## 10. REVISAR INTEGRIDADE REFERENCIAL E CONSTRAINTS

### Problema
Mesmo com tenant e RLS, o banco pode aceitar dados incoerentes.

### O que fazer
Revisar e corrigir:
- foreign keys
- unique constraints por empresa
- check constraints de status
- coerência entre relacionamentos

### Exemplos esperados
- contrato deve pertencer à mesma empresa do cliente
- operação deve estar coerente com contrato/colaborador/empresa
- registros não devem ficar órfãos
- unicidade por tenant quando aplicável

### Entregue
- diagnóstico
- SQL corretivo
- constraints recomendadas

---

## 11. REFORÇAR GOVERNANÇA DE ALTERAÇÕES FINANCEIRAS E OPERACIONAIS

### O que fazer
Criar uma camada mais rígida para alterações sensíveis:
- ajuste manual
- reprocessamento
- mudança de valor
- reabertura de período
- alteração de consolidados

### Objetivo
Toda mudança sensível deve deixar rastro forte e, se necessário, exigir justificativa.

### Entregue
- estrutura sugerida
- logs extras se necessário
- validações

---

## 12. PREPARAR O BANCO PARA EVOLUÇÃO FUTURA DO ERP

O modelo precisa ficar pronto para suportar futuramente:
- módulo financeiro completo
- faturamento por cliente
- CNAB
- integração bancária
- portal do cliente
- relatórios avançados
- BI / dashboards
- regras complexas de cálculo

### O que fazer
Ajustar a arquitetura para evitar retrabalho futuro.

### Entregue
- melhorias estruturais
- observações de escalabilidade
- ajustes preventivos

---

# INSTRUÇÕES DE EXECUÇÃO

## IMPORTANTE
Você deve agir como executor técnico.

### Faça o seguinte:
1. Analise a estrutura atual
2. Identifique os pontos já cobertos
3. Corrija o que estiver incompleto
4. Gere SQL quando necessário
5. Refine policies
6. Crie tabelas auxiliares se necessário
7. Crie funções, triggers e constraints quando necessário
8. Preserve compatibilidade com o Supabase
9. Evite soluções abstratas demais
10. Priorize segurança, clareza e manutenção futura

---

# FORMATO DA RESPOSTA

Responda exatamente nesta estrutura:

---

# 1. DIAGNÓSTICO FINAL

- O que já está correto
- O que ainda estava vulnerável
- O que será corrigido agora

---

# 2. CORREÇÕES IMPLEMENTADAS

Para cada item corrigido, usar:

## [Nome da correção]

- Problema
- Solução aplicada
- Impacto prático

### SQL
```sql
-- inserir aqui

