require('dotenv').config({ path: '.env.local' });
import { CNAB240ItauWriter } from '../src/services/cnab/CNAB240ItauWriter';
import { CNABBase } from '../src/services/cnab/CNABBase';

// Helper for mocking db
CNABBase.fetchLoteData = async () => {
    return {
        conta: {
            cedente_cnpj: '12345678000199',
            agencia: '1234',
            conta: '12345',
            conta_digito: '6',
            cedente_nome: 'EMPRESA TESTE LTDA',
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
                    banco_codigo: '341',
                    agencia: '9999',
                    conta: '99999',
                    digito_conta: '9',
                    tipo_conta: 'corrente'
                }
            }
        ]
    } as any;
};

// Also mock CnabRemessaArquivoService to not touch DB
import { CnabRemessaArquivoService } from '../src/services/cnab/cnabRemessaArquivo.service';
const oldGetNext = CnabRemessaArquivoService.getNextSequencial;
CnabRemessaArquivoService.getNextSequencial = async () => 1;
CnabRemessaArquivoService.registrar = async () => ({ id: 'mock123' }) as any;

async function testItauWriter() {
    const writer = new CNAB240ItauWriter();
    const result = await writer.generateCNAB240({
        loteId: '1',
        competencia: '2026-07',
        contaBancariaId: 'c1'
    });
    const fs = require('fs');
    fs.writeFileSync(result.fileName, result.content);
    console.log(result.fileName);
}

testItauWriter().catch(console.error);
