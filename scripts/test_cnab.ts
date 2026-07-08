import { gerarCNAB240, EmpresaRemetente, RegistroPagamento } from '../src/utils/cnab240';
import * as fs from 'fs';

const empresa: EmpresaRemetente = {
  cnpj: '12345678000199',
  razao_social: 'EMPRESA TESTE LTDA',
  banco_codigo: '341', // Tentando usar 341 para ver como comporta
  agencia: '1234',
  conta: '12345',
  digito_conta: '6'
};

const registros: RegistroPagamento[] = [
  {
    nome: 'JOAO DIARISTA',
    cpf: '11111111111',
    banco_codigo: '341',
    agencia: '9999',
    conta: '99999',
    digito_conta: '9',
    tipo_conta: 'corrente',
    valor: 1500.50,
    data_pagamento: new Date(),
  }
];

const cnab = gerarCNAB240(empresa, registros);
fs.writeFileSync('cnab_test.txt', cnab);
console.log('Arquivo gerado com sucesso: cnab_test.txt');
