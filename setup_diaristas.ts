import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // Pegar uma empresa qualquer
  const { data: empresas, error: errEmp } = await supabase.from('empresas').select('id, nome').limit(1);
  if (errEmp || !empresas || empresas.length === 0) {
    console.error("Erro ao buscar empresas ou nenhuma empresa encontrada:");
    console.error(errEmp);
    process.exit(1);
  }
  const empresaId = empresas[0].id;
  console.log(`Usando empresa: ${empresas[0].nome} (${empresaId})`);

  // Pegar ou criar um tenant
  const tenantId = empresas[0].tenant_id || 'default_tenant'; // O schema pode ser diferente, vamos ignorar tenant_id direto no objeto ou ver

  const diaristas = [
    {
      nome: 'Diarista Teste 1',
      nome_completo: 'Diarista Teste 1 Completo',
      cpf: '11122233344',
      telefone: '11999999991',
      funcao: 'Diarista',
      valor_diaria: 100,
      status: 'ativo',
      empresa_id: empresaId,
      banco_codigo: '341',
      agencia: '1234',
      conta: '12345',
      digito_conta: '6',
      tipo_conta: 'corrente'
    },
    {
      nome: 'Diarista Teste 2',
      nome_completo: 'Diarista Teste 2 Completo',
      cpf: '22233344455',
      telefone: '11999999992',
      funcao: 'Auxiliar de carga',
      valor_diaria: 120,
      status: 'ativo',
      empresa_id: empresaId,
      banco_codigo: '033',
      agencia: '4321',
      conta: '54321',
      digito_conta: '0',
      tipo_conta: 'poupanca'
    },
    {
      nome: 'Diarista Teste 3',
      nome_completo: 'Diarista Teste 3 Completo',
      cpf: '33344455566',
      telefone: '11999999993',
      funcao: 'Diarista',
      valor_diaria: 150,
      status: 'ativo',
      empresa_id: empresaId,
      banco_codigo: '104',
      agencia: '1111',
      conta: '22222',
      digito_conta: '3',
      tipo_conta: 'corrente'
    }
  ];

  for (const d of diaristas) {
    const { data, error } = await supabase.from('colaboradores').upsert({
       cpf: d.cpf,
       ...d
    }, { onConflict: 'cpf' });
    if (error) {
      console.error(`Erro ao inserir ${d.nome}:`, error);
    } else {
      console.log(`Inserido com sucesso: ${d.nome}`);
    }
  }
}

run();
