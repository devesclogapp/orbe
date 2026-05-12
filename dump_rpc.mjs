import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpFunc() {
  const { data, error } = await supabase.rpc('reabrir_periodo_diaristas', {
    p_lote_id: '00000000-0000-0000-0000-000000000000',
    p_usuario_id: '00000000-0000-0000-0000-000000000000',
    p_usuario_nome: 'test',
    p_usuario_role: 'test',
    p_motivo: 'test'
  });
  console.log("Response:", data, error);
}

dumpFunc();
