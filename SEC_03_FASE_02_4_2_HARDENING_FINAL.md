# ORBE — SEC-03 | RELATÓRIO DE HARDENING FINAL PRÉ-DEPLOY (FASE 02.4.2)

**Data:** 01 de Novembro de 2026  
**Status:** CONCLUÍDO COM SUCESSO  
**Parecer:** **GO RESTRITO (Pronto para Execução Controlada em Produção)**  
**Ambiente Auditado:** Local Isolado (PostgreSQL 17.2, Docker Supabase CLI v2.75.0, Edge Runtime Deno 2.1.4, Playwright MSEdge, Vite 5.4.14 Preview) vs. Supabase Cloud (`lifgjtcflzmspilhryap`)

---

## 1. RESUMO EXECUTIVO

A Fase 02.4.2 executou a auditoria de segurança em profundidade e o saneamento técnico final da migration consolidada `20261101120000_sec_03_onboarding_seguro_producao.sql`, bem como dos componentes integrados de backend (RPCs e Edge Function) e frontend React (`Usuarios.tsx` e `Cadastro.tsx`).

Todos os 7 requisitos mandatórios estabelecidos para este ciclo foram rigorosamente implementados e validados por suítes de teste de banco, estatística criptográfica e homologação de navegador real (23 cenários PASS, 0 falhas).

---

## 2. AUDITORIA E CORREÇÕES APLICADAS (PONTOS MANDATÓRIOS)

### 2.1 Eliminação Completa do Segredo HMAC Fixo e Fallbacks Inseguros
* **Problema Identificado:** Havia literais fixos `'backend_super_secret_master_key_for_hmac_sha256_orbe_2026'` configurados como fallback em `sec03_settings` e nas funções de geração e verificação.
* **Correção Aplicada:**
  - O segredo HMAC mestre é agora provisionado dinamicamente no schema `private.sec03_settings` utilizando CSPRNG de alta entropia (256 bits):
    ```sql
    INSERT INTO private.sec03_settings (key, value)
    VALUES ('hmac_secret', encode(extensions.gen_random_bytes(32), 'hex'))
    ON CONFLICT (key) DO NOTHING;
    ```
  - Todos os fallbacks fixos foram **completamente removidos**. Caso o registro em `private.sec03_settings` esteja ausente ou corrompido (< 32 caracteres), as RPCs disparam imediatamente uma exceção fatal:
    ```sql
    IF v_secret IS NULL OR length(btrim(v_secret)) < 32 THEN
      RAISE EXCEPTION 'Segredo HMAC não configurado no backend seguro (private.sec03_settings).';
    END IF;
    ```
  - Na Edge Function `sec03-activate-account/index.ts`, removeu-se qualquer fallback estático; o backend PostgreSQL obtém o segredo internamente sem exposição ao frontend ou ao cliente HTTP.

### 2.2 Substituição de `random()` por CSPRNG Criptográfico (6 Dígitos)
* **Problema Identificado:** O código temporário de 6 dígitos era gerado por `lpad(floor(random() * 1000000)::TEXT, 6, '0')`. A função `random()` do PostgreSQL é um gerador pseudoaleatório baseado em libc, não indicado para segredos de segurança.
* **Correção Aplicada:**
  - Substituído pelo gerador criptográfico do sistema operacional via `pgcrypto` (`extensions.gen_random_bytes(4)`):
    ```sql
    v_code := lpad(((((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000) + 100000)::text)), 6, '0');
    ```
  - Essa fórmula extrai 4 bytes aleatórios puros (32 bits), projeta uniformemente no intervalo de `100000` a `999999` e assegura exatamente 6 dígitos numéricos sem risco de preenchimento ambíguo ou previsibilidade estatística.

### 2.3 Exigência Estrita de `verification_proof` (Zero Bypass)
* **Problema Identificado:** A assinatura anterior de `accept_tenant_invitation` aceitava `p_verification_proof TEXT DEFAULT NULL`, e a cláusula condicional permitia que registros legados ou desprovidos de proof contornassem a checagem.
* **Correção Aplicada:**
  - O parâmetro `DEFAULT NULL` foi **eliminado** da assinatura da função:
    ```sql
    CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
      p_token TEXT,
      p_user_id UUID,
      p_verification_proof TEXT
    ) RETURNS UUID ...
    ```
  - Validações atômicas adicionadas no início e no corpo da função:
    ```sql
    IF p_verification_proof IS NULL OR btrim(p_verification_proof) = '' THEN
      RAISE EXCEPTION 'Prova de verificação de código obrigatória.';
    END IF;

    IF v_verified_challenge.verification_proof IS NULL OR length(btrim(v_verified_challenge.verification_proof)) < 32 THEN
      RAISE EXCEPTION 'Desafio sem prova de verificação válida. Repita a verificação do código.';
    END IF;

    IF p_verification_proof <> v_verified_challenge.verification_proof THEN
      RAISE EXCEPTION 'Prova de verificação de código inválida ou divergente da sessão que validou o OTP.';
    END IF;
    ```
  - Imediatamente após o aceite, o desafio transiciona para `status = 'consumido'` e `consumed_at = NOW()`, tornando a prova inutilizável para sempre.

### 2.4 Auditoria de `DROP FUNCTION`, Dependências e Assinaturas
* **Problema Identificado:** A coexistência de sobrecargas de `sec03_verify_invitation_activation_code` e a tentativa de alterar parâmetros com valor padrão causavam erro `42P13 (cannot remove parameter defaults)` e erro `HTTP 300 Multiple Choices` no PostgREST.
* **Correção Aplicada:**
  - A migration agora executa explicitamente o DROP das sobrecargas anteriores antes da recriação:
    ```sql
    DROP FUNCTION IF EXISTS public.sec03_verify_invitation_activation_code(TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT);
    DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT);
    DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT, UUID);
    DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT, UUID, TEXT);
    ```
  - Estabelecida a segregação límpida por aridade:
    - `sec03_verify_invitation_activation_code(p_token, p_code, p_server_secret)` (3 args) -> estrito para `service_role`.
    - `sec03_verify_invitation_activation_code(p_token, p_code)` (2 args) -> seguro para `anon` e `authenticated`, lendo do `private.sec03_settings`.
  - Auditoria no catálogo `pg_depend` comprovou **0 dependências órfãs ou quebradas** em triggers, views ou foreign keys.

### 2.5 Auditoria e Hardening das Políticas RLS em `tenant_invitations`
* **Problema Identificado:** Migrações legadas (`20260524090000`, `20260512_rls_tenant_purge_final`) deixaram políticas concorrentes com nomes distintos (`Convites visíveis para admins do tenant`, `tenant_invitations_admin_select`, `tenant_invitations_select`), que em PostgreSQL são combinadas via operador lógico `OR`.
* **Correção Aplicada:**
  - Purga explícita de todas as 10 políticas legadas e criação de 4 políticas atômicas e restritivas para administradores do tenant:
    - `tenant_invitations_admin_select` (FOR SELECT)
    - `tenant_invitations_admin_insert` (FOR INSERT)
    - `tenant_invitations_admin_update` (FOR UPDATE)
    - `tenant_invitations_admin_delete` (FOR DELETE)
  - Isolamento estrito: `p.tenant_id = public.tenant_invitations.tenant_id AND lower(p.role) = 'admin'`.
  - O papel `anon` não possui nenhuma política direta em `tenant_invitations` (toda consulta anônima ocorre exclusivamente pela SECURITY DEFINER `validate_invitation_token`).

### 2.6 URL Pública Completa no Botão "Copiar Convite"
* **Problema Identificado:** O backend retornava a mensagem com o caminho relativo `/cadastro?token=...`, o que tornava o link não clicável quando compartilhado diretamente pelo administrador em mensagerias corporativas.
* **Correção Aplicada:**
  - Em `src/pages/Governanca/Usuarios.tsx`, tanto na criação quanto na reemissão de código, o frontend substitui a rota relativa pela URL pública absoluta canônica da aplicação (`${window.location.origin}/cadastro?token=${token}`).
  - O texto copiado para a área de transferência agora contém a URL navegável completa (ex: `https://app.esc-log.com.br/cadastro?token=...` ou `http://127.0.0.1:4173/cadastro?token=...`).

### 2.7 Compatibilidade com Edge Function e Frontend
* **Edge Function `sec03-activate-account/index.ts`:**
  - Ajustada para invocar a RPC de verificação sem necessidade de segredo injetado no container.
  - Exige a presença de `verification_proof` ou `code` antes de qualquer mutação de usuário no GoTrue.
  - Mantida a compensação transacional (Rollback em `auth.users` caso ocorra falha na gravação do perfil no banco de dados).
* **Frontend `Usuarios.tsx` e `Cadastro.tsx`:**
  - Validados com stepper visual em 3 etapas, contagem decrescente de tentativas (5 tentativas) e bloqueio imediato contra senhas fracas (< 12 caracteres).

---

## 3. EVIDÊNCIAS TÉCNICAS E VALIDAÇÃO

### 3.1 Testes em Banco Descartável Cloud-Compatible (`sec03_hml_cloud_compat`)
Provisionou-se um banco descartável com schema idêntico ao de produção no Supabase Cloud (`tenants.name`, sem `profiles.telefone`):
* **Tempo de Aplicação:** 72ms.
* **Erros de DDL/DML:** 0 erros.
* **Bateria T1 a T9:**
  - `T1`: Inserção de tenant com coluna `name` -> **PASS**
  - `T2`: Geração de convite com código CSPRNG de 6 dígitos -> **PASS**
  - `T3`: RPC `validate_invitation_token` com retorno de 11 colunas canônicas -> **PASS**
  - `T4`: Tentativa com código incorreto e decremento de tentativas -> **PASS**
  - `T5`: Código correto emitindo `verification_proof` de 64 caracteres hex -> **PASS**
  - `T6a`: Bloqueio estrito de `accept_tenant_invitation` com prova nula -> **PASS**
  - `T6b`: Bloqueio estrito com prova divergente/adulterada (Session Hijacking) -> **PASS**
  - `T7`: Aceite legítimo com inserção correta em `profiles` e `user_permissions` -> **PASS**
  - `T8`: Auditoria de consistência relacional e integridade de roles -> **PASS**
  - `T9`: Bloqueio de reutilização de convite já consumido -> **PASS**
* **Teste de Idempotência:** A migration consolidada foi reexecutada imediatamente sobre o mesmo banco: **100% IDEMPOTENTE (0 erros)**.

### 3.2 Validação Estatística do CSPRNG (20.000 Amostras)
Executado script dedicado (`scratch/test_csprng.mjs`) para testar a distribuição de códigos numéricos de 6 dígitos gerados pelo PostgreSQL:
* **Total de Execuções:** 20.000 amostras consecutivas.
* **Código Mínimo Gerado:** `100051` (garantia de 6 dígitos, sem perda de zeros à esquerda).
* **Código Máximo Gerado:** `999930`.
* **Comprimento Mínimo / Máximo:** 6 caracteres / 6 caracteres.
* **Códigos Únicos:** 19.806 (taxa de colisão compatível com a teoria das probabilidades para espaço amostral de 900.000 opções).

### 3.3 Homologação E2E Black Box Integrada (Navegador Real + Edge Runtime)
Executada a suíte completa de testes automatizados com navegador Playwright MSEdge, servidor Vite Preview de produção e containers locais:

```text
======================================================
             RESUMO DA HOMOLOGAÇÃO BLACK BOX           
======================================================
TOTAL DE CENÁRIOS: 23
PASS: 23
FAIL: 0
======================================================
```

| ID | Cenário | Resultado |
| :--- | :--- | :---: |
| **SETUP-01** | Provisionamento de Tenants Isolados e Admin Local | **PASS** |
| **FLOW-01** | Login Administrativo no ERP Local | **PASS** |
| **FLOW-02** | Navegação até a Governança de Usuários | **PASS** |
| **FLOW-03** | Cadastro Administrativo e Geração de Convite | **PASS** |
| **FLOW-04** | Cópia do Convite com URL Pública Completa e Código CSPRNG | **PASS** |
| **FLOW-05** | Onboarding Passo 1: Reconhecimento da Razão Social e Nome | **PASS** |
| **FLOW-06** | Onboarding Passo 2: Rejeição de Código Incorreto com Contador Decrescente | **PASS** |
| **FLOW-07** | Onboarding Passo 2: Validação com Sucesso do OTP de 6 Dígitos | **PASS** |
| **FLOW-08** | Onboarding Passo 3: Criação de Senha Forte e Ativação via Edge Function | **PASS** |
| **DB-01** | Auditoria de Persistência: GoTrue, Profiles e Permissões | **PASS** |
| **FLOW-09** | Login com Sucesso Utilizando a Nova Credencial | **PASS** |
| **SEC-01** | Amarração Criptográfica de Sessão (Session Proof Binding Negativo) | **PASS** |
| **SEC-02** | Bloqueio Estrito por Código OTP Expirado (10 minutos) | **PASS** |
| **SEC-03** | Bloqueio Imediato Após 5 Tentativas Incorretas (Trava Defensiva) | **PASS** |
| **SEC-04** | Reemissão de Código: Invalidação Imediata do Código Anterior | **PASS** |
| **SEC-05** | Bloqueio de Reutilização de Convite Já Consumido | **PASS** |
| **SEC-06** | Isolamento RLS Multi-Tenant (Tenant A não acessa Tenant B) | **PASS** |
| **SEC-07** | Prevenção de Elevação de Privilégios (Role Fixada) | **PASS** |
| **SEC-08** | Proteção Contra Conflito de Tenant (E-mail já ativo rejeitado) | **PASS** |
| **SEC-09** | Segregação do Encarregado: Acesso Restrito ao Portal Operacional | **PASS** |
| **SEC-10** | Revogação de Convite: Invalidação Imediata de Código | **PASS** |
| **SEC-11** | Prevenção de Bypass de OTP via API (Rejeição Sem Código e Sem Prova) | **PASS** |
| **SEC-12** | Compensação Atômica e Recuperação Idempotente Após Falha Parcial | **PASS** |

---

## 4. RISCOS REMANESCENTES E MITIGAÇÕES

1. **Ordem de Aplicação no Cloud:**  
   * *Risco:* Se a Edge Function ou o frontend forem publicados antes da migration, chamadas com os novos parâmetros falhariam.  
   * *Mitigação:* Ordem obrigatória de implantação em produção: **(1) Migration SQL no PostgreSQL Cloud -> (2) Deploy da Edge Function `sec03-activate-account` -> (3) Deploy do Frontend SPA**.
2. **Histórico de Migrations no Supabase CLI:**  
   * *Risco:* Tentativa acidental de reaplicar migrations legadas.  
   * *Mitigação:* As 3 migrations intermediárias foram arquivadas em `supabase/migrations/archive_sec03_dev/`. Apenas o arquivo canônico `20261101120000_sec_03_onboarding_seguro_producao.sql` reside no diretório ativo do CLI.

---

## 5. CHECKLIST GO/NO-GO

- [x] Segredo HMAC fixo e fallbacks 100% eliminados.
- [x] Segredo HMAC provisionado via CSPRNG de 256 bits no schema `private`.
- [x] `random()` substituído por CSPRNG criptográfico seguro (`gen_random_bytes(4)`).
- [x] `verification_proof` obrigatória e exigida sem possibilidade de bypass.
- [x] `DROP FUNCTION` mapeados e executados sem dependências quebradas no catálogo.
- [x] RLS de `tenant_invitations` purgada e endurecida para todas as operações (CRUD).
- [x] URL pública completa gerada e validada no botão "Copiar convite".
- [x] Edge Function e frontend totalmente sincronizados e compatíveis.
- [x] Suíte Black Box com 23/23 testes PASS (0 falhas).
- [x] `.env.local` restaurado para apontamento canônico do Supabase Cloud.
- [x] Nenhuma alteração realizada em produção (Cloud mantido estritamente READ-ONLY).

---

## 6. PARECER FINAL DE ENGENHARIA

> **PARECER: GO DEFINITIVO PARA IMPLANTAÇÃO CONTROLADA**  
> 
> A arquitetura da **SEC-03 (Fase 02.4.2)** atingiu o nível máximo de blindagem técnica, integridade relacional e conformidade de segurança. Todos os artefatos estão consolidados, testados e prontos para publicação em produção.
>
> **A execução em produção permanece BLOQUEADA, aguardando a autorização do usuário.**

