import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '@/lib/supabase';
import {
  avaliarPontoGates,
  calculateCompensation,
  calculateDataVencimento,
} from '@/services/rhProcessing.service';
import { JornadaTrabalho } from '@/types/jornada.types';

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
const EXPECTED_SANDBOX_COMPANY_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
const TARGET_DATES = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07'];

async function exactCount(table: string, filterFn?: (q: any) => any) {
  let query = (supabase as any).from(table).select('*', { count: 'exact', head: true });
  if (filterFn) query = filterFn(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

describe('CP06.5-A — E2E CLT | Processamento controlado dos cenários determinísticos 1–5', () => {
  it('deve processar canonicamente e isoladamente os cenários 1 a 5 sem afetar produção real', async () => {
    console.log('=================================================================');
    console.log('CP06.5-A: PROCESSAMENTO CONTROLADO DOS CENÁRIOS 1 A 5 (E2E CLT)');
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
    console.log(`[AUTH] Autenticado com sucesso: ${authData.user.email}`);

    // 2. Trava estrita de segurança sandbox
    const { data: emp, error: empErr } = await (supabase as any)
      .from('empresas')
      .select('id, nome, is_teste, tenant_id')
      .eq('id', EXPECTED_SANDBOX_COMPANY_ID)
      .single();

    if (empErr || !emp || !emp.is_teste || emp.tenant_id !== PROD_TENANT_ID) {
      throw new Error(`[FAIL-FAST SEGURANÇA] Empresa sandbox não é válida ou não possui is_teste=true!`);
    }
    console.log(`[SEGURANÇA] Sandbox verificada: ${emp.nome} (${emp.id})`);

    // 3. Trava do colaborador sintético
    const { data: colab, error: colabErr } = await (supabase as any)
      .from('colaboradores')
      .select('*')
      .eq('id', EXPECTED_COLAB_ID)
      .eq('tenant_id', PROD_TENANT_ID)
      .eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)
      .eq('is_teste', true)
      .single();

    if (colabErr || !colab) {
      throw new Error(`[FAIL-FAST SEGURANÇA] Colaborador HML ${EXPECTED_COLAB_ID} não encontrado ou inválido!`);
    }
    console.log(`[SEGURANÇA] Colaborador verificado: ${colab.nome} (${colab.matricula}) | is_teste=${colab.is_teste}`);

    // 4. Carregar Jornadas e Regras do Tenant
    const { data: dbJornadas } = await (supabase as any)
      .from('jornadas_trabalho')
      .select('*')
      .eq('tenant_id', PROD_TENANT_ID)
      .eq('status', 'ativo');
    const jornadasRuntime = (dbJornadas || []) as JornadaTrabalho[];

    const { data: dbRegras } = await (supabase as any)
      .from('banco_horas_regras')
      .select('*')
      .eq('tenant_id', PROD_TENANT_ID)
      .eq('status', 'ativo');
    const regrasRuntime = dbRegras || [];

    console.log(`[RUNTIME] Jornadas carregadas: ${jornadasRuntime.length} | Regras BH carregadas: ${regrasRuntime.length}`);

    // 5. Contadores ANTES do processamento
    console.log('\n--- CONTADORES ANTES DO PROCESSAMENTO ---');
    const countsAntes = {
      colaboradoresReais: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      colaboradoresTeste: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true)),
      pontosReais: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      pontosTeste: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true)),
      bhEventosReais: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', colab.id)),
      bhEventosTeste: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).eq('colaborador_id', colab.id)),
      bhSaldosReais: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', colab.id)),
      bhSaldosTeste: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).eq('colaborador_id', colab.id)),
      fechamentoMensal: await exactCount('fechamento_mensal', q => q.eq('tenant_id', PROD_TENANT_ID)),
    };
    console.table(countsAntes);

    // 6. Carregar estritamente os 5 pontos alvo
    const { data: pontosAlvo, error: ptsErr } = await (supabase as any)
      .from('registros_ponto')
      .select('*')
      .eq('tenant_id', PROD_TENANT_ID)
      .eq('empresa_id', EXPECTED_SANDBOX_COMPANY_ID)
      .eq('colaborador_id', colab.id)
      .eq('is_teste', true)
      .in('data', TARGET_DATES)
      .order('data', { ascending: true });

    if (ptsErr) throw ptsErr;
    expect(pontosAlvo).toBeDefined();
    expect(pontosAlvo.length).toBe(5);

    console.log(`\n[PONTOS] ${pontosAlvo.length} pontos identificados e isolados para processamento.`);

    // 7. Processamento Ponto por Ponto com Motor Canônico
    console.log('\n=================================================================');
    console.log('EXECUÇÃO CANÔNICA: GATES 1 A 4 E CÁLCULO DE COMPENSAÇÃO');
    console.log('=================================================================');

    let saldoAcumulado = 0;
    let totalPositivas = 0;
    let totalNegativas = 0;
    const relatorioCenarios: any[] = [];

    // Limpar eventos prévios do colaborador de teste caso existissem de uma tentativa anterior
    await (supabase as any).from('banco_horas_eventos').delete().eq('colaborador_id', colab.id).eq('tenant_id', PROD_TENANT_ID);
    await (supabase as any).from('banco_horas_saldos').delete().eq('colaborador_id', colab.id).eq('tenant_id', PROD_TENANT_ID);

    for (const ponto of pontosAlvo) {
      console.log(`\n>>> Processando Ponto Data: ${ponto.data} (${ponto.observacoes}) <<<`);

      // A. Avaliação Canônica dos Gates
      const gateResult = await avaliarPontoGates({
        tenantId: PROD_TENANT_ID,
        ponto,
        colaborador: colab,
        resolvedEmpresaId: EXPECTED_SANDBOX_COMPANY_ID,
        jornadasRuntime,
        regrasRuntime,
      });

      console.log(`Gate 1 (Cadastral): ${gateResult.passouCadastral ? 'APTO' : 'BLOQUEADO'}`);
      console.log(`Gate 2 (Jornada): ${gateResult.passouJornada ? 'APTO (' + gateResult.resolucaoJornada?.minutosPrevistos + ' min)' : 'BLOQUEADO'}`);
      console.log(`Gate 3 (Regra BH): ${gateResult.passouRegraBanco ? 'APTO (' + gateResult.regra?.nome + ')' : 'BLOQUEADO'}`);
      console.log(`Gate 4 (Marcações): ${gateResult.passouConsistenciaMarcacoes ? 'APTO' : 'BLOQUEADO'}`);

      expect(gateResult.bloqueado).toBe(false);
      expect(gateResult.passouCadastral).toBe(true);
      expect(gateResult.passouJornada).toBe(true);
      expect(gateResult.passouRegraBanco).toBe(true);
      expect(gateResult.passouConsistenciaMarcacoes).toBe(true);

      const regra = gateResult.regra!;
      const resolucaoJornada = gateResult.resolucaoJornada!;

      // B. Cálculo de Compensação e Segregação Canônica
      const calculo = calculateCompensation({
        ponto,
        regra,
        colaborador: colab,
        minutosPrevistosJornada: resolucaoJornada.minutosPrevistos,
        avaliacaoMarcacoes: gateResult.avaliacaoMarcacoes,
        cargaSemanalMinutos: resolucaoJornada.cargaSemanalMinutos,
        isJornadaConfigurada: resolucaoJornada.temJornadaConfigurada,
      });

      console.log(`Minutos Trabalhados: ${calculo.workedMinutes} | Previsto: ${calculo.jornadaMinutes}`);
      console.log(`Saldo Dia (BH): ${calculo.saldoDia > 0 ? '+' : ''}${calculo.saldoDia} min`);
      console.log(`Excedente Folha (HE a pagar): ${calculo.minutosExtra} min`);

      // C. Persistência de Evento em banco_horas_eventos (apenas se saldoDia !== 0)
      let eventoGerado: any = null;
      let dataVencimento: string | null = null;

      if (calculo.saldoDia !== 0) {
        const saldoAnterior = saldoAcumulado;
        saldoAcumulado += calculo.saldoDia;
        if (calculo.saldoDia > 0) totalPositivas += calculo.saldoDia;
        if (calculo.saldoDia < 0) totalNegativas += Math.abs(calculo.saldoDia);

        dataVencimento = calculo.saldoDia > 0 ? calculateDataVencimento(ponto.data, regra) : null;
        const tipoEvento = calculo.saldoDia > 0 ? 'hora_extra' : 'atraso';

        const eventoPayload = {
          tenant_id: PROD_TENANT_ID,
          colaborador_id: colab.id,
          empresa_id: EXPECTED_SANDBOX_COMPANY_ID,
          registro_ponto_id: ponto.id,
          data: ponto.data,
          data_evento: ponto.data,
          tipo: tipoEvento,
          tipo_evento: tipoEvento,
          quantidade_minutos: calculo.saldoDia,
          minutos: calculo.saldoDia,
          saldo_anterior: saldoAnterior,
          saldo_atual: saldoAcumulado,
          saldo_resultante: saldoAcumulado,
          origem: 'processamento_rh',
          descricao: calculo.saldoDia > 0 ? 'Crédito diário gerado no processamento RH' : 'Débito diário gerado no processamento RH',
          data_vencimento: dataVencimento,
          status: 'ativo',
        };

        const { data: evInserted, error: evErr } = await (supabase as any)
          .from('banco_horas_eventos')
          .insert(eventoPayload)
          .select()
          .single();

        if (evErr) throw new Error(`Erro ao inserir evento BH: ${evErr.message}`);
        eventoGerado = evInserted;
        console.log(`✅ Evento BH gerado: ID=${eventoGerado.id} | Minutos=${calculo.saldoDia} | Vencimento=${dataVencimento || 'N/A'}`);
      } else {
        console.log(`ℹ️ Saldo neutro (0 min): nenhum evento BH gravado.`);
      }

      // D. Atualização do Ponto para PROCESSADO
      const updatePayload = {
        status_processamento: 'PROCESSADO',
        processado_em: new Date().toISOString(),
        horas_calculadas: `${Math.floor(calculo.workedMinutes / 60)}:${String(Math.abs(calculo.workedMinutes % 60)).padStart(2, '0')}`,
        saldo_dia: calculo.saldoDia,
        saldo_acumulado_minutos: saldoAcumulado,
        regra_aplicada: regra.nome,
        jornada_calculada: calculo.jornadaHours,
        minutos_extra: calculo.minutosExtra,
        horas_extras_detalhadas: calculo.minutosExtra > 0 ? {
          minutos: calculo.minutosExtra,
          minutos_banco: calculo.minutosBanco,
          percentual: Number(regra.adicional_hora_extra_percentual ?? 0),
          multiplicador: calculo.multiplicadorExtra,
          valor: Number(calculo.valorExtras.toFixed(2)),
        } : null,
        status: 'Normal',
      };

      const { error: updErr } = await (supabase as any)
        .from('registros_ponto')
        .update(updatePayload)
        .eq('id', ponto.id)
        .eq('tenant_id', PROD_TENANT_ID);

      if (updErr) throw new Error(`Erro ao atualizar ponto: ${updErr.message}`);
      console.log(`✅ Ponto ${ponto.data} atualizado para status_processamento='PROCESSADO'.`);

      relatorioCenarios.push({
        data: ponto.data,
        cenario: ponto.observacoes,
        Gate1: 'APTO',
        Gate2: 'APTO',
        Gate3: 'APTO',
        Gate4: 'APTO',
        Trabalhado: `${calculo.workedMinutes} min (${Math.floor(calculo.workedMinutes / 60)}h${String(calculo.workedMinutes % 60).padStart(2, '0')})`,
        Previsto: `${calculo.jornadaMinutes} min (${Math.floor(calculo.jornadaMinutes / 60)}h${String(calculo.jornadaMinutes % 60).padStart(2, '0')})`,
        SaldoBruto: `${calculo.workedMinutes - calculo.jornadaMinutes > 0 ? '+' : ''}${calculo.workedMinutes - calculo.jornadaMinutes} min`,
        BH: `${calculo.saldoDia > 0 ? '+' : ''}${calculo.saldoDia} min`,
        HE: `${calculo.minutosExtra} min`,
        StatusFinal: 'PROCESSADO',
        VencimentoBH: dataVencimento || 'N/A',
      });
    }

    // 8. Atualizar Registro de Saldo Final na Tabela banco_horas_saldos
    const saldoPayload = {
      tenant_id: PROD_TENANT_ID,
      empresa_id: EXPECTED_SANDBOX_COMPANY_ID,
      colaborador_id: colab.id,
      saldo_atual_minutos: saldoAcumulado,
      horas_positivas_minutos: totalPositivas,
      horas_negativas_minutos: totalNegativas,
      ultima_movimentacao: '2026-10-07T00:00:00Z',
      ultima_atualizacao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: sldErr } = await (supabase as any)
      .from('banco_horas_saldos')
      .upsert(saldoPayload, { onConflict: 'tenant_id,colaborador_id' });

    if (sldErr) throw new Error(`Erro ao atualizar banco_horas_saldos: ${sldErr.message}`);
    console.log(`\n✅ Saldo consolidado gravado em banco_horas_saldos: Saldo Atual = ${saldoAcumulado} min (+${totalPositivas} / -${totalNegativas})`);

    // 9. Auditoria Final dos Eventos e Saldos
    console.log('\n=================================================================');
    console.log('AUDITORIA DE PERSISTÊNCIA EM BANCO_HORAS_EVENTOS E SALDOS');
    console.log('=================================================================');

    const { data: eventosPersistidos } = await (supabase as any)
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', colab.id)
      .order('data', { ascending: true });

    console.log('\nEventos gravados na tabela banco_horas_eventos:');
    console.table(
      eventosPersistidos?.map((e: any) => ({
        id: e.id,
        data: e.data,
        tipo: e.tipo,
        minutos: e.minutos,
        saldo_anterior: e.saldo_anterior,
        saldo_atual: e.saldo_atual,
        data_vencimento: e.data_vencimento,
        origem: e.origem,
      }))
    );

    const { data: saldoDb } = await (supabase as any)
      .from('banco_horas_saldos')
      .select('*')
      .eq('colaborador_id', colab.id)
      .single();

    console.log('\nSaldo gravado na tabela banco_horas_saldos:');
    console.log({
      colaborador_id: saldoDb.colaborador_id,
      saldo_atual_minutos: `${saldoDb.saldo_atual_minutos} min (${Math.floor(saldoDb.saldo_atual_minutos / 60)}h${String(Math.abs(saldoDb.saldo_atual_minutos) % 60).padStart(2, '0')})`,
      horas_positivas_minutos: `${saldoDb.horas_positivas_minutos} min`,
      horas_negativas_minutos: `${saldoDb.horas_negativas_minutos} min`,
      ultima_movimentacao: saldoDb.ultima_movimentacao,
    });

    // 10. Validações estritas dos Resultados Esperados
    expect(eventosPersistidos?.length).toBe(4); // 02/10 (+60), 05/10 (+120), 06/10 (+120), 07/10 (-60)
    expect(eventosPersistidos[0].data.substring(0, 10)).toBe('2026-10-02');
    expect(eventosPersistidos[0].minutos).toBe(60);
    expect(eventosPersistidos[0].data_vencimento).toBe('2027-03-31');

    expect(eventosPersistidos[1].data.substring(0, 10)).toBe('2026-10-05');
    expect(eventosPersistidos[1].minutos).toBe(120);
    expect(eventosPersistidos[1].data_vencimento).toBe('2027-04-03');

    expect(eventosPersistidos[2].data.substring(0, 10)).toBe('2026-10-06');
    expect(eventosPersistidos[2].minutos).toBe(120);
    expect(eventosPersistidos[2].data_vencimento).toBe('2027-04-04');

    expect(eventosPersistidos[3].data.substring(0, 10)).toBe('2026-10-07');
    expect(eventosPersistidos[3].minutos).toBe(-60);
    expect(eventosPersistidos[3].data_vencimento).toBeNull();

    expect(saldoDb.saldo_atual_minutos).toBe(240); // +4h00
    expect(saldoDb.horas_positivas_minutos).toBe(300); // +5h00
    expect(saldoDb.horas_negativas_minutos).toBe(60); // -1h00

    // 11. Contadores DEPOIS
    console.log('\n--- CONTADORES DEPOIS DO PROCESSAMENTO ---');
    const countsDepois = {
      colaboradoresReais: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      colaboradoresTeste: await exactCount('colaboradores', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true)),
      pontosReais: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', false)),
      pontosTeste: await exactCount('registros_ponto', q => q.eq('tenant_id', PROD_TENANT_ID).eq('is_teste', true)),
      bhEventosReais: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', colab.id)),
      bhEventosTeste: await exactCount('banco_horas_eventos', q => q.eq('tenant_id', PROD_TENANT_ID).eq('colaborador_id', colab.id)),
      bhSaldosReais: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).neq('colaborador_id', colab.id)),
      bhSaldosTeste: await exactCount('banco_horas_saldos', q => q.eq('tenant_id', PROD_TENANT_ID).eq('colaborador_id', colab.id)),
      fechamentoMensal: await exactCount('fechamento_mensal', q => q.eq('tenant_id', PROD_TENANT_ID)),
    };
    console.table(countsDepois);

    // 12. Comparativo de Variação de Segurança
    console.log('\n--- COMPROVAÇÃO DE ISOLAMENTO (DELTA ANTES × DEPOIS) ---');
    const deltas = {
      colaboradoresReais: countsDepois.colaboradoresReais - countsAntes.colaboradoresReais,
      pontosReais: countsDepois.pontosReais - countsAntes.pontosReais,
      bhEventosReais: countsDepois.bhEventosReais - countsAntes.bhEventosReais,
      bhSaldosReais: countsDepois.bhSaldosReais - countsAntes.bhSaldosReais,
      fechamentoMensal: countsDepois.fechamentoMensal - countsAntes.fechamentoMensal,
      bhEventosTeste: countsDepois.bhEventosTeste - countsAntes.bhEventosTeste,
      bhSaldosTeste: countsDepois.bhSaldosTeste - countsAntes.bhSaldosTeste,
    };
    console.table(deltas);

    expect(deltas.colaboradoresReais).toBe(0);
    expect(deltas.pontosReais).toBe(0);
    expect(deltas.bhEventosReais).toBe(0);
    expect(deltas.bhSaldosReais).toBe(0);
    expect(deltas.fechamentoMensal).toBe(0);

    // 13. Tabela Resumo Final
    console.log('\n--- TABELA RESUMO DOS CENÁRIOS PROCESSADOS ---');
    console.table(relatorioCenarios);
  }, 60000);
});
