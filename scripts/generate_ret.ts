import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load env vars
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching remessas...');
  const { data: remessas, error } = await supabase
    .from('cnab_remessas_arquivos')
    .select('*, contas_bancarias_empresa(agencia, conta, convenio)')
    .not('intermitentes_lote_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !remessas || remessas.length === 0) {
    console.log('No intermitentes remessa found. Finding any remessa...');
    const fallback = await supabase.from('cnab_remessas_arquivos').select('*, contas_bancarias_empresa(agencia, conta, convenio)').order('created_at', { ascending: false }).limit(1);
    if (!fallback.data || fallback.data.length === 0) {
       console.log('No remessas found at all!');
       process.exit(1);
    }
    remessas.push(fallback.data[0]);
  }

  const remessa = remessas[0];
  console.log('Found remessa:', remessa.id, 'lote intermitentes:', remessa.intermitentes_lote_id);

  const lines = remessa.conteudo_arquivo.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length === 240);
  
  const retLines = [];
  
  for (let line of lines) {
    if (line.substring(7, 8) === '0') {
      // Header Arquivo
      let newLine = line.substring(0, 142) + '2' + line.substring(143);
      retLines.push(newLine);
    } else if (line.substring(7, 8) === '1') {
      // Header Lote
      retLines.push(line);
    } else if (line.substring(7, 8) === '3') {
      const segmento = line.substring(13, 14);
      if (segmento === 'A') {
         // Modify to BD / Liquidado (Ocorrencia 00)
         let mod = line.substring(0, 14) + '00' + line.substring(16);
         retLines.push(mod);
      } else {
         retLines.push(line);
      }
    } else if (line.substring(7, 8) === '5') {
      // Trailer Lote
      retLines.push(line);
    } else if (line.substring(7, 8) === '9') {
      // Trailer Arquivo
      retLines.push(line);
    }
  }

  fs.writeFileSync('teste_retorno.ret', retLines.join('\n'));
  console.log('Created teste_retorno.ret with', retLines.length, 'lines.');
  
  // also emit the SQL requested by the user
  const { data: lotes } = await supabase.from('intermitentes_lotes_fechamento').select('id, status, valor_total, quantidade_registros').order('created_at', { ascending: false }).limit(5);
  console.log('INITIAL LOTES:', lotes);
  
  const { data: lancs } = await supabase.from('lancamentos_intermitentes').select('status_pipeline, count').select('status_pipeline');
  const counts = (lancs || []).reduce((acc: any, curr: any) => {
      acc[curr.status_pipeline] = (acc[curr.status_pipeline] || 0) + 1;
      return acc;
  }, {});
  console.log('INITIAL LANCAMENTOS:', counts);

}

main().catch(console.error);
