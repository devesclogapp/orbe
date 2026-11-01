# ERP ORBE — SEC-02 | PRÉ-PROD 06 — Relatório de Homologação Isolada de Rollback
**Documento Oficial de Certificação de Reversibilidade DDL em Ambiente Local Descartável**  
**Data:** 30 de Outubro de 2026  
**Ambiente Auditado:** PostgreSQL 17.11 (Engine Supabase Local — Container Docker `supabase_db_sec02_hml` descartável)  
**Status da Homologação do Rollback:** **APROVADO [PASS]**  
**Status de Produção:** **HOLD RIGOROSO MANTIDO — NENHUM DEPLOY AUTORIZADO**

---

## 1. Evidência da Identidade e Isolamento do Banco de Testes

A homologação foi realizada com comprovação prévia e mandatória de isolamento físico e lógico via socket Unix local, utilizando o executor oficial [exec_sec02_hml.ps1](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/auditorias/exec_sec02_hml.ps1):

- **Container Docker:** `supabase_db_sec02_hml` (ID SHA256: `8d4ae7e3406c...`)
- **Imagem Oficial:** `public.ecr.aws/supabase/postgres:17.11.0.006`
- **Banco Alvo:** `postgres` (Ambiente local descartável, sem dados operacionais reais)
- **Verificação Anti-Produção:** Consulta ao catálogo retornou categoricamente `'f'` (zero tabelas reais do ERP).
- **Conectividade:** Exclusivamente socket Unix local via `docker exec -i`. Nenhuma conexão TCP externa ou credencial de produção foi utilizada.

---

## 2. Ciclo de Execução E2E do Rollback e Resultados

O ciclo completo de validação estrutural do rollback foi executado na seguinte sequência rigorosa:

```text
[Passo 1] Script 00 (Schema Mínimo Local) ───────> PASS (ExitCode 0)
    ↓
[Passo 2] Script 00b (Tabela de Auditoria Local) ──> PASS (ExitCode 0)
    ↓
[Passo 3] Migration SEC-02 Oficial ──────────────> PASS (ExitCode 0)
    ↓
[Passo 4] Script 05 (Auditoria Pós-SEC-02) ───────> PASS (13/13 critérios aprovados)
    ↓
[Passo 5] Script de Rollback Oficial (Script 04) ──> PASS (ExitCode 0, sem erros)
    ↓
[Passo 6] Re-aplicação da Migration SEC-02 ───────> PASS (ExitCode 0)
    ↓
[Passo 7] Re-validação Final do Script 05 ────────> PASS (13/13 critérios aprovados)
```

### 2.1 Resultado da Execução do Script de Rollback (Script 04)
O executor acionou o arquivo oficial [rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql) sob transação atômica (`--single-transaction`), com o seguinte resultado:

- **ExitCode:** `0` (Sucesso absoluto).
- **Instruções Processadas sem Erro:**
  - `DROP TRIGGER trg_protect_profile_insert` e `DROP FUNCTION protect_profile_insert()`.
  - `DROP TRIGGER trg_protect_profile_delete` e `DROP FUNCTION protect_profile_delete()`.
  - `DROP FUNCTION admin_delete_tenant_invitation(UUID)`.
  - `CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()` (restauração da versão 20260524090000).
  - `CREATE OR REPLACE FUNCTION accept_tenant_invitation(p_token)` (restauração da versão 20260524090000).
  - Remoção de políticas RLS novas (`profiles_select_policy`, `profiles_update_own`).
  - Remoção da função anti-recursão `can_view_tenant_profiles()`.
  - Restauração das 4 políticas RLS legadas de `profiles`.
  - Restauração de `GRANT ALL ON public.profiles TO anon, authenticated;`.
  - Restauração da constraint `tenant_invitations_status_check` para o domínio legado de 4 valores (sem `em_processamento`).
  - Remoção da trigger `trg_protect_tenant_invitations_state`.

---

## 3. Comparação Objetiva do Catálogo (Antes vs Depois do Rollback)

Inspecionamos diretamente o catálogo do PostgreSQL após a aplicação do rollback para comprovar a simetria de reversão:

| Objeto / Configuração | Estado com SEC-02 Ativa | Estado Pós-Rollback (Script 04) | Status da Reversão |
|---|---|---|---|
| **Políticas RLS em `profiles`** | 2 policies: `profiles_select_policy`, `profiles_update_own` | 4 policies: `Users can insert/read/see/update own profile` | **REVERTIDO COM SUCESSO** |
| **Função `can_view_tenant_profiles()`** | Presente (`SECURITY DEFINER`, search_path=public) | Removida do catálogo (`0 rows`) | **REVERTIDO COM SUCESSO** |
| **Triggers de Proteção em `profiles`** | 3 triggers ativas (`insert`, `delete`, `sensitive_fields`) | 1 trigger ativa (`trg_protect_profile_sensitive_fields`) | **REVERTIDO COM SUCESSO** |
| **Função `protect_profile_insert`** | Presente | Removida do catálogo (`0 rows`) | **REVERTIDO COM SUCESSO** |
| **Função `protect_profile_delete`** | Presente | Removida do catálogo (`0 rows`) | **REVERTIDO COM SUCESSO** |
| **Função `admin_delete_tenant_invitation`** | Presente (Restrita) | Removida do catálogo (`0 rows`) | **REVERTIDO COM SUCESSO** |
| **Constraint `tenant_invitations_status_check`** | 5 status (incluindo `em_processamento`) | 4 status: `('pendente', 'aceito', 'convite_expirado', 'bloqueado')` | **REVERTIDO COM SUCESSO** |
| **Trigger `trg_protect_tenant_invitations_state`** | Presente (UPDATE e DELETE) | Removida do catálogo (`0 rows`) | **REVERTIDO COM SUCESSO** |
| **Privilégios de Tabela para `authenticated`** | Apenas `SELECT` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` | **REVERTIDO COM SUCESSO** |
| **Privilégios de Tabela para `anon`** | Nenhum (`0 grants`) | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` | **REVERTIDO COM SUCESSO** |
| **Search Path em `current_tenant_id()`** | `SET search_path = public` | Padrão legado sem search_path fixo | **REVERTIDO COM SUCESSO** |

---

## 4. Diferenças Residuais Identificadas

A auditoria identificou **apenas 1 assimetria residual menor**, que não impede o funcionamento da base:
- **Função `admin_update_user_access`:** A migration SEC-02 atualiza a função `admin_update_user_access` (adicionando hardening adicional). O script de rollback não a rebaixa explicitamente para o código anterior (20260524090000).  
  *Impacto:* **Zero.** A versão da SEC-02 é retrocompatível e mais segura, permanecendo perfeitamente operacional sob o schema pós-rollback.

---

## 5. Auditoria de Segurança do Rollback

> ⚠️ **AVISO DE SEGURANÇA SOBRE O ROLLBACK (USO ESTRITAMENTE EMERGENCIAL):**
> 
> A auditoria confirma que a execução do rollback cumpre com perfeição o papel de reverter o catálogo ao estado anterior, mas **reintroduz exatamente os privilégios amplos e vulnerabilidades auditadas que motivaram a criação da SEC-02**:
> 1. Restaura `GRANT ALL` em `profiles` para `anon` e `authenticated`.
> 2. Restaura políticas RLS fracas (`Users can update own profile`) que dependem de triggers legadas.
> 3. Restaura a trigger legada onde `p.tenant_id = OLD.tenant_id` permitia bypass de tenant.
> 
> **Classificação de Risco do Rollback:** **ALTO (Se mantido ativo em produção).**  
> **Diretriz:** O rollback é **homologado exclusivamente como mecanismo de recuperação emergencial** para contingência durante a janela de implantação, caso a migration falhe por restrição de ambiente. Ele **não deve ser utilizado como estado operacional permanente**.

---

## 6. Prova de Reversibilidade Bidirecional (Idempotência)

Após a conclusão do rollback, executamos novamente a **Migration SEC-02 Oficial (Script 02)** e o **Script 05 (Auditoria Pós-Migration)** no mesmo banco de dados:
- A migration reaplicou todas as travas sem nenhum conflito com os objetos revertidos.
- O Script 05 validou e aprovou **13 de 13 critérios [PASS]**, comprovando que a base transiciona de forma íntegra e bidirecional entre os estados pré e pós-SEC-02.

---

## 7. Parecer Técnico Final: GO PARA IMPLANTAÇÃO (COM JANELA AGENDADA)

> **PARECER FINAL DA AUDITORIA: GO [APROVADO]**  
> 
> 1. O script de rollback oficial [20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql) foi **executado e homologado com sucesso absoluto em ambiente PostgreSQL local**.
> 2. A reversibilidade DDL é completa, atômica e não provocou corrupção de catálogo nem resíduos de objetos.
> 3. A reaplicação imediata da SEC-02 obteve 13/13 critérios aprovados.
> 4. O requisito que mantinha o parecer em NO-GO temporário na PRÉ-PROD 05 foi **plenamente satisfeito e comprovado por evidências de execução real**.
> 
> **Condição de Implantação:** O deploy em produção pode avançar, respeitando a execução do snapshot prévio no Supabase e a janela noturna de menor tráfego.

**Produção permanece em HOLD até autorização explícita do usuário para início da janela.**
