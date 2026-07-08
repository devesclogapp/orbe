require('dotenv').config({ path: '.env.local' });
import { CNABWriterFactory } from '../src/services/cnab/CNABWriterFactory';
import { CNABBase } from '../src/services/cnab/CNABBase';

// Mock dependência do DB p/ Registrar e Obter Sequencial:
import { CnabRemessaArquivoService } from '../src/services/cnab/cnabRemessaArquivo.service';
CnabRemessaArquivoService.getNextSequencial = async (ccId: string, bco: string) => 1;
CnabRemessaArquivoService.registrar = async () => ({ id: 'mock-123' }) as any;
CnabRemessaArquivoService.generateHash = async () => 'mock-hash';

// Função auxiliar para injetar conta bancária Mock:
async function simulateBatch(bancoCodigo: string, bancoNome: string) {
    CNABBase.fetchLoteData = async () => {
        return {
            conta: {
                cedente_cnpj: '12345678000199',
                agencia: '1234',
                conta: '12345',
                conta_digito: '6',
                cedente_nome: 'EMPRESA TESTE LTDA',
                banco_codigo: bancoCodigo,
                banco_nome: bancoNome,
                empresas: {
                    nome: 'EMPRESA TESTE LTDA',
                    cidade: 'SAO PAULO',
                    estado: 'SP'
                }
            },
            valorEsperadoLote: 1500.50,
            faturas: [
                {
                    id: 'abc123456',
                    valor: 1500.50,
                    colaboradores: {
                        nome: 'JOAO DIARISTA',
                        cpf: '11111111111',
                        banco_codigo: bancoCodigo,
                        agencia: '9999',
                        conta: '99999',
                        digito_conta: '9',
                        tipo_conta: 'corrente'
                    }
                }
            ]
        } as any;
    };

    const writer = CNABWriterFactory.create(bancoCodigo);
    const result = await writer.generateCNAB240({
        loteId: '1',
        competencia: '2026-07',
        contaBancariaId: 'c1' // Irrelevante pois está mocked
    });

    const fs = require('fs');
    fs.writeFileSync(result.fileName, result.content);
    console.log(`Geração [${bancoCodigo}] concluída: ${result.fileName}`);
    return result;
}

async function run() {
    console.log('--- TESTE A: GERANDO BANCO DO BRASIL (001) ---');
    await simulateBatch('001', 'BANCO DO BRASIL');

    console.log('--- TESTE B: GERANDO BANCO ITAU (341) ---');
    await simulateBatch('341', 'BANCO ITAU SA');
}

run().catch(console.error);
