import fs from 'fs';
import { execSync } from 'child_process';

let diffOutput = '';
try {
  diffOutput = execSync(
    'git diff --no-index supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql',
    { encoding: 'utf8' }
  ).toString();
} catch (e) {
  diffOutput = e.stdout ? e.stdout.toString() : '';
}

fs.writeFileSync('scratch/full_git_diff.txt', diffOutput, 'utf8');
console.log('Diff gerado em UTF-8 com sucesso. Total de caracteres:', diffOutput.length);
