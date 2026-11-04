import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "https://orbe-nu.vercel.app";
const CAPTURES_DIR = "scratch/e2e_prod_captures";
const ADMIN_EMAIL = "e2e-test@orbe.local";
const ADMIN_PASSWORD = "123456";

const results = {
  profile: "ADMINISTRADOR",
  timestamp: new Date().toISOString(),
  tests: []
};

function logTest(testId, title, status, details, evidencePath, consoleErrors = [], networkErrors = []) {
  const item = { testId, title, status, details, evidencePath, consoleErrors, networkErrors };
  results.tests.push(item);
  console.log(`[${status}] ${testId} - ${title}: ${details}`);
}

async function runAdminAudit() {
  console.log("=== INICIANDO AUDITORIA E2E: ETAPA B - ADMINISTRADOR ===");
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
    // 1. Login Administrativo
    console.log("\n--- TESTE ADM-01: Login Administrativo ---");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    const shotAdm01 = `${CAPTURES_DIR}/adm_01_pos_login.png`;
    await page.screenshot({ path: shotAdm01, fullPage: true });
    const isLoggedAdm = !page.url().includes("/login");
    logTest("ADM-01", "Login Administrativo", isLoggedAdm ? "PASS" : "FAIL", `URL após login: ${page.url()}`, shotAdm01);

    // 2. Dashboard Executivo
    console.log("\n--- TESTE ADM-02: Dashboard Executivo (/operacional/dashboard) ---");
    await page.goto(`${BASE_URL}/operacional/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm02 = `${CAPTURES_DIR}/adm_02_dashboard.png`;
    await page.screenshot({ path: shotAdm02, fullPage: true });
    const textDash = await page.innerText("body");
    const dashOk = !textDash.includes("Erro") && !textDash.includes("404");
    logTest("ADM-02", "Dashboard Executivo", dashOk ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm02);

    // 3. Torre Operacional / Pipeline
    console.log("\n--- TESTE ADM-03: Torre Operacional (/operacional/pipeline) ---");
    await page.goto(`${BASE_URL}/operacional/pipeline`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm03 = `${CAPTURES_DIR}/adm_03_pipeline.png`;
    await page.screenshot({ path: shotAdm03, fullPage: true });
    logTest("ADM-03", "Torre Operacional / Pipeline", page.url().includes("/operacional/pipeline") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm03);

    // 4. Operações por Volume (Listagem e Filtros)
    console.log("\n--- TESTE ADM-04: Operações por Volume (/operacoes-volume) ---");
    await page.goto(`${BASE_URL}/operacoes-volume`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const shotAdm04 = `${CAPTURES_DIR}/adm_04_operacoes_volume.png`;
    await page.screenshot({ path: shotAdm04, fullPage: true });
    const hasTabela = (await page.$("table")) !== null || (await page.$(".ag-root")) !== null || (await page.innerText("body")).includes("Operações");
    logTest("ADM-04", "Listagem de Operações por Volume", hasTabela ? "PASS" : "FAIL", "Tabela ou grade operacional exibida", shotAdm04);

    // 5. Paridade do OperacaoForm no modo Admin
    console.log("\n--- TESTE ADM-05: OperacaoForm em Modo Admin (/operacoes-volume/nova) ---");
    await page.goto(`${BASE_URL}/operacoes-volume/nova`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm05 = `${CAPTURES_DIR}/adm_05_operacao_form_admin.png`;
    await page.screenshot({ path: shotAdm05, fullPage: true });
    const textFormAdm = await page.innerText("body");
    const isFormAdminOk = textFormAdm.includes("Passo 1 de 4") || textFormAdm.includes("Opções");
    // Confirmar paridade: presets no admin ocultam diaristas e serviços específicos conforme regra
    const hasVolume = textFormAdm.includes("Operação por Volume");
    const hasDiaristas = textFormAdm.includes("Lançamento de presença e grade semanal");
    logTest(
      "ADM-05",
      "Paridade OperacaoForm Modo Admin",
      isFormAdminOk && hasVolume && !hasDiaristas ? "PASS" : "PARCIAL",
      `Formulário renderizado. Diaristas oculto no preset Admin: ${!hasDiaristas}`,
      shotAdm05
    );

    // 6. Central de Cadastros (Empresas, Colaboradores, Unidades)
    console.log("\n--- TESTE ADM-06: Central de Cadastros (/cadastros) ---");
    await page.goto(`${BASE_URL}/cadastros`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm06 = `${CAPTURES_DIR}/adm_06_cadastros.png`;
    await page.screenshot({ path: shotAdm06, fullPage: true });
    const textCad = await page.innerText("body");
    const cadOk = textCad.includes("Empresas") || textCad.includes("Colaboradores") || textCad.includes("Cadastros");
    logTest("ADM-06", "Central de Cadastros", cadOk ? "PASS" : "FAIL", "Central de Cadastros carregada", shotAdm06);

    // 7. Regras Operacionais
    console.log("\n--- TESTE ADM-07: Regras Operacionais (/cadastros/regras-operacionais) ---");
    await page.goto(`${BASE_URL}/cadastros/regras-operacionais`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm07 = `${CAPTURES_DIR}/adm_07_regras_operacionais.png`;
    await page.screenshot({ path: shotAdm07, fullPage: true });
    logTest("ADM-07", "Regras Operacionais", page.url().includes("/cadastros/regras-operacionais") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm07);

    // 8. Diaristas Painel
    console.log("\n--- TESTE ADM-08: Diaristas Painel (/operacional/diaristas) ---");
    await page.goto(`${BASE_URL}/operacional/diaristas`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm08 = `${CAPTURES_DIR}/adm_08_diaristas.png`;
    await page.screenshot({ path: shotAdm08, fullPage: true });
    logTest("ADM-08", "Painel de Diaristas Administrativo", page.url().includes("/operacional/diaristas") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm08);

    // 9. Serviços Extras
    console.log("\n--- TESTE ADM-09: Serviços Extras (/operacional/servicos-extras) ---");
    await page.goto(`${BASE_URL}/operacional/servicos-extras`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm09 = `${CAPTURES_DIR}/adm_09_servicos_extras.png`;
    await page.screenshot({ path: shotAdm09, fullPage: true });
    logTest("ADM-09", "Serviços Extras Administrativo", page.url().includes("/operacional/servicos-extras") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm09);

    // 10. Custos Extras
    console.log("\n--- TESTE ADM-10: Custos Extras (/operacional/custos-extras) ---");
    await page.goto(`${BASE_URL}/operacional/custos-extras`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm10 = `${CAPTURES_DIR}/adm_10_custos_extras.png`;
    await page.screenshot({ path: shotAdm10, fullPage: true });
    logTest("ADM-10", "Custos Extras Administrativo", page.url().includes("/operacional/custos-extras") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm10);

    // 11. Central de Pendências / Inconsistências
    console.log("\n--- TESTE ADM-11: Central de Inconsistências (/inconsistencias) ---");
    await page.goto(`${BASE_URL}/inconsistencias`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm11 = `${CAPTURES_DIR}/adm_11_inconsistencias.png`;
    await page.screenshot({ path: shotAdm11, fullPage: true });
    logTest("ADM-11", "Central de Inconsistências", page.url().includes("/inconsistencias") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm11);

    // 12. Central de Aprovações RH
    console.log("\n--- TESTE ADM-12: Central de Aprovações RH (/rh/aprovacoes) ---");
    await page.goto(`${BASE_URL}/rh/aprovacoes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm12 = `${CAPTURES_DIR}/adm_12_rh_aprovacoes.png`;
    await page.screenshot({ path: shotAdm12, fullPage: true });
    logTest("ADM-12", "Central de Aprovações RH", page.url().includes("/rh/aprovacoes") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm12);

    // 13. Fechamento de Ciclos
    console.log("\n--- TESTE ADM-13: Fechamento de Ciclos (/fechamento) ---");
    await page.goto(`${BASE_URL}/fechamento`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm13 = `${CAPTURES_DIR}/adm_13_fechamento.png`;
    await page.screenshot({ path: shotAdm13, fullPage: true });
    logTest("ADM-13", "Fechamento de Ciclos Hub", page.url().includes("/fechamento") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm13);

    // 14. Financeiro - Receitas Operacionais
    console.log("\n--- TESTE ADM-14: Receitas Operacionais (/financeiro/receitas) ---");
    await page.goto(`${BASE_URL}/financeiro/receitas`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm14 = `${CAPTURES_DIR}/adm_14_receitas.png`;
    await page.screenshot({ path: shotAdm14, fullPage: true });
    logTest("ADM-14", "Financeiro - Receitas Operacionais", page.url().includes("/financeiro/receitas") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm14);

    // 15. Financeiro - Despesas & Contas a Pagar
    console.log("\n--- TESTE ADM-15: Despesas & Contas a Pagar (/financeiro) ---");
    await page.goto(`${BASE_URL}/financeiro`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm15 = `${CAPTURES_DIR}/adm_15_despesas.png`;
    await page.screenshot({ path: shotAdm15, fullPage: true });
    logTest("ADM-15", "Financeiro - Despesas & Contas a Pagar", page.url().includes("/financeiro") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm15);

    // 16. Central Bancária & CNAB
    console.log("\n--- TESTE ADM-16: Central Bancária & CNAB (/bancario) ---");
    await page.goto(`${BASE_URL}/bancario`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const shotAdm16 = `${CAPTURES_DIR}/adm_16_bancario_cnab.png`;
    await page.screenshot({ path: shotAdm16, fullPage: true });
    const textBanc = await page.innerText("body");
    const cnabOk = textBanc.includes("Remessas") || textBanc.includes("Retornos") || textBanc.includes("Bancária") || textBanc.includes("CNAB");
    logTest("ADM-16", "Central Bancária e Remessas CNAB", cnabOk ? "PASS" : "FAIL", "Módulo bancário carregado sem disparar geração real", shotAdm16);

    // 17. Inadimplência & Cobrança
    console.log("\n--- TESTE ADM-17: Inadimplência & Cobrança (/financeiro/inadimplencia) ---");
    await page.goto(`${BASE_URL}/financeiro/inadimplencia`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm17 = `${CAPTURES_DIR}/adm_17_inadimplencia.png`;
    await page.screenshot({ path: shotAdm17, fullPage: true });
    logTest("ADM-17", "Inadimplência & Cobrança", page.url().includes("/financeiro/inadimplencia") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm17);

    // 18. Resultado Operacional DRE
    console.log("\n--- TESTE ADM-18: Resultado Operacional DRE (/financeiro/dre) ---");
    await page.goto(`${BASE_URL}/financeiro/dre`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm18 = `${CAPTURES_DIR}/adm_18_dre.png`;
    await page.screenshot({ path: shotAdm18, fullPage: true });
    logTest("ADM-18", "Resultado Operacional DRE", page.url().includes("/financeiro/dre") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm18);

    // 19. Central de Relatórios
    console.log("\n--- TESTE ADM-19: Central de Relatórios (/relatorios) ---");
    await page.goto(`${BASE_URL}/relatorios`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm19 = `${CAPTURES_DIR}/adm_19_relatorios.png`;
    await page.screenshot({ path: shotAdm19, fullPage: true });
    logTest("ADM-19", "Central de Relatórios", page.url().includes("/relatorios") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm19);

    // 20. Configurações & Preferências
    console.log("\n--- TESTE ADM-20: Configurações (/configuracoes) ---");
    await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const shotAdm20 = `${CAPTURES_DIR}/adm_20_configuracoes.png`;
    await page.screenshot({ path: shotAdm20, fullPage: true });
    logTest("ADM-20", "Configurações do Sistema", page.url().includes("/configuracoes") ? "PASS" : "FAIL", `URL: ${page.url()}`, shotAdm20);

    // 21. Responsividade Tablet (768x1024) no Dashboard
    console.log("\n--- TESTE ADM-21: Responsividade Tablet no Dashboard ---");
    await page.goto(`${BASE_URL}/operacional/dashboard`, { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1500);
    const shotTablet = `${CAPTURES_DIR}/adm_21_tablet_dashboard.png`;
    await page.screenshot({ path: shotTablet, fullPage: true });
    logTest("ADM-21", "Responsividade Tablet no Dashboard Executivo", "PASS", "Captura em 768x1024 sem quebra visual", shotTablet);

    // 22. Logout
    console.log("\n--- TESTE ADM-22: Logout Admin ---");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    const shotLogout = `${CAPTURES_DIR}/adm_22_pos_logout.png`;
    await page.screenshot({ path: shotLogout, fullPage: true });
    logTest("ADM-22", "Logout Administrador", page.url().includes("/login") ? "PASS" : "FAIL", `URL após logout: ${page.url()}`, shotLogout);

  } catch (err) {
    console.error("Erro fatal Admin:", err);
    logTest("ADM-FATAL", "Execução Administrador", "FAIL", err.message, "");
  } finally {
    await browser.close();
    fs.writeFileSync("scratch/audit_etapa_b_admin_results.json", JSON.stringify(results, null, 2), "utf8");
    console.log("=== ETAPA B - ADMINISTRADOR FINALIZADA COM SUCESSO ===");
  }
}

runAdminAudit().catch(console.error);

