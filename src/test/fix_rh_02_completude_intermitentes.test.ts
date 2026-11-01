import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntermitentesLoteService } from '../services/domain/intermitentes.service';

function createMockSupabase(lancamentos: any[], colaboradores: any[]) {
  return {
    from: (table: string) => {
      if (table === 'lancamentos_intermitentes') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: lancamentos, error: null })
          })
        };
      }
      if (table === 'colaboradores') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: colaboradores, error: null })
          })
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null })
      };
    }
  } as any;
}

const mockColabCompleto = {
  id: 'colab-100-percent',
  nome: 'Colaborador Perfeito Teste',
  nome_completo: 'Colaborador Perfeito Teste Completo',
  cpf: '12345678909',
  matricula: 'MAT-9901',
  empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  tipo_colaborador: 'INTERMITENTE',
  cargo: 'Operador Logístico',
  tipo_contrato: 'HORA',
  valor_hora: 25.00,
  valor_base: 25.00,
  banco_codigo: '341',
  agencia: '1234',
  conta: '56789',
  tipo_conta: 'CORRENTE',
  telefone: '11999998888'
};

describe('ERP ORBE — FIX-RH-02: Validação de Completude Cadastral de Intermitentes', () => {
  let originalSupabase: any;

  beforeEach(() => {
    originalSupabase = (IntermitentesLoteService as any).supabase;
  });

  afterEach(() => {
    (IntermitentesLoteService as any).supabase = originalSupabase;
  });

  it('1. Colaborador com cadastro 100% completo deve ser aprovado na verificação', async () => {
    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [{ colaborador_id: mockColabCompleto.id, nome_colaborador: mockColabCompleto.nome }],
      [mockColabCompleto]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-1');

    expect(result.podeAprovar).toBe(true);
    expect(result.pendencias).toHaveLength(0);
    expect(result.itensPendentes).toHaveLength(0);
  });

  it('2. Colaborador com CPF inválido deve continuar bloqueado com Fail-Closed', async () => {
    const colabCpfInvalido = {
      ...mockColabCompleto,
      id: 'colab-cpf-invalido',
      nome: 'Colaborador CPF Inválido',
      cpf: '00000000000' // CPF inválido
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [{ colaborador_id: colabCpfInvalido.id, nome_colaborador: colabCpfInvalido.nome }],
      [colabCpfInvalido]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-2');

    expect(result.podeAprovar).toBe(false);
    expect(result.pendencias.length).toBeGreaterThan(0);
    expect(result.pendencias[0]).toContain('CPF');
    expect(result.itensPendentes![0].detalhes?.operacional).toContain('CPF');
  });

  it('3. Colaborador sem matrícula deve continuar bloqueado', async () => {
    const colabSemMatricula = {
      ...mockColabCompleto,
      id: 'colab-sem-matricula',
      nome: 'Colaborador Sem Matrícula',
      matricula: null,
      rhid_person_id: null
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [{ colaborador_id: colabSemMatricula.id, nome_colaborador: colabSemMatricula.nome }],
      [colabSemMatricula]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-3');

    expect(result.podeAprovar).toBe(false);
    expect(result.pendencias.length).toBeGreaterThan(0);
    expect(result.pendencias[0]).toContain('Matrícula/ID');
    expect(result.itensPendentes![0].detalhes?.rh).toContain('Matrícula/ID');
  });

  it('4. Colaborador sem cargo ou remuneração aplicável deve continuar bloqueado', async () => {
    const colabSemRemuneracao = {
      ...mockColabCompleto,
      id: 'colab-sem-remun',
      nome: 'Colaborador Sem Salário',
      cargo: '',
      valor_hora: 0,
      valor_base: 0,
      salario_base: 0
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [{ colaborador_id: colabSemRemuneracao.id, nome_colaborador: colabSemRemuneracao.nome }],
      [colabSemRemuneracao]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-4');

    expect(result.podeAprovar).toBe(false);
    expect(result.itensPendentes![0].detalhes?.rh).toContain('Cargo/Função');
    expect(result.itensPendentes![0].detalhes?.rh).toContain('Valor base aplicável (salário/hora/diária)');
  });

  it('5. Colaborador com dados bancários incompletos deve continuar bloqueado', async () => {
    const colabSemBanco = {
      ...mockColabCompleto,
      id: 'colab-sem-banco',
      nome: 'Colaborador Sem Dados Bancários',
      banco_codigo: '',
      agencia: '',
      conta: ''
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [{ colaborador_id: colabSemBanco.id, nome_colaborador: colabSemBanco.nome }],
      [colabSemBanco]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-5');

    expect(result.podeAprovar).toBe(false);
    expect(result.itensPendentes![0].detalhes?.financeiro).toContain('Código do banco');
    expect(result.itensPendentes![0].detalhes?.financeiro).toContain('Agência');
    expect(result.itensPendentes![0].detalhes?.financeiro).toContain('Conta');
  });

  it('6. As pendências devem ser discriminadas com clareza no diagnóstico da interface', async () => {
    const colabMultiplasPendencias = {
      ...mockColabCompleto,
      id: 'colab-multi-pendencias',
      nome: 'Colaborador Incompleto',
      cpf: '00000000000',
      cargo: '',
      agencia: ''
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [{ colaborador_id: colabMultiplasPendencias.id, nome_colaborador: colabMultiplasPendencias.nome }],
      [colabMultiplasPendencias]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-6');

    expect(result.itensPendentes).toHaveLength(1);
    const item = result.itensPendentes![0];
    expect(item.detalhes?.operacional).toContain('CPF');
    expect(item.detalhes?.rh).toContain('Cargo/Função');
    expect(item.detalhes?.financeiro).toContain('Agência');
    expect(item.motivo).toContain('CPF');
    expect(item.motivo).toContain('Cargo/Função');
    expect(item.motivo).toContain('Agência');
    expect(item.moduloDestino).toBe('Cadastros / Colaboradores');
    expect(item.rotaDestino).toBe('/colaboradores');
  });

  it('7. A aprovação RH deve continuar impedida quando qualquer colaborador do lote apresentar pendências', async () => {
    const colab1 = { ...mockColabCompleto, id: 'colab-ok', nome: 'Colaborador OK' };
    const colab2 = {
      ...mockColabCompleto,
      id: 'colab-incompleto',
      nome: 'Colaborador Incompleto',
      banco_codigo: ''
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [
        { colaborador_id: colab1.id, nome_colaborador: colab1.nome },
        { colaborador_id: colab2.id, nome_colaborador: colab2.nome }
      ],
      [colab1, colab2]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('lote-teste-7');

    // Lote como um todo deve ser bloqueado para aprovação
    expect(result.podeAprovar).toBe(false);
    expect(result.itensPendentes).toHaveLength(1);
    expect(result.itensPendentes![0].colaboradorId).toBe('colab-incompleto');
  });

  it('8. Colaboradores de homologação com dados reais devem ser 100% aprovados sem falso-positivo', async () => {
    const hml1 = {
      id: '7eaf4402-8954-471b-a2c8-914f12265c98',
      nome: 'Homologação Itaú 001',
      nome_completo: 'Homologação Itaú 001',
      cpf: '12345678909',
      matricula: 'HML-ITAU-001',
      empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
      tipo_colaborador: 'INTERMITENTE',
      cargo: 'Operador Logístico Intermitente',
      tipo_contrato: 'HORA',
      valor_hora: 25.00,
      valor_base: 25.00,
      banco_codigo: '341',
      agencia: '1234',
      conta: '56789',
      tipo_conta: 'CORRENTE',
      telefone: '11999998888'
    };

    const hml2 = {
      id: '7035d08d-74b5-4172-87c2-3ba9a27d8b02',
      nome: 'Homologação Itaú 002',
      nome_completo: 'Homologação Itaú 002',
      cpf: '98765432100',
      matricula: 'HML-ITAU-002',
      empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
      tipo_colaborador: 'INTERMITENTE',
      cargo: 'Operador Logístico Intermitente',
      tipo_contrato: 'HORA',
      valor_hora: 25.00,
      valor_base: 25.00,
      banco_codigo: '341',
      agencia: '1234',
      conta: '98765',
      tipo_conta: 'CORRENTE',
      telefone: '11999997777'
    };

    (IntermitentesLoteService as any).supabase = createMockSupabase(
      [
        { colaborador_id: hml1.id, nome_colaborador: hml1.nome },
        { colaborador_id: hml2.id, nome_colaborador: hml2.nome }
      ],
      [hml1, hml2]
    );

    const result = await IntermitentesLoteService.verificarCompletudeLote('INT-2026-11-183C');

    expect(result.podeAprovar).toBe(true);
    expect(result.pendencias).toHaveLength(0);
    expect(result.itensPendentes).toHaveLength(0);
  });
});
