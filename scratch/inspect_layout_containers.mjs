import fs from "fs";
import path from "path";

const routes = [
  { module: "Dashboard Executivo (Referência)", route: "/operacional/dashboard", file: "src/pages/Dashboard.tsx" },
  { module: "Torre Operacional", route: "/operacional/pipeline", file: "src/pages/PipelineOperacional.tsx" },
  { module: "Operações por Volume", route: "/operacoes-volume", file: "src/pages/Operacoes.tsx" },
  { module: "Serviços Extras", route: "/operacional/servicos-extras", file: "src/pages/Operacional/ServicosExtrasRecebidos.tsx" },
  { module: "Custos Extras", route: "/operacional/custos-extras", file: "src/pages/Operacional/CustosExtrasRecebidos.tsx" },
  { module: "Ponto & Jornadas CLT", route: "/clt/pontos", file: "src/pages/Clt/PontoJornadasClt.tsx" },
  { module: "Fechamento Mensal CLT", route: "/banco-horas/fechamento", file: "src/pages/BancoHoras/FechamentoMensalCLT.tsx" },
  { module: "Diaristas (Painel)", route: "/operacional/diaristas", file: "src/pages/Rh/RhDiaristasPainel.tsx" },
  { module: "Intermitentes", route: "/operacional/intermitentes", file: "src/pages/Operacional/IntermitentesRecebidos.tsx" },
  { module: "Central de Aprovações", route: "/rh/aprovacoes", file: "src/pages/Rh/AprovacoesRh.tsx" },
  { module: "Central de Inconsistências", route: "/inconsistencias", file: "src/pages/Inconsistencias.tsx" },
  { module: "Fechamento de Ciclos", route: "/fechamento", file: "src/pages/Fechamento.tsx" },
  { module: "Receitas Operacionais", route: "/financeiro/receitas", file: "src/pages/Financeiro/ReceitasPipeline.tsx" },
  { module: "Despesas & Contas a Pagar", route: "/financeiro", file: "src/pages/CentralFinanceira.tsx" },
  { module: "Central Bancária", route: "/bancario", file: "src/pages/CentralBancaria.tsx" },
  { module: "Inadimplência & Cobrança", route: "/financeiro/inadimplencia", file: "src/pages/Financeiro/Inadimplencia.tsx" },
  { module: "Resultado Operacional (DRE)", route: "/financeiro/dre", file: "src/pages/Financeiro/RelatorioDRE.tsx" },
  { module: "Central de Relatórios", route: "/relatorios", file: "src/pages/Relatorios/CentralRelatoriosOficial.tsx" },
  { module: "Central de Cadastros", route: "/cadastros", file: "src/pages/CentralCadastros.tsx" },
  { module: "Regras & Tabelas Operacionais", route: "/cadastros/regras-operacionais", file: "src/pages/RegrasOperacionais.tsx" },
  { module: "Preferências", route: "/configuracoes", file: "src/pages/Configuracoes.tsx" },
  // Auxiliares
  { module: "Intermitentes (Lotes)", route: "/operacional/intermitentes/lotes", file: "src/pages/Operacional/IntermitentesLotes.tsx" },
  { module: "Diaristas (Cadastros)", route: "/rh/diaristas/cadastros", file: "src/pages/Rh/RhDiaristasGestao.tsx" },
  { module: "Visualizador de Relatório", route: "/relatorios/:reportId", file: "src/pages/Relatorios/RelatorioVisualizadorOficial.tsx" },
];

const results = [];

for (const r of routes) {
  const filePath = path.resolve(r.file);
  if (!fs.existsSync(filePath)) {
    results.push({ ...r, status: "FILE_NOT_FOUND" });
    continue;
  }
  const content = fs.readFileSync(filePath, "utf-8");

  // Check AppShell usage
  const appShellMatch = content.match(/<AppShell([\s\S]*?)>/);
  const usesAppShell = !!appShellMatch;
  let fullWidth = false;
  if (usesAppShell) {
    const propsStr = appShellMatch[1];
    if (/fullWidth=\{true\}/.test(propsStr) || /fullWidth(?=[\s>])/.test(propsStr)) {
      fullWidth = true;
    }
  }

  // Find root returned JSX element
  // Search for the first tag inside AppShell
  let rootInsideAppShell = "";
  if (usesAppShell) {
    const afterAppShell = content.substring(appShellMatch.index + appShellMatch[0].length);
    // Find first opening tag (div, section, main, etc.)
    const tagMatch = afterAppShell.match(/<([a-zA-Z0-9]+)([^>]*)>/);
    if (tagMatch) {
      const classNameMatch = tagMatch[2].match(/className=["']([^"']*)["']/);
      rootInsideAppShell = classNameMatch ? classNameMatch[1] : `[tag: ${tagMatch[1]}, no className]`;
    }
  }

  results.push({
    ...r,
    usesAppShell,
    fullWidth,
    rootInsideAppShell,
  });
}

console.log(JSON.stringify(results, null, 2));
