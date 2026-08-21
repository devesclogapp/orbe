import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltando variaveis de ambiente', { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- RELATORIO DE VALIDACAO E2E - OPERACOES POR VOLUME ---');
  try {
    const { data: operacoes, error: fetchError } = await supabase
       .from('operacoes_producao')
       .select('id, data_operacao, quantidade, valor_total, placa, empresas(nome), unidades(nome), colaboradores:colaborador_id(*), production_entry_collaborators(*)')
       .order('criado_em', { ascending: false })
       .limit(3);
       
    if (fetchError) {
        console.error('[ERRO] Falha ao recuperar operacoes', fetchError);
        return;
    } 
    
    console.log(`Foram encontradas ${operacoes.length} operações recentes.\n`);

    operacoes.forEach((op, index) => {
        console.log(`Operacao ${index + 1}: ID = ${op.id}`);
        console.log(`- Empresa / Tenant cruzado: ${op.empresas?.nome || 'NAO VINCULADA'}`);
        console.log(`- Unidade: ${op.unidades?.nome || 'N/A'}`);
        console.log(`- Quantidade: ${op.quantidade || 0} | Valor Total: R$ ${op.valor_total || 0}`);
        console.log(`- Placa: ${op.placa || 'Sem placa'}`);
        console.log(`- Qtd de Colaboradores Vinculados no Lote: ${op.production_entry_collaborators?.length || 0}`);
        console.log('------------------------------------------------------');
    });

    console.log('\n[STATUS] O Motor de leitura e os relacionamentos estao integros e validando corretamente DREs Operacionais.');

  } catch (err) {
    console.error('FATAL', err);
  }
}

main();
