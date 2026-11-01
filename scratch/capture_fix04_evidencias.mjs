import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('[Fix04 Capture] Autenticando com Supabase...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Fix04 Capture] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const outputDir = path.resolve('scratch/fix04_captures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Helper para criar contexto com viewport específico
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

  // 1.1 Central de Cadastros - Colaboradores - Página 1
  console.log('[1/9] Acessando Central de Cadastros (Página 1)...');
  await page1440.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '01_cadastros_colaboradores_pag1_1440.png'), fullPage: false });
  console.log('Salvo: 01_cadastros_colaboradores_pag1_1440.png');

  // 1.2 Central de Cadastros - Navegando para Página 2
  console.log('[2/9] Navegando para Página 2 na Central de Cadastros...');
  const nextBtn = page1440.locator('button[aria-label="Próxima página"]');
  if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
    await nextBtn.click();
    await page1440.waitForTimeout(1000);
    await page1440.screenshot({ path: path.join(outputDir, '02_cadastros_colaboradores_pag2_1440.png'), fullPage: false });
    console.log('Salvo: 02_cadastros_colaboradores_pag2_1440.png');
  } else {
    console.log('Botão Próxima página não habilitado');
  }

  // 1.3 Central de Cadastros - 50 registros por página
  console.log('[3/9] Selecionando 50 registros por página...');
  try {
    const selectTrigger = page1440.locator('span:has-text("Linhas por página:")').locator('..').locator('button');
    if (await selectTrigger.isVisible()) {
      await selectTrigger.scrollIntoViewIfNeeded();
      await selectTrigger.click();
      await page1440.waitForTimeout(500);
      const option50 = page1440.locator('div[role="option"]:has-text("50")');
      await option50.click({ force: true });
      await page1440.waitForTimeout(1000);
      await page1440.screenshot({ path: path.join(outputDir, '03_cadastros_colaboradores_50porpag_1440.png'), fullPage: false });
      console.log('Salvo: 03_cadastros_colaboradores_50porpag_1440.png');
    }
  } catch (err) {
    console.warn('Aviso no seletor de 50 registros:', err.message);
  }

  // 1.4 Gestão Detalhada (/colaboradores) - Página 1
  console.log('[4/9] Acessando Gestão Detalhada (Página 1)...');
  await page1440.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '04_gestao_detalhada_pag1_1440.png'), fullPage: false });
  console.log('Salvo: 04_gestao_detalhada_pag1_1440.png');

  // 1.5 Gestão Detalhada - Navegando para Página 2
  console.log('[5/9] Navegando para Página 2 na Gestão Detalhada...');
  const nextBtnGestao = page1440.locator('button[aria-label="Próxima página"]');
  if (await nextBtnGestao.isVisible() && await nextBtnGestao.isEnabled()) {
    await nextBtnGestao.click();
    await page1440.waitForTimeout(1000);
    await page1440.screenshot({ path: path.join(outputDir, '05_gestao_detalhada_pag2_1440.png'), fullPage: false });
    console.log('Salvo: 05_gestao_detalhada_pag2_1440.png');
  }

  await ctx1440.close();

  // --- 2. VIEWPORT 1366x768 ---
  console.log('\n--- Testando Viewport 1366x768 ---');
  const ctx1366 = await createContext(1366, 768);
  const page1366 = await ctx1366.newPage();

  console.log('[6/9] Central de Cadastros em 1366x768...');
  await page1366.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '06_cadastros_1366x768.png'), fullPage: false });
  console.log('Salvo: 06_cadastros_1366x768.png');

  console.log('[7/9] Gestão Detalhada em 1366x768...');
  await page1366.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '07_gestao_detalhada_1366x768.png'), fullPage: false });
  console.log('Salvo: 07_gestao_detalhada_1366x768.png');

  await ctx1366.close();

  // --- 3. VIEWPORT MENOR (1024x768) ---
  console.log('\n--- Testando Viewport Menor (1024x768) ---');
  const ctx1024 = await createContext(1024, 768);
  const page1024 = await ctx1024.newPage();

  console.log('[8/9] Gestão Detalhada em Viewport Menor (1024x768)...');
  await page1024.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page1024.waitForTimeout(1500);
  await page1024.screenshot({ path: path.join(outputDir, '08_gestao_detalhada_1024x768.png'), fullPage: false });
  console.log('Salvo: 08_gestao_detalhada_1024x768.png');

  await ctx1024.close();

  // --- 4. REVALIDAÇÃO DOS PARÂMETROS OPERACIONAIS (FIX 03) ---
  console.log('\n--- Validando Parâmetros Operacionais (FIX 03) ---');
  const ctxParam = await createContext(1440, 900);
  const pageParam = await ctxParam.newPage();

  console.log('[9/9] Parâmetros Operacionais - Tipos de Operação...');
  await pageParam.goto('http://localhost:8080/cadastros?tab=parametros&subtab=operacao', { waitUntil: 'networkidle' });
  await pageParam.waitForTimeout(1500);
  await pageParam.screenshot({ path: path.join(outputDir, '09_parametros_operacao_revalidado.png'), fullPage: false });
  console.log('Salvo: 09_parametros_operacao_revalidado.png');

  await ctxParam.close();
  await browser.close();

  console.log('\n[Fix04 Capture] Processo finalizado com sucesso! Todas as evidências salvas em scratch/fix04_captures.');
}

run().catch((err) => {
  console.error('[Fix04 Capture] Erro fatal:', err);
  process.exit(1);
});
