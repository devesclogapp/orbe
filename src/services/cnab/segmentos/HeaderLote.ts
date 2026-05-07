import { CNAB240Formatter } from '../CNAB240Formatter';
import { CNAB240Validator } from '../CNAB240Validator';

export interface HeaderLoteParams {
  loteId: number;
  tipoServico: number; // 20=Pagto Fornecedor, etc
  formaLancamento: number; 
  cpfCnpj: string;
  convenio?: string;
  agencia: string;
  digitoAgencia: string;
  conta: string;
  digitoConta: string;
  digitoAgenciaConta?: string;
  nomeEmpresa: string;
  cepEmpresa?: string;
  cidadeEmpresa?: string;
  estadoEmpresa?: string;
  enderecoEmpresa?: string;
}

export class HeaderLote {
  static generate(params: HeaderLoteParams): string {
    const f = CNAB240Formatter;
    
    // 01.1 - Banco (001)
    let line = f.padLeftZero(1, 3);
    // 02.1 - Lote
    line += f.padLeftZero(params.loteId, 4);
    // 03.1 - Tipo de Registro (1)
    line += '1';
    // 04.1 - Operacao (C=Credito)
    line += 'C';
    // 05.1 - Tipo Servico
    line += f.padLeftZero(params.tipoServico, 2);
    // 06.1 - Forma Lancamento
    line += f.padLeftZero(params.formaLancamento, 2);
    // 07.1 - Layout Lote (046)
    line += '046';
    // 08.1 - Espaco
    line += f.padRightSpace('', 1);
    // 09.1 - Tipo Inscricao
    const inscricao = params.cpfCnpj.replace(/\D/g, '');
    line += inscricao.length === 11 ? '1' : '2';
    // 10.1 - Numero Inscricao (Tamanho 15)
    line += f.padLeftZero(inscricao, 15);
    // 11.1 - Convenio
    line += f.padRightSpace((params.convenio || '').replace(/\D/g, ''), 20);
    // 12.1 - Agencia
    line += f.padLeftZero(params.agencia, 5);
    // 13.1 - Digito Ag
    line += f.padRightSpace(params.digitoAgencia, 1);
    // 14.1 - Conta
    line += f.padLeftZero(params.conta, 12);
    // 15.1 - Digito Conta
    line += f.padRightSpace(params.digitoConta, 1);
    // 16.1 - Digito Ag/Conta
    line += f.padRightSpace(params.digitoAgenciaConta || '0', 1);
    // 17.1 - Nome Empresa
    line += f.padRightSpace(params.nomeEmpresa, 30);
    // 18.1 - Mensagem 1
    line += f.padRightSpace('', 40);
    // 19.1 - Logradouro da Empresa
    line += f.padRightSpace(params.enderecoEmpresa || '', 30);
    // 20.1 - Numero
    line += f.padLeftZero(0, 5);
    // 21.1 - Complemento
    line += f.padRightSpace('', 15);
    // 22.1 - Cidade
    line += f.padRightSpace(params.cidadeEmpresa || '', 20);
    // 23.1 - CEP
    const cep = (params.cepEmpresa || '').replace(/\D/g, '');
    line += f.padLeftZero(cep.slice(0, 5) || 0, 5);
    line += f.padLeftZero(cep.slice(5, 8) || 0, 3);
    // 24.1 - Estado
    line += f.padRightSpace(params.estadoEmpresa || '', 2);
    // 25.1 - Uso exclusivo (7)
    line += f.padRightSpace('', 7);
    // 26.1 - Ocorrencias (10)
    line += f.padRightSpace('', 10);

    CNAB240Validator.validateLineLength(line, 'Header de Lote (Registro 1)');
    return line;
  }
}
