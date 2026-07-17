const fs = require('fs');
const files = fs.readdirSync('supabase/migrations');
let result = "";

for (const file of files) {
    if (file.endsWith('.sql')) {
        const text = fs.readFileSync('supabase/migrations/' + file, 'utf8');
        const policies = [...text.matchAll(/CREATE POLICY.*?ON .*?;/gs)];
        for (const p of policies) {
            if (p[0].includes('colaboradores') || p[0].includes('lancamentos_intermitentes') || p[0].includes('intermitentes_lotes_fechamento') || p[0].includes('perfis_usuarios')) {
                result += `File: ${file}\n${p[0]}\n\n`;
            }
        }
    }
}
fs.writeFileSync('policies_out.txt', result);
