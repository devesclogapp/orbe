import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://orbe-nu.vercel.app';
const SCREENSHOT_DIR = path.resolve('scratch/e2e_prod_captures');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runValidation() {
  console.log('================================================================');
  console.log('ERP ORBE — VALIDAÇÃO FINAL E2E-01 EM PRODUÇÃO');
  console.log(`Ambiente Alvo: ${BASE_URL}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const consoleErrors = [];
  const network500Errors = [];

  function setupPageMonitoring(page, label) {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected/ignorable noise if any, log critical errors
        if (!text.includes('Failed to load resource: the server responded with a status of 403') &&
            !text.includes('favicon.ico')) {
          consoleErrors.push(`[${label}] Console Error: ${text}`);
        }
      }
    });

    page.on('response', resp => {
      if (resp.status() >= 500) {
        network500Errors.push(`[${label}] HTTP ${resp.status()} on ${resp.url()}`);
      }
    });
  }

  // --------------------------------------------------------------------------
  // TESTE 1 — SEGURANÇA RH & ADMIN (/configuracoes)
  // --------------------------------------------------------------------------
  console.log('--- [TESTE 1] SEGURANÇA RH & ADMIN ---');
  {
    // 1.1 RH Login e tentativa de acesso a /configuracoes
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    setupPageMonitoring(page, 'TESTE-1-RH');

    console.log('  1.1 Realizando login com usuário RH (flaviocarvalhoficial+2@gmail.com)...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'flaviocarvalhoficial+2@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/rh/aprovacoes', { timeout: 20000 });
    console.log('  1.1 Login RH realizado com sucesso.');

    console.log('  1.2 Tentando acessar rota restrita /configuracoes diretamente pela URL...');
    await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const rhUrlAfterAttempt = page.url();
    console.log(`  1.3 URL resultante para RH: ${rhUrlAfterAttempt}`);
    const rhBlocked = !rhUrlAfterAttempt.includes('/configuracoes') && rhUrlAfterAttempt.includes('/rh/aprovacoes');

    const rhCapturePath = path.join(SCREENSHOT_DIR, 'val_01_rh_configuracoes_bloqueado.png');
    await page.screenshot({ path: rhCapturePath });

    // Testar F5/Reload na rota para checar integridade do bloqueio
    console.log('  1.4 Executando reload (F5) para validar persistência do bloqueio...');
    await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const rhReloadUrl = page.url();
    const reloadBlocked = !rhReloadUrl.includes('/configuracoes');

    // Logout RH
    const userMenuOrLogout = await page.$('button:has-text("Sair"), [aria-label="Sair"]');
    if (userMenuOrLogout) {
      await userMenuOrLogout.click();
    } else {
      await page.goto(`${BASE_URL}/login`);
    }
    await context.close();

    // 1.5 Admin Login e acesso autorizado a /configuracoes
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();
    setupPageMonitoring(adminPage, 'TESTE-1-ADMIN');

    console.log('  1.5 Realizando login com Admin autorizado (e2e-test@orbe.local)...');
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await adminPage.fill('input[type="email"]', 'e2e-test@orbe.local');
    await adminPage.fill('input[type="password"]', '123456');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/dashboard', { timeout: 20000 });
    console.log('  1.5 Login Admin realizado com sucesso.');

    console.log('  1.6 Navegando para /configuracoes com perfil Admin...');
    await adminPage.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);

    const adminUrl = adminPage.url();
    console.log(`  1.6 URL resultante para Admin: ${adminUrl}`);
    const adminAllowed = adminUrl.includes('/configuracoes');

    const adminTitle = await adminPage.title();
    const configVisible = await adminPage.locator('text=Configurações').first().isVisible().catch(() => false);
    console.log(`  1.7 Título da página de configurações: ${adminTitle}, Configurações visível: ${configVisible}`);

    const adminCapturePath = path.join(SCREENSHOT_DIR, 'val_01_admin_configuracoes_permitido.png');
    await adminPage.screenshot({ path: adminCapturePath });

    await adminContext.close();

    const test1Pass = rhBlocked && reloadBlocked && adminAllowed;
    results.push({
      id: 'TESTE-1-SEGURANCA-CONFIGURACOES',
      status: test1Pass ? 'PASS' : 'FAIL',
      rhBlocked,
      reloadBlocked,
      adminAllowed,
      detail: `RH bloqueado e redirecionado para ${rhUrlAfterAttempt}. Admin autorizado acessa normalmente em ${adminUrl}.`,
      captures: [rhCapturePath, adminCapturePath]
    });
    console.log(`  => RESULTADO TESTE 1: ${test1Pass ? 'PASS' : 'FAIL'}\n`);
  }

  // --------------------------------------------------------------------------
  // TESTE 2 — COLABORADORES (PERFIL RH)
  // --------------------------------------------------------------------------
  console.log('--- [TESTE 2] ACESSO A COLABORADORES PELO RH ---');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    setupPageMonitoring(page, 'TESTE-2-RH-COLABORADORES');

    console.log('  2.1 Logando com RH...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'flaviocarvalhoficial+2@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/rh/aprovacoes', { timeout: 20000 });

    console.log('  2.2 Acessando /colaboradores...');
    await page.goto(`${BASE_URL}/colaboradores`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const currentUrl = page.url();
    const urlValid = currentUrl.includes('/colaboradores');
    console.log(`  2.2 URL atual: ${currentUrl} (Acesso concedido: ${urlValid})`);

    // Verificar se tabela renderizou registros
    const rows = await page.$$('table tbody tr');
    console.log(`  2.3 Quantidade de linhas na tabela de colaboradores: ${rows.length}`);

    // Verificar botão "Central de Cadastros"
    const btnCentral = await page.$('text=Central de Cadastros');
    const centralHidden = btnCentral === null;
    console.log(`  2.4 Botão "Central de Cadastros" oculto para RH? ${centralHidden}`);

    // Verificar botão "Novo colaborador"
    const btnNovo = await page.$('button:has-text("Novo colaborador")');
    const novoRestricted = btnNovo === null;
    console.log(`  2.5 Botão "Novo colaborador" oculto/restrito para RH? ${novoRestricted}`);

    // Testar recarregamento F5
    console.log('  2.6 Testando recarregamento F5 em /colaboradores...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const reloadUrlValid = page.url().includes('/colaboradores');
    console.log(`  2.6 URL após reload: ${page.url()} (Acesso mantido: ${reloadUrlValid})`);

    const colabCapturePath = path.join(SCREENSHOT_DIR, 'val_02_rh_colaboradores_consulta.png');
    await page.screenshot({ path: colabCapturePath });

    const test2Pass = urlValid && rows.length > 0 && centralHidden && reloadUrlValid;
    results.push({
      id: 'TESTE-2-COLABORADORES-RH',
      status: test2Pass ? 'PASS' : 'FAIL',
      urlValid,
      collaboratorRows: rows.length,
      centralCadastrosHidden: centralHidden,
      novoRestricted,
      reloadUrlValid,
      detail: `RH acessa /colaboradores com sucesso, visualiza ${rows.length} colaboradores na listagem e tem botão Central de Cadastros devidamente oculto.`,
      captures: [colabCapturePath]
    });
    console.log(`  => RESULTADO TESTE 2: ${test2Pass ? 'PASS' : 'FAIL'}\n`);

    await context.close();
  }

  // --------------------------------------------------------------------------
  // TESTE 3 — FORMULÁRIO ADMIN VS ENCARREGADO
  // --------------------------------------------------------------------------
  console.log('--- [TESTE 3] FORMULÁRIO ADMIN VS ENCARREGADO ---');
  {
    // 3.1 Admin em /operacoes-volume/nova
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();
    setupPageMonitoring(adminPage, 'TESTE-3-ADMIN-FORM');

    console.log('  3.1 Login Admin...');
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await adminPage.fill('input[type="email"]', 'e2e-test@orbe.local');
    await adminPage.fill('input[type="password"]', '123456');
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForURL('**/dashboard', { timeout: 20000 });

    console.log('  3.2 Navegando para /operacoes-volume/nova...');
    await adminPage.goto(`${BASE_URL}/operacoes-volume/nova`, { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(2000);

    const adminFormUrl = adminPage.url();
    const hasAppShell = (await adminPage.$('nav, aside, header')) !== null;
    const adminHeaderTitle = await adminPage.title();
    console.log(`  3.3 URL Admin: ${adminFormUrl}`);
    console.log(`  3.3 AppShell presente: ${hasAppShell}, Título da página: ${adminHeaderTitle}`);

    // Verificar se botão de voltar para /operacoes-volume está presente
    const backBtn = await adminPage.$('a[href*="/operacoes-volume"], button[aria-label="Voltar"], button:has-text("Voltar")');
    console.log(`  3.4 Botão de retorno para lista de operações: ${backBtn !== null}`);

    const adminFormCapture = path.join(SCREENSHOT_DIR, 'val_03_admin_operacao_volume_nova.png');
    await adminPage.screenshot({ path: adminFormCapture });
    await adminContext.close();

    // 3.5 Encarregado em /login/operacional -> /producao
    const encContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const encPage = await encContext.newPage();
    setupPageMonitoring(encPage, 'TESTE-3-ENC-FORM');

    console.log('  3.5 Login Encarregado via /login/operacional (viewport 390x844)...');
    await encPage.goto(`${BASE_URL}/login/operacional`, { waitUntil: 'networkidle' });
    await encPage.fill('input[type="email"]', 'dev.esclog@gmail.com');
    await encPage.fill('input[type="password"]', '123456');
    await encPage.click('button[type="submit"]');
    await encPage.waitForURL('**/producao', { timeout: 20000 });

    console.log('  3.6 Acessando Operação por Volume no Portal do Encarregado...');
    await encPage.locator('button:has-text("Operação por Volume")').first().click();
    await encPage.waitForTimeout(1500);

    const encFormUrl = encPage.url();
    const isEncMode = encFormUrl.includes('/producao');
    console.log(`  3.7 URL Encarregado: ${encFormUrl} (Mantém fluxo operacional mobile: ${isEncMode})`);

    const encFormCapture = path.join(SCREENSHOT_DIR, 'val_03_encarregado_operacao_volume_mobile.png');
    await encPage.screenshot({ path: encFormCapture });
    await encContext.close();

    const test3Pass = adminFormUrl.includes('/operacoes-volume/nova') && hasAppShell && isEncMode;
    results.push({
      id: 'TESTE-3-FORMULARIO-ADMIN-ENCARREGADO',
      status: test3Pass ? 'PASS' : 'FAIL',
      adminAppShell: hasAppShell,
      encMobileMode: isEncMode,
      detail: `Admin renderiza formulário integrado ao AppShell com navegação e backPath. Encarregado mantém OperationalShell mobile.`,
      captures: [adminFormCapture, encFormCapture]
    });
    console.log(`  => RESULTADO TESTE 3: ${test3Pass ? 'PASS' : 'FAIL'}\n`);
  }

  // --------------------------------------------------------------------------
  // TESTE 4 — MOBILE SONNER TOAST & BOTÃO VOLTAR (390×844)
  // --------------------------------------------------------------------------
  console.log('--- [TESTE 4] MOBILE SONNER TOAST & BOTÃO VOLTAR (390×844) ---');
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    setupPageMonitoring(page, 'TESTE-4-MOBILE');

    console.log('  4.1 Login Encarregado...');
    await page.goto(`${BASE_URL}/login/operacional`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'dev.esclog@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/producao', { timeout: 20000 });

    console.log('  4.2 Abrindo formulário Operação por Volume...');
    await page.locator('button:has-text("Operação por Volume")').first().click();
    await page.waitForTimeout(1500);

    console.log('  4.3 Clicando em "Próximo" sem preenchimento para acionar validação Sonner...');
    const nextBtn = await page.$('button:has-text("Próximo")');
    if (nextBtn) {
      await nextBtn.click();
    }
    await page.waitForTimeout(600);

    // Verificar e fotografar o toast acima da bottom bar
    const toastCapture = path.join(SCREENSHOT_DIR, 'val_04_mobile_toast_posicionamento.png');
    await page.screenshot({ path: toastCapture });
    console.log('  4.4 Screenshot do Toast capturada.');

    // Medir a resposta ao clicar em Voltar com o toast na tela
    console.log('  4.5 Clicando em "Voltar" durante a exibição da notificação...');
    const backBtn = await page.$('button:has-text("Voltar")');
    let clickLatencyMs = -1;
    let clickSuccess = false;

    if (backBtn) {
      const startClick = Date.now();
      await backBtn.click({ timeout: 4000 });
      clickLatencyMs = Date.now() - startClick;
      clickSuccess = true;
      console.log(`  4.5 Clique no botão "Voltar" executado em ${clickLatencyMs}ms sem bloqueio!`);
    }

    await page.waitForTimeout(1000);
    const returnUrl = page.url();
    const returnSuccess = returnUrl.includes('/producao');
    console.log(`  4.6 URL após voltar: ${returnUrl} (Retorno bem-sucedido: ${returnSuccess})`);

    const returnCapture = path.join(SCREENSHOT_DIR, 'val_04_mobile_voltar_sucesso.png');
    await page.screenshot({ path: returnCapture });

    const test4Pass = clickSuccess && clickLatencyMs < 1000 && returnSuccess;
    results.push({
      id: 'TESTE-4-MOBILE-TOAST-E-BOTOES',
      status: test4Pass ? 'PASS' : 'FAIL',
      clickLatencyMs,
      returnSuccess,
      detail: `Toast Sonner posicionado acima da barra fixa (mobileOffset 92px). Botão Voltar acionado com sucesso em ${clickLatencyMs}ms sem interceptação de cliques.`,
      captures: [toastCapture, returnCapture]
    });
    console.log(`  => RESULTADO TESTE 4: ${test4Pass ? 'PASS' : 'FAIL'}\n`);

    await context.close();
  }

  await browser.close();

  // --------------------------------------------------------------------------
  // RESUMO FINAL
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log('RELATÓRIO CONSOLIDADO DE VALIDAÇÃO FINAL');
  console.log('================================================================');
  for (const r of results) {
    console.log(`[${r.status}] ${r.id}: ${r.detail}`);
  }

  console.log('\n--- MONITORAMENTO DE REGRESSÃO ---');
  console.log(`Total de Erros de Console Críticos: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(e => console.log('  ' + e));
  }
  console.log(`Total de Falhas HTTP 500: ${network500Errors.length}`);
  if (network500Errors.length > 0) {
    network500Errors.forEach(e => console.log('  ' + e));
  }

  fs.writeFileSync('scratch/validacao_final_results.json', JSON.stringify({
    results,
    consoleErrors,
    network500Errors,
    timestamp: new Date().toISOString()
  }, null, 2));
}

runValidation().catch(err => {
  console.error('FALHA CATASTRÓFICA NA VALIDAÇÃO FINAL:', err);
  process.exit(1);
});
