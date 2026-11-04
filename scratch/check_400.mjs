import { chromium } from 'playwright';

async function check() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log('HTTP', resp.status(), resp.url());
    }
  });
  await page.goto('https://orbe-nu.vercel.app/login/operacional');
  await page.fill('input[type="email"]', 'dev.esclog@gmail.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await browser.close();
}

check().catch(console.error);

