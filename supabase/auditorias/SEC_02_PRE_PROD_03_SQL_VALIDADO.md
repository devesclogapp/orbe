# ERP ORBE — PRÉ-PROD 03 | FIX 01 — Diagnóstico SQL Validado
**Documento Oficial de Engenharia, Auditoria de Catálogo e Roteiro Executivo de Pré-Deploy**  
**Data:** 30 de Outubro de 2026  
**Status do Roteiro:** REVISADO, REESTRUTURADO EM FASES (A/B) E HOMOLOGADO  
**Status de Produção:** **HOLD RIGOROSO — NENHUMA EXECUÇÃO REALIZADA**  
**Escopo:** Ajustes da auditoria independente sobre as whitelists normativas da migration SEC-02, segregação em Fases A e B, classificação funcional de onboarding e script final read-only.

---

## 1. Parecer Técnico da Revisão PRÉ-PROD 03 / FIX 01

> **PARECER TÉCNICO:** **ROTEIRO FASE A TOTALMENTE HOMOLOGADO E SEGURO PARA EXECUÇÃO READ-ONLY NO SQL EDITOR**  
> 
> As verificações normativas da migration oficial [20261025110000_sec_02_hardening_profiles_multitenant.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql) confirmaram:
> 1. **Whitelist Canônica de Roles em `profiles`:** Os valores aceitos são exatamente `('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user')`. A trigger `protect_profile_insert` e as RPCs forçam minúsculas (`NEW.role := lower(NEW.role)`). O diagnóstico agora detecta e segrega explicitamente: (a) valores nulos, (b) divergências de casing (letras maiúsculas/mistas que exigem sanitização) e (c) valores incompatíveis/fora do domínio.
> 2. **Constraint de Status em `tenant_invitations`:** A constraint oficial `tenant_invitations_status_check` restringe os status a `('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado')`. O diagnóstico foi ajustado para apontar expressamente `status IS NULL` como bloqueante crítico e identificar status legados fora do domínio.
> 3. **Segregação Estrita em Fases A e B:**
>    - **Fase A (Execução Imediata):** Scorecard consolidado (8 critérios agregados) e tabelas de frequência estatística. **Zero identificadores individuais, zero dados pessoais.**
>    - **Fase B (Execução Condicional):** Triagem técnica de IDs técnicos (`id`, `user_id`, `tenant_id`), **bloqueada por padrão** e autorizada exclusivamente se a Fase A apontar discrepâncias.
> 4. **Classificação Funcional das Colunas de Onboarding:** Confirmou-se que o componente [OnboardingContext.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OnboardingContext.tsx#L425) consome ativamente `onboarding_completed`, `onboarding_step` e `onboarding_completed_steps`. Portanto, sua ausência em produção **não é mera ressalva informativa, mas uma incompatibilidade funcional** que quebraria a persistência do onboarding guiado dos clientes.

---

## 2. Detalhamento das Alterações Realizadas

| Item | Versão Anterior (PRÉ-PROD 02) | Versão Ajustada (PRÉ-PROD 03 / FIX 01) | Racional da Alteração |
|---|---|---|---|
| **Auditoria de `profiles.role`** | Unificava nulos, casing e fora do domínio em um único `count`. | Segregado em: (1) `role IS NULL`, (2) Divergência de casing (`role <> lower(role)`), (3) Role fora do domínio permitido. | Permite diferenciar necessidade de UPDATE cosmético (`lower()`) de erro estrutural grave (role inexistente). |
| **Auditoria de `tenant_invitations.status`** | Testava apenas `status NOT IN (...)`. | Testa explicitamente `status IS NULL OR status NOT IN ('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado')`. | Nulos violam a constraint `CHECK` e inviabilizam a aplicação da migration SEC-02. |
| **Estrutura do Roteiro** | Script único contendo Scorecard, Estatísticas e Triagem por IDs no mesmo arquivo. | **Segregação em Fase A (Agregada) e Fase B (Triagem por IDs).** | Blindagem absoluta contra vazamento acidental de IDs em relatórios de conformidade. |
| **Colunas de Onboarding** | Classificado como `RESSALVA [INFO]`. | Classificado como **`INCOMPATIBILIDADE FUNCIONAL [FAIL]`**. | [OnboardingContext.tsx](file:///y:/2026/ERP%20ESC%20LOG/Orbe/src/contexts/OnboardingContext.tsx) depende ativamente dessas colunas para salvar o fluxo inicial de novos tenants. |
| **Proteção de Transação** | `BEGIN TRANSACTION READ ONLY; ... COMMIT;` | Preservado integralmente na Fase A e na Fase B. | Garantia intrínseca de que o banco rejeitará qualquer comando não-leitura. |

---

## 3. PARTE A — Roteiro SQL Integral (Fase A: Scorecard e Estatísticas)

O bloco abaixo é **100% autônomo, exclusivamente de leitura, livre de identificadores individuais** e pronto para execução no SQL Editor do Supabase de produção:

```sql
-- ==============================================================================
-- ROTEIRO DIAGNÓSTICO PRÉ-DEPLOY SEC-02 — FASE A (SCORECARD E DISTRIBUIÇÃO)
-- PROJETO: ERP ORBE - ESC LOG 2026
-- FINALIDADE: Validar conformidade da base de produção antes da migration SEC-02
-- MODO: 100% SOMENTE LEITURA. AGREGADO. ZERO IDENTIFICADORES INDIVIDUAIS.
-- ==============================================================================

BEGIN TRANSACTION READ ONLY;

-- ------------------------------------------------------------------------------
-- 1. SCORECARD CONSOLIDADO DE INTEGRIDADE PRÉ-DEPLOY (8 CRITÉRIOS)
-- ------------------------------------------------------------------------------
WITH 
  check_tenant_nulo AS (
    SELECT count(*) AS total FROM public.profiles WHERE tenant_id IS NULL
  ),
  check_orfaos_auth AS (
    SELECT count(*) AS total 
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE u.id IS NULL
  ),
  check_role_nula AS (
    SELECT count(*) AS total FROM public.profiles WHERE role IS NULL
  ),
  check_role_casing AS (
    SELECT count(*) AS total 
    FROM public.profiles 
    WHERE role IS NOT NULL AND role <> lower(role)
  ),
  check_role_invalida AS (
    SELECT count(*) AS total 
    FROM public.profiles 
    WHERE role IS NOT NULL 
      AND lower(role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user')
  ),
  check_duplicidade_user AS (
    SELECT count(*) AS total FROM (
      SELECT user_id FROM public.profiles GROUP BY user_id HAVING count(*) > 1
    ) sub
  ),
  check_convites_status_invalido AS (
    SELECT count(*) AS total 
    FROM public.tenant_invitations 
    WHERE status IS NULL 
       OR status NOT IN ('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado')
  ),
  check_convites_aceitos_incompletos AS (
    SELECT count(*) AS total 
    FROM public.tenant_invitations 
    WHERE status = 'aceito' AND (accepted_by IS NULL OR accepted_at IS NULL)
  ),
  check_colunas_onboarding AS (
    SELECT count(*) AS total
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('onboarding_completed', 'onboarding_step', 'onboarding_completed_steps')
  )

SELECT 
  '1. Perfis sem tenant_id' AS verificacao,
  c1.total AS discrepancias_encontradas,
  '0 (Zero)' AS esperado,
  CASE WHEN c1.total = 0 THEN 'APROVADO [PASS]' ELSE 'BLOQUEANTE [FAIL]' END AS status_gate
FROM check_tenant_nulo c1

UNION ALL

SELECT 
  '2. Perfis órfãos (sem vínculo em auth.users)',
  c2.total,
  '0 (Zero)',
  CASE WHEN c2.total = 0 THEN 'APROVADO [PASS]' ELSE 'BLOQUEANTE [FAIL]' END
FROM check_orfaos_auth c2

UNION ALL

SELECT 
  '3. Perfis com role NULA',
  c3.total,
  '0 (Zero)',
  CASE WHEN c3.total = 0 THEN 'APROVADO [PASS]' ELSE 'BLOQUEANTE [FAIL]' END
FROM check_role_nula c3

UNION ALL

SELECT 
  '4. Perfis com role em MAIÚSCULAS/MISTAS (casing)',
  c4.total,
  '0 (Zero)',
  CASE WHEN c4.total = 0 THEN 'APROVADO [PASS]' ELSE 'AJUSTAR / NORMALIZAR [FAIL]' END
FROM check_role_casing c4

UNION ALL

SELECT 
  '5. Perfis com role fora do domínio SEC-02',
  c5.total,
  '0 (Zero)',
  CASE WHEN c5.total = 0 THEN 'APROVADO [PASS]' ELSE 'BLOQUEANTE [FAIL]' END
FROM check_role_invalida c5

UNION ALL

SELECT 
  '6. Usuários com mais de 1 perfil (user_id duplicado)',
  c6.total,
  '0 (Zero)',
  CASE WHEN c6.total = 0 THEN 'APROVADO [PASS]' ELSE 'BLOQUEANTE [FAIL]' END
FROM check_duplicidade_user c6

UNION ALL

SELECT 
  '7. Convites com status NULO ou fora do domínio SEC-02',
  c7.total,
  '0 (Zero)',
  CASE WHEN c7.total = 0 THEN 'APROVADO [PASS]' ELSE 'BLOQUEANTE [FAIL]' END
FROM check_convites_status_invalido c7

UNION ALL

SELECT 
  '8. Convites aceitos sem auditoria (accepted_by/at)',
  c8.total,
  '0 (Zero)',
  CASE WHEN c8.total = 0 THEN 'APROVADO [PASS]' ELSE 'AJUSTAR / AUDITORIA [FAIL]' END
FROM check_convites_aceitos_incompletos c8

UNION ALL

SELECT 
  '9. Colunas de Onboarding presentes em profiles',
  c9.total,
  '3 colunas',
  CASE WHEN c9.total = 3 THEN 'APROVADO [PASS]' ELSE 'INCOMPATIBILIDADE FUNCIONAL [FAIL]' END
FROM check_colunas_onboarding c9;

-- ------------------------------------------------------------------------------
-- 2. DISTRIBUIÇÃO ESTATÍSTICA (FREQUÊNCIAS SEM DADOS PESSOAIS)
-- ------------------------------------------------------------------------------

-- 2.1. Frequência de papéis cadastrados (profiles.role)
SELECT 
  COALESCE(role, '[NULO]') AS perfil_role,
  count(*) AS quantidade_usuarios
FROM public.profiles
GROUP BY role
ORDER BY quantidade_usuarios DESC;

-- 2.2. Frequência de status dos convites (tenant_invitations.status)
SELECT 
  COALESCE(status, '[NULO]') AS convite_status,
  count(*) AS quantidade_convites
FROM public.tenant_invitations
GROUP BY status
ORDER BY quantidade_convites DESC;

COMMIT;
```

---

## 4. PARTE B — Roteiro Condicional de Triagem Técnica (Fase B)

> **ATENÇÃO:** O roteiro abaixo **NÃO deve ser executado no primeiro momento**.  
> Ele somente será acionado caso o Scorecard da Fase A indique qualquer valor `discrepancias_encontradas > 0` nos critérios 1 a 8, e mediante aprovação expressa da governança.

```sql
-- ==============================================================================
-- ROTEIRO DIAGNÓSTICO PRÉ-DEPLOY SEC-02 — FASE B (TRIAGEM TÉCNICA CONDICIONAL)
-- PROJETO: ERP ORBE - ESC LOG 2026
-- CONDIÇÃO DE EXECUÇÃO: AUTORIZADA SOMENTE SE FASE A REPORTAR DISCREPÂNCIAS
-- MODO: 100% SOMENTE LEITURA. PROJEÇÃO ESTREITA DE IDs TÉCNICOS. SEM NOMES/EMAILS.
-- ==============================================================================

BEGIN TRANSACTION READ ONLY;

-- 1. Triagem de perfis com tenant_id nulo ou role incompatível (IDs técnicos)
SELECT id, user_id, tenant_id, role
FROM public.profiles
WHERE tenant_id IS NULL 
   OR role IS NULL
   OR role <> lower(role)
   OR lower(role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user')
LIMIT 20;

-- 2. Triagem de perfis órfãos sem correspondência em auth.users (IDs técnicos)
SELECT p.id, p.user_id, p.tenant_id, p.role
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL
LIMIT 20;

-- 3. Triagem de convites com status nulo, fora do domínio ou aceite incompleto (IDs técnicos)
SELECT id, tenant_id, role, status, accepted_by, accepted_at
FROM public.tenant_invitations
WHERE status IS NULL 
   OR status NOT IN ('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado')
   OR (status = 'aceito' AND (accepted_by IS NULL OR accepted_at IS NULL))
LIMIT 20;

COMMIT;
```

---

## 5. Critérios de Avaliação e Próximos Passos

1. **Se a Fase A retornar todos os itens como `APROVADO [PASS]`:**
   - A base de produção está perfeitamente higienizada e alinhada com as constraints da SEC-02.
   - A Fase B é automaticamente descartada.
   - O projeto avança para o checklist operacional de janela de deploy.
2. **Se a Fase A retornar qualquer item como `[FAIL]`:**
   - A execução da Fase B é autorizada para mapear os IDs exatos das anomalias.
   - Um script corretivo de sanitização DML prévio (ex.: `UPDATE profiles SET role = lower(role)`) deverá ser elaborado e homologado antes de qualquer comando da SEC-02.

---
**Auditor Responsável:** Engenharia Sênior de Arquitetura & Segurança Multi-Tenant ORBE  
**Localização do Documento Oficial:** [supabase/auditorias/SEC_02_PRE_PROD_03_SQL_VALIDADO.md](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/auditorias/SEC_02_PRE_PROD_03_SQL_VALIDADO.md)
