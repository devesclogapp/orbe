import { matchPath } from "react-router-dom";

type RouteMeta = {
  pattern: string;
  label: string;
  section: string;
  parentPath?: string;
};

const routeMeta: RouteMeta[] = [
  // --- INÍCIO ---
  { pattern: "/operacional/dashboard", label: "Dashboard Executivo", section: "Início" },
  { pattern: "/central", label: "Central Operacional", section: "Início" },
  { pattern: "/operacional", label: "Dashboard Executivo", section: "Início" },
  { pattern: "/", label: "Dashboard Executivo", section: "Início" },
  { pattern: "/operacional/pipeline", label: "Torre Operacional", section: "Início" },

  // --- OPERAÇÕES DE CAMPO ---
  { pattern: "/operacoes-volume", label: "Operações por Volume", section: "Operações de Campo" },
  { pattern: "/operacoes-volume/nova", label: "Lançamentos Operacionais", section: "Operações de Campo", parentPath: "/operacoes-volume" },
  { pattern: "/operacoes-volume/aprovacoes", label: "Aprovações RH", section: "Aprovações & Fechamento", parentPath: "/operacoes-volume" },
  { pattern: "/operacional/operacoes", label: "Operações por Volume", section: "Operações de Campo" },
  { pattern: "/operacional/servicos-extras", label: "Serviços Extras", section: "Operações de Campo" },
  { pattern: "/servicos-extras/novo", label: "Serviços Extras", section: "Operações de Campo", parentPath: "/operacional/servicos-extras" },
  { pattern: "/servicos-extras/lancamentos", label: "Serviços Extras", section: "Operações de Campo", parentPath: "/operacional/servicos-extras" },
  { pattern: "/servicos-extras/aprovacoes", label: "Aprovações (Serviços Extras)", section: "Aprovações & Fechamento", parentPath: "/operacional/servicos-extras" },
  { pattern: "/operacional/custos-extras", label: "Custos Extras", section: "Operações de Campo" },
  { pattern: "/custos-extras/novo", label: "Custos Extras", section: "Operações de Campo", parentPath: "/operacional/custos-extras" },
  { pattern: "/custos-extras/lancamentos", label: "Custos Extras", section: "Operações de Campo", parentPath: "/operacional/custos-extras" },
  { pattern: "/custos-extras/aprovacoes", label: "Aprovações (Custos Extras)", section: "Aprovações & Fechamento", parentPath: "/operacional/custos-extras" },

  // --- PESSOAS & RH ---
  { pattern: "/clt/pontos", label: "Ponto & Jornadas CLT", section: "Pessoas & RH" },
  { pattern: "/operacional/pontos", label: "Pontos CLT Recebidos", section: "Pessoas & RH", parentPath: "/clt/pontos" },
  { pattern: "/clt/banco-horas", label: "Banco de Horas", section: "Pessoas & RH", parentPath: "/clt/pontos" },
  { pattern: "/banco-horas", label: "Banco de Horas", section: "Pessoas & RH", parentPath: "/clt/pontos" },
  { pattern: "/banco-horas/processamento", label: "Processamento de Ponto", section: "Pessoas & RH", parentPath: "/clt/pontos" },
  { pattern: "/banco-horas/fechamento", label: "Fechamento Mensal CLT", section: "Pessoas & RH" },
  { pattern: "/banco-horas/regras", label: "Regras de Banco", section: "Pessoas & RH", parentPath: "/clt/pontos" },
  { pattern: "/banco-horas/extrato/:id", label: "Extrato do colaborador", section: "Pessoas & RH", parentPath: "/clt/pontos" },
  { pattern: "/operacional/diaristas", label: "Diaristas", section: "Pessoas & RH" },
  { pattern: "/rh/diaristas", label: "Diaristas (Aprovações)", section: "Pessoas & RH", parentPath: "/operacional/diaristas" },
  { pattern: "/rh/diaristas/cadastros", label: "Cadastros de Diaristas", section: "Pessoas & RH", parentPath: "/operacional/diaristas" },
  { pattern: "/diaristas/aprovacoes", label: "Aprovações (Diaristas)", section: "Aprovações & Fechamento", parentPath: "/operacional/diaristas" },
  { pattern: "/operacional/intermitentes", label: "Intermitentes", section: "Pessoas & RH" },
  { pattern: "/operacional/intermitentes/lotes", label: "Lotes de Intermitentes", section: "Pessoas & RH", parentPath: "/operacional/intermitentes" },
  { pattern: "/intermitentes/lotes", label: "Lotes de Intermitentes", section: "Pessoas & RH", parentPath: "/operacional/intermitentes" },
  { pattern: "/intermitentes/aprovacoes", label: "Aprovações (Intermitentes)", section: "Aprovações & Fechamento", parentPath: "/operacional/intermitentes" },
  { pattern: "/clt/aprovacoes", label: "Aprovações (CLT)", section: "Aprovações & Fechamento", parentPath: "/clt/pontos" },
  { pattern: "/processamento/reprocessamentos", label: "Reprocessamentos", section: "Pessoas & RH", parentPath: "/clt/pontos" },

  // --- APROVAÇÕES & FECHAMENTO ---
  { pattern: "/rh/aprovacoes", label: "Central de Aprovações", section: "Aprovações & Fechamento" },
  { pattern: "/inconsistencias", label: "Central de Inconsistências", section: "Aprovações & Fechamento" },
  { pattern: "/intermitentes/inconsistencias", label: "Pendências (Intermitentes)", section: "Aprovações & Fechamento", parentPath: "/inconsistencias" },
  { pattern: "/fechamento", label: "Fechamento de Ciclos", section: "Aprovações & Fechamento" },

  // --- FINANCEIRO & CONTROLADORIA ---
  { pattern: "/financeiro/receitas", label: "Receitas Operacionais", section: "Financeiro & Controladoria" },
  { pattern: "/financeiro", label: "Despesas & Contas a Pagar", section: "Financeiro & Controladoria" },
  { pattern: "/financeiro/legado", label: "Financeiro (legado)", section: "Financeiro & Controladoria", parentPath: "/financeiro" },
  { pattern: "/financeiro/regras", label: "Regras de Cálculo", section: "Financeiro & Controladoria", parentPath: "/financeiro" },
  { pattern: "/financeiro/faturamento", label: "Faturamento por Cliente", section: "Financeiro & Controladoria", parentPath: "/financeiro/receitas" },
  { pattern: "/financeiro/faturamento/:id", label: "Memória de Faturamento", section: "Financeiro & Controladoria", parentPath: "/financeiro/receitas" },
  { pattern: "/financeiro/colaborador/:id", label: "Memória do Colaborador", section: "Financeiro & Controladoria", parentPath: "/financeiro" },
  { pattern: "/bancario", label: "Central Bancária", section: "Financeiro & Controladoria" },
  { pattern: "/financeiro/remessa", label: "Remessa CNAB240", section: "Financeiro & Controladoria", parentPath: "/bancario" },
  { pattern: "/financeiro/remessa/historico", label: "Histórico de Remessas", section: "Financeiro & Controladoria", parentPath: "/bancario" },
  { pattern: "/financeiro/retorno", label: "Conciliação", section: "Financeiro & Controladoria", parentPath: "/bancario" },
  { pattern: "/financeiro/contas-bancarias", label: "Contas Bancárias", section: "Financeiro & Controladoria", parentPath: "/bancario" },
  { pattern: "/financeiro/inadimplencia", label: "Inadimplência & Cobrança", section: "Financeiro & Controladoria" },
  { pattern: "/financeiro/dre", label: "Resultado Operacional (DRE)", section: "Financeiro & Controladoria" },

  // --- CADASTROS & SISTEMA ---
  { pattern: "/cadastros", label: "Central de Cadastros", section: "Cadastros & Sistema" },
  { pattern: "/cadastros/regras-operacionais", label: "Regras & Tabelas Operacionais", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/configuracoes", label: "Preferências", section: "Cadastros & Sistema" },
  { pattern: "/colaboradores", label: "Colaboradores", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/empresas", label: "Empresas / Clientes", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/transportadoras", label: "Transportadoras", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/fornecedores", label: "Fornecedores", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/servicos", label: "Serviços", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/coletores", label: "Coletores REP", section: "Cadastros & Sistema", parentPath: "/cadastros" },
  { pattern: "/importacoes", label: "Importações", section: "Cadastros & Sistema", parentPath: "/cadastros" },

  // Governança / Relatórios
  { pattern: "/relatorios", label: "Central de Relatórios", section: "Cadastros & Sistema" },
  { pattern: "/relatorios/legado", label: "Relatórios (legado)", section: "Cadastros & Sistema", parentPath: "/relatorios" },
  { pattern: "/relatorios/detalhe/:id", label: "Visualização de Relatório", section: "Cadastros & Sistema", parentPath: "/relatorios" },
  { pattern: "/relatorios/agendamentos", label: "Agendamentos", section: "Cadastros & Sistema", parentPath: "/relatorios" },
  { pattern: "/relatorios/layouts", label: "Layouts de Exportação", section: "Cadastros & Sistema", parentPath: "/relatorios" },
  { pattern: "/relatorios/integracao", label: "Integração Contábil", section: "Cadastros & Sistema", parentPath: "/relatorios" },
  { pattern: "/relatorios/mapeamento", label: "Mapeamento Contábil", section: "Cadastros & Sistema", parentPath: "/relatorios/integracao" },
  { pattern: "/relatorios/integracao/logs", label: "Logs de Integração", section: "Cadastros & Sistema", parentPath: "/relatorios/integracao" },
  { pattern: "/governanca", label: "Governança", section: "Cadastros & Sistema" },
  { pattern: "/governanca/usuarios", label: "Usuários", section: "Cadastros & Sistema", parentPath: "/governanca" },
  { pattern: "/admin/usuarios-acessos", label: "Gestão de Usuários", section: "Cadastros & Sistema", parentPath: "/governanca" },
  { pattern: "/governanca/perfis", label: "Perfis", section: "Cadastros & Sistema", parentPath: "/governanca" },
  { pattern: "/governanca/auditoria", label: "Auditoria", section: "Cadastros & Sistema", parentPath: "/governanca" },
  { pattern: "/governanca/automacao", label: "Automação Operacional", section: "Cadastros & Sistema", parentPath: "/governanca" },

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
