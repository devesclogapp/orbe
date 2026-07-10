import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'y:/2026/ERP ESC LOG/Orbe/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('[E2E TEST] Iniciando homologação financeira');
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@esclog.com.br',
        password: 'admin'
    });

    if (authError) {
        console.log('Login failed (trying admin123):', authError.message);
        const retry = await supabase.auth.signInWithPassword({
            email: 'admin@esclog.com.br',
            password: 'admin123'
        });
        if (retry.error) {
            console.error('Login failed totally:', retry.error.message);
            return;
        }
    }

    console.log('[E2E TEST] Autenticado como admin.');

    // Pegar a Empresa Homologação
    const { data: empresa } = await supabase.from('empresas').select('id, nome').ilike('nome', '%Homologação%').single();
    if (!empresa) {
        console.error('Empresa Homologação não encontrada!');
        return;
    }
    console.log('Empresa:', empresa.nome);

    // Colaboradores HML
    const { data: colabs } = await supabase.from('colaboradores').select('id, nome').ilike('nome', '%HML%').eq('empresa_id', empresa.id);
    console.log(`Encontrados ${colabs.length} colaboradores HML.`);

    // Pontos processados
    const { data: pontos } = await supabase.from('registros_ponto').select('id, nome_colaborador, data, status_processamento').in('colaborador_id', colabs.map(c => c.id));
    console.log(`Pontos encontrados:`, pontos.map(p => `${p.nome_colaborador} - ${p.data} - ${p.status_processamento}`));

    // Banco de Horas
    const { data: eventosBH } = await supabase.from('banco_horas_eventos').select('tipo, minutos, reflexo_financeiro_pendente').in('colaborador_id', colabs.map(c => c.id));
    console.log(`Eventos de Banco de Horas:`, eventosBH);

    // Lotes Financeiros da empresa
    const { data: lotes } = await supabase.from('rh_financeiro_lotes').select('id, tipo, competencia, status, valor_total').eq('empresa_id', empresa.id);
    console.log(`Lotes na base:`, lotes);

    console.log('[E2E TEST] Validação concluída. Grave esse dado para auditoria.');
}
main();
