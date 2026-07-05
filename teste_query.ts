import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Mudar se precisar do root

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Conectando e buscando 1 operacao production...");
    
    // Auth bypass: we might need a service_role key to bypass RLS, or auth as an admin user.
    // I'll auth using the first user found or just use the service role key from .env if available.
    
    // fetch one recent record
    const { data: operations, error: fetchErr } = await supabase
        .from('operacoes_producao')
        .select('id, quantidade, nf_numero, status')
        .order('criado_em', { ascending: false })
        .limit(1);
        
    if (fetchErr) {
        console.error("Fetch falhou:", fetchErr);
        return;
    }
    
    if (!operations || operations.length === 0) {
        console.log("Nenhuma operação encontrada para testes.");
        return;
    }
    
    const op = operations[0];
    console.log("Operação encontrada antes do update:", op);
    
    const newQty = (op.quantidade || 0) + 10;
    const newNf = op.nf_numero === "SIM" ? "NÃO" : "SIM";
    
    console.log(`Atualizando id ${op.id} para qtde=${newQty} e nf_numero="${newNf}"...`);
    
    const { data: updateRes, error: updateErr } = await supabase
        .from('operacoes_producao')
        .update({ quantidade: newQty, nf_numero: newNf })
        .eq('id', op.id)
        .select('id, quantidade, nf_numero')
        .single();
        
    if (updateErr) {
        console.error("Update falhou:", updateErr);
        return;
    }
    
    console.log("Update sucesso! Retornou:", updateRes);
    
    // Reverse it back
    console.log("Revertendo...");
    await supabase.from('operacoes_producao').update({ quantidade: op.quantidade, nf_numero: op.nf_numero }).eq('id', op.id);
    console.log("Pronto.");
}

run().catch(console.error);
