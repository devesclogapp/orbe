import fs from 'node:fs';

const deploySql = fs.readFileSync('supabase/scripts/deploy_p002_retificacao_intermitentes.sql', 'utf8');
const hotfixSql = fs.readFileSync('supabase/scripts/hotfix_p002_rpc_profiles_fullname.sql', 'utf8');

// Função 1
const startRpc1Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Deploy = deploySql.indexOf('$$;', startRpc1Deploy) + 3;
const rpc1Deploy = deploySql.slice(startRpc1Deploy, endRpc1Deploy);

const startRpc1Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Hotfix = hotfixSql.indexOf('$$;', startRpc1Hotfix) + 3;
const rpc1Hotfix = hotfixSql.slice(startRpc1Hotfix, endRpc1Hotfix);

// Substituir apenas 'nome' por 'full_name' e comentários de ajuste para comparar
const rpc1DeployNormalized = rpc1Deploy.replace(/SELECT coalesce\(nome, 'Analista RH'\) INTO v_user_nome\s*FROM public\.profiles WHERE user_id = v_user_id LIMIT 1;/, 'SELECT coalesce(full_name, \'Analista RH\') INTO v_user_nome\n    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;');

// Normalizar quebras de linha e comentários
const clean = (s) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();

console.log('RPC 1 é idêntica exceto full_name:', clean(rpc1DeployNormalized) === clean(rpc1Hotfix));
if (clean(rpc1DeployNormalized) !== clean(rpc1Hotfix)) {
  console.log('RPC 1 Deploy norm:', clean(rpc1DeployNormalized).slice(0, 300));
  console.log('RPC 1 Hotfix:', clean(rpc1Hotfix).slice(0, 300));
}

// Função 2
const startRpc2Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Deploy = deploySql.indexOf('$$;', startRpc2Deploy) + 3;
const rpc2Deploy = deploySql.slice(startRpc2Deploy, endRpc2Deploy);

const startRpc2Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Hotfix = hotfixSql.indexOf('$$;', startRpc2Hotfix) + 3;
const rpc2Hotfix = hotfixSql.slice(startRpc2Hotfix, endRpc2Hotfix);

const rpc2DeployNormalized = rpc2Deploy.replace(/SELECT coalesce\(nome, 'Analista RH'\) INTO v_user_nome\s*FROM public\.profiles WHERE user_id = v_user_id LIMIT 1;/, 'SELECT coalesce(full_name, \'Analista RH\') INTO v_user_nome\n    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;');

console.log('RPC 2 é idêntica exceto full_name:', clean(rpc2DeployNormalized) === clean(rpc2Hotfix));
if (clean(rpc2DeployNormalized) !== clean(rpc2Hotfix)) {
  console.log('RPC 2 Deploy norm:', clean(rpc2DeployNormalized).slice(0, 300));
  console.log('RPC 2 Hotfix:', clean(rpc2Hotfix).slice(0, 300));
}

