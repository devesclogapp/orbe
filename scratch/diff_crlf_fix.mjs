import fs from 'node:fs';

const deploySql = fs.readFileSync('supabase/scripts/deploy_p002_retificacao_intermitentes.sql', 'utf8').replace(/\r\n/g, '\n');
const hotfixSql = fs.readFileSync('supabase/scripts/hotfix_p002_rpc_profiles_fullname.sql', 'utf8').replace(/\r\n/g, '\n');

const startRpc1Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Deploy = deploySql.indexOf('$$;', startRpc1Deploy) + 3;
const rpc1Deploy = deploySql.slice(startRpc1Deploy, endRpc1Deploy);

const startRpc1Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente');
const endRpc1Hotfix = hotfixSql.indexOf('$$;', startRpc1Hotfix) + 3;
const rpc1Hotfix = hotfixSql.slice(startRpc1Hotfix, endRpc1Hotfix);

const targetOriginal = "SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome\n    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;";
const targetHotfix = "SELECT coalesce(full_name, 'Analista RH') INTO v_user_nome\n    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;";

const rpc1DeployReplaced = rpc1Deploy.replace(targetOriginal, targetHotfix);
const clean = s => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();

console.log('RPC 1: É 100% IDÊNTICA?', clean(rpc1DeployReplaced) === clean(rpc1Hotfix));

// RPC 2
const startRpc2Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Deploy = deploySql.indexOf('$$;', startRpc2Deploy) + 3;
const rpc2Deploy = deploySql.slice(startRpc2Deploy, endRpc2Deploy);

const startRpc2Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Hotfix = hotfixSql.indexOf('$$;', startRpc2Hotfix) + 3;
const rpc2Hotfix = hotfixSql.slice(startRpc2Hotfix, endRpc2Hotfix);

const rpc2DeployReplaced = rpc2Deploy.replace(targetOriginal, targetHotfix);
console.log('RPC 2: É 100% IDÊNTICA?', clean(rpc2DeployReplaced) === clean(rpc2Hotfix));

