import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '@/lib/supabase';
import {
  avaliarPontoGates,
  calculateCompensation,
} from '@/services/rhProcessing.service';
import { parseTimeToMinutes } from '@/services/operationalEngine/MarcacoesPontoParser';
import { JornadaTrabalho } from '@/types/jornada.types';

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
const EXPECTED_SANDBOX_COMPANY_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';

// C6: 08/10, C7: 09/10, C8: 04/10, C9: 11/10
const TARGET_DATES = ['2026-10-04', '2026-10-08', '2026-10-09', '2026-10-11'];

async function exactCount(table: string, filterFn?: (q: any) => any) {
  let query = (supabase as any).from(table).select('*', { count: 'exact', head: true });
  if (filterFn) query = filterFn(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

describe('CP06.5-B — E2E CLT | Homologação dos cenários excepcionais 6–9', () => {
  it('deve validar canonicamente os cenários 6 a 9 sem inferir marcações e sem alterar o saldo do Banco de Horas', async () => {
    console.log('=================================================================');
    console.log('CP06.5-B: HOMOLOGAÇÃO DOS CENÁRIOS EXCEPCIONAIS 6 A 9 (E2E CLT)');
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

    // 5. Contadores ANTES da execução
    console.log('\n--- CONTADORES ANTES DO PROCESSAMENTO CP06.5-B ---');
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

    // Validações de pré-condição herdadas do CP06.5-A
    expect(countsAntes.bhEventosTeste).toBe(4);
    expect(countsAntes.bhSaldosTeste).toBe(1);

    const { data: saldoAntes } = await (supabase as any)
      .from('banco_horas_saldos')
      .select('*')
      .eq('colaborador_id', colab.id)
      .single();
    expect(saldoAntes.saldo_atual_minutos).toBe(240); // +4h00

    // 6. Carregar estritamente os 4 pontos alvo
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
    expect(pontosAlvo.length).toBe(4);

    console.log(`\n[PONTOS] ${pontosAlvo.length} pontos identificados e isolados para avaliação.`);

    // 7. Execução Canônica Ponto por Ponto
    console.log('\n=================================================================');
    console.log('AVALIAÇÃO CANÔNICA DOS CENÁRIOS 6 A 9');
    console.log('=================================================================');

    const relatorioCenarios: any[] = [];

    for (const ponto of pontosAlvo) {
      console.log(`\n>>> Avaliando Ponto Data: ${ponto.data} (${ponto.observacoes}) <<<`);

      const gateResult = await avaliarPontoGates({
        tenantId: PROD_TENANT_ID,
        ponto,
        colaborador: colab,
        resolvedEmpresaId: EXPECTED_SANDBOX_COMPANY_ID,
        jornadasRuntime,
        regrasRuntime,
      });

      console.log(`Gate 1 (Cadastral): ${gateResult.passouCadastral ? 'APTO' : 'BLOQUEADO'}`);
      console.log(`Gate 2 (Jornada): ${gateResult.passouJornada ? 'APTO (' + gateResult.resolucaoJornada?.minutosPrevistos + ' min, trabalhável=' + gateResult.resolucaoJornada?.trabalhavel + ')' : 'BLOQUEADO'}`);
      console.log(`Gate 3 (Regra BH): ${gateResult.passouRegraBanco ? 'APTO (' + gateResult.regra?.nome + ')' : 'BLOQUEADO'}`);
      console.log(`Gate 4 (Marcações): ${gateResult.passouConsistenciaMarcacoes ? 'APTO' : 'BLOQUEADO'}`);
      console.log(`Tipo Avaliação Marcações: ${gateResult.avaliacaoMarcacoes?.tipo}`);
      console.log(`Motivo: ${gateResult.motivoBloqueio || 'Nenhum (calculável)'}`);

      const avaliacao = gateResult.avaliacaoMarcacoes!;
      const resolucaoJornada = gateResult.resolucaoJornada!;
      const regra = gateResult.regra!;

      if (ponto.data === '2026-10-08') {
        // ==========================================
        // CENÁRIO 6: MARCAÇÃO INCOMPLETA (08/10)
        // ==========================================
        expect(gateResult.passouCadastral).toBe(true);
        expect(gateResult.passouJornada).toBe(true);
        expect(gateResult.passouRegraBanco).toBe(true);
        expect(gateResult.passouConsistenciaMarcacoes).toBe(false);
        expect(gateResult.bloqueado).toBe(true);
        expect(avaliacao.tipo).toBe('MARCACAO_INCOMPLETA');
        expect(avaliacao.calculavel).toBe(false);
        expect(avaliacao.minutosTrabalhados).toBeNull();
        expect(avaliacao.quantidadeMarcacoes).toBe(3); // 3 batidas: 08:00, 12:00, 13:00 (sem batida de saída)

        // Confirmar que nenhuma saída foi inferida e que ponto NÃO foi computado como 240m ou qualquer outro valor fictício
        console.log(`✅ C6 confirmado: Gate 4 bloqueou. Tipo = MARCACAO_INCOMPLETA. Minutos = null (não inferiu saída).`);

        // Não alterar ponto, manter RECEBIDO
        relatorioCenarios.push({
          cenario: 'C6 — 08/10 — marcação incompleta',
          Gate1: 'APTO',
          Gate2: 'APTO',
          Gate3: 'APTO',
          Gate4: 'BLOQUEADO',
          Classificacao: avaliacao.tipo,
          TrabalhadoReconhecido: 'null (não inferido)',
          Previsto: `${resolucaoJornada.minutosPrevistos} min`,
          BHGerado: '0 min',
          HEGerada: '0 min',
          EventoBH: 'Nenhum',
          StatusFinal: ponto.status_processamento, // Permanece RECEBIDO
          EsperadoXObtido: 'CONFORME (Bloqueado -> Regularização RH)',
        });
      } else if (ponto.data === '2026-10-09') {
        // ==========================================
        // CENÁRIO 7: AUSÊNCIA EM DIA TRABALHÁVEL (09/10)
        // ==========================================
        expect(gateResult.passouCadastral).toBe(true);
        expect(gateResult.passouJornada).toBe(true);
        expect(gateResult.passouRegraBanco).toBe(true);
        expect(gateResult.passouConsistenciaMarcacoes).toBe(false);
        expect(gateResult.bloqueado).toBe(true);
        expect(avaliacao.tipo).toBe('FALTA_PENDENTE_JUSTIFICATIVA');
        expect(avaliacao.calculavel).toBe(false);
        expect(avaliacao.minutosTrabalhados).toBeNull();
        expect(avaliacao.quantidadeMarcacoes).toBe(0);

        // Confirmar que NÃO gerou débito automático cego (-480)
        console.log(`✅ C7 confirmado: Gate 4 bloqueou. Tipo = FALTA_PENDENTE_JUSTIFICATIVA. Zero débito automático.`);

        relatorioCenarios.push({
          cenario: 'C7 — 09/10 — ausência em dia trabalhável',
          Gate1: 'APTO',
          Gate2: 'APTO',
          Gate3: 'APTO',
          Gate4: 'BLOQUEADO',
          Classificacao: avaliacao.tipo,
          TrabalhadoReconhecido: 'null (ausência preservada)',
          Previsto: `${resolucaoJornada.minutosPrevistos} min`,
          BHGerado: '0 min',
          HEGerada: '0 min',
          EventoBH: 'Nenhum',
          StatusFinal: ponto.status_processamento, // Permanece RECEBIDO
          EsperadoXObtido: 'CONFORME (Bloqueado -> Tratamento RH)',
        });
      } else if (ponto.data === '2026-10-04') {
        // ==========================================
        // CENÁRIO 8: DSR SEM MARCAÇÃO (04/10)
        // ==========================================
        expect(gateResult.passouCadastral).toBe(true);
        expect(gateResult.passouJornada).toBe(true);
        expect(resolucaoJornada.trabalhavel).toBe(false);
        expect(resolucaoJornada.minutosPrevistos).toBe(0);
        expect(gateResult.passouRegraBanco).toBe(true);
        expect(gateResult.passouConsistenciaMarcacoes).toBe(true);
        expect(gateResult.bloqueado).toBe(false);
        expect(avaliacao.tipo).toBe('SEM_MARCACOES');
        expect(avaliacao.calculavel).toBe(true);
        expect(avaliacao.minutosTrabalhados).toBe(0);

        // Cálculo canônico para dia não trabalhável sem marcação
        const calculo = calculateCompensation({
          ponto,
          regra,
          colaborador: colab,
          minutosPrevistosJornada: resolucaoJornada.minutosPrevistos,
          avaliacaoMarcacoes: avaliacao,
          cargaSemanalMinutos: resolucaoJornada.cargaSemanalMinutos,
          isJornadaConfigurada: resolucaoJornada.temJornadaConfigurada,
        });

        expect(calculo.workedMinutes).toBe(0);
        expect(calculo.jornadaMinutes).toBe(0);
        expect(calculo.saldoDia).toBe(0);
        expect(calculo.minutosExtra).toBe(0);

        // Atualizar status do ponto para PROCESSADO (folga regular reconhecida legitimamente)
        const updatePayload = {
          status_processamento: 'PROCESSADO',
          processado_em: new Date().toISOString(),
          horas_calculadas: '0:00',
          saldo_dia: 0,
          saldo_acumulado_minutos: saldoAntes.saldo_atual_minutos, // Saldo BH permanece 240
          regra_aplicada: regra.nome,
          jornada_calculada: 0,
          minutos_extra: 0,
          status: 'Normal',
        };

        const { error: updErr } = await (supabase as any)
          .from('registros_ponto')
          .update(updatePayload)
          .eq('id', ponto.id)
          .eq('tenant_id', PROD_TENANT_ID);

        if (updErr) throw new Error(`Erro ao atualizar ponto C8: ${updErr.message}`);
        console.log(`✅ C8 confirmado: Reconhecido como DSR/Folga regular legítima. Saldo dia = 0. Processado sem inconsistência.`);

        relatorioCenarios.push({
          cenario: 'C8 — 04/10 — DSR sem marcação',
          Gate1: 'APTO',
          Gate2: 'APTO (0 min / DSR)',
          Gate3: 'APTO',
          Gate4: 'APTO (SEM_MARCACOES)',
          Classificacao: avaliacao.tipo,
          TrabalhadoReconhecido: '0 min',
          Previsto: '0 min (DSR)',
          BHGerado: '0 min',
          HEGerada: '0 min',
          EventoBH: 'Nenhum',
          StatusFinal: 'PROCESSADO',
          EsperadoXObtido: 'CONFORME (Folga Regular Reconhecida)',
        });
      } else if (ponto.data === '2026-10-11') {
        // ==========================================
        // CENÁRIO 9: TRABALHO EM DSR (11/10)
        // ==========================================
        expect(gateResult.passouCadastral).toBe(true);
        expect(gateResult.passouJornada).toBe(true);
        expect(resolucaoJornada.trabalhavel).toBe(false);
        expect(resolucaoJornada.minutosPrevistos).toBe(0);
        expect(gateResult.passouRegraBanco).toBe(true);
        expect(gateResult.passouConsistenciaMarcacoes).toBe(false);
        expect(gateResult.bloqueado).toBe(true);
        expect(avaliacao.tipo).toBe('TRABALHO_EM_DIA_NAO_TRABALHAVEL');
        expect(avaliacao.calculavel).toBe(false);
        expect(avaliacao.minutosTrabalhados).toBeNull();
        expect(avaliacao.quantidadeMarcacoes).toBe(4);

        // Confirmar preservação das 4 batidas e minutos efetivos (480m)
        const punches = avaliacao.marcacoesPreservadas;
        expect(punches.length).toBe(4);
        const mE1 = parseTimeToMinutes(punches[0].valor)!;
        const mS1 = parseTimeToMinutes(punches[1].valor)!;
        const mE2 = parseTimeToMinutes(punches[2].valor)!;
        const mS2 = parseTimeToMinutes(punches[3].valor)!;
        const minutosMarcados = (mS1 - mE1) + (mS2 - mE2);
        expect(minutosMarcados).toBe(480);

        console.log(`✅ C9 confirmado: Gate 4 bloqueou processamento automático. 480 min marcados preservados. Retido para decisão RH.`);

        relatorioCenarios.push({
          cenario: 'C9 — 11/10 — trabalho em DSR',
          Gate1: 'APTO',
          Gate2: 'APTO (0 min / DSR)',
          Gate3: 'APTO',
          Gate4: 'BLOQUEADO',
          Classificacao: avaliacao.tipo,
          TrabalhadoReconhecido: '480 min preservados (bloqueado p/ cálculo)',
          Previsto: '0 min (DSR)',
          BHGerado: '0 min',
          HEGerada: '0 min',
          EventoBH: 'Nenhum',
          StatusFinal: ponto.status_processamento, // Permanece RECEBIDO
          EsperadoXObtido: 'CONFORME (Bloqueado -> Decisão RH)',
        });
      }
    }

    // 8. Auditoria de Banco de Horas Pós-Execução
    console.log('\n=================================================================');
    console.log('AUDITORIA DE PERSISTÊNCIA EM BANCO_HORAS_EVENTOS E SALDOS');
    console.log('=================================================================');

    const { data: eventosPersistidos } = await (supabase as any)
      .from('banco_horas_eventos')
      .select('*')
      .eq('colaborador_id', colab.id)
      .order('data', { ascending: true });

    console.log('\nEventos gravados na tabela banco_horas_eventos (devem ser exatamente os 4 de C2 a C5):');
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

    // Deve permanecer exatamente 4 eventos (zero eventos gerados por C6, C7, C8 e C9)
    expect(eventosPersistidos?.length).toBe(4);

    const { data: saldoDb } = await (supabase as any)
      .from('banco_horas_saldos')
      .select('*')
      .eq('colaborador_id', colab.id)
      .single();

    console.log('\nSaldo gravado na tabela banco_horas_saldos (deve permanecer inalterado em +240 min):');
    console.log({
      colaborador_id: saldoDb.colaborador_id,
      saldo_atual_minutos: `${saldoDb.saldo_atual_minutos} min (${Math.floor(saldoDb.saldo_atual_minutos / 60)}h${String(Math.abs(saldoDb.saldo_atual_minutos) % 60).padStart(2, '0')})`,
      horas_positivas_minutos: `${saldoDb.horas_positivas_minutos} min`,
      horas_negativas_minutos: `${saldoDb.horas_negativas_minutos} min`,
      ultima_movimentacao: saldoDb.ultima_movimentacao,
    });

    // Saldo do colaborador deve permanecer exatamente 240 minutos
    expect(saldoDb.saldo_atual_minutos).toBe(240);
    expect(saldoDb.horas_positivas_minutos).toBe(300);
    expect(saldoDb.horas_negativas_minutos).toBe(60);

    // 9. Contadores DEPOIS da execução
    console.log('\n--- CONTADORES DEPOIS DO PROCESSAMENTO CP06.5-B ---');
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

    // 10. Deltas e Comprovação de Isolamento
    const deltas = {
      colaboradoresReais: countsDepois.colaboradoresReais - countsAntes.colaboradoresReais,
      pontosReais: countsDepois.pontosReais - countsAntes.pontosReais,
      bhEventosReais: countsDepois.bhEventosReais - countsAntes.bhEventosReais,
      bhSaldosReais: countsDepois.bhSaldosReais - countsAntes.bhSaldosReais,
      fechamentoMensal: countsDepois.fechamentoMensal - countsAntes.fechamentoMensal,
      bhEventosTeste: countsDepois.bhEventosTeste - countsAntes.bhEventosTeste,
      bhSaldosTeste: countsDepois.bhSaldosTeste - countsAntes.bhSaldosTeste,
    };
    console.log('\n--- DELTAS DE SEGURANÇA E ISOLAMENTO ---');
    console.table(deltas);

    expect(deltas.colaboradoresReais).toBe(0);
    expect(deltas.pontosReais).toBe(0);
    expect(deltas.bhEventosReais).toBe(0);
    expect(deltas.bhSaldosReais).toBe(0);
    expect(deltas.fechamentoMensal).toBe(0);
    expect(deltas.bhEventosTeste).toBe(0);
    expect(deltas.bhSaldosTeste).toBe(0);

    // 11. Tabela Resumo Final
    console.log('\n--- TABELA RESUMO DOS CENÁRIOS 6 A 9 ---');
    console.table(relatorioCenarios);
  }, 60000);
});
