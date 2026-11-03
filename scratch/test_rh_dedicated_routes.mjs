import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "https://orbe-nu.vercel.app";
const CAPTURES_DIR = "scratch/e2e_prod_captures";
const RH_EMAIL = "flaviocarvalhoficial+2@gmail.com";
const RH_PASSWORD = "123456";

async function testRhDedicatedRoutes() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', RH_EMAIL);
  await page.fill('input[type="password"]', RH_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 1. /colaboradores
  console.log("Acessando /colaboradores...");
  await page.goto(`${BASE_URL}/colaboradores`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const shotColab = `${CAPTURES_DIR}/rh_colaboradores_dedicada.png`;
  await page.screenshot({ path: shotColab, fullPage: true });
  const colabUrl = page.url();
  console.log("Destino /colaboradores:", colabUrl);

  // 2. /rh/diaristas
  console.log("Acessando /rh/diaristas...");
  await page.goto(`${BASE_URL}/rh/diaristas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const shotDiaristas = `${CAPTURES_DIR}/rh_diaristas_aprovacoes.png`;
  await page.screenshot({ path: shotDiaristas, fullPage: true });
  const diaristasUrl = page.url();
  console.log("Destino /rh/diaristas:", diaristasUrl);

  // 3. /rh/diaristas/cadastros
  console.log("Acessando /rh/diaristas/cadastros...");
  await page.goto(`${BASE_URL}/rh/diaristas/cadastros`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const shotDiaristasCad = `${CAPTURES_DIR}/rh_diaristas_cadastros.png`;
  await page.screenshot({ path: shotDiaristasCad, fullPage: true });
  const diaristasCadUrl = page.url();
  console.log("Destino /rh/diaristas/cadastros:", diaristasCadUrl);

  // 4. /intermitentes/aprovacoes
  console.log("Acessando /intermitentes/aprovacoes...");
  await page.goto(`${BASE_URL}/intermitentes/aprovacoes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const shotIntermitentes = `${CAPTURES_DIR}/rh_intermitentes_aprovacoes.png`;
  await page.screenshot({ path: shotIntermitentes, fullPage: true });
  const intermitentesUrl = page.url();
  console.log("Destino /intermitentes/aprovacoes:", intermitentesUrl);

  await browser.close();

  return {
    colab: colabUrl.includes("/colaboradores"),
    diaristas: diaristasUrl.includes("/rh/diaristas"),
    diaristasCad: diaristasCadUrl.includes("/rh/diaristas/cadastros"),
    intermitentes: intermitentesUrl.includes("/intermitentes/aprovacoes")
  };
}

testRhDedicatedRoutes().then(console.log).catch(console.error);

