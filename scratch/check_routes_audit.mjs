import fs from 'fs';
import { getRouteAccessRule } from '../src/lib/access-control.ts';

const appContent = fs.readFileSync('src/App.tsx', 'utf8');
const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
const appRoutes = [];
let m;
while ((m = routeRegex.exec(appContent)) !== null) {
  appRoutes.push(m[1]);
}
console.log('Total routes in App.tsx:', appRoutes.length);
const unprotected = [];
for (const r of appRoutes) {
  if (r.startsWith('/login') || r.startsWith('/auth') || r === '/reset-password' || r === '*' || r === '/producao' || r.startsWith('/dev/')) continue;
  const rule = getRouteAccessRule(r);
  if (!rule) {
    unprotected.push(r);
  }
}
console.log('Routes without explicit rule:', unprotected);
