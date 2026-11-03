import fs from 'node:fs';

const deploySql = fs.readFileSync('supabase/scripts/deploy_p002_retificacao_intermitentes.sql', 'utf8');
const hotfixSql = fs.readFileSync('supabase/scripts/hotfix_p002_rpc_profiles_fullname.sql', 'utf8');

const startRpc1Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Deploy = deploySql.indexOf('$$;', startRpc1Deploy) + 3;
const rpc1Deploy = deploySql.slice(startRpc1Deploy, endRpc1Deploy);

const startRpc1Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Hotfix = hotfixSql.indexOf('$$;', startRpc1Hotfix) + 3;
const rpc1Hotfix = hotfixSql.slice(startRpc1Hotfix, endRpc1Hotfix);

const rpc1DeployNorm = rpc1Deploy.replace(/--.*$/gm, '').replace(/\s+/g, ' ').replace("SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome FROM public.profiles WHERE user_id = v_user_id LIMIT 1;", "SELECT coalesce(full_name, 'Analista RH') INTO v_user_nome FROM public.profiles WHERE user_id = v_user_id LIMIT 1;").trim();
const rpc1HotfixNorm = rpc1Hotfix.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();

for (let i = 0; i < Math.max(rpc1DeployNorm.length, rpc1HotfixNorm.length); i++) {
  if (rpc1DeployNorm[i] !== rpc1HotfixNorm[i]) {
    console.log('Diff at', i);
    console.log('Deploy:', JSON.stringify(rpc1DeployNorm.slice(i - 20, i + 60)));
    console.log('Hotfix:', JSON.stringify(rpc1HotfixNorm.slice(i - 20, i + 60)));
    break;
  }
}

