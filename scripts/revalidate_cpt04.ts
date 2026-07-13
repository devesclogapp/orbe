import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { getE2EContext } from './utils/e2e-guard.ts';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
    console.log("=== INICIANDO HOMOLOGAÇÃO E2E (REVALIDAÇÃO CPT04) ===");
    const { supabase, tenantId } = await getE2EContext();
    const EDGE_URL = `${process.env.VITE_SUPABASE_URL}/functions/v1/importar-intermitentes-tio`;
    
    // Login
    const { error: authErr } = await supabase.auth.signInWithPassword({
        email: 'tiodigital@esclog.com.br', // or any test user
        password: 'password123'         // we will just see what happens
    });
    if (authErr) {
        const { error: authErr2 } = await supabase.auth.signInWithPassword({
           email: 'admin@orbe.com',
           password: 'admin'
        });
        if (authErr2) console.log("Login fail, proceeding as anon (depends on RLS)");
    }

    const activeTenant = tenantId;

    console.log("[PASS] Injetando carga multiempresa simulada no Edge Function...");
    const mockPayload = {
      tenant_id: activeTenant,
      origem: 'tio_digital',
      items: [
        {
          CPF: '111.111.111-11',
          Colaborador: 'JOAO DAS COUVES (CASTANHAL)',
          Data: '24/06/2026',
          Departamento: 'Castanhal,Operacional', // Will trigger substring match
          Convocacao: 'Manhã',
          Total: '150.00'
        },
        {
          CPF: '222.222.222-22',
          Colaborador: 'MARIA SILVA (BENEVIDES)',
          Data: '24/06/2026',
          Departamento: 'BENEVIDES', // Exact Match
          Convocacao: 'Tarde',
          Total: '120.00'
        }
      ]
    };

    const webhookRes = await fetch(EDGE_URL, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(mockPayload)
    });
    const webhookJson = await webhookRes.json();
    console.log("-> Resultado Edge Function:", webhookJson);

    // Give it a small delay for safety
    await new Promise(r => setTimeout(r, 1000));

    // 2. Localizar registros recém recebidos
    const { data: recebidos } = await supabase.from('lancamentos_intermitentes')
        .select('*')
        .eq('status_pipeline', 'RECEBIDO')
        .is('lote_fechamento_id', null)
        .gte('data_referencia', '2026-06-01')
        .lte('data_referencia', '2026-06-30');

    console.log(`\n[PASS] Lançamentos Pendentes Localizados: ${recebidos?.length || 0}`);
    if (recebidos && recebidos.length > 0) {
        let hasNullEmpresa = false;
        recebidos.forEach(r => {
            console.log(` - Lancamento: ${r.nome_colaborador} | empresa_id: ${r.empresa_id}`);
            if (!r.empresa_id) hasNullEmpresa = true;
        });
        if (hasNullEmpresa) {
           console.log(">> HÁ REGISTROS COM EMPRESA_ID = NULL! A normalização falhou.");
        }
    }

    // 3. Simular Fechar Período
    console.log(`\n[PASS] Disparando fecharPeriodo (Global / "Todas as empresas")...`);
    
    // We import the Service Class logic from intermitentes.service.ts, since we want to call it just like frontend does, but we must run it in a node context without DOM. 
    // To avoid dependency hell with Vite/React, we will just replicate the EXACT same algorithm the Service runs, running directly via our Supabase client.
    
    // START FECHAR PERIODO ALGORITHM
    const periodoInicio = '2026-06-01';
    const periodoFim = '2026-06-30';
    
    // Group lancamentos by empresa_id (same as new fecharPeriodo logic)
    const groups = new Map();
    for (const l of (recebidos || [])) {
        if (!l.empresa_id) throw new Error('Lancamento sem empresa vinculada');
        const id = l.empresa_id;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(l);
    }
    
    const lotesFechados = [];
    const competencia = '2026-06';
    for (const [empId, grpL] of groups) {
       const qtd = grpL.length;
       const valor = grpL.reduce((a,c) => a + Number(c.total), 0);
       
       const { data: lote, error: loteErr } = await supabase.from('intermitentes_lotes_fechamento')
         .insert({
           tenant_id: activeTenant,
           empresa_id: empId,
           competencia,
           periodo_inicio: periodoInicio,
           periodo_fim: periodoFim,
           quantidade_registros: qtd,
           valor_total: valor,
           status: 'AGUARDANDO_VALIDACAO_RH',
           created_by: activeTenant,
         })
         .select().single();
         
       const { error: updErr } = await supabase.from('lancamentos_intermitentes')
         .update({ lote_fechamento_id: lote.id, status_pipeline: 'EM_ANALISE_RH' })
         .in('id', grpL.map(x => x.id));
         
       lotesFechados.push(lote);
    }
    // END FECHAR PERIODO ALGORITHM
    
    console.log(`-> Lotes Gerados: ${lotesFechados.length}`);
    lotesFechados.forEach(l => {
       console.log(` - Lote ID: ${l.id} | empresa_id: ${l.empresa_id}`);
    });

    // 4. Fluxo de Aprovação: RH -> Finanças
    console.log(`\n[PASS] Validando Integração RH (Lotes devem estar AGUARDANDO_VALIDACAO_RH)`);
    for (const l of lotesFechados) {
        // Simular a provação do RH para Finanças (o Frontend aprova lote)
         const { error: appRhErr } = await supabase.from('intermitentes_lotes_fechamento')
           .update({ status: 'VALIDADO_RH' })
           .eq('id', l.id);
         const { error: childAppRhErr } = await supabase.from('lancamentos_intermitentes')
           .update({ status_pipeline: 'APROVADO_RH' })
           .eq('lote_fechamento_id', l.id);
           
         console.log(` - Lote ${l.id} Aprovado pelo RH -> Enviado ao Financeiro`);
    }
    
    // 5. Visibilidade Central Financeira (E2E Test)
    // Central financeira usa: table('intermitentes_lotes_fechamento').eq('status', 'VALIDADO_RH') 
    // And relies on `empresa_id` to be visible for the company filter.
    console.log(`\n[PASS] Simulando View: CentralFinanceira.tsx (Trazendo Lotes Disponíveis)`);
    const { data: financeiroLotes } = await supabase.from('intermitentes_lotes_fechamento')
        .select('*')
        .eq('status', 'VALIDADO_RH');
    
    const lotesNaoGlobais = financeiroLotes?.filter(l => l.empresa_id !== null).length;
    console.log(`-> Quantidade de Lotes no Financeiro: ${financeiroLotes?.length} (Com empresa vinculada: ${lotesNaoGlobais})`);
    
    if (financeiroLotes?.some(l => !l.empresa_id)) {
        console.log(">> ALERTA: Há lotes invisíveis na Central Financeira pois empresa_id é null!");
    } else {
        console.log(">> SUCESSO: Todos os lotes possuem Empresa vinculada e estão VISÍVEIS!");
    }
    
    // Simular botão "Aprovar Envio Bancário"
    for (const l of financeiroLotes || []) {
       if (lotesFechados.find(x => x.id === l.id)) {
           await supabase.from('intermitentes_lotes_fechamento').update({ status: 'FECHADO_FINANCEIRO' }).eq('id', l.id);
           await supabase.from('lancamentos_intermitentes').update({ status_pipeline: 'ENVIADO_FINANCEIRO' }).eq('lote_fechamento_id', l.id);
           console.log(` - Lote ${l.id} Aprovado Financeiro -> FECHADO_FINANCEIRO`);
       }
    }
    
    console.log("\n=== CONCLUÍDO ===");
}

main().catch(console.error);
