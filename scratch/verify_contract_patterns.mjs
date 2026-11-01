import fs from 'fs';

const origFile = fs.readFileSync('supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql', 'utf8');
const propFile = fs.readFileSync('supabase/migrations/20261018150000_fix_dia_cnab_04_atomic_idempotency.sql', 'utf8');

// List of all functions / calls in both
const checkPatterns = [
  'get_next_cnab_sequencial',
  'ORBE_SIMULACAO_CNAB_V1',
  'SEQUENCIAL_SIMULADO',
  'ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN',
  'rh_financeiro_lote_itens',
  'lancamentos_intermitentes',
  'lancamentos_diaristas',
  'faturas',
  'check_cnab_remessa_imutabilidade'
];

for (const p of checkPatterns) {
  const origCount = (origFile.match(new RegExp(p, 'g')) || []).length;
  const propCount = (propFile.match(new RegExp(p, 'g')) || []).length;
  console.log(`Padrão "${p}": Orig = ${origCount}, Prop = ${propCount}`);
}
