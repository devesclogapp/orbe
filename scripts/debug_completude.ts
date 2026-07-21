import { getE2EContext } from './utils/e2e-guard';
import { getColaboradorCompletudeDetailed } from '../src/services/domain/core.service';

async function main() {
  const { supabase } = await getE2EContext('debug');
  const { data: cols } = await supabase.from('colaboradores').select('*').ilike('nome_completo', '%Homologação Itaú 001%').limit(1);
  if (!cols || cols.length === 0) { console.log('not found'); return; }
  console.log(JSON.stringify(getColaboradorCompletudeDetailed(cols[0]), null, 2));
}

main().catch(console.error);
