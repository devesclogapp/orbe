import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xxx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'xxx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  try {
    console.log("Initialzing E2E API Test for Intermitente Times...");

    // 1. Get an existing company
    const { data: empData, error: empErr } = await supabase.from('empresas').select('id, tenant_id').limit(1).single();
    if (empErr) throw empErr;

    // 2. Get two collaborators
    const { data: clsData, error: clsErr } = await supabase.from('colaboradores').select('id').limit(2);
    if (clsErr || !clsData || clsData.length < 2) throw new Error("Not enough collaborators");

    const colab1 = clsData[0].id;
    const colab2 = clsData[1].id;

    // 3. Create an operation record
    const opPayload = {
      tenant_id: empData.tenant_id,
      empresa_id: empData.id,
      data_operacao: new Date().toISOString().split('T')[0],
      tipo_calculo_snapshot: 'volume',
      quantidade: 100,
      quantidade_colaboradores: 2,
      status: 'pendente'
    };

    const { data: opData, error: opE } = await supabase.from('operacoes_producao').insert(opPayload).select().single();
    if (opE) throw opE;
    console.log(`✅ Base Operation created: ${opData.id}`);

    // 4. Link collaborators with individual times
    const { error: relErr } = await supabase.from('production_entry_collaborators').insert([
      {
        production_entry_id: opData.id,
        collaborator_id: colab1,
        had_infraction: false,
        entrada_ponto: '08:00',
        saida_almoco: '12:00',
        retorno_almoco: '13:00',
        saida_ponto: '18:00'
      },
      {
        production_entry_id: opData.id,
        collaborator_id: colab2,
        had_infraction: false,
        entrada_ponto: '09:00',
        saida_almoco: '12:30',
        retorno_almoco: '13:30',
        saida_ponto: '19:00'
      }
    ]);

    if (relErr) throw relErr;
    console.log(`✅ Linked 2 collaborators with specific timings!`);

    // 5. Verify the data
    const { data: verifyData, error: vErr } = await supabase.from('production_entry_collaborators').select('collaborator_id, entrada_ponto, saida_almoco, retorno_almoco, saida_ponto').eq('production_entry_id', opData.id);
    if (vErr) throw vErr;
    
    console.log("\n--- Verification DB Select ---");
    console.table(verifyData);
    
    // 6. Cleanup
    await supabase.from('operacoes_producao').delete().eq('id', opData.id);
    console.log("🧹 Test Data Cleaned up from DB.");
    
  } catch(e) {
    console.error("Test failed:", e);
  }
}

runTest();
