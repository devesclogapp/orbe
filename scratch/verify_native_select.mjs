import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navegando para /cadastros?tab=colaboradores...');
  await page.goto('http://localhost:8080/cadastros?tab=colaboradores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Scroll até a barra de paginação
  const paginationBar = page.locator('text=Linhas por página:').first();
  await paginationBar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const initialScrollY = await page.evaluate(() => window.scrollY);
  console.log('ScrollY antes da interação:', initialScrollY);

  const initialRows = await page.locator('tbody tr').count();
  console.log('Linhas iniciais:', initialRows);

  const intervalText = await page.locator('text=/Exibindo .* de /').first().textContent();
  console.log('Texto de intervalo:', intervalText?.trim());

  await browser.close();
}

test().catch(console.error);
