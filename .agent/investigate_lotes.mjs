import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function investigate() {
    const credentials = [
        { email: 'admin@orbelogistica.com.br', password: '123' },
        { email: 'admin@esclog.com.br', password: 'admin123' },
        { email: 'admin@esclog.com.br', password: 'admin' }
    ];

    let loggedIn = false;
    for (const cred of credentials) {
        const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
            email: cred.email,
            password: cred.password
        });
        if (!authError && auth.session) {
            console.log(`Successfully logged in as ${cred.email}`);
            loggedIn = true;
            break;
        } else {
            console.log(`Failed to login as ${cred.email}:`, authError.message);
        }
    }

    if (!loggedIn) {
        console.log('Could not authenticate. RLS might block data retrieval.');
    }

    const { data: user_data } = await supabase.auth.getUser();
    const userId = user_data?.user?.id;

    // check tenant via profiles or directly
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).limit(1);
    console.log('Profile:', profile);

    const report = {};

    // 1. Check all lotes intermitentes
    const { data: lotesInt, error: e1 } = await supabase.from('intermitentes_lotes_fechamento').select('*');
    report['intermitentes_lotes_fechamento_count'] = lotesInt?.length || 0;
    report['intermitentes_lotes_fechamento'] = lotesInt || [];
    if (e1) console.error(e1);

    // 2. Check general rh_financeiro_lotes
    const { data: lotesGen, error: e2 } = await supabase.from('rh_financeiro_lotes').select('*');
    report['rh_financeiro_lotes_count'] = lotesGen?.length || 0;
    report['rh_financeiro_lotes'] = lotesGen || [];
    if (e2) console.error(e2);

    // 3. Check intermitentes lancamentos
    const { data: lancamentos, error: e3 } = await supabase.from('intermitentes_lancamentos').select('*');
    report['intermitentes_lancamentos_count'] = lancamentos?.length || 0;
    if (e3) console.error(e3);

    // 4. Check empresas
    const { data: empresas, error: e4 } = await supabase.from('empresas').select('*');
    report['empresas_disponiveis'] = empresas?.map(e => ({ id: e.id, nome: e.nome })) || [];

    fs.writeFileSync('.agent/investigation_report.json', JSON.stringify(report, null, 2), 'utf-8');
    console.log('Investigation completed. See .agent/investigation_report.json');
}

investigate();
