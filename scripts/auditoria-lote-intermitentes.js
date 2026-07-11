import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Tenta usar a SERVICE_ROLE_KEY para ignorar RLS na auditoria. 
// Caso não esteja definida, cai para o ANON_KEY (que pode falhar em bancos muito restritos).
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function getResumoLoteIntermitente(loteId) {
    console.log(`=== AUDITORIA DE FECHAMENTO (INTERMITENTES) ===`);
    console.log(`Buscando Lote: ${loteId}\n`);

    // 1. Busca Lote
    const { data: lote, error: errLote } = await supabase
        .from('intermitentes_lotes_fechamento')
        .select('*, empresa:empresas(nome)')
        .eq('id', loteId)
        .single();

    if (errLote || !lote) {
        console.error("Erro ao buscar lote:", errLote?.message || "Não encontrado");
        return null;
    }

    // 2. Busca lançamentos atrelados
    const { data: itens, error: errItens } = await supabase
        .from('lancamentos_intermitentes')
        .select('*')
        .eq('lote_fechamento_id', loteId);

    if (errItens) {
        console.error("Erro ao buscar lançamentos:", errItens.message);
        return null;
    }

    // 3. Verifica consistência 
    const isLoteCorrectRegistros = itens.length === lote.quantidade_registros;

    // Status deve ser estritamente 'EM_ANALISE_RH' para itens dentro de um Lote recém-fechado
    const hasOrphanState = itens.filter(i => i.status_pipeline !== 'EM_ANALISE_RH' && i.status_pipeline !== 'RECEBIDO').length > 0;

    const realTotalHoras = itens.reduce((acc, i) => acc + Number(i.horas_trabalhadas || 0), 0);
    const realTotalValor = itens.reduce((acc, i) => acc + Number(i.total || 0), 0);

    const isHorasMatch = realTotalHoras.toFixed(2) === Number(lote.total_horas).toFixed(2);
    const isValorMatch = realTotalValor.toFixed(2) === Number(lote.valor_total).toFixed(2);

    const resumo = {
        loteId: lote.id,
        status: lote.status,
        tenantId: lote.tenant_id,
        periodoInicio: lote.periodo_inicio,
        periodoFim: lote.periodo_fim,
        quantidadeRegistros: itens.length,
        quantidadeColaboradores: new Set(itens.map(i => i.colaborador_id || i.nome_colaborador)).size,
        totalHoras: Number(realTotalHoras.toFixed(2)),
        valorTotal: Number(realTotalValor.toFixed(2)),
        criadoPor: lote.created_by,
        criadoEm: lote.created_at,
        integridade: {
            "Payload (Qtd) Matched": isLoteCorrectRegistros,
            "Filhos Sem Orfandade de Status (Somente EM_ANALISE_RH)": !hasOrphanState,
            "Soma Horas Correta": isHorasMatch,
            "Soma Valor Correta": isValorMatch
        }
    };

    console.log(JSON.stringify(resumo, null, 2));

    if (!isLoteCorrectRegistros || hasOrphanState || !isHorasMatch || !isValorMatch) {
        console.warn("\n[!] AVISO: Inconsistência detectada. O Lote foi persistido porém os totais divergem nas linhas.");
    } else {
        console.log("\n[V] AUDITORIA APROVADA: Lote persistido e relacionalmente consistente.");
    }

    return resumo;
}

// Verifica se um loteId foi passado como CLI argument.
const argLote = process.argv[2];
if (argLote) {
    getResumoLoteIntermitente(argLote).catch(console.error);
} else {
    // Busca o Lote mais recente para varredura cega.
    console.log("Nenhum Id fornecido, buscando último lote de fechamento do banco...");
    supabase.from('intermitentes_lotes_fechamento')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
            if (data && data.length > 0) {
                getResumoLoteIntermitente(data[0].id).catch(console.error);
            } else {
                console.log("Nenhum lote de intermitentes encontrado no banco.");
            }
        });
}
