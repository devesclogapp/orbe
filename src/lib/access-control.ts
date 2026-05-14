export const ACCESS_ACTIONS = [
  "ver",
  "criar",
  "editar",
  "excluir",
  "importar",
  "exportar",
  "aprovar",
  "processar",
  "fechar",
  "reabrir",
] as const;

export const ACCESS_MODULES = [
  "dashboard",
  "central_operacional",
  "operacoes_recebidas",
  "pontos_recebidos",
  "diaristas_recebidos",
  "banco_de_horas",
  "regras_de_banco",
  "processamento_rh",
  "cadastro_de_diaristas",
  "regras_operacionais",
  "fechamento_mensal",
  "central_de_cadastros",
  "central_financeira",
  "faturamento",
  "pagamentos_remessas",
  "regras_de_calculo",
  "central_de_relatorios",
  "automacao_operacional",
  "governanca",
  "importacoes",
  "portal_do_cliente",
  "onboarding",
] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];
export type AccessModule = (typeof ACCESS_MODULES)[number];
export type PermissionMatrix = Partial<
  Record<AccessModule, Partial<Record<AccessAction, boolean>>>
>;

export type AccessRole =
  | "admin"
  | "rh"
  | "financeiro"
  | "encarregado"
  | "gestor"
  | "user";

type PartialPermissionSet = Partial<Record<AccessAction, boolean>>;

export const ACCESS_ROLE_LABELS: Record<AccessRole, string> = {
  admin: "Admin",
  rh: "RH",
  financeiro: "Financeiro",
  encarregado: "Encarregado",
  gestor: "Gestor",
  user: "Usuário",
};

const allowAllActions = (): PartialPermissionSet =>
  Object.fromEntries(ACCESS_ACTIONS.map((action) => [action, true]));

const allowActions = (actions: AccessAction[]): PartialPermissionSet =>
  Object.fromEntries(actions.map((action) => [action, true]));

const adminPermissions = (): PermissionMatrix =>
  Object.fromEntries(
    ACCESS_MODULES.map((moduleId) => [moduleId, allowAllActions()]),
  ) as PermissionMatrix;

export const ACCESS_PRESETS: Record<AccessRole, PermissionMatrix> = {
  admin: adminPermissions(),
  rh: {
    pontos_recebidos: allowActions(["ver", "importar", "exportar"]),
    banco_de_horas: allowActions(["ver", "criar", "editar", "exportar"]),
    regras_de_banco: allowActions(["ver", "criar", "editar"]),
    processamento_rh: allowActions(["ver", "processar", "aprovar", "exportar"]),
    cadastro_de_diaristas: allowActions(["ver", "criar", "editar", "exportar"]),
    fechamento_mensal: allowActions(["ver", "processar", "fechar", "reabrir"]),
  },
  financeiro: {
    central_financeira: allowActions(["ver", "criar", "editar", "aprovar", "exportar"]),
    faturamento: allowActions(["ver", "criar", "editar", "aprovar", "exportar"]),
    pagamentos_remessas: allowActions(["ver", "criar", "editar", "aprovar", "processar", "exportar"]),
    regras_de_calculo: allowActions(["ver", "criar", "editar"]),
    fechamento_mensal: allowActions(["ver", "aprovar", "fechar", "reabrir"]),
    central_de_relatorios: allowActions(["ver", "exportar"]),
  },
  encarregado: {
    central_operacional: allowActions(["ver"]),
    operacoes_recebidas: allowActions(["ver", "criar", "editar", "processar", "exportar"]),
    diaristas_recebidos: allowActions(["ver", "criar", "editar", "processar"]),
    importacoes: allowActions(["ver", "criar", "importar"]),
  },
  gestor: {
    dashboard: allowActions(["ver"]),
    central_operacional: allowActions(["ver"]),
    operacoes_recebidas: allowActions(["ver", "aprovar"]),
    pontos_recebidos: allowActions(["ver", "aprovar"]),
    banco_de_horas: allowActions(["ver", "aprovar"]),
    processamento_rh: allowActions(["ver", "aprovar"]),
    fechamento_mensal: allowActions(["ver", "aprovar"]),
    central_financeira: allowActions(["ver", "aprovar"]),
    faturamento: allowActions(["ver", "aprovar"]),
    pagamentos_remessas: allowActions(["ver", "aprovar"]),
    central_de_relatorios: allowActions(["ver", "exportar"]),
  },
  user: {},
};

export const ACCESS_PRESET_OPTIONS: Array<{ value: AccessRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "encarregado", label: "Encarregado" },
  { value: "gestor", label: "Gestor" },
  { value: "user", label: "Personalizado" },
];

export const ACCESS_MODULE_LABELS: Record<AccessModule, string> = {
  dashboard: "Dashboard",
  central_operacional: "Central Operacional",
  operacoes_recebidas: "Operações Recebidas",
  pontos_recebidos: "Pontos Recebidos",
  diaristas_recebidos: "Diaristas Recebidos",
  banco_de_horas: "Banco de Horas",
  regras_de_banco: "Regras de Banco",
  processamento_rh: "Processamento RH",
  cadastro_de_diaristas: "Cadastro de Diaristas",
  regras_operacionais: "Regras Operacionais",
  fechamento_mensal: "Fechamento Mensal",
  central_de_cadastros: "Central de Cadastros",
  central_financeira: "Central Financeira",
  faturamento: "Faturamento",
  pagamentos_remessas: "Pagamentos e Remessas",
  regras_de_calculo: "Regras de Cálculo",
  central_de_relatorios: "Central de Relatórios",
  automacao_operacional: "Automação Operacional",
  governanca: "Governança",
  importacoes: "Importações",
  portal_do_cliente: "Portal do Cliente",
  onboarding: "Onboarding",
};

export const DEFAULT_INVITE_EXPIRATION_DAYS = 7;

export const ROUTE_ACCESS_RULES: Array<{
  prefix: string;
  module: AccessModule;
  action?: AccessAction;
}> = [
  { prefix: "/financeiro/faturamento", module: "faturamento" },
  { prefix: "/financeiro/regras", module: "regras_de_calculo" },
  { prefix: "/financeiro/remessa", module: "pagamentos_remessas" },
  { prefix: "/financeiro/retorno", module: "pagamentos_remessas" },
  { prefix: "/colaboradores", module: "central_de_cadastros" },
  { prefix: "/empresas", module: "central_de_cadastros" },
  { prefix: "/transportadoras", module: "central_de_cadastros" },
  { prefix: "/fornecedores", module: "central_de_cadastros" },
  { prefix: "/servicos", module: "central_de_cadastros" },
  { prefix: "/coletores", module: "central_de_cadastros" },
  { prefix: "/operacional/dashboard", module: "dashboard" },
  { prefix: "/", module: "dashboard" },
  { prefix: "/central", module: "central_operacional" },
  { prefix: "/producao", module: "central_operacional" },
  { prefix: "/operacional/operacoes", module: "operacoes_recebidas" },
  { prefix: "/operacional/pontos", module: "pontos_recebidos" },
  { prefix: "/operacional/diaristas", module: "diaristas_recebidos" },
  { prefix: "/producao/diaristas", module: "diaristas_recebidos" },
  { prefix: "/rh/diaristas", module: "diaristas_recebidos" },
  { prefix: "/banco-horas/regras", module: "regras_de_banco" },
  { prefix: "/banco-horas/processamento", module: "processamento_rh" },
  { prefix: "/banco-horas", module: "banco_de_horas" },
  { prefix: "/rh/diaristas/cadastros", module: "cadastro_de_diaristas" },
  { prefix: "/cadastros/regras-operacionais", module: "regras_operacionais" },
  { prefix: "/fechamento", module: "fechamento_mensal" },
  { prefix: "/cadastros", module: "central_de_cadastros" },
  { prefix: "/financeiro", module: "central_financeira" },
  { prefix: "/bancario", module: "pagamentos_remessas" },
  { prefix: "/relatorios", module: "central_de_relatorios" },
  { prefix: "/governanca/perfis", module: "governanca" },
  { prefix: "/governanca/auditoria", module: "governanca" },
  { prefix: "/governanca/automacao", module: "automacao_operacional" },
  { prefix: "/governanca", module: "governanca" },
  { prefix: "/admin/usuarios-acessos", module: "governanca" },
  { prefix: "/importacoes", module: "importacoes" },
  { prefix: "/cliente", module: "portal_do_cliente" },
  { prefix: "/onboarding", module: "onboarding" },
];

export function clonePermissionMatrix(matrix?: PermissionMatrix | null): PermissionMatrix {
  if (!matrix) return {};

  return Object.fromEntries(
    Object.entries(matrix).map(([moduleId, actions]) => [moduleId, { ...(actions || {}) }]),
  ) as PermissionMatrix;
}

export function buildPresetPermissions(role: string | null | undefined): PermissionMatrix {
  const normalizedRole = normalizeRole(role);
  return clonePermissionMatrix(ACCESS_PRESETS[normalizedRole]);
}

export function normalizeRole(role: string | null | undefined): AccessRole {
  const normalized = String(role ?? "user").trim().toLowerCase();

  if (normalized === "admin") return "admin";
  if (normalized === "rh") return "rh";
  if (normalized === "financeiro") return "financeiro";
  if (normalized === "encarregado") return "encarregado";
  if (normalized === "gestor") return "gestor";

  return "user";
}

export function normalizePermissionMatrix(matrix?: unknown, role?: string | null): PermissionMatrix {
  const base = buildPresetPermissions(role);

  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) {
    return base;
  }

  const next = clonePermissionMatrix(base);

  for (const moduleId of ACCESS_MODULES) {
    const rawActions = (matrix as Record<string, unknown>)[moduleId];

    if (!rawActions || typeof rawActions !== "object" || Array.isArray(rawActions)) {
      continue;
    }

    next[moduleId] = {
      ...(next[moduleId] || {}),
      ...Object.fromEntries(
        ACCESS_ACTIONS.map((action) => [action, Boolean((rawActions as Record<string, unknown>)[action])]),
      ),
    };
  }

  return next;
}

export function canAccessModule(
  permissions: PermissionMatrix | null | undefined,
  moduleId: AccessModule,
  action: AccessAction = "ver",
) {
  return Boolean(permissions?.[moduleId]?.[action]);
}

export function countGrantedModules(permissions: PermissionMatrix | null | undefined) {
  return ACCESS_MODULES.filter((moduleId) => canAccessModule(permissions, moduleId)).length;
}

export function permissionsToSummary(permissions: PermissionMatrix | null | undefined) {
  return ACCESS_MODULES.filter((moduleId) => canAccessModule(permissions, moduleId))
    .slice(0, 3)
    .map((moduleId) => ACCESS_MODULE_LABELS[moduleId]);
}

export function getRouteAccessRule(pathname: string) {
  return ROUTE_ACCESS_RULES
    .slice()
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((rule) => {
      if (rule.prefix === "/") {
        return pathname === "/";
      }

      return pathname.startsWith(rule.prefix);
    });
}
