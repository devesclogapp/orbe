import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const authRes = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });
  if (authRes.error) {
    console.error("Auth error:", authRes.error);
    process.exit(1);
  }

  // Obter tenant_id do usuário logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', authRes.data.user.id)
    .single();

  const tenantId = profile?.tenant_id;
  console.log(`Auditoria Tenant: ${tenantId}`);

  // 1. banco_horas_regras (total e por tenant)
  const { count: regrasTotal } = await supabase
    .from('banco_horas_regras')
    .select('id', { count: 'exact', head: true });

  const { count: regrasTenant } = await supabase
    .from('banco_horas_regras')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Listar registros existentes em banco_horas_regras
  const { data: regrasRows } = await supabase
    .from('banco_horas_regras')
    .select('*');

  // 2. jornadas_trabalho
  const { count: jornadasTotal } = await supabase
    .from('jornadas_trabalho')
    .select('id', { count: 'exact', head: true });

  const { count: jornadasTenant } = await supabase
    .from('jornadas_trabalho')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // 3. colaboradores com jornada_id
  const { count: colabComJornada } = await supabase
    .from('colaboradores')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('jornada_id', 'is', null);

  const { count: colabTotal } = await supabase
    .from('colaboradores')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // 4. banco_horas_eventos
  const { count: eventosTotal } = await supabase
    .from('banco_horas_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // 5. banco_horas_saldos
  const { count: saldosTotal } = await supabase
    .from('banco_horas_saldos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // 6. registros_ponto PROCESSADO
  const { count: pontosProcessados } = await supabase
    .from('registros_ponto')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status_processamento', ['PROCESSADO', 'processado']);

  const { count: pontosPendentes } = await supabase
    .from('registros_ponto')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status_processamento', ['PENDENTE', 'pendente', 'PENDENTE_PROCESSAMENTO']);

  const { count: pontosInconsistentes } = await supabase
    .from('registros_ponto')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status_processamento', ['INCONSISTENTE', 'inconsistente']);

  const { count: pontosTotal } = await supabase
    .from('registros_ponto')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  console.log("=== CONTAGEM EXATA DE PRODUÇÃO / TENANT ===");
  console.log(`banco_horas_regras: Total=${regrasTotal}, Tenant=${regrasTenant}`);
  console.log(`Registros em banco_horas_regras:`, JSON.stringify(regrasRows, null, 2));
  console.log(`jornadas_trabalho: Total=${jornadasTotal}, Tenant=${jornadasTenant}`);
  console.log(`colaboradores: Total=${colabTotal}, Com jornada_id=${colabComJornada}`);
  console.log(`banco_horas_eventos: Tenant=${eventosTotal}`);
  console.log(`banco_horas_saldos: Tenant=${saldosTotal}`);
  console.log(`registros_ponto: Total=${pontosTotal}, Processados=${pontosProcessados}, Pendentes=${pontosPendentes}, Inconsistentes=${pontosInconsistentes}`);
}

run().catch(console.error);
