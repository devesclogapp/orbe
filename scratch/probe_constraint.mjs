import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function inspectConstraintError() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha auth:', authErr.message);
    process.exit(1);
  }

  console.log('--- TESTE READ-ONLY DE CHECK CONSTRAINT cnab_auditoria_bancaria_acao_check ---');

  // Tentativa de insert com ação inválida qualquer
  const { data, error } = await supabase
    .from('cnab_auditoria_bancaria')
    .insert({
      acao: 'ACAO_TESTE_INEXISTENTE',
      detalhes: { teste: true }
    });

  console.log('Resultado insert com ACAO_TESTE_INEXISTENTE:');
  console.log('Error:', error);

  // Tentativa de insert com 'RETORNO_PROCESSADO_SIMULADO'
  const { data: d2, error: e2 } = await supabase
    .from('cnab_auditoria_bancaria')
    .insert({
      acao: 'RETORNO_PROCESSADO_SIMULADO',
      detalhes: { teste: true }
    });

  console.log('\nResultado insert com RETORNO_PROCESSADO_SIMULADO:');
  console.log('Error:', e2);

  // Tentativa de insert com 'processamento_retorno'
  // (NÃO vamos executar para não persistir sujeira em produção, ou testamos com dados que violam outra constraint como tenant_id not null)
  const { data: d3, error: e3 } = await supabase
    .from('cnab_auditoria_bancaria')
    .insert({
      acao: 'processamento_retorno',
      tenant_id: '00000000-0000-0000-0000-000000000000' // violará foreign key de tenant se passar a check constraint!
    });

  console.log('\nResultado insert com processamento_retorno (com tenant dummy):');
  console.log('Error:', e3);
}

inspectConstraintError();
