import { getE2EContext } from './utils/e2e-guard.ts';
import fs from 'fs';

async function run() {
    const { supabase, tenantId } = await getE2EContext();

    console.log("Buscando evidência B...");
    const { data: badLancamentos } = await supabase.from('lancamentos_intermitentes')
        .select('nome_colaborador, empresa_id, status_pipeline, observacoes')
        .eq('nome_colaborador', 'INTERMITENTE BAD')
        .order('created_at', { ascending: false })
        .limit(1);
    
    console.log("Registro rejeitado:", JSON.stringify(badLancamentos, null, 2));

    const { count } = await supabase.from('empresas')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .ilike('nome', '%Dept (Teste)%');
    
    console.log("Contagem de empresas novas fantasma geradas com nome sujo:", count);

    // Salva arquivo com output exato para provar
    fs.writeFileSync('evidencia_b.txt', `Registro rejeitado: ${JSON.stringify(badLancamentos)} \nContagem empresas novas: ${count}`);
}
run().catch(console.error);
