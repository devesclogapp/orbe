import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== PRÉ-VOO: CONFERÊNCIA DE AMBIENTE E ISOLAMENTO ===");
  console.log("Supabase URL:", supabaseUrl);

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });

  if (authErr) {
    console.error("Falha ao autenticar E2E user:", authErr);
  } else {
    console.log("Usuário autenticado com sucesso:", authData.user.email, "Tenant:", authData.user.user_metadata?.tenant_id, "Role:", authData.user.user_metadata?.role);
  }

  // 1. Verificar empresas
  const { data: empresas, error: errEmp } = await supabase
    .from('empresas')
    .select('id, nome, cnpj')
    .order('nome');
  
  if (errEmp) {
    console.error("Erro ao buscar empresas:", errEmp);
  } else {
    console.log(`\nEmpresas encontradas (${empresas?.length}):`);
    empresas?.forEach(e => console.log(`- [${e.id}] ${e.nome} (CNPJ: ${e.cnpj || 's/n'}, Ativo: ${e.ativo})`));
  }

  // 2. Verificar tipos de serviços extras
  const { data: tiposServico, error: errTipos } = await supabase
    .from('tipos_servico_operacional')
    .select('id, nome, valor_unitario, tipo_calculo, ativo')
    .limit(10);
  
  console.log(`\nTipos de Serviços Operacionais (${tiposServico?.length || 0}):`);
  tiposServico?.forEach(t => console.log(`- [${t.id}] ${t.nome} (R$ ${t.valor_unitario}, Cálculo: ${t.tipo_calculo}, Ativo: ${t.ativo})`));

  // 3. Verificar colaboradores
  const { data: colabs, error: errColab } = await supabase
    .from('colaboradores')
    .select('id, nome, empresa_id, tipo_vinculo, ativo')
    .limit(10);
  console.log(`\nColaboradores (${colabs?.length || 0}):`);
  colabs?.forEach(c => console.log(`- [${c.id}] ${c.nome} (Vínculo: ${c.tipo_vinculo}, Empresa: ${c.empresa_id})`));

  // 4. Verificar fornecedores
  const { data: fornecedores, error: errForn } = await supabase
    .from('fornecedores')
    .select('id, nome, cnpj, ativo')
    .limit(10);
  console.log(`\nFornecedores (${fornecedores?.length || 0}):`);
  fornecedores?.forEach(f => console.log(`- [${f.id}] ${f.nome} (CNPJ: ${f.cnpj})`));

  // 5. Verificar formas de pagamento
  const { data: formas, error: errFormas } = await supabase
    .from('formas_pagamento_operacional')
    .select('id, nome, modalidade, ativo')
    .limit(10);
  console.log(`\nFormas de Pagamento (${formas?.length || 0}):`);
  formas?.forEach(f => console.log(`- [${f.id}] ${f.nome} (Modalidade: ${f.modalidade})`));
}

run().catch(console.error);
