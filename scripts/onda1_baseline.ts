import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
);

async function runBaseline() {
    console.log("Iniciando baseline financeiro da Onda 1...");

    // 1. Obter empresas de teste
    const { data: testEmpresas } = await supabase.from('empresas').select('id').eq('is_teste', true);
    const testIds = testEmpresas?.map(e => e.id) || [];
    const safeTestIds = testIds.length > 0 ? testIds : ['00000000-0000-0000-0000-000000000000'];

    const getStats = async (isHml) => {
        let stats = {};

        // Lotes RH
        let lotesQ = supabase.from('rh_financeiro_lotes').select('id, valor_total', { count: 'exact' });
        if (isHml) lotesQ = lotesQ.in('empresa_id', safeTestIds);
        else lotesQ = lotesQ.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);

        const startLotes = performance.now();
        const lotes = await lotesQ;
        const lotesTotal = lotes.data?.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0) || 0;
        stats.lotesTime = (performance.now() - startLotes).toFixed(2);
        stats.lotesCount = lotes.count || lotes.data?.length || 0;
        stats.lotesValor = lotesTotal.toFixed(2);

        // Lotes itens
        let itensQ = supabase.from('rh_financeiro_lote_itens').select('id, valor_calculado', { count: 'exact' });
        // Since lote items link to lote which links to empresa, querying them safely requires joining lote or if they don't have empresa_id, we just get total?
        // Wait, lote_itens don't have empresa_id? They have tenant_id. Let's just run Lotes.
        
        // Remessas CNAB
        let remessaQ = supabase.from('cnab_remessa').select('id, valor_total', { count: 'exact' });
        if (isHml) remessaQ = remessaQ.in('empresa_id', safeTestIds);
        else remessaQ = remessaQ.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);
        const remessas = await remessaQ;
        stats.remessaCount = remessas.count || remessas.data?.length || 0;
        stats.remessaValor = (remessas.data?.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0) || 0).toFixed(2);

        // Retornos CNAB (If they have empresa_id)
        let retornoQ = supabase.from('cnab_retorno_arquivos').select('id', { count: 'exact' });
        if (isHml) retornoQ = retornoQ.in('empresa_id', safeTestIds);
        else retornoQ = retornoQ.or(`empresa_id.not.in.(${safeTestIds.join(',')}),empresa_id.is.null`);
        const retornos = await retornoQ;
        stats.retornosCount = retornos.count || retornos.data?.length || 0;

        return stats;
    };

    const hmlStats = await getStats(true);
    const prodStats = await getStats(false);

    const report = `# Sprint: ONDA 1 - Baseline Financeiro
Gerado em: ${new Date().toISOString()}

O cache do baseline isola e calcula baseado puramente nos filtros SQL consolidados (IN safeTestIds vs NOT IN safeTestIds).

## STATUS DE HOMOLOGAÇÃO
* Quantidade de Lotes RH: ${hmlStats.lotesCount}
* Valor Total (Lotes): R$ ${hmlStats.lotesValor}
* Quantidade de Remessas (CNAB): ${hmlStats.remessaCount}
* Valor de Remessas: R$ ${hmlStats.remessaValor}
* Quantidade de Arquivos de Retorno: ${hmlStats.retornosCount}
* Tempo médio de consulta (Lotes): ${hmlStats.lotesTime}ms

## STATUS DE PRODUÇÃO
* Quantidade de Lotes RH: ${prodStats.lotesCount}
* Valor Total (Lotes): R$ ${prodStats.lotesValor}
* Quantidade de Remessas (CNAB): ${prodStats.remessaCount}
* Valor de Remessas: R$ ${prodStats.remessaValor}
* Quantidade de Arquivos de Retorno: ${prodStats.retornosCount}
* Tempo médio de consulta (Lotes): ${prodStats.lotesTime}ms
`;

    const outPath = path.resolve('.agent/onda1_financeiro_baseline.md');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, report);
    console.log("Baseline gerado em .agent/onda1_financeiro_baseline.md");
}

runBaseline().catch(console.error);
