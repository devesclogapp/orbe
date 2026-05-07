import { CNAB240Formatter } from '../CNAB240Formatter';
import { CNAB240Validator } from '../CNAB240Validator';

export interface HeaderArquivoParams {
  cpfCnpj: string;
  convenio?: string;
  agencia: string;
  digitoAgencia: string;
  conta: string;
  digitoConta: string;
  digitoAgenciaConta?: string;
  nomeEmpresa: string;
  nomeBanco?: string;
  dataGeracao: Date;
  horaGeracao: Date;
  numeroSequencialArquivo: number;
}

export class HeaderArquivo {
  static generate(params: HeaderArquivoParams): string {
    const f = CNAB240Formatter;
    
    // 01.0 - Banco (001 - BB)
    let line = f.padLeftZero(1, 3);
    // 02.0 - Lote (0000)
    line += '0000';
    // 03.0 - Tipo do registro (0)
    line += '0';
    // 04.0 - Espaço (Brancos)
    line += f.padRightSpace('', 9);
    // 05.0 - Tipo Inscrição (1=CPF, 2=CNPJ)
    const inscricao = params.cpfCnpj.replace(/\D/g, '');
    line += inscricao.length === 11 ? '1' : '2';
    // 06.0 - CPF/CNPJ
    line += f.padLeftZero(inscricao, 14);
    // 07.0 - Convenio (20)
    line += f.padRightSpace((params.convenio || '').replace(/\D/g, ''), 20);
    // 08.0 - Agência
    line += f.padLeftZero(params.agencia, 5);
    // 09.0 - Dígito agência
    line += f.padRightSpace(params.digitoAgencia, 1);
    // 10.0 - Conta
    line += f.padLeftZero(params.conta, 12);
    // 11.0 - Dígito Conta
    line += f.padRightSpace(params.digitoConta, 1);
    // 12.0 - Dígito Ag/Conta
    line += f.padRightSpace(params.digitoAgenciaConta || '0', 1);
    // 13.0 - Nome Empresa
    line += f.padRightSpace(params.nomeEmpresa, 30);
    // 14.0 - Nome do Banco
    line += f.padRightSpace(params.nomeBanco || 'BANCO DO BRASIL S.A.', 30);
    // 15.0 - Espaço
    line += f.padRightSpace('', 10);
    // 16.0 - Código Remessa/Retorno (1=Remessa)
    line += '1';
    // 17.0 - Data de Geração
    line += f.formatDate(params.dataGeracao);
    // 18.0 - Hora de Geração
    line += f.formatTime(params.horaGeracao);
    // 19.0 - Sequencial do Arquivo
    line += f.padLeftZero(params.numeroSequencialArquivo, 6);
    // 20.0 - Versão do Layout (103 para BB)
    line += '103';
    // 21.0 - Densidade Gravacao
    line += f.padLeftZero(1600, 5);
    // 22.0 - Reservado Banco
    line += f.padRightSpace('', 20);
    // 23.0 - Reservado Empresa
    line += f.padRightSpace('', 20);
    // 24.0 - Espaço
    line += f.padRightSpace('', 29);

    CNAB240Validator.validateLineLength(line, 'Header de Arquivo (Registro 0)');
    return line;
  }
}
