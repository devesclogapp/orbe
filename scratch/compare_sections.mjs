import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const propFile = fs.readFileSync('supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origFunc = getFunc(origFile);
const propFunc = getFunc(propFile);

console.log('--- COMPARAÇÃO DE SEÇÕES ---');
const origSections = origFunc.split(/\n\s*--\s*5\./g);
console.log('Seções no ORIGINAL:');
origSections.forEach((s, idx) => {
  if (idx === 0) return;
  const firstLine = s.split('\n')[0].trim();
  console.log(`  5.${firstLine}`);
});

const propSections = propFunc.split(/\n\s*--\s*5\./g);
console.log('\nSeções no PROPOSED:');
propSections.forEach((s, idx) => {
  if (idx === 0) return;
  const firstLine = s.split('\n')[0].trim();
  console.log(`  5.${firstLine}`);
});
