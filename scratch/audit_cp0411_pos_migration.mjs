import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runAudit() {
  const authRes = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });
  if (authRes.error) {
    console.error("Auth error:", authRes.error);
    process.exit(1);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', authRes.data.user.id)
    .single();

  const tenantId = profile?.tenant_id;
  console.log(`Auditoria Tenant: ${tenantId}`);

  // Teste direto de schema via PostgREST
  console.log("\n=================== 1. TESTE POSTGREST DIRETO NAS TABELAS E COLUNAS ===================");
  
  // A. jornadas_trabalho
  const resJornadas = await supabase
    .from('jornadas_trabalho')
    .select('id, tenant_id, empresa_id, nome, tipo_escala, carga_semanal_minutos, grade_semanal, politica_feriado, vigencia_inicio, vigencia_fim, padrao, status, created_at, updated_at')
    .limit(1);
  console.log("jornadas_trabalho select status:", { error: resJornadas.error, countData: resJornadas.data?.length });

  // B. colaboradores.jornada_id
  const resColab = await supabase
    .from('colaboradores')
    .select('id, nome, jornada_id')
    .limit(1);
  console.log("colaboradores.jornada_id select status:", { error: resColab.error, countData: resColab.data?.length });

  // C. registros_ponto_regularizacoes
  const resRegPonto = await supabase
    .from('registros_ponto_regularizacoes')
    .select('id, tenant_id, registro_ponto_id, colaborador_id, data, campo_alterado, valor_original, valor_regularizado, justificativa, executado_por, executado_por_nome, ativo, substituido_por, created_at, updated_at')
    .limit(1);
  console.log("registros_ponto_regularizacoes select status:", { error: resRegPonto.error, countData: resRegPonto.data?.length });

  // D. banco_horas_regras novas colunas
  const resBHRegras = await supabase
    .from('banco_horas_regras')
    .select('id, nome, vigencia_inicio, vigencia_fim, adicional_hora_extra_percentual, carga_horaria_diaria, tolerancia_atraso, tolerancia_hora_extra, limite_diario_banco')
    .limit(1);
  console.log("banco_horas_regras novas colunas select status:", { error: resBHRegras.error, countData: resBHRegras.data?.length });

  // RPC SQL check
  console.log("\n=================== 2. RPC SQL QUERY TEST ===================");
  const sqlRes = await supabase.rpc('execute_sql_query', {
    sql_query: "SELECT to_regclass('public.jornadas_trabalho')::text as t1, to_regclass('public.registros_ponto_regularizacoes')::text as t2;"
  });
  console.log("execute_sql_query resultado:", sqlRes);

  console.log("\n=================== 3. CONTAGENS EXATAS ===================");
  const { count: countColaboradores } = await supabase.from('colaboradores').select('id', { count: 'exact', head: true });
  const { count: countColabComJornada } = await supabase.from('colaboradores').select('id', { count: 'exact', head: true }).not('jornada_id', 'is', null);

  const { count: countPontosTotal } = await supabase.from('registros_ponto').select('id', { count: 'exact', head: true });
  const { count: countPontosProcessados } = await supabase.from('registros_ponto').select('id', { count: 'exact', head: true }).in('status_processamento', ['PROCESSADO', 'processado']);
  const { count: countPontosPendentes } = await supabase.from('registros_ponto').select('id', { count: 'exact', head: true }).in('status_processamento', ['PENDENTE', 'pendente', 'PENDENTE_PROCESSAMENTO']);

  const { count: countJornadas } = await supabase.from('jornadas_trabalho').select('id', { count: 'exact', head: true });
  const { count: countRegularizacoes } = await supabase.from('registros_ponto_regularizacoes').select('id', { count: 'exact', head: true });
  const { count: countBHRegras } = await supabase.from('banco_horas_regras').select('id', { count: 'exact', head: true });
  const { count: countBHEventos } = await supabase.from('banco_horas_eventos').select('id', { count: 'exact', head: true });
  const { count: countBHSaldos } = await supabase.from('banco_horas_saldos').select('id', { count: 'exact', head: true });

  console.log({
    countColaboradores,
    countColabComJornada,
    countPontosTotal,
    countPontosProcessados,
    countPontosPendentes,
    countJornadas,
    countRegularizacoes,
    countBHRegras,
    countBHEventos,
    countBHSaldos,
  });
}

runAudit().catch(console.error);
