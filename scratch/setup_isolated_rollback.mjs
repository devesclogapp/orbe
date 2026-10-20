import fs from 'fs';
import path from 'path';

const origMigration = 'supabase/migrations/20261014180000_fix_cnab_04_remessa_intermitentes_diaristas.sql';
const origContent = fs.readFileSync(origMigration, 'utf8');

// Extrair a função exata de 20261014180000
const startMark = 'CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(';
const endMark = '$$;\n';
const startIndex = origContent.indexOf(startMark);
const endIndex = origContent.indexOf(endMark, startIndex);

if (startIndex === -1 || endIndex === -1) {
  throw new Error('Não foi possível encontrar os marcadores da RPC em 20261014180000');
}

const exactFunctionSql = origContent.substring(startIndex, endIndex + endMark.length);

const rollbackContent = `-- ==============================================================================
-- ORBE ERP — SCRIPT DE ROLLBACK CONTROLADO: FIX DIA-CNAB-04
-- Arquivo: rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql
-- Localização Definitiva: recovery/ (ISOLADO FORA DE supabase/migrations)
--
-- ATENÇÃO: ARQUIVO PREPARADO EXCLUSIVAMENTE PARA RESTAURAÇÃO EM CASO DE CONTINGÊNCIA.
-- NÃO EXECUTAR MANUALMENTE SEM AUTORIZAÇÃO EXPRESSA.
--
-- AÇÕES REALIZADAS PELO ROLLBACK:
-- 1. Remoção do índice parcial uq_cnab_remessas_diaristas_ativo.
-- 2. Restauração integral e verbatim da RPC public.rpc_registrar_cnab_remessa
--    ao seu estado canônico anterior instalado pela migration 20261014180000.
-- 3. Restabelecimento das permissões GRANT EXECUTE para authenticated e service_role.
-- ==============================================================================

BEGIN;

-- 1. REMOVER O ÍNDICE ÚNICO PARCIAL CRIADO PELO FIX DIA-CNAB-04
DROP INDEX IF EXISTS public.uq_cnab_remessas_diaristas_ativo;

-- 2. RESTAURAR A DEFINIÇÃO EXATA DA RPC CANÔNICA ANTERIOR (MIGRATION 20261014180000)
${exactFunctionSql}

-- 3. RESTABELECER PERMISSÕES CANÔNICAS DE EXECUÇÃO
GRANT EXECUTE ON FUNCTION public.rpc_registrar_cnab_remessa TO authenticated, service_role;

-- 4. COMENTÁRIO EXPLICATIVO NO BANCO
COMMENT ON FUNCTION public.rpc_registrar_cnab_remessa IS 'RPC canônica restaurada via rollback do FIX DIA-CNAB-04 para a versão 20261014180000';

COMMIT;
`;

// Criar pasta recovery se não existir
if (!fs.existsSync('recovery')) {
  fs.mkdirSync('recovery');
}

const targetFile = 'recovery/rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql';
fs.writeFileSync(targetFile, rollbackContent, 'utf8');
console.log('Rollback salvo em:', targetFile);

// Remover o arquivo de dentro de supabase/migrations se existir
const oldFile = 'supabase/migrations/rollback_20261018150000_fix_dia_cnab_04_atomic_idempotency.sql';
if (fs.existsSync(oldFile)) {
  fs.unlinkSync(oldFile);
  console.log('Arquivo antigo removido com sucesso de:', oldFile);
}
