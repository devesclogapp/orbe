import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('[CONV-20 Audit] Autenticando com Supabase...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[CONV-20 Audit] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const outputDir = path.resolve('scratch/conv20_audit_captures');
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

  // 1.1 Regras Operacionais - Tab Operacional (Padrão)
  console.log('[1/7] Regras Operacionais - Operacional (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=operacional', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '01_regras_operacionais_1440.png'), fullPage: false });

  // 1.2 Modal Nova Regra Operacional (Wizard)
  console.log('[2/7] Modal Nova Regra (1440x900)...');
  const novaRegraBtn = page1440.locator('button:has-text("Nova Regra")').first();
  if (await novaRegraBtn.isVisible()) {
    await novaRegraBtn.click();
    await page1440.waitForTimeout(600);
    await page1440.screenshot({ path: path.join(outputDir, '02_regras_modal_wizard_1440.png'), fullPage: false });
    // Fecha modal
    await page1440.keyboard.press('Escape');
    await page1440.waitForTimeout(400);
  }

  // 1.3 Tab Diaristas
  console.log('[3/7] Regras Operacionais - Diaristas (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=diaristas', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1000);
  await page1440.screenshot({ path: path.join(outputDir, '03_regras_diaristas_1440.png'), fullPage: false });

  // 1.4 Tab Meios de Pagamento
  console.log('[4/7] Regras Operacionais - Meios de Pagamento (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=meios_pagamento', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1000);
  await page1440.screenshot({ path: path.join(outputDir, '04_regras_meios_pagamento_1440.png'), fullPage: false });

  // 1.5 Tab Taxas e Impostos
  console.log('[5/7] Regras Operacionais - Taxas e Impostos (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=taxas_impostos', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1000);
  await page1440.screenshot({ path: path.join(outputDir, '05_regras_taxas_impostos_1440.png'), fullPage: false });

  // 1.6 Tab Períodos Operacionais (especificos)
  console.log('[6/7] Regras Operacionais - Períodos Operacionais (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros/regras-operacionais?tab=especificos', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1000);
  await page1440.screenshot({ path: path.join(outputDir, '06_regras_periodos_especificos_1440.png'), fullPage: false });

  // --- 2. VIEWPORT 1366x768 ---
  console.log('\n--- Capturando Viewport 1366x768 ---');
  const ctx1366 = await createContext(1366, 768);
  const page1366 = await ctx1366.newPage();

  console.log('[7/7] Regras Operacionais em 1366x768 HD Notebook...');
  await page1366.goto('http://localhost:8080/cadastros/regras-operacionais?tab=operacional', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '07_regras_operacionais_1366x768.png'), fullPage: false });

  await browser.close();
  console.log('\n[CONV-20 Audit] Capturas concluídas com sucesso em scratch/conv20_audit_captures!');
}

run().catch((err) => {
  console.error('[CONV-20 Audit] Erro:', err);
  process.exit(1);
});
