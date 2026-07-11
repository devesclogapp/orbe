import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLotes() {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: 'admin@orbelogistica.com.br', password: '123' });
    if (authErr) return console.log('Login failed:', authErr);

    // Find valid tenant and user
    const { data: user_data } = await supabase.auth.getUser();
    if (!user_data?.user) return console.log('Login failed');

    // Find an active empresa
    const { data: emps, error: eErr } = await supabase.from('empresas').select('id, tenant_id').limit(1);
    if (eErr) console.log('Error fetching empresas:', eErr);
    if (!emps || emps.length === 0) return console.log('No empresas available to the admin user.');

    const emp = emps[0];
    console.log('Seeding data for Empresa:', emp.id, 'Tenant:', emp.tenant_id);

    // Seed batch
    const { data: batch, error } = await supabase.from('rh_financeiro_lotes').insert({
        tenant_id: emp.tenant_id,
        empresa_id: emp.id,
        competencia: '2026-06',
        status: 'FECHADO_FINANCEIRO',
        tipo_lote: 'MENSAL',
        total_colaboradores: 5,
        valor_total: 10000.00
    });

    const { data: batch2, error2 } = await supabase.from('intermitentes_lotes_fechamento').insert({
        tenant_id: emp.tenant_id,
        empresa_id: emp.id,
        competencia: '2026-06',
        status: 'FECHADO_FINANCEIRO',
        tipo_lote: 'MENSAL',
        quantidade_registros: 5,
        valor_total: 10000.00
    });

    console.log('Seeding rh_financeiro_lotes result:', error || 'OK');
    console.log('Seeding intermitentes_lotes_fechamento result:', error2 || 'OK');
}

checkLotes()
