// CNAB 240 Banco do Brasil Validator Service
// Validates batch dependencies before actual generation of the txt file

import { supabase } from '@/lib/supabase';
import { ContaBancariaEmpresa } from './bankAccount.service';

export interface BBValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pendenciesByColaborador: Array<{
    colaboradorId: string;
    nome: string;
    pendencies: string[];
  }>;
}

export const CnabBBValidatorService = {
  async validateLote(
    faturasIds: string[], 
    contaOrigem?: Partial<ContaBancariaEmpresa>
  ): Promise<BBValidationResult> {
    const result: BBValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      pendenciesByColaborador: []
    };

    // 1. Validator Conta de Origem
    if (!contaOrigem) {
      result.isValid = false;
      result.errors.push("Conta bancária de origem não selecionada.");
    } else {
      if (!contaOrigem.banco_codigo) result.errors.push("Conta origem: Código do banco obrigatório (001 para BB).");
      if (contaOrigem.banco_codigo !== '001') result.warnings.push("Conta origem não é 001 (BB). Certifique-se de que o leiaute CNAB240 suporta.");
      if (!contaOrigem.agencia) result.errors.push("Conta origem: Agência obrigatória.");
      if (!contaOrigem.conta) result.errors.push("Conta origem: Conta corrente obrigatória.");
      if (!contaOrigem.cedente_cnpj) result.errors.push("Conta origem: CNPJ do Cedente obrigatório.");
      if (!contaOrigem.convenio) result.errors.push("Conta origem: Convênio obrigatório para CNAB Banco do Brasil.");
    }

    if (faturasIds.length === 0) {
      result.isValid = false;
      result.errors.push("Nenhum título/fatura selecionado para o lote.");
      return result; // Early return se não tem o que validar
    }

    // 2. Buscar dados faturas e colaboradores
    const { data: faturas, error } = await supabase
      .from('faturas')
      .select('*, colaboradores(*)')
      .in('id', faturasIds);

    if (error) {
      result.isValid = false;
      result.errors.push(`Erro ao buscar faturas: ${error.message}`);
      return result;
    }

    if (!faturas) return result;

    // 3. Validator Favorecidos e Valores
    for (const fatura of faturas) {
      const colab = fatura.colaboradores;
      const pendencies = [];

      // Validar Valor
      if (!fatura.valor || Number(fatura.valor) <= 0) {
        pendencies.push("Valor da fatura zerado ou inválido.");
      }

      // Validar dados do colaborador
      if (!colab) {
        result.isValid = false;
        result.errors.push(`Fatura ${fatura.id} órfã (sem colaborador vinculado).`);
        continue;
      }

      const nomeValido = colab.nome && colab.nome.trim().length > 0;
      if (!nomeValido) pendencies.push("Nome do favorecido ausente.");

      const cpfValido = colab.cpf && colab.cpf.replace(/\D/g, '').length === 11; // assumindo 11 ou 14 pra cnpj, usando 11 colab padrao
      if (!cpfValido) pendencies.push("CPF inválido ou ausente.");

      // Dados Bancários
      if (!colab.banco_codigo) pendencies.push("Código do banco ausente.");
      if (!colab.agencia) pendencies.push("Agência bancária ausente.");
      if (!colab.conta) pendencies.push("Conta bancária ausente.");
      if (!colab.tipo_conta) pendencies.push("Tipo de conta ausente.");

      if (pendencies.length > 0) {
        result.isValid = false;
        result.pendenciesByColaborador.push({
          colaboradorId: colab.id,
          nome: colab.nome,
          pendencies
        });
      }
    }

    return result;
  }
};
