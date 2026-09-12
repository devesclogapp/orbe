import { getE2EContext } from './utils/e2e-guard.ts';

async function run() {
  try {
    const { supabase } = await getE2EContext();

    const { data, error } = await supabase.rpc('pg_get_functiondef' as any, {
      funcoid: 'public.rpc_operacao_validar_aprovar'
    }).maybeSingle();

    // Or query information_schema / rpc definitions if accessible
    console.log('Function def rpc_operacao_validar_aprovar:', data, error);
  } catch (e) {
    console.error(e);
  }
}
run();
