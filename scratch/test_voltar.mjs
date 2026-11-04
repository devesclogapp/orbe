import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("https://orbe-nu.vercel.app/login/operacional", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "dev.esclog@gmail.com");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.locator('button:has-text("Operação por Volume")').first().click();
  await page.waitForTimeout(1000);
  console.log("Before click voltar, h1:", await page.locator("h1").allInnerTexts());

  const voltarBtns = page.locator('button:has-text("Voltar")');
  console.log("Count of Voltar buttons:", await voltarBtns.count());
  await voltarBtns.first().click();
  await page.waitForTimeout(1500);

  console.log("After voltar, h1:", await page.locator("h1").allInnerTexts());
  console.log("Body includes Passo 1:", (await page.innerText("body")).includes("Passo 1 de 4"));
  await browser.close();
}

main().catch(console.error);

