import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const propFile = fs.readFileSync('supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

// Function extraction
const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origLines = getFunc(origFile).split('\n');
const propLines = getFunc(propFile).split('\n');

// Check differences outside of the Diaristas branch
console.log('--- DETALHES DE DIVERGÊNCIA NO BLOCO 2 (SIMULACAO) ---');
const getSimulacaoBlock = (text) => {
  const start = text.indexOf("-- 5.5 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)") !== -1
    ? text.indexOf("-- 5.5 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)")
    : text.indexOf("-- 5.6 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)");
  const end = text.indexOf("-- 5.6 Bloqueio Concorrente", start) !== -1
    ? text.indexOf("-- 5.6 Bloqueio Concorrente", start)
    : text.indexOf("-- 5.7 Bloqueio Concorrente", start);
  return text.substring(start, end).trim();
};

const origSim = getSimulacaoBlock(origFile).split('\n');
const propSim = getSimulacaoBlock(propFile).split('\n');

for (let i = 0; i < Math.max(origSim.length, propSim.length); i++) {
  if (origSim[i] !== propSim[i]) {
    console.log(`Linha ${i+1}:`);
    console.log(`  Orig: "${origSim[i]}"`);
    console.log(`  Prop: "${propSim[i]}"`);
  }
}

console.log('\n--- DETALHES DE DIVERGÊNCIA NO BLOCO 4 (TRANSIÇÃO ITENS) ---');
const getTransitionBlock = (text) => {
  const start = text.indexOf("-- 5.12 Inserção dos Itens da Remessa e Transição Homologada de Itens Físicos");
  const end = text.indexOf("-- 5.13 Transição Atômica de Status dos Lotes Pai", start);
  return text.substring(start, end).trim();
};

const origTrans = getTransitionBlock(origFile).split('\n');
const propTrans = getTransitionBlock(propFile).split('\n');
for (let i = 0; i < Math.max(origTrans.length, propTrans.length); i++) {
  if (origTrans[i] !== propTrans[i]) {
    console.log(`Linha ${i+1}:`);
    console.log(`  Orig: "${origTrans[i]}"`);
    console.log(`  Prop: "${propTrans[i]}"`);
  }
}

console.log('\n--- DETALHES DE DIVERGÊNCIA NO BLOCO 5 (LOTES PAI) ---');
const getLotesPaiBlock = (text) => {
  const start = text.indexOf("-- 5.13 Transição Atômica de Status dos Lotes Pai");
  const end = text.indexOf("-- 5.14 Registro de Auditoria Bancária", start);
  return text.substring(start, end).trim();
};

const origPai = getLotesPaiBlock(origFile).split('\n');
const propPai = getLotesPaiBlock(propFile).split('\n');
for (let i = 0; i < Math.max(origPai.length, propPai.length); i++) {
  if (origPai[i] !== propPai[i]) {
    console.log(`Linha ${i+1}:`);
    console.log(`  Orig: "${origPai[i]}"`);
    console.log(`  Prop: "${propPai[i]}"`);
  }
}
