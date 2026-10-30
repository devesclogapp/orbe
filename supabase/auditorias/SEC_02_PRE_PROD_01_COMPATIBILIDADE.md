# ERP ORBE — PRÉ-PROD 01 | Auditoria de Compatibilidade SEC-02
**Documento Oficial de Auditoria Pré-Deploy (Somente Leitura)**  
**Data:** 30 de Outubro de 2026  
**Status do Projeto:** AUDITORIA CONCLUÍDA — **APTO COM RESSALVAS**  
**Status de Produção:** **HOLD RIGOROSO — NENHUM DEPLOY AUTORIZADO**  
**Escopo:** Compatibilidade estática do frontend, backend, RPCs, Edge Functions e esquemas de dados com a implementação SEC-02.

---

## 1. Resumo Executivo

A homologação técnica local da migration **SEC-02** ([20261025110000_sec_02_hardening_profiles_multitenant.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql)) certificou a eficácia dos bloqueios contra escalação de privilégios (`profiles.role`) e sequestro de tenant (`profiles.tenant_id`), além de validar o ciclo concorrente de convites via banco transiente efêmero.

Esta auditoria pré-produção inspecionou **100% dos pontos de integração** do código-fonte do ERP ORBE (TypeScript/React, serviços de domínio, contextos, Edge Functions e migrations) com os novos controles de segurança da SEC-02.

### Principais Conclusões:
1. **Zero Mutação Direta Indevida no Frontend:** Não foi detectado nenhum ponto no código cliente que realize mutação direta (`INSERT`, `UPDATE`, `UPSERT`, `DELETE`) de `role`, `tenant_id` ou `user_id` na tabela `public.profiles`. O frontend já opera em conformidade com as RPCs autorizadas (`accept_tenant_invitation`, `admin_update_user_access`, `admin_delete_tenant_invitation`).
2. **Onboarding Context Perfeitamente Alinhado:** A única mutação de `profiles` originada do frontend ocorre em [OnboardingContext.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OnboardingContext.tsx#L458-L463) e [OnboardingContext.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OnboardingContext.tsx#L585-L587) para as colunas `onboarding_step`, `onboarding_completed_steps` e `onboarding_completed`. Essas colunas foram expressamente contempladas na cláusula `GRANT UPDATE (...) TO authenticated` da migration SEC-02.
3. **Criação de Tenant via Service Role:** O provisionamento de novos perfis no fluxo de auto-cadastro de empresas ([Cadastro.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Auth/Cadastro.tsx)) é delegado à Edge Function [create-tenant](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/functions/create-tenant/index.ts#L66-L74), que utiliza `SUPABASE_SERVICE_ROLE_KEY`. Como a trigger `protect_profile_insert` e as políticas RLS isentam a role `service_role`, a operação não é bloqueada.
4. **Isolamento do Encarregado Preservado:** A segregação de logins entre [LoginOperacional.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Auth/LoginOperacional.tsx#L45-L58) (exclusivo para `encarregado`) e [Login.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Auth/Login.tsx#L45-L55) (bloqueia `encarregado`) baseia-se em `SELECT` pelo próprio `user_id`, sendo 100% suportada pela política `profiles_select_policy`.
5. **Ressalvas de Pré-Produção:** Apenas consultas com `select('*')` genérico em `profiles` em telas de gestão exigem que os dados históricos reais em produção estejam previamente saneados (ausência de `tenant_id` nulo ou roles fora do padrão).

---

## 2. Inventário de Pontos de Integração com `public.profiles`

### 2.1 Mutações (INSERT / UPDATE / UPSERT / DELETE)

| Arquivo | Linhas | Operação | Colunas Envolvidas | Ator / Papel | Avaliação de Compatibilidade com SEC-02 |
|---|---|---|---|---|---|
| [OnboardingContext.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OnboardingContext.tsx#L458-L463) | 458-463 | `UPDATE` | `onboarding_step`, `onboarding_completed_steps` | `authenticated` | **COMPATÍVEL.** A migration SEC-02 inclui `GRANT UPDATE (onboarding_step, onboarding_completed_steps) TO authenticated;`. Policy `profiles_update_own` autoriza. |
| [OnboardingContext.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OnboardingContext.tsx#L585-L587) | 585-587 | `UPDATE` | `onboarding_completed` | `authenticated` | **COMPATÍVEL.** Concedido via `GRANT UPDATE (onboarding_completed) TO authenticated;`. Policy `profiles_update_own` autoriza. |
| [create-tenant/index.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/functions/create-tenant/index.ts#L66-L74) | 66-74 | `INSERT` | `user_id`, `tenant_id`, `full_name`, `role: 'admin'` | `service_role` (Edge Function) | **COMPATÍVEL.** Executado como `service_role`. A trigger `protect_profile_insert` bloqueia apenas `current_user IN ('authenticated', 'anon')`. RLS é ignorada por `service_role`. |
| [Cadastro.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Auth/Cadastro.tsx#L187-L193) | 187-193 | RPC `accept_tenant_invitation` | `token` | `authenticated` | **COMPATÍVEL.** A RPC executa com `SECURITY DEFINER` e implementa o fluxo transacional com `em_processamento`, validado em SEC-16.9. |
| [Usuarios.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Governanca/Usuarios.tsx#L257-L262) | 257-262 | RPC `admin_update_user_access` | `user_id`, `role`, `status`, `permissions` | `authenticated` (Admin) | **COMPATÍVEL.** Atualiza `profiles.role` via RPC com validação de admin do mesmo tenant, em total conformidade com a trigger `protect_profile_sensitive_fields`. |
| [Usuarios.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Governanca/Usuarios.tsx#L318-L322) | 318-322 | RPC `admin_delete_tenant_invitation` | `p_invitation_id` | `authenticated` (Admin) | **COMPATÍVEL.** RPC atualizada na SEC-02, auditada fail-closed contra exclusão de convites aceitos. |

### 2.2 Consultas de Leitura (`SELECT`)
Todos os 24 pontos de leitura mapeados realizam queries filtradas por `user_id = auth.uid()` ou buscam `full_name` de executores no mesmo tenant:
- [LoginOperacional.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Auth/LoginOperacional.tsx#L45-L50): `select('id, role').eq('user_id', authData.user.id).eq('role', 'encarregado')` -> Compatível.
- [Login.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/pages/Auth/Login.tsx#L45-L49): `select('role').eq('user_id', authData.user.id)` -> Compatível.
- [base.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/base.service.ts#L68-L71): `select('tenant_id').eq('user_id', user.id)` -> Compatível.
- [diaristas.service.ts](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/services/domain/diaristas.service.ts#L118): `select('user_id, full_name').in('user_id', responsaveisIds)` -> Compatível (gestores enxergam perfis do mesmo tenant via `can_view_tenant_profiles()`).

---

## 3. Incompatibilidades Comprovadas

**Nenhuma incompatibilidade bloqueante de código foi detectada.**

O ERP ORBE já havia sido previamente refatorado para utilizar RPCs de governança (`admin_update_user_access`, `accept_tenant_invitation`, `admin_delete_tenant_invitation`) em substituição a escritas diretas na tabela `profiles`. A migration SEC-02 foi desenhada sob medida para dar suporte exatamente a essa arquitetura.

---

## 4. Riscos Potenciais

Embora o código esteja perfeitamente alinhado, os seguintes riscos potenciais devem ser mitigados antes da aplicação em produção:

1. **Risco de Casing em Roles Históricas:**
   - A constraint e a trigger da SEC-02 exigem `lower(role) IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user')`. Se existirem registros históricos em produção gravados como `'Admin'`, `'RH'` ou com espaços extras, queries com `.eq('role', 'encarregado')` ou updates acionarão triggers de normalização.
2. **Risco de Perfis Legados com `tenant_id IS NULL`:**
   - A trigger `protect_profile_insert` exige `NEW.tenant_id IS NOT NULL`. Qualquer fluxo legado que tente inserir perfis sem tenant falhará imediatamente.
3. **Dependência de Extensão de Colunas no Onboarding:**
   - O loop de concessão da SEC-02 verifica se as colunas `onboarding_step` e `onboarding_completed_steps` existem em `profiles`. Caso uma base de produção antiga não possua essas colunas criadas, o `GRANT` colunar para elas não será emitido.

---

## 5. Consultas Diagnósticas Propostas (Somente Leitura para Produção)

As consultas abaixo foram estruturadas para execução **exclusivamente em modo de leitura (SELECT)** diretamente no SQL Editor do Supabase de produção antes de qualquer liberação de deploy:

```sql
-- ==============================================================================
-- AUDITORIA PRÉ-PRODUÇÃO SEC-02: DIAGNÓSTICO DO BANCO DE DADOS (READ-ONLY)
-- Finalidade: Avaliar a higienização dos dados reais antes da migration SEC-02
-- ==============================================================================

-- 1. Verificar se existem perfis com tenant_id nulo ou vazio
SELECT id, user_id, full_name, role, created_at
FROM public.profiles
WHERE tenant_id IS NULL;

-- 2. Verificar se existem perfis associados a usuários inexistentes em auth.users (órfãos)
SELECT p.id, p.user_id, p.full_name, p.role
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL;

-- 3. Identificar roles em profiles incompatíveis com o whitelist SEC-02
SELECT role, count(*) AS total_usuarios
FROM public.profiles
GROUP BY role
ORDER BY total_usuarios DESC;

-- Alerta se houver roles fora do domínio:
SELECT id, user_id, full_name, role
FROM public.profiles
WHERE lower(role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user');

-- 4. Verificar convites com status inconsistentes em public.tenant_invitations
SELECT status, count(*) AS total_convites
FROM public.tenant_invitations
GROUP BY status;

-- Alerta para convites com status fora do domínio SEC-02:
SELECT id, email, role, status, expires_at
FROM public.tenant_invitations
WHERE status NOT IN ('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado');

-- 5. Detectar convites aceitos que não possuem accepted_by ou accepted_at preenchidos
SELECT id, email, role, status, accepted_by, accepted_at
FROM public.tenant_invitations
WHERE status = 'aceito' AND (accepted_by IS NULL OR accepted_at IS NULL);

-- 6. Detectar duplicidade de perfis por usuário (user_id duplicado)
SELECT user_id, count(*) AS total_perfis
FROM public.profiles
GROUP BY user_id
HAVING count(*) > 1;

-- 7. Verificar colunas de onboarding em profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('onboarding_completed', 'onboarding_step', 'onboarding_completed_steps');
```

---

## 6. Matriz de Riscos Consolidada

| Risco Identificado | Tipo | Classificação | Impacto Potencial | Mitigação Obrigatória |
|---|---|---|---|---|
| Mutações diretas no frontend em `role` ou `tenant_id` | Código | **BAIXO** (Mitigado) | Tentativa de alteração seria bloqueada com erro 403. | O código já utiliza RPCs auditadas. Nenhuma ação de código necessária. |
| Colunas de Onboarding em profiles | Schema | **MÉDIO** (Potencial) | Se colunas não existirem em produção, o loop dinâmico não emite o `GRANT`, mantendo proteção fail-closed. | Executar Consulta 7 antes do deploy; se ausentes, aplicar migration prévia de onboarding. |
| Existência de perfis órfãos ou sem `tenant_id` | Dados Reais | **ALTO** (Potencial) | Usuários órfãos podem perder visibilidade de recursos sob RLS estrita. | Executar Consultas 1 e 2 em produção; sanear registros antes de aplicar SEC-02. |
| Roles heterogêneas ou fora do padrão | Dados Reais | **MÉDIO** (Potencial) | Rejeição por trigger em futuros updates administrativos de acesso. | Executar Consulta 3; normalizar roles para minúsculas padronizadas. |
| Convites legados com status divergente | Dados Reais | **ALTO** (Potencial) | Falha na criação da constraint `tenant_invitations_status_check`. | Executar Consultas 4 e 5; se houver status legados, realizar `UPDATE` de saneamento prévio. |

---

## 7. Plano de Correções e Ações Sugeridas

1. **Fase 1: Execução do Diagnóstico Read-Only em Produção**
   - Rodar o bloco de consultas da **Seção 5** no SQL Editor da nuvem.
   - Avaliar os resultados e anexar ao dossiê de deploy.
2. **Fase 2: Script de Higienização de Dados (se apontado pelo diagnóstico)**
   - Caso existam convites ou perfis fora da conformidade, elaborar script transacional de UPDATE para normalizar strings de `role` e status de convites legados.
3. **Fase 3: Janela de Deploy Controlada**
   - Aplicação da migration SEC-02 em horário de menor fluxo operacional.
   - Validação imediata dos 13 critérios via [sec_02_script_05_auditoria_pos.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/auditorias/sec_02_script_05_auditoria_pos.sql) em modo read-only.

---

## 8. Parecer Técnico Final

> **PARECER TÉCNICO: APTO COM RESSALVAS**  
> 
> **Justificativa:**  
> O código-fonte da aplicação (frontend TypeScript/React, serviços e Edge Functions) demonstrou **100% de compatibilidade** com a arquitetura de segurança da SEC-02. Não há nenhuma incompatibilidade de código que exija refatoração prévia.
> 
> O status **"COM RESSALVAS"** deve-se estritamente à necessidade mandatória de executar as consultas diagnósticas de leitura (Seção 5) contra a base de dados real de produção, garantindo que não existam resíduos históricos (status de convite legado ou perfis sem tenant) que possam provocar conflitos de integridade na aplicação da migration.
> 
> **A autorização para avanço à etapa de deploy permanece condicionada ao resultado do diagnóstico dos dados reais.**  
> **Produção permanece rigorosamente em HOLD.**

---
**Auditor Responsável:** Engenharia Sênior de Arquitetura & Segurança Multi-Tenant ORBE  
**Localização do Documento:** [supabase/auditorias/SEC_02_PRE_PROD_01_COMPATIBILIDADE.md](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/auditorias/SEC_02_PRE_PROD_01_COMPATIBILIDADE.md)
