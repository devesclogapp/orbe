import * as dotenv from 'dotenv';
import path from 'path';
import { supabase } from '../src/lib/supabase';
import { IntermitentesLoteService } from '../src/services/domain/intermitentes.service';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTest() {
    console.log('--- E2E Intermitentes Homologation ---');
    console.log('1. Checking for open lancamentos_intermitentes...');

    // Find a company that has open lancamentos
    const { data: openLancamentos, error } = await supabase
        .from('lancamentos_intermitentes')
        .select('*')
        .is('lote_fechamento_id', null)
        .eq('is_teste', true);

    if (error) {
        console.error('Error fetching lancamentos:', error);
        return;
    }

    if (!openLancamentos || openLancamentos.length === 0) {
        console.log('No open test lancamentos found. Generating some dummy test records...');
        // Let's create dummy test records if needed, but first we need an empresa and colaborador
        const { data: empresa } = await supabase.from('empresas').select('id').eq('is_teste', true).limit(1).single();
        const { data: colab } = await supabase.from('colaboradores').select('id, cpf').eq('is_teste', true).eq('tipo', 'INTERMITENTE').limit(1).single();
        
        if (!empresa || !colab) {
           console.log('No test empresa/intermitente found to backfill data. Exiting.');
           return;
        }

        const datas = ['2023-11-01', '2023-11-02', '2023-11-03'];
        for (let d of datas) {
             await supabase.from('lancamentos_intermitentes').insert({
                 empresa_id: empresa.id,
                 colaborador_id: colab.id,
                 data: d,
                 valor_diaria: 120,
                 tenant_id: 'd9b7f525-4fe0-4107-9fd5-568eb378cd39', // fallback
                 cpf: colab.cpf,
                 nome: 'Teste Intermitente',
                 chave_origem: `TEST-INT-${d}`,
                 is_teste: true
             });
        }
        console.log('Generated fake lancamentos_intermitentes.');
    } else {
        console.log(`Found ${openLancamentos.length} open lancamentos.`);
    }

    const { data: newlyOpen } = await supabase
        .from('lancamentos_intermitentes')
        .select('empresa_id')
        .is('lote_fechamento_id', null)
        .eq('is_teste', true)
        .limit(1)
        .single();

    if (newlyOpen) {
        const empresaId = newlyOpen.empresa_id;
        console.log(`2. Closing periodo for empresa_id: ${empresaId}...`);
        
        try {
            const lotes = await IntermitentesLoteService.fecharPeriodo({
                empresaId: empresaId,
                periodoInicio: '2023-01-01', // just span everything
                periodoFim: '2029-12-31',
                fechadoPor: '00000000-0000-0000-0000-000000000000',
                observacoes: 'Fechamento E2E Test'
            });
            console.log('Lotes criados:', lotes.map(l => l.id));
        } catch (e:any) {
             console.error('Error fecharPeriodo:', e.message);
        }
    }
}

runTest().catch(console.error);
