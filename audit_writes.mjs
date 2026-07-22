import fs from 'fs';
import path from 'path';

const onda1 = [
    'src/services/rhFinanceiro.service.ts',
    'src/services/domain/intermitentes.service.ts',
    'src/services/domain/diaristas.service.ts',
    'src/services/financial.service.ts',
    'src/services/cnab/CNABBase.ts',
    'src/services/cnab/cnabRemessaArquivo.service.ts',
    'src/services/cnab/cnabRetorno.service.ts',
    'src/services/cnab/cnabConciliacao.service.ts',
    'src/pages/CentralBancaria.tsx',
    'src/pages/Financeiro/CentralBancariaDiaristas.tsx',
    'src/pages/Financeiro/RemessaCNAB.tsx'
];

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath, callback);
        } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
            callback(dirPath);
        }
    });
}

function auditWrites() {
    const srcPath = path.resolve('src');
    const mdTable = [];

    walkDir(srcPath, (filePath) => {
        const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        // Only run for wave 1 unless we want global. The prompt says "Priorizar operacoes de escrita dos arquivos da Onda 1". Let's do all, but highlight Onda 1.

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const writeMatch = line.match(/\.(insert|update|upsert|delete|rpc|invoke)\(/);
            if (writeMatch) {
                const op = writeMatch[1];
                let snippet = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n');

                let tableName = '?';
                const fromMatch = snippet.match(/\.from\(['"](.*?)['"]\)/);
                if (fromMatch) tableName = fromMatch[1];
                if (op === 'rpc' || op === 'invoke') {
                    const rpcMatch = line.match(/\.rpc\(['"](.*?)['"]/);
                    if (rpcMatch) tableName = `RPC: ${rpcMatch[1]}`;
                }

                const isOnda1 = onda1.includes(relPath);

                mdTable.push(`| \`${relPath}\` | Linha ${i + 1} | \`${op.toUpperCase()}\` | \`${tableName}\` | ${isOnda1 ? '**SIM**' : 'Não'} | AUTO_CLASSIFIED |`);
            }
        }
    });

    const report = `# Sprint: Auditoria de Escrita (Writes & RPCs)

| Arquivo | Linha | Operação | Tabela/Alvo | É da Onda 1? | Status |
| --- | --- | --- | --- | --- | --- |
${mdTable.join('\n')}
`;

    fs.writeFileSync('.agent/sprint_sanitizacao_writes_auditoria.md', report);
    console.log(`Auditoria de escrita concluída. Total de queries: ${mdTable.length}.`);
}

auditWrites();
