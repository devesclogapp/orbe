import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing env vars");
const supabase = createClient(url, key);

async function checkDuplicates() {
    console.log("Checking financeiro_consolidados_cliente...");
    const { data: c1 } = await supabase.from('financeiro_consolidados_cliente').select('*');
    if (!c1) return console.log("Failed to fetch financeiro_consolidados_cliente");
    
    // Group by keys
    const groups: Record<string, any[]> = {};
    for (const row of c1) {
        const key = `${row.tenant_id}-${row.empresa_id}-${row.cliente_id}-${row.competencia}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }
    const dupes1 = Object.values(groups).filter(g => g.length > 1);
    console.log(`Duplicates in financeiro_consolidados_cliente: ${dupes1.length}`);
    
    console.log("Checking financeiro_consolidados_colaborador...");
    const { data: c2 } = await supabase.from('financeiro_consolidados_colaborador').select('*');
    if (!c2) return console.log("Failed to fetch financeiro_consolidados_colaborador");
    
    const groups2: Record<string, any[]> = {};
    for (const row of c2) {
        const key = `${row.tenant_id}-${row.empresa_id}-${row.colaborador_id}-${row.competencia}`;
        if (!groups2[key]) groups2[key] = [];
        groups2[key].push(row);
    }
    const dupes2 = Object.values(groups2).filter(g => g.length > 1);
    console.log(`Duplicates in financeiro_consolidados_colaborador: ${dupes2.length}`);

    console.log("Checking faturas...");
    const { data: c3 } = await supabase.from('faturas').select('*');
    if (c3) {
        const groups3: Record<string, any[]> = {};
        for (const row of c3) {
            const key = `${row.tenant_id}-${row.empresa_id}-${row.cliente_id}-${row.competencia}`;
            if (!groups3[key]) groups3[key] = [];
            groups3[key].push(row);
        }
        const dupes3 = Object.values(groups3).filter(g => g.length > 1);
        console.log(`Duplicates in faturas: ${dupes3.length}`);
    }
}

checkDuplicates().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
