import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  await page.goto("http://localhost:8080/login");
  await page.fill('input[type="email"]', "e2e-test@orbe.local");
  await page.fill('input[type="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes("/login"));
  
  await page.goto("http://localhost:8080/clt/pontos");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  
  const details = await page.evaluate(() => {
    const pageContainer = document.querySelector(".w-full.flex-1.min-h-0") || document.querySelector("main > div > div");
    const header = pageContainer ? pageContainer.querySelector("header, [class*='OrbePageHeader'], div:first-child") : null;
    const kpiGrid = pageContainer ? pageContainer.querySelector(".grid") : null;
    const tableWrapper = pageContainer ? pageContainer.querySelector(".border, table, [class*='table']") : null;
    
    return {
      pageContainerClass: pageContainer ? pageContainer.className : null,
      pageContainerStyle: pageContainer ? {
        paddingLeft: window.getComputedStyle(pageContainer).paddingLeft,
        paddingRight: window.getComputedStyle(pageContainer).paddingRight,
        box: pageContainer.getBoundingClientRect()
      } : null,
      headerBox: header ? header.getBoundingClientRect() : null,
      kpiGridBox: kpiGrid ? kpiGrid.getBoundingClientRect() : null,
      tableWrapperBox: tableWrapper ? tableWrapper.getBoundingClientRect() : null
    };
  });
  
  console.log("CLT Pontos Detailed Metrics:\n", JSON.stringify(details, null, 2));
  await page.screenshot({ path: "scratch/clt_pontos_debug.png", fullPage: false });
  await browser.close();
}

main().catch(console.error);
