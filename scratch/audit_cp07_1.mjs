import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('=== AUDITORIA READ-ONLY CP07.1 ===');
  
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });

  if (authErr || !authData.user) {
    console.error('Falha na autenticação:', authErr);
    process.exit(1);
  }
  console.log(`[AUTH] Conectado: ${authData.user.email}`);

  const colabId = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  // 1. Colaborador
  const { data: colab, error: colabErr } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('id', colabId)
    .single();

  console.log('\n[COLABORADOR HML]');
  console.log({
    id: colab?.id,
    nome: colab?.nome,
    matricula: colab?.matricula,
    salario_base: colab?.salario_base,
    valor_base: colab?.valor_base,
    modelo_calculo: colab?.modelo_calculo,
    tipo_contrato: colab?.tipo_contrato,
    status: colab?.status,
    gera_faturamento: colab?.gera_faturamento,
    is_teste: colab?.is_teste,
    regra_banco_horas_id: colab?.regra_banco_horas_id,
    jornada_trabalho_id: colab?.jornada_trabalho_id,
  });

  // 2. Pontos HML
  const { data: pontos, error: pontosErr } = await supabase
    .from('registros_ponto')
    .select('*')
    .eq('colaborador_id', colabId)
    .order('data', { ascending: true });

  console.log('\n[PONTOS HML]');
  if (pontosErr) console.error('PONTOS ERROR:', pontosErr);
  console.log(`Pontos count: ${pontos?.length}`);
  let totalMinutosExtra = 0;
  let totalValorHE = 0;
  console.log('\n[COLUMNS OF REGISTROS_PONTO]', Object.keys(pontos[0] || {}));
  console.log('\n[C4 (2026-10-06)]', pontos.find(p => p.data === '2026-10-06'));
  console.log('\n[C9 (2026-10-11)]', pontos.find(p => p.data === '2026-10-11'));
  console.log(`TOTAL MINUTOS EXTRA: ${totalMinutosExtra} (${totalMinutosExtra / 60}h) | TOTAL VALOR HE: R$ ${totalValorHE.toFixed(2)}`);

  // 3. Regra de BH
  if (colab?.regra_banco_horas_id) {
    const { data: regra } = await supabase
      .from('banco_horas_regras')
      .select('*')
      .eq('id', colab.regra_banco_horas_id)
      .single();
    console.log('\n[REGRA BH VINCULADA]', {
      id: regra?.id,
      nome: regra?.nome,
      limite_mensal_horas: regra?.limite_mensal_horas,
      limite_diario_minutos: regra?.limite_diario_minutos,
      adicional_hora_extra_percentual: regra?.adicional_hora_extra_percentual,
      vigencia_inicio: regra?.vigencia_inicio,
      vigencia_fim: regra?.vigencia_fim,
      ativo: regra?.ativo,
    });
  }

  // 6. Testar validação da competência 2026-10 para a sandbox
  const { data: inconsistencias } = await supabase
    .from('processamento_rh_inconsistencias')
    .select('*')
    .eq('empresa_id', empresaId);
  console.log('\n[INCONSISTÊNCIAS RH DA EMPRESA HML]', inconsistencias);

  const { data: custosExtras } = await supabase
    .from('custos_extras_operacionais')
    .select('id, data, status_pagamento, pipeline_status')
    .eq('empresa_id', empresaId);
  console.log('\n[CUSTOS EXTRAS DA EMPRESA HML]', custosExtras);

  // 7. Verificar campos cadastrais de CLT-HML-001
  console.log('\n[CADASTRO COMPLETO CLT-HML-001]', {
    status_cadastro: colab?.status_cadastro,
    cadastro_provisorio: colab?.cadastro_provisorio,
    banco_codigo: colab?.banco_codigo,
    banco_agencia: colab?.banco_agencia,
    banco_conta: colab?.banco_conta,
    cpf: colab?.cpf,
    valor_base: colab?.valor_base,
    salario_base: colab?.salario_base,
    modelo_calculo: colab?.modelo_calculo,
    tipo_contrato: colab?.tipo_contrato,
    gera_faturamento: colab?.gera_faturamento,
    status: colab?.status,
  });
}

main().catch(console.error);
