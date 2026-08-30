import { describe, it, expect, vi } from 'vitest';

vi.mock('../environment/EnvironmentService', async (importOriginal) => {
    const mod = await importOriginal<any>();
    return {
        ...mod,
        EnvironmentService: {
            ...mod.EnvironmentService,
            getTestEmpresaIds: vi.fn().mockImplementation(async () => ['28a560b5-37ef-403d-ae4f-b28a608b6a68'])
        }
    };
});

vi.mock('../environment/EnvironmentQueryFilter', async (importOriginal) => {
    const mod = await importOriginal<any>();
    return {
        ...mod,
        EnvironmentQueryFilter: {
            ...mod.EnvironmentQueryFilter,
            applyEmpresaScope: vi.fn().mockImplementation((q) => q)
        }
    };
});

vi.mock('../services/domain/base.service', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../services/domain/base.service')>();
    return {
        ...mod,
        getCurrentTenantId: vi.fn().mockImplementation(() => '09ccafb6-2cf2-4c83-ac3d-a2913947693c'),
    };
});

import { IntermitentesLoteService } from '../services/domain/intermitentes.service';
import { supabase as singletonSupabase } from '@/lib/supabase';

describe('Homologacao E2E Intermitentes', () => {

    it('Step 1 and 2: Create open lancamentos if none exist, then fecharPeriodo', async () => {
        const { getE2EContext } = await import('../../scripts/utils/e2e-guard');
        console.log('1. Checking for open lancamentos_intermitentes...');
        const { empresaId, userId, tenantId } = await getE2EContext();

        // REAL AUTH NO SINGLETON
        const testEmail = process.env.E2E_TEST_EMAIL!;
        const testPassword = process.env.E2E_TEST_PASSWORD!;
        await singletonSupabase.auth.signInWithPassword({ email: testEmail, password: testPassword });

        const supabase = singletonSupabase; // Use the properly authenticated one

        const { data: openLancamentos, error } = await supabase
            .from('lancamentos_intermitentes')
            .select('*')
            .is('lote_fechamento_id', null)
            .eq('tenant_id', tenantId);

        if (error) {
            console.error('Error fetching lancamentos:', error);
            throw new Error(error.message);
        }

        if (!openLancamentos || openLancamentos.length === 0) {
            console.log('No open test lancamentos found. Generating some dummy test records...');
            const { data: empresa } = await supabase.from('empresas').select('id, tenant_id').eq('id', empresaId).single();
            const { data: colab } = await supabase.from('colaboradores').select('id, cpf, nome').eq('tenant_id', tenantId).limit(1).single();
            
            if (!empresa || !colab) {
               throw new Error('No test empresa/intermitente found to backfill data.');
            }

            const datas = ['2023-11-01', '2023-11-02', '2023-11-03'];
            for (let d of datas) {
                 await supabase.from('lancamentos_intermitentes').insert({
                     tenant_id: empresa.tenant_id,
                     empresa_id: empresa.id,
                     colaborador_id: colab.id,
                     nome_colaborador: colab.nome,
                     data_referencia: d,
                     competencia: '11/2023',
                     horas_trabalhadas: 8,
                     total: 150.00,
                     status_pipeline: 'RECEBIDO'
                 });
            }
            console.log('Generated fake lancamentos_intermitentes.');
        } else {
            console.log(`Found ${openLancamentos.length} open lancamentos.`);
        }

        const { data: dbData } = await supabase.from('lancamentos_intermitentes').select('*').eq('tenant_id', tenantId);
        console.log('All lancamentos_intermitentes in DB count:', dbData?.length);
        if (dbData && dbData.length > 0) {
           console.log('Sample lancamento Date:', dbData[0].data_referencia, 'Status:', dbData[0].status_pipeline, 'Empresa:', dbData[0].empresa_id, 'LoteId:', dbData[0].lote_fechamento_id);
        }

        console.log(`2. Closing periodo for empresa_id: ${empresaId}...`);
        
        const lotes = await IntermitentesLoteService.fecharPeriodo({
            empresaId: empresaId,
            periodoInicio: '2023-01-01', 
            periodoFim: '2029-12-31',
            fechadoPor: userId,
            observacoes: 'Fechamento E2E Test'
        });
        console.log('Lotes criados:', lotes.map(l => l.id));
        expect(lotes.length).toBeGreaterThan(0);
        
        if (lotes.length > 0) {
           console.log("Newly created lote:", lotes[0].id);
        }
    }, 30000); 
});
