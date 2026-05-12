import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('diaristas_lotes_fechamento').select('id, status, periodo_inicio, periodo_fim');
  console.log("All Lotes:", data?.length);
  
  if (data) {
     const grouped = {};
     for (const d of data) {
         const k = d.periodo_inicio + '_' + d.periodo_fim;
         if (!grouped[k]) grouped[k] = [];
         grouped[k].push(d);
     }
     
     for (const k in grouped) {
        if (grouped[k].length > 1) {
            console.log(`Duplicate lotes for period ${k}:`);
            console.log(grouped[k]);
        }
     }
  }
}
run();
