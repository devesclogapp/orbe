# ERP ORBE — SEC-02 | PRÉ-PROD 07 — Plano Executivo Final de Implantação
**Documento Operacional de Engenharia, Janela de Manutenção e Procedimento de Deploy**  
**Data:** 30 de Outubro de 2026  
**Status do Plano:** HOMOLOGADO E CONSOLIDADO (PRONTO PARA EXECUÇÃO CONTROLADA)  
**Status de Produção:** **HOLD RIGOROSO MANTIDO — NENHUM DEPLOY EXECUTADO**  
**Projeto de Destino:** Supabase Cloud Project `lifgjtcflzmspilhryap`

---

## 1. Verificação de Infraestrutura e Limitações de Recuperação

### 1.1 Identificação do Projeto de Destino
- **Identificador Supabase (Project Ref):** `lifgjtcflzmspilhryap` (região AWS padrão Supabase Cloud).
- **Endpoint da API:** `https://lifgjtcflzmspilhryap.supabase.co`
- **Ambiente de Dados:** Base de produção oficial do ERP ORBE.

### 1.2 Auditoria de Disponibilidade de Backups, PITR e Migrations
Com base na análise estrita das ferramentas disponíveis e aplicando o princípio fundamental de auditoria de **não presumir como aprovada qualquer informação não verificada**:

1. **Backups Diários Programados da Infraestrutura:**  
   Projetos Supabase Pro possuem rotinas diárias automatizadas de backup físico gerenciadas pelo provedor. No entanto, o catálogo padrão do PostgreSQL (`pg_catalog`) não armazena logs de execução da infraestrutura cloud.
   - **STATUS AUDITADO:** **NÃO COMPROVADO VIA TELEMETRIA REMOTA**.
   - A data, horário exato e sucesso da conclusão do último backup físico dependem obrigatoriamente de inspeção visual no painel do Supabase.

2. **Point-in-Time Recovery (PITR):**  
   No plano Supabase Pro, o PITR é um **add-on opcional e pago** (retenção de 7 dias de WAL contínuo), não vindo habilitado por padrão.
   - **STATUS AUDITADO:** **NÃO COMPROVADO / PRESUMIDO INATIVO**.
   - O plano de contingência não pode depender de restauração PITR até confirmação formal no console.

3. **Histórico Completo de Migrations Remotas:**  
   O Supabase CLI local não se encontra autenticado com token de Management API para o projeto `lifgjtcflzmspilhryap`. Embora as consultas de catálogo tenham atestado a compatibilidade das tabelas `profiles` e `tenant_invitations`, **a existência de objetos e colunas semelhantes no catálogo NÃO comprova a aplicação formal das migrations correspondentes**.
   - **STATUS AUDITADO:** **NÃO COMPROVADO FORMALMENTE VIA TABELA DE CONTROLE/CLI**.

4. **Diferenciação Estrita dos Três Domínios de Recuperação:**  
   Para evitar falhas operacionais na contingência, a arquitetura distingue formalmente:
   - **Rollback de Migration:** Script SQL transacional que desfaz DDLs e regras no catálogo (reversão cirúrgica de funções, triggers e policies sem perda de dados das tabelas).
   - **Backup Lógico Específico:** Extração e restauração controlada de dados, esquema, triggers, policies RLS e privilégios das tabelas afetadas.
   - **Recuperação Completa de Infraestrutura:** Restauração de snapshot diário ou PITR no painel Supabase, que afeta a instância inteira e envolve perda das transações ocorridas após o ponto de snapshot.

---

## 2. Revisão do Procedimento de Implantação

### 2.1 Migration Oficial a ser Aplicada
- **Arquivo Canônico:** [supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql)
- **Histórico e Dependências:**
  - Depende do schema `public.profiles`, `public.tenants` e `public.tenant_invitations` pré-existentes.
  - A PRÉ-PROD 04 já comprovou que a base de produção atende a 100% dos pré-requisitos estruturais (zero perfis órfãos, zero perfis sem tenant, zero roles fora da whitelist e presença das colunas de onboarding).

### 2.2 Método de Execução Homologado: SQL Editor do Painel Supabase
Para a migration SEC-02, o método homologado é o **SQL Editor do painel administrativo do Supabase**, pelas seguintes razões:
1. **Papel Operacional:** Executa sob a role de superusuário `postgres`, garantindo permissão sobre `auth.users`, concessões de grants e criação de funções com `SECURITY DEFINER`.
2. **Atomicidade e Visibilidade:** Permite visualização imediata de `NOTICE`, alertas e mensagens de saída da transação.
3. **Rastreamento de Migrations:** Caso o projeto utilize a tabela de controle de migrations (`supabase_migrations.schema_migrations`), um comando de inserção de versionamento deve ser incluído ao final do bloco transacional.

### 2.3 Gestão de Bloqueios, Configuração de Timeouts e Tratamento de Erros Transacionais
A aplicação altera constraints em `tenant_invitations` e triggers em `profiles`, adquirindo breve lock exclusivo (`AccessExclusiveLock`). Para eliminar qualquer risco de travamento em cascata com transações concorrentes do ERP:
- **Lock Timeout Estrito:** `SET LOCAL lock_timeout = '5s';`
- **Statement Timeout Controlado:** `SET LOCAL statement_timeout = '60s';`

#### Tratamento de Erros e Controle Estrito da Sessão
Se qualquer tabela estiver retida por mais de 5 segundos ou ocorrer qualquer exceção durante a execução, o bloco transacional entra imediatamente no estado de falha (`ERROR: current transaction is aborted, commands ignored until end of transaction block`).
- **NUNCA tentar reexecutar comandos sem limpar a sessão:**
  1. O operador deve emitir um comando explícito de `ROLLBACK;`.
  2. É mandatório verificar que a sessão retornou ao estado limpo `IDLE`:
     ```sql
     -- Deve retornar NULL (nenhuma transação em andamento)
     SELECT pg_current_xact_id_if_assigned() AS transacao_ativa;
     ```
  3. Verificar que não restaram bloqueios residuais mantidos pela conexão:
     ```sql
     SELECT count(*) AS locks_pendentes FROM pg_locks WHERE pid = pg_backend_pid();
     ```
Somente após a confirmação explícita do estado limpo da sessão é permitida a avaliação das causas do lock antes de qualquer nova tentativa.

---

## 3. Plano de Recuperação e Contingência Controlado

### 3.1 Script de Rollback Homologado e Diretriz Anti-Reversão Insegura
- **Arquivo de Contingência:** [supabase/migrations/rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/migrations/rollback/20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql)
- **Status da Homologação:** Homologado com sucesso na **PRÉ-PROD 06** (reversibilidade bidirecional comprovada em PostgreSQL 17 local).
- **Assimetria Residual de `admin_update_user_access`:** A função permanece na versão atualizada da SEC-02, o que é plenamente compatível com o schema legado e agrega mais segurança contra elevação de privilégios.
- **Risco Crítico de Reintrodução de Permissões Inseguras:**  
  O acionamento do rollback reintroduz concessões amplas e inseguras (`GRANT ALL ON public.profiles, public.tenant_invitations TO anon, authenticated`), desfazendo a blindagem do multi-tenant.  
  *Diretriz de Governança:* **O rollback JAMAIS deve ser executado de forma automática ou como reflexo imediato.** Ele é estritamente condicionado ao diagnóstico técnico prévio e à autorização humana formal, avaliando-se primeiro se a inconsistência pode ser solucionada sem comprometer a segurança da aplicação.

### 3.2 Estratégia de Recuperação por Cenário (Sem Ações Automáticas)

A recuperação **nunca deve ser executada de forma automática ou cega** (seja restauração via dump ou execução de rollback). Toda ação é estritamente condicionada à avaliação técnica e autorização explícita.

| Cenário de Falha durante a Janela | Diagnóstico e Estado do Banco | Estratégia de Recuperação Controlada |
|---|---|---|
| **Cenário 1: Abortamento durante o `BEGIN ... COMMIT` (ex.: Lock Timeout de 5s)** | Bloco em estado de aborto; nenhuma alteração persistida no catálogo. | **Exigência de ROLLBACK Explícito e Verificação de Sessão.** O operador deve executar `ROLLBACK;` explicitamente. Confirmar que a sessão retornou a `IDLE` (`SELECT pg_current_xact_id_if_assigned()` é NULL) e que locks residuais foram liberados antes de qualquer reavaliação. **Não acionar rollback nem restore.** |
| **Cenário 2: Deploy conclui (`COMMIT`), mas Script 05 pós-deploy detecta falha em policies/grants** | Dados íntegros; inconsistência restrita a regras de autorização/RLS. | **Diagnóstico Técnico e Decisão Condicionada (Sem Rollback Automático).** Não executar rollback imediato devido ao risco de reintroduzir permissões inseguras (`GRANT ALL`). Diagnosticar causa raiz via Script 05. Se for ajuste pontual de grant/policy, aplicar correção cirúrgica. O rollback só pode ser executado após parecer técnico e autorização formal da equipe. |
| **Cenário 3: Inconsistência de dados detectada nas tabelas modificadas** | Corrupção de registros em `profiles` ou `tenant_invitations`. | **Restauração Lógica Parcial e Seletiva.** Pausar tráfego. Comparar dados atuais com o arquivo de backup lógico prévio. Injetar seletivamente apenas os registros divergentes, sob transação controlada e autorizada. |
| **Cenário 4: Falha catastrófica de infraestrutura ou corrupção de cluster** | Banco inacessível ou corrupção grave de catálogo PostgreSQL. | **Recuperação de Infraestrutura.** Acionar restauração do último snapshot no painel Supabase após aprovação formal da governança, ciente do RPO decorrente do snapshot do provedor. |

---

## 4. Checklist Operacional de Execução (Passo a Passo)

```text
  [FASE 1: PRÉ-DEPLOY — INFRAESTRUTURA E BACKUP]
     │
     ├── 1.1 Confirmação da Janela Noturna (22h00 - 23h00)
     ├── 1.2 Verificação manual no painel Supabase (Backup Diário e PITR)
     ├── 1.3 Execução do Backup Lógico Completo das 4 Tabelas (Dados, Esquema, RLS, Grants)
     ├── 1.4 Preservação das Definições e Permissões das Funções Independentes da SEC-02
     └── 1.5 Validação estrita da integridade de todos os artefatos de backup
     │
  [FASE 2: DEPLOY TRANSACIONAL]
     │
     ├── 2.1 Abrir SQL Editor no Supabase Cloud (sessão postgres)
     ├── 2.2 Configurar lock_timeout = 5s e statement_timeout = 60s
     └── 2.3 Executar bloco único transacional SEC-02 (BEGIN ... COMMIT)
     │
  [FASE 3: VALIDAÇÃO IMEDIATA (SMOKE TEST)]
     │
     ├── 3.1 Executar Script 05 (Auditoria Read-Only) ──> Exigir 13/13 PASS
     ├── 3.2 Login Administrativo (verificar Gestão de Usuários)
     └── 3.3 Login Operacional Encarregado (verificar isolamento)
```

---

## 5. Procedimentos de Backup Lógico e Critérios de Validação

### 5.1 Estratégia de Backup Lógico Abrangente
A proteção contra falhas exige capturar de forma reprodutível não apenas dados brutos, mas todo o arcabouço de esquema, funções, triggers, RLS e privilégios das 4 tabelas impactadas (`profiles`, `tenant_invitations`, `user_permissions`, `audit_log`), **além das funções independentes e rotinas RPC modificadas pela SEC-02**.
- **Atenção:** O `pg_dump --table` extrai apenas objetos diretamente atrelados às tabelas. Funções autônomas e rotinas RPC (`public.current_tenant_id()`, `public.admin_delete_tenant_invitation(uuid)`, etc.) **não são cobertas** pelo dump restrito a tabelas e exigem comando específico de preservação prévia de suas definições e concessões de privilégios (`ACL`).

#### Comando 1: Backup Lógico Estrutural das 4 Tabelas (Esquema + Dados + RLS + Grants)
Executar no terminal operacional seguro com credenciais de produção mantidas em variável de ambiente:

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

pg_dump "postgres://postgres:[PROD_PASSWORD]@db.lifgjtcflzmspilhryap.supabase.co:5432/postgres" \
  --table=public.profiles \
  --table=public.tenant_invitations \
  --table=public.user_permissions \
  --table=public.audit_log \
  --format=custom \
  --blobs \
  --verbose \
  --file="sec02_prod_backup_tabelas_${TIMESTAMP}.dump"
```

#### Comando 2: Exportação em Texto Plano das DDLs, Triggers e Políticas das Tabelas
Permite inspeção visual humana imediata das regras antes de qualquer alteração:

```bash
pg_dump "postgres://postgres:[PROD_PASSWORD]@db.lifgjtcflzmspilhryap.supabase.co:5432/postgres" \
  --table=public.profiles \
  --table=public.tenant_invitations \
  --table=public.user_permissions \
  --table=public.audit_log \
  --schema-only \
  --format=plain \
  --file="sec02_prod_schema_tabelas_pre_${TIMESTAMP}.sql"
```

#### Comando 3: Preservação das Definições e Permissões das Funções Independentes
Extração das definições exatas (`pg_get_functiondef`), proprietários, flags `SECURITY DEFINER`, search paths e privilégios concedidos (`information_schema.routine_privileges`) para todas as rotinas autônomas e funções de trigger modificadas pela SEC-02:
- `public.current_tenant_id()`
- `public.admin_delete_tenant_invitation(UUID)`
- `public.admin_update_user_access(UUID, TEXT, TEXT, JSONB)`
- `public.accept_tenant_invitation(TEXT)`
- Funções de trigger independentes: `protect_tenant_invitations_state()`, `protect_profile_sensitive_fields()`, `protect_profile_insert()`, `protect_profile_delete()`.

Executar no SQL Editor ou via psql e exportar a saída:

```sql
-- Salvar saída em: sec02_prod_funcoes_privilegios_pre_[TIMESTAMP].sql
SELECT 
    p.proname AS funcao,
    pg_get_functiondef(p.oid) AS definicao_ddl,
    pg_get_userbyid(p.proowner) AS proprietario,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config,
    (
        SELECT string_agg(grantee || '=' || privilege_type, ', ' ORDER BY grantee, privilege_type)
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' 
          AND routine_name = p.proname
    ) AS permissoes_concedidas
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'current_tenant_id',
    'admin_delete_tenant_invitation',
    'admin_update_user_access',
    'accept_tenant_invitation',
    'protect_tenant_invitations_state',
    'protect_profile_sensitive_fields',
    'protect_profile_insert',
    'protect_profile_delete'
  )
ORDER BY p.proname;
```

### 5.2 Critérios Mandatórios para Validar a Integridade dos Arquivos de Backup
Antes de iniciar a Fase 2 (Deploy), o operador deve validar formalmente a integridade dos artefatos gerados:

1. **Exit Code do Utilitário:** Os comandos `pg_dump` devem retornar código de saída `0`. Qualquer saída diferente de zero invalida o procedimento.
2. **Tamanho Não Nulo:** Todos os arquivos (`.dump` e `.sql`) devem possuir tamanho compatível com a base (não podem ter 0 bytes).
3. **Validação da Tabela de Conteúdo (TOC):** Executar `pg_restore --list sec02_prod_backup_tabelas_${TIMESTAMP}.dump` e certificar que as 4 tabelas (`TABLE`, `TABLE DATA`, `ACL` / grants e constraints) estão listadas sem erros de decodificação.
4. **Verificação de Cabeçalho e Rodapé no Arquivo SQL:** Confirmar a presença de `PostgreSQL database dump complete` na última linha do arquivo plain text.
5. **Verificação das Funções Independentes:** Certificar que a exportação do Comando 3 gerou com sucesso as DDLs e grants das funções pré-existentes no catálogo.
6. **Se qualquer um dos critérios falhar:** A janela de deploy é **abortada imediatamente**, mantendo a produção intocada.

### 5.3 Protocolo de Restauração Controlada (Não Automatizada)
Caso o Cenário 3 se concretize (necessidade comprovada de restaurar dados ou esquemas), seguir o protocolo:
1. **Inspeção Prévia do Catálogo:** Conectar em modo read-only e auditar o estado de `public.profiles` e `public.tenant_invitations`.
2. **Definição do Escopo de Restauração:**
   - Se a inconsistência for apenas relacional, gerar scripts DML cirúrgicos de correção (`UPDATE` / `INSERT`).
   - Se for necessária restauração de dados via dump:
     ```bash
     # Restauração controlada direcionada a tabela específica, SEM flags destrutivas cegas:
     pg_restore --data-only --table=public.profiles \
       -d "postgres://postgres:[PROD_PASSWORD]@db.lifgjtcflzmspilhryap.supabase.co:5432/postgres" \
       "sec02_prod_backup_completo_${TIMESTAMP}.dump"
     ```
3. **Revalidação Imediata:** Rodar o Script 05 após qualquer intervenção para atestar que os dados restaurados cumprem a conformidade do ERP.

---

## 6. Comandos e Scripts Preparados para a Janela

### Passo 1: Bloco DDL Preparado para o SQL Editor do Supabase (Deploy)
O script abaixo inclui travas de timeout e transacionalidade atômica:

```sql
-- ==============================================================================
-- IMPLANTAÇÃO OFICIAL SEC-02 — SUPABASE CLOUD (PROJETO: lifgjtcflzmspilhryap)
-- MODO: TRANSAÇÃO ATÔMICA COM PROTEÇÃO CONTRA LOCK EXTENSIVO
-- ==============================================================================

BEGIN;

-- 1. Travas de segurança contra contenção de concorrência
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 2. DDL Oficial de Hardening SEC-02
-- (Conteúdo integral de: supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql)

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.current_tenant_id() IS 
  'Retorna o tenant_id do usuário autenticado a partir de public.profiles de forma segura e determinística.';

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_tenant_profiles()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND lower(role) IN ('admin', 'rh', 'financeiro')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.can_view_tenant_profiles() IS
  'Função auxiliar de segurança para políticas RLS; verifica se o usuário autenticado possui perfil de gestão sem disparar recursão.';

REVOKE ALL ON FUNCTION public.can_view_tenant_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_tenant_profiles() TO authenticated, service_role;

REVOKE ALL ON public.profiles FROM anon, authenticated, PUBLIC;
REVOKE ALL (id, user_id, tenant_id, role, created_at) ON public.profiles FROM anon, authenticated, PUBLIC;

GRANT SELECT ON public.profiles TO authenticated;

DO $$
DECLARE
  v_col text;
  v_allowed_cols text[] := ARRAY[
    'full_name',
    'phone',
    'avatar_url',
    'updated_at',
    'onboarding_completed',
    'onboarding_step',
    'onboarding_completed_steps'
  ];
BEGIN
  FOREACH v_col IN ARRAY v_allowed_cols LOOP
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = v_col
    ) THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated;', v_col);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_delete" ON public.profiles;
DROP POLICY IF EXISTS "Read access for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR (
      tenant_id = public.current_tenant_id()
      AND public.can_view_tenant_profiles()
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_invitations_status_check'
      AND conrelid = 'public.tenant_invitations'::regclass
  ) THEN
    ALTER TABLE public.tenant_invitations DROP CONSTRAINT tenant_invitations_status_check;
  END IF;
END $$;

ALTER TABLE public.tenant_invitations
  ADD CONSTRAINT tenant_invitations_status_check
  CHECK (status IN ('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado'));

CREATE OR REPLACE FUNCTION public.protect_tenant_invitations_state()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Exclusão direta na tabela tenant_invitations não é permitida. Utilize as operações administrativas.';
    END IF;
    IF OLD.status = 'aceito' THEN
      RAISE EXCEPTION 'Convites com status aceito são registros históricos de auditoria e não podem ser excluídos.';
    END IF;
    RETURN OLD;
  END IF;

  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Mutações diretas na tabela tenant_invitations não são permitidas. Utilize as RPCs oficiais.';
  END IF;

  IF OLD.status = 'aceito' THEN
    RAISE EXCEPTION 'Convites com status aceito são estritamente imutáveis em todos os seus campos e não podem sofrer alterações.';
  END IF;

  IF NEW.status = 'em_processamento' THEN
    IF OLD.status IS DISTINCT FROM 'pendente' THEN
      RAISE EXCEPTION 'Apenas convites no status pendente podem entrar em processamento.';
    END IF;
    IF NEW.accepted_by IS NULL THEN
      RAISE EXCEPTION 'Convite em processamento requer indicação do usuário autenticado (accepted_by).';
    END IF;
    IF NEW.accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Convite em processamento não pode possuir accepted_at definido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_tenant_invitations_state ON public.tenant_invitations;
CREATE TRIGGER trg_protect_tenant_invitations_state
BEFORE UPDATE OR DELETE ON public.tenant_invitations
FOR EACH ROW
EXECUTE FUNCTION public.protect_tenant_invitations_state();

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  p_user_id UUID := auth.uid();
  invitation public.tenant_invitations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  profile_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND status = 'pendente'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, bloqueado ou expirado';
  END IF;

  IF lower(invitation.email) <> lower((SELECT email FROM auth.users WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
  END IF;

  UPDATE public.tenant_invitations
  SET
    status = 'em_processamento',
    accepted_by = p_user_id
  WHERE id = invitation.id;

  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    IF existing_profile.tenant_id IS DISTINCT FROM invitation.tenant_id THEN
      RAISE EXCEPTION 'Usuário já possui vínculo com outro tenant';
    END IF;

    UPDATE public.profiles
    SET
      role = lower(invitation.role),
      full_name = COALESCE(
        NULLIF(invitation.full_name, ''),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id),
        existing_profile.full_name
      )
    WHERE id = existing_profile.id
    RETURNING id INTO profile_id;
  ELSE
    INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
    VALUES (
      p_user_id,
      invitation.tenant_id,
      COALESCE(
        NULLIF(invitation.full_name, ''),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)
      ),
      lower(invitation.role)
    )
    RETURNING id INTO profile_id;
  END IF;

  INSERT INTO public.user_permissions (
    tenant_id,
    user_id,
    full_name,
    phone,
    role,
    status,
    permissions,
    invited_at,
    accepted_at
  )
  VALUES (
    invitation.tenant_id,
    p_user_id,
    COALESCE(
      NULLIF(invitation.full_name, ''),
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)
    ),
    invitation.phone,
    lower(invitation.role),
    'ativo',
    COALESCE(invitation.permissions, '{}'::jsonb),
    invitation.created_at,
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
    phone = COALESCE(EXCLUDED.phone, public.user_permissions.phone),
    role = EXCLUDED.role,
    status = 'ativo',
    permissions = EXCLUDED.permissions,
    invited_at = COALESCE(public.user_permissions.invited_at, EXCLUDED.invited_at),
    accepted_at = EXCLUDED.accepted_at,
    updated_at = NOW();

  UPDATE public.tenant_invitations
  SET
    status = 'aceito',
    accepted_at = NOW()
  WHERE id = invitation.id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Criação direta de perfis não permitida. Utilize o fluxo oficial de onboarding ou aceite de convite.';
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Todo perfil deve possuir um tenant_id válido.';
  END IF;

  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Todo perfil deve possuir um user_id válido.';
  END IF;

  IF NEW.role IS NULL OR lower(NEW.role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
    RAISE EXCEPTION 'Função (role) de usuário inválida.';
  END IF;

  NEW.role := lower(NEW.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_insert();

CREATE OR REPLACE FUNCTION public.protect_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Exclusão direta de perfis não permitida.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_delete ON public.profiles;
CREATE TRIGGER trg_protect_profile_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_delete();

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'O id de um perfil é estritamente imutável.';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant_id de um perfil é estritamente imutável.';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O user_id de um perfil é estritamente imutável.';
  END IF;

  IF lower(COALESCE(NEW.role, '')) IS DISTINCT FROM lower(COALESCE(OLD.role, '')) THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Alteração direta da função (role) não permitida. Utilize as operações administrativas autorizadas.';
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.tenant_invitations ti
        WHERE ti.accepted_by = OLD.user_id
          AND ti.tenant_id = OLD.tenant_id
          AND lower(ti.role) = lower(NEW.role)
          AND ti.status = 'em_processamento'
          AND ti.accepted_at IS NULL
          AND ti.expires_at > NOW()
          AND lower(ti.email) = lower((SELECT email FROM auth.users WHERE id = OLD.user_id))
      ) THEN
        RAISE EXCEPTION 'Não é permitido alterar a própria função/perfil de acesso sem um convite em processamento ativo, válido e tempestivo.';
      END IF;
    ELSIF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND lower(p.role) = 'admin'
          AND p.tenant_id = OLD.tenant_id
      ) THEN
        RAISE EXCEPTION 'Apenas o administrador do mesmo tenant pode alterar a função de um colaborador.';
      END IF;
    ELSE
      IF current_user IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'Operação anônima não autorizada para alterar papel de usuário.';
      END IF;
    END IF;

    NEW.role := lower(NEW.role);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

CREATE OR REPLACE FUNCTION public.admin_update_user_access(
  p_user_id UUID,
  p_role TEXT,
  p_status TEXT,
  p_permissions JSONB
)
RETURNS public.user_permissions AS $$
DECLARE
  v_tenant_id UUID;
  v_current_user UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_row public.user_permissions;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_user_id = v_current_user THEN
    RAISE EXCEPTION 'O administrador não pode alterar o próprio acesso por esta tela.';
  END IF;

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
    RAISE EXCEPTION 'Perfil de usuário inválido';
  END IF;

  IF lower(COALESCE(p_status, '')) NOT IN ('ativo', 'bloqueado') THEN
    RAISE EXCEPTION 'Status de usuário inválido';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id
    AND p.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant do administrador';
  END IF;

  UPDATE public.profiles
  SET role = lower(p_role)
  WHERE id = v_profile.id;

  INSERT INTO public.user_permissions (
    tenant_id,
    user_id,
    full_name,
    role,
    status,
    permissions,
    invited_at,
    accepted_at
  )
  VALUES (
    v_tenant_id,
    p_user_id,
    v_profile.full_name,
    lower(p_role),
    lower(p_status),
    COALESCE(p_permissions, '{}'::jsonb),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    permissions = EXCLUDED.permissions,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_delete_tenant_invitation(
  p_invitation_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID := auth.uid();
  v_invitation public.tenant_invitations%ROWTYPE;
  v_admin_nome TEXT;
  v_admin_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_tenant_id := public.admin_require_tenant_admin();

  IF p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de convite inválido';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.tenant_invitations
  WHERE id = p_invitation_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado ou inacessível';
  END IF;

  IF v_invitation.accepted_at IS NOT NULL OR v_invitation.status = 'aceito' THEN
    RAISE EXCEPTION 'Convites aceitos são registros históricos e não podem ser excluídos.';
  END IF;

  IF v_invitation.status = 'em_processamento' THEN
    RAISE EXCEPTION 'Convite em processamento de aceite não pode ser excluído.';
  END IF;

  IF v_invitation.status NOT IN ('pendente', 'convite_expirado', 'bloqueado') THEN
    RAISE EXCEPTION 'Estado de convite inválido ou não elegível para exclusão: %', v_invitation.status;
  END IF;

  SELECT full_name, role
  INTO v_admin_nome, v_admin_role
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  INSERT INTO public.audit_log (
    tenant_id,
    empresa_id,
    usuario_id,
    usuario_nome,
    perfil_usuario,
    acao,
    entidade,
    registro_id,
    descricao,
    valor_anterior,
    origem
  ) VALUES (
    v_tenant_id,
    NULL,
    v_user_id,
    v_admin_nome,
    v_admin_role,
    'DELETE',
    'tenant_invitations',
    v_invitation.id,
    format('Exclusão de convite administrativo para o e-mail: %s (função: %s)', v_invitation.email, v_invitation.role),
    to_jsonb(v_invitation) - 'token',
    'admin_delete_tenant_invitation'
  );

  DELETE FROM public.tenant_invitations
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Convite excluído com sucesso',
    'invitation_id', v_invitation.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_delete_tenant_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_tenant_invitation(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_user_access(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_access(UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.protect_tenant_invitations_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_delete() FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitations TO service_role;
GRANT SELECT ON public.tenant_invitations TO authenticated;
GRANT SELECT ON public.tenant_invitations TO anon;

COMMIT;
```

---

## 8. Pendências de Infraestrutura e Confirmações Mandatórias

Antes de qualquer autorização de deploy ou envio de scripts ao banco de produção:

1. [ ] **[NÃO COMPROVADO] Confirmação Manual do Backup Diário:** O operador deve acessar o console Supabase (`Database -> Backups -> Scheduled`) e comprovar que o backup físico automático da infraestrutura está concluído com sucesso e data recente.
2. [ ] **[NÃO COMPROVADO] Verificação do Status do PITR:** Verificar no painel de billing e backups se o add-on de Point-in-Time Recovery está ativo ou inativo.
3. [ ] **[NÃO COMPROVADO] Histórico de Migrations Remotas:** Não presumir execução por semelhança de catálogo. Confirmar se a tabela de versionamento remoto registra as migrations até a `20261024171000`.
4. [ ] **Geração e Validação do Backup Lógico:** Executar os Comandos 1, 2 e 3 (tabelas, esquemas e funções independentes da SEC-02) imediatamente antes da abertura da transação e validar os 6 critérios de integridade (exit code 0, tamanho, TOC, trailer e integridade das funções).
5. [ ] **Janela Noturna Aprovada:** Homologação do horário de baixo tráfego (22h00 às 23h00) e presença da equipe técnica de prontidão.

---

## 9. Parecer Técnico de Prontidão

> **PARECER FINAL: HOLD MANTIDO — NO-GO PARA EXECUÇÃO IMEDIATA**  
> **CLASSIFICAÇÃO TÉCNICA: GO CONDICIONADO À RESOLUÇÃO DAS PENDÊNCIAS DE INFRAESTRUTURA**  
> 
> A homologação técnica, o script de rollback e a blindagem contra concorrência estão plenamente aprovados no ambiente isolado.  
> No entanto, devido à impossibilidade de auditar a telemetria da infraestrutura cloud (backup diário, PITR e histórico formal de migrations) exclusivamente por consultas SQL ao banco:  
> 
> 1. **A implantação em produção NÃO está autorizada.**  
> 2. A liberação depende da confirmação manual das pendências no console Supabase e da execução bem-sucedida do backup lógico prévio.  
> 3. **Produção permanece rigorosamente em HOLD.**

---
**Auditor Responsável:** Engenharia Sênior de PostgreSQL & Segurança Multi-Tenant ORBE  
**Documento Oficial de Referência:** [supabase/auditorias/SEC_02_PRE_PROD_07_PLANO_EXECUTIVO.md](file:///y:/2026/ERP%20ESC%20LOG/Orbe/supabase/auditorias/SEC_02_PRE_PROD_07_PLANO_EXECUTIVO.md)
