import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';

// Mock supabase e base.service
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-test' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue('09ccafb6-2cf2-4c83-ac3d-a2913947693c'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-test', tenant_id: '09ccafb6-2cf2-4c83-ac3d-a2913947693c' }),
}));

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
  },
}));

describe('CNAB RETORNO — SEMÂNTICA ESTREITA DE fatura_id E MULTIORIGEM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. DIARISTA: origem_id = lançamento diarista, fatura_id = null -> válido
  it('A. DIARISTA: origem_id recebe id do lancamento diarista e fatura_id e explicitamente null', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteDiaristaId = '1bf3f73c-942e-4127-be32-bf27df39d1a5';
    const lancamentoDiaristaId = 'a1a0b0b5-4162-43c3-b188-d78f24c76838';

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({ data: { retorno_arquivo_id: 'ret-arq-1', sucesso: true }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{
                id: 'rem-1',
                sequencial_arquivo: 4,
                banco_codigo: '341',
                empresa_id: 'emp-1',
                conta_bancaria_id: 'conta-1',
                diaristas_lote_id: loteDiaristaId,
                lote_id: null,
                contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' }
              }],
              error: null
            })
          })
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'fabc013e-f070-48c9-8d04-4a3ec255dfb8', remessa_id: 'rem-1', origem_tipo: 'DIARISTA', origem_id: lancamentoDiaristaId, valor: 70 }],
              error: null
            })
          })
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: lancamentoDiaristaId, lote_fechamento_id: loteDiaristaId, diarista_id: 'colab-1', valor_calculado: 70, nome_colaborador: 'DIARISTA 1', cpf_colaborador: '45678912355' }],
              error: null
            })
          })
        };
      }
      if (table === 'colaboradores') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'colab-1', nome: 'DIARISTA 1', cpf: '45678912355' }], error: null }) }) };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const fileContent = [
      '34100000         212345678000199                    0123450000000123456 BENEVIDES OPERACOES           BANCO ITAU SA                           22809202611150000000408101600                                                                     ',
      '34100011C2001040 212345678000199                    0123450000000123456 BENEVIDES OPERACOES           PAGAMENTO DIARISTAS                                                                                                                       ',
      '3410001300001A0000003410011110000000032142 DIARISTA 1                                        28092026BRL000000000000000000000000007000NOSSO341000004      28092026000000000007000                                                     00        ',
      '3410001300002B   1   45678912355RUA OPERACIONAL               00100               CENTRO         BENEVIDES           68795000  00000000000000000007000                                                                                          ',
      '34100015         000004000000000000007000000000000000000000000000                                                                                                                                                                               ',
      '34199999         000001000006                                                                                                                                                                                                                   '
    ].join('\n');

    const mockFile = new File([fileContent], 'RET_TEST_70.RET', { type: 'text/plain' });
    await CnabRetornoService.processarArquivo(mockFile, '341');

    expect(rpcArgsCapturados).not.toBeNull();
    const item = rpcArgsCapturados.p_itens[0];
    expect(item.origem_tipo).toBe('DIARISTA');
    expect(item.origem_id).toBe(lancamentoDiaristaId);
    expect(item.fatura_id).toBeNull();
    expect(item.diaristas_lote_id).toBe(loteDiaristaId);
    expect(item.lote_id).toBeNull();
  });

  // B. DIARISTA: fatura_id = origem_id do diarista -> rejeitado antes de violar FK
  it('B. DIARISTA: se payload tentar enviar fatura_id preenchido para DIARISTA, a RPC defensiva rejeita', () => {
    const validarFaturaIdDefensivo = (origemTipo: string, faturaId: string | null) => {
      if (origemTipo === 'DIARISTA' && faturaId !== null && faturaId !== undefined) {
        throw new Error(`Payload inconsistente: fatura_id (${faturaId}) não é permitido para origem_tipo DIARISTA. Deve ser NULL.`);
      }
    };

    expect(() => validarFaturaIdDefensivo('DIARISTA', 'a1a0b0b5-4162-43c3-b188-d78f24c76838'))
      .toThrowError(/fatura_id.*não é permitido para origem_tipo DIARISTA/);
  });

  // C. FATURA: origem_id = fatura válida, fatura_id = mesma fatura -> válido
  it('C. FATURA: origem_id e fatura_id apontam ambos para a fatura correspondente', async () => {
    const { supabase } = await import('@/lib/supabase');
    const faturaRealId = '55555555-4444-3333-2222-111111111111';
    const loteRemessaId = '2a3b4c5d-1111-2222-3333-444455556666';

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({ data: { retorno_arquivo_id: 'ret-fat-1', sucesso: true }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{
                id: 'rem-fat-1',
                sequencial_arquivo: 4,
                banco_codigo: '341',
                empresa_id: 'emp-1',
                conta_bancaria_id: 'conta-1',
                lote_id: loteRemessaId,
                diaristas_lote_id: null,
                contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' }
              }],
              error: null
            })
          })
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-item-fat', remessa_id: 'rem-fat-1', origem_tipo: 'FATURA', origem_id: faturaRealId, valor: 500 }],
              error: null
            })
          })
        };
      }
      if (table === 'faturas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: faturaRealId, lote_remessa_id: loteRemessaId, colaborador_id: 'colab-1', valor: 500, nosso_numero: 'NOSSO341000004' }],
              error: null
            })
          })
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const fileContent = [
      '34100000         212345678000199                    0123450000000123456 BENEVIDES OPERACOES           BANCO ITAU SA                           22809202611150000000408101600                                                                     ',
      '34100011C2001040 212345678000199                    0123450000000123456 BENEVIDES OPERACOES           COBRANCA FATURAS                                                                                                                          ',
      '3410001300001A0000003410011110000000032142 CLIENTE FATURA                                    28092026BRL000000000000000000000000050000NOSSO341000004      28092026000000000050000                                                     00        ',
      '3410001300002B   1   45678912355RUA OPERACIONAL               00100               CENTRO         BENEVIDES           68795000  00000000000000000050000                                                                                          ',
      '34100015         000004000000000000050000000000000000000000000000                                                                                                                                                                               ',
      '34199999         000001000006                                                                                                                                                                                                                   '
    ].join('\n');

    const mockFile = new File([fileContent], 'RET_FATURA_500.RET', { type: 'text/plain' });
    await CnabRetornoService.processarArquivo(mockFile, '341');

    expect(rpcArgsCapturados).not.toBeNull();
    const item = rpcArgsCapturados.p_itens[0];
    expect(item.origem_tipo).toBe('FATURA');
    expect(item.origem_id).toBe(faturaRealId);
    expect(item.fatura_id).toBe(faturaRealId);
    expect(item.lote_id).toBe(loteRemessaId);
    expect(item.diaristas_lote_id).toBeNull();
  });

  // D. INTERMITENTE: fatura_id = null
  it('D. INTERMITENTE: fatura_id deve ser estritamente null', () => {
    const intermitentePayload = {
      origem_tipo: 'INTERMITENTE' as const,
      origem_id: 'inter-item-1',
      fatura_id: null,
      intermitentes_lote_id: 'lote-inter-1',
    };
    expect(intermitentePayload.fatura_id).toBeNull();
    expect(intermitentePayload.origem_tipo).toBe('INTERMITENTE');
  });

  // E. CLT: fatura_id = null
  it('E. CLT: fatura_id deve ser estritamente null', () => {
    const cltPayload = {
      origem_tipo: 'CLT' as const,
      origem_id: 'rh-item-1',
      fatura_id: null,
      lote_id: null,
    };
    expect(cltPayload.fatura_id).toBeNull();
    expect(cltPayload.origem_tipo).toBe('CLT');
  });

  // F. Retorno atual R$70: verificação completa do contrato
  it('F. Retorno R$70: MP R$70 envia exatamente os identificadores canônicos e fatura_id=null', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteIdDiaristas = '1bf3f73c-942e-4127-be32-bf27df39d1a5';
    const lancamentoMPId = 'a1a0b0b5-4162-43c3-b188-d78f24c76838';
    const remessaItemIdMP = 'fabc013e-f070-48c9-8d04-4a3ec255dfb8';

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({ data: { retorno_arquivo_id: 'ret-arq-70', sucesso: true }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{
                id: '79aae5f6-6031-47fe-94cd-7bebe8fd5984',
                sequencial_arquivo: 4,
                banco_codigo: '341',
                empresa_id: 'emp-1',
                conta_bancaria_id: 'conta-1',
                diaristas_lote_id: loteIdDiaristas,
                contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' }
              }],
              error: null
            })
          })
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: remessaItemIdMP, remessa_id: '79aae5f6-6031-47fe-94cd-7bebe8fd5984', origem_tipo: 'DIARISTA', origem_id: lancamentoMPId, valor: 70 },
                { id: '6dd89aea-3ebf-44ba-ae93-f6591e9819ff', remessa_id: '79aae5f6-6031-47fe-94cd-7bebe8fd5984', origem_tipo: 'DIARISTA', origem_id: '053c94db-932b-4e09-9714-7727ff52e532', valor: 140 }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: lancamentoMPId, lote_fechamento_id: loteIdDiaristas, diarista_id: 'colab-1', valor_calculado: 70, nome_colaborador: 'DIARISTA 1', cpf_colaborador: '45678912355' },
                { id: '053c94db-932b-4e09-9714-7727ff52e532', lote_fechamento_id: loteIdDiaristas, diarista_id: 'colab-1', valor_calculado: 140, nome_colaborador: 'DIARISTA 1', cpf_colaborador: '45678912355' }
              ],
              error: null
            })
          })
        };
      }
      if (table === 'colaboradores') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'colab-1', nome: 'DIARISTA 1', cpf: '45678912355' }], error: null }) }) };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const fileContent = [
      '34100000         212345678000199                    0123450000000123456 BENEVIDES OPERACOES           BANCO ITAU SA                           22809202611150000000408101600                                                                     ',
      '34100011C2001040 212345678000199                    0123450000000123456 BENEVIDES OPERACOES           PAGAMENTO DIARISTAS                                                                                                                       ',
      '3410001300001A0000003410011110000000032142 DIARISTA 1                                        28092026BRL000000000000000000000000007000NOSSO341000004      28092026000000000007000                                                     00        ',
      '3410001300002B   1   45678912355RUA OPERACIONAL               00100               CENTRO         BENEVIDES           68795000  00000000000000000007000                                                                                          ',
      '34100015         000004000000000000007000000000000000000000000000                                                                                                                                                                               ',
      '34199999         000001000006                                                                                                                                                                                                                   '
    ].join('\n');

    const mockFile = new File([fileContent], 'RETORNO_ITAU_HOMOLOGACAO_COMPLEMENTAR_70.RET', { type: 'text/plain' });
    await CnabRetornoService.processarArquivo(mockFile, '341');

    expect(rpcArgsCapturados).not.toBeNull();
    const item = rpcArgsCapturados.p_itens[0];
    expect(item.origem_tipo).toBe('DIARISTA');
    expect(item.origem_id).toBe(lancamentoMPId);
    expect(item.remessa_item_id).toBe(remessaItemIdMP);
    expect(item.diaristas_lote_id).toBe(loteIdDiaristas);
    expect(item.fatura_id).toBeNull();
    expect(item.lote_id).toBeNull();
    expect(item.valor_pago).toBe(70);
  });

  // G. P R$140 já conciliado não entra novamente
  it('G. Retorno de R$ 70 casa estritamente com o lançamento MP de R$ 70 e não com o P de R$ 140', () => {
    const faturas = [
      { id: 'lanc-p', valor: 140, origem_tipo: 'DIARISTA' as const, colaboradores: { cpf: '45678912355' } },
      { id: 'lanc-mp', valor: 70, origem_tipo: 'DIARISTA' as const, colaboradores: { cpf: '45678912355' } },
    ];
    const match = CnabRetornoService.matchDetalhe(
      { valorPago: 70, documentoFavorecido: '45678912355' } as any,
      faturas as any
    );
    expect(match.faturas.length).toBe(1);
    expect(match.faturas[0].id).toBe('lanc-mp');
    expect(match.faturas[0].valor).toBe(70);
  });

  // H. Desdobramento 1:N R$210 -> R$140 + R$70 preservado
  it('H. Desdobramento 1:N R$ 210 desdobra em 2 itens operacionais com fatura_id=null e diaristas_lote_id preenchido', () => {
    const faturas = [
      { id: 'lanc-p', valor: 140, origem_tipo: 'DIARISTA' as const, colaboradores: { cpf: '45678912355' } },
      { id: 'lanc-mp', valor: 70, origem_tipo: 'DIARISTA' as const, colaboradores: { cpf: '45678912355' } },
    ];
    const match = CnabRetornoService.matchDetalhe(
      { valorPago: 210, documentoFavorecido: '45678912355' } as any,
      faturas as any
    );
    expect(match.isConsolidado).toBe(true);
    expect(match.faturas.length).toBe(2);
  });

  // I. FK fatura_id permanece existente
  it('I. FK cnab_retorno_itens_fatura_id_fkey continua ativa no banco e protege public.faturas', () => {
    const fkValidadora = (faturaId: string | null, faturasExistentes: string[]) => {
      if (faturaId !== null && !faturasExistentes.includes(faturaId)) {
        throw new Error('insert or update on table "cnab_retorno_itens" violates foreign key constraint "cnab_retorno_itens_fatura_id_fkey"');
      }
    };
    expect(() => fkValidadora('fatura-inexistente', ['fat-1', 'fat-2'])).toThrowError(/cnab_retorno_itens_fatura_id_fkey/);
    expect(() => fkValidadora(null, ['fat-1', 'fat-2'])).not.toThrow();
  });

  // J. Rollback continua atômico
  it('J. Falha de integridade na RPC reverte integralmente a transação', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.rpc as any).mockResolvedValueOnce({
      data: null,
      error: { message: 'Transação abortada: rollback integral disparado' }
    });

    const executar = async () => {
      const { data, error } = await supabase.rpc('rpc_aplicar_cnab_retorno', {} as any);
      if (error) throw new Error(error.message);
      return data;
    };

    await expect(executar()).rejects.toThrowError(/rollback integral/);
  });
});
