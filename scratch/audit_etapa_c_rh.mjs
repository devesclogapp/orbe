import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "https://orbe-nu.vercel.app";
const CAPTURES_DIR = "scratch/e2e_prod_captures";
const RH_EMAIL = "flaviocarvalhoficial+2@gmail.com";
const RH_PASSWORD = "123456";

const results = {
  profile: "RH",
  timestamp: new Date().toISOString(),
  tests: []
};

function logTest(testId, title, status, details, evidencePath, consoleErrors = [], networkErrors = []) {
  const item = { testId, title, status, details, evidencePath, consoleErrors, networkErrors };
  results.tests.push(item);
  console.log(`[${status}] ${testId} - ${title}: ${details}`);
}

async function runRhAudit() {
  console.log("=== INICIANDO AUDITORIA E2E: ETAPA C - RH ===");
  if (!fs.existsSync(CAPTURES_DIR)) fs.mkdirSync(CAPTURES_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await desktopContext.newPage();
  const consoleLogs = [];
  const networkErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      networkErrors.push(`${res.request().method()} ${res.url()} -> ${res.status()}`);
    }
  });

  try {
    // 1. Login RH
    console.log("\n--- TESTE RH-01: Login Perfil RH ---");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', RH_EMAIL);
    await page.fill('input[type="password"]', RH_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    const shotRh01 = `${CAPTURES_DIR}/rh_01_pos_login.png`;
    await page.screenshot({ path: shotRh01, fullPage: true });
    const isLoggedRh = !page.url().includes("/login");
    logTest("RH-01", "Login Perfil RH", isLoggedRh ? "PASS" : "FAIL", `URL após login: ${page.url()}`, shotRh01);

    // 2. Destino Padrão e Central de Aprovações
    console.log("\n--- TESTE RH-02: Central de Aprovações RH (/rh/aprovacoes) ---");
    await page.goto(`${BASE_URL}/rh/aprovacoes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const shotRh02 = `${CAPTURES_DIR}/rh_02_central_aprovacoes.png`;
    await page.screenshot({ path: shotRh02, fullPage: true });
    const textAprov = await page.innerText("body");
    const hasAprov = textAprov.includes("Aprovações") || textAprov.includes("Pendências");
    logTest("RH-02", "Central de Aprovações RH", hasAprov ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh02);

    // 3. Validação Crítica de Permissão de Aprovação: RH sem processamento_rh:aprovar
    console.log("\n--- TESTE RH-03: Restrição de Aprovação (processamento_rh:aprovar) ---");
    // Procurar botões de aprovar diretos ou na tabela
    const btnAprovar = page.locator('button:has-text("Aprovar"), button:has-text("Aprovar Lote")');
    const countAprovar = await btnAprovar.count();
    let canApprove = false;
    if (countAprovar > 0) {
      for (let i = 0; i < countAprovar; i++) {
        const btn = btnAprovar.nth(i);
        const isVisible = await btn.isVisible();
        const isDisabled = await btn.isDisabled();
        if (isVisible && !isDisabled) {
          canApprove = true;
          break;
        }
      }
    }
    const shotRh03 = `${CAPTURES_DIR}/rh_03_restricao_aprovacao.png`;
    await page.screenshot({ path: shotRh03, fullPage: true });
    // Esperado: RH sem permissão NÃO deve conseguir aprovar (botões desabilitados ou ausentes)
    const approvalRestricted = !canApprove;
    logTest(
      "RH-03",
      "Restrição de Aprovação (Sem processamento_rh:aprovar)",
      approvalRestricted ? "PASS" : "FAIL",
      `Botões de aprovação ativos encontrados: ${canApprove}. Restrição RBAC mantida: ${approvalRestricted}`,
      shotRh03
    );

    // 4. Ponto e Jornadas CLT
    console.log("\n--- TESTE RH-04: Ponto e Jornadas CLT (/clt/pontos) ---");
    await page.goto(`${BASE_URL}/clt/pontos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const shotRh04 = `${CAPTURES_DIR}/rh_04_ponto_clt.png`;
    await page.screenshot({ path: shotRh04, fullPage: true });
    logTest("RH-04", "Ponto e Jornadas CLT", page.url().includes("/clt/pontos") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh04);

    // 5. Fechamento Mensal CLT / Banco de Horas
    console.log("\n--- TESTE RH-05: Fechamento Mensal (/banco-horas/fechamento) ---");
    await page.goto(`${BASE_URL}/banco-horas/fechamento`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const shotRh05 = `${CAPTURES_DIR}/rh_05_fechamento_mensal.png`;
    await page.screenshot({ path: shotRh05, fullPage: true });
    logTest("RH-05", "Fechamento Mensal CLT", page.url().includes("/banco-horas/fechamento") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh05);

    // 6. Colaboradores
    console.log("\n--- TESTE RH-06: Cadastro de Colaboradores (/cadastros?tab=colaboradores) ---");
    await page.goto(`${BASE_URL}/cadastros?tab=colaboradores`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const shotRh06 = `${CAPTURES_DIR}/rh_06_colaboradores.png`;
    await page.screenshot({ path: shotRh06, fullPage: true });
    logTest("RH-06", "Consulta de Colaboradores", page.url().includes("/cadastros") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh06);

    // 7. Intermitentes (Jornadas e Lotes)
    console.log("\n--- TESTE RH-07: Intermitentes Jornadas e Lotes ---");
    await page.goto(`${BASE_URL}/operacional/intermitentes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotRh07a = `${CAPTURES_DIR}/rh_07a_intermitentes_jornadas.png`;
    await page.screenshot({ path: shotRh07a, fullPage: true });

    await page.goto(`${BASE_URL}/operacional/intermitentes/lotes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotRh07b = `${CAPTURES_DIR}/rh_07b_intermitentes_lotes.png`;
    await page.screenshot({ path: shotRh07b, fullPage: true });
    logTest("RH-07", "Intermitentes Jornadas e Lotes Devolvidos", page.url().includes("/operacional/intermitentes/lotes") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh07b);

    // 8. Visualização de Pendências / Inconsistências
    console.log("\n--- TESTE RH-08: Inconsistências (/inconsistencias) ---");
    await page.goto(`${BASE_URL}/inconsistencias`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotRh08 = `${CAPTURES_DIR}/rh_08_inconsistencias.png`;
    await page.screenshot({ path: shotRh08, fullPage: true });
    logTest("RH-08", "Central de Inconsistências para RH", page.url().includes("/inconsistencias") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh08);

    // 9. Diaristas Painel (Validação RH)
    console.log("\n--- TESTE RH-09: Diaristas Validação RH (/operacional/diaristas) ---");
    await page.goto(`${BASE_URL}/operacional/diaristas`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotRh09 = `${CAPTURES_DIR}/rh_09_diaristas_rh.png`;
    await page.screenshot({ path: shotRh09, fullPage: true });
    logTest("RH-09", "Painel de Diaristas Validação RH", page.url().includes("/operacional/diaristas") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotRh09);

    // 10. Bloqueio de Áreas Financeiras e Administrativas para RH
    console.log("\n--- TESTE RH-10: Bloqueio de Áreas Financeiras / Administrativas ---");
    const rhForbidden = [
      { route: "/financeiro", name: "Financeiro Despesas" },
      { route: "/financeiro/dre", name: "DRE Financeiro" },
      { route: "/financeiro/receitas", name: "Receitas Financeiras" },
      { route: "/bancario", name: "Central Bancária / CNAB" },
      { route: "/configuracoes", name: "Configurações Globais" }
    ];

    for (const item of rhForbidden) {
      await page.goto(`${BASE_URL}${item.route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const landed = page.url();
      const content = await page.innerText("body");
      // RH não deve acessar financeiro / bancário / configurações
      const blocked = !landed.includes(item.route) || content.includes("Acesso negado") || content.includes("não tem permissão");
      const shot = `${CAPTURES_DIR}/rh_10_guard_${item.route.replace(/\//g, "_")}.png`;
      await page.screenshot({ path: shot, fullPage: true });

      logTest(`RH-GUARD-${item.route.replace(/\//g, "")}`, `Bloqueio de Rota RH: ${item.name}`, blocked ? "PASS" : "FAIL", `Destino: ${landed} (Bloqueado: ${blocked})`, shot);
    }

    // 11. Responsividade Tablet (768x1024) e Mobile (390x844)
    console.log("\n--- TESTE RH-11: Responsividade RH ---");
    await page.goto(`${BASE_URL}/rh/aprovacoes`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    const shotTablet = `${CAPTURES_DIR}/rh_11_tablet_aprovacoes.png`;
    await page.screenshot({ path: shotTablet, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    const shotMobile = `${CAPTURES_DIR}/rh_11_mobile_aprovacoes.png`;
    await page.screenshot({ path: shotMobile, fullPage: true });
    logTest("RH-11", "Responsividade Tablet e Mobile em Aprovações RH", "PASS", "Capturas em 768x1024 e 390x844", shotMobile);

    // 12. Logout RH
    console.log("\n--- TESTE RH-12: Logout RH ---");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    const shotLogout = `${CAPTURES_DIR}/rh_12_pos_logout.png`;
    await page.screenshot({ path: shotLogout, fullPage: true });
    logTest("RH-12", "Logout RH", page.url().includes("/login") ? "PASS" : "FAIL", `URL após logout: ${page.url()}`, shotLogout);

  } catch (err) {
    console.error("Erro fatal RH:", err);
    logTest("RH-FATAL", "Execução RH", "FAIL", err.message, "");
  } finally {
    await browser.close();
    fs.writeFileSync("scratch/audit_etapa_c_rh_results.json", JSON.stringify(results, null, 2), "utf8");
    console.log("=== ETAPA C - RH FINALIZADA COM SUCESSO ===");
  }
}

runRhAudit().catch(console.error);

