import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectViews() {
  console.log("=== INSPEÇÃO DE COLUNAS DAS VIEWS NO BANCO REAL ===");

  const views = [
    'vw_audit_timeline_operacional',
    'vw_operacoes_producao_resumo_dia',
    'vw_aprovacoes_rh'
  ];

  for (const view of views) {
    const { data, error } = await supabase.from(view).select('*').limit(1);
    if (error) {
      console.log(`[${view}] ERRO SELECT:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`[${view}] COLUNAS (ordem real):`, Object.keys(data[0]));
    } else {
      // Se estiver vazio, vamos descobrir a ordem buscando uma linha com headers
      console.log(`[${view}] Retornou 0 linhas. Vamos verificar via fetch direto...`);
    }
  }
}

inspectViews();
