import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

async function runTest05EncarregadoAccessControl() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });

  await client.connect();

  const results = [];

  try {
    // Inicia transação atômica
    await client.query('BEGIN;');

    // 1. Criar dois Tenants sintéticos
    const tenantA = uuidv4();
    const tenantB = uuidv4();

    await client.query(`
      INSERT INTO public.tenants (id, nome)
      VALUES 
        ('${tenantA}', 'Tenant A Teste Encarregado'),
        ('${tenantB}', 'Tenant B Teste Encarregado');
    `);

    // 2. Criar identidades sintéticas
    const userAdminA = uuidv4();
    const userEncA = uuidv4();
    const userColabA = uuidv4();
    const userAdminB = uuidv4();
    const userColabB = uuidv4();

    await client.query(`
      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${userAdminA}', 'admin_a@test.local', 'authenticated', 'authenticated'),
        ('${userEncA}', 'enc_a@test.local', 'authenticated', 'authenticated'),
        ('${userColabA}', 'colab_a@test.local', 'authenticated', 'authenticated'),
        ('${userAdminB}', 'admin_b@test.local', 'authenticated', 'authenticated'),
        ('${userColabB}', 'colab_b@test.local', 'authenticated', 'authenticated');
    `);

    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
      VALUES 
        ('${userAdminA}', '${tenantA}', 'Admin Tenant A', 'admin'),
        ('${userEncA}', '${tenantA}', 'Encarregado Operacional A', 'encarregado'),
        ('${userColabA}', '${tenantA}', 'Colaborador A', 'user'),
        ('${userAdminB}', '${tenantB}', 'Admin Tenant B', 'admin'),
        ('${userColabB}', '${tenantB}', 'Colaborador B', 'user');
    `);

    // Inserir convite sintético em Tenant A
    const inviteId = uuidv4();
    await client.query(`
      INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
      VALUES ('${inviteId}', '${tenantA}', 'invite_enc_test@orbe.com', 'user', 'token-enc-test', 'pendente', NOW() + INTERVAL '7 days');
    `);

    // Helpers para alternar contexto
    const setSessionEncarregado = async () => {
      await client.query(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${userEncA}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
      `);
    };

    const resetSession = async () => {
      await client.query(`RESET ROLE;`);
    };

    // --------------------------------------------------------------------------
    // Test 3: RPCs administrativas rejeitam identidade Encarregado
    // --------------------------------------------------------------------------
    // 3.1: admin_list_user_access_overview
    await client.query('SAVEPOINT sp_v3_list;');
    await setSessionEncarregado();
    let v3ListError = null;
    try {
      await client.query('SELECT * FROM public.admin_list_user_access_overview();');
    } catch (e) {
      v3ListError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v3_list;');

    // 3.2: admin_update_user_access
    await client.query('SAVEPOINT sp_v3_upd;');
    await setSessionEncarregado();
    let v3UpdError = null;
    try {
      await client.query(`
        SELECT * FROM public.admin_update_user_access(
          '${userColabA}'::uuid,
          'admin',
          'ativo',
          '{}'::jsonb
        );
      `);
    } catch (e) {
      v3UpdError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v3_upd;');

    // 3.3: admin_delete_tenant_invitation
    await client.query('SAVEPOINT sp_v3_del;');
    await setSessionEncarregado();
    let v3DelError = null;
    try {
      await client.query(`SELECT public.admin_delete_tenant_invitation('${inviteId}');`);
    } catch (e) {
      v3DelError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v3_del;');
    await resetSession();

    const rpcDenied = (v3ListError?.code === 'P0001' && v3UpdError?.code === 'P0001' && v3DelError?.code === 'P0001');
    results.push({
      item: '3. Negação das RPCs administrativas (admin_list_user_access_overview, admin_update_user_access, admin_delete_tenant_invitation)',
      esperado: 'Exceção P0001: Acesso restrito ao administrador da conta em todas as 3 RPCs',
      obtido: `admin_list: "${v3ListError?.message}" (SQLSTATE ${v3ListError?.code}) | admin_update: "${v3UpdError?.message}" (SQLSTATE ${v3UpdError?.code}) | admin_delete: "${v3DelError?.message}" (SQLSTATE ${v3DelError?.code})`,
      status: rpcDenied ? 'PASS' : 'FAIL',
      tipo: 'teste de banco',
      evidencia: 'admin_require_tenant_admin() exige estritamente role = "admin", bloqueando o perfil encarregado no backend.',
      sqlstate: 'P0001',
    });

    // --------------------------------------------------------------------------
    // Test 4: Bloqueio de alteração direta de role e tenant_id
    // --------------------------------------------------------------------------
    await client.query('SAVEPOINT sp_v4_role;');
    await setSessionEncarregado();
    let v4RoleError = null;
    try {
      await client.query(`
        UPDATE public.profiles SET role = 'admin' WHERE user_id = '${userEncA}';
      `);
    } catch (e) {
      v4RoleError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v4_role;');

    await client.query('SAVEPOINT sp_v4_tenant;');
    await setSessionEncarregado();
    let v4TenantError = null;
    try {
      await client.query(`
        UPDATE public.profiles SET tenant_id = '${tenantB}' WHERE user_id = '${userEncA}';
      `);
    } catch (e) {
      v4TenantError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v4_tenant;');
    await resetSession();

    const updateDenied = (v4RoleError?.code === '42501' && v4TenantError?.code === '42501');
    results.push({
      item: '4. Bloqueio de alteração direta de profiles.role e profiles.tenant_id',
      esperado: 'Rejeição nativa com permission denied (42501) para role e tenant_id',
      obtido: `Role: "${v4RoleError?.message}" (SQLSTATE ${v4RoleError?.code}) | Tenant_id: "${v4TenantError?.message}" (SQLSTATE ${v4TenantError?.code})`,
      status: updateDenied ? 'PASS' : 'FAIL',
      tipo: 'teste de banco',
      evidencia: 'SEC-02 revogou UPDATE na tabela profiles e concedeu apenas (full_name, avatar_url, updated_at). Acesso direto a role e tenant_id é negado.',
      sqlstate: '42501',
    });

    // --------------------------------------------------------------------------
    // Test 5: Isolamento multitenant e isolamento de perfil para encarregado
    // --------------------------------------------------------------------------
    await client.query('SAVEPOINT sp_v5_select;');
    await setSessionEncarregado();
    const selProfiles = await client.query('SELECT id, user_id, tenant_id, full_name, role FROM public.profiles;');
    await client.query('ROLLBACK TO SAVEPOINT sp_v5_select;');
    await resetSession();

    const crossTenantProfiles = selProfiles.rows.filter(r => r.tenant_id === tenantB);
    const otherTenantAProfiles = selProfiles.rows.filter(r => r.tenant_id === tenantA && r.user_id !== userEncA);
    const ownProfile = selProfiles.rows.filter(r => r.user_id === userEncA);

    const isolationOk = crossTenantProfiles.length === 0 && otherTenantAProfiles.length === 0 && ownProfile.length === 1;

    results.push({
      item: '5. Isolamento de perfis: bloqueio de cross-tenant e visibilidade restrita ao próprio perfil',
      esperado: 'Zero perfis de outro tenant visíveis; no tenant local, apenas o próprio perfil (1 registro)',
      obtido: `Perfis de outros tenants: ${crossTenantProfiles.length} | Outros perfis do mesmo tenant: ${otherTenantAProfiles.length} | Próprio perfil retornado: ${ownProfile.length}`,
      status: isolationOk ? 'PASS' : 'FAIL',
      tipo: 'teste de banco',
      evidencia: 'can_view_tenant_profiles() retorna FALSE para encarregado (role NOT IN admin, rh, financeiro), restringindo a RLS estritamente a auth.uid() = user_id e tenant_id = current_tenant_id().',
      sqlstate: '00000 (Isolamento RLS estrito)',
    });

    // --------------------------------------------------------------------------
    // Test 8: Comprovação de efetividade exclusiva no backend (sem React)
    // --------------------------------------------------------------------------
    // Testando can_view_tenant_profiles() diretamente no banco
    await client.query('SAVEPOINT sp_v8_fn;');
    await setSessionEncarregado();
    const canViewRes = await client.query('SELECT public.can_view_tenant_profiles() as can_view;');
    await client.query('ROLLBACK TO SAVEPOINT sp_v8_fn;');
    await resetSession();

    const canView = canViewRes.rows[0]?.can_view;
    results.push({
      item: '8. Proteções efetivas no backend (banco de dados, RLS e RPCs)',
      esperado: 'can_view_tenant_profiles() = false no catálogo PostgreSQL e RLS aplicada no motor de banco',
      obtido: `can_view_tenant_profiles() retornou ${canView} diretamente via SQL sob a identidade authenticated do encarregado.`,
      status: canView === false ? 'PASS' : 'FAIL',
      tipo: 'teste de banco',
      evidencia: 'Políticas RLS e SECURITY DEFINER executadas nativamente pelo PostgreSQL 17 sem nenhuma dependência de guards de frontend.',
      sqlstate: '00000 (Backend Security Enforced)',
    });

    // Encerra com ROLLBACK estrito
    await client.query('ROLLBACK;');
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTest05EncarregadoAccessControl();
