import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

const ROUTES = [
  { id: "dashboard", name: "Dashboard Executivo (Ref)", url: "http://localhost:8080/operacional/dashboard" },
  { id: "torre", name: "Torre Operacional", url: "http://localhost:8080/operacional/pipeline" },
  { id: "dre", name: "Resultado Operacional (DRE)", url: "http://localhost:8080/financeiro/dre" },
  { id: "diaristas", name: "Painel de Diaristas", url: "http://localhost:8080/operacional/diaristas" },
  { id: "aprovacoes", name: "Central de Aprovações", url: "http://localhost:8080/rh/aprovacoes" },
];

const PHASE = process.argv[2] || "before"; // "before" or "after"
const outputDir = path.resolve(`scratch/screenshots_${PHASE}`);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${PHASE}) ===`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // Login once per context
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "e2e-test@orbe.local");
    await page.fill('input[type="password"]', "123456");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);

    for (const route of ROUTES) {
      console.log(`Measuring ${route.name} at ${route.url}...`);
      await page.goto(route.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000); // allow charts/renders to settle

      // Get main > div bounding box (AppShell inner container)
      const appShellContainer = await page.$("main > div");
      const appShellBox = appShellContainer ? await appShellContainer.boundingBox() : null;

      // Get child root container
      const childContainer = await page.$("main > div > div, main > div > section");
      const childBox = childContainer ? await childContainer.boundingBox() : null;

      // Check for horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return main ? main.scrollWidth > main.clientWidth : false;
      });

      // Capture screenshot
      const screenshotFile = path.join(outputDir, `${route.id}_${vp.name}.png`);
      await page.screenshot({ path: screenshotFile, fullPage: false });

      results.push({
        phase: PHASE,
        viewport: vp.name,
        routeId: route.id,
        routeName: route.name,
        url: route.url,
        appShellBox,
        childBox,
        hasHorizontalScroll,
        screenshotFile,
      });

      console.log(`  -> childBox: x=${childBox?.x}, width=${childBox?.width}, overflow=${hasHorizontalScroll}`);
    }

    await context.close();
  }

  await browser.close();

  const jsonFile = path.resolve(`scratch/measurements_${PHASE}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nDone! Saved measurements to ${jsonFile}`);
}

run().catch(console.error);
