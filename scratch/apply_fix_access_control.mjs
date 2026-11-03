import fs from 'fs';

let content = fs.readFileSync('src/lib/access-control.ts', 'utf8');

// 1. Interface RouteAccessRule
const target1 = `export const ROUTE_ACCESS_RULES: Array<{
  prefix: string;
  module: AccessModule;
  action?: AccessAction;
}> = [`.replace(/\n/g, '\r\n');

const replace1 = `export interface RouteAccessRule {
  prefix: string;
  module: AccessModule;
  action?: AccessAction;
  allowedRoles?: AccessRole[];
  allowedModules?: AccessModule[];
}

export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [`.replace(/\n/g, '\r\n');

if (!content.includes(target1)) {
  throw new Error("Target 1 not found");
}
content = content.replace(target1, replace1);

// 2. /colaboradores rule
const target2 = `  { prefix: "/colaboradores", module: "central_de_cadastros" },`.replace(/\n/g, '\r\n');
const replace2 = `  {
    prefix: "/colaboradores",
    module: "central_de_cadastros",
    allowedRoles: ["admin", "rh"],
    allowedModules: ["central_de_cadastros", "processamento_rh", "pontos_recebidos", "banco_de_horas"],
  },`.replace(/\n/g, '\r\n');

if (!content.includes(target2)) {
  throw new Error("Target 2 not found");
}
content = content.replace(target2, replace2);

// 3. New routes
const target3 = `  { prefix: "/relatorios", module: "central_de_relatorios" },`.replace(/\n/g, '\r\n');
const replace3 = `  { prefix: "/relatorios", module: "central_de_relatorios" },
  { prefix: "/configuracoes", module: "governanca" },
  { prefix: "/diag-tenant", module: "governanca" },
  { prefix: "/clt/pontos", module: "pontos_recebidos" },
  { prefix: "/clt/banco-horas", module: "banco_de_horas" },
  { prefix: "/processamento/reprocessamentos", module: "processamento_rh" },
  { prefix: "/operacional/pipeline", module: "central_operacional" },`.replace(/\n/g, '\r\n');

if (!content.includes(target3)) {
  throw new Error("Target 3 not found");
}
content = content.replace(target3, replace3);

// 5. isRouteForbiddenForRole
const target5 = `  if (normalizedRole === "encarregado") {
    // /central é tela de torre de controle administrativa e nunca deve ser acessada por encarregado
    if (pathname === "/central" || pathname.startsWith("/central/")) {
      return true;
    }
    // /inconsistencias e sub-rotas são de auditoria transversal e bloqueadas para encarregado
    if (pathname === "/inconsistencias" || pathname.startsWith("/inconsistencias/")) {
      return true;
    }
  }
  return false;`.replace(/\n/g, '\r\n');

const replace5 = `  if (normalizedRole === "encarregado") {
    // /central é tela de torre de controle administrativa e nunca deve ser acessada por encarregado
    if (pathname === "/central" || pathname.startsWith("/central/")) {
      return true;
    }
    // /inconsistencias e sub-rotas são de auditoria transversal e bloqueadas para encarregado
    if (pathname === "/inconsistencias" || pathname.startsWith("/inconsistencias/")) {
      return true;
    }
    // /configuracoes é painel administrativo e estritamente bloqueado para encarregado
    if (pathname === "/configuracoes" || pathname.startsWith("/configuracoes/")) {
      return true;
    }
  }

  if (normalizedRole === "rh") {
    // /configuracoes é painel administrativo e estritamente bloqueado para perfil RH
    if (pathname === "/configuracoes" || pathname.startsWith("/configuracoes/")) {
      return true;
    }
  }
  return false;`.replace(/\n/g, '\r\n');

if (!content.includes(target5)) {
  throw new Error("Target 5 not found");
}
content = content.replace(target5, replace5);

fs.writeFileSync('src/lib/access-control.ts', content, 'utf8');
console.log("Successfully updated src/lib/access-control.ts");
