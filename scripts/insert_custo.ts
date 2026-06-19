import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function main() {
  const { data, error } = await supabase
    .from('custos_extras_operacionais')
    .insert({
      categoria_custo: 'OPERACIONAL',
      descricao: 'Teste de Validacao Agent',
      valor_unitario: 1515.00,
      quantidade: 1,
      total: 1515.00,
      status_pagamento: 'A_PAGAR',
      pipeline_status: 'RECEBIDO',
      empresa_nome: 'Empresa Mock'
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  console.log('INSERTED_ID:', data.id);
}
main();
