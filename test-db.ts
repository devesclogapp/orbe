import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const empresaDismelo = 'DISMELO CASTANHAL';
  const periodoInicio = '2026-06-01';
  const periodoFim = '2026-06-07';

  try {
    // 1. Lotes
    const { data: lotes, error: errLotes } = await supabase
      .from('diaristas_lotes_fechamento')
      .select('*, empresa:empresas(nome)')
      .lte('periodo_inicio', periodoFim)
      .gte('periodo_fim', periodoInicio);
    
    // Filtro manual pela empresa pra garantir (já que o ID da empresa é necessário original, mas usando a string para buscar da tabela empresas)
    // Tentar de novo pegando a empresa primeiro
    let empresaId = null;
    const { data: empData } = await supabase.from('empresas').select('id, nome').eq('nome', empresaDismelo).single();
    if (empData) {
       empresaId = empData.id;
       console.log('Empresa ID:', empresaId);
    } else {
       console.log(`Empresa "${empresaDismelo}" não encontrada. Fetch sem empresa.`);
    }

    console.log('--- 1. LOTES ---');
    const loteQuery = supabase
      .from('diaristas_lotes_fechamento')
      .select('id, empresa_id, periodo_inicio, periodo_fim, status, valor_total, quantidade_diaristas, total_registros, tenant_id')
      .lte('periodo_inicio', periodoFim)
      .gte('periodo_fim', periodoInicio);
    
    if (empresaId) loteQuery.eq('empresa_id', empresaId);

    const { data: lotesData, error: lotesErr } = await loteQuery;
    if (lotesErr) console.error('Erro lotes:', lotesErr);
    else console.log(JSON.stringify(lotesData, null, 2));

    console.log('\\n--- 2. LANCAMENTOS ---');
    const lancQuery = supabase
      .from('lancamentos_diaristas')
      .select('id, status, lote_fechamento_id, diarista_ciclo_id, data_lancamento, tenant_id, empresa_id')
      .gte('data_lancamento', periodoInicio)
      .lte('data_lancamento', periodoFim);
    
    if (empresaId) lancQuery.eq('empresa_id', empresaId);

    const { data: lancData, error: lancErr } = await lancQuery;
    if (lancErr) console.error('Erro lanc:', lancErr);
    else {
      console.log(`Total lancamentos: ${lancData?.length}`);
      const statMap: Record<string, number> = {};
      let comLote = 0;
      let comCiclo = 0;
      lancData?.forEach(i => {
        statMap[i.status] = (statMap[i.status] || 0) + 1;
        if (i.lote_fechamento_id) comLote++;
        if (i.diarista_ciclo_id) comCiclo++;
      });
      console.log('Status agrupados:', JSON.stringify(statMap));
      console.log(`Com lote_id: ${comLote} | Com ciclo_id: ${comCiclo}`);
      if (lancData?.length && lancData.length > 0) {
        console.log('Exemplo lanc tenant_id:', lancData[0].tenant_id);
      }
    }

  } catch(e) {
    console.error('Erro:', e);
  }
}

run();
