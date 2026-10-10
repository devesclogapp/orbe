import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('[Fix06 Capture] Autenticando com Supabase...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Fix06 Capture] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const outputDir = path.resolve('scratch/fix06_captures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const createContext = async (width, height) => {
    const ctx = await browser.newContext({ viewport: { width, height } });
    await ctx.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });
    return ctx;
  };

  // --- 1. VIEWPORT 1440x900 ---
  console.log('\n--- Testando Viewport 1440x900 ---');
  const ctx1440 = await createContext(1440, 900);
  const page1440 = await ctx1440.newPage();

  // 1.1 Central de Cadastros - Colaboradores (Design System Executivo)
  console.log('[1/7] Central de Cadastros - Colaboradores (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '01_cadastros_colaboradores_executivo_1440.png'), fullPage: false });

  // 1.2 Central de Cadastros - Empresas (Design System Executivo)
  console.log('[2/7] Central de Cadastros - Empresas (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros?tab=empresas', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '02_cadastros_empresas_executivo_1440.png'), fullPage: false });

  // 1.3 Central de Cadastros - Parâmetros Operacionais (Design System Executivo)
  console.log('[3/7] Central de Cadastros - Parâmetros (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros?tab=parametros', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '03_cadastros_parametros_executivo_1440.png'), fullPage: false });

  // 1.4 Gestão Detalhada de Colaboradores (/colaboradores - Design System Executivo)
  console.log('[4/7] Gestão Detalhada de Colaboradores (/colaboradores 1440x900)...');
  await page1440.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '04_gestao_detalhada_executivo_1440.png'), fullPage: false });

  // --- 2. VIEWPORT 1366x768 ---
  console.log('\n--- Testando Viewport 1366x768 ---');
  const ctx1366 = await createContext(1366, 768);
  const page1366 = await ctx1366.newPage();

  console.log('[5/7] Central de Cadastros (1366x768)...');
  await page1366.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '05_cadastros_1366x768.png'), fullPage: false });

  console.log('[6/7] Gestão Detalhada (1366x768)...');
  await page1366.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '06_gestao_detalhada_1366x768.png'), fullPage: false });

  // --- 3. VIEWPORT 1024x768 ---
  console.log('\n--- Testando Viewport 1024x768 ---');
  const ctx1024 = await createContext(1024, 768);
  const page1024 = await ctx1024.newPage();

  console.log('[7/7] Gestão Detalhada (1024x768)...');
  await page1024.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page1024.waitForTimeout(1500);
  await page1024.screenshot({ path: path.join(outputDir, '07_gestao_detalhada_1024x768.png'), fullPage: false });

  await browser.close();
  console.log('\n[Fix06 Capture] Todas as capturas foram concluídas com sucesso em scratch/fix06_captures!');
}

run().catch((err) => {
  console.error('[Fix06 Capture] Erro:', err);
  process.exit(1);
});
