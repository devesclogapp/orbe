import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

// Replica exata de getColaboradorCompletudeDetailed de core.service.ts
function getColaboradorCompletudeDetailed(payload) {
  const isCLT = String(payload.tipo_colaborador ?? '').toUpperCase() === 'CLT' || String(payload.regime_trabalho).toUpperCase() === 'CLT';
  
  const nome = String(payload.nome ?? '').trim();
  const cpf = String(payload.cpf ?? '').replace(/\D/g, '');
  const matricula = String(payload.matricula ?? payload.rhid_person_id ?? '').trim();
  const empresaId = payload.empresa_id;
  const tipoColab = String(payload.tipo_colaborador ?? '').trim();
  const cargo = String(payload.cargo ?? '').trim();
  const pis = String(payload.pis ?? '').replace(/\D/g, '').trim();
  const tipoContrato = String(payload.tipo_contrato ?? payload.modelo_calculo ?? '').trim();
  
  // Operacional Checks
  const pendenciasOperacionais = [];
  if (!nome) pendenciasOperacionais.push("Nome");
  if (!cpf || cpf.length !== 11) pendenciasOperacionais.push("CPF");
  if (!matricula) pendenciasOperacionais.push("Matrícula/ID");
  if (!empresaId) pendenciasOperacionais.push("Empresa vinculada");
  if (!tipoColab) pendenciasOperacionais.push("Tipo de colaborador");
  const operacionalCompleto = pendenciasOperacionais.length === 0;

  // RH Checks
  const pendenciasRh = [];
  if (!cargo) pendenciasRh.push("Cargo/Função");
  if (isCLT && pis.length !== 11) pendenciasRh.push("PIS");
  if (!tipoContrato) pendenciasRh.push("Modelo de cálculo/contrato");
  if (!empresaId) pendenciasRh.push("Empresa vinculada");
  if (!matricula) pendenciasRh.push("Matrícula/ID");
  
  const valorBase = Number(payload.salario_base ?? payload.valor_hora ?? payload.valor_diaria ?? payload.valor_base ?? 0);
  if (valorBase <= 0) pendenciasRh.push("Valor base aplicável (salário/hora/diária)");
  const rhCompleto = pendenciasRh.length === 0;

  // Financeiro Checks
  const pendenciasFinanceiras = [];
  const nomeBancario = String(payload.nome_completo ?? '').trim();
  const bancoCodigo = String(payload.banco_codigo ?? '').trim();
  const agencia = String(payload.agencia ?? '').trim();
  const conta = String(payload.conta ?? '').trim();
  const tipoConta = String(payload.tipo_conta ?? '').trim();

  if (!nomeBancario) pendenciasFinanceiras.push("Titular (nome na conta)");
  if (!bancoCodigo) pendenciasFinanceiras.push("Código do banco");
  if (!agencia) pendenciasFinanceiras.push("Agência");
  if (!conta) pendenciasFinanceiras.push("Conta");
  if (!tipoConta) pendenciasFinanceiras.push("Tipo de conta");
  
  const financeiroCompleto = pendenciasFinanceiras.length === 0;

  return {
    operacional: { completo: operacionalCompleto, pendencias: pendenciasOperacionais },
    rh: { completo: rhCompleto, pendencias: pendenciasRh },
    financeiro: { completo: financeiroCompleto, pendencias: pendenciasFinanceiras },
    falhas: [...new Set([...pendenciasOperacionais, ...pendenciasRh, ...pendenciasFinanceiras])]
  };
}

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  await supabase.auth.signInWithPassword({ email: 'e2e-test@orbe.local', password: '123456' });

  const { data: colab } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('id', 'f4654fac-bf67-43be-b975-f214c6cf13d2')
    .single();

  const res = getColaboradorCompletudeDetailed(colab);
  console.log("Completude do Rodrigo Ferreira Do Rosario:");
  console.log(JSON.stringify(res, null, 2));
}

run();
