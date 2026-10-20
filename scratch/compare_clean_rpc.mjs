import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const rollbackFile = fs.readFileSync('supabase/migrations/rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

// Strips single-line comments (-- ...) and blank lines
const clean = (text) => {
  return text
    .split('\n')
    .map(line => line.replace(/--.*$/, '').trim())
    .filter(line => line.length > 0)
    .join('\n');
};

const origClean = clean(getFunc(origFile));
const rollClean = clean(getFunc(rollbackFile));

console.log('Clean orig length:', origClean.length);
console.log('Clean roll length:', rollClean.length);

if (origClean === rollClean) {
  console.log('EXATO! O código executável da RPC no rollback é 100% IDENTICO ao código da migration 20261014180000!');
} else {
  console.log('DIFERENÇA DE CÓDIGO EXECUTÁVEL ENCONTRADA!');
  const o = origClean.split('\n');
  const r = rollClean.split('\n');
  for (let i = 0; i < Math.max(o.length, r.length); i++) {
    if (o[i] !== r[i]) {
      console.log(`Diff na linha limpa ${i+1}:`);
      console.log(`  Orig: ${o[i]}`);
      console.log(`  Roll: ${r[i]}`);
    }
  }
}
