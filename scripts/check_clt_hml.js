import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("=== VERIFICANDO DADOS HML e REAIS ===");

    // 1. Procurar Colaboradores HML
    const { data: hmlColabs, error: hmlColabErr } = await supabase
        .from('colaboradores')
        .select('id, nome, cpf, matricula, empresa_id')
        .like('nome', '%CLT-HML-%');

    console.log("Colaboradores HML Encontrados:", hmlColabs?.length || 0);
    console.dir(hmlColabs);

    if (hmlColabs && hmlColabs.length > 0) {
        const empresaId = hmlColabs[0].empresa_id;
        const { data: emp, error: empErr } = await supabase
            .from('empresas')
            .select('nome')
            .eq('id', empresaId)
            .single();
        console.log("Empresa dos Colaboradores HML:", emp?.nome);
    }

    // 2. Procurar Registros de Ponto ou Eventos para não-HML alterados hoje (se houver, apenas leitura por enquanto)
    const today = new Date().toISOString().split('T')[0];

    // Verificando processos em andamento para a empresa de homologação vs reais
    const { data: processosHoje, error: procErr } = await supabase
        .from('processamentos_rh')
        .select('id, empresa_id, status, created_at')
        .gte('created_at', today);

    console.log("Processamentos RH iniciados hoje:", processosHoje?.length || 0);
    console.dir(processosHoje);

    console.log("\n=== CONCLUÍDO ===");
}

run();
