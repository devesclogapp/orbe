import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const propFile = fs.readFileSync('supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origLines = getFunc(origFile).split('\n');
const propLines = getFunc(propFile).split('\n');

console.log('Orig lines:', origLines.length, 'Prop lines:', propLines.length);

// Compare get_next_cnab_sequencial in both
const findSequencial = (lines, name) => {
  lines.forEach((l, idx) => {
    if (l.includes('get_next_cnab_sequencial')) {
      console.log(`[${name} L${idx+1}]`, l.trim());
    }
  });
};

findSequencial(origLines, 'ORIGINAL');
findSequencial(propLines, 'PROPOSED');

// Compare ORBE_SIMULACAO_CNAB_V1 in both
const findSimulacao = (lines, name) => {
  lines.forEach((l, idx) => {
    if (l.includes('ORBE_SIMULACAO_CNAB_V1') || l.includes('SEQUENCIAL_SIMULADO') || l.includes('FEBRABAN')) {
      console.log(`[${name} L${idx+1}]`, l.trim());
    }
  });
};

findSimulacao(origLines, 'ORIGINAL');
findSimulacao(propLines, 'PROPOSED');
