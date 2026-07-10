import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("=== INICIANDO AUDITORIA E LIMPEZA ===");

    // 1. Procurar empresa HML
    const { data: empHml } = await supabase.from('empresas').select('id, nome').ilike('nome', '%HOMOLOGA%').single();
    if (!empHml) {
        console.log("ERRO: Empresa de HOMLOGACAO não encontrada.");
        return;
    }
    const empId = empHml.id;
    console.log(`Empresa HML Encontrada: ${empHml.nome} (${empId})`);

    // 2. Colabs HML
    const { data: colabsHml } = await supabase.from('colaboradores').select('id, nome, cpf, matricula').eq('empresa_id', empId);
    console.log(`Colaboradores HML Encontrados: ${colabsHml?.length || 0}`);

    // 3. Deletar registros reais ou testes feitos hoje que NÃO são da empresa HML
    const today = new Date().toISOString().split('T')[0];

    const { data: regsHoje } = await supabase.from('registros_ponto').select('id, empresa_id').gte('created_at', today);
    console.log(`Total de registros ponto criados hoje: ${regsHoje?.length || 0}`);

    if (regsHoje && regsHoje.length > 0) {
        let reais = regsHoje.filter(r => r.empresa_id !== empId);
        console.log(`Registros NÃO-HML (possíveis interferências reais): ${reais.length}`);

        if (reais.length > 0) {
            console.log("Deletando registros reais modificados acidentalmente via UI...");
            const idsReais = reais.map(r => r.id);
            const { error: delErr } = await supabase.from('registros_ponto').delete().in('id', idsReais);
            if (delErr) {
                console.log("Erro ao deletar registros reais:", delErr);
            } else {
                console.log("Sucesso ao deletar registros reais não-hml.");
            }
        }
    }

    // 4. Esvaziar base para a HML, permitindo refazer o fluxo "do zero"
    console.log("Limpando registros HML de testes anteriores para começar do zero (modo limpo)...");

    await supabase.from('registros_ponto').delete().eq('empresa_id', empId);
    console.log("registros_ponto HML limpos.");

    await supabase.from('banco_horas_eventos').delete().eq('empresa_id', empId);
    console.log("banco_horas_eventos HML limpos.");

    await supabase.from('banco_horas_saldos').delete().eq('empresa_id', empId);
    console.log("banco_horas_saldos HML limpos.");

    await supabase.from('processamentos_rh').delete().eq('empresa_id', empId);
    console.log("processamentos_rh HML limpos.");

    await supabase.from('lotes_rh_financeiro').delete().eq('empresa_id', empId);
    console.log("lotes_rh_financeiro HML limpos.");

    console.log("=== AUDITORIA CONCLUÍDA ===");
}

run();
