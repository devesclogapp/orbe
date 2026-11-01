import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

async function run() {
  console.log('[Fix07 Capture] Autenticando com Supabase...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Fix07 Capture] Erro de autenticação:', error.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const outputDir = path.resolve('scratch/fix07_captures');
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

  // 1.1 Central de Cadastros - Visão Geral (4 KPIs, Toolbar sem botão redundante, Filtros rápidos sem poluição, Tabela com Prioridade/Governança/Status)
  console.log('[1/4] Central de Cadastros - Colaboradores (1440x900)...');
  await page1440.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page1440.waitForTimeout(1500);
  await page1440.screenshot({ path: path.join(outputDir, '01_cadastros_visao_geral_1440.png'), fullPage: false });

  // 1.2 Detalhe dos 4 KPIs superiores e Filtros Rápidos (Crop ou Screenshot focado)
  console.log('[2/4] Detalhe dos KPIs e Filtros Rápidos (1440x900)...');
  await page1440.screenshot({ path: path.join(outputDir, '02_cadastros_kpis_e_filtros_1440.png'), clip: { x: 260, y: 70, width: 1150, height: 480 } });

  // 1.3 Detalhe da Tabela de Colaboradores (Colunas Prioridade, Governança, Status, Contratos)
  console.log('[3/4] Detalhe da Tabela de Colaboradores (1440x900)...');
  await page1440.screenshot({ path: path.join(outputDir, '03_cadastros_tabela_colaboradores_1440.png'), clip: { x: 260, y: 440, width: 1150, height: 440 } });

  // --- 2. VIEWPORT 1366x768 ---
  console.log('\n--- Capturando Viewport 1366x768 ---');
  const ctx1366 = await createContext(1366, 768);
  const page1366 = await ctx1366.newPage();

  console.log('[4/4] Central de Cadastros em 1366x768 HD Notebook...');
  await page1366.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page1366.waitForTimeout(1500);
  await page1366.screenshot({ path: path.join(outputDir, '04_cadastros_colaboradores_1366x768.png'), fullPage: false });

  await browser.close();
  console.log('\n[Fix07 Capture] Todas as capturas foram concluídas com sucesso em scratch/fix07_captures!');
}

run().catch((err) => {
  console.error('[Fix07 Capture] Erro:', err);
  process.exit(1);
});
