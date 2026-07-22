import fs from 'fs';

function generateMatrix() {
    const auditFile = '.agent/sprint_sanitizacao_auditoria.md';
    if (!fs.existsSync(auditFile)) {
        console.error("Audit file not found");
        return;
    }

    const lines = fs.readFileSync(auditFile, 'utf-8').split('\n');
    const matrixLines = [];

    // Header
    matrixLines.push('# Matriz de Escopo de Ambiente (Environment Scope Matrix)\n');
    matrixLines.push('| Arquivo | Consulta (Linha) | Tabela | Categoria | Coluna | Null em PROD? | Risco | Correção | Status |');
    matrixLines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

    // Categorization logic based on table names
    const tablesA =
        ['rh_financeiro_lotes', 'rh_financeiro_lote_itens', 'registros_ponto', 'banco_horas_eventos',
            'banco_horas_saldos', 'operacoes_volume', 'servicos_extras', 'custos_extras',
            'cnab_remessa', 'cnab_remessa_arquivo', 'dashboard_financeiro', 'dashboard_operacional'];

    const tablesB =
        ['empresas', 'colaboradores', 'fornecedores', 'transportadoras', 'produtos', 'servicos'];

    // Some are C (exempt)
    const tablesC =
        ['profiles', 'perfis_usuarios', 'feature_flags', 'parametros', 'logs_auditoria', 'processamento_rh_logs'];

    // parse the table from the audit md
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('| `src')) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 7) {
                const file = parts[1];
                const linha = parts[2];
                const tableRaw = parts[3];
                const cleanTable = tableRaw.replace(/`/g, '');

                let cat = 'B - Contextual';
                let col = 'empresa_id';
                let nullAllowed = 'False';
                let risk = 'Médio - Avaliar';
                let action = 'Aplicar `EnvironmentQueryFilter` com Contexto';

                if (tablesA.some(t => cleanTable.includes(t))) {
                    cat = 'A - Obrigatório';
                    nullAllowed = 'False';
                    risk = 'Crítico - Contaminação Financeira';
                    action = 'Aplicar `applyEmpresaScope` rigoroso';
                } else if (tablesC.some(t => cleanTable.includes(t))) {
                    cat = 'C - Isento';
                    col = 'N/A';
                    nullAllowed = 'N/A';
                    risk = 'Baixo';
                    action = 'Adicionar comentário `// ENVIRONMENT_SCOPE_EXEMPT`';
                } else if (!parts[4].includes('Sim')) {
                    // if it doesn't even have empresa_id in the snippet
                    cat = 'B/C - Analisar';
                    col = '?';
                    risk = 'Variável';
                    action = 'Verificar se possui relação empresa';
                }

                matrixLines.push(`| ${file} | ${linha} | ${tableRaw} | ${cat} | ${col} | ${nullAllowed} | ${risk} | ${action} | PENDENTE |`);
            }
        }
    }

    fs.mkdirSync('.agent', { recursive: true });
    fs.writeFileSync('.agent/environment_scope_matrix.md', matrixLines.join('\n'));
    console.log(`Matriz gerada com sucesso.`);
}

generateMatrix();
