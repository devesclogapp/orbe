const fs = require('fs');
const txt = fs.readFileSync('.agent/audit_out.txt', 'utf8');

const tableT = txt.includes('Table cnab_remessas_arquivos exists');
const rpcrem = txt.includes('RPC rpc_registrar_cnab_remessa DOES NOT EXIST');
const rpcret = txt.includes('RPC rpc_aplicar_cnab_retorno DOES NOT EXIST');
const remItens = txt.includes('Table cnab_remessa_itens DOES NOT EXIST');

let md = `# Relatório de Auditoria — Bloco 4 (Banco Conectado)\n\n`;

md += `| Objeto | Esperado | Encontrado | Evidência SQL (Ou REST/API) | Status PASS/FAIL |\n`;
md += `| :--- | :--- | :--- | :--- | :---: |\n`;
md += `| \`rpc_registrar_cnab_remessa\` | EXISTE | ${rpcrem ? 'NÃO' : 'SIM'} | Postgrest Check via JS | ${rpcrem ? 'FAIL' : 'PASS'} |\n`;
md += `| \`rpc_aplicar_cnab_retorno\` | EXISTE | ${rpcret ? 'NÃO' : 'SIM'} | Postgrest Check via JS | ${rpcret ? 'FAIL' : 'PASS'} |\n`;
md += `| \`cnab_remessa_itens\` | EXISTE | ${remItens ? 'NÃO' : 'SIM'} | Postgrest Check via JS | ${remItens ? 'FAIL' : 'PASS'} |\n`;
md += `| Tabelas Bases Existentes | EXISTE | ${tableT ? 'SIM' : 'NÃO'} | Postgrest Check via JS | ${tableT ? 'PASS' : 'FAIL'} |\n`;

md += `\n## VEREDITO\n`;
if (rpcrem || rpcret || remItens || !tableT) {
    md += `**NO-GO para smoke financeiro**\n\nAs funções RPC e/ou tabelas novas não foram aplicadas ao projeto Supabase remoto. O script executado detectou que os endpoints não estão disponíveis no banco Staging/Conectado.\n`;
} else {
    md += `**PASS**. O banco suporta o Bloco 4.\n`;
}

fs.writeFileSync('.agent/bloco4_database_audit_result.md', md);
