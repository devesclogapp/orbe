# Plano de Implementação — Orbe ERP

Este documento rastreia o progresso das melhorias de estabilização e funcionalidades identificadas no audit.

## 🟢 Simples (Batch) — [CONCLUÍDO]

Essas tarefas focavam na interatividade básica e completude do CRUD operacional.

- [x] **Colaboradores**: Implementar Edição e Exclusão na tabela e mutations no backend.
- [x] **Empresas**: Implementar Edição e Exclusão nos cards e tratamento de "Empty State".
- [x] **Gestão de Usuários**: Implementar CRUD completo e controle de status de vínculo.

---

## 🟡 Média (Um por um) — [EM PROGRESSO]

Essas tarefas exigem maior integração com regras de negócio ou serviços específicos.

### 1. Financeiro & Operações
- [x] **Dashboard Financeiro**: Implementar seletores de competência (mês/ano) e conectar filtros às queries do Supabase.
- [x] **Regras de Cálculo**: Implementar modal de criação e edição (CRUD completo).
- [x] **Regras de Cálculo**: Ativar botões de exclusão com confirmação e feedback.
- [x] **Financeiro Geral**: Conectar botões "Reprocessar" e "Consolidar" ao backend (`AIService` e `ConsolidadoService`).
- [x] **Processamento**: Melhorar granularidade do feedback de progresso da IA.

### 2. Governança & Auditoria
- [x] **Logs de Auditoria**: Implementar busca por texto e filtros por Módulo/Impacto.
- [x] **Logs de Auditoria**: Implementar modal para visualização detalhada do JSON de eventos.
- [x] **Exportação**: Adicionar funcionalidade de exportação de logs para CSV.

---

## 🔴 Complexa (SDD) — [PARA FUTURO]

Lógicas que exigem mudanças estruturais no banco ou arquitetura de segurança.

- [ ] **Justificativa de Admin**: Exigir motivo para alterações em períodos fechados (Override Admin).
- [ ] **Versionamento Financeiro**: Implementar histórico de vigência para regras de cálculo (Imutabilidade histórica).
- [ ] **Escopos Operacionais**: Filtros avançados por Unidade/Equipe baseados no RBAC refinado.
- [ ] **Hardening de Auditoria**: Triggers de imutabilidade no banco para impedir `UPDATE`/`DELETE` em logs.

---

## Próximos Passos
1. Concluir CRUD de **Regras de Cálculo** (Modal + Ações).
2. Ativar filtros no **Dashboard**.
3. Implementar busca e detalhamento em **Auditoria**.
