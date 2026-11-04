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

async function runAudit() {
  console.log('=== INICIANDO AUDITORIA DOS CADASTROS ESSENCIAIS (READ-ONLY) ===\n');

  // 1. Autenticação
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  if (authError) {
    console.error('Falha de autenticação:', authError);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Autenticado com sucesso. User ID: ${userId}`);

  // Obter perfil e tenant
  const { data: perfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('user_id', userId)
    .single();

  const tenantId = perfil?.tenant_id;
  console.log(`Tenant oficial ativo: ${tenantId}\n`);

  // ==========================================
  // 1. AUDITORIA DE EMPRESAS
  // ==========================================
  console.log('--- 1. AUDITORIA DE EMPRESAS ---');
  const { data: empresas, error: errEmp } = await supabase
    .from('empresas')
    .select('*')
    .order('nome');

  console.log(`Total de empresas retornadas: ${empresas?.length || 0}`);
  
  let ativas = 0;
  let inativas = 0;
  let semCnpj = 0;
  const cnpjs = {};
  const cnpjsDuplicados = [];
  const nomes = {};
  const nomesSemelhantes = [];
  const sinteticasOuProvisorias = [];

  for (const emp of (empresas || [])) {
    if (emp.ativo === false) inativas++; else ativas++;

    const cCnpj = cleanCnpj(emp.cnpj);
    if (!cCnpj) {
      semCnpj++;
    } else {
      if (cnpjs[cCnpj]) {
        cnpjsDuplicados.push({ cnpj: cCnpj, emp1: cnpjs[cCnpj].nome, emp2: emp.nome });
      } else {
        cnpjs[cCnpj] = emp;
      }
    }

    const nomeNorm = emp.nome?.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (nomes[nomeNorm]) {
      nomesSemelhantes.push({ nome1: nomes[nomeNorm].nome, nome2: emp.nome });
    } else {
      nomes[nomeNorm] = emp;
    }

    // Checar se é sintética ou provisória
    if (
      emp.nome?.toLowerCase().includes('provis') ||
      emp.nome?.toLowerCase().includes('sintet') ||
      emp.nome?.toLowerCase().includes('teste') ||
      emp.nome?.toLowerCase().includes('rhid') ||
      emp.origem === 'rhid_auto' ||
      emp.is_teste === true
    ) {
      sinteticasOuProvisorias.push(emp);
    }
  }

  console.log(`Empresas ativas: ${ativas}, Inativas: ${inativas}`);
  console.log(`Sem CNPJ: ${semCnpj}`);
  console.log(`CNPJs duplicados: ${cnpjsDuplicados.length}`);
  console.log(`Nomes duplicados/semelhantes: ${nomesSemelhantes.length}`);
  console.log(`Sintéticas/provisórias/teste: ${sinteticasOuProvisorias.length}`);

  // ==========================================
  // 2. AUDITORIA DE COLABORADORES
  // ==========================================
  console.log('\n--- 2. AUDITORIA DE COLABORADORES ---');
  const { data: colabs, error: errColab } = await supabase
    .from('colaboradores')
    .select('*')
    .order('nome');

  console.log(`Total de colaboradores retornados: ${colabs?.length || 0}`);

  let colabAtivos = 0;
  let colabInativos = 0;
  let colabSemCpf = 0;
  let colabSemEmpresa = 0;
  let colabSemMatricula = 0;
  let cltCount = 0;
  let intermitenteCount = 0;
  let diaristaCount = 0;
  let outroTipoCount = 0;
  const colabCnpjs = {};
  const colabCpfs = {};
  const cpfsDuplicados = [];
  const colabsPorEmpresa = {};
  const pendentesRegularizacao = [];

  for (const c of (colabs || [])) {
    if (c.ativo === false) colabInativos++; else colabAtivos++;

    const cCpf = c.cpf ? c.cpf.replace(/\D/g, '') : '';
    if (!cCpf) {
      colabSemCpf++;
      pendentesRegularizacao.push({ id: c.id, nome: c.nome, motivo: 'CPF ausente' });
    } else {
      if (colabCpfs[cCpf]) {
        cpfsDuplicados.push({
          cpfMascarado: maskCpf(cCpf),
          colab1: colabCpfs[cCpf].nome,
          colab2: c.nome,
          tipo1: colabCpfs[cCpf].tipo_colaborador,
          tipo2: c.tipo_colaborador
        });
      } else {
        colabCpfs[cCpf] = c;
      }
    }

    if (!c.empresa_id) {
      colabSemEmpresa++;
      pendentesRegularizacao.push({ id: c.id, nome: c.nome, motivo: 'Sem empresa vinculada' });
    } else {
      colabsPorEmpresa[c.empresa_id] = (colabsPorEmpresa[c.empresa_id] || 0) + 1;
    }

    if (!c.matricula) {
      colabSemMatricula++;
    }

    const tipo = (c.tipo_colaborador || c.regime_trabalho || '').toUpperCase();
    if (tipo.includes('CLT')) cltCount++;
    else if (tipo.includes('INTERMITENTE')) intermitenteCount++;
    else if (tipo.includes('DIARISTA')) diaristaCount++;
    else outroTipoCount++;

    // Verificar pendências de cálculo ou dados bancários
    if (c.tipo_colaborador === 'DIARISTA' && !c.valor_diaria && !c.valor_base) {
      pendentesRegularizacao.push({ id: c.id, nome: c.nome, motivo: 'Diarista sem valor de diária' });
    }
    if (c.tipo_colaborador === 'CLT' && !c.salario_base && !c.valor_base) {
      pendentesRegularizacao.push({ id: c.id, nome: c.nome, motivo: 'CLT sem salário base' });
    }
  }

  console.log(`Colaboradores ativos: ${colabAtivos}, Inativos: ${colabInativos}`);
  console.log(`Distribuição de tipos: CLT=${cltCount}, Intermitente=${intermitenteCount}, Diarista=${diaristaCount}, Outros=${outroTipoCount}`);
  console.log(`Sem CPF: ${colabSemCpf}`);
  console.log(`CPFs duplicados: ${cpfsDuplicados.length}`);
  console.log(`Sem Empresa vinculada: ${colabSemEmpresa}`);
  console.log(`Sem Matrícula: ${colabSemMatricula}`);
  console.log(`Total com pendência de regularização: ${pendentesRegularizacao.length}`);

  // ==========================================
  // 3. AUDITORIA DE SERVIÇOS E PARÂMETROS OPERACIONAIS
  // ==========================================
  console.log('\n--- 3. SERVIÇOS, TRANSPORTADORAS, FORNECEDORES E PREÇOS ---');
  
  // Serviços
  const { data: servicos } = await supabase.from('servicos').select('*').order('nome');
  console.log(`Total de serviços cadastrados: ${servicos?.length || 0}`);

  // Config tipos de operação
  const { data: tiposOp } = await supabase.from('config_tipos_operacao').select('*');
  console.log(`Total de tipos de operação configurados: ${tiposOp?.length || 0}`);

  // Transportadoras
  const { data: transportadoras } = await supabase.from('transportadoras').select('*').order('nome');
  console.log(`Total de transportadoras cadastradas: ${transportadoras?.length || 0}`);

  // Fornecedores
  const { data: fornecedores } = await supabase.from('fornecedores').select('*').order('nome');
  console.log(`Total de fornecedores cadastrados: ${fornecedores?.length || 0}`);

  // Unidades
  const { data: unidades } = await supabase.from('unidades').select('*').order('nome');
  console.log(`Total de unidades cadastradas: ${unidades?.length || 0}`);

  // Produtos
  const { data: produtos } = await supabase.from('produtos').select('*').order('nome');
  console.log(`Total de produtos cadastrados: ${produtos?.length || 0}`);

  // Regras operacionais / Tabela de Preços
  const { data: regrasOp } = await supabase.from('regras_operacionais').select('*');
  console.log(`Total de regras operacionais cadastradas: ${regrasOp?.length || 0}`);

  // Servicos extras / Custos extras existentes
  const { data: servicosExtras } = await supabase.from('servicos_extras').select('id, tipo_servico, valor, status, empresa_id').limit(100);
  console.log(`Total de serviços extras existentes: ${servicosExtras?.length || 0}`);

  const { data: custosExtras } = await supabase.from('custos_extras').select('id, tipo_custo, valor, status, empresa_id').limit(100);
  console.log(`Total de custos extras existentes: ${custosExtras?.length || 0}`);

  // ==========================================
  // 4. INTEGRIDADE DOS VÍNCULOS
  // ==========================================
  console.log('\n--- 4. INTEGRIDADE DOS VÍNCULOS ---');

  // Mapa de empresas válidas
  const empresaMap = new Map((empresas || []).map(e => [e.id, e]));

  // Colaboradores com empresa_id inválido (órfão)
  const colabsOrfaos = (colabs || []).filter(c => c.empresa_id && !empresaMap.has(c.empresa_id));
  console.log(`Colaboradores com FK de empresa órfã: ${colabsOrfaos.length}`);

  // Operações por volume existentes
  const { data: operacoes, error: errOp } = await supabase
    .from('operacoes_producao')
    .select('id, data, empresa_id, transportadora_id, fornecedor_id, valor_total, status, tipo_operacao')
    .limit(100);

  const operacoesSemEmpresa = (operacoes || []).filter(o => !o.empresa_id || !empresaMap.has(o.empresa_id));
  console.log(`Total de operações de produção avaliadas: ${operacoes?.length || 0}`);
  console.log(`Operações sem empresa ou com empresa órfã: ${operacoesSemEmpresa.length}`);

  // Salvar dump do resultado em JSON para análise e elaboração do relatório
  const auditReportData = {
    tenantId,
    empresas: {
      total: empresas?.length || 0,
      ativas,
      inativas,
      semCnpj,
      cnpjsDuplicados,
      nomesSemelhantes,
      sinteticasOuProvisorias: sinteticasOuProvisorias.map(e => ({ id: e.id, nome: e.nome, cnpj: e.cnpj, origem: e.origem, ativo: e.ativo })),
      lista: (empresas || []).map(e => ({ id: e.id, nome: e.nome, cnpj: e.cnpj, ativo: e.ativo }))
    },
    colaboradores: {
      total: colabs?.length || 0,
      ativos: colabAtivos,
      inativos: colabInativos,
      clt: cltCount,
      intermitente: intermitenteCount,
      diarista: diaristaCount,
      outros: outroTipoCount,
      semCpf: colabSemCpf,
      cpfsDuplicados,
      semEmpresa: colabSemEmpresa,
      semMatricula: colabSemMatricula,
      colabsOrfaos: colabsOrfaos.map(c => ({ id: c.id, nome: c.nome, empresa_id: c.empresa_id })),
      pendentesRegularizacao: pendentesRegularizacao.map(p => ({ id: p.id, nome: p.nome, motivo: p.motivo })),
      distribuicaoEmpresas: Object.entries(colabsPorEmpresa).map(([empId, qtd]) => ({
        empresaId: empId,
        empresaNome: empresaMap.get(empId)?.nome || 'EMPRESA NÃO ENCONTRADA',
        quantidade: qtd
      }))
    },
    servicosEParametros: {
      servicos: (servicos || []).map(s => ({ id: s.id, nome: s.nome, codigo: s.codigo, ativo: s.ativo })),
      tiposOp: (tiposOp || []).map(t => ({ id: t.id, nome: t.nome, codigo: t.codigo })),
      transportadoras: (transportadoras || []).map(t => ({ id: t.id, nome: t.nome, cnpj: t.cnpj, ativo: t.ativo })),
      fornecedores: (fornecedores || []).map(f => ({ id: f.id, nome: f.nome, cnpj: f.cnpj, ativo: f.ativo })),
      unidades: (unidades || []).map(u => ({ id: u.id, nome: u.nome, empresa_id: u.empresa_id, ativo: u.ativo })),
      produtos: (produtos || []).map(p => ({ id: p.id, nome: p.nome, codigo: p.codigo })),
      regrasOp: (regrasOp || []).length
    },
    integridade: {
      colabsOrfaosCount: colabsOrfaos.length,
      operacoesSemEmpresaCount: operacoesSemEmpresa.length
    }
  };

  fs.writeFileSync('scratch/audit_cadastros_data.json', JSON.stringify(auditReportData, null, 2));
  console.log('\nDados consolidados em scratch/audit_cadastros_data.json com sucesso.');
}

runAudit().catch(err => {
  console.error('ERRO NA AUDITORIA:', err);
  process.exit(1);
});

