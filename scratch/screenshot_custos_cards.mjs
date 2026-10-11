import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto("http://localhost:8080/login");
  await page.fill('input[type="email"]', "e2e-test@orbe.local");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"));

  await page.goto("http://localhost:8080/operacional/custos-extras");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const kpiInfo = await page.evaluate(() => {
    const cards = document.querySelectorAll(".grid.grid-cols-1 button");
    return Array.from(cards).map((c) => {
      const title = c.querySelector("span")?.textContent.trim();
      const valDiv = c.querySelector("div.text-2xl, div.font-display");
      const font = valDiv ? window.getComputedStyle(valDiv).fontFamily : null;
      const text = valDiv ? valDiv.textContent.trim() : null;
      return { title, text, font };
    });
  });

  console.log("Custos Extras Cards Typography:\n", JSON.stringify(kpiInfo, null, 2));

  // Tira screenshot focado nos cards
  const cardsContainer = page.locator(".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4");
  if (await cardsContainer.count() > 0) {
    await cardsContainer.first().screenshot({ path: "scratch/custos_extras_cards_fixed.png" });
    console.log("Screenshot salva em scratch/custos_extras_cards_fixed.png");
  }

  await browser.close();
}

main().catch(console.error);
