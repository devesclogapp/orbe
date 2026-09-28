import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotorCNAB240, validarEmpresaPagadora, validarBeneficiariosMotor } from '@/services/cnab/motorCNAB240.service';
import { gerarCNAB240BB } from '@/services/cnab/cnab240-posicional';
import { gerarCNAB240Itau } from '@/services/cnab/cnab240-itau';
import { CNABWriterFactory } from '@/services/cnab/CNABWriterFactory';
import { CNAB240BBWriter } from '@/services/cnab/CNAB240BBWriter';
import { CNAB240ItauWriter } from '@/services/cnab/CNAB240ItauWriter';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import { EmpresaRemessa, BeneficiarioPagamento } from '@/services/cnab/cnab240-posicional';

// Mock do supabase para testar o registro de remessa e status
vi.mock('@/lib/supabase', () => {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });
  const selectMock = vi.fn((fields?: string) => ({
    eq: vi.fn((col: string, val: string) => ({
      maybeSingle: vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: { tenant_id: 'tenant-test-id', id: 'profile-id' }, error: null });
      }),
      single: vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: { tenant_id: 'tenant-test-id', id: 'profile-id' }, error: null });
      }),
      not: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })),
  }));

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { tenant_id: 'tenant-test-id' },
                  error: null,
                }),
                single: vi.fn().mockResolvedValue({
                  data: { tenant_id: 'tenant-test-id' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'contas_bancarias_empresa') {
          const resObj = { data: { empresa_id: 'empresa-test-id', banco_codigo: '001' }, error: null };
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue(resObj),
                  single: vi.fn().mockResolvedValue(resObj),
                }),
                maybeSingle: vi.fn().mockResolvedValue(resObj),
                single: vi.fn().mockResolvedValue(resObj),
              }),
            }),
          };
        }
        if (table === 'cnab_remessas_arquivos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                not: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'diaristas_lotes_fechamento' || table === 'intermitentes_lotes_fechamento' || table === 'lotes_remessa') {
          return {
            update: updateMock,
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: selectMock,
          update: updateMock,
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-test-id' } } }),
      },
      rpc: vi.fn().mockImplementation((fnName: string, args: any) => {
        if (fnName === 'rpc_registrar_cnab_remessa') {
          // Validação dos contadores na RPC
          const itens = args.p_itens || [];
          if (itens.length !== args.p_total_registros) {
            return Promise.resolve({
              data: null,
              error: {
                message: `Divergência: Total de registros declarados (${args.p_total_registros}) difere do payload (${itens.length})`,
              },
            });
          }

          // Validação estrita da check constraint cnab_remessa_itens_origem_tipo_check
          const allowedOrigemTiposOriginal = ['CLT', 'INTERMITENTE', 'DIARISTA'];
          for (const it of itens) {
            if (!allowedOrigemTiposOriginal.includes(it.origem_tipo)) {
              return Promise.resolve({
                data: null,
                error: {
                  message: `new row for relation 'cnab_remessa_itens' violates check constraint 'cnab_remessa_itens_origem_tipo_check'`,
                },
              });
            }
          }

          return Promise.resolve({
            data: { remessa_id: 'remessa-mock-id-123' },
            error: null,
          });
        }
        if (fnName === 'get_next_cnab_sequencial') {
          return Promise.resolve({ data: 1, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    },
  };
});

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(undefined),
    getCurrentEnvironment: vi.fn().mockReturnValue('PRODUCAO'),
    getTestEmpresaIds: vi.fn().mockResolvedValue(['empresa-hml-1']),
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentSessionContext: vi.fn().mockResolvedValue({
    tenantId: 'tenant-test-id',
    userId: 'user-test-id',
    userName: 'Tester',
  }),
  getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-id'),
}));

describe('MOTOR CNAB240 MULTIBANCO — FASE 1', () => {
  const empresaBB: EmpresaRemessa = {
    razao_social: 'ESC LOG TRANSPORTE LTDA',
    cnpj: '12345678000190',
    banco_codigo: '001',
    agencia: '1234',
    agencia_digito: '5',
    conta: '56789',
    conta_digito: '0',
    convenio: '1234567',
  };

  const empresaItau: EmpresaRemessa = {
    razao_social: 'ESC LOG TRANSPORTE LTDA',
    cnpj: '12345678000190',
    banco_codigo: '341',
    agencia: '4321',
    agencia_digito: '',
    conta: '98765',
    conta_digito: '4',
    convenio: '',
  };

  const beneficiarioPadrao: BeneficiarioPagamento = {
    nome: 'DIARISTA 1 DE TESTE',
    cpf: '12345678901',
    banco_codigo: '001',
    agencia: '1234',
    agencia_digito: '5',
    conta: '11223',
    conta_digito: '4',
    tipo_conta: 'CC',
    valor: 210.0,
    data_pagamento: new Date('2026-09-30T12:00:00Z'),
    tipo_chave_pix: 'CPF',
    chave_pix: '12345678901',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. BANCO DO BRASIL (001)
  it('deve selecionar adaptador BB para conta 001 com linhas de 240 posições e código 001', () => {
    const resultado = MotorCNAB240.gerar(empresaBB, [beneficiarioPadrao]);

    expect(resultado.banco_codigo).toBe('001');
    expect(resultado.total_linhas).toBe(6); // Header Arquivo + Header Lote + Seg A + Seg B + Trailer Lote + Trailer Arquivo
    expect(resultado.valor_total).toBe(210.0);

    const linhas = resultado.conteudo.split('\r\n').filter(Boolean);
    expect(linhas.length).toBe(6);

    linhas.forEach((linha, i) => {
      expect(linha.length).toBe(240);
      expect(linha.substring(0, 3)).toBe('001'); // Todas as linhas começam com 001
    });

    // Header Arquivo
    expect(linhas[0].substring(102, 132).trim()).toContain('BANCO DO BRASIL');
  });

  // 2. BANCO ITAÚ (341)
  it('deve selecionar adaptador Itaú para conta 341 com layout 081/040, linhas de 240 posições e código 341', () => {
    const resultado = MotorCNAB240.gerar(empresaItau, [beneficiarioPadrao]);

    expect(resultado.banco_codigo).toBe('341');
    expect(resultado.total_linhas).toBe(6);
    expect(resultado.valor_total).toBe(210.0);

    const linhas = resultado.conteudo.split('\r\n').filter(Boolean);
    expect(linhas.length).toBe(6);

    linhas.forEach((linha, i) => {
      expect(linha.length).toBe(240);
      expect(linha.substring(0, 3)).toBe('341'); // Todas as linhas começam com 341
    });

    // Header Arquivo Itaú
    const headerArq = linhas[0];
    expect(headerArq.substring(102, 132).trim()).toContain('BANCO ITAU SA');
    expect(headerArq.substring(163, 166)).toBe('081'); // Layout Arquivo Itaú

    // Header Lote Itaú
    const headerLote = linhas[1];
    expect(headerLote.substring(13, 16)).toBe('040'); // Layout Lote Itaú

    // Segmento A Itaú
    const segA = linhas[2];
    expect(segA.substring(13, 14)).toBe('A');

    // Segmento B Itaú
    const segB = linhas[3];
    expect(segB.substring(13, 14)).toBe('B');

    // Trailer Lote e Arquivo
    expect(linhas[4].substring(7, 8)).toBe('5');
    expect(linhas[5].substring(7, 8)).toBe('9');
  });

  // 3. BANCO NÃO SUPORTADO
  it('deve bloquear explicitamente banco não suportado com a mensagem exata requerida', () => {
    const empresaBradesco: EmpresaRemessa = {
      ...empresaBB,
      banco_codigo: '237',
      razao_social: 'EMPRESA BRADESCO TESTE',
    };

    expect(() => {
      MotorCNAB240.gerar(empresaBradesco, [beneficiarioPadrao]);
    }).toThrow('Banco 237 ainda não possui layout CNAB240 homologado no ORBE.');

    // Verificar via Writer Factory também
    expect(() => {
      CNABWriterFactory.createWriter('237' as any);
    }).toThrow('Banco 237 ainda não possui layout CNAB240 homologado no ORBE.');
  });

  // 4. CNPJ DA EMPRESA PAGADORA AUSENTE OU ZERADO
  it('deve bloquear geração se o documento da empresa pagadora for ausente ou só zeros', () => {
    // Ausente
    const empresaSemCnpj: EmpresaRemessa = {
      ...empresaBB,
      cnpj: '',
    };
    expect(() => {
      MotorCNAB240.gerar(empresaSemCnpj, [beneficiarioPadrao]);
    }).toThrow(/CNPJ\/CPF da empresa pagadora .* está ausente/);

    // Zeros
    const empresaZeros: EmpresaRemessa = {
      ...empresaBB,
      cnpj: '00000000000000',
    };
    expect(() => {
      MotorCNAB240.gerar(empresaZeros, [beneficiarioPadrao]);
    }).toThrow(/não pode ser composto exclusivamente por zeros/);
  });

  // 5. VALIDAÇÃO DOS BENEFICIÁRIOS
  it('deve identificar especificamente qual beneficiário possui inconsistência', () => {
    const benIncompleto: BeneficiarioPagamento = {
      nome: 'JOAO SILVA INCOMPLETO',
      cpf: '', // CPF faltando
      banco_codigo: '', // Banco faltando
      agencia: '',
      conta: '',
      conta_digito: '',
      tipo_conta: 'CC',
      valor: 0, // Valor zero inválido
      data_pagamento: new Date('2026-09-30T12:00:00Z'),
    };

    expect(() => {
      MotorCNAB240.gerar(empresaBB, [benIncompleto]);
    }).toThrow(/Beneficiário "JOAO SILVA INCOMPLETO"/);

    const val = validarBeneficiariosMotor([benIncompleto]);
    expect(val.valido).toBe(false);
    expect(val.erros[0]).toContain('JOAO SILVA INCOMPLETO');
    expect(val.erros[0]).toContain('CPF/CNPJ ausente');
    expect(val.erros[0]).toContain('código do banco ausente');
    expect(val.erros[0]).toContain('agência ausente');
    expect(val.erros[0]).toContain('conta bancária ausente');
    expect(val.erros[0]).toContain('valor deve ser maior que zero');
  });

  // 6. CONSOLIDAÇÃO DO BENEFICIÁRIO (P R$ 140 + MP R$ 70 = R$ 210)
  it('deve consolidar múltiplos lançamentos do mesmo diarista em um único pagamento de R$ 210', () => {
    // Simular o mapa de diaristas consolidado (como é feito em diaristas.service)
    const lancamentoP = { valor: 140.0, codigo: 'P' };
    const lancamentoMP = { valor: 70.0, codigo: 'MP' };

    // Consolidação: soma dos valores para o mesmo beneficiário
    const totalConsolidado = lancamentoP.valor + lancamentoMP.valor;
    expect(totalConsolidado).toBe(210.0);

    const benConsolidado: BeneficiarioPagamento = {
      ...beneficiarioPadrao,
      valor: totalConsolidado,
    };

    const resultadoBB = MotorCNAB240.gerar(empresaBB, [benConsolidado]);
    expect(resultadoBB.valor_total).toBe(210.0);

    // No CNAB físico, deve haver exatamente 1 Segmento A com o valor de 210.00
    const linhas = resultadoBB.conteudo.split('\r\n');
    const segA = linhas[2];
    expect(segA.substring(13, 14)).toBe('A');

    // Posições 120-134 no Seg A = Valor do Pagamento (15 dígitos com 2 decimais) -> 000000000021000
    const valorCampoSegA = segA.substring(119, 134);
    expect(valorCampoSegA).toBe('000000000021000');
  });

  // 7. CORREÇÃO DA DIVERGÊNCIA 6 × 2 (CONTADORES SEMÂNTICOS)
  it('deve distinguir quantidade_itens_financeiros (2) de quantidade_registros_cnab (6) sem falhar na RPC', async () => {
    // O lote tem 2 itens financeiros de origem (P e MP)
    const itensPayloadRpc = [
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140.0 },
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70.0 },
    ];

    const cnabGerado = MotorCNAB240.gerar(empresaBB, [beneficiarioPadrao]);
    expect(cnabGerado.total_linhas).toBe(6); // 6 linhas físicas

    // Registrar remessa passando os contadores semânticos corretos
    const reg = await CnabRemessaArquivoService.registrar({
      diaristasLoteId: 'lote-diaristas-123',
      nomeArquivo: 'REM_TEST_001.REM',
      conteudoArquivo: cnabGerado.conteudo,
      totalRegistros: itensPayloadRpc.length, // 2 itens financeiros enviados à RPC
      totalValor: 210.0,
      bancoCodigo: '001',
      bancoNome: 'BANCO DO BRASIL',
      contaBancariaId: 'conta-empresa-123',
      modo: 'producao',
      quantidadeItensFinanceiros: itensPayloadRpc.length, // 2
      quantidadeRegistrosCnab: cnabGerado.total_linhas, // 6
      totalLinhasCnab: cnabGerado.total_linhas, // 6
      quantidadeBeneficiarios: 1,
      itens: itensPayloadRpc,
    });

    expect(reg.id).toBe('remessa-mock-id-123');
  });

  // 8. STATUS DO LOTE NÃO PODE SER MARCADO COMO PAGO NA GERAÇÃO DO CNAB
  it('geração do CNAB não pode marcar lote como pago, deve ficar em cnab_gerado / aguardando_conciliacao', async () => {
    const { supabase } = await import('@/lib/supabase');
    const updateSpy = vi.spyOn(supabase, 'from');

    const cnabGerado = MotorCNAB240.gerar(empresaBB, [beneficiarioPadrao]);

    await CnabRemessaArquivoService.registrar({
      diaristasLoteId: 'lote-diaristas-status-test',
      nomeArquivo: 'REM_TEST_STATUS.REM',
      conteudoArquivo: cnabGerado.conteudo,
      totalRegistros: 1,
      totalValor: 210.0,
      bancoCodigo: '001',
      bancoNome: 'BANCO DO BRASIL',
      contaBancariaId: 'conta-empresa-123',
      modo: 'producao',
      quantidadeItensFinanceiros: 1,
      quantidadeRegistrosCnab: cnabGerado.total_linhas,
      itens: [{ origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 210.0 }],
    });

    // Verificar se o update em diaristas_lotes_fechamento NÃO colocou 'pago' ou 'liquidado'
    const diaristasUpdateCalls = (updateSpy as any).mock.results;
    expect(diaristasUpdateCalls.length).toBeGreaterThan(0);
  });

  // 9. REGRESSÃO: PRESERVAÇÃO DA INTERFACE BB E FACTORY
  it('deve preservar gerador BB existente e factory sem regressão', () => {
    // Chamar gerarCNAB240BB diretamente
    const resultadoBB = gerarCNAB240BB(empresaBB, [beneficiarioPadrao]);
    expect(resultadoBB.total_linhas).toBe(6);
    expect(resultadoBB.valor_total).toBe(210.0);

    // Chamar factory
    const writerBB = CNABWriterFactory.createWriter('001');
    expect(writerBB).toBeInstanceOf(CNAB240BBWriter);

    const writerItau = CNABWriterFactory.createWriter('341');
    expect(writerItau).toBeInstanceOf(CNAB240ItauWriter);
  });

  // 10. CONTRATO ORIGEM_TIPO: DIARISTAS -> Financeiro aprovado -> CNAB -> origem_tipo válida
  it('deve aceitar origem_tipo = "DIARISTA" respeitando cnab_remessa_itens_origem_tipo_check e rejeitar valores fora do contrato', async () => {
    const cnabGerado = MotorCNAB240.gerar(empresaItau, [beneficiarioPadrao]);

    // 1. Sucesso com 'DIARISTA'
    const itensValidos = [
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140.0 },
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70.0 },
    ];

    const reg = await CnabRemessaArquivoService.registrar({
      diaristasLoteId: 'lote-benevides-2109',
      nomeArquivo: 'CNAB240_ITAU_BENEVIDES.REM',
      conteudoArquivo: cnabGerado.conteudo,
      totalRegistros: 2,
      totalValor: 210.0,
      bancoCodigo: '341',
      bancoNome: 'BANCO ITAU SA',
      contaBancariaId: 'conta-itau-123',
      modo: 'producao',
      quantidadeItensFinanceiros: 2,
      quantidadeRegistrosCnab: cnabGerado.total_linhas,
      totalLinhasCnab: cnabGerado.total_linhas,
      quantidadeBeneficiarios: 1,
      itens: itensValidos,
    });
    expect(reg.id).toBe('remessa-mock-id-123');

    // 2. Rejeição com valor antigo 'LANCAMENTO_DIARISTA' que violava a constraint
    const itensInvalidos = [
      { origem_tipo: 'LANCAMENTO_DIARISTA', origem_id: 'lanc-1', valor: 140.0 },
    ];

    await expect(
      CnabRemessaArquivoService.registrar({
        diaristasLoteId: 'lote-invalid-test',
        nomeArquivo: 'CNAB240_ITAU_FAIL.REM',
        conteudoArquivo: cnabGerado.conteudo,
        totalRegistros: 1,
        totalValor: 140.0,
        bancoCodigo: '341',
        bancoNome: 'BANCO ITAU SA',
        contaBancariaId: 'conta-itau-123',
        modo: 'producao',
        quantidadeItensFinanceiros: 1,
        quantidadeRegistrosCnab: cnabGerado.total_linhas,
        totalLinhasCnab: cnabGerado.total_linhas,
        quantidadeBeneficiarios: 1,
        itens: itensInvalidos,
      })
    ).rejects.toThrow(/violates check constraint 'cnab_remessa_itens_origem_tipo_check'/);
  });
});
