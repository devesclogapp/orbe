import fs from 'fs';

function expandMatrix() {
    const auditFile = '.agent/environment_scope_matrix.md';
    if (!fs.existsSync(auditFile)) return;

    let lines = fs.readFileSync(auditFile, 'utf-8').split('\n');
    const newLines = [];

    newLines.push('# Matriz de Escopo de Ambiente (Environment Scope Matrix)\n');
    newLines.push('| Arquivo | Consulta (Linha) | Tabela | Categoria | Coluna | Null em PROD? | Risco | Correção | Operação | Função/Método | Caso de Uso | Tenant Aplicado? | Tipo de Escopo | Camada de Aplicação | Agregação? | Classificação Revisada? | Teste Associado | Resultado de Paridade | Status |');
    newLines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('| `src')) {
            const parts = line.split('|').map(p => p.trim());
            // previously: file, linha, t, cat, col, null, risk, action, status
            // mapping to new columns:
            // most are empty for now pending manual review.

            const file = parts[1];
            const linha = parts[2];
            const tableRaw = parts[3];
            const cat = parts[4];
            const col = parts[5];
            const nullAllowed = parts[6];
            const risk = parts[7];
            const action = parts[8];

            newLines.push(`| ${file} | ${linha} | ${tableRaw} | ${cat} | ${col} | ${nullAllowed} | ${risk} | ${action} | SELECT | Pendente | Pendente | ? | BACKEND_SCOPE | Server | Não | ? | Nenhum | N/A | AUTO_CLASSIFIED |`);
        }
    }

    fs.writeFileSync(auditFile, newLines.join('\n'));
    console.log("Matriz expandida para V2");
}
expandMatrix();
