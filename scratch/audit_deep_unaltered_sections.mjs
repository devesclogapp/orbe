import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const propFile = fs.readFileSync('supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

// Function extraction
const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origFunc = getFunc(origFile);
const propFunc = getFunc(propFile);

// Check differences outside of the Diaristas branch
console.log('=== VERIFICAÇÃO DE INTEGRIDADE DAS SEÇÕES INALTERADAS ===\n');

// 1. get_next_cnab_sequencial
const origSeq = origFunc.split('\n').filter(l => l.includes('get_next_cnab_sequencial'))[0].trim();
const propSeq = propFunc.split('\n').filter(l => l.includes('get_next_cnab_sequencial'))[0].trim();
console.log('1. get_next_cnab_sequencial:');
console.log('   ORIG:', origSeq);
console.log('   PROP:', propSeq);
console.log('   MATCH:', origSeq === propSeq ? 'SIM (100% IDÊNTICO)' : 'NÃO');

// 2. ORBE_SIMULACAO_CNAB_V1 contract validation length and content
const getSimulacaoBlock = (text) => {
  const start = text.indexOf("-- 5.5 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)") !== -1
    ? text.indexOf("-- 5.5 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)")
    : text.indexOf("-- 5.6 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)");
  const end = text.indexOf("-- 5.6 Bloqueio Concorrente", start) !== -1
    ? text.indexOf("-- 5.6 Bloqueio Concorrente", start)
    : text.indexOf("-- 5.7 Bloqueio Concorrente", start);
  return text.substring(start, end).trim();
};

const origSim = getSimulacaoBlock(origFunc);
const propSim = getSimulacaoBlock(propFunc);
console.log('\n2. ORBE_SIMULACAO_CNAB_V1 Block:');
console.log('   Orig length:', origSim.length, 'Prop length:', propSim.length);
console.log('   MATCH:', origSim === propSim ? 'SIM (100% IDÊNTICO)' : 'DIVERGÊNCIA');

// 3. CLT, Intermitentes, Faturas validation in loop
const getItemsBlock = (text) => {
  const start = text.indexOf("-- 5.8 Validação Estrita de Existência, Tenant, Empresa e Ambiente de TODOS os Itens");
  const end = text.indexOf("-- 5.9 Conferência Estrita de Totalizadores", start);
  return text.substring(start, end).trim();
};

const origItems = getItemsBlock(origFunc);
const propItems = getItemsBlock(propFunc);
console.log('\n3. Validação de Itens (CLT, Intermitentes, Faturas):');
console.log('   Orig length:', origItems.length, 'Prop length:', propItems.length);
console.log('   MATCH:', origItems === propItems ? 'SIM (100% IDÊNTICO)' : 'DIVERGÊNCIA');

// 4. Inserção de itens e transição de CLT e Faturas
const getTransitionBlock = (text) => {
  const start = text.indexOf("-- 5.12 Inserção dos Itens da Remessa e Transição Homologada de Itens Físicos");
  const end = text.indexOf("-- 5.13 Transição Atômica de Status dos Lotes Pai", start);
  return text.substring(start, end).trim();
};

const origTrans = getTransitionBlock(origFunc);
const propTrans = getTransitionBlock(propFunc);
console.log('\n4. Transição de Itens (CLT e Faturas):');
console.log('   Orig length:', origTrans.length, 'Prop length:', propTrans.length);
console.log('   MATCH:', origTrans === propTrans ? 'SIM (100% IDÊNTICO)' : 'DIVERGÊNCIA');

// 5. Transição de lotes pai
const getLotesPaiBlock = (text) => {
  const start = text.indexOf("-- 5.13 Transição Atômica de Status dos Lotes Pai");
  const end = text.indexOf("-- 5.14 Registro de Auditoria Bancária", start);
  return text.substring(start, end).trim();
};

const origPai = getLotesPaiBlock(origFunc);
const propPai = getLotesPaiBlock(propFunc);
console.log('\n5. Transição de Lotes Pai:');
console.log('   Orig length:', origPai.length, 'Prop length:', propPai.length);
console.log('   MATCH:', origPai === propPai ? 'SIM (100% IDÊNTICO)' : 'DIVERGÊNCIA');
