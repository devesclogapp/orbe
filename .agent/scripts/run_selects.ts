import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSelects() {
    // Attempt Admin login
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: 'admin@orbe.com',
        password: 'admin'
    });
    if (authErr) {
        console.error("Login as admin@orbe.com failed:", authErr.message);
        // Will try to fetch as anon anyway, maybe RLS is permissive enough for read
    } else {
        console.log("Logged in as admin@orbe.com successfully.");
    }

    console.log("\n=== 1. Lançamentos que serão apagados ===");
    const nomes = ['Intermitente Sem Rumo', 'JOAO DAS COUVES (CASTANHAL)', 'Intermitente Existente', 'Colaborador Zumbi Novo', 'Colaborador Existente'];
    const cpfs = ['11111111111', '22222222222'];
    const deps = ['Empresa Totalmente Nova e Fantasma SA', 'Departamento Desconhecido ZXZX', 'Castanhal,Operacional', 'Operacional,Castanhal'];
    
    // First query - fetch all, then filter in JS to simulate OR clauses easily without RPC
    const { data: lancs, error: e1 } = await supabase.from('lancamentos_intermitentes')
        .select('id, nome_colaborador, cpf_colaborador, departamento, empresa_id, lote_fechamento_id');
        
    if (e1) console.error("Error fetching lancamentos:", e1);
    else if (!lancs) console.log("0 lancamentos returned.");
    else {
        const toDeleteLancs = lancs.filter(l => 
            (l.nome_colaborador && nomes.includes(l.nome_colaborador)) ||
            (l.cpf_colaborador && cpfs.includes(l.cpf_colaborador)) ||
            (l.departamento && deps.includes(l.departamento))
        );
        console.log(JSON.stringify(toDeleteLancs, null, 2));
        
        console.log("\n=== 2. Lotes que serão apagados ===");
        const loteIds = [...new Set(toDeleteLancs.map(l => l.lote_fechamento_id).filter(Boolean))];
        
        if (loteIds.length > 0) {
            const { data: lotes, error: e2 } = await supabase.from('intermitentes_lotes_fechamento')
                .select('id, tenant_id, empresa_id, status, observacoes, quantidade_registros')
                .in('id', loteIds);
            
            if (e2) console.error("Error fetching lotes:", e2);
            else console.log(JSON.stringify(lotes, null, 2));
        } else {
            console.log("[] (Nenhum lote associado na listagem acima)");
        }
    }

    console.log("\n=== 3. Empresas temporárias Sujas/Sintéticas ===");
    const nomesEmpresas = [
        'Empresa Totalmente Nova e Fantasma SA', 
        'Departamento Desconhecido ZXZX',
        'Castanhal,Operacional',
        'Operacional,Castanhal'
    ];
    
    const { data: emps, error: e3 } = await supabase.from('empresas')
        .select('id, nome, origem, cnpj')
        .in('nome', nomesEmpresas);
        
    if (e3) console.error("Error fetching empresas:", e3);
    else console.log(JSON.stringify(emps, null, 2));
    
    console.log("\n--- CONCLUÍDO ---");
}

runSelects();
