import fs from 'fs';
import path from 'path';

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

let schemas = {};
const targets = ['clientes', 'transportadoras', 'empresas', 'operacoes_producao', 'financeiro_consolidados_cliente', 'transportadoras_clientes'];

for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const target of targets) {
        if (content.includes(`CREATE TABLE public.${target}`) || content.includes(`CREATE TABLE ${target}`) || content.includes(`CREATE TABLE IF NOT EXISTS public.${target}`)) {
            const match = content.match(new RegExp(`CREATE TABLE (IF NOT EXISTS )?(public\\.)?${target} \\(([\\s\\S]*?)\\);`));
            if (match) {
                schemas[target] = match[3];
            }
        }
    }
}

let lines = '';
for (const [k, v] of Object.entries(schemas)) {
    lines += '==== ' + k + ' ====\n' + v + '\n\n';
}
fs.writeFileSync('schemas_extracted.txt', lines, 'utf8');
