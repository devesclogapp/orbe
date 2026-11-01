# ORBE — SEC-03 | RELATÓRIO TÉCNICO FASE 02.4.3
## AUDITORIA E CORREÇÃO CRÍTICA DA EDGE FUNCTION (`sec03-activate-account`)

---

### Sumário Executivo

- **Módulo**: Onboarding Seguro de Usuários (SEC-03)
- **Componente**: Edge Function `supabase/functions/sec03-activate-account/index.ts` e RPCs de Suporte
- **Ambiente de Testes**: Local Isolado (PostgreSQL 17.11, Supabase Auth/GoTrue 2.197, Edge Runtime v1.77.8, Vite Preview 4173)
- **Supabase Cloud (Produção)**: Estritamente **READ-ONLY** (zero migrations, zero deploy, secrets intocados)
- **Status Geral**: **APROVADO (GO)** — Todos os 8 requisitos mandatórios corrigidos, 6/6 testes de segurança da Edge Function PASS e 23/23 cenários da suíte master E2E PASS com zero regressões.

---

## 1. Tratamento das 8 Correções Obrigatórias

| # | Requisito Obrigatório | Status | Implementação Técnica & Defesa em Profundidade |
|---|---|:---:|---|
| **1** | **Remover logs de segredos, tokens e senhas** | **CONCLUÍDO** | Removidos quaisquer logs contendo `verification_proof`, `token`, `password` ou e-mails em texto claro correlacionados com provas. Mantido apenas log operacional seguro: `[Onboarding] Processando ativação para role: ${invite.role}`. |
| **2** | **Impedir substituição de senha de contas existentes** | **CONCLUÍDO** | O fluxo de convite **NUNCA** altera a senha de um usuário existente (`updateUserById({ password })` foi completamente extirpado desse fluxo). Para vincular a conta pré-existente ao novo tenant, o titular deve estar com Bearer token ativo ou comprovar sua identidade fornecendo sua senha atual via `signInWithPassword`. Se a senha informada for divergente, a Edge Function rejeita com `401 EXISTING_USER_PASSWORD_MISMATCH` e a senha original do titular permanece **100% intocada**. |
| **3** | **Ordem de validação e compensação atômica** | **CONCLUÍDO** | Ordem estrita: (1) Validação de Token/Invite -> (2) Validação OTP / Proof -> (3) Verificação/Criação no Auth -> (4) RPC Transacional `accept_tenant_invitation` -> (5) Emissão de Sessão. Em caso de falha no banco, a compensação atômica (`deleteUser`) é acionada **exclusivamente** se `isNewlyCreatedUser === true`. Contas pré-existentes nunca sofrem deleção sob nenhuma hipótese. |
| **4** | **Busca de usuários imune a paginação** | **CONCLUÍDO** | Implementada busca direta $O(1)$ via RPC PostgreSQL `sec03_get_auth_user_by_email` executada com privilégios `SECURITY DEFINER` e restrita a `service_role`. Eliminada a vulnerabilidade de limite de paginação (`listUsers({ perPage: 50 })`). Fallback secundário preservado. |
| **5** | **Rate Limiting e Proteção Contra Abuso** | **CONCLUÍDO** | Implementado rate limiter em memória por IP (máximo de 25 requisições/minuto por cliente). Tentativas excedentes recebem `429 RATE_LIMIT_EXCEEDED` com mensagem amigável sem interromper ativações legítimas. |
| **6** | **Segurança no Retorno de Sessão ao Frontend** | **CONCLUÍDO** | Emissão de sessão JWT de curto prazo via instância cliente isolada com `persistSession: false`. Caso ocorra falha não crítica no login imediato, a ativação do perfil permanece íntegra e a UI redireciona o usuário para o login manual sem expor credenciais. |
| **7** | **Segregação do Encarregado** | **CONCLUÍDO** | Redirecionamento canônico estrito: se `invite.role === 'encarregado'`, `redirect_to` retorna `/login/operacional`. Confirmado via testes E2E que o encarregado é bloqueado por RLS e rotas administrativas (`/governanca/usuarios`, etc.). |
| **8** | **Proteção da Prova de Verificação (`verification_proof`)** | **CONCLUÍDO** | A `verification_proof` exige amarração cumulativa: token de convite válido, e-mail coincidente, emissão recente (< 15 min), consumo atômico via `FOR UPDATE` e desafio associado. Rejeição imediata com `400 VERIFICATION_FAILED` caso a ativação seja chamada sem código e sem prova. |

---

## 2. Evidências dos Testes de Hardening da Edge Function

Execução do script automatizado isolado `scratch/test_edge_function_hardening.mjs`:

```text
=== TESTE DE HARDENING DA EDGE FUNCTION SEC-03 ===

1. Testando ativação de usuário novo...
   Resultado Novo Usuário: 200 PASS

2. Testando tentativa de alterar senha de usuário existente via convite...
   attackRes response: 401 {
     success: false,
     error: 'EXISTING_USER_PASSWORD_MISMATCH',
     message: 'Este e-mail já possui cadastro no ORBE. Para aceitar o convite, confirme sua senha existente ou faça login.'
   }
   Tentativa de sobrescrever senha bloqueada com 401: PASS

3. Testando aceite de convite por usuário existente confirmando sua senha correta...
   Aceite legítimo com senha existente: PASS

4. Testando rollback/compensação após erro de banco...
   Ativação com banco falho rejeitada: PASS
   Compensação atômica limpou usuário novo órfão: PASS
   Conta pré-existente preservada intacta: PASS

5. Testando duas ativações simultâneas concorrentes (Race Condition)...
   res1 body: 200 { success: true, profile_id: '7c8b119a-...', ... }
   res2 body: 400 { success: false, error: 'ACCEPT_INVITATION_FAILED', message: 'Convite inválido, bloqueado ou expirado' }
   Status das duas requisições paralelas: [ 200, 400 ]
   Isolamento e bloqueio de corrida concorrente: PASS

6. Testando código e prova inválidos...
   Prova inválida rejeitada com 400: PASS

===============================================================
   TODOS OS TESTES DE SEGURANÇA DA EDGE FUNCTION PASSARAM! (6/6)
===============================================================
```

---

## 3. Evidências da Suíte Master E2E Black Box (23 Cenários)

Execução da suíte completa com navegador Microsoft Edge real (Playwright), PostgreSQL 17 local e Supabase Auth local (`scratch/sec03_blackbox_master_suite.mjs`):

```text
======================================================
             RESUMO DA HOMOLOGAÇÃO BLACK BOX           
======================================================
TOTAL DE CENÁRIOS: 23
PASS: 23
FAIL: 0
======================================================

Detalhe dos Resultados:
  [SETUP-01] Criação de Entidades Sintéticas Isoladas -> PASS
  [FLOW-01]  Login Administrativo no ERP Local -> PASS
  [FLOW-02]  Navegação para Governança de Usuários -> PASS
  [FLOW-03]  Abertura do Modal de Geração de Convite -> PASS
  [FLOW-04]  Cópia Real do Convite com Token e OTP -> PASS
  [FLOW-05]  Passo 1 Onboarding: Identificação da Razão Social -> PASS
  [FLOW-06]  Passo 2 Onboarding: Rejeição de Código Incorreto (Contador) -> PASS
  [FLOW-07]  Passo 2 Onboarding: Validação Bem-Sucedida do OTP -> PASS
  [FLOW-08]  Passo 3 Onboarding: Criação de Senha e Ativação Edge -> PASS
  [DB-01]    Auditoria de Persistência: GoTrue, Profiles, RBAC -> PASS
  [FLOW-09]  Login com Nova Credencial Provisionada -> PASS
  [SEC-01]   Session Proof Binding Negativo -> PASS
  [SEC-02]   Bloqueio Estrito por Código OTP Expirado -> PASS
  [SEC-03]   Bloqueio Imediato Após 5 Tentativas Incorretas -> PASS
  [SEC-04]   Reemissão de Código e Invalidação do Anterior -> PASS
  [SEC-05]   Bloqueio Estrito de Reutilização de Convite Consumido -> PASS
  [SEC-06]   Isolamento RLS Multi-Tenant -> PASS
  [SEC-07]   Prevenção de Elevação de Privilégios -> PASS
  [SEC-08]   Proteção Contra Conflito de Tenant (Multi-Vínculo) -> PASS
  [SEC-09]   Segregação de Acesso do Encarregado -> PASS
  [SEC-10]   Revogação de Convite em Tempo Real -> PASS
  [SEC-11]   Prevenção de Bypass de OTP via API Direta -> PASS
  [SEC-12]   Compensação Atômica e Recuperação Idempotente -> PASS
```

---

## 4. Arquivos Modificados e Artefatos Gerados

1. `supabase/functions/sec03-activate-account/index.ts`
   - Implementado rate limiting por IP.
   - Eliminados logs contendo credenciais ou tokens sensíveis.
   - Implementada verificação de senha existente (bloqueio 401 contra hijack).
   - Busca $O(1)$ de contas via `sec03_get_auth_user_by_email`.
   - Tratamento de concorrência com lock transacional e compensação atômica seletiva.
2. `supabase/migrations/20261101120000_sec_03_onboarding_seguro_producao.sql`
   - Adicionada RPC `sec03_get_auth_user_by_email` restrita a `service_role`.
   - Limpeza de sobrecargas com `DROP FUNCTION IF EXISTS`.
3. `scratch/test_edge_function_hardening.mjs`
   - Suíte de validação de casos de borda da Edge Function.
4. `.env.local`
   - Restaurado apontando para o Cloud de produção (`https://lifgjtcflzmspilhryap.supabase.co`).

---

## 5. Parecer Conclusivo e GO / NO-GO

> [!IMPORTANT]
> **PARECER FINAL: GO PARA ETAPA DE IMPLANTAÇÃO CONTROLADA (PRODUÇÃO)**
>
> A Edge Function `sec03-activate-account` agora possui blindagem completa contra ataques de sobrescrita de senhas, vazamento de segredos em logs, condições de corrida em ativações concorrentes e abusos de força bruta.
> 
> Nenhuma alteração foi realizada no Supabase Cloud (READ-ONLY preservado 100%).

