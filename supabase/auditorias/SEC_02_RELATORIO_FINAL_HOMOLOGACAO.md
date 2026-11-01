# ERP ORBE — SEC-02 | Relatório Consolidado de Homologação e Encerramento Técnico
**Documento Oficial de Auditoria, Segurança Multi-Tenant e Governança**  
**Data da Consolidação:** 30 de Outubro de 2026  
**Status Oficial:** **IMPLEMENTAÇÃO CONCLUÍDA / AUDITORIA ESTRUTURAL APROVADA / HOMOLOGAÇÃO INTEGRADA CLOUD PENDENTE**  
**Ambientes Auditados:**  
- Supabase Cloud (PostgreSQL 17.6 — Projeto `lifgjtcflzmspilhryap`)  
- PostgreSQL 17 Local Isolado (Container Docker `supabase_db_sec02_hml:54322`)  
- Frontend ERP ORBE (Roteamento React, AuthGuard e Vitest)

---

## 1. Objetivo e Escopo da SEC-02

O **Gate SEC-02** teve como escopo a blindagem arquitetural, relacional e transacional do núcleo de segurança multi-tenant do ERP ORBE, garantindo conformidade com o princípio do menor privilégio e mitigando definitivamente os seguintes vetores de risco:

1. **Escalação de Privilégios (Privilege Escalation):** Bloqueio absoluto de mutações diretas de `role` na tabela `public.profiles` por usuários autenticados via client SDK (PostgREST).
2. **Sequestro de Tenant (Tenant Takeover / Data Leak):** Bloqueio absoluto de mutação de `tenant_id` em `public.profiles`, garantindo imutabilidade relacional e impedindo o cruzamento de fronteiras corporativas.
3. **Recursão Infinita em Políticas RLS:** Eliminação de laços recursivos no PostgreSQL mediante a criação da função auxiliar `can_view_tenant_profiles()` com atributos `SECURITY DEFINER` e `STABLE`.
4. **Ciclo de Vida e Concorrência de Convites:** Proteção de `public.tenant_invitations` contra inserções, alterações ou exclusões diretas por clientes, canalizando todas as operações por RPCs com locks pessimistas e gravação obrigatória em `public.audit_log`.

---

## 2. Alterações Estruturais Implementadas

A arquitetura de segurança da SEC-02 e SEC-02.6 compreende:

### 2.1 Funções e RPCs de Segurança
- `public.current_tenant_id()`: Extração segura do `tenant_id` da sessão autenticada (`SECURITY DEFINER`, `SET search_path = public`).
- `public.can_view_tenant_profiles()`: Validação não-recursiva de papéis gestores (`admin`, `rh`, `financeiro`).
- `public.admin_require_tenant_admin()`: Validação estrita de autoridade administrativa (`role = 'admin'`) vinculada ao tenant da sessão.
- `public.admin_list_user_access_overview()`: Listagem consolidada de usuários e convites restrita ao tenant do administrador solicitante.
- `public.admin_update_user_access()`: RPC para atualização controlada de papéis e permissões granulares, com trava anti-lockout (o admin não pode alterar seu próprio acesso nesta tela).
- `public.admin_delete_tenant_invitation()`: Exclusão segura de convites com lock transacional (`FOR UPDATE`), trava contra exclusão de convites já aceitos e gravação auditada com token criptográfico omitido.
- `public.admin_renew_tenant_invitation()`: Renovação de tokens de convite pendentes qualificada com `extensions.gen_random_bytes(16)`.

### 2.2 Políticas RLS e Permissões Colunares
- `public.profiles`:
  - `REVOKE ALL` para `PUBLIC` e `anon`.
  - `GRANT SELECT` irrestrito a linhas autorizadas para `authenticated`.
  - `GRANT UPDATE (full_name, avatar_url, updated_at)` para `authenticated` (revogação total de `UPDATE` em `role` e `tenant_id`).
  - `profiles_select_policy`: Garante que o usuário enxerga apenas registros onde `tenant_id = current_tenant_id()` e (`can_view_tenant_profiles() OR auth.uid() = user_id`).
  - `profiles_update_own`: Restringe o `UPDATE` das colunas permitidas ao próprio usuário (`auth.uid() = user_id`).
- `public.tenant_invitations`:
  - Mutações diretas (`INSERT`, `UPDATE`, `DELETE`) bloqueadas para papéis clientes via permissões de catálogo e trigger de proteção.

### 2.3 Triggers de Defesa em Profundidade
- `trg_protect_profile_insert`: Impede inserções diretas via cliente e valida integridade relacional.
- `trg_protect_profile_sensitive_fields`: Impede alteração de `role` e `tenant_id` em tempo de execução via banco de dados.
- `trg_protect_profile_delete`: Impede exclusão física direta de perfis.
- `trg_protect_tenant_invitations_state`: Impede mutações diretas em convites por `authenticated`/`anon` e protege registros históricos (`status = 'aceito'`).

---

## 3. Matriz Consolidada de Testes

| Validação | Resultado | Ambiente | Escopo / Evidência |
|---|:---:|:---:|---|
| **Auditoria estrutural SEC-02** | **13/13 PASS** | Supabase Cloud | Catálogo PostgreSQL 17.6 (`sec_02_script_05_auditoria_pos.sql`). |
| **Admin — listagem de usuários** | **Aprovado** | Interface | Visualização de 7 usuários, badges de status, convites e paginação em `/governanca/usuarios`. |
| **Admin — modal de permissões** | **Aprovado** | Interface | Modal de edição do Tester RH com matriz granular e seleção de perfil funcional. |
| **RH — controle de acesso** | **6/6 PASS** | Local isolado | Bloqueio de rotas administrativas, negação de RPCs de admin e preservação de fluxos legítimos de RH. |
| **Financeiro — controle de acesso** | **8/8 PASS** | Local isolado | Bloqueio de rotas admin, negação de RPCs admin (`P0001`), bloqueio colunar (`42501`) e isolamento cross-tenant. |
| **Encarregado — isolamento** | **8/8 PASS** | Local isolado | Portal Operacional `/login/operacional` preservado, bloqueio administrativo, RLS estrita ao próprio perfil. |
| **Admin — operações administrativas** | **15/15 PASS** | Local isolado | Ciclo completo: criação, alteração, renovação, exclusão de convites, anti-lockout e `audit_log`. |
| **FIX SEC-02.6 — segurança da renovação** | **5/5 PASS** | Local isolado | Rejeição por RH (`P0001`), Fin (`P0001`), Enc (`P0001`), cross-tenant (`P0001`) e sucesso do admin legítimo. |
| **FIX SEC-02.6 — auditoria pós-aplicação** | **7/7 PASS** | Supabase Cloud | Assinatura, schema `extensions`, permissões colunares e isolamento validados no Cloud. |

---

## 4. Evidências Técnicas de Aprovação

1. **Catálogo de Produção (Supabase Cloud):**
   - Scorecard do `sec_02_script_05_auditoria_pos.sql` confirmou todos os 13 critérios de hardening em conformidade.
   - Auditoria pós-aplicação do FIX SEC-02.6 confirmou a substituição da função `admin_renew_tenant_invitation` com qualificação para `extensions.gen_random_bytes(16)`.
2. **Ambiente Local Automatizado (`supabase_db_sec02_hml:54322`):**
   - Transações atômicas com `ROLLBACK` estrito comprovaram que nenhum resíduo sintético persistiu após os testes (contadores zero em `tenants`, `profiles`, `tenant_invitations` e `audit_log`).
   - Identidades autenticadas simuladas via JWT (`request.jwt.claim.sub`) demonstraram que as barreiras de segurança operam nativamente no banco de dados, independentemente do React.
3. **Suíte Frontend Automatizada (Vitest):**
   - 29/29 testes passaram na suíte `src/test/fix_encarregado_portal_launcher_return.test.ts`.

---

## 5. Falha Identificada na Renovação de Convites (Item P5)

Durante a execução da suíte administrativa do Teste 06 em ambiente local, foram observadas duas reprovações:
- **P5 (`admin_renew_tenant_invitation`):** `SQLSTATE 42883 (function gen_random_bytes(integer) does not exist)`.
- **P7 (Consistência transacional):** Comprometida em decorrência da falha em P5.

---

## 6. Causa Raiz e Correção FIX SEC-02.6

### Causa Raiz
Na migração base `20260524090000_admin_user_access_management.sql`, a função `admin_renew_tenant_invitation` invocava `encode(gen_random_bytes(16), 'hex')` sem prefixar o schema. Como a função utiliza `SET search_path = public;`, o PostgreSQL não localizava a função `gen_random_bytes` (que reside no schema `extensions`, pertencente à extensão `pgcrypto`).

### Correção Implementada
Criada a migration incremental:
[20261030193000_sec_02_6_fix_admin_renew_tenant_invitation.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261030193000_sec_02_6_fix_admin_renew_tenant_invitation.sql)

Alteração central:
```sql
-- Chamada explicitamente qualificada com o schema extensions
token = encode(extensions.gen_random_bytes(16), 'hex')
```
- Preservados: assinatura `(UUID, TIMESTAMPTZ)`, retorno `public.tenant_invitations`, `SECURITY DEFINER`, `SET search_path = public`, validações de tenant e grants restritos (`REVOKE ALL FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`).

---

## 7. Resultado da Auditoria Pós-FIX no Cloud

Após a aplicação manual do script no Supabase SQL Editor, a validação de catálogo (7/7 PASS) confirmou:
1. `admin_renew_tenant_invitation` existente e íntegra.
2. Definição contendo `extensions.gen_random_bytes`.
3. `SECURITY DEFINER` e `search_path = public` ativos.
4. Permissões de execução atribuídas a `authenticated`.
5. Acesso revogado para `anon` e `PUBLIC`.
6. Validação relacional contra o tenant mantida.
7. Comentário descritivo SEC-02.6 registrado no catálogo.

---

## 8. Riscos Residuais e Limitações dos Testes

1. **Testes de Backend com Identidades Sintéticas:**  
   Os testes de perfis RH, Financeiro e Encarregado foram conduzidos com identidades sintéticas autenticadas via `SET LOCAL ROLE authenticated` em banco isolado. A interação ponta a ponta com sessões reais de usuários desses perfis no Supabase Cloud ainda requer validação em homologação integrada.
2. **Histórico de Migrations Descompassado (`schema_migrations`):**  
   Como a SEC-02 e o FIX SEC-02.6 foram aplicados manualmente via SQL Editor no Supabase Cloud, a tabela interna `supabase_migrations.schema_migrations` do Cloud não contém os registros automáticos correspondentes da CLI. Nenhum comando de repair foi executado para evitar mutações de governança não autorizadas.
3. **Dados Históricos no Cloud:**  
   Existe a presença de contas e registros de testes antigos no banco Cloud que necessitam de saneamento supervisionado antes da entrada em produção.

---

## 9. Pendências de Validação Integrada (Próxima Fase)

Permanecem expressamente como pendências operacionais para as etapas subsequentes do projeto:

1. **Ciclo Completo de Convites no Cloud:** Execução integrada de criação, renovação e exclusão de convites utilizando sessão real autenticada no navegador via Supabase Cloud.
2. **Alteração de Permissões no Cloud:** Teste integrado de alteração de permissões administrativas via interface real conectada ao backend Cloud.
3. **Sessões Reais dos Perfis:** Confirmação prática de isolamento e autorização em sessões de usuários reais dos perfis RH, Financeiro e Encarregado.
4. **Visibilidade do Menu:** Revisão da visibilidade e usabilidade do menu de Gestão de Usuários na interface do Administrador.
5. **Saneamento de Contas Sintéticas:** Mapeamento e saneamento supervisionado de contas de homologação antigas antes da entrega final ao cliente.

---

## 10. Parecer Técnico de Encerramento

> **PARECER TÉCNICO OFICIAL:**  
> **A ETAPA ESTRUTURAL DA SEC-02 E O FIX SEC-02.6 ESTÃO TECNICAMENTE CONCLUÍDOS E APROVADOS.**  
>  
> Todas as vulnerabilidades de escalação de privilégios, vazamento entre tenants e recursão em RLS foram mitigadas na raiz arquitetural do PostgreSQL. O modelo de permissões colunares e triggers em profundidade está plenamente ativo e homologado.  
>  
> **Classificação de Homologação:** **NÃO DECLARADA HOMOLOGAÇÃO FUNCIONAL INTEGRAL DE PRODUÇÃO.**  
> O projeto encontra-se homologado estática e estruturalmente, restando as pendências da Seção 9 a serem cumpridas durante a homologação integrada da aplicação.

---
**Auditor Responsável:** Engenharia Sênior de Software & Auditoria de Segurança Multi-Tenant ORBE  
**Documento Arquivado:** [supabase/auditorias/SEC_02_RELATORIO_FINAL_HOMOLOGACAO.md](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/auditorias/SEC_02_RELATORIO_FINAL_HOMOLOGACAO.md)
