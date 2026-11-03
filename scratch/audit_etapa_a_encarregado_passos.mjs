import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "https://orbe-nu.vercel.app";
const CAPTURES_DIR = "scratch/e2e_prod_captures";
const ENC_EMAIL = "dev.esclog@gmail.com";
const ENC_PASSWORD = "123456";

async function testFormSteps() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
  });
  const page = await context.newPage();

  console.log("Logando como Encarregado...");
  await page.goto(`${BASE_URL}/login/operacional`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', ENC_EMAIL);
  await page.fill('input[type="password"]', ENC_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log("Em /producao. Clicando no Preset de Operação por Volume...");
  // Localiza o botão do preset de Operação por Volume
  const presetBtn = page.locator('button:has-text("Operação por Volume")').first();
  await presetBtn.click();
  await page.waitForTimeout(1500);

  const shotPasso2 = `${CAPTURES_DIR}/enc_passo2_contexto_detalhado.png`;
  await page.screenshot({ path: shotPasso2, fullPage: true });
  const textPasso2 = await page.innerText("body");
  const isAtPasso2 = textPasso2.includes("Contexto Operacional") || textPasso2.includes("Passo 2 de 4");
  console.log("Passo 2 detectado:", isAtPasso2);

  // Verificar campos presentes no Passo 2: Empresa, Data, Tipo de Serviço, etc.
  const hasEmpresa = textPasso2.includes("Empresa") || (await page.$('text="Empresa"')) !== null;
  const hasServico = textPasso2.includes("Serviço") || (await page.$('text="Serviço"')) !== null;
  console.log("Campos no Passo 2: Empresa =", hasEmpresa, "Servico =", hasServico);

  // Tentar avançar sem preencher campos obrigatórios
  const btnAvancar = page.locator('button:has-text("Avançar")');
  await btnAvancar.click();
  await page.waitForTimeout(1000);
  const textAfterAvancar = await page.innerText("body");
  const stayAtPasso2 = textAfterAvancar.includes("Passo 2 de 4");
  console.log("Validação impediu avanço indevido:", stayAtPasso2);

  // Botão Voltar para Passo 1
  const btnVoltar = page.locator('button:has-text("Voltar")');
  await btnVoltar.click();
  await page.waitForTimeout(1000);
  const textAfterVoltar = await page.innerText("body");
  const backAtPasso1 = textAfterVoltar.includes("Passo 1 de 4");
  console.log("Voltou ao Passo 1 com sucesso:", backAtPasso1);

  await browser.close();

  return { isAtPasso2, hasEmpresa, hasServico, stayAtPasso2, backAtPasso1 };
}

testFormSteps().then(res => console.log("Resultado passos form:", res)).catch(console.error);

