/**
 * MOTOR CNAB240 MULTIBANCO — ORBE ERP
 *
 * Conceito arquitetural:
 * Obrigação aprovada → Conta pagadora → Banco → Motor CNAB → Adaptador do banco → Arquivo
 *
 * Bancos homologados:
 * - 001 — Banco do Brasil
 * - 341 — Banco Itaú
 *
 * Bancos adicionais poderão ser adicionados futuramente sem refatorar os módulos
 * de Diaristas, Intermitentes, CLT ou Financeiro.
 */

import {
  EmpresaRemessa,
  BeneficiarioPagamento,
  OpcoesCNAB240,
  ResultadoCNAB240,
  gerarCNAB240BB,
  downloadCNAB240,
  verificarLinhas,
} from './cnab240-posicional';
import { gerarCNAB240Itau } from './cnab240-itau';

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DA EMPRESA PAGADORA
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidacaoEmpresaPagadora {
  valido: boolean;
  erro?: string;
}

export function validarEmpresaPagadora(empresa: EmpresaRemessa): ValidacaoEmpresaPagadora {
  if (!empresa) {
    return { valido: false, erro: 'Dados da empresa pagadora não foram fornecidos.' };
  }

  const doc = String(empresa.cnpj || '').replace(/\D/g, '');
  if (!doc) {
    return {
      valido: false,
      erro: `CNPJ/CPF da empresa pagadora (${empresa.razao_social || 'não informada'}) está ausente. Cadastre o documento fiscal na empresa ou na conta bancária antes de gerar o CNAB.`,
    };
  }

  if (doc.length !== 14 && doc.length !== 11) {
    return {
      valido: false,
      erro: `CNPJ/CPF da empresa pagadora (${doc}) possui tamanho inválido (${doc.length} dígitos, esperado 14 para CNPJ ou 11 para CPF).`,
    };
  }

  if (/^0+$/.test(doc)) {
    return {
      valido: false,
      erro: `CNPJ/CPF da empresa pagadora não pode ser composto exclusivamente por zeros (${doc}). Cadastre um documento fiscal válido antes de gerar a remessa.`,
    };
  }

  if (!empresa.razao_social?.trim()) {
    return { valido: false, erro: 'Razão social / Nome da empresa pagadora é obrigatório.' };
  }

  const banco = String(empresa.banco_codigo || '').replace(/\D/g, '');
  if (!banco) {
    return { valido: false, erro: 'Código do banco da empresa pagadora é obrigatório.' };
  }

  if (!empresa.agencia?.trim()) {
    return { valido: false, erro: 'Agência da empresa pagadora é obrigatória.' };
  }

  if (!empresa.conta?.trim()) {
    return { valido: false, erro: 'Conta corrente da empresa pagadora é obrigatória.' };
  }

  return { valido: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DE BENEFICIÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidacaoBeneficiariosMotor {
  valido: boolean;
  erros: string[];
}

export function validarBeneficiariosMotor(
  beneficiarios: BeneficiarioPagamento[],
  _codigoBancoPagador?: string
): ValidacaoBeneficiariosMotor {
  const erros: string[] = [];

  if (!beneficiarios || beneficiarios.length === 0) {
    erros.push('Nenhum beneficiário para gerar o arquivo CNAB.');
    return { valido: false, erros };
  }

  beneficiarios.forEach((b, idx) => {
    const ident = b.nome?.trim() ? `Beneficiário "${b.nome}"` : `Beneficiário #${idx + 1}`;
    const pendencias: string[] = [];

    if (!b.nome?.trim()) pendencias.push('nome ausente');

    const doc = String(b.cpf || '').replace(/\D/g, '');
    if (!doc) {
      pendencias.push('CPF/CNPJ ausente');
    } else if (doc.length !== 11 && doc.length !== 14) {
      pendencias.push(`CPF/CNPJ inválido (${doc.length} dígitos, esperado 11 para CPF ou 14 para CNPJ)`);
    } else if (/^0+$/.test(doc)) {
      pendencias.push('CPF/CNPJ não pode ser zeros');
    }

    const banco = String(b.banco_codigo || '').replace(/\D/g, '');
    if (!banco) {
      pendencias.push('código do banco ausente');
    } else if (banco.length > 3) {
      pendencias.push(`código do banco inválido (${banco})`);
    }

    if (!b.agencia?.trim()) pendencias.push('agência ausente');
    if (!b.conta?.trim()) pendencias.push('conta bancária ausente');
    if (!b.conta_digito?.trim() && b.conta_digito !== '0') {
      pendencias.push('dígito da conta ausente');
    }

    if (!(Number(b.valor) > 0)) {
      pendencias.push(`valor deve ser maior que zero (atual: R$ ${b.valor})`);
    }

    if (!(b.data_pagamento instanceof Date) || isNaN(b.data_pagamento.getTime())) {
      pendencias.push('data de pagamento inválida');
    }

    if (pendencias.length > 0) {
      erros.push(`${ident}: ${pendencias.join(', ')}.`);
    }
  });

  return { valido: erros.length === 0, erros };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR CNAB240
// ─────────────────────────────────────────────────────────────────────────────

export class MotorCNAB240 {
  /**
   * Bancos atualmente homologados na plataforma
   */
  static readonly BANCOS_SUPORTADOS = ['001', '341'] as const;

  /**
   * Verifica se o banco informado possui layout CNAB240 homologado
   */
  static isBancoSuportado(codigoBanco?: string | null): boolean {
    if (!codigoBanco) return false;
    const clean = String(codigoBanco).replace(/\D/g, '').padStart(3, '0');
    return MotorCNAB240.BANCOS_SUPORTADOS.includes(clean as any);
  }

  /**
   * Ponto de entrada canônico para geração de CNAB240 multibanco.
   *
   * Roteamento automático:
   * - 001 -> Adaptador Banco do Brasil
   * - 341 -> Adaptador Banco Itaú
   * - Outros -> Bloqueia explicitamente (sem fallback)
   */
  static gerar(
    empresa: EmpresaRemessa,
    beneficiarios: BeneficiarioPagamento[],
    opcoes: OpcoesCNAB240 = {}
  ): ResultadoCNAB240 {
    // 1. Validação estrita da empresa pagadora (impede 00000000000000 e ausências)
    const validacaoEmpresa = validarEmpresaPagadora(empresa);
    if (!validacaoEmpresa.valido) {
      throw new Error(`Falha na validação da empresa pagadora: ${validacaoEmpresa.erro}`);
    }

    // 2. Validação estrita dos beneficiários
    const validacaoBen = validarBeneficiariosMotor(beneficiarios, empresa.banco_codigo);
    if (!validacaoBen.valido) {
      throw new Error(
        `Arquivo CNAB não pode ser gerado — dados bancários dos beneficiários inválidos:\n` +
        validacaoBen.erros.map(e => `• ${e}`).join('\n')
      );
    }

    // 3. Normalização do código bancário
    const bancoCodigo = String(empresa.banco_codigo || '').replace(/\D/g, '').padStart(3, '0');

    // 4. Seleção do adaptador bancário correspondente
    switch (bancoCodigo) {
      case '001': {
        const resultado = gerarCNAB240BB(empresa, beneficiarios, opcoes);
        resultado.banco_codigo = '001';
        return resultado;
      }

      case '341': {
        return gerarCNAB240Itau(empresa, beneficiarios, opcoes);
      }

      default: {
        // Regra estrita: nunca utilizar outro layout como fallback!
        throw new Error(`Banco ${empresa.banco_codigo || bancoCodigo} ainda não possui layout CNAB240 homologado no ORBE.`);
      }
    }
  }

  /**
   * Dispara o download no browser
   */
  static download(resultado: ResultadoCNAB240): void {
    downloadCNAB240(resultado);
  }

  /**
   * Utilitário para verificar integridade física de 240 caracteres por linha
   */
  static verificarLinhas(conteudo: string) {
    return verificarLinhas(conteudo);
  }
}
