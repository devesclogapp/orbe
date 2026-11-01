import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

const brainDir = 'C:/Users/flavi/.gemini/antigravity-ide/brain/7d6df746-6326-40b9-ae55-c214bf059c3e';

async function run() {
  console.log('[CONV-20 Etapa 03] Autenticando com Supabase...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[CONV-20 Etapa 03] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const outputDir = path.resolve('scratch/conv20_etapa03_captures');
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
  console.log('\n--- Capturando Viewport 1440x900 ---');
  const ctx1440 = await createContext(1440, 900);
  const page1440 = await ctx1440.newPage();

  // 1.1 Diaristas
  console.log('[1/8] Diaristas (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=diaristas', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1200);
  const file1 = path.join(outputDir, '01_etapa03_diaristas_1440x900.png');
  await page1440.screenshot({ path: file1, fullPage: false });

  // 1.2 Meios de Pagamento
  console.log('[2/8] Meios de Pagamento (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=meios_pagamento', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1200);
  const file2 = path.join(outputDir, '02_etapa03_meios_pagamento_1440x900.png');
  await page1440.screenshot({ path: file2, fullPage: false });

  // 1.3 Taxas e Impostos
  console.log('[3/8] Taxas e Impostos (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=taxas_impostos', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  const file3 = path.join(outputDir, '03_etapa03_taxas_impostos_1440x900.png');
  await page1440.screenshot({ path: file3, fullPage: false });

  // 1.4 Períodos Operacionais
  console.log('[4/8] Períodos Operacionais (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=especificos', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1200);
  const file4 = path.join(outputDir, '04_etapa03_periodos_especificos_1440x900.png');
  await page1440.screenshot({ path: file4, fullPage: false });

  // --- 2. VIEWPORT 1366x768 ---
  console.log('\n--- Capturando Viewport 1366x768 (Notebook HD) ---');
  const ctx1366 = await createContext(1366, 768);
  const page1366 = await ctx1366.newPage();

  // 2.1 Diaristas 1366
  console.log('[5/8] Diaristas (1366x768)...');
  await page1366.goto('http://localhost:8080/cadastros/regras-operacionais?tab=diaristas', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1200);
  const file5 = path.join(outputDir, '05_etapa03_diaristas_1366x768.png');
  await page1366.screenshot({ path: file5, fullPage: false });

  // 2.2 Meios de Pagamento 1366
  console.log('[6/8] Meios de Pagamento (1366x768)...');
  await page1366.goto('http://localhost:8080/cadastros/regras-operacionais?tab=meios_pagamento', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1200);
  const file6 = path.join(outputDir, '06_etapa03_meios_pagamento_1366x768.png');
  await page1366.screenshot({ path: file6, fullPage: false });

  // 2.3 Taxas e Impostos 1366
  console.log('[7/8] Taxas e Impostos (1366x768)...');
  await page1366.goto('http://localhost:8080/cadastros/regras-operacionais?tab=taxas_impostos', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  const file7 = path.join(outputDir, '07_etapa03_taxas_impostos_1366x768.png');
  await page1366.screenshot({ path: file7, fullPage: false });

  // 2.4 Períodos Operacionais 1366
  console.log('[8/8] Períodos Operacionais (1366x768)...');
  await page1366.goto('http://localhost:8080/cadastros/regras-operacionais?tab=especificos', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1200);
  const file8 = path.join(outputDir, '08_etapa03_periodos_especificos_1366x768.png');
  await page1366.screenshot({ path: file8, fullPage: false });

  await browser.close();

  // Copia as capturas para o diretório de artefatos
  if (fs.existsSync(brainDir)) {
    console.log('\nCopiando capturas para o diretório de artefatos...');
    const files = fs.readdirSync(outputDir);
    for (const f of files) {
      if (f.endsWith('.png')) {
        fs.copyFileSync(path.join(outputDir, f), path.join(brainDir, f));
      }
    }
  }

  console.log('\n[CONV-20 Etapa 03] Capturas concluídas com sucesso!');
}

run().catch((err) => {
  console.error('[CONV-20 Etapa 03] Erro:', err);
  process.exit(1);
});
