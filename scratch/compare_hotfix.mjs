import fs from 'node:fs';

const deploySql = fs.readFileSync('supabase/scripts/deploy_p002_retificacao_intermitentes.sql', 'utf8');
const hotfixSql = fs.readFileSync('supabase/scripts/hotfix_p002_rpc_profiles_fullname.sql', 'utf8');

// Extrair rpc_rh_retificar_intermitente de deploySql
const deployRpc1Match = deploySql.match(/CREATE OR REPLACE FUNCTION public\.rpc_rh_retificar_intermitente[\s\S]*?\$\$ LANGUAGE plpgsql[\s\S]*?\$\$;/);
const hotfixRpc1Match = hotfixSql.match(/CREATE OR REPLACE FUNCTION public\.rpc_rh_retificar_intermitente[\s\S]*?\$\$ LANGUAGE plpgsql[\s\S]*?\$\$;/);

console.log('Deploy RPC 1 found:', !!deployRpc1Match);
console.log('Hotfix RPC 1 found:', !!hotfixRpc1Match);

// Vamos verificar se a ordem das clauses é:
// LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
// Em hotfixSql:
// LANGUAGE plpgsql
// SECURITY DEFINER
// SET search_path = public, pg_temp
// AS $$

// Vamos checar assinaturas exatas:
const sig1Deploy = deploySql.match(/CREATE OR REPLACE FUNCTION public\.rpc_rh_retificar_intermitente\([\s\S]*?\)\s*RETURNS [^;]*?AS \$\$/);
const sig1Hotfix = hotfixSql.match(/CREATE OR REPLACE FUNCTION public\.rpc_rh_retificar_intermitente\([\s\S]*?\)\s*RETURNS [^;]*?AS \$\$/);

console.log('\n--- Assinatura 1 Deploy ---');
console.log(sig1Deploy?.[0]);
console.log('\n--- Assinatura 1 Hotfix ---');
console.log(sig1Hotfix?.[0]);

// Assinatura 2
const sig2Deploy = deploySql.match(/CREATE OR REPLACE FUNCTION public\.rpc_rh_revalidar_lote_devolvido\([\s\S]*?\)\s*RETURNS [^;]*?AS \$\$/);
const sig2Hotfix = hotfixSql.match(/CREATE OR REPLACE FUNCTION public\.rpc_rh_revalidar_lote_devolvido\([\s\S]*?\)\s*RETURNS [^;]*?AS \$\$/);

console.log('\n--- Assinatura 2 Deploy ---');
console.log(sig2Deploy?.[0]);
console.log('\n--- Assinatura 2 Hotfix ---');
console.log(sig2Hotfix?.[0]);

