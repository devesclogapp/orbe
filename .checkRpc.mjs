import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data: ops } = await supabase.from('operacoes_producao').select('id, updated_at, status').limit(1);

if (ops && ops.length > 0) {
    const target = ops[0];
    console.log('Testing with id:', target.id, 'updated_at:', target.updated_at, 'status:', target.status);

    // Test 1: with correct updated_at
    let { data, error } = await supabase.rpc('rpc_operacao_validar_aprovar', {
        p_operacao_id: target.id,
        p_updated_at_frontend: target.updated_at
    });
    console.log('Result with correct updated_at:', { data, error });

    // Test 2: with null
    let res2 = await supabase.rpc('rpc_operacao_validar_aprovar', {
        p_operacao_id: target.id,
        p_updated_at_frontend: null
    });
    console.log('Result with null:', { data: res2.data, error: res2.error });
} else {
    console.log('No operation found');
}
