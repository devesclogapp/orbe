import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const { data: remessas } = await supabase.from('cnab_remessas_arquivos').select('*').order('sequencial_arquivo', { ascending: true });
  console.log('=== TODAS AS REMESSAS OFICIAIS ===');
  console.table(remessas.map(r => ({
    id: r.id,
    nsa: r.sequencial_arquivo,
    nome: r.nome_arquivo,
    status: r.status,
    modo: r.modo,
    lote_id: r.lote_id,
    intermitentes_lote_id: r.intermitentes_lote_id,
    diaristas_lote_id: r.diaristas_lote_id,
    total_valor: r.total_valor,
    total_registros: r.total_registros,
    tem_conteudo: !!r.conteudo_arquivo
  })));

  const rem8 = remessas.find(r => r.sequencial_arquivo === 8);
  if (rem8) {
    const { data: itens8 } = await supabase.from('cnab_remessa_itens').select('*').eq('remessa_id', rem8.id);
    console.log('=== ITENS NSA 8 (CLT) ===');
    console.table(itens8.map(i => ({
      id: i.id,
      remessa_id: i.remessa_id,
      origem_tipo: i.origem_tipo,
      origem_id: i.origem_id,
      valor: i.valor,
      status: i.status
    })));
  }

  const targetNsa9Id = '8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543';
  const { data: itens9 } = await supabase.from('cnab_remessa_itens').select('*').eq('remessa_id', targetNsa9Id);
  console.log('=== ITENS NSA 9 (8aebd6bc-d9d5-4a42-8ffa-1e2f4ef42543) ===');
  console.table(itens9.map(i => ({
    id: i.id,
    remessa_id: i.remessa_id,
    origem_tipo: i.origem_tipo,
    origem_id: i.origem_id,
    valor: i.valor,
    status: i.status
  })));

  const { data: seq } = await supabase.from('cnab_sequencial_controle').select('*');
  console.log('=== SEQUENCIAL CONTROLE ===');
  console.table(seq);

  const { data: ld } = await supabase.from('lancamentos_diaristas').select('*').limit(1);
  console.log('=== LANCAMENTOS_DIARISTAS COLUNAS OFICIAIS ===');
  console.log(ld && ld.length > 0 ? Object.keys(ld[0]) : 'vazia');
}

inspect().catch(console.error);
