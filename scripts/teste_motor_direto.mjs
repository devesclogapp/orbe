import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://lifgjtcflzmspilhryap.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.log("Missing key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const competencia = '2026-06-01'; // Ajustado para formato date da faturas DB
    const empresaId = 'df3b197e-0330-4c7a-b685-1ac0347bb751';
    const tenantId = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

    console.log(`Buscando operações para ${empresaId} em ${competencia}...`);
    const { data: operacoes, error } = await supabase
        .from('operacoes_producao')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data_operacao', '2026-06-01')
        .lt('data_operacao', '2026-07-01');

    console.log("Ops count:", operacoes?.length);

    // Instead of running the full UI, the user asked to check if the record propagates.
    // The UI is already wired up to `processarFechamento(competencia, empresaId, tenantId)`.
    // The user says "Executar novamente o fluxo.... Validação SQL". Let's run the backend loop logic!
}

run();
