import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectEmpresasAndPricing() {
  console.log('=== INVESTIGANDO EMPRESAS E PRECIFICAÇÃO (READ-ONLY) ===\n');

  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // 1. Inspecionar todas as colunas de empresas
  const { data: empresas, error: errEmp } = await supabase
    .from('empresas')
    .select('*')
    .order('created_at', { ascending: true });

  if (errEmp) {
    console.error('Erro ao buscar empresas:', errEmp);
    return;
  }

  console.log('--- DETALHES COMPLETOS DAS 10 EMPRESAS ---');
  for (const emp of empresas) {
    // Contar colaboradores vinculados
    const { count: colabCount } = await supabase
      .from('colaboradores')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', emp.id);

    // Contar operacoes vinculadas
    const { count: opCount } = await supabase
      .from('operacoes_producao')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', emp.id);

    // Contar custos extras vinculados
    const { count: custosCount } = await supabase
      .from('custos_extras_operacionais')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', emp.id);

    // Contar servicos extras vinculados
    const { count: seCount } = await supabase
      .from('servicos_extras_operacionais')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', emp.id);

    console.log(JSON.stringify({
      id: emp.id,
      nome: emp.nome,
      cnpj: emp.cnpj,
      razao_social: emp.razao_social,
      origem: emp.origem,
      origem_detalhe: emp.origem_detalhe,
      created_at: emp.created_at,
      updated_at: emp.updated_at,
      ativo: emp.ativo,
      is_teste: emp.is_teste,
      tenant_id: emp.tenant_id,
      colaboradores: colabCount || 0,
      operacoes: opCount || 0,
      custos_extras: custosCount || 0,
      servicos_extras: seCount || 0
    }, null, 2));
  }

  // 2. Inspecionar fornecedor_valores_servico
  console.log('\n--- DETALHES DE FORNECEDOR_VALORES_SERVICO ---');
  const { data: regras, error: errRegras } = await supabase
    .from('fornecedor_valores_servico')
    .select(`
      *,
      empresas:empresa_id(nome),
      tipos_servico_operacional:tipo_servico_id(nome),
      transportadoras_clientes:transportadora_id(nome),
      fornecedores:fornecedor_id(nome),
      produtos_carga:produto_carga_id(nome),
      formas_pagamento_operacional:forma_pagamento_id(nome)
    `);

  console.log(`Total de regras: ${regras?.length}`);
  console.log(JSON.stringify(regras, null, 2));

  // Salvar dump estruturado para análise
  fs.writeFileSync('scratch/diagnostico_etapa02_raw.json', JSON.stringify({
    empresas,
    regras
  }, null, 2));
}

inspectEmpresasAndPricing().catch(console.error);

