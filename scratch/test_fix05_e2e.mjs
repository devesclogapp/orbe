import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

const outputDir = path.resolve('scratch/fix05_captures');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
  console.log('--- TESTE E2E FIX 05: SELETOR DE LINHAS POR PÁGINA E PRESERVAÇÃO DE ROLAGEM ---');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Erro de autenticação Supabase:', error);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, {
    storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
    session: data.session
  });

  const page = await ctx.newPage();

  // ==========================================
  // PARTE 1: CENTRAL DE CADASTROS (/cadastros?tab=colaboradores)
  // ==========================================
  console.log('\n[1] Testando Central de Cadastros (/cadastros?tab=colaboradores)...');
  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1.1 Rola para a tabela e localiza a barra de paginação
  const selectCentral = page.locator('#central-cadastros-page-size');
  await selectCentral.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const initialScrollY = await page.evaluate(() => window.scrollY);
  console.log(`Posição de rolagem inicial (com paginação visível): ${initialScrollY}px`);

  // 1.2 Estado Inicial (15 por página)
  let rowCount = await page.locator('tbody tr').count();
  let textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  let textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Inicial (15): ${rowCount} linhas | Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);

  if (rowCount !== 15) throw new Error(`Esperado 15 linhas inicialmente, obtido ${rowCount}`);

  // Captura Inicial 15 por página
  await page.screenshot({ path: path.join(outputDir, '01_cadastros_15porpag_1440.png'), fullPage: false });

  // 1.3 Mudar de 15 para 25
  console.log('\n[1.3] Alterando para 25 linhas por página...');
  await selectCentral.selectOption('25');
  await page.waitForTimeout(500);

  let scrollAfter25 = await page.evaluate(() => window.scrollY);
  console.log(`ScrollY após mudar para 25: ${scrollAfter25}px (delta: ${scrollAfter25 - initialScrollY}px)`);
  if (Math.abs(scrollAfter25 - initialScrollY) > 50) {
    throw new Error(`Salto indevido de rolagem detectado! Inicial: ${initialScrollY}, Atual: ${scrollAfter25}`);
  }

  rowCount = await page.locator('tbody tr').count();
  textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Resultado (25): ${rowCount} linhas | Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);
  if (rowCount !== 25) throw new Error(`Esperado 25 linhas, obtido ${rowCount}`);

  // 1.4 Mudar de 25 para 50
  console.log('\n[1.4] Alterando para 50 linhas por página...');
  await selectCentral.selectOption('50');
  await page.waitForTimeout(500);

  let scrollAfter50 = await page.evaluate(() => window.scrollY);
  console.log(`ScrollY após mudar para 50: ${scrollAfter50}px (delta: ${scrollAfter50 - initialScrollY}px)`);
  if (Math.abs(scrollAfter50 - initialScrollY) > 50) {
    throw new Error(`Salto indevido de rolagem detectado! Inicial: ${initialScrollY}, Atual: ${scrollAfter50}`);
  }

  rowCount = await page.locator('tbody tr').count();
  textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Resultado (50): ${rowCount} linhas | Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);
  if (rowCount !== 50) throw new Error(`Esperado 50 linhas, obtido ${rowCount}`);

  // Captura 50 por página com scroll preservado
  await page.screenshot({ path: path.join(outputDir, '02_cadastros_50porpag_1440.png'), fullPage: false });

  // 1.5 Mudar de 50 para 100
  console.log('\n[1.5] Alterando para 100 linhas por página...');
  await selectCentral.selectOption('100');
  await page.waitForTimeout(500);

  let scrollAfter100 = await page.evaluate(() => window.scrollY);
  console.log(`ScrollY após mudar para 100: ${scrollAfter100}px (delta: ${scrollAfter100 - initialScrollY}px)`);

  rowCount = await page.locator('tbody tr').count();
  textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Resultado (100): ${rowCount} linhas | Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);
  if (rowCount !== 95) throw new Error(`Esperado 95 linhas (total cadastrado), obtido ${rowCount}`);

  // Captura 100 por página
  await page.screenshot({ path: path.join(outputDir, '03_cadastros_100porpag_1440.png'), fullPage: false });

  // 1.6 Retornar para 15
  console.log('\n[1.6] Retornando para 15 linhas por página...');
  await selectCentral.selectOption('15');
  await page.waitForTimeout(500);

  rowCount = await page.locator('tbody tr').count();
  textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Retorno (15): ${rowCount} linhas | Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);
  if (rowCount !== 15) throw new Error(`Esperado 15 linhas no retorno, obtido ${rowCount}`);

  // 1.7 Testar Reset para Página 1 ao mudar de página
  console.log('\n[1.7] Testando Reset de Página...');
  const nextBtn = page.locator('button[aria-label="Próxima página"]');
  await nextBtn.click();
  await page.waitForTimeout(400);

  textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Página avançada: Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);

  // Agora muda para 25: deve voltar automaticamente para Página 1
  await selectCentral.selectOption('25');
  await page.waitForTimeout(400);
  textInterval = await page.locator('text=/Exibindo .* de /').first().textContent();
  textPages = await page.locator('text=/Página .* de /').first().textContent();
  console.log(`Após mudar tamanho da página: Intervalo: "${textInterval?.trim()}" | ${textPages?.trim()}`);
  if (!textInterval?.includes('1–25')) {
    throw new Error(`Esperado reset para Página 1 (1–25), obtido ${textInterval}`);
  }

  // ==========================================
  // PARTE 2: GESTÃO DETALHADA (/colaboradores)
  // ==========================================
  console.log('\n[2] Testando Gestão Detalhada (/colaboradores)...');
  await page.goto('http://localhost:8080/colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const selectDetalhada = page.locator('#colaboradores-detalhada-page-size');
  await selectDetalhada.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const detalhadaScrollY = await page.evaluate(() => window.scrollY);
  console.log(`Posição de rolagem inicial na Gestão Detalhada: ${detalhadaScrollY}px`);

  let countDetalhada = await page.locator('tbody tr').count();
  console.log(`Linhas iniciais Gestão Detalhada: ${countDetalhada}`);

  // Altera para 50
  console.log('Alterando para 50 linhas por página na Gestão Detalhada...');
  await selectDetalhada.selectOption('50');
  await page.waitForTimeout(500);

  const detalhadaScrollAfter50 = await page.evaluate(() => window.scrollY);
  console.log(`ScrollY após 50 na Gestão Detalhada: ${detalhadaScrollAfter50}px (delta: ${detalhadaScrollAfter50 - detalhadaScrollY}px)`);

  countDetalhada = await page.locator('tbody tr').count();
  let textIntervalDet = await page.locator('text=/Exibindo .* de /').first().textContent();
  console.log(`Resultado Gestão Detalhada (50): ${countDetalhada} linhas | Intervalo: "${textIntervalDet?.trim()}"`);
  if (countDetalhada !== 50) throw new Error(`Esperado 50 linhas na Gestão Detalhada, obtido ${countDetalhada}`);

  // Captura Gestão Detalhada 50 por página
  await page.screenshot({ path: path.join(outputDir, '04_gestao_detalhada_50porpag_1440.png'), fullPage: false });

  // Evidência de scroll preservado na Central de Cadastros
  console.log('\n[3] Gerando evidência de rolagem preservada (vista com barra de paginação e tabela visíveis)...');
  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const selectCentralRev = page.locator('#central-cadastros-page-size');
  await selectCentralRev.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await selectCentralRev.selectOption('50');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, '05_evidencia_rolagem_preservada.png'), fullPage: false });

  await browser.close();
  console.log('\n✅ TODOS OS TESTES E2E PASSARAM COM 100% DE SUCESSO!');
}

run().catch((err) => {
  console.error('\n❌ ERRO NO TESTE E2E:', err);
  process.exit(1);
});
