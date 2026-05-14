import { matchPath } from "react-router-dom";

type RouteMeta = {
  pattern: string;
  label: string;
  section: string;
  parentPath?: string;
};

const routeMeta: RouteMeta[] = [
  // Dashboard
  { pattern: "/operacional/dashboard", label: "Dashboard operacional", section: "Dashboard" },
  { pattern: "/central", label: "Central Operacional", section: "Dashboard" },
  { pattern: "/operacional", label: "Operacional", section: "Dashboard" },
  { pattern: "/", label: "Dashboard", section: "Dashboard" },

  // Entradas Operacionais
  { pattern: "/operacional/pontos", label: "Pontos Recebidos", section: "Entradas Operacionais" },
  { pattern: "/operacional/operacoes", label: "OperaÃ§Ãµes Recebidas", section: "Entradas Operacionais" },
  { pattern: "/operacional/diaristas", label: "Diaristas Recebidos", section: "Entradas Operacionais" },
  { pattern: "/producao", label: "LanÃ§amentos Operacionais", section: "Entradas Operacionais" },
  { pattern: "/producao/diaristas", label: "LanÃ§amento de Diaristas", section: "Ambiente Externo", parentPath: "/producao" },
  { pattern: "/producao/custos-extras", label: "Custos Extras", section: "Entradas Operacionais", parentPath: "/producao" },
  { pattern: "/producao/servicos-extras", label: "ServiÃ§os Extras", section: "Entradas Operacionais", parentPath: "/producao" },
  { pattern: "/importacoes", label: "ImportaÃ§Ãµes", section: "Entradas Operacionais" },
  { pattern: "/inconsistencias", label: "InconsistÃªncias", section: "Entradas Operacionais", parentPath: "/operacional/operacoes" },
  { pattern: "/processamento", label: "Redirecionamento operacional", section: "Entradas Operacionais", parentPath: "/operacional/operacoes" },
  { pattern: "/processamento/legado", label: "Redirecionamento operacional", section: "Entradas Operacionais", parentPath: "/operacional/operacoes" },

  // Processamento RH
  { pattern: "/cadastros", label: "Central de Cadastros", section: "Processamento RH" },
  { pattern: "/colaboradores", label: "Colaboradores", section: "Processamento RH", parentPath: "/cadastros" },
  { pattern: "/empresas", label: "Empresas / Clientes", section: "Processamento RH", parentPath: "/cadastros" },
  { pattern: "/transportadoras", label: "Transportadoras", section: "Processamento RH", parentPath: "/cadastros" },
  { pattern: "/fornecedores", label: "Fornecedores", section: "Processamento RH", parentPath: "/cadastros" },
  { pattern: "/servicos", label: "ServiÃ§os", section: "Processamento RH", parentPath: "/cadastros" },
  { pattern: "/coletores", label: "Coletores REP", section: "Processamento RH", parentPath: "/cadastros" },
  { pattern: "/banco-horas/processamento", label: "Processamento RH", section: "Processamento RH", parentPath: "/banco-horas" },
  { pattern: "/banco-horas", label: "Banco de Horas", section: "Processamento RH" },
  { pattern: "/banco-horas/regras", label: "Regras de Banco", section: "Processamento RH", parentPath: "/banco-horas" },
  { pattern: "/banco-horas/extrato/:id", label: "Extrato do colaborador", section: "Processamento RH", parentPath: "/banco-horas" },
  { pattern: "/rh/diaristas", label: "Painel de Diaristas", section: "Processamento RH" },
  { pattern: "/rh/diaristas/cadastros", label: "Central de Cadastros", section: "Processamento RH", parentPath: "/rh/diaristas" },
  { pattern: "/fechamento", label: "Fechamento Mensal", section: "Processamento RH" },

  // Financeiro
  { pattern: "/financeiro", label: "Central Financeira", section: "Financeiro" },
  { pattern: "/financeiro/legado", label: "Financeiro (legado)", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/financeiro/regras", label: "Regras de CÃ¡lculo", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/financeiro/faturamento", label: "Faturamento por Cliente", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/financeiro/faturamento/:id", label: "MemÃ³ria de Faturamento", section: "Financeiro", parentPath: "/financeiro/faturamento" },
  { pattern: "/financeiro/colaborador/:id", label: "MemÃ³ria do Colaborador", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/bancario", label: "Pagamentos e Remessas", section: "Financeiro" },
  { pattern: "/financeiro/remessa", label: "Remessa CNAB240", section: "Financeiro", parentPath: "/bancario" },
  { pattern: "/financeiro/remessa/historico", label: "HistÃ³rico de Remessas", section: "Financeiro", parentPath: "/bancario" },
  { pattern: "/financeiro/retorno", label: "Retorno BancÃ¡rio", section: "Financeiro", parentPath: "/bancario" },

  // GovernanÃ§a
  { pattern: "/relatorios", label: "Central de RelatÃ³rios", section: "GovernanÃ§a" },
  { pattern: "/relatorios/legado", label: "RelatÃ³rios (legado)", section: "GovernanÃ§a", parentPath: "/relatorios" },
  { pattern: "/relatorios/detalhe/:id", label: "VisualizaÃ§Ã£o de RelatÃ³rio", section: "GovernanÃ§a", parentPath: "/relatorios" },
  { pattern: "/relatorios/agendamentos", label: "Agendamentos", section: "GovernanÃ§a", parentPath: "/relatorios" },
  { pattern: "/relatorios/layouts", label: "Layouts de ExportaÃ§Ã£o", section: "GovernanÃ§a", parentPath: "/relatorios" },
  { pattern: "/relatorios/integracao", label: "IntegraÃ§Ã£o ContÃ¡bil", section: "GovernanÃ§a", parentPath: "/relatorios" },
  { pattern: "/relatorios/mapeamento", label: "Mapeamento ContÃ¡bil", section: "GovernanÃ§a", parentPath: "/relatorios/integracao" },
  { pattern: "/relatorios/integracao/logs", label: "Logs de IntegraÃ§Ã£o", section: "GovernanÃ§a", parentPath: "/relatorios/integracao" },
  { pattern: "/governanca", label: "GovernanÃ§a", section: "GovernanÃ§a" },
  { pattern: "/governanca/usuarios", label: "UsuÃ¡rios", section: "GovernanÃ§a", parentPath: "/governanca" },
  { pattern: "/admin/usuarios-acessos", label: "GestÃ£o de UsuÃ¡rios", section: "GovernanÃ§a", parentPath: "/governanca" },
  { pattern: "/governanca/perfis", label: "Perfis", section: "GovernanÃ§a", parentPath: "/governanca" },
  { pattern: "/governanca/auditoria", label: "Auditoria", section: "GovernanÃ§a", parentPath: "/governanca" },
  { pattern: "/governanca/automacao", label: "AutomaÃ§Ã£o Operacional", section: "GovernanÃ§a", parentPath: "/governanca" },

  // ConfiguraÃ§Ãµes
  { pattern: "/cadastros/regras-operacionais", label: "Regras Operacionais", section: "ConfiguraÃ§Ãµes", parentPath: "/configuracoes" },
  { pattern: "/configuracoes", label: "PreferÃªncias e Conta", section: "ConfiguraÃ§Ãµes" },

  // Ambiente Externo
  { pattern: "/cliente/dashboard", label: "Portal do Cliente", section: "Ambiente Externo" },
  { pattern: "/cliente/relatorios", label: "RelatÃ³rios do Cliente", section: "Ambiente Externo", parentPath: "/cliente/dashboard" },
  { pattern: "/cliente/aprovacoes", label: "AprovaÃ§Ãµes do Cliente", section: "Ambiente Externo", parentPath: "/cliente/dashboard" },
];

export const getRouteMeta = (pathname: string) =>
  routeMeta.find((item) => matchPath({ path: item.pattern, end: true }, pathname));

export const getRouteLabel = (pathname: string, fallback?: string) =>
  getRouteMeta(pathname)?.label || fallback || pathname;

export const getBackTarget = (pathname: string, explicitBackPath?: string) =>
  explicitBackPath || getRouteMeta(pathname)?.parentPath;

export const getSectionLabel = (pathname: string) =>
  getRouteMeta(pathname)?.section;

export const getBreadcrumbs = (pathname: string, currentLabel?: string) => {
  const chain: Array<{ label: string; path?: string }> = [];
  let current = getRouteMeta(pathname);
  let depth = 0;

  while (current && depth < 8) {
    chain.unshift({
      label: current.pattern === pathname && currentLabel ? currentLabel : current.label,
      path: current.pattern.includes(":") ? undefined : current.pattern,
    });
    current = current.parentPath ? getRouteMeta(current.parentPath) : undefined;
    depth += 1;
  }

  if (chain.length === 0 && currentLabel) {
    chain.push({ label: currentLabel });
  }

  if (chain.length > 0) {
    const last = chain[chain.length - 1];
    chain[chain.length - 1] = { ...last, path: undefined };
  }

  return chain;
};
