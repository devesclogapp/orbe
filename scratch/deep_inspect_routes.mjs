import fs from "fs";
import path from "path";

// Viewport constants
// Screen: 1366x768 -> Sidebar 256px -> Content area 1110px. Main pad 24px left + 24px right (48px) -> Inner width = 1062px
// Screen: 1440x900 -> Sidebar 256px -> Content area 1184px. Main pad 24px left + 24px right (48px) -> Inner width = 1136px
// Screen: 1920x1080 -> Sidebar 256px -> Content area 1664px. Main pad 24px left + 24px right (48px) -> Inner width = 1616px. Max width cap 1560px -> Container width = 1560px, Margin L/R = (1616 - 1560)/2 = 28px.

const VIEWPORTS = [
  { name: "1366×768", width: 1366, refWidth: 1062, refMarginLR: 0, refPadLR: 24 },
  { name: "1440×900", width: 1440, refWidth: 1136, refMarginLR: 0, refPadLR: 24 },
  { name: "1920×1080", width: 1920, refWidth: 1560, refMarginLR: 28, refPadLR: 24 },
];

const screens = [
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
  // Auxiliares vinculadas à Sidebar
  { module: "Intermitentes (Lotes)", route: "/operacional/intermitentes/lotes", file: "src/pages/Operacional/IntermitentesLotes.tsx" },
  { module: "Diaristas (Cadastros)", route: "/rh/diaristas/cadastros", file: "src/pages/Rh/RhDiaristasGestao.tsx" },
  { module: "Visualizador de Relatório", route: "/relatorios/:reportId", file: "src/pages/Relatorios/RelatorioVisualizadorOficial.tsx" },
];

function analyzeScreen(s) {
  const filePath = path.resolve(s.file);
  const content = fs.readFileSync(filePath, "utf-8");

  const appShellMatch = content.match(/<AppShell([\s\S]*?)>/);
  const fullWidth = appShellMatch && (/fullWidth=\{true\}/.test(appShellMatch[1]) || /fullWidth(?=[\s>])/.test(appShellMatch[1]));

  let innerClasses = "";
  if (appShellMatch) {
    const after = content.substring(appShellMatch.index + appShellMatch[0].length);
    const firstTagMatch = after.match(/<([a-zA-Z0-9]+)([^>]*)>/);
    if (firstTagMatch) {
      const clsMatch = firstTagMatch[2].match(/className=["']([^"']*)["']/);
      if (clsMatch) {
        innerClasses = clsMatch[1];
      }
    }
  }

  // Check specific layout attributes
  let explicitMaxW = null;
  const maxWMatch = innerClasses.match(/max-w-\[?([0-9a-zA-Z_-]+)\]?/);
  if (maxWMatch) {
    explicitMaxW = maxWMatch[1];
  }

  let extraPadX = 0;
  if (innerClasses.includes("px-4") || innerClasses.includes("p-4")) {
    extraPadX = 16;
  }
  if (innerClasses.includes("md:px-6") || innerClasses.includes("md:p-6")) {
    extraPadX = 24;
  }
  if (innerClasses.includes("md:px-8")) {
    extraPadX = 32;
  }
  if (innerClasses.includes("p-20")) {
    extraPadX = 80;
  }

  // Diagnóstico e Causa
  let causa = "Alinhado com a referência do AppShell (1560px)";
  let precisaCorrecao = "Não";
  let prioridade = "—";
  let tipoDivergencia = "CONFORME";

  if (s.module.includes("Referência")) {
    causa = "Gabarito canônico do Design System (max-w-[1560px] mx-auto)";
    precisaCorrecao = "Não (Referência)";
    prioridade = "—";
    tipoDivergencia = "REFERÊNCIA";
  } else if (explicitMaxW === "1700px" && extraPadX > 0) {
    causa = "max-w-[1700px] em conflito com container pai (1560px) + padding horizontal duplicado (" + extraPadX + "px)";
    precisaCorrecao = "Sim";
    prioridade = "P1";
    tipoDivergencia = "PADDING_DUPLICADO_E_CONFLITO_MAXW";
  } else if (explicitMaxW === "1700px") {
    causa = "max-w-[1700px] inócuo/conflitante com container pai do AppShell (1560px)";
    precisaCorrecao = "Sim (Padronização preventiva)";
    prioridade = "P2";
    tipoDivergencia = "CONFLITO_MAXW";
  } else if (extraPadX > 0 && explicitMaxW === "1560px") {
    causa = "Padding horizontal duplicado no filho (p-4 md:p-6) dentro de AppShell que já provê p-4 md:p-6";
    precisaCorrecao = "Sim";
    prioridade = "P1";
    tipoDivergencia = "PADDING_DUPLICADO";
  } else if (explicitMaxW === "4xl") {
    causa = "Restrição intencional para visualização de documento / caderno A4 (max-w-4xl = 896px)";
    precisaCorrecao = "Não (Restrição Intencional de Documento)";
    prioridade = "P3 (Preservar)";
    tipoDivergencia = "INTENCIONAL_DOCUMENTO";
  } else if (innerClasses.includes("p-20")) {
    causa = "Padding estático gigante p-20 (80px) em tela de preferências/placeholder";
    precisaCorrecao = "Sim";
    prioridade = "P2";
    tipoDivergencia = "PADDING_EXCESSIVO";
  } else if (!innerClasses.includes("max-w-[1560px]") && !innerClasses.includes("w-full")) {
    // Tela herda AppShell, mas não tem wrapper com w-full max-w-[1560px] mx-auto idêntico ao Dashboard
    causa = "Herança indireta do container AppShell sem wrapper local padronizado (w-full max-w-[1560px])";
    precisaCorrecao = "Opcional (Uniformização semântica)";
    prioridade = "P3";
    tipoDivergencia = "HERANCA_SEM_WRAPPER_EXPLICITO";
  }

  // Geometric measurements for each viewport
  const viewports = VIEWPORTS.map(vp => {
    const availMain = vp.width - 256;
    const mainPad = 24;
    const appShellInnerAvail = availMain - (mainPad * 2);
    const appShellContainerW = fullWidth ? appShellInnerAvail : Math.min(appShellInnerAvail, 1560);

    let innerW = appShellContainerW;
    if (explicitMaxW === "1560px") innerW = Math.min(appShellContainerW, 1560);
    else if (explicitMaxW === "1700px") innerW = Math.min(appShellContainerW, 1700);
    else if (explicitMaxW === "4xl") innerW = Math.min(appShellContainerW, 896);

    const effectiveWidth = innerW - (extraPadX * 2);
    const diff = effectiveWidth - vp.refWidth;
    const marginLR = fullWidth ? 0 : Math.max(0, (appShellInnerAvail - appShellContainerW) / 2);

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
    fullWidth,
    explicitMaxW,
    extraPadX,
    causa,
    precisaCorrecao,
    prioridade,
    tipoDivergencia,
    viewports,
  };
}

const detailed = screens.map(analyzeScreen);
fs.writeFileSync("scratch/layout_audit_results.json", JSON.stringify(detailed, null, 2), "utf-8");
console.log("Calculated layout audit results for " + detailed.length + " screens.");
