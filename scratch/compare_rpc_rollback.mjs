import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const rollbackFile = fs.readFileSync('supabase/migrations/rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

// Extrair corpo da RPC em ambos
const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origFunc = getFunc(origFile);
const rollbackFunc = getFunc(rollbackFile);

console.log('Orig func length:', origFunc.length);
console.log('Rollback func length:', rollbackFunc.length);

if (origFunc === rollbackFunc) {
  console.log('MATCH PERFEITO! O corpo da função no rollback é 100% IDÊNTICO à migration 20261014180000.');
} else {
  console.log('DIFERENÇA ENCONTRADA!');
  // Comparar linhas
  const origLines = origFunc.split('\n');
  const rollLines = rollbackFunc.split('\n');
  console.log(`Linhas orig: ${origLines.length}, Linhas rollback: ${rollLines.length}`);
  for (let i = 0; i < Math.max(origLines.length, rollLines.length); i++) {
    if (origLines[i] !== rollLines[i]) {
      console.log(`Divergência na linha ${i+1}:`);
      console.log(`  Orig:     ${origLines[i]}`);
      console.log(`  Rollback: ${rollLines[i]}`);
    }
  }
}
