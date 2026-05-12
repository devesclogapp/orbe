import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching lotes...");
  const { data: lotes, error: errLotes } = await supabase
    .from('diaristas_lotes_fechamento')
    .select('id, status, periodo_inicio, periodo_fim, paid_at, paid_by')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (errLotes) {
    console.error("Lote error:", errLotes);
    return;
  }
  
  if (!lotes || lotes.length === 0) {
    console.log("No lotes found. RLS might be blocking without token.");
    return;
  }

  for (const lote of lotes) {
    console.log(`\nLote: ${lote.id} | Status: ${lote.status} | Periodo: ${lote.periodo_inicio} to ${lote.periodo_fim}`);
    
    // Check lancamentos for this lote
    const { data: lancs, error: errLanc } = await supabase
      .from('lancamentos_diaristas')
      .select('id, status, lote_fechamento_id, data_lancamento')
      .gte('data_lancamento', lote.periodo_inicio)
      .lte('data_lancamento', lote.periodo_fim);
      
    if (lancs) {
      console.log(`Lancamentos in this period: ${lancs.length}`);
      const statuses = [...new Set(lancs.map(l => l.status))];
      console.log(`Unique statuses: ${statuses.join(', ')}`);
      
      const inLote = lancs.filter(l => l.lote_fechamento_id === lote.id);
      console.log(`Linked explicitly to this lote_id: ${inLote.length}`);
      
      const paid = lancs.filter(l => l.status === 'PAGO' || l.status === 'pago');
      console.log(`Still marked as PAGO: ${paid.length}`);
    }
  }
}

run();
