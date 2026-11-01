import fs from 'fs';
import { diffLines } from 'diff';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const propFile = fs.readFileSync('supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const diff = diffLines(getFunc(origFile), getFunc(propFile));

console.log('=== DIFF ENTRE ORIGINAL (20261014180000) E PROPOSED (20261018150000) ===\n');

diff.forEach(part => {
  if (part.added) {
    console.log(part.value.split('\n').map(l => l ? `+ ${l}` : '').join('\n'));
  } else if (part.removed) {
    console.log(part.value.split('\n').map(l => l ? `- ${l}` : '').join('\n'));
  }
});
