import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:8080/login...");
  await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });

  console.log("Page title:", await page.title());

  // Fill login
  await page.fill('input[type="email"]', "e2e-test@orbe.local");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');

  console.log("Submitted login, waiting for navigation...");
  await page.waitForTimeout(3000);
  console.log("Current URL:", page.url());

  // Try navigating to /operacional/dashboard
  await page.goto("http://localhost:8080/operacional/dashboard", { waitUntil: "networkidle" });
  console.log("Dashboard URL:", page.url());

  // Check main container
  const mainDiv = await page.$("main > div");
  if (mainDiv) {
    const box = await mainDiv.boundingBox();
    console.log("Dashboard main > div boundingBox:", box);
  }

  // Check child wrapper
  const childDiv = await page.$("main > div > div");
  if (childDiv) {
    const box = await childDiv.boundingBox();
    console.log("Dashboard child div boundingBox:", box);
  }

  await browser.close();
}

main().catch(console.error);
