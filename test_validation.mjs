import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

// Precisaremos usar a admin key para o upsert se houver RLS. No caso, Edge Functions usam admin keys. 
// Mas se não tivermos, tentaremos com a key que tiver no env (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).
// Note: O Tio Digital usa RLS open para inserts? Se o anon não puder, teremos erro. Mas testaremos!

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Tentar achar chave de sv role primeiro
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
    try {
        const text = fs.readFileSync('.env.local', 'utf8');
        const match = text.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n\r]+)/);
        if (match) serviceRoleKey = match[1];
    } catch (e) { }
}

const supabaseKey = serviceRoleKey || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Login provisório para by-pass RLS no frontend-key caso usemos anon
async function initSession() {
    if (supabaseKey === process.env.VITE_SUPABASE_ANON_KEY) {
        const { data } = await supabase.auth.signInWithPassword({
            email: "suporte.orbitalabs@gmail.com",
            password: "orbesuporte" // chute baseado na Orbita Labs
        });
        if (data?.session) {
            console.log("Logged in as", data.user.email);
            return data.user.user_metadata?.tenant_id || '8f830aab-1763-4ba0-a35c-fe2ab96996db';
        }
    }
    return "8f830aab-1763-4ba0-a35c-fe2ab96996db"; // default fallback
}

async function run() {
    const tenant_id = await initSession();
    const items = [
        {
            "colaborador_nome": "DAVID LOHAN DE MELO MENEZES",
            "matricula": "9991",
            "data": "2026-05-28",
            "departamento": "Operacional Noturno Teste"
        },
        {
            "colaborador_nome": "ESAU DA COSTA DOS SANTOS",
            "matricula": "9992",
            "data": "2026-05-27",
            "departamento": "BENEVIDES Teste"
        }
    ];

    const processaveis = [];
    let ignorados = 0;

    // --- ETAPA 1 E 2: RESOLUÇÃO DA EMPRESA ---
    const empresasUnicas = new Map();

    for (const item of items) {
        const empId = item.empresa_id;
        const empCnpj = item.empresa_cnpj || item.cnpj;
        const numCnpj = empCnpj ? String(empCnpj).replace(/\D/g, '') : null;
        const empNome = item.colaborador_nome ? item.departamento : "Empresa Tio Digital"; // mockup for name base
        const nomeBase = empNome || 'Empresa Tio Digital';
        const mapKey = empId || numCnpj || nomeBase.toUpperCase().trim();

        if (!empresasUnicas.has(mapKey)) {
            empresasUnicas.set(mapKey, { id: empId, cnpj: numCnpj, nome: nomeBase, dbId: null });
        }
        item._empresaMapKey = mapKey;
    }

    let empresas_criadas = 0;
    let empresas_vinculadas = 0;
    let colaboradores_sem_empresa = 0;

    const { data: dbEmpresas, error: errEmp } = await supabase.from('empresas').select('id, nome, cnpj').eq('tenant_id', tenant_id);
    if (!errEmp && dbEmpresas) {
        for (const emp of empresasUnicas.values()) {
            let matched = dbEmpresas.find(e => e.nome.toUpperCase().trim() === emp.nome.toUpperCase().trim());
            if (matched) { emp.dbId = matched.id; empresas_vinculadas++; }
        }
    }

    for (const emp of empresasUnicas.values()) {
        if (!emp.dbId) {
            const insertPayload = { tenant_id: tenant_id, nome: emp.nome, status: 'ATIVA' };
            let { data: inEmp, error: inErr } = await supabase.from('empresas').insert({ ...insertPayload, origem_cadastro: 'integracao_tio' }).select('id').single();
            if (inEmp) { emp.dbId = inEmp.id; empresas_criadas++; empresas_vinculadas++; }
            else console.error("Err:", inErr);
        }
    }

    // --- ETAPA 4: VINCULAR EMPRESA AO COLABORADOR ---
    for (const item of items) {
        item.nome = item.colaborador_nome;
        const empRef = empresasUnicas.get(item._empresaMapKey);
        const finalEmpresaId = empRef ? empRef.dbId : null;
        if (!finalEmpresaId) colaboradores_sem_empresa++;
        processaveis.push({
            tenant_id: tenant_id,
            empresa_id: finalEmpresaId,
            nome: item.nome,
            nome_completo: item.nome,
            matricula: String(item.matricula),
            origem_cadastro: "integracao_tio",
        });
    }

    const { error: upsertError } = await supabase.from('colaboradores').upsert(processaveis, { onConflict: 'tenant_id,matricula' });
    if (upsertError) console.error("Upsert colaborador error:", upsertError);

    // Validate results:
    const { data: c1 } = await supabase.from('colaboradores').select('nome, matricula, empresa_id').in('matricula', ['9991', '9992']);
    console.log("Validation Colaboradores (with empresa):", c1);
}

run();
