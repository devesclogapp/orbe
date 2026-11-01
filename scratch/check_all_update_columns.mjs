import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function checkAllUpdateColumns() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  const updatesToCheck = [
    {
      table: 'servicos_extras_operacionais',
      cols: ['pipeline_status', 'justificativa_devolucao', 'status_pagamento', 'atualizado_em', 'empresa_id', 'tenant_id', 'data']
    },
    {
      table: 'lancamentos_diaristas',
      cols: ['status', 'empresa_id', 'tenant_id', 'data_lancamento']
    },
    {
      table: 'diaristas_lotes_fechamento',
      cols: ['status', 'updated_at', 'empresa_id', 'tenant_id', 'mes_referencia']
    },
    {
      table: 'intermitentes_lotes_fechamento',
      cols: ['status', 'updated_at', 'empresa_id', 'tenant_id', 'competencia']
    },
    {
      table: 'rh_financeiro_lotes',
      cols: ['status', 'updated_at', 'empresa_id', 'tenant_id', 'competencia']
    },
    {
      table: 'receitas_operacionais',
      cols: ['status', 'observacao', 'updated_at', 'empresa_id', 'tenant_id', 'competencia']
    },
    {
      table: 'faturas',
      cols: ['status', 'motivo_rejeicao', 'empresa_id', 'tenant_id', 'competencia']
    },
    {
      table: 'financeiro_consolidados_cliente',
      cols: ['status', 'empresa_id', 'tenant_id', 'competencia']
    },
    {
      table: 'financeiro_consolidados_colaborador',
      cols: ['status', 'empresa_id', 'tenant_id', 'competencia']
    }
  ];

  for (const u of updatesToCheck) {
    for (const c of u.cols) {
      const { error } = await sb.from(u.table).select(c).limit(1);
      if (error) {
        console.error(`[FAIL] ${u.table}.${c}: ${error.message}`);
      } else {
        console.log(`[PASS] ${u.table}.${c}`);
      }
    }
  }
}

checkAllUpdateColumns().catch(console.error);
