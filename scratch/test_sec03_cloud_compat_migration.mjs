import pg from 'pg';
import fs from 'fs';
import { createHmac, randomUUID } from 'crypto';

const { Client } = pg;

const PG_CONFIG_BASE = {
  host: '127.0.0.1',
  port: 54322,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
};

const DB_TEST_NAME = 'sec03_hml_cloud_compat';

async function main() {
  console.log('=== TESTE EM BANCO LOCAL DESCARTÁVEL (SCHEMA CLOUD COMPATIBLE) ===');
  
  // 1. Conectar ao postgres padrão e recriar banco descartável
  const rootClient = new Client(PG_CONFIG_BASE);
  await rootClient.connect();
  console.log('1. Conectado ao PostgreSQL 17 na porta 54322.');

  await rootClient.query(`DROP DATABASE IF EXISTS ${DB_TEST_NAME};`);
  await rootClient.query(`CREATE DATABASE ${DB_TEST_NAME};`);
  console.log(`2. Banco descartável '${DB_TEST_NAME}' criado com sucesso.`);
  await rootClient.end();

  // 2. Conectar ao novo banco descartável
  const client = new Client({ ...PG_CONFIG_BASE, database: DB_TEST_NAME });
  await client.connect();

  console.log('3. Montando baseline idêntico ao Supabase Cloud (tenants.name, sem telefone em profiles)...');
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

    -- Schema auth simulado para GoTrue
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$ LANGUAGE sql STABLE;

    CREATE TABLE auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      raw_user_meta_data JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Baseline Cloud: tenants com 'name' (não 'nome'!)
    CREATE TABLE public.tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      created_by UUID,
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Baseline Cloud: profiles (sem telefone!)
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL,
      tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'user')),
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Baseline Cloud: user_permissions (telefone é phone aqui!)
    CREATE TABLE public.user_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      full_name TEXT,
      phone TEXT,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativo',
      permissions JSONB DEFAULT '{}'::jsonb,
      invited_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, tenant_id)
    );

    -- Baseline Cloud: tenant_invitations
    CREATE TABLE public.tenant_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      role TEXT NOT NULL,
      permissions JSONB DEFAULT '{}'::jsonb,
      token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      expires_at TIMESTAMPTZ NOT NULL,
      invited_by UUID,
      accepted_at TIMESTAMPTZ,
      accepted_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Baseline Cloud: audit_log
    CREATE TABLE public.audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID,
      empresa_id UUID,
      usuario_id UUID,
      usuario_nome TEXT,
      perfil_usuario TEXT,
      acao TEXT NOT NULL,
      entidade TEXT NOT NULL,
      registro_id UUID,
      descricao TEXT,
      valor_anterior JSONB,
      origem TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Baseline SEC-02: Funções auxiliares
    CREATE OR REPLACE FUNCTION public.current_tenant_id()
    RETURNS UUID AS $$
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    $$ LANGUAGE sql STABLE SECURITY DEFINER;

    CREATE OR REPLACE FUNCTION public.can_view_tenant_profiles()
    RETURNS BOOLEAN AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
          AND lower(role) IN ('admin', 'rh', 'financeiro')
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER;

    CREATE OR REPLACE FUNCTION public.admin_require_tenant_admin()
    RETURNS UUID AS $$
    DECLARE
      v_user_id UUID := auth.uid();
      v_tenant_id UUID;
      v_role TEXT;
    BEGIN
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
      END IF;
      SELECT tenant_id, lower(role) INTO v_tenant_id, v_role
      FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
      IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant do usuário não identificado';
      END IF;
      IF v_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Acesso restrito ao administrador da conta.';
      END IF;
      RETURN v_tenant_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Baseline Cloud: validate_invitation_token legado (9 colunas, sem tenant_name)
    CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
    RETURNS TABLE(
      id UUID,
      tenant_id UUID,
      email TEXT,
      full_name TEXT,
      phone TEXT,
      role TEXT,
      permissions JSONB,
      expires_at TIMESTAMPTZ,
      status TEXT
    ) AS $$
      SELECT ti.id, ti.tenant_id, ti.email, ti.full_name, ti.phone, ti.role, ti.permissions, ti.expires_at, ti.status
      FROM public.tenant_invitations ti
      WHERE ti.token = p_token;
    $$ LANGUAGE sql STABLE;

    -- Baseline Cloud: accept_tenant_invitation legado (1 parâmetro)
    CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
    RETURNS UUID AS $$
    BEGIN
      RETURN gen_random_uuid();
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('4. Baseline Cloud estabelecido com sucesso!');

  // 4. Ler e aplicar a migration consolidada de produção
  console.log('5. Aplicando: supabase/migrations/20261101120000_sec_03_onboarding_seguro_producao.sql ...');
  const migrationSql = fs.readFileSync('supabase/migrations/20261101120000_sec_03_onboarding_seguro_producao.sql', 'utf8');
  
  const startTime = Date.now();
  await client.query(migrationSql);
  const elapsedMs = Date.now() - startTime;
  console.log(`✅ Migration consolidada executada com SUCESSO em ${elapsedMs}ms sem erros!`);

  // 5. TESTES FUNCIONAIS E DE SEGURANÇA NO BANCO DESCARTÁVEL
  console.log('\n--- 6. Bateria de Testes Funcionais e de Segurança no Schema Compatível ---');
  
  // T1: Setup de tenant e admin
  const tenantId = randomUUID();
  const adminId = randomUUID();
  await client.query(`
    INSERT INTO public.tenants (id, name) VALUES ('${tenantId}', 'Empresa Alpha Transportes Cloud LTDA');
    INSERT INTO auth.users (id, email) VALUES ('${adminId}', 'admin@alpha.com.br');
    INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
    VALUES ('${adminId}', '${tenantId}', 'Administrador Titular', 'admin');
  `);
  console.log('T1: Tenant e Admin inseridos com coluna tenants.name.');

  // T2: Criar convite via admin_create_invitation_with_activation_code (6 args)
  // Simular sessão do admin definindo auth.uid()
  await client.query(`SET request.jwt.claim.sub = '${adminId}';`);
  const createRes = await client.query(`
    SELECT public.admin_create_invitation_with_activation_code(
      'Colaborador Teste Cloud',
      'colab.cloud@test.local',
      '(11) 97777-6666',
      'rh',
      '{"usuarios": {"ver": true}}'::jsonb,
      NOW() + INTERVAL '7 days'
    ) AS res;
  `);
  const inviteData = createRes.rows[0].res;
  console.log('T2: Convite criado:', {
    success: inviteData.success,
    token: inviteData.token ? `${inviteData.token.slice(0, 10)}...` : null,
    code: inviteData.code,
    messageContainsTenantName: inviteData.invitation_message.includes('Empresa Alpha Transportes Cloud LTDA'),
  });

  if (!inviteData.invitation_message.includes('Empresa Alpha Transportes Cloud LTDA')) {
    throw new Error('Falha: A mensagem do convite não incluiu a Razão Social tenants.name');
  }

  // T3: Validar token via validate_invitation_token
  const validateRes = await client.query(`
    SELECT * FROM public.validate_invitation_token('${inviteData.token}');
  `);
  const validatedRow = validateRes.rows[0];
  console.log('T3: validate_invitation_token retorno:', {
    tenant_name: validatedRow.tenant_name,
    email: validatedRow.email,
    role: validatedRow.role,
    status: validatedRow.status,
  });

  if (validatedRow.tenant_name !== 'Empresa Alpha Transportes Cloud LTDA') {
    throw new Error(`Falha: tenant_name esperado 'Empresa Alpha Transportes Cloud LTDA', obtido '${validatedRow.tenant_name}'`);
  }

  // T4: Verificação de Código Incorreto (Decrementar tentativas) - usando secret automático do backend
  const verifyFailRes = await client.query(`
    SELECT public.sec03_verify_invitation_activation_code(
      '${inviteData.token}',
      '000000'
    ) AS res;
  `);
  console.log('T4: Tentativa com código incorreto:', verifyFailRes.rows[0].res);
  if (verifyFailRes.rows[0].res.success !== false || verifyFailRes.rows[0].res.remaining_attempts !== 4) {
    throw new Error('Falha na contagem decrescente de tentativas');
  }

  // T5: Verificação de Código Correto (Emitir verification_proof) - sem secret exposto
  const verifyPassRes = await client.query(`
    SELECT public.sec03_verify_invitation_activation_code(
      '${inviteData.token}',
      '${inviteData.code}'
    ) AS res;
  `);
  const verifySuccessData = verifyPassRes.rows[0].res;
  console.log('T5: Validação do OTP correto:', {
    success: verifySuccessData.success,
    verified: verifySuccessData.verified,
    proofLength: verifySuccessData.verification_proof ? verifySuccessData.verification_proof.length : 0,
  });

  if (!verifySuccessData.verification_proof || verifySuccessData.verification_proof.length !== 64) {
    throw new Error('Falha ao gerar o verification_proof de 32 bytes (64 hex)');
  }

  // T6a: Tentativa de Ativação com verification_proof NULA -> DEVE FALHAR
  const colabUserId = randomUUID();
  await client.query(`INSERT INTO auth.users (id, email) VALUES ('${colabUserId}', 'colab.cloud@test.local');`);
  
  let nullProofBlocked = false;
  try {
    await client.query(`
      SELECT public.accept_tenant_invitation(
        '${inviteData.token}',
        '${colabUserId}',
        NULL
      );
    `);
  } catch (err) {
    nullProofBlocked = err.message.includes('Prova de verificação de código obrigatória');
    console.log('T6a: Rejeição de Prova Nula:', err.message);
  }

  if (!nullProofBlocked) {
    throw new Error('FALHA DE SEGURANÇA: accept_tenant_invitation aceitou prova nula!');
  }

  // T6b: Tentativa de Ativação por Sessão Concorrente (com proof divergente) -> DEVE FALHAR
  let sessionHijackBlocked = false;
  try {
    await client.query(`
      SELECT public.accept_tenant_invitation(
        '${inviteData.token}',
        '${colabUserId}',
        'proof_falso_de_atacante_123456789012345678901234567890123456789012'
      );
    `);
  } catch (err) {
    sessionHijackBlocked = err.message.includes('Prova de verificação de código inválida');
    console.log('T6: Rejeição de Prova Inválida (Session Proof Binding Negativo):', err.message);
  }

  if (!sessionHijackBlocked) {
    throw new Error('FALHA DE SEGURANÇA: accept_tenant_invitation aceitou sessão sem a prova legítima!');
  }

  // T7: Ativação Legítima com Proof Correto
  const acceptRes = await client.query(`
    SELECT public.accept_tenant_invitation(
      '${inviteData.token}',
      '${colabUserId}',
      '${verifySuccessData.verification_proof}'
    ) AS profile_id;
  `);
  const createdProfileId = acceptRes.rows[0].profile_id;
  console.log('T7: accept_tenant_invitation bem-sucedido. Profile ID:', createdProfileId);

  // T8: Conferência de integridade em profiles e user_permissions
  const profileRow = (await client.query(`SELECT * FROM public.profiles WHERE id = '${createdProfileId}';`)).rows[0];
  const permRow = (await client.query(`SELECT * FROM public.user_permissions WHERE user_id = '${colabUserId}';`)).rows[0];
  
  console.log('T8: Verificação de tabelas pós-ativação:', {
    profileRole: profileRow.role,
    profileTenant: profileRow.tenant_id,
    permPhone: permRow.phone,
    permStatus: permRow.status,
  });

  if (profileRow.role !== 'rh' || profileRow.tenant_id !== tenantId || permRow.phone !== '(11) 97777-6666') {
    throw new Error('Inconsistência nos dados gravados pós-ativação!');
  }

  // T9: Reutilização do Convite Consumido -> DEVE FALHAR
  let reuseBlocked = false;
  try {
    await client.query(`
      SELECT public.accept_tenant_invitation(
        '${inviteData.token}',
        '${colabUserId}',
        '${verifySuccessData.verification_proof}'
      );
    `);
  } catch (err) {
    reuseBlocked = err.message.includes('Convite inválido, bloqueado ou expirado');
    console.log('T9: Bloqueio de Reutilização de Convite Consumido:', err.message);
  }

  if (!reuseBlocked) {
    throw new Error('FALHA DE SEGURANÇA: Convite já aceito foi reutilizado!');
  }

  console.log('\n--- 7. Teste de Idempotência: Reexecutando a migration consolidada ---');
  await client.query(migrationSql);
  console.log('✅ Reexecução da migration concluída com SUCESSO (100% IDEMPOTENTE)!');

  console.log('\n===============================================================');
  console.log('       TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!          ');
  console.log(' A MIGRATION CONSOLIDADA É 100% COMPATÍVEL COM O SCHEMA CLOUD. ');
  console.log('===============================================================\n');

  await client.end();
}

main().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
