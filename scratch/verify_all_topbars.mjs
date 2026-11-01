import { chromium } from "playwright";

const ROUTES_TO_TEST = [
  { path: "/operacional/dashboard", expectedSection: "INÍCIO", expectedTitle: "Dashboard Executivo" },
  { path: "/operacional/pipeline", expectedSection: "INÍCIO", expectedTitle: "Torre Operacional" },
  { path: "/operacoes-volume", expectedSection: "OPERAÇÕES DE CAMPO", expectedTitle: "Operações por Volume" },
  { path: "/operacional/servicos-extras", expectedSection: "OPERAÇÕES DE CAMPO", expectedTitle: "Serviços Extras" },
  { path: "/operacional/custos-extras", expectedSection: "OPERAÇÕES DE CAMPO", expectedTitle: "Custos Extras" },
  { path: "/clt/pontos", expectedSection: "PESSOAS & RH", expectedTitle: "Ponto & Jornadas CLT" },
  { path: "/banco-horas/fechamento", expectedSection: "PESSOAS & RH", expectedTitle: "Fechamento Mensal CLT" },
  { path: "/operacional/diaristas", expectedSection: "PESSOAS & RH", expectedTitle: "Diaristas" },
  { path: "/operacional/intermitentes", expectedSection: "PESSOAS & RH", expectedTitle: "Intermitentes" },
  { path: "/rh/aprovacoes", expectedSection: "APROVAÇÕES & FECHAMENTO", expectedTitle: "Central de Aprovações" },
  { path: "/inconsistencias", expectedSection: "APROVAÇÕES & FECHAMENTO", expectedTitle: "Central de Inconsistências" },
  { path: "/fechamento", expectedSection: "APROVAÇÕES & FECHAMENTO", expectedTitle: "Fechamento de Ciclos" },
  { path: "/financeiro/receitas", expectedSection: "FINANCEIRO & CONTROLADORIA", expectedTitle: "Receitas Operacionais" },
  { path: "/financeiro", expectedSection: "FINANCEIRO & CONTROLADORIA", expectedTitle: "Despesas & Contas a Pagar" },
  { path: "/bancario", expectedSection: "FINANCEIRO & CONTROLADORIA", expectedTitle: "Central Bancária" },
  { path: "/financeiro/inadimplencia", expectedSection: "FINANCEIRO & CONTROLADORIA", expectedTitle: "Inadimplência & Cobrança" },
  { path: "/financeiro/dre", expectedSection: "FINANCEIRO & CONTROLADORIA", expectedTitle: "Resultado Operacional (DRE)" },
  { path: "/cadastros", expectedSection: "CADASTROS & SISTEMA", expectedTitle: "Central de Cadastros" },
  { path: "/relatorios", expectedSection: "CADASTROS & SISTEMA", expectedTitle: "Central de Relatórios" },
  { path: "/governanca", expectedSection: "CADASTROS & SISTEMA", expectedTitle: "Governança" },
  { path: "/configuracoes", expectedSection: "CADASTROS & SISTEMA", expectedTitle: "Preferências" },
];

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Logging in...");
  await page.goto("http://localhost:8080/login");
  await page.fill('input[type="email"]', "e2e-test@orbe.local");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"));

  const results = [];

  for (const item of ROUTES_TO_TEST) {
    try {
      await page.goto(`http://localhost:8080${item.path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      const headerData = await page.evaluate(() => {
        const topbar = document.querySelector("header.sticky");
        if (!topbar) return { error: "No sticky header found" };

        const sectionSpan = topbar.querySelector("span.uppercase");
        const titleSpan = topbar.querySelector("span.font-display.font-semibold");

        return {
          section: sectionSpan ? sectionSpan.textContent.trim() : null,
          title: titleSpan ? titleSpan.textContent.trim() : null,
        };
      });

      const pass =
        headerData.section?.toUpperCase() === item.expectedSection.toUpperCase() &&
        headerData.title === item.expectedTitle;

      results.push({
        path: item.path,
        expected: `${item.expectedSection} / ${item.expectedTitle}`,
        actual: `${headerData.section} / ${headerData.title}`,
        pass,
      });

      console.log(
        `${pass ? "PASS" : "FAIL"} [${item.path}]: actual='${headerData.section} / ${headerData.title}', expected='${item.expectedSection} / ${item.expectedTitle}'`
      );
    } catch (err) {
      console.error(`ERROR on ${item.path}:`, err.message);
      results.push({ path: item.path, error: err.message, pass: false });
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log("Failed items:", JSON.stringify(failed, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
