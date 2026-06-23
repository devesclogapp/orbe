import fs from 'fs';

const envStr = fs.readFileSync('env_local_copy.txt', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const baseUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY.replace(/"/g, '');

const fetchTable = async (table) => {
    const res = await fetch(`${baseUrl}/rest/v1/${table}?select=*&limit=5`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (res.ok) return await res.json();
    console.error(`Falha ao ler ${table}`);
    return [];
}

const insertData = async (table, data) => {
    const res = await fetch(`${baseUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        console.log(`[SUCESSO] ${table} salvo.`);
        return await res.json();
    } else {
        const err = await res.text();
        console.error(`[ERRO] ${table}:`, err);
        return null;
    }
}

async function run() {
    console.log("Iniciando Injeção Etapa 3 - Competência 2026-06 (Corrente)");

    // Obter Tenant
    const tReq = await fetch(`${baseUrl}/rest/v1/tenants?select=id&limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const tRes = await tReq.json();
    const tId = tRes[0]?.id;
    if (!tId) {
        console.error("Sem tenant ID, RLS irá bloquear.");
        return;
    }

    const empresas = await fetchTable('empresas');
    const unidades = await fetchTable('unidades');
    const transps = await fetchTable('transportadoras');
    const forn = await fetchTable('fornecedores');
    const prods = await fetchTable('produtos');
    const colabs = await fetchTable('colaboradores');

    const empresa = empresas[0] || {};
    const unidade = unidades[0] || {};
    const transp = transps[0] || {};
    const fornecedor = forn[0] || {};
    const produto = prods[0] || {};
    const colab = colabs[0] || {};

    const compet = '2026-06';
    const dataRef = '2026-06-23';

    // 1. Operação por Volume
    await insertData('operacoes_producao', [{
        tenant_id: tId,
        empresa_id: empresa.id || null,
        unidade_id: unidade.id || null,
        data_referencia: dataRef,
        tipo_operacao: 'DESCARGA',
        transportadora_id: transp.id || null,
        fornecedor_id: fornecedor.id || null,
        produto_id: produto.id || null,
        produto_nome: produto.nome || 'Caixa Leite',
        quantidade: 150,
        valor_unitario: 2.5,
        valor_bruto: 375.0,
        modalidade_pagamento: 'VISTA',
        forma_pagamento: 'PIX',
        status_pipeline: 'LANÇADO',
        nf_informada: false,
        competencia: compet,
        origem_lancamento: 'SISTEMA',
        criado_por: colab.id || null
    }]);

    // 2. Intermitente (usando payload que funcionava)
    await insertData('lancamentos_intermitentes', [{
        tenant_id: tId,
        nome_colaborador: 'JOAO INTERMITENTE',
        data_referencia: dataRef,
        competencia: compet,
        convocacao: 'Carga Mockada',
        cargo: 'CARREGADOR',
        horas_trabalhadas: 8.0,
        total: 120.00,
        status_pipeline: 'RECEBIDO'
    }]);

    // 3. Diaristas
    await insertData('lancamentos_diaristas', [{
        tenant_id: tId,
        empresa_id: empresa.id || null,
        colaborador_id: colab.id || null,
        data_referencia: dataRef,
        quantidade_diarias: 1,
        valor_diaria: 100,
        valor_total: 100,
        competencia: compet,
        status_pipeline: 'AGUARDANDO_COMPROVANTE'
    }]);

    // 4. Serviços Extras
    await insertData('servicos_extras_operacionais', [{
        tenant_id: tId,
        empresa_id: empresa.id || null,
        data_referencia: dataRef,
        descricao_servico: 'Pintura',
        quantidade: 1,
        valor_unitario: 50,
        valor_total: 50,
        status_pipeline: 'PENDENTE',
        forma_pagamento: 'PIX',
        competencia: compet
    }]);

    // Atualiza contadores json
    const cTables = ['operacoes_producao', 'lancamentos_diaristas', 'lancamentos_intermitentes', 'servicos_extras_operacionais'];
    const results = {};
    for (const t of cTables) {
        const u = `${baseUrl}/rest/v1/${t}?select=*`;
        const rt = await fetch(u, { method: 'HEAD', headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': 'count=exact', 'Range': '0-0' } });
        results[t] = rt.headers.get('content-range') ? parseInt(rt.headers.get('content-range').split('/')[1]) : -1;
    }
    fs.writeFileSync('.agent/counts.json', JSON.stringify(results, null, 2));
    console.log("FINALIZADO. counts.json atualizado.");
}
run();
