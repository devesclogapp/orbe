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

  // Entradas / Captura
  { pattern: "/operacional/pontos", label: "Pontos Recebidos", section: "Entradas / Captura" },
  { pattern: "/operacional/operacoes", label: "Operações Recebidas", section: "Entradas / Captura" },
  { pattern: "/operacional/diaristas", label: "Diaristas Recebidos", section: "Entradas / Captura" },
  { pattern: "/producao", label: "Lançamentos Operacionais", section: "Entradas / Captura" },
  { pattern: "/producao/diaristas", label: "Lançamento de Diaristas", section: "Ambiente Externo", parentPath: "/producao" },
  { pattern: "/producao/custos-extras", label: "Custos Extras", section: "Entradas / Captura", parentPath: "/producao" },
  { pattern: "/producao/servicos-extras", label: "Serviços Extras", section: "Entradas / Captura", parentPath: "/producao" },
  { pattern: "/importacoes", label: "Importações", section: "Entradas / Captura" },

  // Processamento / Pipeline
  { pattern: "/operacional/pipeline", label: "Pipeline Operacional", section: "Processamento / Pipeline" },
  { pattern: "/rh/diaristas", label: "Aprovações RH", section: "Processamento / Pipeline" },
  { pattern: "/inconsistencias", label: "Pendências", section: "Processamento / Pipeline", parentPath: "/operacional/pipeline" },
  { pattern: "/fechamento", label: "Lotes e Fechamentos", section: "Processamento / Pipeline" },
  { pattern: "/processamento", label: "Redirecionamento operacional", section: "Processamento / Pipeline", parentPath: "/operacional/pipeline" },
  { pattern: "/processamento/legado", label: "Redirecionamento operacional", section: "Processamento / Pipeline", parentPath: "/operacional/pipeline" },
  { pattern: "/processamento/reprocessamentos", label: "Reprocessamentos", section: "Processamento / Pipeline" },

  // RH
  { pattern: "/banco-horas", label: "Banco de Horas", section: "RH" },
  { pattern: "/banco-horas/processamento", label: "Processamento de Ponto", section: "RH", parentPath: "/banco-horas" },
  { pattern: "/banco-horas/regras", label: "Regras de Banco", section: "RH", parentPath: "/banco-horas" },
  { pattern: "/banco-horas/extrato/:id", label: "Extrato do colaborador", section: "RH", parentPath: "/banco-horas" },
  { pattern: "/cadastros", label: "Central de Cadastros", section: "RH" },
  { pattern: "/colaboradores", label: "Colaboradores", section: "RH", parentPath: "/cadastros" },
  { pattern: "/empresas", label: "Empresas / Clientes", section: "RH", parentPath: "/cadastros" },
  { pattern: "/transportadoras", label: "Transportadoras", section: "RH", parentPath: "/cadastros" },
  { pattern: "/fornecedores", label: "Fornecedores", section: "RH", parentPath: "/cadastros" },
  { pattern: "/servicos", label: "Serviços", section: "RH", parentPath: "/cadastros" },
  { pattern: "/coletores", label: "Coletores REP", section: "RH", parentPath: "/cadastros" },
  { pattern: "/rh/diaristas/cadastros", label: "Central de Cadastros", section: "RH", parentPath: "/rh/diaristas" },

  // Financeiro
  { pattern: "/financeiro", label: "Central Financeira", section: "Financeiro" },
  { pattern: "/financeiro/legado", label: "Financeiro (legado)", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/financeiro/regras", label: "Regras de Cálculo", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/financeiro/faturamento", label: "Faturamento por Cliente", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/financeiro/faturamento/:id", label: "Memória de Faturamento", section: "Financeiro", parentPath: "/financeiro/faturamento" },
  { pattern: "/financeiro/colaborador/:id", label: "Memória do Colaborador", section: "Financeiro", parentPath: "/financeiro" },
  { pattern: "/bancario", label: "Bancário / Remessas", section: "Financeiro" },
  { pattern: "/financeiro/remessa", label: "Remessa CNAB240", section: "Financeiro", parentPath: "/bancario" },
  { pattern: "/financeiro/remessa/historico", label: "Histórico de Remessas", section: "Financeiro", parentPath: "/bancario" },
  { pattern: "/financeiro/retorno", label: "Conciliação", section: "Financeiro", parentPath: "/bancario" },
  { pattern: "/financeiro/contas-bancarias", label: "Contas Bancárias", section: "Financeiro", parentPath: "/bancario" },

  // Governança
  { pattern: "/relatorios", label: "Central de Relatórios", section: "Governança" },
  { pattern: "/relatorios/legado", label: "Relatórios (legado)", section: "Governança", parentPath: "/relatorios" },
  { pattern: "/relatorios/detalhe/:id", label: "Visualização de Relatório", section: "Governança", parentPath: "/relatorios" },
  { pattern: "/relatorios/agendamentos", label: "Agendamentos", section: "Governança", parentPath: "/relatorios" },
  { pattern: "/relatorios/layouts", label: "Layouts de Exportação", section: "Governança", parentPath: "/relatorios" },
  { pattern: "/relatorios/integracao", label: "Integração Contábil", section: "Governança", parentPath: "/relatorios" },
  { pattern: "/relatorios/mapeamento", label: "Mapeamento Contábil", section: "Governança", parentPath: "/relatorios/integracao" },
  { pattern: "/relatorios/integracao/logs", label: "Logs de Integração", section: "Governança", parentPath: "/relatorios/integracao" },
  { pattern: "/governanca", label: "Governança", section: "Governança" },
  { pattern: "/governanca/usuarios", label: "Usuários", section: "Governança", parentPath: "/governanca" },
  { pattern: "/admin/usuarios-acessos", label: "Gestão de Usuários", section: "Governança", parentPath: "/governanca" },
  { pattern: "/governanca/perfis", label: "Perfis", section: "Governança", parentPath: "/governanca" },
  { pattern: "/governanca/auditoria", label: "Auditoria", section: "Governança", parentPath: "/governanca" },
  { pattern: "/governanca/automacao", label: "Automação Operacional", section: "Governança", parentPath: "/governanca" },

  // Configurações
  { pattern: "/cadastros/regras-operacionais", label: "Regras Operacionais", section: "Configurações", parentPath: "/configuracoes" },
  { pattern: "/configuracoes", label: "Preferências e Conta", section: "Configurações" },

  // Ambiente Externo
  { pattern: "/cliente/dashboard", label: "Portal do Cliente", section: "Ambiente Externo" },
  { pattern: "/cliente/relatorios", label: "Relatórios do Cliente", section: "Ambiente Externo", parentPath: "/cliente/dashboard" },
  { pattern: "/cliente/aprovacoes", label: "Aprovações do Cliente", section: "Ambiente Externo", parentPath: "/cliente/dashboard" },
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

