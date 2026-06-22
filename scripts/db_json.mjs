import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://lifgjtcflzmspilhryap.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function extract() {
    const rs = {};

    // 6. Verificar ciclos aprovados
    const { data: ciclos } = await supabase.from('ciclos_operacionais').select('id, status, status_financeiro').order('criado_em', { ascending: false }).limit(20);
    rs.ciclosAprovados = ciclos?.filter(c => c.status_financeiro === 'validado_financeiro') || [];

    // 3. Insert consolidados
    const { data: consolidados } = await supabase.from('financeiro_consolidados_cliente').select('*').order('created_at', { ascending: false }).limit(2);
    rs.consolidados = consolidados;

    // 4. Clientes
    const { data: clienteTop1 } = await supabase.from('clientes').select('*').limit(1);
    rs.clienteTop1 = clienteTop1;
    const { data: countRaw } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
    rs.countClientes = countRaw;

    fs.writeFileSync('db_json.txt', JSON.stringify(rs, null, 2), 'utf8');
}
extract();
