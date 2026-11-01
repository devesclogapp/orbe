import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

const url = env['VITE_SUPABASE_URL'];
const key = env['VITE_SUPABASE_ANON_KEY'];
const email = env['E2E_TEST_EMAIL'];
const pass = env['E2E_TEST_PASSWORD'];

const supabase = createClient(url, key);

async function test() {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (authErr) {
        console.error('Auth error:', authErr);
        return;
    }
    console.log('Logged in as:', auth.user.email, 'ID:', auth.user.id);

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', auth.user.id).single();
    const tenantId = profile?.tenant_id;
    console.log('Tenant:', tenantId);

    const { data: empresas, error: empErr } = await supabase.from('empresas').select('id, nome').eq('tenant_id', tenantId);
    console.log('Empresas count:', empresas?.length, empErr || '');
    if (empresas) {
        for (const e of empresas) {
            console.log(`Empresa: [${e.id}] ${e.nome}`);
        }
    }

    // Now test queries for competencia 2026-10 or 2026-09
    const competencias = ['2026-10', '2026-09', '2026-05', '2026-04'];
    for (const comp of competencias) {
        console.log(`\n=== TESTANDO COMPETENCIA ${comp} ===`);
        const [year, month] = comp.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
        const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];

        for (const emp of empresas || []) {
            console.log(`\n-> Verificando Empresa [${emp.nome}] (${emp.id})`);

            // 1. registros_ponto
            const q1 = await supabase
                .from("registros_ponto")
                .select("id, tenant_id, empresa_id, colaborador_id, nome_colaborador, data, status_processamento, jornada_calculada, valor_hora_extra, valor_atraso, valor_falta, minutos_extra, minutos_atraso, horas_extras_detalhadas")
                .eq("tenant_id", tenantId)
                .eq("empresa_id", emp.id)
                .gte("data", startDate)
                .lte("data", endDate);
            if (q1.error) console.error('  [Q1 registros_ponto ERROR]:', q1.error);
            else if (q1.data?.length > 0) console.log(`  Q1 registros_ponto: ${q1.data.length} registros`);

            // 2. colaboradores
            const q2 = await supabase
                .from("colaboradores")
                .select("id, nome, status, status_cadastro, cadastro_provisorio, tipo_colaborador, empresa_id, valor_hora, salario_base, valor_base, valor_diaria, modelo_calculo, tipo_contrato, gera_faturamento, jornada_id")
                .eq("tenant_id", tenantId)
                .eq("empresa_id", emp.id);
            if (q2.error) console.error('  [Q2 colaboradores ERROR]:', q2.error);
            else if (q2.data?.length > 0) console.log(`  Q2 colaboradores: ${q2.data.length} registros`);

            // 3. processamento_rh_inconsistencias
            const q3 = await supabase
                .from("processamento_rh_inconsistencias")
                .select("id, registro_ponto_id, colaborador_id, tipo, descricao, status, resolvida, created_at")
                .eq("tenant_id", tenantId)
                .eq("empresa_id", emp.id)
                .gte("created_at", `${startDate}T00:00:00.000Z`)
                .lte("created_at", `${endDate}T23:59:59.999Z`);
            if (q3.error) console.error('  [Q3 processamento_rh_inconsistencias ERROR]:', q3.error);
            else if (q3.data?.length > 0) console.log(`  Q3 inconsistencias: ${q3.data.length} registros`);

            // 4. processamento_rh_logs
            const q4 = await supabase
                .from("processamento_rh_logs")
                .select("id, tipo_execucao, total_processados, total_inconsistencias, executado_em")
                .eq("tenant_id", tenantId)
                .eq("empresa_id", emp.id)
                .eq("periodo_ano", year)
                .eq("periodo_mes", month)
                .order("executado_em", { ascending: false });
            if (q4.error) console.error('  [Q4 processamento_rh_logs ERROR]:', q4.error);
            else if (q4.data?.length > 0) console.log(`  Q4 logs: ${q4.data.length} registros`);

            // 5. banco_horas_regras
            const q5 = await supabase
                .from("banco_horas_regras")
                .select("id, nome, adicional_hora_extra_percentual, ativo, empresa_id, tenant_id")
                .eq("tenant_id", tenantId);
            if (q5.error) console.error('  [Q5 banco_horas_regras ERROR]:', q5.error);

            // 6. custos_extras_operacionais
            const q6 = await supabase
                .from("custos_extras_operacionais")
                .select("id, data, status_pagamento, pipeline_status")
                .eq("tenant_id", tenantId)
                .eq("empresa_id", emp.id)
                .gte("data", startDate)
                .lte("data", endDate);
            if (q6.error) console.error('  [Q6 custos_extras_operacionais ERROR]:', q6.error);

            // 7. servicos_extras_operacionais
            const q7 = await supabase
                .from("servicos_extras_operacionais")
                .select("id, data, pipeline_status")
                .eq("empresa_id", emp.id)
                .gte("data", startDate)
                .lte("data", endDate);
            if (q7.error) console.error('  [Q7 servicos_extras_operacionais ERROR]:', q7.error);

            // 8. banco_horas_eventos
            const q8 = await supabase
                .from("banco_horas_eventos")
                .select("id, colaborador_id, empresa_id, tipo_evento, tipo, minutos, quantidade_minutos, descricao, data_evento, created_at, reflexo_financeiro_pendente, status")
                .eq("tenant_id", tenantId)
                .eq("empresa_id", emp.id)
                .eq("reflexo_financeiro_pendente", true)
                .gte("data_evento", startDate)
                .lte("data_evento", endDate);
            if (q8.error) console.error('  [Q8 banco_horas_eventos ERROR]:', q8.error);

            // 9. rh_financeiro_lotes
            const q9 = await supabase
                .from("rh_financeiro_lotes")
                .select("empresa_id, status")
                .eq("competencia", comp)
                .eq("origem", "RH");
            if (q9.error) console.error('  [Q9 rh_financeiro_lotes ERROR]:', q9.error);
        }
        break; // test only first competencia initially
    }
}

test().catch(console.error);
