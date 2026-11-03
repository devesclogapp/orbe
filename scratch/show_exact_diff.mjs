import fs from 'node:fs';

const deploySql = fs.readFileSync('supabase/scripts/deploy_p002_retificacao_intermitentes.sql', 'utf8').replace(/\r\n/g, '\n');
const hotfixSql = fs.readFileSync('supabase/scripts/hotfix_p002_rpc_profiles_fullname.sql', 'utf8').replace(/\r\n/g, '\n');

const startRpc1Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Deploy = deploySql.indexOf('$$;', startRpc1Deploy) + 3;
const rpc1Deploy = deploySql.slice(startRpc1Deploy, endRpc1Deploy);

const startRpc1Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Hotfix = hotfixSql.indexOf('$$;', startRpc1Hotfix) + 3;
const rpc1Hotfix = hotfixSql.slice(startRpc1Hotfix, endRpc1Hotfix);

const clean = s => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
const c1 = clean(rpc1Deploy);
const c2 = clean(rpc1Hotfix);

console.log('c1 length:', c1.length, 'c2 length:', c2.length);
let diffFound = false;
for (let i = 0; i < Math.max(c1.length, c2.length); i++) {
  if (c1[i] !== c2[i]) {
    console.log('Diff index', i);
    console.log('Deploy:', JSON.stringify(c1.slice(i, i + 50)));
    console.log('Hotfix:', JSON.stringify(c2.slice(i, i + 50)));
    diffFound = true;
    break;
  }
}
if (!diffFound) {
  console.log('NENHUMA diferença encontrada no loop!');
}

