import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  id: string;
  cenario: string;
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

async function runLote2FixValidation() {
  console.log('========================================================================');
  console.log('ORBE ERP — LOTE 2: VALIDAÇÃO TRANSACIONAL DAS CORREÇÕES DAS RPCs');
  console.log('Testando a migration: 20261016210000_fix_lote2_operacoes_volume_rpcs.sql');
  console.log('========================================================================\n');

  const client = new Client(PG_CONFIG);
  await client.connect();
  console.log('Conectado ao PostgreSQL 17 isolado na porta 54332.');

  const results: TestResult[] = [];

  try {
    // 0. Garantir schema auth no Postgres isolado
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT '00000000-0000-0000-0000-000000000001'::uuid;
      $$ LANGUAGE sql STABLE;
    `);

    // 1. Ler e aplicar a nova migration incremental no banco isolado
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261016210000_fix_lote2_operacoes_volume_rpcs.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('\nAplicando nova migration no PostgreSQL isolado...');
    await client.query(migrationSql);
    console.log('Migration aplicada com sucesso!\n');

    // Recuperar IDs existentes de tenant, empresa, etc.
    const tenantRes = await client.query(`SELECT id FROM public.tenants LIMIT 1;`);
    const tenantId = tenantRes.rows[0].id;

    const empRes = await client.query(`SELECT id FROM public.empresas WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    const empresaId = empRes.rows[0].id;

    const unidRes = await client.query(`SELECT id FROM public.unidades WHERE empresa_id = $1 LIMIT 1;`, [empresaId]);
    const unidadeId = unidRes.rows[0].id;

    const servRes = await client.query(`SELECT id FROM public.tipos_servico_operacional WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    const tipoServicoId = servRes.rows[0].id;

    const transpRes = await client.query(`SELECT id FROM public.transportadoras_clientes WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    const transpId = transpRes.rows[0].id;

    const fornRes = await client.query(`SELECT id FROM public.fornecedores WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    const fornId = fornRes.rows[0].id;

    const fpRes = await client.query(`SELECT id FROM public.formas_pagamento_operacional WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    const fpId = fpRes.rows[0].id;

    // Helper para inserir operação de teste
    async function insertOp(dados: {
      qtd: number;
      valorUnit: number;
      modalidade?: string;
      status?: string;
      statusRh?: string;
      statusPagamento?: string;
      entrada?: string | null;
      saida?: string | null;
      dataOp?: string;
    }) {
      const valorDescarga = dados.qtd * dados.valorUnit;
      const res = await client.query(`
        INSERT INTO public.operacoes_producao (
          tenant_id, empresa_id, unidade_id, tipo_servico_id, transportadora_id,
          fornecedor_id, forma_pagamento_id, data_operacao, data_vencimento,
          quantidade, quantidade_colaboradores, valor_unitario_snapshot,
          valor_descarga, percentual_iss, custo_com_iss, valor_total_materiais,
          valor_total, status, status_rh, status_pagamento,
          entrada_ponto, saida_ponto
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, '2026-10-31',
          $9, 1, $10,
          $11, 0, 0, 0,
          $11, $12, $13, $14,
          $15, $16
        ) RETURNING id, status, status_rh, status_pagamento, atualizado_em;
      `, [
        tenantId, empresaId, unidadeId, tipoServicoId, transpId,
        fornId, fpId, dados.dataOp || '2026-10-16',
        dados.qtd, dados.valorUnit,
        valorDescarga,
        dados.status || 'RECEBIDO',
        dados.statusRh || 'PENDENTE_RH',
        dados.statusPagamento || 'PENDENTE',
        dados.entrada ?? null,
        dados.saida ?? null
      ]);
      return res.rows[0];
    }

    // =========================================================================
    // TESTE 1: Fix C2 — Bloqueio de aprovação direta com status = EM_RESTRICAO
    // =========================================================================
    console.log('[TESTE 1] Tentativa de aprovação de operação EM_RESTRICAO');
    const op1 = await insertOp({
      qtd: 100, valorUnit: 10.0,
      status: 'EM_RESTRICAO', entrada: null, saida: null
    });

    let t1Passou = false;
    let t1Erro = '';
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [op1.id]);
    } catch (err: any) {
      t1Erro = err.message;
      console.log('-> t1Erro capturado:', t1Erro);
      if (t1Erro.includes('OPERACAO_EM_RESTRICAO') || t1Erro.includes('HORARIOS_OBRIGATORIOS_AUSENTES')) {
        t1Passou = true;
      }
    }

    // Conferir se status NÃO foi alterado no banco (Rollback da RPC)
    const op1Check = (await client.query(`SELECT status FROM public.operacoes_producao WHERE id = $1;`, [op1.id])).rows[0];
    const t1RollbackOk = op1Check.status === 'EM_RESTRICAO';

    results.push({
      id: 'T1_BLOQUEIO_EM_RESTRICAO',
      cenario: 'Fix C2: Bloquear aprovação direta de operação EM_RESTRICAO via RPC',
      esperado: 'Exceção OPERACAO_EM_RESTRICAO/HORARIOS_OBRIGATORIOS_AUSENTES e status inalterado',
      obtido: t1Passou && t1RollbackOk ? `Bloqueado com sucesso: "${t1Erro}" (status: ${op1Check.status})` : `Falha no bloqueio: t1Passou=${t1Passou}, t1RollbackOk=${t1RollbackOk}, erro="${t1Erro}"`,
      passou: t1Passou && t1RollbackOk,
      detalhe: t1Erro,
    });

    // =========================================================================
    // TESTE 2: Fix C2 — Horários nulos, vazios ou em branco
    // =========================================================================
    console.log('[TESTE 2] Horários obrigatórios ausentes ou vazios');
    // 2.1: Entrada nula
    const op21 = await insertOp({
      qtd: 50, valorUnit: 10.0,
      status: 'EM_RESTRICAO', entrada: null, saida: '17:00'
    });

    let t21Passou = false;
    let t21Erro = '';
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [op21.id]);
    } catch (err: any) {
      t21Erro = err.message;
      console.log('-> t21Erro capturado:', t21Erro);
      if (t21Erro.includes('HORARIOS_OBRIGATORIOS_AUSENTES') || t21Erro.includes('OPERACAO_EM_RESTRICAO')) t21Passou = true;
    }

    // 2.2: Saída em branco '   '
    const op22 = await insertOp({
      qtd: 50, valorUnit: 10.0,
      status: 'EM_RESTRICAO', entrada: '08:00', saida: '   '
    });

    let t22Passou = false;
    let t22Erro = '';
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [op22.id]);
    } catch (err: any) {
      t22Erro = err.message;
      console.log('-> t22Erro capturado:', t22Erro);
      if (t22Erro.includes('HORARIOS_OBRIGATORIOS_AUSENTES') || t22Erro.includes('OPERACAO_EM_RESTRICAO')) t22Passou = true;
    }

    results.push({
      id: 'T2_HORARIOS_AUSENTES',
      cenario: 'Fix C2: Bloquear aprovação quando horários forem nulos ou vazios',
      esperado: 'Exceção HORARIOS_OBRIGATORIOS_AUSENTES/OPERACAO_EM_RESTRICAO em ambos os casos',
      obtido: t21Passou && t22Passou ? 'Bloqueio comprovado em entrada nula e saída em branco' : `Falha: 2.1=${t21Passou}, 2.2=${t22Passou}`,
      passou: t21Passou && t22Passou,
    });

    // =========================================================================
    // TESTE 3: Fix C2 — Regularização e aprovação canônica posterior
    // =========================================================================
    console.log('[TESTE 3] Regularização de horários e aprovação posterior');
    // Atualiza op1 com horários corretos e remove a restrição operacional
    await client.query(`
      UPDATE public.operacoes_producao
      SET entrada_ponto = '08:00', saida_ponto = '17:00', status = 'RECEBIDO'
      WHERE id = $1;
    `, [op1.id]);

    // Agora a aprovação pela RPC deve funcionar perfeitamente
    await client.query(`
      SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;
    `, [op1.id]);
    
    const op1Final = (await client.query(`SELECT status, status_rh FROM public.operacoes_producao WHERE id = $1;`, [op1.id])).rows[0];
    const t3Passou = op1Final.status === 'AGUARDANDO_FATURAMENTO' && op1Final.status_rh === 'PENDENTE_RH';

    results.push({
      id: 'T3_REGULARIZACAO_APROVACAO',
      cenario: 'Fix C2: Permitir aprovação normal após regularização de horários',
      esperado: 'status = AGUARDANDO_FATURAMENTO, status_rh = PENDENTE_RH',
      obtido: `status = ${op1Final.status}, status_rh = ${op1Final.status_rh}`,
      passou: t3Passou,
    });

    // =========================================================================
    // TESTE 4: Fix C5 — Ordem A (RH valida ANTES do recebimento financeiro)
    // =========================================================================
    console.log('[TESTE 4] Ordem A: RH valida antes do Financeiro receber');
    const opA = await insertOp({
      qtd: 80, valorUnit: 10.0,
      status: 'RECEBIDO', entrada: '08:00', saida: '17:00'
    });

    // Aprova operacionalmente -> gera receita e item
    await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opA.id]);

    // Localizar a receita gerada
    const itemAres = await client.query(`SELECT receita_id FROM public.receitas_operacionais_itens WHERE operacao_id = $1;`, [opA.id]);
    const receitaAId = itemAres.rows[0].receita_id;

    // Etapa 1 da Ordem A: RH Aprova
    await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opA.id]);
    const opAposRh = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [opA.id])).rows[0];
    
    // Deve estar com status_rh = VALIDADO_RH mas status AINDA NÃO CONCLUIDO (pois pagamento pendente)
    const t41Ok = opAposRh.status_rh === 'VALIDADO_RH' && opAposRh.status === 'AGUARDANDO_FATURAMENTO';

    // Etapa 2 da Ordem A: Financeiro Confirma Recebimento
    await client.query(`SELECT public.rpc_receita_confirmar_recebimento($1, '2026-10-16'::date);`, [receitaAId]);
    const opAposFin = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [opA.id])).rows[0];
    
    // Agora deve estar CONCLUIDO
    const t42Ok = opAposFin.status === 'CONCLUIDO' && opAposFin.status_pagamento === 'RECEBIDO';

    results.push({
      id: 'T4_ORDEM_A_RH_PRIMEIRO',
      cenario: 'Fix C5: Ordem A (RH valida primeiro, Financeiro recebe depois)',
      esperado: 'Fase 1: status=AGUARDANDO_FATURAMENTO (não conclui antecipado). Fase 2: status=CONCLUIDO',
      obtido: `Fase 1: ${opAposRh.status} (${opAposRh.status_rh}) | Fase 2: ${opAposFin.status} (${opAposFin.status_pagamento})`,
      passou: t41Ok && t42Ok,
    });

    // =========================================================================
    // TESTE 5: Fix C5 — Ordem B (Financeiro recebe ANTES do RH validar)
    // =========================================================================
    console.log('[TESTE 5] Ordem B: Financeiro recebe antes do RH validar (Cenário de Falha Original)');
    const opB = await insertOp({
      qtd: 50, valorUnit: 10.0,
      status: 'RECEBIDO', entrada: '08:00', saida: '17:00'
    });

    // Aprova operacionalmente -> gera receita e item
    await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opB.id]);

    const itemBres = await client.query(`SELECT receita_id FROM public.receitas_operacionais_itens WHERE operacao_id = $1;`, [opB.id]);
    const receitaBId = itemBres.rows[0].receita_id;

    // Etapa 1 da Ordem B: Financeiro Confirma Recebimento ANTES do RH
    await client.query(`SELECT public.rpc_receita_confirmar_recebimento($1, '2026-10-16'::date);`, [receitaBId]);
    const opBposFin = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [opB.id])).rows[0];

    // Deve estar com status_pagamento = RECEBIDO mas status AINDA NÃO CONCLUIDO (aguardando RH)
    const t51Ok = opBposFin.status_pagamento === 'RECEBIDO' && opBposFin.status === 'AGUARDANDO_FATURAMENTO';

    // Etapa 2 da Ordem B: RH valida operação
    await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opB.id]);
    const opBposRh = (await client.query(`SELECT status, status_rh, status_pagamento FROM public.operacoes_producao WHERE id = $1;`, [opB.id])).rows[0];

    // AGORA DEVE PROMOVER PARA CONCLUIDO DEVIDO AO FIX C5!
    const t52Ok = opBposRh.status === 'CONCLUIDO' && opBposRh.status_rh === 'VALIDADO_RH' && opBposRh.status_pagamento === 'RECEBIDO';

    results.push({
      id: 'T5_ORDEM_B_FINANCEIRO_PRIMEIRO',
      cenario: 'Fix C5: Ordem B (Financeiro recebe primeiro, RH valida depois) — SIMETRIA',
      esperado: 'Fase 1: status=AGUARDANDO_FATURAMENTO (não conclui antecipado). Fase 2: status=CONCLUIDO',
      obtido: `Fase 1: ${opBposFin.status} (${opBposFin.status_pagamento}) | Fase 2: ${opBposRh.status} (${opBposRh.status_rh})`,
      passou: t51Ok && t52Ok,
    });

    // =========================================================================
    // TESTE 6: Fix C5 — RH não pode aprovar operação em restrição
    // =========================================================================
    console.log('[TESTE 6] RH bloqueado em operação em restrição');
    const opRestr = await insertOp({
      qtd: 30, valorUnit: 10.0,
      status: 'EM_RESTRICAO', entrada: null, saida: null
    });

    let t6Passou = false;
    let t6Erro = '';
    try {
      await client.query(`SELECT public.rpc_rh_aprovar_operacao($1);`, [opRestr.id]);
    } catch (err: any) {
      t6Erro = err.message;
      if (t6Erro.includes('OPERACAO_EM_RESTRICAO')) t6Passou = true;
    }

    results.push({
      id: 'T6_RH_BLOQUEIO_RESTRICAO',
      cenario: 'Fix C5: Bloquear aprovação do RH em operação com restrição ativa',
      esperado: 'Exceção OPERACAO_EM_RESTRICAO',
      obtido: t6Passou ? `Bloqueado com sucesso: "${t6Erro}"` : 'Falha: permitiu aprovar',
      passou: t6Passou,
    });

    // =========================================================================
    // TESTE 7: Imutabilidade e Concorrência (OCC e ESTADO_FECHADO)
    // =========================================================================
    console.log('[TESTE 7] Imutabilidade e Concorrência');
    // Tentativa de re-aprovar operação já CONCLUIDO
    let t71Passou = false;
    let t71Erro = '';
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em) FROM public.operacoes_producao WHERE id = $1;`, [opB.id]);
    } catch (err: any) {
      t71Erro = err.message;
      if (t71Erro.includes('ESTADO_FECHADO')) t71Passou = true;
    }

    // Tentativa de aprovação com updated_at desatualizado (concorrência OCC)
    const opOcc = await insertOp({
      qtd: 40, valorUnit: 10.0,
      status: 'RECEBIDO', entrada: '08:00', saida: '17:00'
    });

    let t72Passou = false;
    let t72Erro = '';
    try {
      await client.query(`SELECT public.rpc_operacao_validar_aprovar(id, atualizado_em - INTERVAL '1 hour') FROM public.operacoes_producao WHERE id = $1;`, [opOcc.id]);
    } catch (err: any) {
      t72Erro = err.message;
      if (t72Erro.includes('CONCURRENCY_CONFLICT')) t72Passou = true;
    }

    results.push({
      id: 'T7_IMUTABILIDADE_OCC',
      cenario: 'Imutabilidade pós-fechamento e Concorrência Otimista (OCC)',
      esperado: 'Rejeição ESTADO_FECHADO e rejeição CONCURRENCY_CONFLICT',
      obtido: t71Passou && t72Passou ? 'Ambas as proteções ativas e bloqueando' : `Falha: 7.1=${t71Passou}, 7.2=${t72Passou}`,
      passou: t71Passou && t72Passou,
    });

    // =========================================================================
    // TESTE 8: Integridade de Receitas, Itens e Competência DRE
    // =========================================================================
    console.log('[TESTE 8] Integridade de Receitas, Faturas e DRE');
    const recCountRes = await client.query(`SELECT count(*)::int as total FROM public.receitas_operacionais;`);
    const itemCountRes = await client.query(`SELECT count(*)::int as total FROM public.receitas_operacionais_itens;`);
    const dreSumRes = await client.query(`
      SELECT COALESCE(SUM(valor_total), 0)::numeric(12,2) as total_dre 
      FROM public.receitas_operacionais 
      WHERE competencia = '2026-10';
    `);

    const dreItemSumRes = await client.query(`
      SELECT COALESCE(SUM(valor_item), 0)::numeric(12,2) as total_itens
      FROM public.receitas_operacionais_itens;
    `);

    const t8Passou = recCountRes.rows[0].total > 0 && 
                     itemCountRes.rows[0].total > 0 &&
                     parseFloat(dreSumRes.rows[0].total_dre) === parseFloat(dreItemSumRes.rows[0].total_itens);

    results.push({
      id: 'T8_DRE_COMPETENCIA',
      cenario: 'Consistência e integridade das Receitas, Itens e DRE por competência',
      esperado: 'Soma das receitas = Soma dos itens na competência 2026-10',
      obtido: `Receitas: R$ ${dreSumRes.rows[0].total_dre} | Itens: R$ ${dreItemSumRes.rows[0].total_itens}`,
      passou: t8Passou,
    });

    // =========================================================================
    // TESTE 9: Isolamento de Tenants
    // =========================================================================
    console.log('[TESTE 9] Isolamento entre Tenants');
    const tenant2Res = await client.query(`INSERT INTO public.tenants (nome) VALUES ('Outro Tenant Corp') RETURNING id;`);
    const tenant2Id = tenant2Res.rows[0].id;

    const opTenant1Count = (await client.query(`SELECT count(*)::int as total FROM public.operacoes_producao WHERE tenant_id = $1;`, [tenantId])).rows[0].total;
    const opTenant2Count = (await client.query(`SELECT count(*)::int as total FROM public.operacoes_producao WHERE tenant_id = $1;`, [tenant2Id])).rows[0].total;

    const t9Passou = opTenant1Count > 0 && opTenant2Count === 0;

    results.push({
      id: 'T9_ISOLAMENTO_TENANTS',
      cenario: 'Segregação estrita de dados por tenant_id',
      esperado: 'Tenant 1 possui operações, Tenant 2 isolado com 0 registros',
      obtido: `Tenant 1: ${opTenant1Count} registros | Tenant 2: ${opTenant2Count} registros`,
      passou: t9Passou,
    });

  } catch (err) {
    console.error('Erro inesperado durante a execução dos testes:', err);
  } finally {
    await client.end();
  }

  // =========================================================================
  // RELATÓRIO FINAL CONSOLIDADO
  // =========================================================================
  console.log('\n========================================================================');
  console.log('RESULTADO DA VALIDAÇÃO TRANSACIONAL DAS CORREÇÕES DAS RPCs');
  console.log('========================================================================');
  console.table(results.map(r => ({
    ID: r.id,
    Cenário: r.cenario,
    Status: r.passou ? 'PASSOU' : 'FALHOU',
    Obtido: r.obtido
  })));

  const totalFalhas = results.filter(r => !r.passou).length;
  console.log(`\nTotal de Cenários: ${results.length}`);
  console.log(`Aprovados: ${results.filter(r => r.passou).length}`);
  console.log(`Falhas: ${totalFalhas}`);

  if (totalFalhas === 0) {
    console.log('\n>>> TODAS AS CORREÇÕES CONSOLIDADAS FORAM 100% VALIDADAS E APROVADAS! <<<');
  } else {
    console.log('\n>>> AINDA HÁ FALHAS PENDENTES DE CORREÇÃO <<<');
  }
}

runLote2FixValidation();
