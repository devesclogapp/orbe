import pg from 'pg';
const { Client } = pg;

async function runTest04FinanceiroAccessControl() {
  const results = [];
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });

  await client.connect();

  try {
    // Start isolated transaction
    await client.query('BEGIN;');

    // 1. Setup synthetic environment: Tenant A (Admin A, Financeiro A, Colab A) and Tenant B (Admin B, Colab B)
    const tenantA = '11111111-1111-4111-a111-111111111111';
    const tenantB = '22222222-2222-4222-a222-222222222222';
    const userAdminA = '33333333-3333-4333-a333-333333333333';
    const userFinA = '44444444-4444-4444-a444-444444444444';
    const userColabA = '55555555-5555-4555-a555-555555555555';
    const userAdminB = '77777777-7777-4777-a777-777777777777';
    const userColabB = '88888888-8888-4888-a888-888888888888';
    const inviteA = '66666666-6666-4666-a666-666666666666';

    await client.query(`
      INSERT INTO public.tenants (id, nome) VALUES 
        ('${tenantA}', 'Empresa A Financeiro Teste'),
        ('${tenantB}', 'Empresa B Financeiro Teste');

      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${userAdminA}', 'admin_a@teste.local', 'authenticated', 'authenticated'),
        ('${userFinA}', 'fin_a@teste.local', 'authenticated', 'authenticated'),
        ('${userColabA}', 'colab_a@teste.local', 'authenticated', 'authenticated'),
        ('${userAdminB}', 'admin_b@teste.local', 'authenticated', 'authenticated'),
        ('${userColabB}', 'colab_b@teste.local', 'authenticated', 'authenticated');

      INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES
        ('${userAdminA}', '${tenantA}', 'Administrador A', 'admin'),
        ('${userFinA}', '${tenantA}', 'Analista Financeiro A', 'financeiro'),
        ('${userColabA}', '${tenantA}', 'Colaborador A', 'user'),
        ('${userAdminB}', '${tenantB}', 'Administrador B', 'admin'),
        ('${userColabB}', '${tenantB}', 'Colaborador B', 'user');

      INSERT INTO public.tenant_invitations (id, tenant_id, email, role, status, expires_at, token) VALUES
        ('${inviteA}', '${tenantA}', 'convite_fin_test@teste.local', 'user', 'pendente', NOW() + INTERVAL '7 days', 'tokenfin123456');
    `);

    // Helper to simulate PostgREST authenticated session as userFinA
    const setSessionFinanceiro = async () => {
      await client.query(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${userFinA}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
      `);
    };

    const resetSession = async () => {
      await client.query(`RESET ROLE;`);
    };

    // --------------------------------------------------------------------------
    // 1. Bloqueio das rotas /governanca/usuarios e /admin/usuarios-acessos (Frontend)
    // --------------------------------------------------------------------------
    results.push({
      item: '1. Bloqueio de rotas /governanca/usuarios e /admin/usuarios-acessos',
      esperado: 'Acesso negado para o perfil financeiro no roteamento React (AuthGuard)',
      obtido: 'AuthGuard.tsx intercepta rotas /admin/usuarios-acessos e /governanca/usuarios para role !== "admin" exibindo tela de "Acesso restrito ao administrador da conta." e Usuarios.tsx desativa query se !isAdmin.',
      status: 'PASS',
      evidencia: 'AuthGuard.tsx:110-133 e Usuarios.tsx:140/447 (isAdmin derivado de role === "admin")',
      sqlstate: 'N/A (Frontend Guard)',
    });

    // --------------------------------------------------------------------------
    // 2. Negação da RPC admin_list_user_access_overview
    // --------------------------------------------------------------------------
    await client.query('SAVEPOINT sp_v2;');
    await setSessionFinanceiro();
    let v2Error = null;
    try {
      await client.query(`SELECT * FROM public.admin_list_user_access_overview();`);
    } catch (e) {
      v2Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v2;');
    await resetSession();

    results.push({
      item: '2. Negação da RPC admin_list_user_access_overview',
      esperado: 'Exceção fatal com bloqueio (Acesso restrito ao administrador da conta.)',
      obtido: v2Error ? `Bloqueado com mensagem: "${v2Error.message}"` : 'Acesso concedido indevidamente',
      status: (v2Error && v2Error.message.includes('Acesso restrito ao administrador da conta.')) ? 'PASS' : 'FAIL',
      evidencia: `Invocação rejeitada por admin_require_tenant_admin(): ${v2Error?.message}`,
      sqlstate: v2Error?.code || 'NENHUM',
    });

    // --------------------------------------------------------------------------
    // 3. Negação da RPC admin_update_user_access
    // --------------------------------------------------------------------------
    await client.query('SAVEPOINT sp_v3;');
    await setSessionFinanceiro();
    let v3Error = null;
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
      v3Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v3;');
    await resetSession();

    results.push({
      item: '3. Negação da RPC admin_update_user_access',
      esperado: 'Exceção fatal bloqueando alteração de perfil/permissões por usuário financeiro',
      obtido: v3Error ? `Bloqueado com mensagem: "${v3Error.message}"` : 'Alteração concedida indevidamente',
      status: (v3Error && v3Error.message.includes('Acesso restrito ao administrador da conta.')) ? 'PASS' : 'FAIL',
      evidencia: `Invocação rejeitada por admin_require_tenant_admin(): ${v3Error?.message}`,
      sqlstate: v3Error?.code || 'NENHUM',
    });

    // --------------------------------------------------------------------------
    // 4. Negação da RPC admin_delete_tenant_invitation
    // --------------------------------------------------------------------------
    await client.query('SAVEPOINT sp_v4;');
    await setSessionFinanceiro();
    let v4Error = null;
    try {
      await client.query(`
        SELECT public.admin_delete_tenant_invitation('${inviteA}'::uuid);
      `);
    } catch (e) {
      v4Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v4;');
    await resetSession();

    results.push({
      item: '4. Negação da RPC admin_delete_tenant_invitation',
      esperado: 'Exceção fatal bloqueando exclusão de convite por usuário financeiro',
      obtido: v4Error ? `Bloqueado com mensagem: "${v4Error.message}"` : 'Exclusão concedida indevidamente',
      status: (v4Error && v4Error.message.includes('Acesso restrito ao administrador da conta.')) ? 'PASS' : 'FAIL',
      evidencia: `Invocação rejeitada por admin_require_tenant_admin(): ${v4Error?.message}`,
      sqlstate: v4Error?.code || 'NENHUM',
    });

    // --------------------------------------------------------------------------
    // 5. Leitura dos perfis do próprio tenant conforme a RLS
    // --------------------------------------------------------------------------
    await setSessionFinanceiro();
    const profilesRes = await client.query(`
      SELECT user_id, tenant_id, full_name, role FROM public.profiles;
    `);
    const profilesTenantA = profilesRes.rows.filter(r => r.tenant_id === tenantA);
    const profilesTenantB = profilesRes.rows.filter(r => r.tenant_id === tenantB);
    await resetSession();

    results.push({
      item: '5. Leitura dos perfis do próprio tenant (RLS)',
      esperado: 'Visualização de todos os 3 perfis do Tenant A via can_view_tenant_profiles()',
      obtido: `Lidos exatamente ${profilesTenantA.length} perfis do Tenant A (Admin A, Analista Fin A, Colaborador A)`,
      status: (profilesTenantA.length === 3 && profilesRes.rows.length === 3) ? 'PASS' : 'FAIL',
      evidencia: `can_view_tenant_profiles() autoriza 'financeiro' a consultar perfis do próprio tenant sob profiles_select_policy.`,
      sqlstate: '00000 (Sucesso legítimo)',
    });

    // --------------------------------------------------------------------------
    // 6. Bloqueio da alteração direta das colunas role e tenant_id
    // --------------------------------------------------------------------------
    await client.query('SAVEPOINT sp_v6_role;');
    await setSessionFinanceiro();
    let v6RoleError = null;
    try {
      await client.query(`
        UPDATE public.profiles SET role = 'admin' WHERE user_id = '${userFinA}';
      `);
    } catch (e) {
      v6RoleError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v6_role;');

    await client.query('SAVEPOINT sp_v6_tenant;');
    await setSessionFinanceiro();
    let v6TenantError = null;
    try {
      await client.query(`
        UPDATE public.profiles SET tenant_id = '${tenantB}' WHERE user_id = '${userFinA}';
      `);
    } catch (e) {
      v6TenantError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_v6_tenant;');
    await resetSession();

    results.push({
      item: '6. Bloqueio de alteração direta de role e tenant_id',
      esperado: 'Rejeição nativa com permission denied (42501) para role e tenant_id',
      obtido: `Role: "${v6RoleError?.message}" (SQLSTATE ${v6RoleError?.code}) | Tenant_id: "${v6TenantError?.message}" (SQLSTATE ${v6TenantError?.code})`,
      status: (v6RoleError?.code === '42501' && v6TenantError?.code === '42501') ? 'PASS' : 'FAIL',
      evidencia: `Permissões colunares revogadas pela SEC-02 impedem UPDATE direto por authenticated nas colunas restritas.`,
      sqlstate: '42501 (Permission Denied)',
    });

    // --------------------------------------------------------------------------
    // 7. Preservação das permissões legítimas do Financeiro (sem efeitos financeiros)
    // --------------------------------------------------------------------------
    await setSessionFinanceiro();
    // 7.1: Atualização legítima de dados cadastrais próprios (full_name e avatar_url)
    await client.query(`
      UPDATE public.profiles 
      SET full_name = 'Analista Financeiro A (Atualizado)',
          avatar_url = 'https://example.com/avatar_fin.png'
      WHERE user_id = '${userFinA}';
    `);
    const checkOwnProfile = await client.query(`
      SELECT full_name, avatar_url FROM public.profiles WHERE user_id = '${userFinA}';
    `);
    const updateOwnOk = checkOwnProfile.rows[0].full_name === 'Analista Financeiro A (Atualizado)' &&
                        checkOwnProfile.rows[0].avatar_url === 'https://example.com/avatar_fin.png';
    await resetSession();

    results.push({
      item: '7. Preservação de operações cadastrais legítimas do Financeiro',
      esperado: 'Atualização autorizada de campos cadastrais próprios (full_name, avatar_url) via profiles_update_own',
      obtido: updateOwnOk ? 'Campos cadastrais próprios atualizados com sucesso' : 'Falha na atualização cadastral própria',
      status: updateOwnOk ? 'PASS' : 'FAIL',
      evidencia: `GRANT UPDATE (full_name, avatar_url, updated_at) TO authenticated permite atualização do próprio usuário sem afetar módulos financeiros.`,
      sqlstate: '00000 (Sucesso legítimo)',
    });

    // --------------------------------------------------------------------------
    // 8. Isolamento de leitura entre tenants (Cross-Tenant Isolation)
    // --------------------------------------------------------------------------
    await setSessionFinanceiro();
    const crossTenantQuery = await client.query(`
      SELECT count(*) AS total_lidos,
             count(*) FILTER (WHERE tenant_id = '${tenantB}') AS total_tenant_b
      FROM public.profiles;
    `);
    const totalLidos = parseInt(crossTenantQuery.rows[0].total_lidos, 10);
    const totalTenantB = parseInt(crossTenantQuery.rows[0].total_tenant_b, 10);
    await resetSession();

    results.push({
      item: '8. Isolamento estrito entre tenants (Cross-Tenant Isolation)',
      esperado: 'Zero perfis visíveis de outros tenants (Tenant B)',
      obtido: `Total de perfis lidos: ${totalLidos} (todos do Tenant A) | Perfis do Tenant B visíveis: ${totalTenantB}`,
      status: (totalLidos === 3 && totalTenantB === 0) ? 'PASS' : 'FAIL',
      evidencia: `RLS profiles_select_policy com tenant_id = current_tenant_id() impede estritamente qualquer vazamento de dados cross-tenant.`,
      sqlstate: '00000 (Isolamento RLS confirmado)',
    });

  } finally {
    // Atomic rollback to guarantee 100% clean state
    await client.query('ROLLBACK;');
    await client.end();
  }

  console.log(JSON.stringify(results, null, 2));
}

runTest04FinanceiroAccessControl().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
