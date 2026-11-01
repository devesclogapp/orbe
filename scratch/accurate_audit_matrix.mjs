import fs from "fs";
import path from "path";

// Reference: Dashboard Executivo
// Viewport 1366: Sidebar 256, AppShell main md:p-6 (24px L, 24px R = 48px) -> 1366 - 256 - 48 = 1062px
// Viewport 1440: 1440 - 256 - 48 = 1136px
// Viewport 1920: 1920 - 256 - 48 = 1616px. AppShell container max-w-[1560px] -> 1560px (margin L/R: 28px)

const VIEWPORTS = [
  { name: "1366×768", width: 1366, refWidth: 1062, refMarginLR: 0, refPadLR: 24 },
  { name: "1440×900", width: 1440, refWidth: 1136, refMarginLR: 0, refPadLR: 24 },
  { name: "1920×1080", width: 1920, refWidth: 1560, refMarginLR: 28, refPadLR: 24 },
];

const screens = [
  { module: "Dashboard Executivo (Referência)", route: "/operacional/dashboard", file: "src/pages/Dashboard.tsx", lineTarget: 297 },
  { module: "Torre Operacional", route: "/operacional/pipeline", file: "src/pages/PipelineOperacional.tsx", lineTarget: 170 },
  { module: "Operações por Volume", route: "/operacoes-volume", file: "src/pages/Operacoes.tsx", lineTarget: 600 },
  { module: "Serviços Extras", route: "/operacional/servicos-extras", file: "src/pages/Operacional/ServicosExtrasRecebidos.tsx", lineTarget: 500 },
  { module: "Custos Extras", route: "/operacional/custos-extras", file: "src/pages/Operacional/CustosExtrasRecebidos.tsx", lineTarget: 400 },
  { module: "Ponto & Jornadas CLT", route: "/clt/pontos", file: "src/pages/Clt/PontoJornadasClt.tsx", lineTarget: 300 },
  { module: "Fechamento Mensal CLT", route: "/banco-horas/fechamento", file: "src/pages/BancoHoras/FechamentoMensalCLT.tsx", lineTarget: 343 },
  { module: "Diaristas (Painel)", route: "/operacional/diaristas", file: "src/pages/Rh/RhDiaristasPainel.tsx", lineTarget: 1027 },
  { module: "Intermitentes", route: "/operacional/intermitentes", file: "src/pages/Operacional/IntermitentesRecebidos.tsx", lineTarget: 400 },
  { module: "Central de Aprovações", route: "/rh/aprovacoes", file: "src/pages/Rh/AprovacoesRh.tsx", lineTarget: 657 },
  { module: "Central de Inconsistências", route: "/inconsistencias", file: "src/pages/Inconsistencias.tsx", lineTarget: 400 },
  { module: "Fechamento de Ciclos", route: "/fechamento", file: "src/pages/Fechamento.tsx", lineTarget: 500 },
  { module: "Receitas Operacionais", route: "/financeiro/receitas", file: "src/pages/Financeiro/ReceitasPipeline.tsx", lineTarget: 391 },
  { module: "Despesas & Contas a Pagar", route: "/financeiro", file: "src/pages/CentralFinanceira.tsx", lineTarget: 400 },
  { module: "Central Bancária", route: "/bancario", file: "src/pages/CentralBancaria.tsx", lineTarget: 300 },
  { module: "Inadimplência & Cobrança", route: "/financeiro/inadimplencia", file: "src/pages/Financeiro/Inadimplencia.tsx", lineTarget: 400 },
  { module: "Resultado Operacional (DRE)", route: "/financeiro/dre", file: "src/pages/Financeiro/RelatorioDRE.tsx", lineTarget: 310 },
  { module: "Central de Relatórios", route: "/relatorios", file: "src/pages/Relatorios/CentralRelatoriosOficial.tsx", lineTarget: 298 },
  { module: "Central de Cadastros", route: "/cadastros", file: "src/pages/CentralCadastros.tsx", lineTarget: 2687 },
  { module: "Regras & Tabelas Operacionais", route: "/cadastros/regras-operacionais", file: "src/pages/RegrasOperacionais.tsx", lineTarget: 2252 },
  { module: "Preferências", route: "/configuracoes", file: "src/pages/Configuracoes.tsx", lineTarget: 438 },
  // Auxiliares
  { module: "Intermitentes (Lotes)", route: "/operacional/intermitentes/lotes", file: "src/pages/Operacional/IntermitentesLotes.tsx", lineTarget: 200 },
  { module: "Diaristas (Cadastros)", route: "/rh/diaristas/cadastros", file: "src/pages/Rh/RhDiaristasGestao.tsx", lineTarget: 200 },
  { module: "Visualizador de Relatório", route: "/relatorios/:reportId", file: "src/pages/Relatorios/RelatorioVisualizadorOficial.tsx", lineTarget: 752 },
];

function extractMainReturnClasses(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  // Find all <AppShell occurrences
  const appShellIdxs = [];
  let pos = 0;
  while ((pos = content.indexOf("<AppShell", pos)) !== -1) {
    appShellIdxs.push(pos);
    pos += 9;
  }

  // The main return is typically the last AppShell in the file (after guards, error states, and loading states)
  const lastAppShellIdx = appShellIdxs[appShellIdxs.length - 1];
  const afterLastAppShell = content.substring(lastAppShellIdx);
  const tagMatch = afterLastAppShell.match(/<AppShell[\s\S]*?>\s*(?:\{[\s\S]*?\}\s*)?(?:<style[\s\S]*?<\/style>\s*)?<([a-zA-Z0-9]+)([^>]*)>/);
  
  if (tagMatch) {
    const classMatch = tagMatch[2].match(/className=["']([^"']*)["']/);
    return classMatch ? classMatch[1] : `[tag: ${tagMatch[1]}, no class]`;
  }
  return "";
}

const detailed = screens.map(s => {
  const filePath = path.resolve(s.file);
  const innerClasses = extractMainReturnClasses(filePath);

  let explicitMaxW = null;
  const maxWMatch = innerClasses.match(/max-w-\[?([0-9a-zA-Z_-]+)\]?/);
  if (maxWMatch) explicitMaxW = maxWMatch[1];

  let extraPadX = 0;
  if (innerClasses.includes("px-4") || innerClasses.includes("p-4")) extraPadX = 16;
  if (innerClasses.includes("md:px-6") || innerClasses.includes("md:p-6")) extraPadX = 24;
  if (innerClasses.includes("md:px-8")) extraPadX = 32;

  let causa = "Conforme: Alinhado à referência do AppShell (1560px)";
  let precisaCorrecao = "Não";
  let prioridade = "—";
  let tipoDivergencia = "CONFORME";

  if (s.module.includes("Referência")) {
    causa = "Gabarito canônico do Design System (max-w-[1560px] mx-auto)";
    precisaCorrecao = "Não (Referência)";
    prioridade = "—";
    tipoDivergencia = "REFERÊNCIA";
  } else if (explicitMaxW === "1700px" && extraPadX > 0) {
    causa = "max-w-[1700px] conflitante com container pai (1560px) + padding horizontal duplicado (" + extraPadX + "px)";
    precisaCorrecao = "Sim";
    prioridade = "P1";
    tipoDivergencia = "PADDING_DUPLICADO_E_CONFLITO_MAXW";
  } else if (explicitMaxW === "1700px") {
    causa = "max-w-[1700px] inócuo/conflitante com container pai do AppShell (1560px)";
    precisaCorrecao = "Sim (Padronização preventiva)";
    prioridade = "P2";
    tipoDivergencia = "CONFLITO_MAXW";
  } else if (extraPadX > 0) {
    causa = "Padding horizontal duplicado no filho (" + (extraPadX === 24 ? "p-4 md:p-6" : extraPadX + "px") + ") dentro de AppShell";
    precisaCorrecao = "Sim";
    prioridade = "P1";
    tipoDivergencia = "PADDING_DUPLICADO";
  } else if (innerClasses.includes("max-w-[1560px]")) {
    causa = "Conforme: Wrapper explícito idêntico ao Dashboard Executivo (max-w-[1560px] mx-auto)";
    precisaCorrecao = "Não";
    prioridade = "—";
    tipoDivergencia = "CONFORME_EXPLICITO";
  } else {
    causa = "Conforme: Herança direta do container AppShell (max-w-[1560px] mx-auto w-full)";
    precisaCorrecao = "Não (Opcional uniformizar wrapper)";
    prioridade = "P3";
    tipoDivergencia = "CONFORME_HERDADO";
  }

  const viewports = VIEWPORTS.map(vp => {
    const availMain = vp.width - 256;
    const mainPad = 24;
    const appShellInnerAvail = availMain - (mainPad * 2);
    const appShellContainerW = Math.min(appShellInnerAvail, 1560);

    let innerW = appShellContainerW;
    if (explicitMaxW === "1560px") innerW = Math.min(appShellContainerW, 1560);
    else if (explicitMaxW === "1700px") innerW = Math.min(appShellContainerW, 1700);

    const effectiveWidth = innerW - (extraPadX * 2);
    const diff = effectiveWidth - vp.refWidth;
    const marginLR = Math.max(0, (appShellInnerAvail - appShellContainerW) / 2);

    return {
      viewport: vp.name,
      effectiveWidth,
      refWidth: vp.refWidth,
      diff,
      marginLR,
      padL: 24 + extraPadX,
      padR: 24 + extraPadX,
    };
  });

  return {
    module: s.module,
    route: s.route,
    file: s.file,
    innerClasses,
    explicitMaxW,
    extraPadX,
    causa,
    precisaCorrecao,
    prioridade,
    tipoDivergencia,
    viewports,
  };
});

fs.writeFileSync("scratch/accurate_layout_audit.json", JSON.stringify(detailed, null, 2), "utf-8");
console.log("Accurate layout audit completed.");
