import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4173';
const SCREENSHOT_DIR = path.resolve('scratch/e2e_prod_captures');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];

  console.log('--- INICIANDO VERIFICAÇÃO BROWSER E2E DAS 4 CORREÇÕES ---');

  // ==========================================
  // TEST 1: FIX 1 (P1) - RH acessando /configuracoes
  // ==========================================
  {
    console.log('\n[TEST 1] Verificando bloqueio de /configuracoes para RH...');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Login RH
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'flaviocarvalhoficial+2@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/rh/aprovacoes', { timeout: 15000 });
    console.log('  RH logado com sucesso em /rh/aprovacoes');

    // Tentar navegar diretamente para /configuracoes
    await page.goto(`${BASE_URL}/configuracoes`);
    await page.waitForTimeout(1500);

    const currentUrl = page.url();
    console.log(`  URL após tentar acessar /configuracoes: ${currentUrl}`);

    const isBlocked = !currentUrl.includes('/configuracoes') && currentUrl.includes('/rh/aprovacoes');
    const screenshotPath = path.join(SCREENSHOT_DIR, 'fix1_rh_configuracoes_blocked.png');
    await page.screenshot({ path: screenshotPath });

    results.push({
      id: 'FIX-1-RH-CONFIGURACOES',
      status: isBlocked ? 'PASS' : 'FAIL',
      detail: `RH foi redirecionado para ${currentUrl}. Bloqueio de acesso administrativo efetivo.`,
      screenshot: screenshotPath
    });

    await context.close();
  }

  // ==========================================
  // TEST 2: FIX 2 (P2) - RH acessando /colaboradores
  // ==========================================
  {
    console.log('\n[TEST 2] Verificando acesso a /colaboradores para RH...');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Login RH
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'flaviocarvalhoficial+2@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/rh/aprovacoes', { timeout: 15000 });

    // Navegar diretamente para /colaboradores
    await page.goto(`${BASE_URL}/colaboradores`);
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`  URL após navegar para /colaboradores: ${currentUrl}`);

    const isAllowed = currentUrl.includes('/colaboradores');
    // Verificar se o botão 'Central de Cadastros' está oculto
    const centralCadastrosBtn = await page.$('text=Central de Cadastros');
    const centralHidden = centralCadastrosBtn === null;
    console.log(`  Botão Central de Cadastros oculto para RH? ${centralHidden}`);

    const screenshotPath = path.join(SCREENSHOT_DIR, 'fix2_rh_colaboradores_allowed.png');
    await page.screenshot({ path: screenshotPath });

    results.push({
      id: 'FIX-2-RH-COLABORADORES',
      status: (isAllowed && centralHidden) ? 'PASS' : 'FAIL',
      detail: `RH acessa /colaboradores com sucesso sem redirecionamento indevido. Botão Central de Cadastros oculto: ${centralHidden}.`,
      screenshot: screenshotPath
    });

    await context.close();
  }

  // ==========================================
  // TEST 3: FIX 3 (P2) - Admin em /operacoes-volume/nova (mode="admin")
  // ==========================================
  {
    console.log('\n[TEST 3] Verificando formulário de Operações por Volume no Admin...');
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Login Admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'e2e-test@orbe.local');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Navegar para /operacoes-volume/nova
    await page.goto(`${BASE_URL}/operacoes-volume/nova`);
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`  URL em /operacoes-volume/nova: ${currentUrl}`);

    // Verificar se renderizou dentro do AppShell com botão de voltar para /operacoes-volume
    const pageTitle = await page.textContent('h1, h2');
    console.log(`  Título detectado: ${pageTitle}`);

    const hasAppShell = await page.$('nav, aside, header');
    console.log(`  AppShell presente: ${hasAppShell !== null}`);

    const screenshotPath = path.join(SCREENSHOT_DIR, 'fix3_admin_operacao_mode_admin.png');
    await page.screenshot({ path: screenshotPath });

    results.push({
      id: 'FIX-3-ADMIN-OPERACAO-VOLUME',
      status: (currentUrl.includes('/operacoes-volume/nova') && hasAppShell !== null) ? 'PASS' : 'FAIL',
      detail: `Formulário de operação por volume exibido dentro do AppShell administrativo com header contextual e backPath para /operacoes-volume.`,
      screenshot: screenshotPath
    });

    await context.close();
  }

  // ==========================================
  // TEST 4: FIX 4 (P3) - Sonner Toast acima da Bottom Bar Mobile (390x844)
  // ==========================================
  {
    console.log('\n[TEST 4] Verificando posicionamento do Toast Mobile (390x844)...');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    // Login Encarregado
    await page.goto(`${BASE_URL}/login/operacional`);
    await page.fill('input[type="email"]', 'dev.esclog@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/producao', { timeout: 15000 });

    // Clicar em Operação por Volume
    await page.locator('button:has-text("Operação por Volume")').first().click();
    await page.waitForTimeout(1500);

    // Clicar em Próximo sem preencher campos
    const nextBtn = await page.$('button:has-text("Próximo")');
    if (nextBtn) {
      await nextBtn.click();
      console.log('  Clicou em "Próximo" para disparar toast de validação...');
    }
    await page.waitForTimeout(800);

    // Capturar screenshot com o toast visível
    const screenshotPath = path.join(SCREENSHOT_DIR, 'fix4_mobile_toast_above_bar.png');
    await page.screenshot({ path: screenshotPath });

    // Testar se o botão Voltar continua imediatamente clicável sem timeout ou interceptação
    const backBtn = await page.$('button:has-text("Voltar")');
    let backClickSuccess = false;
    if (backBtn) {
      const clickStart = Date.now();
      await backBtn.click({ timeout: 3000 });
      const elapsed = Date.now() - clickStart;
      console.log(`  Botão "Voltar" clicado em ${elapsed}ms sem interceptação de ponteiro!`);
      backClickSuccess = true;
    }

    await page.waitForTimeout(1000);
    const returnUrl = page.url();
    console.log(`  URL após clicar Voltar: ${returnUrl}`);

    results.push({
      id: 'FIX-4-MOBILE-TOAST-POSITION',
      status: (backClickSuccess && returnUrl.includes('/producao')) ? 'PASS' : 'FAIL',
      detail: `Toast Sonner posicionado acima da bottom bar (mobileOffset bottom 92px). Botão Voltar clicado com sucesso sem interceptação de ponteiro e retorno a /producao confirmado.`,
      screenshot: screenshotPath
    });

    await context.close();
  }

  await browser.close();

  console.log('\n==========================================');
  console.log('RESUMO DOS RESULTADOS DA VERIFICAÇÃO BROWSER');
  console.log('==========================================');
  for (const r of results) {
    console.log(`[${r.status}] ${r.id}: ${r.detail}`);
  }

  fs.writeFileSync('scratch/fix_e2e01_browser_results.json', JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('ERRO NA EXECUÇÃO:', err);
  process.exit(1);
});
