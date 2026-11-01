import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const rollbackFile = fs.readFileSync('supabase/migrations/rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origLines = getFunc(origFile).split('\n').map(l => l.trimEnd());
const rollLines = getFunc(rollbackFile).split('\n').map(l => l.trimEnd());

console.log('Total orig lines:', origLines.length, 'Total roll lines:', rollLines.length);

for (let i = 0; i < Math.min(origLines.length, rollLines.length); i++) {
  if (origLines[i] !== rollLines[i]) {
    console.log(`PRIMEIRA DIFERENÇA na linha ${i+1}:`);
    console.log(`  Orig (${i+1}): "${origLines[i]}"`);
    console.log(`  Roll (${i+1}): "${rollLines[i]}"`);
    console.log('\nOrig context:');
    for (let j = Math.max(0, i - 3); j <= Math.min(origLines.length - 1, i + 5); j++) {
      console.log(`  [${j+1}] ${origLines[j]}`);
    }
    console.log('\nRollback context:');
    for (let j = Math.max(0, i - 3); j <= Math.min(rollLines.length - 1, i + 5); j++) {
      console.log(`  [${j+1}] ${rollLines[j]}`);
    }
    break;
  }
}
