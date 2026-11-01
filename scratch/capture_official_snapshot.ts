import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lifgjtcflzmspilhryap.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@orbe.local';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '123456';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function captureOfficialBackup() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }

  const loteId = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  const remessaId = '46391aad-6417-48cf-ac78-03a2a9dd8b22';

  // 1. diaristas_lotes_fechamento
  const { data: lote, error: errLote } = await supabase
    .from('diaristas_lotes_fechamento')
    .select('*')
    .eq('id', loteId)
    .single();

  // 2. lancamentos_diaristas
  const { data: lancamentos, error: errLanc } = await supabase
    .from('lancamentos_diaristas')
    .select('*')
    .eq('lote_fechamento_id', loteId);

  // 3. cnab_remessas_arquivos
  const { data: remessas, error: errRem } = await supabase
    .from('cnab_remessas_arquivos')
    .select('*')
    .eq('id', remessaId);

  // 4. cnab_remessa_itens
  const { data: itens, error: errItens } = await supabase
    .from('cnab_remessa_itens')
    .select('*')
    .eq('remessa_id', remessaId);

  console.log('--- INVENTÁRIO DO BACKUP LÓGICO ---');
  console.log('1. diaristas_lotes_fechamento:', lote ? '1 registro' : 'ERRO', errLote || '');
  console.log('2. lancamentos_diaristas:', lancamentos?.length, 'registros', errLanc || '');
  console.log('3. cnab_remessas_arquivos:', remessas?.length, 'registros', errRem || '');
  console.log('4. cnab_remessa_itens:', itens?.length, 'registros', errItens || '');

  const snapshot = {
    metadata: {
      generated_at: new Date().toISOString(),
      source_host: 'lifgjtcflzmspilhryap.supabase.co',
      tenant_id: lote?.tenant_id,
      empresa_id: lote?.empresa_id,
      lote_id: loteId,
      remessa_id: remessaId,
      description: 'Snapshot lógico estrito das tabelas oficiais antes da migration FIX DIA-CNAB-04'
    },
    tables: {
      diaristas_lotes_fechamento: lote,
      lancamentos_diaristas: lancamentos,
      cnab_remessas_arquivos: remessas,
      cnab_remessa_itens: itens
    }
  };

  const backupPath = 'C:\\Users\\flavi\\.gemini\\antigravity-ide\\brain\\8555a217-375b-4891-bb6b-7e3cf5a8dd5d\\scratch\\backup_logico_pre_migration_fix_dia_cnab_04.json';
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log('Snapshot salvo com sucesso em:', backupPath);
}

captureOfficialBackup();
