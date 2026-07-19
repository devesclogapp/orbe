import { config } from 'dotenv';
config({ path: '../.env.local' });
import { supabase } from '../src/lib/supabase';
import { IntermitentesLoteService } from '../src/services/domain/intermitentes.service';

async function main() {
  console.log('Iniciando backfill dos 3 lotes...');
  const { data: lotes, error } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status')
    .eq('status', 'FECHADO_FINANCEIRO');

  if (error) {
    console.error('Erro ao buscar lotes', error);
    process.exit(1);
  }

  console.log('Encontrados ' + (lotes ? lotes.length : 0) + ' lotes para backfill.');

  for (const lote of lotes || []) {
    console.log('Processando lote ' + lote.id + '...');
    try {
      await IntermitentesLoteService.syncToRHFinanceiro(lote.id, lote.status);
      console.log('Lote ' + lote.id + ' sincronizado com sucesso.');
    } catch(err) {
      console.error('Erro ao sincronizar lote ' + lote.id + ':', err);
    }
  }

  process.exit(0);
}

main().catch(console.error);
