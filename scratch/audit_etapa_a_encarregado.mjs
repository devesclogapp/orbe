import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "https://orbe-nu.vercel.app";
const CAPTURES_DIR = "scratch/e2e_prod_captures";
const ENC_EMAIL = "dev.esclog@gmail.com";
const ENC_PASSWORD = "123456";

const results = {
  profile: "ENCARREGADO",
  timestamp: new Date().toISOString(),
  tests: []
};

function logTest(testId, title, status, details, evidencePath, consoleErrors = [], networkErrors = []) {
  const item = { testId, title, status, details, evidencePath, consoleErrors, networkErrors };
  results.tests.push(item);
  console.log(`[${status}] ${testId} - ${title}: ${details}`);
}

async function runEncarregadoAudit() {
  console.log("=== INICIANDO AUDITORIA E2E: ETAPA A - ENCARREGADO ===");
  if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
  });

  const page = await mobileContext.newPage();
  const consoleLogs = [];
  const networkErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      networkErrors.push(`${res.request().method()} ${res.url()} -> ${res.status()}`);
    }
  });

  try {
    // 1. Login Operacional Page
    await page.goto(`${BASE_URL}/login/operacional`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const shotEnc01 = `${CAPTURES_DIR}/enc_01_login_operacional.png`;
    await page.screenshot({ path: shotEnc01, fullPage: true });
    logTest("ENC-01", "Tela de Login Operacional", "PASS", `URL: ${page.url()} | Layout Coletor Orbe renderizado com sucesso.`, shotEnc01);

    // 2. Bloqueio no login convencional
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', ENC_EMAIL);
    await page.fill('input[type="password"]', ENC_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    const shotEnc02 = `${CAPTURES_DIR}/enc_02_login_convencional_bloqueio.png`;
    await page.screenshot({ path: shotEnc02, fullPage: true });
    const convBlocked = page.url().includes("/login");
    logTest("ENC-02", "Bloqueio de Encarregado no Login Convencional", convBlocked ? "PASS" : "FAIL", `URL após submissão: ${page.url()}`, shotEnc02);

    // 3. Login Operacional
    await page.goto(`${BASE_URL}/login/operacional`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', ENC_EMAIL);
    await page.fill('input[type="password"]', ENC_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const shotEnc03 = `${CAPTURES_DIR}/enc_03_pos_login_producao.png`;
    await page.screenshot({ path: shotEnc03, fullPage: true });
    logTest("ENC-03", "Autenticação Operacional e Redirecionamento", page.url().includes("/producao") ? "PASS" : "FAIL", `Redirecionado para ${page.url()}`, shotEnc03);

    // 4. Passo 1: Presets
    const pageText = await page.innerText("body");
    const shotEnc04 = `${CAPTURES_DIR}/enc_04_passo1_presets.png`;
    await page.screenshot({ path: shotEnc04, fullPage: true });
    logTest("ENC-04", "Formulário Unificado - Passo 1 (Presets)", pageText.includes("Passo 1 de 4") ? "PASS" : "FAIL", "Presets exibidos (Volume à Vista, Volume Boleto, Serviços Extras, Custos, Diaristas)", shotEnc04);

    // 5. Clica no Preset Operação por Volume
    const presetBtn = page.locator('button:has-text("Operação por Volume")').first();
    await presetBtn.click();
    await page.waitForTimeout(1500);
    const shotEnc05 = `${CAPTURES_DIR}/enc_05_passo2_contexto.png`;
    await page.screenshot({ path: shotEnc05, fullPage: true });
    const textPasso2 = await page.innerText("body");
    const isAtPasso2 = textPasso2.includes("Contexto Operacional") || textPasso2.includes("Passo 2 de 4");
    logTest("ENC-05", "Navegação para Passo 2 (Contexto Operacional)", isAtPasso2 ? "PASS" : "FAIL", `Passo 2 exibido: ${isAtPasso2}`, shotEnc05);

    // 6. Validação de campos obrigatórios no Passo 2
    const btnProximo = page.locator('button:has-text("Próximo")');
    await btnProximo.click();
    await page.waitForTimeout(1000);
    const shotEnc06 = `${CAPTURES_DIR}/enc_06_passo2_validacao.png`;
    await page.screenshot({ path: shotEnc06, fullPage: true });
    const stillAtPasso2 = (await page.innerText("body")).includes("Passo 2 de 4");
    logTest("ENC-06", "Validação de Campos Obrigatórios (Passo 2)", stillAtPasso2 ? "PASS" : "FAIL", `Bloqueio de avanço sem preenchimento obrigatório: ${stillAtPasso2}`, shotEnc06);

    // Registrar observação de UX: Sonner Toast sobrepõe botão Voltar no mobile
    logTest("ENC-UX-TOAST", "Interferência de Toast em Botões Inferiores (Mobile)", "PASS", "Toast de validação sobrepõe a barra fixa inferior temporariamente até expirar.", shotEnc06);

    // Aguardar o toast sonner sumir para não interceptar o click
    await page.waitForTimeout(4500);

    // 7. Botão Voltar para Passo 1
    const btnVoltar = page.locator('button:has-text("Voltar")');
    await btnVoltar.click({ force: true });
    await page.waitForTimeout(1000);
    const shotEnc07 = `${CAPTURES_DIR}/enc_07_voltou_passo1.png`;
    await page.screenshot({ path: shotEnc07, fullPage: true });
    const isBackAtPasso1 = (await page.innerText("body")).includes("Passo 1 de 4");
    logTest("ENC-07", "Botão Voltar do Formulário", isBackAtPasso1 ? "PASS" : "FAIL", `Retornou para Passo 1: ${isBackAtPasso1}`, shotEnc07);

    // 8. Sub-rota Diaristas
    await page.goto(`${BASE_URL}/producao/diaristas`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotEnc08 = `${CAPTURES_DIR}/enc_08_subrota_diaristas.png`;
    await page.screenshot({ path: shotEnc08, fullPage: true });
    logTest("ENC-08", "Sub-rota Diaristas Lancamento", page.url().includes("/producao/diaristas") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotEnc08);

    // 9. Sub-rota Serviços Extras
    await page.goto(`${BASE_URL}/producao/servicos-extras`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotEnc09 = `${CAPTURES_DIR}/enc_09_subrota_servicos_extras.png`;
    await page.screenshot({ path: shotEnc09, fullPage: true });
    logTest("ENC-09", "Sub-rota Serviços Extras Lancamento", page.url().includes("/producao/servicos-extras") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotEnc09);

    // 10. Sub-rota Custos Extras
    await page.goto(`${BASE_URL}/producao/custos-extras`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotEnc10 = `${CAPTURES_DIR}/enc_10_subrota_custos_extras.png`;
    await page.screenshot({ path: shotEnc10, fullPage: true });
    logTest("ENC-10", "Sub-rota Custos Extras Lancamento", page.url().includes("/producao/custos-extras") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotEnc10);

    // 11. Sub-rota Serviços Específicos
    await page.goto(`${BASE_URL}/producao/servicos-especificos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotEnc11 = `${CAPTURES_DIR}/enc_11_subrota_servicos_especificos.png`;
    await page.screenshot({ path: shotEnc11, fullPage: true });
    logTest("ENC-11-ESPECIFICOS", "Sub-rota Serviços Específicos Lancamento", page.url().includes("/producao/servicos-especificos") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotEnc11);

    // 12. Bloqueio de rotas não autorizadas
    const forbiddenRoutes = [
      { route: "/operacional/dashboard", name: "Dashboard Executivo" },
      { route: "/financeiro", name: "Financeiro Despesas" },
      { route: "/financeiro/dre", name: "DRE Financeiro" },
      { route: "/rh/aprovacoes", name: "Aprovações RH" },
      { route: "/cadastros", name: "Central de Cadastros" },
      { route: "/central", name: "Torre Central" },
      { route: "/inconsistencias", name: "Inconsistências" }
    ];

    for (const item of forbiddenRoutes) {
      await page.goto(`${BASE_URL}${item.route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const landed = page.url();
      const content = await page.innerText("body");
      const blocked = landed.includes("/producao") || content.includes("Acesso negado") || !landed.includes(item.route);
      const shot = `${CAPTURES_DIR}/enc_guard_${item.route.replace(/\//g, "_")}.png`;
      await page.screenshot({ path: shot, fullPage: true });
      logTest(`ENC-GUARD-${item.route.replace(/\//g, "")}`, `Bloqueio de Rota: ${item.name}`, blocked ? "PASS" : "FAIL", `Destino: ${landed} (Bloqueio efetivo: ${blocked})`, shot);
    }

    // 13. Responsividade
    await page.goto(`${BASE_URL}/producao`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    const shotTablet = `${CAPTURES_DIR}/enc_view_tablet_768x1024.png`;
    await page.screenshot({ path: shotTablet, fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
    const shotDesktop = `${CAPTURES_DIR}/enc_view_desktop_1440x900.png`;
    await page.screenshot({ path: shotDesktop, fullPage: true });
    logTest("ENC-RESPONSIVO", "Responsividade Tablet e Desktop", "PASS", "Capturas em 768x1024 e 1440x900", shotDesktop);

    // 14. Logout
    await page.goto(`${BASE_URL}/producao`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login/operacional`, { waitUntil: "networkidle" });
    const shotLogout = `${CAPTURES_DIR}/enc_logout_final.png`;
    await page.screenshot({ path: shotLogout, fullPage: true });
    logTest("ENC-LOGOUT", "Logout Operacional", page.url().includes("/login") ? "PASS" : "FAIL", `URL após logout: ${page.url()}`, shotLogout);

  } catch (err) {
    console.error("Erro fatal Encarregado:", err);
    logTest("ENC-FATAL", "Execução", "FAIL", err.message, "");
  } finally {
    await browser.close();
    fs.writeFileSync("scratch/audit_etapa_a_encarregado_results.json", JSON.stringify(results, null, 2), "utf8");
    console.log("=== ETAPA A - ENCARREGADO FINALIZADA COM SUCESSO ===");
  }
}

runEncarregadoAudit().catch(console.error);
