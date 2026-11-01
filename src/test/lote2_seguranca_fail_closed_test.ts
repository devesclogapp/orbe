import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface SecurityCheckResult {
  cenario: string;
  descricao: string;
  esperado: string;
  obtido: string;
  passou: boolean;
  detalhe?: string;
}

const PG_CONFIG = {
  host: '127.0.0.1',
  port: 54332,
  user: 'postgres',
  password: '',
  database: 'postgres',
};

async function runSecurityFailClosedValidation() {
  console.log('========================================================================');
  console.log('ORBE ERP — LOTE 2: AJUSTES FINAIS DE SEGURANÇA E ISOLAMENTO FAIL-CLOSED');
  console.log('========================================================================\n');

  const client = new Client(PG_CONFIG);
  await client.connect();
  console.log('Conectado ao PostgreSQL 17 isolado (54332).');

  const results: SecurityCheckResult[] = [];

  try {
    // 0. Configurar funções de auth simuladas compatíveis com o Supabase
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL,
        tenant_id UUID REFERENCES public.tenants(id),
        full_name TEXT,
        role TEXT DEFAULT 'user'
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
      $$ LANGUAGE sql STABLE;
    `);

    // 1. Aplicar a migration com a nova proteção Fail-Closed
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261016210000_fix_lote2_operacoes_volume_rpcs.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    await client.query(migrationSql);
    console.log('Migration com Fail-Closed aplicada com sucesso!\n');

    // Recuperar IDs de tenants e empresas
    const tenant1Res = await client.query(`SELECT id FROM public.tenants LIMIT 1;`);
    const tenant1Id = tenant1Res.rows[0].id;

    const tenant2Res = await client.query(`
      INSERT INTO public.tenants (id, nome) VALUES (gen_random_uuid(), 'Tenant Isolado B') RETURNING id;
    `);
    const tenant2Id = tenant2Res.rows[0].id;

    const empRes = await client.query(`SELECT id FROM public.empresas WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const empresaId = empRes.rows[0].id;

    const unidRes = await client.query(`SELECT id FROM public.unidades WHERE empresa_id = $1 LIMIT 1;`, [empresaId]);
    const unidadeId = unidRes.rows[0].id;

    const servRes = await client.query(`SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const tipoServicoId = servRes.rows[0].id;

    const transpRes = await client.query(`SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const transpId = transpRes.rows[0].id;

    const fornRes = await client.query(`SELECT id FROM public.fornecedores WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const fornId = fornRes.rows[0].id;

    const fpRes = await client.query(`SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const fpId = fpRes.rows[0].id;

    // Criar usuários e perfis de teste
    const userAdminT1 = 'aaaaaaaa-1111-1111-1111-111111111111';     // Admin Tenant 1
    const userRhT1 = 'bbbbbbbb-1111-1111-1111-111111111111';        // RH Tenant 1
    const userEncarregadoT1 = 'cccccccc-1111-1111-1111-111111111111'; // Encarregado Tenant 1
    const userAdminT2 = 'dddddddd-2222-2222-2222-222222222222';     // Admin Tenant 2
    const userSemPerfil = 'eeeeeeee-3333-3333-3333-333333333333';   // Usuário sem perfil
    const userSemTenant = 'ffffffff-4444-4444-4444-444444444444';   // Usuário com perfil mas tenant NULL

    await client.query(`
      DELETE FROM public.profiles WHERE user_id IN ($1, $2, $3, $4, $5, $6);
    `, [userAdminT1, userRhT1, userEncarregadoT1, userAdminT2, userSemPerfil, userSemTenant]);

    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES
        ($1, $5, 'Admin T1', 'admin'),
        ($2, $5, 'RH T1', 'rh'),
        ($3, $5, 'Encarregado T1', 'encarregado'),
        ($4, $6, 'Admin T2', 'admin'),
        ($7, NULL, 'Perfil Sem Tenant', 'admin');
    `, [userAdminT1, userRhT1, userEncarregadoT1, userAdminT2, tenant1Id, tenant2Id, userSemTenant]);

    // Helper para criar operação do Tenant 1
    async function criarOpT1(status: string = 'RECEBIDO', entrada: string | null = '08:00', saida: string | null = '17:00') {
      const res = await client.query(`
        INSERT INTO public.operacoes_producao (
          tenant_id, empresa_id, unidade_id, tipo_servico_id, transportadora_id,
          fornecedor_id, forma_pagamento_id, data_operacao, data_vencimento,
          quantidade, quantidade_colaboradores, valor_unitario_snapshot,
          valor_descarga, valor_total, status, status_rh, status_pagamento,
          entrada_ponto, saida_ponto
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, '2026-10-16', '2026-10-31',
          50, 1, 10.0,
          500.0, 500.0, $8, 'PENDENTE_RH', 'PENDENTE',
          $9, $10
        ) RETURNING id, status, status_rh, status_pagamento, atualizado_em;
      `, [tenant1Id, empresaId, unidadeId, tipoServicoId, transpId, fornId, fpId, status, entrada, saida]);
      return res.rows[0];
    }

    // =========================================================================
    // CENÁRIO A: Usuário autorizado do mesmo tenant (Admin T1) -> SUCESSO
    // =========================================================================
    console.log('[TESTE A] Usuário autorizado do mesmo tenant (Admin T1)');
    const opA = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '${userAdminT1}';`);
    await client.query(`SET request.jwt.claim.role = 'authenticated';`);

    let erroA = '';
    let passouA = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opA.id]);
      const checkA = (await client.query(`SELECT status, status_rh FROM public.operacoes_producao WHERE id = $1;`, [opA.id])).rows[0];
      passouA = checkA.status === 'AGUARDANDO_FATURAMENTO' && checkA.status_rh === 'PENDENTE_RH';
    } catch (err: any) {
      erroA = err.message;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'A',
      descricao: 'Usuário autorizado do mesmo tenant (Admin T1)',
      esperado: 'Aprovação com sucesso para AGUARDANDO_FATURAMENTO',
      obtido: passouA ? 'Aprovado com sucesso' : `Falhou: ${erroA}`,
      passou: passouA,
    });

    // =========================================================================
    // CENÁRIO B: Usuário autenticado de outro tenant (Admin T2 tentando aprovar T1)
    // =========================================================================
    console.log('[TESTE B] Usuário autenticado de outro tenant (Admin T2 -> Operação T1)');
    const opB = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '${userAdminT2}';`);
    await client.query(`SET request.jwt.claim.role = 'authenticated';`);

    let erroB = '';
    let passouB = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opB.id]);
    } catch (err: any) {
      erroB = err.message;
      if (erroB.includes('CROSS_TENANT_ACCESS_DENIED')) passouB = true;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'B',
      descricao: 'Usuário autenticado de outro tenant (Cross-Tenant)',
      esperado: 'Rejeição CROSS_TENANT_ACCESS_DENIED',
      obtido: passouB ? `Bloqueado com sucesso: "${erroB}"` : `Falha no bloqueio: ${erroB || 'Aprovou indevidamente'}`,
      passou: passouB,
    });

    // =========================================================================
    // CENÁRIO C: Usuário autenticado sem perfil na tabela profiles
    // =========================================================================
    console.log('[TESTE C] Usuário autenticado sem perfil (User Sem Perfil)');
    const opC = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '${userSemPerfil}';`);
    await client.query(`SET request.jwt.claim.role = 'authenticated';`);

    let erroC = '';
    let passouC = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opC.id]);
    } catch (err: any) {
      erroC = err.message;
      if (erroC.includes('AUTH_PROFILE_INVALID')) passouC = true;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'C',
      descricao: 'Usuário autenticado sem perfil na tabela profiles',
      esperado: 'Rejeição AUTH_PROFILE_INVALID',
      obtido: passouC ? `Bloqueado com sucesso: "${erroC}"` : `Falha no bloqueio: ${erroC || 'Aprovou sem perfil'}`,
      passou: passouC,
    });

    // =========================================================================
    // CENÁRIO D: Perfil existente mas sem tenant resolvido (tenant_id IS NULL)
    // =========================================================================
    console.log('[TESTE D] Perfil existente sem tenant (tenant_id IS NULL)');
    const opD = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '${userSemTenant}';`);
    await client.query(`SET request.jwt.claim.role = 'authenticated';`);

    let erroD = '';
    let passouD = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opD.id]);
    } catch (err: any) {
      erroD = err.message;
      if (erroD.includes('AUTH_PROFILE_INVALID')) passouD = true;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'D',
      descricao: 'Perfil existente mas sem tenant resolvido (tenant_id IS NULL)',
      esperado: 'Rejeição AUTH_PROFILE_INVALID',
      obtido: passouD ? `Bloqueado com sucesso: "${erroD}"` : `Falha no bloqueio: ${erroD || 'Aprovou sem tenant'}`,
      passou: passouD,
    });

    // =========================================================================
    // CENÁRIO E: Usuário do mesmo tenant sem permissão de aprovação (Encarregado)
    // =========================================================================
    console.log('[TESTE E] Usuário do mesmo tenant sem permissão RBAC (Encarregado T1)');
    const opE = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '${userEncarregadoT1}';`);
    await client.query(`SET request.jwt.claim.role = 'authenticated';`);

    let erroE = '';
    let passouE = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opE.id]);
    } catch (err: any) {
      erroE = err.message;
      if (erroE.includes('PERMISSION_DENIED')) passouE = true;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'E',
      descricao: 'Usuário do mesmo tenant sem permissão RBAC (Encarregado T1)',
      esperado: 'Rejeição PERMISSION_DENIED',
      obtido: passouE ? `Bloqueado com sucesso: "${erroE}"` : `Falha no bloqueio: ${erroE || 'Permitiu encarregado aprovar'}`,
      passou: passouE,
    });

    // =========================================================================
    // CENÁRIO F: Contexto sem autenticação (auth.uid() IS NULL)
    // =========================================================================
    console.log('[TESTE F] Contexto sem autenticação (Anônimo)');
    const opF = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '';`);
    await client.query(`SET request.jwt.claim.role = 'anon';`);

    let erroF = '';
    let passouF = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opF.id]);
    } catch (err: any) {
      erroF = err.message;
      if (erroF.includes('AUTH_REQUIRED')) passouF = true;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'F',
      descricao: 'Contexto sem autenticação (Anônimo/Sem JWT sub)',
      esperado: 'Rejeição AUTH_REQUIRED',
      obtido: passouF ? `Bloqueado com sucesso: "${erroF}"` : `Falha no bloqueio: ${erroF || 'Aprovou anonimamente'}`,
      passou: passouF,
    });

    // =========================================================================
    // CENÁRIO G: Contrato interno legítimo autorizado (service_role)
    // =========================================================================
    console.log('[TESTE G] Contrato interno legítimo autorizado (service_role)');
    const opG = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '';`);
    await client.query(`SET request.jwt.claim.role = 'service_role';`);

    let erroG = '';
    let passouG = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opG.id]);
      const checkG = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1;`, [opG.id])).rows[0];
      passouG = checkG.status === 'AGUARDANDO_FATURAMENTO';
    } catch (err: any) {
      erroG = err.message;
    }
    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'G',
      descricao: 'Contrato interno legítimo autorizado (service_role)',
      esperado: 'Aprovação permitida para service_role sem perfil JWT',
      obtido: passouG ? 'Aprovado com sucesso via service_role' : `Falha: ${erroG}`,
      passou: passouG,
    });

    // =========================================================================
    // REGRESSÃO CURTA
    // =========================================================================
    console.log('\n--- EXECUTANDO REGRESSÃO CURTA ---');

    // 1. Bloqueio de operação EM_RESTRICAO
    const opReg1 = await criarOpT1('EM_RESTRICAO', null, null);
    await client.query(`SET request.jwt.claim.sub = '${userAdminT1}';`);
    let reg1Passou = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opReg1.id]);
    } catch (err: any) {
      if (err.message.includes('OPERACAO_EM_RESTRICAO')) reg1Passou = true;
    }

    // 2. Regularização e aprovação
    await client.query(`
      UPDATE public.operacoes_producao 
      SET entrada_ponto = '08:00', saida_ponto = '17:00', status = 'RECEBIDO'
      WHERE id = $1;
    `, [opReg1.id]);
    let reg2Passou = false;
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opReg1.id]);
      const c = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1;`, [opReg1.id])).rows[0];
      reg2Passou = c.status === 'AGUARDANDO_FATURAMENTO';
    } catch (err: any) {}

    // 3. Ordem A: RH -> Financeiro
    const opRegA = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opRegA.id]);
    const recAId = (await client.query(`SELECT receita_id FROM public.receitas_operacionais_itens WHERE operacao_id = $1;`, [opRegA.id])).rows[0].receita_id;

    // RH valida com usuário RH autorizado
    await client.query(`SET request.jwt.claim.sub = '${userRhT1}';`);
    await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opRegA.id]);
    // Financeiro confirma recebimento
    await client.query(`SELECT public.rpc_receita_confirmar_recebimento($1, '2026-10-16'::date);`, [recAId]);
    const opRegACheck = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [opRegA.id])).rows[0];
    const reg3Passou = opRegACheck.status === 'CONCLUIDO' && opRegACheck.status_rh === 'VALIDADO_RH' && opRegACheck.status_pagamento === 'RECEBIDO';

    // 4. Ordem B: Financeiro -> RH
    const opRegB = await criarOpT1('RECEBIDO', '08:00', '17:00');
    await client.query(`SET request.jwt.claim.sub = '${userAdminT1}';`);
    await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opRegB.id]);
    const recBId = (await client.query(`SELECT receita_id FROM public.receitas_operacionais_itens WHERE operacao_id = $1;`, [opRegB.id])).rows[0].receita_id;

    // Financeiro confirma recebimento ANTES do RH
    await client.query(`SELECT public.rpc_receita_confirmar_recebimento($1, '2026-10-16'::date);`, [recBId]);
    // RH valida DEPOIS
    await client.query(`SET request.jwt.claim.sub = '${userRhT1}';`);
    await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opRegB.id]);
    const opRegBCheck = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [opRegB.id])).rows[0];
    const reg4Passou = opRegBCheck.status === 'CONCLUIDO' && opRegBCheck.status_rh === 'VALIDADO_RH' && opRegBCheck.status_pagamento === 'RECEBIDO';

    // 5. Integridade das receitas pós-aprovação
    const recSumRes = await client.query(`
      SELECT COALESCE(SUM(valor_total), 0)::numeric(12,2) as total_faturas
      FROM public.receitas_operacionais WHERE competencia = '2026-10';
    `);
    const itemSumRes = await client.query(`
      SELECT COALESCE(SUM(valor_item), 0)::numeric(12,2) as total_itens
      FROM public.receitas_operacionais_itens;
    `);
    const reg5Passou = parseFloat(recSumRes.rows[0].total_faturas) === parseFloat(itemSumRes.rows[0].total_itens) && parseFloat(recSumRes.rows[0].total_faturas) > 0;

    await client.query(`RESET request.jwt.claim.sub; RESET request.jwt.claim.role;`);

    results.push({
      cenario: 'REG-1',
      descricao: 'Regressão: Bloqueio de operação EM_RESTRICAO',
      esperado: 'Rejeição OPERACAO_EM_RESTRICAO',
      obtido: reg1Passou ? 'Bloqueado com sucesso' : 'Falha no bloqueio',
      passou: reg1Passou,
    });

    results.push({
      cenario: 'REG-2',
      descricao: 'Regressão: Aprovação após regularização de horários',
      esperado: 'Avança para AGUARDANDO_FATURAMENTO',
      obtido: reg2Passou ? 'Aprovado com sucesso' : 'Falha na aprovação',
      passou: reg2Passou,
    });

    results.push({
      cenario: 'REG-3',
      descricao: 'Regressão: Conclusão Ordem A (RH -> Financeiro)',
      esperado: 'Status final CONCLUIDO',
      obtido: reg3Passou ? 'CONCLUIDO com sucesso' : 'Falha na transição',
      passou: reg3Passou,
    });

    results.push({
      cenario: 'REG-4',
      descricao: 'Regressão: Conclusão Ordem B (Financeiro -> RH)',
      esperado: 'Status final CONCLUIDO (Simetria preservada)',
      obtido: reg4Passou ? 'CONCLUIDO com sucesso' : 'Falha na transição',
      passou: reg4Passou,
    });

    results.push({
      cenario: 'REG-5',
      descricao: 'Regressão: Integridade de receitas e conciliação DRE',
      esperado: 'Soma Faturas = Soma Itens na competência',
      obtido: reg5Passou ? `Faturas R$ ${recSumRes.rows[0].total_faturas} = Itens R$ ${itemSumRes.rows[0].total_itens}` : 'Divergência financeira',
      passou: reg5Passou,
    });

    // =========================================================================
    // VERIFICAÇÕES DIRECIONADAS DE ÚLTIMO AJUSTE PRÉ-APLICAÇÃO
    // =========================================================================

    // 1. FLUXO DE APROVAÇÃO RH: Rejeitar operação que ainda não alcançou a etapa RH (ex: RECEBIDO)
    const opPreRh = await criarOpT1('RECEBIDO', '08:00', '17:00');
    let preRhBloqueado = false;
    await client.query(`SET request.jwt.claim.sub = '${userRhT1}';`);
    try {
      await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opPreRh.id]);
    } catch (err: any) {
      if (err.message.includes('ETAPA_RH_INVALIDA')) preRhBloqueado = true;
    }
    results.push({
      cenario: 'VRF-1',
      descricao: 'Verificação RH: Rejeitar aprovação RH de operação antes da etapa RH (RECEBIDO)',
      esperado: 'Rejeição ETAPA_RH_INVALIDA',
      obtido: preRhBloqueado ? 'Bloqueado com sucesso (ETAPA_RH_INVALIDA)' : 'Falha no bloqueio',
      passou: preRhBloqueado,
    });

    // 2. HORÁRIOS: Rejeitar horários malformados
    const opMalformada = await criarOpT1('RECEBIDO', '99:99', '25:70');
    let malformadaBloqueada = false;
    await client.query(`SET request.jwt.claim.sub = '${userAdminT1}';`);
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opMalformada.id]);
    } catch (err: any) {
      if (err.message.includes('HORARIOS_INVALIDOS')) malformadaBloqueada = true;
    }
    results.push({
      cenario: 'VRF-2',
      descricao: 'Verificação Horários: Rejeitar horários malformados (99:99 / 25:70)',
      esperado: 'Rejeição HORARIOS_INVALIDOS',
      obtido: malformadaBloqueada ? 'Bloqueado com sucesso (HORARIOS_INVALIDOS)' : 'Falha no bloqueio',
      passou: malformadaBloqueada,
    });

    // 3. HORÁRIOS: Aceitar turnos noturnos legítimos (22:00 -> 05:00)
    const opNoturna = await criarOpT1('RECEBIDO', '22:00', '05:00');
    await client.query(`SET request.jwt.claim.sub = '${userAdminT1}';`);
    let noturnaAceita = false;
    try {
      const resNoturna = await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opNoturna.id]);
      if (resNoturna.rows.length > 0) noturnaAceita = true;
    } catch (err: any) {
      noturnaAceita = false;
    }
    results.push({
      cenario: 'VRF-3',
      descricao: 'Verificação Horários: Preservar turno noturno legítimo (22:00 -> 05:00)',
      esperado: 'Aprovação com sucesso',
      obtido: noturnaAceita ? 'Aprovado com sucesso (turno noturno aceito)' : 'Rejeição indevida',
      passou: noturnaAceita,
    });

    // 4. RBAC: Segregação canônica entre RH e Governança Operacional
    // Usuário RH tentando chamar rpc_operacao_validar_aprovar (deve ser rejeitado)
    const opRbacTest = await criarOpT1('RECEBIDO', '08:00', '17:00');
    let rhBloqueadoOperacional = false;
    await client.query(`SET request.jwt.claim.sub = '${userRhT1}';`);
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opRbacTest.id]);
    } catch (err: any) {
      if (err.message.includes('PERMISSION_DENIED')) rhBloqueadoOperacional = true;
    }

    // Criar usuário Financeiro para testar que Financeiro não valida RH
    const userFinanceiroT1 = '12121212-9999-9999-9999-121212121212';
    await client.query(`DELETE FROM public.profiles WHERE user_id = $1;`, [userFinanceiroT1]);
    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
      VALUES ($1, $2, 'Financeiro T1', 'financeiro');
    `, [userFinanceiroT1, tenant1Id]);

    // Aprovar operacionalmente primeiro para colocar em AGUARDANDO_FATURAMENTO
    await client.query(`SET request.jwt.claim.sub = '${userAdminT1}';`);
    await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opRbacTest.id]);

    let finBloqueadoRh = false;
    await client.query(`SET request.jwt.claim.sub = '${userFinanceiroT1}';`);
    try {
      await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opRbacTest.id]);
    } catch (err: any) {
      if (err.message.includes('PERMISSION_DENIED')) finBloqueadoRh = true;
    }

    const rbacCanonicoOk = rhBloqueadoOperacional && finBloqueadoRh;
    results.push({
      cenario: 'VRF-4',
      descricao: 'Verificação RBAC: Segregação canônica (RH não aprova operacional; Financeiro não aprova RH)',
      esperado: 'PERMISSION_DENIED em ambas as tentativas indevidas',
      obtido: rbacCanonicoOk ? 'Segregação 100% comprovada' : `Falha: RH op=${rhBloqueadoOperacional}, Fin rh=${finBloqueadoRh}`,
      passou: rbacCanonicoOk,
    });

  } catch (err) {
    console.error('Erro inesperado nos testes:', err);
  } finally {
    await client.end();
  }

  // =========================================================================
  // RELATÓRIO CONSOLIDADO
  // =========================================================================
  console.log('\n========================================================================');
  console.log('RESULTADO FINAL: SEGURANÇA FAIL-CLOSED & REGRESSÃO');
  console.log('========================================================================');
  console.table(results.map(r => ({
    Cenário: r.cenario,
    Descrição: r.descricao,
    Status: r.passou ? 'PASSOU' : 'FALHOU',
    Obtido: r.obtido
  })));

  const totalFalhas = results.filter(r => !r.passou).length;
  console.log(`\nTotal de Cenários Avaliados: ${results.length}`);
  console.log(`Aprovados: ${results.filter(r => r.passou).length}`);
  console.log(`Falhas: ${totalFalhas}`);

  if (totalFalhas === 0) {
    console.log('\n>>> STATUS: TODAS AS VALIDAÇÕES DE SEGURANÇA E REGRESSÃO PASSARAM COM SUCESSO! <<<');
  } else {
    console.log('\n>>> STATUS: FALHAS DETECTADAS <<<');
  }
}

runSecurityFailClosedValidation();
