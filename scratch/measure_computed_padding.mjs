import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:8080/login");
  await page.fill('input[type="email"]', "e2e-test@orbe.local");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const routes = [
    { name: "Dashboard (Ref)", url: "/operacional/dashboard" },
    { name: "Torre Operacional", url: "/operacional/pipeline" },
    { name: "Resultado Operacional (DRE)", url: "/financeiro/dre" },
    { name: "Painel de Diaristas", url: "/operacional/diaristas" },
    { name: "Central de Aprovações", url: "/rh/aprovacoes" },
  ];

  for (const r of routes) {
    await page.goto("http://localhost:8080" + r.url);
    await page.waitForTimeout(1500);
    const data = await page.evaluate(() => {
      const child = document.querySelector("main > div > div");
      if (!child) return null;
      const cs = window.getComputedStyle(child);
      const firstChild = child.firstElementChild;
      const firstChildBox = firstChild ? firstChild.getBoundingClientRect() : null;
      return {
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        firstElemX: firstChildBox?.x,
        firstElemWidth: firstChildBox?.width,
      };
    });
    console.log(r.name, JSON.stringify(data));
  }
  await browser.close();
}

test().catch(console.error);
