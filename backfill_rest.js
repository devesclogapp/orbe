import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/(?:VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_ANON_KEY)=(.*)/);

const BASE_URL = urlMatch[1].trim();
const KEY = keyMatch[1].trim();

async function req(path, method = 'GET', body = null) {
    const url = `${BASE_URL}/rest/v1/${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        const txt = await res.text();
        console.error(`HTTP ERRO ${res.status} [${path}]: ${txt}`);
        throw new Error(`Rest error`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

async function main() {
    console.log('Buscando lotes originais...');
    const lotes = await req('intermitentes_lotes_fechamento?select=id,status,tenant_id,empresa_id,competencia,quantidade_registros,valor_total&status=eq.FECHADO_FINANCEIRO');

    if (!lotes || lotes.length === 0) {
        console.log('Nenhum lote FECHADO_FINANCEIRO encontrado.');
        return;
    }
    console.log(`Encontrados ${lotes.length} lotes.`);

    let insertedCount = 0;

    for (const lote of lotes) {
        console.log(`Processando Lote Original: ${lote.id}`);

        // Check if already in rh_financeiro_lotes
        const check = await req(`rh_financeiro_lotes?select=id&tenant_id=eq.${lote.tenant_id}&empresa_id=eq.${lote.empresa_id}&competencia=eq.${lote.competencia}&origem=eq.OPERACIONAL&tipo=eq.INTERMITENTES`);
        let rhLoteId = check && check.length > 0 ? check[0].id : null;

        // Aggregate from lancamentos
        const lancamentos = await req(`lancamentos_intermitentes?select=*&lote_fechamento_id=eq.${lote.id}`);
        const aggTotal = lancamentos.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
        const uniqueColabs = new Set(lancamentos.map(l => l.colaborador_id || l.nome_colaborador));

        if (!rhLoteId) {
            const created = await req('rh_financeiro_lotes', 'POST', {
                tenant_id: lote.tenant_id,
                empresa_id: lote.empresa_id,
                competencia: lote.competencia,
                origem: 'OPERACIONAL',
                tipo: 'INTERMITENTES',
                total_colaboradores: uniqueColabs.size,
                valor_total: aggTotal,
                status: 'AGUARDANDO_PAGAMENTO',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            rhLoteId = created[0].id;
            insertedCount++;
        }

        if (lancamentos && lancamentos.length > 0) {
            await req(`rh_financeiro_lote_itens?lote_id=eq.${rhLoteId}`, 'DELETE');

            const itens = lancamentos.map(l => ({
                lote_id: rhLoteId,
                tenant_id: lote.tenant_id,
                colaborador_id: l.colaborador_id,
                nome_colaborador: l.nome_colaborador || 'Desconhecido',
                tipo_evento: 'LANCAMENTO_INTERMITENTE',
                horas: Number(l.horas_trabalhadas || l.quantidade_horas || 0),
                minutos: Math.round(Number(l.horas_trabalhadas || l.quantidade_horas || 0) * 60),
                valor_calculado: Number(l.total || l.valor_pagamento || 0),
                origem_evento: 'lancamentos_intermitentes',
                referencia_evento_id: l.id,
                status: 'AGUARDANDO_PAGAMENTO'
            }));

            await req('rh_financeiro_lote_itens', 'POST', itens);
        }

        console.log(`Lote importado/atualizado. rhLoteId -> ${rhLoteId}`);
    }

    console.log(`Processo finalizado. Lotes novos criados: ${insertedCount}`);
}

main().catch(console.error);
