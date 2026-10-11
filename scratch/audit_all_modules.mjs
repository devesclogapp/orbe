import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const email = 'e2e-test@orbe.local';
const password = '123456';

const routesToAudit = [
  { name: 'Dashboard Executivo', path: '/operacional/dashboard' },
  { name: 'Torre Operacional', path: '/operacional/pipeline' },
  { name: 'Operações por Volume', path: '/operacoes-volume' },
  { name: 'Serviços Extras', path: '/operacional/servicos-extras' },
  { name: 'Custos Extras', path: '/operacional/custos-extras' },
  { name: 'Ponto CLT', path: '/clt/pontos' },
  { name: 'Fechamento Mensal CLT', path: '/banco-horas/fechamento' },
  { name: 'Diaristas Painel', path: '/operacional/diaristas' },
  { name: 'Intermitentes Jornadas', path: '/operacional/intermitentes' },
  { name: 'Intermitentes Lotes', path: '/operacional/intermitentes/lotes' },
  { name: 'Central Aprovações RH', path: '/rh/aprovacoes' },
  { name: 'Central Inconsistências', path: '/inconsistencias' },
  { name: 'Fechamento de Ciclos Hub', path: '/fechamento' },
  { name: 'Receitas Operacionais', path: '/financeiro/receitas' },
  { name: 'Despesas & Contas a Pagar', path: '/financeiro' },
  { name: 'Central Bancária', path: '/bancario' },
  { name: 'Inadimplência & Cobrança', path: '/financeiro/inadimplencia' },
  { name: 'Resultado Operacional DRE', path: '/financeiro/dre' },
  { name: 'Central de Relatórios', path: '/relatorios' },
  { name: 'Central de Cadastros', path: '/cadastros' },
  { name: 'Regras Operacionais', path: '/cadastros/regras-operacionais' },
  { name: 'Configurações & Preferências', path: '/configuracoes' }
];

async function runAudit() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Auth error:', error);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });

  const auditMatrix = [];

  for (const vp of [{ width: 1440, height: 900, label: '1440x900' }, { width: 1366, height: 768, label: '1366x768' }]) {
    console.log(`\n=== Auditing Viewport ${vp.label} ===`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addInitScript(({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, {
      storageKey: 'sb-lifgjtcflzmspilhryap-auth-token',
      session: data.session
    });

    const page = await context.newPage();

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 120));
    });

    for (const r of routesToAudit) {
      console.log(`Scanning [${r.name}] -> ${r.path}...`);
      try {
        await page.goto(`http://localhost:8080${r.path}`, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);

        const check = await page.evaluate((vpWidth) => {
          const docW = document.documentElement.scrollWidth;
          const bodyW = document.body.scrollWidth;
          const winW = window.innerWidth;
          const hasHOverflow = docW > winW || bodyW > winW;
          const diff = Math.max(docW, bodyW) - winW;

          // Check for tables
          const tables = Array.from(document.querySelectorAll('table'));
          const tableDetails = tables.map(t => {
            const tr = t.getBoundingClientRect();
            const parent = t.parentElement;
            const parentStyle = parent ? window.getComputedStyle(parent) : null;
            const isContained = parentStyle ? (parentStyle.overflowX === 'auto' || parentStyle.overflowX === 'scroll' || parentStyle.overflow === 'auto') : false;
            return {
              width: Math.round(tr.width),
              parentOverflowX: parentStyle ? parentStyle.overflowX : 'none',
              isContained,
              overflowsWindow: tr.right > winW + 5
            };
          });

          // Check visible buttons / actions clipping
          const buttons = Array.from(document.querySelectorAll('button'));
          const clippedButtons = buttons.filter(b => {
            const br = b.getBoundingClientRect();
            return br.right > winW || br.left < 0;
          }).length;

          return {
            hasHOverflow,
            diff: hasHOverflow ? diff : 0,
            tableCount: tables.length,
            tableDetails,
            clippedButtons
          };
        }, vp.width);

        const safeName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const screenshotPath = `scratch/audit_${vp.label}_${safeName}.png`;
        await page.screenshot({ path: screenshotPath });

        auditMatrix.push({
          module: r.name,
          route: r.path,
          viewport: vp.label,
          hasHOverflow: check.hasHOverflow,
          overflowDiff: check.diff,
          tableCount: check.tableCount,
          tableDetails: check.tableDetails,
          clippedButtons: check.clippedButtons,
          screenshot: screenshotPath,
          consoleErrorsCount: consoleErrors.length
        });
      } catch (err) {
        console.error(`Error on route ${r.path}:`, err.message);
        auditMatrix.push({
          module: r.name,
          route: r.path,
          viewport: vp.label,
          error: err.message
        });
      }
    }

    await context.close();
  }

  await browser.close();
  fs.writeFileSync('scratch/conv22_all_modules_matrix.json', JSON.stringify(auditMatrix, null, 2));
  console.log('\nAudit complete! Matrix saved to scratch/conv22_all_modules_matrix.json');
}

runAudit().catch(console.error);
