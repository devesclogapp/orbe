const { Project } = require('ts-morph');
const fs = require('fs');

async function main() {
    console.log("Iniciando refatoramento com ts-morph...");
    const project = new Project();

    // Add the huge file
    const sourcePath = '../src/services/base.service.ts';
    const sourceFile = project.addSourceFileAtPath(sourcePath);

    const outDir = '../src/services/domain';
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Grupos
    const coreElements = ['BaseService', 'cleanUuid', 'sanitizePayload', 'validateUuidFields', 'normalizeCpfDigits', 'hasDadosBancariosMinimosColaborador', 'hasComplementoMinimoColaborador', 'inferRegimeTrabalho', 'inferModeloCalculo', 'normalizeContratoToken', 'getCurrentTenantId', 'requireAuthenticatedUserId', 'normalizeConfigTipoOperacaoValue', 'isDuplicateConstraintError', 'getConfigTipoOperacaoErrorMessage', 'getTenantQueryFilter', 'extractReferencedTableFromFkError', 'Table'];

    const cadastrosElements = [
        'EmpresaServiceClass', 'EmpresaService',
        'ColetorServiceClass', 'ColetorService',
        'TransportadoraClienteServiceClass', 'TransportadoraClienteService',
        'UnidadeServiceClass', 'UnidadeService',
        'ColaboradorServiceClass', 'ColaboradorService',
        'FornecedorServiceClass', 'FornecedorService',
        'ServicoServiceClass', 'ServicoService',
        'MotoristaServiceClass', 'MotoristaService',
        'CaminhaoServiceClass', 'CaminhaoService',
        'DepartamentoServiceClass', 'DepartamentoService',
        'CargosServiceClass', 'CargosService',
        'EquipamentoGeralServiceClass', 'EquipamentoGeralService'
    ];

    const despesasElements = [
        'CustoExtraOperacionalServiceClass', 'CustoExtraOperacionalService',
        'ServicosExtrasOperacionaisServiceClass', 'ServicosExtrasOperacionaisService',
        'FormasPagamentoService', 'FormasPagamentoServiceClass',
        'TaxasImpostosService', 'TaxasImpostosServiceClass'
    ];

    const diaristasElements = [
        'LancamentoDiaristaServiceClass', 'LancamentoDiaristaService',
        'LoteFechamentoDiaristaServiceClass', 'LoteFechamentoDiaristaService',
        'DiaristaCicloServiceClass', 'DiaristaCicloService'
    ];

    const producaoElements = [
        'OperacaoProducaoServiceClass', 'OperacaoProducaoService',
        'ConsolidadoServiceClass', 'ConsolidadoService',
        'HistoricoOperacaoServiceClass', 'HistoricoOperacaoService',
        'LancamentoFolhaMensalClass', 'LancamentoFolhaMensalService',
        'LancamentoBancoHorasClass', 'LancamentoBancoHorasService',
        'PontoServiceClass', 'PontoService',
        'RegraOperacionalServiceClass', 'RegraOperacionalService',
        'AuditoriaLogServiceClass', 'AuditoriaLogService',
        'ConfiguracaoOperacionalServiceClass', 'ConfiguracaoOperacionalService',
        'IntegracaoContabilServiceClass', 'IntegracaoContabilService',
        'AutomacaoLogServiceClass', 'AutomacaoLogService'
    ];

    function mapToGroup(name) {
        if (coreElements.includes(name)) return 'core';
        if (cadastrosElements.includes(name)) return 'cadastros';
        if (despesasElements.includes(name)) return 'despesas';
        if (diaristasElements.includes(name)) return 'diaristas';
        if (producaoElements.includes(name)) return 'producao';
        return 'core'; // fallback everything else to core
    }

    const imports = sourceFile.getImportDeclarations().map(i => i.getText());

    // We will extract text manually by using positions so we keep comments
    const groups = {
        core: [],
        cadastros: [],
        despesas: [],
        diaristas: [],
        producao: []
    };

    sourceFile.getStatements().forEach(stmt => {
        if (stmt.getKindName() === 'ImportDeclaration') return;

        let name = "unknown";
        if (stmt.getKindName() === 'ClassDeclaration') name = stmt.getName();
        else if (stmt.getKindName() === 'VariableStatement') name = stmt.getDeclarations()[0].getName();
        else if (stmt.getKindName() === 'FunctionDeclaration') name = stmt.getName();
        else if (stmt.getKindName() === 'TypeAliasDeclaration' || stmt.getKindName() === 'InterfaceDeclaration') name = stmt.getName();

        const g = mapToGroup(name);
        groups[g].push(stmt.getFullText());
    });

    const headerImports = imports.join('\n') + '\n\n';

    // For every group except core, we also need to import BaseService and utils
    const coreExports = coreElements;

    for (const [g, statements] of Object.entries(groups)) {
        let fileContent = headerImports;

        if (g !== 'core') {
            fileContent += `import { BaseService, sanitizePayload, cleanUuid, validateUuidFields, getCurrentTenantId, getTenantQueryFilter, extractReferencedTableFromFkError } from './core.service';\n\n`;
        }

        fileContent += statements.join('');
        fs.writeFileSync(`${outDir}/${g}.service.ts`, fileContent);
    }

    // Now write the barrel file (base.service.ts)
    let barrel = headerImports;
    barrel += `export * from './domain/core.service';\n`;
    barrel += `export * from './domain/cadastros.service';\n`;
    barrel += `export * from './domain/producao.service';\n`;
    barrel += `export * from './domain/diaristas.service';\n`;
    barrel += `export * from './domain/despesas.service';\n`;

    fs.writeFileSync(sourcePath, barrel);

    console.log("Refatoramento concluído!");
}

main().catch(console.error);
