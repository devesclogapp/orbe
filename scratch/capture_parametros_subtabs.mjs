import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('[Capture] Iniciando autenticação...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Capture] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await context.newPage();

  // 1. Subaba: Tipos de Operação
  console.log('[Capture] Acessando Tipos de Operação...');
  await page.goto('http://localhost:8080/cadastros?tab=parametros&subtab=operacao', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scratch/parametros_subtab_operacao.png', fullPage: false });
  console.log('[Capture] Salvo: scratch/parametros_subtab_operacao.png');

  // 2. Subaba: Produtos
  console.log('[Capture] Acessando Produtos...');
  await page.goto('http://localhost:8080/cadastros?tab=parametros&subtab=produtos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scratch/parametros_subtab_produtos.png', fullPage: false });
  console.log('[Capture] Salvo: scratch/parametros_subtab_produtos.png');

  // 3. Subaba: Tipos de Dia
  console.log('[Capture] Acessando Tipos de Dia...');
  await page.goto('http://localhost:8080/cadastros?tab=parametros&subtab=dia', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scratch/parametros_subtab_dia.png', fullPage: false });
  console.log('[Capture] Salvo: scratch/parametros_subtab_dia.png');

  await browser.close();
  console.log('[Capture] Todas as 3 capturas foram geradas com sucesso!');
}

run().catch((err) => {
  console.error('[Capture] Erro fatal:', err);
  process.exit(1);
});
