import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
});

async function run() {

    // Pegar o tenant_id da base
    const { data: cols } = await supabase.from('colaboradores').select('tenant_id').limit(1);
    const tenantId = cols[0]?.tenant_id || "75bd8318-77bd-4229-873b-fa15f5a89df8";

    // 1. Encontrar os recebidos
    const dataRefInicio = '2026-07-01';
    const dataRefFim = '2026-07-31';

    const { data: lancamentos, error: queryError } = await supabase
        .from('lancamentos_intermitentes')
        .select('id, total')
        .eq('status_pipeline', 'RECEBIDO')
        .is('lote_fechamento_id', null)
        .gte('data_referencia', dataRefInicio)
        .lte('data_referencia', dataRefFim);

    if (queryError) throw queryError;
    if (!lancamentos || lancamentos.length === 0) {
        console.log('Nenhum lancamento para processar.');
        return;
    }

    const quantidade_registros = lancamentos.length;
    const valor_total = lancamentos.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const competencia = '2026-07';

    // 2. Inserir na tabela intermitentes_lotes_fechamento
    const { data: lote, error: loteError } = await supabase
        .from('intermitentes_lotes_fechamento')
        .insert({
            tenant_id: tenantId,
            empresa_id: null,
            competencia,
            periodo_inicio: dataRefInicio,
            periodo_fim: dataRefFim,
            quantidade_registros,
            valor_total,
            status: 'AGUARDANDO_VALIDACAO_RH',
            observacoes: "Homologacao Automatica Checkpoint 02",
            created_by: "system-homologation",
        })
        .select()
        .single();

    if (loteError) throw loteError;
    console.log("Lote Criado:", lote);

    // 3. Atualizar os lancamentos
    const lancamentoIds = lancamentos.map(l => l.id);
    const { data: udpData, error: updateError } = await supabase
        .from('lancamentos_intermitentes')
        .update({
            lote_fechamento_id: lote.id,
            status_pipeline: 'EM_ANALISE_RH' // conforme o service IntermitentesLoteService.fecharPeriodo
        })
        .in('id', lancamentoIds)
        .select('id, status_pipeline, lote_fechamento_id');

    if (updateError) throw updateError;

    console.log("Registros atualizados:", udpData.length);
    console.log("O lote gerado possui id:", lote.id);
}

run().catch(console.error);
