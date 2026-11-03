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

console.log('RPC 1 idêntica após replace do select profiles:', rpc1DeployNorm === rpc1HotfixNorm);

// RPC 2
const startRpc2Deploy = deploySql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Deploy = deploySql.indexOf('$$;', startRpc2Deploy) + 3;
const rpc2Deploy = deploySql.slice(startRpc2Deploy, endRpc2Deploy);

const startRpc2Hotfix = hotfixSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido');
const endRpc2Hotfix = hotfixSql.indexOf('$$;', startRpc2Hotfix) + 3;
const rpc2Hotfix = hotfixSql.slice(startRpc2Hotfix, endRpc2Hotfix);

const rpc2DeployNorm = rpc2Deploy.replace(/--.*$/gm, '').replace(/\s+/g, ' ').replace("SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome FROM public.profiles WHERE user_id = v_user_id LIMIT 1;", "SELECT coalesce(full_name, 'Analista RH') INTO v_user_nome FROM public.profiles WHERE user_id = v_user_id LIMIT 1;").trim();
const rpc2HotfixNorm = rpc2Hotfix.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();

console.log('RPC 2 idêntica após replace do select profiles:', rpc2DeployNorm === rpc2HotfixNorm);

