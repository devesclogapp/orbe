import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
const loteId = 'f5a80602-8a77-49ad-83c1-f4cf00a6ecdf';

async function run() {
  console.log("---- ETAPA 1 ----");
  const { data: lote } = await supabase.from('intermitentes_lotes_fechamento').select('*').eq('id', loteId).single();
  console.log("Lote encontrado:", !!lote);
  if (lote) {
    console.log("Status atual:", lote.status);
    console.log("Valor total:", lote.valor_total);
    console.log("Qtde registros:", lote.quantidade_registros);
  }

  console.log("\n---- ETAPA 5 ----");
  const { data: remessas } = await supabase.from('cnab_remessas_arquivos').select('*').eq('intermitentes_lote_id', loteId);
  console.log("Remessas deste lote:", remessas);

  console.log("\n---- ETAPA 6 ----");
  console.log("Status novamente:", lote?.status);
}
run();
