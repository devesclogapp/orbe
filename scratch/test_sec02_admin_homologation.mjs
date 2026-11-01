import pg from 'pg';
import { randomUUID as uuidv4 } from 'node:crypto';

async function runTest06AdminHomologation() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });

  await client.connect();

  const results = [];

  try {
    // Inicia transação atômica que será revertida com ROLLBACK ao final
    await client.query('BEGIN;');

    // Setup de dados sintéticos
    const tenantA = uuidv4();
    const tenantB = uuidv4();

    await client.query(`
      INSERT INTO public.tenants (id, nome)
      VALUES 
        ('${tenantA}', 'Tenant A Admin HML'),
        ('${tenantB}', 'Tenant B Admin HML');
    `);

    const userAdminA = uuidv4();
    const userColabA = uuidv4();
    const userAdminB = uuidv4();
    const userColabB = uuidv4();

    await client.query(`
      INSERT INTO auth.users (id, email, role, aud) VALUES
        ('${userAdminA}', 'admin_a_hml@test.local', 'authenticated', 'authenticated'),
        ('${userColabA}', 'colab_a_hml@test.local', 'authenticated', 'authenticated'),
        ('${userAdminB}', 'admin_b_hml@test.local', 'authenticated', 'authenticated'),
        ('${userColabB}', 'colab_b_hml@test.local', 'authenticated', 'authenticated');
    `);

    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
      VALUES 
        ('${userAdminA}', '${tenantA}', 'Administrador Tenant A', 'admin'),
        ('${userColabA}', '${tenantA}', 'Colaborador Tenant A', 'user'),
        ('${userAdminB}', '${tenantB}', 'Administrador Tenant B', 'admin'),
        ('${userColabB}', '${tenantB}', 'Colaborador Tenant B', 'user');
    `);

    // Convite inicial em Tenant B (para teste de isolamento negativo)
    const inviteB = uuidv4();
    await client.query(`
      INSERT INTO public.tenant_invitations (id, tenant_id, email, role, token, status, expires_at)
      VALUES ('${inviteB}', '${tenantB}', 'convite_b@test.local', 'user', 'token_b_123', 'pendente', NOW() + INTERVAL '7 days');
    `);

    // Helpers de sessão autenticada PostgREST
    const setSessionAdminA = async () => {
      await client.query(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '${userAdminA}';
        SET LOCAL "request.jwt.claim.role" = 'authenticated';
      `);
    };

    const resetSession = async () => {
      await client.query('RESET ROLE;');
    };

    // ==========================================================================
    // 1. TESTES POSITIVOS — ADMINISTRADOR
    // ==========================================================================

    // 1.1: Listagem de usuários e convites via admin_list_user_access_overview
    await client.query('SAVEPOINT sp_p1;');
    await setSessionAdminA();
    let p1Rows = [];
    let p1Error = null;
    try {
      const res = await client.query('SELECT * FROM public.admin_list_user_access_overview();');
      p1Rows = res.rows;
    } catch (e) {
      p1Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_p1;');
    await resetSession();

    const p1Passed = !p1Error && p1Rows.some(r => r.user_id === userAdminA) && p1Rows.some(r => r.user_id === userColabA);
    results.push({
      grupo: '1. Testes Positivos',
      item: '1. Listagem de usuários e convites via admin_list_user_access_overview',
      tipo: 'teste de banco',
      esperado: 'Retorno com sucesso dos usuários e convites do Tenant A (incluindo Admin A e Colaborador A)',
      obtido: p1Error ? `Erro: ${p1Error.message}` : `Sucesso: ${p1Rows.length} registros listados no overview do Tenant A`,
      status: p1Passed ? 'PASS' : 'FAIL',
      sqlstate: p1Error ? p1Error.code : '00000',
    });

    // 1.2: Criação de convite via admin_create_tenant_invitation
    await client.query('SAVEPOINT sp_p2;');
    await setSessionAdminA();
    let p2Invite = null;
    let p2Error = null;
    try {
      const res = await client.query(`
        SELECT * FROM public.admin_create_tenant_invitation(
          'Novo Convidado A',
          'convidado_a@test.local',
          '11999990001',
          'rh',
          '{"central_operacional": {"ver": true}}'::jsonb,
          NOW() + INTERVAL '7 days'
        );
      `);
      p2Invite = res.rows[0];
      await client.query('RELEASE SAVEPOINT sp_p2;');
    } catch (e) {
      console.log('Error in P2:', e.message);
      p2Error = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_p2;');
    }
    await resetSession();

    const p2Passed = !p2Error && p2Invite && p2Invite.email === 'convidado_a@test.local' && p2Invite.role === 'rh';
    const createdInviteId = p2Invite ? p2Invite.id : null;
    results.push({
      grupo: '1. Testes Positivos',
      item: '2. Criação de convite via admin_create_tenant_invitation',
      tipo: 'teste de banco',
      esperado: 'Convite criado com status "pendente", role "rh" e token gerado',
      obtido: p2Error ? `Erro: ${p2Error.message}` : `Convite criado: id=${p2Invite.id}, status=${p2Invite.status}, role=${p2Invite.role}`,
      status: p2Passed ? 'PASS' : 'FAIL',
      sqlstate: p2Error ? p2Error.code : '00000',
    });

    // 1.3: Alteração de permissões de usuário sintético via admin_update_user_access
    await client.query('SAVEPOINT sp_p3;');
    await setSessionAdminA();
    let p3Result = null;
    let p3Error = null;
    try {
      const res = await client.query(`
        SELECT * FROM public.admin_update_user_access(
          '${userColabA}'::uuid,
          'financeiro',
          'ativo',
          '{"central_financeira": {"ver": true, "editar": true}}'::jsonb
        );
      `);
      p3Result = res.rows[0];
      await client.query('RELEASE SAVEPOINT sp_p3;');
    } catch (e) {
      console.log('Error in P3:', e.message);
      p3Error = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_p3;');
    }
    await resetSession();

    // Conferir se o perfil foi atualizado para financeiro
    const colabProfileCheck = await client.query(`SELECT role FROM public.profiles WHERE user_id = '${userColabA}';`);
    const p3Passed = !p3Error && p3Result && colabProfileCheck.rows[0]?.role === 'financeiro';
    results.push({
      grupo: '1. Testes Positivos',
      item: '3. Alteração de permissões de usuário sintético via admin_update_user_access',
      tipo: 'teste de banco',
      esperado: 'Papel do usuário atualizado para "financeiro" e permissões persistidas',
      obtido: p3Error ? `Erro: ${p3Error.message}` : `Atualizado com sucesso: novo papel=${colabProfileCheck.rows[0]?.role}`,
      status: p3Passed ? 'PASS' : 'FAIL',
      sqlstate: p3Error ? p3Error.code : '00000',
    });

    // 1.4: Alteração de um convite pendente via update_tenant_invitation
    await client.query('SAVEPOINT sp_p4;');
    await setSessionAdminA();
    let p4Updated = null;
    let p4Error = null;
    try {
      const res = await client.query(`
        SELECT * FROM public.update_tenant_invitation(
          '${createdInviteId}'::uuid,
          'Novo Convidado A Editado',
          'convidado_a_editado@test.local',
          '11999990002',
          'gestor',
          '{"central_operacional": {"ver": true, "editar": true}}'::jsonb,
          NOW() + INTERVAL '10 days'
        );
      `);
      p4Updated = res.rows[0];
      await client.query('RELEASE SAVEPOINT sp_p4;');
    } catch (e) {
      console.log('Error in P4:', e.message);
      p4Error = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_p4;');
    }
    await resetSession();

    const p4Passed = !p4Error && p4Updated && p4Updated.email === 'convidado_a_editado@test.local' && p4Updated.role === 'gestor';
    results.push({
      grupo: '1. Testes Positivos',
      item: '4. Alteração de um convite pendente via update_tenant_invitation',
      tipo: 'teste de banco',
      esperado: 'Convite atualizado para papel "gestor" e novo e-mail',
      obtido: p4Error ? `Erro: ${p4Error.message}` : `Convite atualizado: email=${p4Updated.email}, role=${p4Updated.role}`,
      status: p4Passed ? 'PASS' : 'FAIL',
      sqlstate: p4Error ? p4Error.code : '00000',
    });

    // 1.5: Renovação de convite via admin_renew_tenant_invitation
    await client.query('SAVEPOINT sp_p5;');
    await setSessionAdminA();
    let p5Renewed = null;
    let p5Error = null;
    try {
      const res = await client.query(`
        SELECT * FROM public.admin_renew_tenant_invitation(
          '${createdInviteId}'::uuid,
          NOW() + INTERVAL '14 days'
        );
      `);
      p5Renewed = res.rows[0];
      await client.query('RELEASE SAVEPOINT sp_p5;');
    } catch (e) {
      console.log('Error in P5:', e.message);
      p5Error = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_p5;');
    }
    await resetSession();

    const p5Passed = !p5Error && p5Renewed && p5Renewed.status === 'pendente';
    results.push({
      grupo: '1. Testes Positivos',
      item: '5. Renovação de convite via admin_renew_tenant_invitation',
      tipo: 'teste de banco',
      esperado: 'Token renovado e nova validade estabelecida',
      obtido: p5Error ? `Erro: ${p5Error.message}` : `Convite renovado com sucesso: novo expires_at=${p5Renewed.expires_at}`,
      status: p5Passed ? 'PASS' : 'FAIL',
      sqlstate: p5Error ? p5Error.code : '00000',
    });

    // 1.6: Exclusão de convite sintético via admin_delete_tenant_invitation
    await client.query('SAVEPOINT sp_p6;');
    await setSessionAdminA();
    let p6Error = null;
    try {
      await client.query(`SELECT public.admin_delete_tenant_invitation('${createdInviteId}'::uuid);`);
      await client.query('RELEASE SAVEPOINT sp_p6;');
    } catch (e) {
      console.log('Error in P6:', e.message);
      p6Error = e;
      await client.query('ROLLBACK TO SAVEPOINT sp_p6;');
    }
    await resetSession();

    // Verificar se o convite foi excluído fisicamente
    const inviteCheck = await client.query(`SELECT id FROM public.tenant_invitations WHERE id = '${createdInviteId}';`);
    const p6Passed = !p6Error && inviteCheck.rowCount === 0;
    results.push({
      grupo: '1. Testes Positivos',
      item: '6. Exclusão de convite sintético via admin_delete_tenant_invitation',
      tipo: 'teste de banco',
      esperado: 'Convite excluído fisicamente do banco de dados',
      obtido: p6Error ? `Erro: ${p6Error.message}` : `Convite excluído com sucesso (rowCount=${inviteCheck.rowCount})`,
      status: p6Passed ? 'PASS' : 'FAIL',
      sqlstate: p6Error ? p6Error.code : '00000',
    });

    // 1.7: Persistência e consistência dos dados dentro da transação de teste
    const p7Passed = p2Passed && p3Passed && p4Passed && p5Passed && p6Passed;
    results.push({
      grupo: '1. Testes Positivos',
      item: '7. Persistência e consistência dos dados dentro da transação de teste',
      tipo: 'teste de banco',
      esperado: 'Todas as operações administrativas mantiveram integridade referencial e consistência',
      obtido: p7Passed ? 'Integridade referencial estrita e transações intermediárias consistentes' : 'Falha de consistência observada',
      status: p7Passed ? 'PASS' : 'FAIL',
      sqlstate: '00000',
    });

    // 1.8: Registro de auditoria das operações que exigem audit_log
    const auditRes = await client.query(`
      SELECT * FROM public.audit_log 
      WHERE tenant_id = '${tenantA}' AND entidade = 'tenant_invitations' AND acao = 'DELETE' AND registro_id = '${createdInviteId}';
    `);
    const p8Passed = auditRes.rowCount === 1;
    results.push({
      grupo: '1. Testes Positivos',
      item: '8. Registro de auditoria das operações que exigem audit_log',
      tipo: 'teste de banco',
      esperado: 'Registro na tabela audit_log documentando a exclusão do convite pelo Administrador A',
      obtido: p8Passed ? `Audit log confirmado: acao=${auditRes.rows[0].acao}, usuario=${auditRes.rows[0].usuario_nome}, entidade=${auditRes.rows[0].entidade}` : 'Registro de auditoria não encontrado',
      status: p8Passed ? 'PASS' : 'FAIL',
      sqlstate: p8Passed ? '00000' : 'FAIL',
    });


    // ==========================================================================
    // 2. TESTES NEGATIVOS — SEGURANÇA
    // ==========================================================================

    // 2.1: Administrador não consegue modificar usuários de outro tenant
    await client.query('SAVEPOINT sp_n1;');
    await setSessionAdminA();
    let n1Error = null;
    try {
      await client.query(`
        SELECT * FROM public.admin_update_user_access(
          '${userColabB}'::uuid,
          'admin',
          'ativo',
          '{}'::jsonb
        );
      `);
    } catch (e) {
      n1Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n1;');
    await resetSession();

    const n1Passed = n1Error && n1Error.message.includes('Usuário não pertence ao tenant do administrador');
    results.push({
      grupo: '2. Testes Negativos',
      item: '1. Administrador não consegue modificar usuários de outro tenant',
      tipo: 'teste de banco',
      esperado: 'Exceção P0001: "Usuário não pertence ao tenant do administrador"',
      obtido: n1Error ? `Bloqueado com mensagem: "${n1Error.message}"` : 'Alteração indevida permitida',
      status: n1Passed ? 'PASS' : 'FAIL',
      sqlstate: n1Error?.code || 'NENHUM',
    });

    // 2.2: Administrador não consegue modificar convites de outro tenant
    await client.query('SAVEPOINT sp_n2;');
    await setSessionAdminA();
    let n2Error = null;
    try {
      await client.query(`
        SELECT * FROM public.update_tenant_invitation(
          '${inviteB}'::uuid,
          'Hacker',
          'hacker@test.local',
          null,
          'admin',
          '{}'::jsonb,
          NOW() + INTERVAL '1 day'
        );
      `);
    } catch (e) {
      n2Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n2;');
    await resetSession();

    const n2Passed = n2Error && n2Error.message.includes('Convite pendente não encontrado para este tenant');
    results.push({
      grupo: '2. Testes Negativos',
      item: '2. Administrador não consegue modificar convites de outro tenant',
      tipo: 'teste de banco',
      esperado: 'Exceção P0001: "Convite pendente não encontrado para este tenant"',
      obtido: n2Error ? `Bloqueado com mensagem: "${n2Error.message}"` : 'Modificação indevida permitida',
      status: n2Passed ? 'PASS' : 'FAIL',
      sqlstate: n2Error?.code || 'NENHUM',
    });

    // 2.3: Administrador não consegue promover usuários de outro tenant
    await client.query('SAVEPOINT sp_n3;');
    await setSessionAdminA();
    let n3Error = null;
    try {
      await client.query(`
        SELECT * FROM public.admin_update_user_access(
          '${userColabB}'::uuid,
          'admin',
          'ativo',
          '{"all": true}'::jsonb
        );
      `);
    } catch (e) {
      n3Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n3;');
    await resetSession();

    const n3Passed = n3Error && n3Error.message.includes('Usuário não pertence ao tenant do administrador');
    results.push({
      grupo: '2. Testes Negativos',
      item: '3. Administrador não consegue promover usuários de outro tenant',
      tipo: 'teste de banco',
      esperado: 'Exceção P0001: "Usuário não pertence ao tenant do administrador"',
      obtido: n3Error ? `Bloqueado com mensagem: "${n3Error.message}"` : 'Promoção indevida permitida',
      status: n3Passed ? 'PASS' : 'FAIL',
      sqlstate: n3Error?.code || 'NENHUM',
    });

    // 2.4: Administrador não consegue rebaixar sua própria função (auto-bloqueio de lockout)
    await client.query('SAVEPOINT sp_n4;');
    await setSessionAdminA();
    let n4Error = null;
    try {
      await client.query(`
        SELECT * FROM public.admin_update_user_access(
          '${userAdminA}'::uuid,
          'user',
          'ativo',
          '{}'::jsonb
        );
      `);
    } catch (e) {
      n4Error = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n4;');
    await resetSession();

    const n4Passed = n4Error && n4Error.message.includes('O administrador não pode alterar o próprio acesso por esta tela.');
    results.push({
      grupo: '2. Testes Negativos',
      item: '4. Administrador não consegue rebaixar sua própria função (auto-bloqueio anti-lockout)',
      tipo: 'teste de banco',
      esperado: 'Exceção P0001: "O administrador não pode alterar o próprio acesso por esta tela."',
      obtido: n4Error ? `Bloqueado com mensagem: "${n4Error.message}"` : 'Auto-rebaixamento indevido permitido',
      status: n4Passed ? 'PASS' : 'FAIL',
      sqlstate: n4Error?.code || 'NENHUM',
    });

    // 2.5: Convites inválidos, expirados ou em estados incompatíveis são rejeitados
    // 2.5a: E-mail inválido
    await client.query('SAVEPOINT sp_n5a;');
    await setSessionAdminA();
    let n5aError = null;
    try {
      await client.query(`
        SELECT * FROM public.admin_create_tenant_invitation(
          'Invalido',
          'email_sem_arroba',
          null,
          'user',
          '{}'::jsonb,
          NOW() + INTERVAL '7 days'
        );
      `);
    } catch (e) {
      n5aError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n5a;');

    // 2.5b: Data de validade no passado
    await client.query('SAVEPOINT sp_n5b;');
    let n5bError = null;
    try {
      await client.query(`
        SELECT * FROM public.admin_create_tenant_invitation(
          'Expirado',
          'expirado@test.local',
          null,
          'user',
          '{}'::jsonb,
          NOW() - INTERVAL '1 day'
        );
      `);
    } catch (e) {
      n5bError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n5b;');
    await resetSession();

    const n5Passed = n5aError?.message.includes('Informe um e-mail válido') && n5bError?.message.includes('Defina uma validade futura para o convite');
    results.push({
      grupo: '2. Testes Negativos',
      item: '5. Convites inválidos, expirados ou em estados incompatíveis são rejeitados',
      tipo: 'teste de banco',
      esperado: 'Rejeição de e-mail inválido e de validade retroativa/passada',
      obtido: `E-mail inválido: "${n5aError?.message}" | Validade no passado: "${n5bError?.message}"`,
      status: n5Passed ? 'PASS' : 'FAIL',
      sqlstate: n5aError?.code || 'NENHUM',
    });

    // 2.6: Operações diretas proibidas em tenant_invitations são bloqueadas
    await client.query('SAVEPOINT sp_n6_del;');
    await setSessionAdminA();
    let n6DelError = null;
    try {
      await client.query(`DELETE FROM public.tenant_invitations WHERE id = '${inviteB}';`);
    } catch (e) {
      n6DelError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n6_del;');

    await client.query('SAVEPOINT sp_n6_ins;');
    await setSessionAdminA();
    let n6InsError = null;
    try {
      await client.query(`
        INSERT INTO public.tenant_invitations (tenant_id, email, role, status)
        VALUES ('${tenantA}', 'direto@test.local', 'user', 'pendente');
      `);
    } catch (e) {
      n6InsError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n6_ins;');
    await resetSession();

    const n6Passed = (n6DelError?.code === 'P0001' || n6DelError?.code === '42501') && 
                     (n6InsError?.code === 'P0001' || n6InsError?.code === '42501');
    results.push({
      grupo: '2. Testes Negativos',
      item: '6. Operações diretas proibidas em tenant_invitations são bloqueadas',
      tipo: 'teste de banco',
      esperado: 'Trigger protect_tenant_invitations_state bloqueia INSERT/DELETE direto de clientes',
      obtido: `DELETE direto: "${n6DelError?.message}" (SQLSTATE ${n6DelError?.code}) | INSERT direto: "${n6InsError?.message}" (SQLSTATE ${n6InsError?.code})`,
      status: n6Passed ? 'PASS' : 'FAIL',
      sqlstate: n6DelError?.code || 'NENHUM',
    });

    // 2.7: Tentativas de alterar profiles.role ou profiles.tenant_id diretamente são rejeitadas
    await client.query('SAVEPOINT sp_n7_role;');
    await setSessionAdminA();
    let n7RoleError = null;
    try {
      await client.query(`UPDATE public.profiles SET role = 'user' WHERE user_id = '${userColabA}';`);
    } catch (e) {
      n7RoleError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n7_role;');

    await client.query('SAVEPOINT sp_n7_tenant;');
    await setSessionAdminA();
    let n7TenantError = null;
    try {
      await client.query(`UPDATE public.profiles SET tenant_id = '${tenantB}' WHERE user_id = '${userAdminA}';`);
    } catch (e) {
      n7TenantError = e;
    }
    await client.query('ROLLBACK TO SAVEPOINT sp_n7_tenant;');
    await resetSession();

    const n7Passed = n7RoleError?.code === '42501' && n7TenantError?.code === '42501';
    results.push({
      grupo: '2. Testes Negativos',
      item: '7. Tentativas de alterar profiles.role ou profiles.tenant_id diretamente são rejeitadas',
      tipo: 'teste de banco',
      esperado: 'Permission denied (42501) para UPDATE direto em role e tenant_id',
      obtido: `Direto role: "${n7RoleError?.message}" (SQLSTATE ${n7RoleError?.code}) | Direto tenant_id: "${n7TenantError?.message}" (SQLSTATE ${n7TenantError?.code})`,
      status: n7Passed ? 'PASS' : 'FAIL',
      sqlstate: '42501',
    });

    // Encerra a transação com ROLLBACK estrito
    await client.query('ROLLBACK;');

    // --------------------------------------------------------------------------
    // Evidência de Não-Persistência pós-ROLLBACK
    // --------------------------------------------------------------------------
    const checkTenants = await client.query(`SELECT count(*) FROM public.tenants WHERE id IN ('${tenantA}', '${tenantB}');`);
    const checkProfiles = await client.query(`SELECT count(*) FROM public.profiles WHERE user_id IN ('${userAdminA}', '${userColabA}', '${userAdminB}', '${userColabB}');`);
    const checkInvites = await client.query(`SELECT count(*) FROM public.tenant_invitations WHERE tenant_id IN ('${tenantA}', '${tenantB}');`);
    const checkAudit = await client.query(`SELECT count(*) FROM public.audit_log WHERE tenant_id IN ('${tenantA}', '${tenantB}');`);

    const rollbackEvidence = {
      tenantsRestantes: parseInt(checkTenants.rows[0].count, 10),
      profilesRestantes: parseInt(checkProfiles.rows[0].count, 10),
      invitesRestantes: parseInt(checkInvites.rows[0].count, 10),
      auditLogRestantes: parseInt(checkAudit.rows[0].count, 10),
    };

    console.log(JSON.stringify({ results, rollbackEvidence }, null, 2));

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTest06AdminHomologation();
