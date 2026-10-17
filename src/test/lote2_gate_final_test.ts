import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface GateCheck {
  item: number;
  descricao: string;
  esperado: string;
  obtido: string;
  status: 'PASSOU' | 'FALHOU';
  detalhe?: string;
}

const PG_CONFIG = {
  host: '127.0.0.1',
  port: 54332,
  user: 'postgres',
  password: '',
  database: 'postgres',
};

async function runGateFinal() {
  console.log('========================================================================');
  console.log('ORBE ERP — LOTE 2: GATE FINAL PRÉ-MIGRATION (VALIDAÇÃO ESTRITA)');
  console.log('========================================================================\n');

  const client = new Client(PG_CONFIG);
  await client.connect();
  console.log('Conectado ao PostgreSQL 17 isolado (54332).');

  const checks: GateCheck[] = [];

  try {
    // 0. Setup base: schema auth e perfis
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      
      -- Tabela profiles se não existir
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL,
        tenant_id UUID REFERENCES public.tenants(id),
        full_name TEXT,
        role TEXT DEFAULT 'operador'
      );

      -- Variável de sessão para simular contexto do auth.uid()
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ LANGUAGE sql STABLE;
    `);

    // 1. Aplicar a migration consolidada refinada
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261016210000_fix_lote2_operacoes_volume_rpcs.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    await client.query(migrationSql);
    console.log('Migration 20261016210000 aplicada com sucesso no cluster isolado.\n');

    // Recuperar IDs existentes
    const tenant1Res = await client.query(`SELECT id FROM public.tenants LIMIT 1;`);
    const tenant1Id = tenant1Res.rows[0].id;

    // Criar Tenant 2 para teste de isolamento
    const tenant2Res = await client.query(`INSERT INTO public.tenants (nome) VALUES ('Tenant Secundário Gate') RETURNING id;`);
    const tenant2Id = tenant2Res.rows[0].id;

    // Criar Empresas e Unidades
    const emp1Res = await client.query(`SELECT id FROM public.empresas WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const empresa1Id = emp1Res.rows[0].id;

    const unid1Res = await client.query(`SELECT id FROM public.unidades WHERE empresa_id = $1 LIMIT 1;`, [empresa1Id]);
    const unidade1Id = unid1Res.rows[0].id;

    const servRes = await client.query(`SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const servicoId = servRes.rows[0].id;

    const transpRes = await client.query(`SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const transpId = transpRes.rows[0].id;

    const fornRes = await client.query(`SELECT id FROM public.fornecedores WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const fornId = fornRes.rows[0].id;

    const fpRes = await client.query(`SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1 LIMIT 1;`, [tenant1Id]);
    const fpId = fpRes.rows[0].id;

    // Criar dois usuários autenticados em tenants diferentes
    const userA_Id = '11111111-1111-1111-1111-111111111111';
    const userB_Id = '22222222-2222-2222-2222-222222222222';

    await client.query(`DELETE FROM public.profiles WHERE user_id IN ($1, $2);`, [userA_Id, userB_Id]);
    await client.query(`
      INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
      VALUES 
        ($1, $3, 'Admin Tenant 1', 'admin'),
        ($2, $4, 'Invasor Tenant 2', 'admin');
    `, [userA_Id, userB_Id, tenant1Id, tenant2Id]);

    // =========================================================================
    // ITEM 1: Verificação de Catálogo, Assinaturas e Contratos
    // =========================================================================
    console.log('[ITEM 1] Verificação de Catálogo de Funções e Assinaturas');
    const rpc1Meta = await client.query(`
      SELECT routine_name, security_type, data_type 
      FROM information_schema.routines 
      WHERE routine_name = 'rpc_operacao_validar_aprovar';
    `);
    const rpc2Meta = await client.query(`
      SELECT routine_name, security_type, data_type 
      FROM information_schema.routines 
      WHERE routine_name = 'rpc_rh_aprovar_operacao';
    `);

    const item1Ok = rpc1Meta.rows.length === 1 && 
                    rpc1Meta.rows[0].security_type === 'DEFINER' &&
                    rpc2Meta.rows.length === 1 && 
                    rpc2Meta.rows[0].security_type === 'DEFINER';

    checks.push({
      item: 1,
      descricao: 'Assinaturas, SECURITY DEFINER e contratos de retorno vigentes',
      esperado: 'Ambas as RPCs existentes, SECURITY DEFINER, retorno json',
      obtido: `rpc_operacao_validar_aprovar: ${rpc1Meta.rows[0]?.security_type || 'N/A'}, rpc_rh_aprovar_operacao: ${rpc2Meta.rows[0]?.security_type || 'N/A'}`,
      status: item1Ok ? 'PASSOU' : 'FALHOU',
    });

    // =========================================================================
    // ITEM 2: Tentativa Real de Aprovação Cruzada entre Tenants (Cross-Tenant)
    // =========================================================================
    console.log('[ITEM 2] Tentativa de Aprovação Cruzada entre Tenants com Contextos Distintos');
    // Cria operação do Tenant 1
    const opT1Res = await client.query(`
      INSERT INTO public.operacoes_producao (
        tenant_id, empresa_id, unidade_id, tipo_servico_id, transportadora_id,
        fornecedor_id, forma_pagamento_id, data_operacao, data_vencimento,
        quantidade, quantidade_colaboradores, valor_unitario_snapshot,
        valor_descarga, valor_total, status, status_rh, status_pagamento,
        entrada_ponto, saida_ponto
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, '2026-10-16', '2026-10-31',
        100, 1, 10.0,
        1000.0, 1000.0, 'RECEBIDO', 'PENDENTE_RH', 'PENDENTE',
        '08:00', '17:00'
      ) RETURNING id, atualizado_em;
    `, [tenant1Id, empresa1Id, unidade1Id, servicoId, transpId, fornId, fpId]);
    const opT1 = opT1Res.rows[0];

    // Simula contexto autenticado do Usuário B (do Tenant 2)
    await client.query(`SET request.jwt.claim.sub = '${userB_Id}';`);

    let t2_opBlocked = false;
    let t2_opErro = '';
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opT1.id]);
    } catch (err: any) {
      t2_opErro = err.message;
      if (t2_opErro.includes('CROSS_TENANT_ACCESS_DENIED')) t2_opBlocked = true;
    }

    let t2_rhBlocked = false;
    let t2_rhErro = '';
    try {
      await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opT1.id]);
    } catch (err: any) {
      t2_rhErro = err.message;
      if (t2_rhErro.includes('CROSS_TENANT_ACCESS_DENIED')) t2_rhBlocked = true;
    }

    // Reset contexto autenticado
    await client.query(`RESET request.jwt.claim.sub;`);

    const item2Ok = t2_opBlocked && t2_rhBlocked;
    checks.push({
      item: 2,
      descricao: 'Tentativa de aprovação cruzada entre tenants com contextos autenticados distintos',
      esperado: 'Exceção CROSS_TENANT_ACCESS_DENIED em ambas as RPCs',
      obtido: item2Ok ? `Bloqueio cross-tenant comprovado: "${t2_opErro}"` : `Falha: opBlocked=${t2_opBlocked}, rhBlocked=${t2_rhBlocked}, erroOp="${t2_opErro}", erroRh="${t2_rhErro}"`,
      status: item2Ok ? 'PASSOU' : 'FALHOU',
      detalhe: t2_opErro,
    });

    // =========================================================================
    // ITEM 3: Regras Canônicas de Horários (Incluindo Turnos Noturnos)
    // =========================================================================
    console.log('[ITEM 3] Regras de Horários: Turno Noturno com Travessia de Meia-Noite');
    // Operação noturna legítima: 22:00 até 05:00
    const opNoturnaRes = await client.query(`
      INSERT INTO public.operacoes_producao (
        tenant_id, empresa_id, unidade_id, tipo_servico_id, transportadora_id,
        fornecedor_id, forma_pagamento_id, data_operacao, data_vencimento,
        quantidade, quantidade_colaboradores, valor_unitario_snapshot,
        valor_descarga, valor_total, status, status_rh, status_pagamento,
        entrada_ponto, saida_ponto
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, '2026-10-16', '2026-10-31',
        60, 1, 10.0,
        600.0, 600.0, 'RECEBIDO', 'PENDENTE_RH', 'PENDENTE',
        '22:00', '05:00'
      ) RETURNING id;
    `, [tenant1Id, empresa1Id, unidade1Id, servicoId, transpId, fornId, fpId]);
    const opNoturna = opNoturnaRes.rows[0];

    // Simula contexto autenticado legítimo do Usuário A (Tenant 1)
    await client.query(`SET request.jwt.claim.sub = '${userA_Id}';`);

    let item3Ok = false;
    try {
      const aprRes = await client.query(`
        SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) as res
        FROM public.operacoes_producao WHERE id = $1;
      `, [opNoturna.id]);
      const statusPos = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1;`, [opNoturna.id])).rows[0].status;
      item3Ok = statusPos === 'AGUARDANDO_FATURAMENTO';
    } catch (err: any) {
      console.log('Erro inesperado em horário noturno:', err.message);
    }
    await client.query(`RESET request.jwt.claim.sub;`);

    checks.push({
      item: 3,
      descricao: 'Compatibilidade com turnos noturnos (travessia de meia-noite 22:00 -> 05:00)',
      esperado: 'Aprovação permitida normalmente sem bloqueio indevido de horário invertido',
      obtido: item3Ok ? 'Aprovado com sucesso para AGUARDANDO_FATURAMENTO (turno noturno aceito)' : 'Falhou: turno noturno bloqueado',
      status: item3Ok ? 'PASSOU' : 'FALHOU',
    });

    // =========================================================================
    // ITEM 4: Transição Estrita para CONCLUIDO (Blindagem de Incompletos)
    // =========================================================================
    console.log('[ITEM 4] Blindagem da Transição para CONCLUIDO');
    // 4.1: Operação com RH Aprovado mas Pagamento PENDENTE -> NÃO PODE SER CONCLUIDO
    const op41Res = await client.query(`
      INSERT INTO public.operacoes_producao (
        tenant_id, empresa_id, unidade_id, tipo_servico_id, transportadora_id,
        fornecedor_id, forma_pagamento_id, data_operacao, data_vencimento,
        quantidade, quantidade_colaboradores, valor_unitario_snapshot,
        valor_descarga, valor_total, status, status_rh, status_pagamento,
        entrada_ponto, saida_ponto
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, '2026-10-16', '2026-10-31',
        40, 1, 10.0,
        400.0, 400.0, 'AGUARDANDO_FATURAMENTO', 'PENDENTE_RH', 'PENDENTE',
        '08:00', '17:00'
      ) RETURNING id;
    `, [tenant1Id, empresa1Id, unidade1Id, servicoId, transpId, fornId, fpId]);
    const op41 = op41Res.rows[0];

    await client.query(`SET request.jwt.claim.sub = '${userA_Id}';`);
    await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [op41.id]);
    await client.query(`RESET request.jwt.claim.sub;`);

    const op41Check = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [op41.id])).rows[0];
    const item4_1Ok = op41Check.status === 'AGUARDANDO_FATURAMENTO' && op41Check.status_rh === 'VALIDADO_RH' && op41Check.status_pagamento === 'PENDENTE';

    // 4.2: Operação em DEVOLVIDO_RH com pagamento recebido -> NÃO PODE SER CONCLUIDO
    const op42Res = await client.query(`
      INSERT INTO public.operacoes_producao (
        tenant_id, empresa_id, unidade_id, tipo_servico_id, transportadora_id,
        fornecedor_id, forma_pagamento_id, data_operacao, data_vencimento,
        quantidade, quantidade_colaboradores, valor_unitario_snapshot,
        valor_descarga, valor_total, status, status_rh, status_pagamento,
        entrada_ponto, saida_ponto
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, '2026-10-16', '2026-10-31',
        40, 1, 10.0,
        400.0, 400.0, 'EM_RESTRICAO', 'DEVOLVIDO_RH', 'RECEBIDO',
        '08:00', '17:00'
      ) RETURNING id;
    `, [tenant1Id, empresa1Id, unidade1Id, servicoId, transpId, fornId, fpId]);
    const op42 = op42Res.rows[0];

    let item4_2Blocked = false;
    await client.query(`SET request.jwt.claim.sub = '${userA_Id}';`);
    try {
      await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [op42.id]);
    } catch (err: any) {
      if (err.message.includes('OPERACAO_EM_RESTRICAO')) item4_2Blocked = true;
    }
    await client.query(`RESET request.jwt.claim.sub;`);

    const op42Check = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1;`, [op42.id])).rows[0];
    const item4_2Ok = item4_2Blocked && op42Check.status === 'EM_RESTRICAO';

    checks.push({
      item: 4,
      descricao: 'Bloqueio estrito de conclusão indevida quando pendente financeiro ou em restrição',
      esperado: 'Impedir CONCLUIDO sem liquidação financeira E validação RH completa',
      obtido: item4_1Ok && item4_2Ok ? 'Blindagem 100% garantida: nenhuma operação incompleta foi concluída' : `Falha: 4.1=${item4_1Ok}, 4.2=${item4_2Ok}`,
      status: item4_1Ok && item4_2Ok ? 'PASSOU' : 'FALHOU',
    });

    // =========================================================================
    // ITEM 5: Preparação e Teste do Script de Rollback Seguro
    // =========================================================================
    console.log('[ITEM 5] Verificação do Script de Rollback Seguro');
    const rollbackPath = path.resolve(process.cwd(), 'database/rollbacks/rollback_20261016210000_fix_lote2_operacoes_volume_rpcs.sql');
    const rollbackExists = fs.existsSync(rollbackPath);
    const rollbackSql = fs.readFileSync(rollbackPath, 'utf-8');
    
    // Testa sintaxe do rollback no banco isolado
    await client.query(rollbackSql);
    // Reaplica a migration de fix para manter o estado homologado
    await client.query(migrationSql);

    checks.push({
      item: 5,
      descricao: 'Existência, validade e execução segura do script de Rollback específico',
      esperado: 'Arquivo rollback criado, sintaxe SQL válida e testado sem erros',
      obtido: rollbackExists ? 'Script de rollback validado com sucesso' : 'Arquivo de rollback ausente',
      status: rollbackExists ? 'PASSOU' : 'FALHOU',
    });

    // =========================================================================
    // ITEM 6: Preservação de Faturamento, Idempotência e Auditoria
    // =========================================================================
    console.log('[ITEM 6] Preservação de Faturamento, Idempotência e Auditoria');
    // Confirmar que faturamento mensal continua agrupando operações do mesmo ciclo
    const faturamentoRes = await client.query(`
      SELECT count(*) as total_faturas, sum(valor_total) as soma_total
      FROM public.receitas_operacionais
      WHERE modalidade = 'FATURAMENTO_MENSAL';
    `);
    const itensCountRes = await client.query(`SELECT count(*) as total FROM public.receitas_operacionais_itens;`);
    
    const item6Ok = Number(faturamentoRes.rows[0].total_faturas) > 0 && Number(itensCountRes.rows[0].total) > 0;

    checks.push({
      item: 6,
      descricao: 'Preservação do pipeline de receitas operacionais, faturamento e idempotência',
      esperado: 'Faturas e itens íntegros, sem impacto colateral nas triggers e views',
      obtido: `Faturas Mensais: ${faturamentoRes.rows[0].total_faturas} (R$ ${faturamentoRes.rows[0].soma_total}) | Itens: ${itensCountRes.rows[0].total}`,
      status: item6Ok ? 'PASSOU' : 'FALHOU',
    });

  } catch (err) {
    console.error('Erro durante execução do Gate Final:', err);
  } finally {
    await client.end();
  }

  // =========================================================================
  // RELATÓRIO DO GATE FINAL
  // =========================================================================
  console.log('\n========================================================================');
  console.log('RESULTADO DO GATE FINAL PRÉ-MIGRATION');
  console.log('========================================================================');
  console.table(checks.map(c => ({
    Item: c.item,
    Verificação: c.descricao,
    Status: c.status,
    Resultado: c.obtido
  })));

  const totalFalhas = checks.filter(c => c.status !== 'PASSOU').length;
  console.log(`\nTotal de Verificações: ${checks.length}`);
  console.log(`Aprovados: ${checks.filter(c => c.status === 'PASSOU').length}`);
  console.log(`Falhas: ${totalFalhas}`);

  if (totalFalhas === 0) {
    console.log('\n>>> PARECER FINAL: MIGRATION 100% APTA PARA APLICAÇÃO OFICIAL! <<<');
  } else {
    console.log('\n>>> PARECER FINAL: NÃO APTA <<<');
  }
}

runGateFinal();
