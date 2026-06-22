import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role to bypass RLS and see what really fails on the query constraints
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.log("Missing key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("=== ETAPA 2 / 3 / 6: LOG DA DATABASE ===\n");
    const competencia = '2026-06-01'; // Faturas
    const cmp = '2026-06';

    // 6. Verificar ciclos aprovados
    const { data: ciclos } = await supabase.from('ciclos_operacionais').select('id, status, status_financeiro, empresa_id').order('criado_em', { ascending: false }).limit(20);
    console.log("Ciclos (últimos 3):", ciclos?.slice(0, 3));
    console.log("------------------------");

    // As operations in 2026-06
    const { data: ops } = await supabase
        .from('operacoes_producao')
        .select('id, transportadora_id, empresa_id')
        .gte('data_operacao', '2026-06-01')
        .lt('data_operacao', '2026-07-01');

    console.log("Operações em 2026-06:", ops?.length);
    const transpIds = Array.from(new Set(ops?.map(o => o.transportadora_id).filter(Boolean)));
    const empIds = Array.from(new Set(ops?.map(o => o.empresa_id).filter(Boolean)));
    console.log("Transportadoras nas Ops:", transpIds);
    console.log("------------------------");

    // 4. Mapear tabela clientes real
    const { data: clientes } = await supabase.from('clientes').select('*').limit(3);
    console.log("Tabela Clientes (raw):", clientes);
    console.log("------------------------");

    // 5. Verificar criação do espelho
    const { data: espelhos } = await supabase.from('clientes').select('id, nome').in('id', [...transpIds, ...empIds]);
    console.log("Clientes Espelho localizados por ID de Transportadora:", espelhos);
    console.log("------------------------");

    // 3. Ver insert chamado (já sabemos q nao foi pro DB na última UI, testando direct via query)
    const { data: consolidados } = await supabase.from('financeiro_consolidados_cliente').select('*');
    console.log("Consolidados Cliente total row count:", consolidados?.length);
}

run();
