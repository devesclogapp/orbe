import { matchPath } from "react-router-dom";

type RouteMeta = {
  pattern: string;
  label: string;
  section: string;
  parentPath?: string;
};

const routeMeta: RouteMeta[] = [
  { pattern: "/financeiro/faturamento/:id", label: "Memoria de faturamento", section: "Controladoria", parentPath: "/financeiro/faturamento" },
  { pattern: "/financeiro/colaborador/:id", label: "Memoria do colaborador", section: "Controladoria", parentPath: "/financeiro" },
  { pattern: "/banco-horas/extrato/:id", label: "Extrato do colaborador", section: "Pessoas e Cadastros", parentPath: "/banco-horas" },
  { pattern: "/relatorios/detalhe/:id", label: "Visualizacao de relatorio", section: "Controladoria", parentPath: "/relatorios" },
  { pattern: "/relatorios/integracao/logs", label: "Logs de integracao", section: "Controladoria", parentPath: "/relatorios/integracao" },
  { pattern: "/financeiro/remessa/historico", label: "Historico de remessas", section: "Controladoria", parentPath: "/bancario" },
  { pattern: "/processamento/legado", label: "Processamento legado", section: "Operacional", parentPath: "/processamento" },
  { pattern: "/financeiro/regras", label: "Regras de calculo", section: "Controladoria", parentPath: "/financeiro" },
  { pattern: "/financeiro/faturamento", label: "Faturamento por cliente", section: "Controladoria", parentPath: "/financeiro" },
  { pattern: "/financeiro/remessa", label: "Remessa CNAB", section: "Controladoria", parentPath: "/bancario" },
  { pattern: "/financeiro/retorno", label: "Retorno bancario", section: "Controladoria", parentPath: "/bancario" },
  { pattern: "/relatorios/agendamentos", label: "Agendamentos", section: "Controladoria", parentPath: "/relatorios" },
  { pattern: "/relatorios/layouts", label: "Layouts de exportacao", section: "Controladoria", parentPath: "/relatorios" },
  { pattern: "/relatorios/integracao", label: "Integracao contabil", section: "Controladoria", parentPath: "/relatorios" },
  { pattern: "/relatorios/mapeamento", label: "Mapeamento contabil", section: "Controladoria", parentPath: "/relatorios/integracao" },
  { pattern: "/governanca/usuarios", label: "Usuarios", section: "Governanca", parentPath: "/governanca" },
  { pattern: "/governanca/perfis", label: "Perfis", section: "Governanca", parentPath: "/governanca" },
  { pattern: "/governanca/auditoria", label: "Auditoria", section: "Governanca", parentPath: "/governanca" },
  { pattern: "/banco-horas/regras", label: "Regras de banco", section: "Pessoas e Cadastros", parentPath: "/banco-horas" },
  { pattern: "/cliente/dashboard", label: "Portal do cliente", section: "Ambiente Externo" },
  { pattern: "/cliente/relatorios", label: "Relatorios do cliente", section: "Ambiente Externo", parentPath: "/cliente/dashboard" },
  { pattern: "/cliente/aprovacoes", label: "Aprovacoes do cliente", section: "Ambiente Externo", parentPath: "/cliente/dashboard" },
  { pattern: "/cadastros", label: "Central de cadastros", section: "Pessoas e Cadastros" },
  { pattern: "/cadastros/regras-operacionais", label: "Regras operacionais", section: "Pessoas e Cadastros", parentPath: "/cadastros" },
  { pattern: "/colaboradores", label: "Colaboradores", section: "Pessoas e Cadastros", parentPath: "/cadastros" },
  { pattern: "/empresas", label: "Empresas", section: "Pessoas e Cadastros", parentPath: "/cadastros" },
  { pattern: "/coletores", label: "Coletores REP", section: "Pessoas e Cadastros", parentPath: "/cadastros" },
  { pattern: "/banco-horas", label: "Banco de horas", section: "Pessoas e Cadastros" },
  { pattern: "/processamento", label: "Central operacional", section: "Operacional" },
  { pattern: "/importacoes", label: "Importacoes", section: "Operacional", parentPath: "/processamento" },
  { pattern: "/inconsistencias", label: "Inconsistencias", section: "Operacional", parentPath: "/processamento" },
  { pattern: "/producao", label: "Producao in-loco", section: "Operacional", parentPath: "/processamento" },
  { pattern: "/financeiro", label: "Central financeira", section: "Controladoria" },
  { pattern: "/bancario", label: "Central bancaria", section: "Controladoria" },
  { pattern: "/relatorios", label: "Central de relatorios", section: "Controladoria" },
  { pattern: "/governanca", label: "Central de governanca", section: "Governanca" },
  { pattern: "/configuracoes", label: "Preferencias e conta", section: "Sistema" },
  { pattern: "/simulacao/demo", label: "Gerador de demo", section: "Desenvolvimento" },
  { pattern: "/fechamento", label: "Fechamento mensal", section: "Controladoria", parentPath: "/financeiro" },
  { pattern: "/", label: "Dashboard", section: "Visao geral" },
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
