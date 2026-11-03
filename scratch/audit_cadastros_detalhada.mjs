import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function maskCpf(cpf) {
  if (!cpf) return 'AUSENTE';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return `INVÁLIDO (${clean.slice(0, 3)}***)`;
  return `${clean.slice(0, 3)}.***.***-${clean.slice(9)}`;
}

function cleanCnpj(cnpj) {
  return cnpj ? cnpj.replace(/\D/g, '') : '';
}

async function runDetailedAudit() {
  console.log('=== EXECUTANDO AUDITORIA PROFUNDA DOS CADASTROS ESSENCIAIS ===\n');

  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // 1. EMPRESAS
  const { data: empresas } = await supabase.from('empresas').select('*').order('nome');
  
  // 2. COLABORADORES
  const { data: colaboradores } = await supabase.from('colaboradores').select('*').order('nome');

  // 3. TIPOS DE SERVIÇO OPERACIONAL
  const { data: servicos } = await supabase.from('tipos_servico_operacional').select('*');

  // 4. TRANSPORTADORAS CLIENTES
  const { data: transportadoras } = await supabase.from('transportadoras_clientes').select('*');

  // 5. FORNECEDORES
  const { data: fornecedores } = await supabase.from('fornecedores').select('*');

  // 6. PRODUTOS DE CARGA
  const { data: produtos } = await supabase.from('produtos_carga').select('*');

  // 7. UNIDADES
  const { data: unidades } = await supabase.from('unidades').select('*');

  // 8. FORMAS DE PAGAMENTO OPERACIONAL
  const { data: formasPagamento } = await supabase.from('formas_pagamento_operacional').select('*');

  // 9. REGRAS OPERACIONAIS / TABELA DE VALORES (fornecedor_valores_servico)
  const { data: regrasValores } = await supabase.from('fornecedor_valores_servico').select('*');

  // 10. SERVIÇOS EXTRAS OPERACIONAIS
  const { data: servicosExtras } = await supabase.from('servicos_extras_operacionais').select('*');

  // 11. CUSTOS EXTRAS OPERACIONAIS
  const { data: custosExtras } = await supabase.from('custos_extras_operacionais').select('*');

  // 12. OPERAÇÕES DE PRODUÇÃO (lançamentos de teste ou reais já existentes)
  const { data: operacoes } = await supabase.from('operacoes_producao').select('*');

  // 13. JORNADAS DE TRABALHO
  const { data: jornadas } = await supabase.from('jornadas_trabalho').select('*');

  console.log('--- CONTAGENS CONSOLIDADAS ---');
  console.log(`Empresas: ${empresas?.length}`);
  console.log(`Colaboradores: ${colaboradores?.length}`);
  console.log(`Tipos de Serviço Operacional: ${servicos?.length}`);
  console.log(`Transportadoras Clientes: ${transportadoras?.length}`);
  console.log(`Fornecedores: ${fornecedores?.length}`);
  console.log(`Produtos Carga: ${produtos?.length}`);
  console.log(`Unidades: ${unidades?.length}`);
  console.log(`Formas de Pagamento: ${formasPagamento?.length}`);
  console.log(`Regras / Tabela Valores (fornecedor_valores_servico): ${regrasValores?.length}`);
  console.log(`Serviços Extras Operacionais: ${servicosExtras?.length}`);
  console.log(`Custos Extras Operacionais: ${custosExtras?.length}`);
  console.log(`Operações Produção: ${operacoes?.length}`);
  console.log(`Jornadas Trabalho: ${jornadas?.length}`);

  // ANÁLISE DE EMPRESAS
  const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
  const empresasComColab = new Map();
  for (const c of (colaboradores || [])) {
    if (c.empresa_id) {
      empresasComColab.set(c.empresa_id, (empresasComColab.get(c.empresa_id) || 0) + 1);
    }
  }

  const empresasDetalhes = (empresas || []).map(e => ({
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    cnpjFormatado: e.cnpj || 'SEM CNPJ',
    ativo: e.ativo !== false,
    origem: e.origem || 'não informada',
    is_teste: e.is_teste === true,
    totalColaboradores: empresasComColab.get(e.id) || 0
  }));

  // ANÁLISE DE COLABORADORES
  const colabDetalhes = {
    total: colaboradores?.length || 0,
    clt: 0,
    intermitente: 0,
    diarista: 0,
    outros: 0,
    semCpf: [],
    comCpfInvalido: [],
    semEmpresa: [],
    empresaOrfa: [],
    semMatricula: [],
    semValorDiaria: [],
    semSalarioClt: [],
    distribuicaoPorEmpresa: {}
  };

  for (const c of (colaboradores || [])) {
    const tipo = (c.tipo_colaborador || c.regime_trabalho || '').toUpperCase();
    if (tipo.includes('CLT')) colabDetalhes.clt++;
    else if (tipo.includes('INTERMITENTE')) colabDetalhes.intermitente++;
    else if (tipo.includes('DIARISTA')) colabDetalhes.diarista++;
    else colabDetalhes.outros++;

    const cCpf = c.cpf ? c.cpf.replace(/\D/g, '') : '';
    if (!cCpf) {
      colabDetalhes.semCpf.push({ id: c.id, nome: c.nome, tipo: c.tipo_colaborador });
    } else if (cCpf.length !== 11) {
      colabDetalhes.comCpfInvalido.push({ id: c.id, nome: c.nome, cpfMascarado: maskCpf(cCpf) });
    }

    if (!c.empresa_id) {
      colabDetalhes.semEmpresa.push({ id: c.id, nome: c.nome, tipo: c.tipo_colaborador });
    } else if (!empresaMap.has(c.empresa_id)) {
      colabDetalhes.empresaOrfa.push({ id: c.id, nome: c.nome, empresa_id: c.empresa_id });
    } else {
      const empNome = empresaMap.get(c.empresa_id).nome;
      colabDetalhes.distribuicaoPorEmpresa[empNome] = (colabDetalhes.distribuicaoPorEmpresa[empNome] || 0) + 1;
    }

    if (!c.matricula) {
      colabDetalhes.semMatricula.push({ id: c.id, nome: c.nome, tipo: c.tipo_colaborador });
    }

    if (c.tipo_colaborador === 'DIARISTA' && !c.valor_diaria && !c.valor_base) {
      colabDetalhes.semValorDiaria.push({ id: c.id, nome: c.nome });
    }

    if (c.tipo_colaborador === 'CLT' && !c.salario_base && !c.valor_base) {
      colabDetalhes.semSalarioClt.push({ id: c.id, nome: c.nome });
    }
  }

  // ANÁLISE DOS VÍNCULOS
  const integridade = {
    // 1. Empresa -> Colaborador
    colaboradoresSemEmpresa: colabDetalhes.semEmpresa.length,
    colaboradoresComEmpresaOrfa: colabDetalhes.empresaOrfa.length,
    // 2. Operações -> Empresa, Transportadora, Fornecedor
    operacoesSemEmpresa: (operacoes || []).filter(o => !o.empresa_id || !empresaMap.has(o.empresa_id)).length,
    operacoesSemTransportadora: (operacoes || []).filter(o => !o.transportadora_id).length,
    operacoesSemFornecedor: (operacoes || []).filter(o => !o.fornecedor_id).length,
    // 3. Regras de Preço (fornecedor_valores_servico)
    regrasValoresTotal: regrasValores?.length || 0,
    regrasValoresAtivas: (regrasValores || []).filter(r => r.ativo !== false).length,
    // 4. Parâmetros essenciais
    totalTransportadoras: transportadoras?.length || 0,
    totalFornecedores: fornecedores?.length || 0,
    totalProdutos: produtos?.length || 0,
    totalUnidades: unidades?.length || 0,
    totalFormasPagamento: formasPagamento?.length || 0
  };

  const output = {
    timestamp: new Date().toISOString(),
    empresas: empresasDetalhes,
    colaboradores: colabDetalhes,
    servicos: (servicos || []).map(s => ({ id: s.id, nome: s.nome, codigo: s.codigo, ativo: s.ativo })),
    transportadoras: (transportadoras || []).map(t => ({ id: t.id, nome: t.nome, cnpj: t.cnpj, ativo: t.ativo })),
    fornecedores: (fornecedores || []).map(f => ({ id: f.id, nome: f.nome, cnpj: f.cnpj, ativo: f.ativo })),
    produtos: (produtos || []).map(p => ({ id: p.id, nome: p.nome, codigo: p.codigo })),
    unidades: (unidades || []).map(u => ({ id: u.id, nome: u.nome })),
    formasPagamento: (formasPagamento || []).map(f => ({ id: f.id, nome: f.nome, codigo: f.codigo })),
    regrasValores: regrasValores || [],
    servicosExtras: servicosExtras || [],
    custosExtras: custosExtras || [],
    operacoes: operacoes || [],
    jornadas: jornadas || [],
    integridade
  };

  fs.writeFileSync('scratch/audit_cadastros_detalhada.json', JSON.stringify(output, null, 2));
  console.log('\nRelatório detalhado salvo em scratch/audit_cadastros_detalhada.json.');
}

runDetailedAudit().catch(console.error);

