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

let c1 = clean(rpc1Deploy);
let c2 = clean(rpc1Hotfix);

// Substitui as diferenças encontradas na consulta de profiles
c1 = c1.replace("coalesce(nome, email, 'Analista RH')", "coalesce(full_name, 'Analista RH')")
       .replace("WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;", "WHERE user_id = v_user_id LIMIT 1;");

console.log('RPC 1: c1 === c2 agora?', c1 === c2);
if (c1 !== c2) {
  for (let i = 0; i < Math.max(c1.length, c2.length); i++) {
    if (c1[i] !== c2[i]) {
      console.log('Próxima diferença no index', i);
      console.log('c1:', JSON.stringify(c1.slice(i, i + 50)));
      console.log('c2:', JSON.stringify(c2.slice(i, i + 50)));
      break;
    }
  }
}

// RPC 2
const startRpc2Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Deploy = deploySql.indexOf('$$;', startRpc2Deploy) + 3;
const rpc2Deploy = deploySql.slice(startRpc2Deploy, endRpc2Deploy);

const startRpc2Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Hotfix = hotfixSql.indexOf('$$;', startRpc2Hotfix) + 3;
const rpc2Hotfix = hotfixSql.slice(startRpc2Hotfix, endRpc2Hotfix);

let c2_1 = clean(rpc2Deploy);
let c2_2 = clean(rpc2Hotfix);

c2_1 = c2_1.replace("coalesce(nome, email, 'Analista RH')", "coalesce(full_name, 'Analista RH')")
           .replace("WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;", "WHERE user_id = v_user_id LIMIT 1;");

console.log('RPC 2: c2_1 === c2_2 agora?', c2_1 === c2_2);
if (c2_1 !== c2_2) {
  for (let i = 0; i < Math.max(c2_1.length, c2_2.length); i++) {
    if (c2_1[i] !== c2_2[i]) {
      console.log('Próxima diferença no index', i);
      console.log('c2_1:', JSON.stringify(c2_1.slice(i, i + 50)));
      console.log('c2_2:', JSON.stringify(c2_2.slice(i, i + 50)));
      break;
    }
  }
}

