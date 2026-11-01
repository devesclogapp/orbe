# ORBE — SEC-03 | RELATÓRIO DE CONSOLIDAÇÃO PRÉ-DEPLOY (FASE 02.4.1)

**Data:** 01 de Novembro de 2026  
**Status:** CONCLUÍDO COM SUCESSO  
**Parecer:** **GO RESTRITO (Pronto para Execução Controlada sob Autorização)**  
**Ambiente Auditado:** Local Isolado (PostgreSQL 17.2, Docker Supabase CLI v2.75.0, Edge Runtime Deno 2.1.4, Vite 5.4.14 Preview) vs. Supabase Cloud (`lifgjtcflzmspilhryap`)

---

## 1. INCOMPATIBILIDADES ENCONTRADAS E CORRIGIDAS

Durante a auditoria estrita pré-deploy (Fase 02.4) e consolidação do schema (Fase 02.4.1), foram mapeadas e corrigidas na raiz todas as divergências entre o desenvolvimento local e o schema canônico de produção no Supabase Cloud:

### 1.1 Incompatibilidade Crítica: `tenants.name` vs `tenants.nome` (Schema Drift)
* **Divergência:** No Supabase Cloud (`lifgjtcflzmspilhryap`), a migration `20260505000000_tenants_multitenant.sql` estruturou a tabela `public.tenants` com a coluna canônica `name` (`VARCHAR(255)`). No ambiente local de desenvolvimento, alguns scripts referenciavam a coluna legada `nome`.
* **Impacto em Produção:** Se aplicada no Cloud sem correção, as RPCs `validate_invitation_token`, `admin_create_invitation_with_activation_code` e `admin_issue_new_activation_code` falhariam com erro fatal de PostgreSQL `42703 (column t.nome does not exist)`.
* **Correção na Raiz:** A migration consolidada `20261101120000_sec_03_onboarding_seguro_producao.sql` padronizou 100% das referências para `t.name AS tenant_name` e `SELECT name INTO v_tenant_nome`, garantindo perfeita compatibilidade com o schema oficial do Cloud sem recorrer a fallbacks ou heurísticas inseguras.

### 1.2 Incompatibilidade de Schema: Coluna `telefone` em `public.profiles`
* **Divergência:** No schema Cloud, a tabela `public.profiles` contém apenas as colunas `id`, `user_id`, `tenant_id`, `role`, `full_name`, `avatar_url`, `created_at`, `updated_at`. A coluna `telefone` não existe em `profiles`. Os números de telefone residem legitimamente em `public.user_permissions.phone` e `public.tenant_invitations.phone`.
* **Impacto em Produção:** A execução de `accept_tenant_invitation` falharia no Cloud com erro `42703: column "telefone" of relation "profiles" does not exist`, impedindo a criação do perfil do colaborador no momento do aceite do convite.
* **Correção na Raiz:** O comando `INSERT INTO public.profiles` na função `accept_tenant_invitation` foi estritamente alinhado ao Cloud, persistindo `phone` exclusivamente na tabela de governança `public.user_permissions.phone` e mantendo `profiles` com os 4 campos canônicos (`user_id`, `tenant_id`, `role`, `full_name`).

### 1.3 Namespace de Funções Nativas: `random()` vs `extensions.random()`
* **Divergência:** O script preliminar tentava chamar `extensions.random()` para cálculo do código numérico de 6 dígitos.
* **Impacto em Produção:** Falha no PostgreSQL com `42883 (function extensions.random() does not exist)` porque `random()` é uma função nativa do catálogo padrão (`pg_catalog`).
* **Correção na Raiz:** Substituído por `random()` nativo nas linhas 303 e 499 da migration consolidada.

### 1.4 Bloqueio Pessimista de Desafio Excedido em Múltiplas Tentativas
* **Divergência:** Quando um desafio de ativação atingia 5 tentativas incorretas, seu status passava para `bloqueado_tentativas`. Tentativas subsequentes na mesma sessão caíam na query `WHERE status = 'pendente'`, retornando o status genérico `NO_ACTIVE_CHALLENGE` em vez de confirmar o bloqueio permanente do código.
* **Impacto em Produção:** Dúvida semântica no frontend do colaborador e relaxamento de validação defensiva.
* **Correção na Raiz:** A query foi ajustada para `WHERE status IN ('pendente', 'bloqueado_tentativas')`. Qualquer chamada posterior ao bloqueio retorna deterministicamente `error: MAX_ATTEMPTS_EXCEEDED, blocked: true, remaining_attempts: 0`.

---

## 2. ARQUIVOS CRIADOS OU MODIFICADOS

### 2.1 Backend / Banco de Dados (Supabase & Migrations)
1. **`supabase/migrations/20261101120000_sec_03_onboarding_seguro_producao.sql`** (Novo / Canônico):
   - Migration consolidada única, atômica e idempotente.
   - Criação da tabela `public.tenant_invitation_challenges` com índices de performance e restrições de integridade.
   - Criação do schema `private` e tabela `private.sec03_settings` para custódia do segredo HMAC.
   - Funções RPC com Session Proof Binding: `validate_invitation_token`, `admin_create_invitation_with_activation_code`, `admin_issue_new_activation_code`, `sec03_verify_invitation_activation_code` e `accept_tenant_invitation`.
   - Políticas RLS rigorosas em `tenant_invitations` com suporte a Service Role e isolamento multi-tenant.
2. **`supabase/migrations/archive_sec03_dev/`** (Pasta de Arquivamento Local):
   - `20261030203000_sec_03_fase2_1_onboarding_otp_foundation.sql`
   - `20261101100000_sec_03_fase2_2_convite_simplificado_local.sql`
   - `20261101110000_sec_03_fase2_3_session_proof_binding_local.sql`
   - *Nota:* As migrations intermediárias foram arquivadas fora da pasta ativa para evitar conflitos de ordem e execução duplicada no Supabase CLI.

### 2.2 Backend Serverless (Edge Functions)
1. **`supabase/functions/sec03-activate-account/index.ts`**:
   - Orquestrador seguro de ativação integrado ao GoTrue e RPCs PostgreSQL.
   - Session Proof Binding: valida e exige `verification_proof` (hash SHA-256 de 32 bytes) emitido exclusivamente após validação do OTP.
   - Idempotência e Rollback: em caso de falha de banco pós-criação de usuário em `auth.users`, executa rollback atômico com exclusão segura apenas da identidade recém-gerada.

### 2.3 Frontend React (SPA Onboarding & Governança)
1. **`src/pages/Governanca/Usuarios.tsx`**:
   - Modal administrativo em 2 etapas com geração do link de ativação e código OTP temporário.
   - Botão **"Copiar convite"** com formatação padronizada e sem integrações externas de mensageria.
   - Reemissão de código para convites pendentes sem alterar o token do convite.
2. **`src/pages/Auth/Cadastro.tsx`**:
   - Fluxo de ativação em 3 etapas com stepper visual (Identidade → Código → Senha).
   - Bloqueio de avanço sem validação prévia de código.
   - Exibição de tentativas restantes e expiração de 10 minutos.

---

## 3. ESTRATÉGIA DE HISTÓRICO DE MIGRATIONS

Para garantir que a implantação futura ocorra sem riscos de duplicação, erros de dependência ou divergência de estado:

1. **Eliminação de Múltiplos Arquivos Incrementais:**
   - As três migrations criadas durante as fases 02.1, 02.2 e 02.3 foram sintetizadas em um único arquivo consolidado: `20261101120000_sec_03_onboarding_seguro_producao.sql`.
   - Os arquivos legados de desenvolvimento foram movidos para `supabase/migrations/archive_sec03_dev/`. Como o Supabase CLI apenas varre arquivos no primeiro nível de `supabase/migrations/`, o CLI não tentará aplicar os arquivos intermediários.
2. **Registro Atômico em `supabase_migrations.schema_migrations`:**
   - Quando a migration for aplicada no Cloud via Supabase CLI (`supabase db push`) ou console SQL, apenas a versão `20261101120000` será registrada na tabela `supabase_migrations.schema_migrations`.
3. **Idempotência Total do Script:**
   - O script utiliza cláusulas defensivas (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`, `DROP POLICY IF EXISTS`).
   - Se por qualquer motivo o script for reaplicado, ele não causará erros nem corromperá dados existentes.

---

## 4. EVIDÊNCIAS TÉCNICAS DOS TESTES EM AMBIENTE COMPATÍVEL

### 4.1 Validação em Banco Descartável com Schema Idêntico ao Cloud (`sec03_hml_cloud_compat`)
Foi provisionado um banco PostgreSQL 17 dedicado com a baseline exata de produção (`tenants.name`, sem `profiles.telefone`).
* **Comando:** `node scratch/test_sec03_cloud_compat_migration.mjs`
* **Tempo de Execução:** 53ms.
* **Erros de DDL/DML:** **0 erros**.
* **Resultados dos Testes Unitários:**
  - `T1`: Inserção de Tenant e Admin com coluna `tenants.name` -> **PASS**
  - `T2`: Criação de convite com HMAC e mensagem formatada -> **PASS**
  - `T3`: Leitura via RPC `validate_invitation_token` retornando `tenant_name` -> **PASS**
  - `T4`: Tentativa com código incorreto e decremento de tentativas -> **PASS**
  - `T5`: Validação de código correto gerando `verification_proof` (64 hex chars) -> **PASS**
  - `T6`: Session Proof Binding Negativo (rejeição de prova falsa) -> **PASS**
  - `T7`: Aceite do convite (`accept_tenant_invitation`) compatível com schema `profiles` do Cloud -> **PASS**
  - `T8`: Verificação de integridade pós-ativação (`profiles`, `user_permissions.phone`) -> **PASS**
  - `T9`: Bloqueio imediato de reutilização de convite consumido -> **PASS**
* **Teste de Idempotência:** A migration foi executada uma 2ª vez consecutiva no mesmo banco: **Execução com SUCESSO (100% IDEMPOTENTE)**.

### 4.2 Bateria Completa de Homologação Black Box E2E (Navegador Real + Edge Runtime)
A suíte E2E automatizada executou todos os 23 cenários utilizando navegador real (Microsoft Edge headless via Playwright), Vite Preview (build de produção), Supabase Auth e PostgreSQL 17 local:

| ID | Cenário / Teste de Homologação | Resultado |
| :--- | :--- | :---: |
| **SETUP-01** | Provisionamento de Tenants Sintéticos Isolados e Administrador Local | **PASS** |
| **FLOW-01** | Login Administrativo no ERP Local com Credencial do Tenant | **PASS** |
| **FLOW-02** | Navegação até a Governança de Usuários | **PASS** |
| **FLOW-03** | Cadastro Administrativo de Colaborador e Geração de Convite | **PASS** |
| **FLOW-04** | Validação da Cópia do Convite (Clipboard Real com Token e OTP de 6 dígitos) | **PASS** |
| **FLOW-05** | Onboarding Passo 1: Reconhecimento da Razão Social e Nome do Colaborador | **PASS** |
| **FLOW-06** | Onboarding Passo 2: Rejeição de Código Incorreto com Contador Decrescente | **PASS** |
| **FLOW-07** | Onboarding Passo 2: Validação do Código OTP Correto | **PASS** |
| **FLOW-08** | Onboarding Passo 3: Criação de Senha Forte e Ativação via Edge Function | **PASS** |
| **DB-01** | Auditoria de Persistência: Identidade GoTrue, Perfil e Permissões Ativas | **PASS** |
| **FLOW-09** | Login com Sucesso Utilizando a Nova Credencial Provisionada | **PASS** |
| **SEC-01** | Amarracão Criptográfica de Sessão (Session Proof Binding Negativo) | **PASS** |
| **SEC-02** | Bloqueio Estrito por Código OTP Expirado (10 minutos) | **PASS** |
| **SEC-03** | Bloqueio Imediato Após 5 Tentativas Incorretas (Trava Defensiva) | **PASS** |
| **SEC-04** | Reemissão de Código: Invalidação Imediata do Código Anterior e Sucesso do Novo | **PASS** |
| **SEC-05** | Bloqueio Estrito de Reutilização de Convite Já Consumido | **PASS** |
| **SEC-06** | Isolamento RLS Multi-Tenant: Usuário de Tenant A Não Acessa Tenant B | **PASS** |
| **SEC-07** | Prevenção de Elevação de Privilégios: Role Fixada Conforme o Convite Original | **PASS** |
| **SEC-08** | Proteção Contra Conflito de Tenant (E-mail Já Ativo em Outro Tenant Rejeitado) | **PASS** |
| **SEC-09** | Segregação de Encarregado: Acesso Restrito ao Portal Operacional Sem Acesso Admin | **PASS** |
| **SEC-10** | Revogação de Convite: Invalidação Imediata de Código e Bloqueio de Ativação | **PASS** |
| **SEC-11** | Prevenção de Bypass de OTP via API: Rejeição Estrita Sem Código e Sem Prova | **PASS** |
| **SEC-12** | Compensação Atômica e Recuperação Idempotente Após Falha Parcial | **PASS** |

**Total de Cenários:** 23 | **PASS:** 23 | **FAIL:** 0 (100% de Sucesso)

---

## 5. RISCOS RESIDUAIS E MITIGAÇÕES

| Risco Mapeado | Severidade | Mitigação Implementada / Plano de Ação |
| :--- | :---: | :--- |
| **1. Ordem de Deploy Desalinhada** | Alta | Se o frontend for publicado antes da Edge Function e da migration, novos convites podem falhar. **Mitigação:** Ordem estrita obrigatória: `(1) Migration DB -> (2) Edge Function -> (3) Deploy Frontend`. |
| **2. Segredo HMAC Ausente no Cloud** | Média | A tabela `private.sec03_settings` possui fallback seguro interno para caso o secret não seja preenchido no primeiro segundo. **Mitigação:** A migration já insere automaticamente um secret criptográfico de alta entropia durante a execução do DDL. |
| **3. Convites Gerados Anteriormente** | Baixa | Convites criados sob o formato legado não possuem registro em `tenant_invitation_challenges`. **Mitigação:** O frontend e o backend tratam isso informando que o código expirou e orientam o usuário a clicar em "Reemitir código". |
| **4. Inconsistência entre Auth e PostgreSQL** | Média | Caso o GoTrue crie o usuário mas a gravação no banco falhe, o e-mail poderia ficar preso. **Mitigação:** A Edge Function implementa compensação imediata: remove o usuário recém-criado em caso de erro no PostgreSQL e permite nova ativação sem conflito. |

---

## 6. CHECKLIST GO/NO-GO PARA IMPLANTAÇÃO CONTROLADA

- [x] Incompatibilidade `tenants.name` corrigida na raiz da migration consolidada.
- [x] Incompatibilidade `profiles.telefone` alinhada com o schema canônico do Cloud.
- [x] Função nativa `random()` corrigida (removido prefixo errôneo de extensão).
- [x] Regra de 5 tentativas incorretas ajustada para bloqueio contínuo e determinístico.
- [x] Migrations legadas de desenvolvimento devidamente arquivadas em `archive_sec03_dev/`.
- [x] Migration única `20261101120000_sec_03_onboarding_seguro_producao.sql` validada e 100% idempotente.
- [x] Homologação Black Box E2E aprovada com 23/23 testes PASS (0 falhas).
- [x] Frontend compilado via `npm run build` com 0 erros de TypeScript e bundling.
- [x] Nenhuma alteração realizada em produção (ambiente Cloud estritamente preservado).
- [x] Arquivo `.env.local` restaurado para apontamento canônico do Cloud (`lifgjtcflzmspilhryap`).

---

## 7. PARECER FINAL DA ENGENHARIA

> **PARECER: CONDITIONAL GO (PRONTO PARA IMPLANTAÇÃO)**  
> A Fase 02.4.1 concluiu todas as correções preventivas e saneou todos os riscos de incompatibilidade estrutural com o Supabase Cloud. A migration consolidada é única, segura e verificada.
>
> **A execução em produção encontra-se BLOQUEADA aguardando a aprovação expressa do usuário para a Fase 02.5 (Execução Controlada do Deploy).**

