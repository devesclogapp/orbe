import {
  buildPresetPermissions,
  canAccessModule,
  getRouteAccessRule,
  getDefaultRouteForRole,
  isRouteForbiddenForRole
} from '../src/lib/access-control';

const encPerms = buildPresetPermissions('encarregado');

// Check 1 & 6: Operational routes allowed
const operRoutes = [
  '/producao',
  '/producao/diaristas',
  '/producao/custos-extras',
  '/producao/servicos-extras',
  '/producao/servicos-especificos'
];
const operChecks = operRoutes.map(r => {
  const rule = getRouteAccessRule(r);
  return {
    route: r,
    module: rule?.module,
    allowed: canAccessModule(encPerms, rule?.module, rule?.action || 'ver')
  };
});

// Check 2: Admin routes denied
const adminRoutes = [
  '/governanca/usuarios',
  '/admin/usuarios-acessos',
  '/governanca/perfis',
  '/governanca/auditoria',
  '/central'
];
const adminChecks = adminRoutes.map(r => {
  const rule = getRouteAccessRule(r);
  const isForbidden = isRouteForbiddenForRole('encarregado', r);
  const canAccess = canAccessModule(encPerms, rule?.module, rule?.action || 'ver');
  return {
    route: r,
    module: rule?.module,
    blocked: isForbidden || !canAccess
  };
});

// Check 7: RH / Financeiro routes denied
const rhFinRoutes = [
  '/financeiro',
  '/financeiro/faturamento',
  '/financeiro/remessa',
  '/banco-horas',
  '/banco-horas/processamento',
  '/rh/aprovacoes',
  '/diaristas/aprovacoes',
  '/operacoes-volume/aprovacoes'
];
const rhFinChecks = rhFinRoutes.map(r => {
  const rule = getRouteAccessRule(r);
  const canAccess = canAccessModule(encPerms, rule?.module, rule?.action || 'ver');
  return {
    route: r,
    module: rule?.module,
    blocked: !canAccess
  };
});

console.log(JSON.stringify({
  defaultRoute: getDefaultRouteForRole('encarregado'),
  operChecks,
  adminChecks,
  rhFinChecks
}, null, 2));
