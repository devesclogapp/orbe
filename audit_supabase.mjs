import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            if (f.endsWith('.ts') || f.endsWith('.tsx')) {
                callback(dirPath);
            }
        }
    });
}

function generateAuditReport() {
    const srcPath = path.resolve('src');
    const mdTable = [];

    walkDir(srcPath, (filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Find all `.from('table')` occurrences
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const fromMatch = line.match(/\.from\(['"](.*?)['"]\)/);
            if (fromMatch) {
                const tableName = fromMatch[1];
                let snippet = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 15)).join('\n');

                const hasEmpresaId = snippet.includes('empresa_id');
                const hasSafeTest = snippet.includes('safeTestIds') || snippet.includes('esc-log-environment');
                const needsCorrection = tableName !== 'empresas' && tableName !== 'profiles' ? (hasSafeTest ? 'Não' : 'SIM') : 'Não (Ignorado/Tabela Base)';

                const relPath = path.relative(process.cwd(), filePath);
                mdTable.push(`| \`${relPath}\` | Linha ${i + 1} | \`${tableName}\` | ${hasEmpresaId ? 'Sim' : 'Não'} | ${hasSafeTest ? 'Sim' : 'Não'} | ${needsCorrection} |`);
            }
        }
    });

    const report = `# Sprint: Auditoria de Segregação (Supabase)

| Arquivo | Local | Tabela | Tem filtro empresa_id? | Usa safeTestIds (Protegido)? | Necessita Correção? |
| --- | --- | --- | --- | --- | --- |
${mdTable.join('\n')}
`;

    fs.writeFileSync('.agent/sprint_sanitizacao_auditoria.md', report);
    console.log(`Auditoria concluída. Total de queries analisadas: ${mdTable.length}.`);
}

generateAuditReport();
