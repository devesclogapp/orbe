import fs from 'fs';

let content = fs.readFileSync('src/components/Auth/AuthGuard.tsx', 'utf8');

const targetImport = `    isRouteForbiddenForRole,
} from "@/lib/access-control";`.replace(/\n/g, '\r\n');

const replaceImport = `    isRouteForbiddenForRole,
    normalizeRole,
} from "@/lib/access-control";`.replace(/\n/g, '\r\n');

if (!content.includes(targetImport)) {
  throw new Error("Target import not found in AuthGuard.tsx");
}
content = content.replace(targetImport, replaceImport);

const targetCheck = `    const rule = getRouteAccessRule(location.pathname);
    if (rule && role !== "admin" && !canAccess(rule.module, rule.action)) {`.replace(/\n/g, '\r\n');

const replaceCheck = `    const rule = getRouteAccessRule(location.pathname);
    const roleNormalized = normalizeRole(role);
    const isRoleExplicitlyAllowed = Boolean(rule?.allowedRoles?.includes(roleNormalized));
    const isModuleAllowed = rule ? canAccess(rule.module, rule.action) : false;
    const isAnyAllowedModule = Boolean(rule?.allowedModules?.some((mod) => canAccess(mod, rule.action)));
    const hasRouteAccess = !rule || role === "admin" || isRoleExplicitlyAllowed || isModuleAllowed || isAnyAllowedModule;

    if (!hasRouteAccess) {`.replace(/\n/g, '\r\n');

if (!content.includes(targetCheck)) {
  throw new Error("Target check not found in AuthGuard.tsx");
}
content = content.replace(targetCheck, replaceCheck);

fs.writeFileSync('src/components/Auth/AuthGuard.tsx', content, 'utf8');
console.log("Successfully updated src/components/Auth/AuthGuard.tsx");

