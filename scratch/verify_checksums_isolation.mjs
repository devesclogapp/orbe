import fs from 'fs';
import crypto from 'crypto';

const origFile = 'supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql';
const rollbackFile = 'recovery/rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql';
const migrationFile = 'supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql';

const origContent = fs.readFileSync(origFile, 'utf8');
const rollbackContent = fs.readFileSync(rollbackFile, 'utf8');
const migrationContent = fs.readFileSync(migrationFile, 'utf8');

const getFunc = (text) => {
  const start = text.indexOf('CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(');
  const end = text.indexOf('$$;', start);
  return text.substring(start, end + 3).trim();
};

const origFunc = getFunc(origContent);
const rollFunc = getFunc(rollbackContent);

console.log('Comparação exata da função (com comentários e espaçamento):', origFunc === rollFunc ? '100% IDÊNTICA (ZERO DIVERGÊNCIA)' : 'DIVERGÊNCIA DETECTADA');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

console.log('\n--- CHECKSUMS SHA-256 ---');
console.log('1. Migration FIX DIA-CNAB-04:');
console.log('   Arquivo:', migrationFile);
console.log('   SHA256: ', sha256(fs.readFileSync(migrationFile)));

console.log('\n2. Script de Rollback Isolado:');
console.log('   Arquivo:', rollbackFile);
console.log('   SHA256: ', sha256(fs.readFileSync(rollbackFile)));

console.log('\n3. Migration Anterior de Referência:');
console.log('   Arquivo:', origFile);
console.log('   SHA256: ', sha256(fs.readFileSync(origFile)));

// Verificar se existe algum arquivo rollback restante em supabase/migrations
const remainingRollbacks = fs.readdirSync('supabase/migrations').filter(f => f.toLowerCase().includes('rollback'));
console.log('\nArquivos de rollback dentro de supabase/migrations:', remainingRollbacks.length === 0 ? 'NENHUM (ISOLAMENTO CONFIRMADO)' : remainingRollbacks);
