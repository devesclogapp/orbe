import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '@/lib/supabase';
import { RHFinanceiroService } from '../rhFinanceiro.service';
import { upsertFechamentoMensal } from '../rhProcessing.service';

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
const EXPECTED_SANDBOX_COMPANY_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
const COMPETENCIA = '2026-10';

async function exactCount(table: string, filterFn?: (q: any) => any) {
  let query = (supabase as any).from(table).select('*', { count: 'exact', head: true });
  if (filterFn) query = filterFn(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

describe('CP07.3 — E2E FINAL | Fechamento CLT → Financeiro', () => {
  let baselineCounts: {
    colaboradoresReais: number;
    pontosReais: number;
    eventosBhReais: number;
    saldosBhReais: number;
    lotesFinanceirosReais: number;
    itensFinanceirosReais: number;
  };

  let colabData: any;
  let empresaData: any;

  beforeAll(async () => {
    console.log('=================================================================');
    console.log('CP07.3: INICIANDO E2E FINAL — FECHAMENTO CLT → FINANCEIRO');
    console.log('=================================================================');

    // 1. Autenticação e Fail-Fast
    const testEmail = process.env.E2E_TEST_EMAIL;
    const testPassword = process.env.E2E_TEST_PASSWORD;
    if (!testEmail || !testPassword) {
      throw new Error('E2E_TEST_EMAIL ou E2E_TEST_PASSWORD ausentes no .env.local');
    }

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (authErr || !authData.user) {
      throw new Error(`Falha na autenticação: ${authErr?.message}`);
    }
    console.log(`[AUTH] Conectado: ${authData.user.email} (ID: ${authData.user.id})`);

    // 2. Trava estrita de segurança sandbox
    const { data: emp, error: empErr } = await (supabase as any)
      .from('empresas')
      .select('id, nome, is_teste, tenant_id')
      .eq('id', EXPECTED_SANDBOX_COMPANY_ID)
      .single();

    if (empErr || !emp || !emp.is_teste || emp.tenant_id !== PROD_TENANT_ID) {
      throw new Error('[FAIL-FAST] Empresa sandbox inválida ou não é teste!');
    }
    empresaData = emp;

    // 3. Colaborador sintético
    const { data: colab, error: colabErr } = await (supabase as any)
      .from('colaboradores')
      .select('*')
      .eq('id', EXPECTED_COLAB_ID)
      .single();

    if (colabErr || !colab || !colab.is_teste || colab.empresa_id !== EXPECTED_SANDBOX_COMPANY_ID) {
      throw new Error('[FAIL-FAST] Colaborador HML inválido ou não pertence à sandbox!');
    }
    colabData = colab;

    // 4. Pontos: 9 pontos com status PROCESSADO
    const { data: pontos, error: pontosErr } = await (supabase as any)
      .from('registros_ponto')
      .select('id, data, status_processamento, minutos_extra, valor_hora_extra')
      .eq('colaborador_id', EXPECTED_COLAB_ID)
      .order('data', { ascending: true });

    if (pontosErr || !pontos || pontos.length !== 9) {
      throw new Error(`[FAIL-FAST] Esperado 9 pontos, encontrado ${pontos?.length}`);
    }

    const allProcessados = pontos.every((p: any) => p.status_processamento === 'PROCESSADO');
    if (!allProcessados) {
      throw new Error('[FAIL-FAST] Nem todos os 9 pontos estão com status PROCESSADO!');
    }

    const totalMinutosExtra = pontos.reduce((acc: number, p: any) => acc + (p.minutos_extra || 0), 0);
    if (totalMinutosExtra !== 540) {
      throw new Error(`[FAIL-FAST] HE física esperada de 540 min, encontrada: ${totalMinutosExtra}`);
    }

    // 5. Saldo BH = +240 min
    const { data: saldoBH, error: saldoErr } = await (supabase as any)
      .from('banco_horas_saldos')
      .select('*')
      .eq('colaborador_id', EXPECTED_COLAB_ID)
      .single();

    if (saldoErr || !saldoBH || saldoBH.saldo_atual_minutos !== 240) {
      throw new Error(`[FAIL-FAST] Saldo BH esperado de +240 min, encontrado: ${saldoBH?.saldo_atual_minutos}`);
    }

    // 6. Exatamente 4 eventos BH
    const { data: eventosBH, error: evErr } = await (supabase as any)
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', EXPECTED_COLAB_ID);

    if (evErr || !eventosBH || eventosBH.length !== 4) {
      throw new Error(`[FAIL-FAST] Esperado 4 eventos BH, encontrado: ${eventosBH?.length}`);
    }

    // 7. Ausência de lotes RH financeiros HML previamente criados para 2026-10
    const { data: lotesRhExistentes, error: lotesErr } = await (supabase as any)
      .from('rh_financeiro_lotes')
      .select('*')
      .eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)
      .eq('competencia', COMPETENCIA)
      .eq('origem', 'RH');

    if (lotesErr || (lotesRhExistentes && lotesRhExistentes.length > 0)) {
      throw new Error(`[FAIL-FAST] Lotes RH financeiros prévios encontrados: ${lotesRhExistentes?.length}`);
    }

    // 8. Baseline snapshot de produção (para validação de isolamento)
    baselineCounts = {
      colaboradoresReais: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      pontosReais: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      eventosBhReais: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
      saldosBhReais: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
      lotesFinanceirosReais: await exactCount('rh_financeiro_lotes', q => q.eq('tenant_id', PROD_TENANT_ID).neq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)),
      itensFinanceirosReais: await exactCount('rh_financeiro_lote_itens', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    };
    console.log('[SNAPSHOT] Contadores de produção antes do fechamento:');
    console.table(baselineCounts);
  });

  it('Etapa 1: Fechamento mensal — deve consolidar horas extras e banco de horas conforme regras oficiais', async () => {
    console.log('\n--- ETAPA 1: FECHAMENTO MENSAL ---');

    await upsertFechamentoMensal({
      tenantId: PROD_TENANT_ID,
      colaborador: colabData,
      empresaId: EXPECTED_SANDBOX_COMPANY_ID,
      month: COMPETENCIA,
    });

    const { data: fechamento, error: fechErr } = await (supabase as any)
      .from('fechamento_mensal')
      .select('*')
      .eq('tenant_id', PROD_TENANT_ID)
      .eq('colaborador_id', EXPECTED_COLAB_ID)
      .eq('ano', 2026)
      .eq('mes', 10)
      .single();

    expect(fechErr).toBeNull();
    expect(fechamento).toBeDefined();

    console.log('Registro fechamento_mensal gerado:', {
      horas_extras: fechamento.horas_extras,
      horas_faltas: fechamento.horas_faltas,
      saldo_banco_horas: fechamento.saldo_banco_horas,
      banco_horas_credito: fechamento.banco_horas_credito,
      banco_horas_debito: fechamento.banco_horas_debito,
      valor_hora_extra: fechamento.valor_hora_extra,
      valor_faltas: fechamento.valor_faltas,
      situacao: fechamento.situacao,
    });

    // Validar fechamento_mensal:
    // - HE = 9h / 540 min
    expect(Number(fechamento.horas_extras)).toBe(9);
    // - falta = 0
    expect(Number(fechamento.horas_faltas)).toBe(0);
    // - saldo BH = +4h / +240 min
    expect(Number(fechamento.saldo_banco_horas)).toBe(4);
    // - crédito BH = 5h
    expect(Number(fechamento.banco_horas_credito)).toBe(5);
    // - débito BH = 1h
    expect(Number(fechamento.banco_horas_debito)).toBe(1);
    // - nenhum minuto BH convertido em pagamento
    expect(fechamento.situacao).toBe('pendente');
    expect(Number(fechamento.valor_hora_extra)).toBe(62.10);
    expect(Number(fechamento.valor_faltas)).toBe(0);
  });

  it('Etapa 2: Aprovação RH → Financeiro — deve gerar lotes e itens com precisão monetária canônica', async () => {
    console.log('\n--- ETAPA 2: APROVAÇÃO RH → FINANCEIRO ---');

    // Executar exclusivamente approveCompetencia
    const result = await RHFinanceiroService.approveCompetencia(EXPECTED_SANDBOX_COMPANY_ID, COMPETENCIA);

    console.log('Resultado da aprovação:', {
      competencia: result.competencia,
      totalItens: result.totalItens,
      totalColaboradores: result.totalColaboradores,
      valorTotal: result.valorTotal,
      lotesCriados: result.lotesCriados.map((l: any) => ({ tipo: l.tipo, valor: l.valor_total })),
    });

    // Validar lotes criados
    expect(result.lotesCriados.length).toBe(2);
    expect(result.totalItens).toBe(3); // 1 base + 2 variáveis
    expect(result.totalColaboradores).toBe(2); // 1 na base + 1 na variável
    expect(result.valorTotal).toBe(1580.10);

    const loteBase = result.lotesCriados.find((l: any) => l.tipo === 'FOLHA_BASE');
    expect(loteBase).toBeDefined();
    expect(loteBase.total_colaboradores).toBe(1);
    expect(Number(loteBase.valor_total)).toBe(1518.00);

    const loteVariavel = result.lotesCriados.find((l: any) => l.tipo === 'FOLHA_VARIAVEL');
    expect(loteVariavel).toBeDefined();
    expect(loteVariavel.total_colaboradores).toBe(1);
    expect(Number(loteVariavel.valor_total)).toBe(62.10);

    // BANCO_HORAS: nenhum lote criado
    const loteBH = result.lotesCriados.find((l: any) => l.tipo === 'BANCO_HORAS');
    expect(loteBH).toBeUndefined();
  });

  it('Etapa 3: Persistência — deve auditar a persistência relacional de ponta a ponta', async () => {
    console.log('\n--- ETAPA 3: AUDITORIA DE PERSISTÊNCIA ---');

    // 1. rh_financeiro_lotes
    const { data: lotes, error: lotesErr } = await (supabase as any)
      .from('rh_financeiro_lotes')
      .select('*')
      .eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)
      .eq('competencia', COMPETENCIA)
      .eq('origem', 'RH')
      .order('tipo', { ascending: true });

    expect(lotesErr).toBeNull();
    expect(lotes.length).toBe(2);

    const lotBase = lotes.find((l: any) => l.tipo === 'FOLHA_BASE');
    const lotVar = lotes.find((l: any) => l.tipo === 'FOLHA_VARIAVEL');

    expect(lotBase.status).toBe('AGUARDANDO_FINANCEIRO');
    expect(Number(lotBase.valor_total)).toBe(1518.00);

    expect(lotVar.status).toBe('AGUARDANDO_FINANCEIRO');
    expect(Number(lotVar.valor_total)).toBe(62.10);

    // 2. rh_financeiro_lote_itens
    const { data: itens, error: itensErr } = await (supabase as any)
      .from('rh_financeiro_lote_itens')
      .select('*')
      .in('lote_id', [lotBase.id, lotVar.id])
      .order('created_at', { ascending: true });

    expect(itensErr).toBeNull();
    expect(itens.length).toBe(3);

    const itemSalario = itens.find((i: any) => i.lote_id === lotBase.id);
    expect(itemSalario).toBeDefined();
    expect(itemSalario.tipo_evento).toBe('SALARIO_BASE');
    expect(Number(itemSalario.valor_calculado)).toBe(1518.00);
    expect(itemSalario.colaborador_id).toBe(EXPECTED_COLAB_ID);

    const itensVar = itens.filter((i: any) => i.lote_id === lotVar.id);
    expect(itensVar.length).toBe(2);

    const itemC4 = itensVar.find((i: any) => i.minutos === 60);
    expect(itemC4).toBeDefined();
    expect(itemC4.tipo_evento).toBe('hora_extra');
    expect(itemC4.horas).toBe(1.0);
    expect(Number(itemC4.valor_calculado)).toBe(6.90);

    const itemC9 = itensVar.find((i: any) => i.minutos === 480);
    expect(itemC9).toBeDefined();
    expect(itemC9.tipo_evento).toBe('hora_extra');
    expect(itemC9.horas).toBe(8.0);
    expect(Number(itemC9.valor_calculado)).toBe(55.20);

    console.log('Origem → Lote → Item → Valor:');
    console.log(`- Salário: Colaborador ${colabData.nome} → Lote ${lotBase.id} (FOLHA_BASE) → Item ${itemSalario.id} → R$ ${Number(itemSalario.valor_calculado).toFixed(2)}`);
    console.log(`- HE C4 (06/10): Ponto ${itemC4.referencia_evento_id} (60 min) → Lote ${lotVar.id} (FOLHA_VARIAVEL) → Item ${itemC4.id} → R$ ${Number(itemC4.valor_calculado).toFixed(2)}`);
    console.log(`- HE C9 (11/10): Ponto ${itemC9.referencia_evento_id} (480 min) → Lote ${lotVar.id} (FOLHA_VARIAVEL) → Item ${itemC9.id} → R$ ${Number(itemC9.valor_calculado).toFixed(2)}`);

    // 3. rh_financeiro_lote_historico
    const { data: historico, error: histErr } = await (supabase as any)
      .from('rh_financeiro_lote_historico')
      .select('*')
      .in('lote_id', [lotBase.id, lotVar.id]);

    expect(histErr).toBeNull();
    expect(historico.length).toBeGreaterThanOrEqual(2);
    expect(historico.some((h: any) => h.acao === 'APROVOU_RH')).toBe(true);

    // 4. banco_horas_saldos e banco_horas_eventos
    const { data: saldoAtual } = await (supabase as any)
      .from('banco_horas_saldos')
      .select('*')
      .eq('colaborador_id', EXPECTED_COLAB_ID)
      .single();

    expect(saldoAtual.saldo_atual_minutos).toBe(240); // Continua +240 min

    const { data: eventosAtuais } = await (supabase as any)
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', EXPECTED_COLAB_ID);

    expect(eventosAtuais.length).toBe(4);
    expect(eventosAtuais.every((e: any) => e.reflexo_financeiro_pendente === false)).toBe(true);
  });

  it('Etapa 4: Idempotência — segunda execução de approveCompetencia não pode duplicar lotes nem itens', async () => {
    console.log('\n--- ETAPA 4: TESTE DE IDEMPOTÊNCIA ---');

    const result2 = await RHFinanceiroService.approveCompetencia(EXPECTED_SANDBOX_COMPANY_ID, COMPETENCIA);

    console.log('Resultado da 2ª aprovação (idempotência):', {
      lotesCriadosCount: result2.lotesCriados.length,
      lotesExistentesCount: result2.lotesExistentes.length,
      totalItens: result2.totalItens,
      valorTotal: result2.valorTotal,
    });

    expect(result2.lotesCriados.length).toBe(0);
    expect(result2.lotesExistentes.length).toBe(2);
    expect(result2.totalItens).toBe(3);
    expect(result2.valorTotal).toBe(1580.10);

    // Validar contagens em banco
    const { data: lotesPos } = await (supabase as any)
      .from('rh_financeiro_lotes')
      .select('*')
      .eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)
      .eq('competencia', COMPETENCIA)
      .eq('origem', 'RH');

    expect(lotesPos.length).toBe(2);

    const { data: itensPos } = await (supabase as any)
      .from('rh_financeiro_lote_itens')
      .select('*')
      .in('lote_id', lotesPos.map((l: any) => l.id));

    expect(itensPos.length).toBe(3);

    const valorTotalBanco = lotesPos.reduce((acc: number, l: any) => acc + Number(l.valor_total), 0);
    expect(valorTotalBanco).toBe(1580.10);

    // Banco de horas continua intacto
    const { data: saldoPos } = await (supabase as any)
      .from('banco_horas_saldos')
      .select('*')
      .eq('colaborador_id', EXPECTED_COLAB_ID)
      .single();
    expect(saldoPos.saldo_atual_minutos).toBe(240);

    const { data: evPos } = await (supabase as any)
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', EXPECTED_COLAB_ID);
    expect(evPos.length).toBe(4);
  });

  it('Etapa 5: Isolamento de produção — deltas de produção devem ser rigorosamente 0', async () => {
    console.log('\n--- ETAPA 5: ISOLAMENTO DE PRODUÇÃO ---');

    const finalCounts = {
      colaboradoresReais: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      pontosReais: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      eventosBhReais: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
      saldosBhReais: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
      lotesFinanceirosReais: await exactCount('rh_financeiro_lotes', q => q.eq('tenant_id', PROD_TENANT_ID).neq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)),
      itensFinanceirosReais: await exactCount('rh_financeiro_lote_itens', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', EXPECTED_COLAB_ID)),
    };

    const deltas = {
      colaboradoresReais: finalCounts.colaboradoresReais - baselineCounts.colaboradoresReais,
      pontosReais: finalCounts.pontosReais - baselineCounts.pontosReais,
      eventosBhReais: finalCounts.eventosBhReais - baselineCounts.eventosBhReais,
      saldosBhReais: finalCounts.saldosBhReais - baselineCounts.saldosBhReais,
      lotesFinanceirosReais: finalCounts.lotesFinanceirosReais - baselineCounts.lotesFinanceirosReais,
      itensFinanceirosReais: finalCounts.itensFinanceirosReais - baselineCounts.itensFinanceirosReais,
    };

    console.table({
      'Antes': baselineCounts,
      'Depois': finalCounts,
      'Delta (deve ser 0)': deltas,
    });

    expect(deltas.colaboradoresReais).toBe(0);
    expect(deltas.pontosReais).toBe(0);
    expect(deltas.eventosBhReais).toBe(0);
    expect(deltas.saldosBhReais).toBe(0);
    expect(deltas.lotesFinanceirosReais).toBe(0);
    expect(deltas.itensFinanceirosReais).toBe(0);
  });
});
