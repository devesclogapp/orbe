export class CNAB240Validator {
  static validateLineLength(line: string, registerName: string = 'Linha'): void {
    if (line.length !== 240) {
      throw new Error(`Erro na geração: ${registerName} deve possuir exatamente 240 caracteres. Atual: ${line.length}.`);
    }
  }

  static validateDoc(doc: string): void {
    const cleanDoc = doc.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14 && cleanDoc.length !== 0) {
      throw new Error(`CPF/CNPJ inválido para CNAB: ${doc}`);
    }
  }

  static validateNumber(value: any, label: string): void {
    if (value === undefined || value === null || isNaN(Number(value))) {
      throw new Error(`${label} precisa ser um valor numérico válido.`);
    }
  }
}
