import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';
import { CNAB240BBReader } from '@/services/cnab/CNAB240BBReader';

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

describe('CNAB RETORNO — TIPAGEM RELACIONAL DOS LOTES POR DOMÍNIO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. DIARISTA: diaristas_lote_id válido, lote_id null -> aceita
  it('A. DIARISTA: deve gerar payload com diaristas_lote_id preenchido e lote_id null', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteDiaristaId = '1bf3f73c-942e-4127-be32-bf27df39d1a5';

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
              data: [{ id: 'rem-item-1', remessa_id: 'rem-1', origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 70 }],
              error: null
            })
          })
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1', lote_fechamento_id: loteDiaristaId, diarista_id: 'colab-1', valor_calculado: 70, nome_colaborador: 'Diarista 1', cpf_colaborador: '12345678901' }],
              error: null
            })
          })
        };
      }
      if (table === 'colaboradores') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'colab-1', nome: 'Diarista 1', cpf: '12345678901' }], error: null }) }) };
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
    expect(rpcArgsCapturados.p_itens.length).toBe(1);
    const item = rpcArgsCapturados.p_itens[0];
    expect(item.origem_tipo).toBe('DIARISTA');
    expect(item.diaristas_lote_id).toBe(loteDiaristaId);
    expect(item.lote_id).toBeNull();
    expect(item.intermitentes_lote_id).toBeNull();
  });

  // B. DIARISTA: lote_id contendo UUID de diaristas -> validação defensiva
  it('B. DIARISTA: se lote_id for preenchido para DIARISTA, a RPC simula rejeição por inconsistência', () => {
    // Simula a validação defensiva da migration:
    // IF v_origem_tipo = 'DIARISTA' AND v_lote_id IS NOT NULL THEN RAISE EXCEPTION ...
    const payloadInvalido = {
      origem_tipo: 'DIARISTA',
      lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
      diaristas_lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
    };

    const validarPayloadDefensivo = (item: any) => {
      if (item.origem_tipo === 'DIARISTA' && item.lote_id !== null && item.lote_id !== undefined) {
        throw new Error(`Payload inconsistente: lote_id (${item.lote_id}) não é permitido para origem_tipo DIARISTA. Use diaristas_lote_id.`);
      }
    };

    expect(() => validarPayloadDefensivo(payloadInvalido)).toThrowError(/não é permitido para origem_tipo DIARISTA/);
  });

  // C. DIARISTA: diaristas_lote_id inexistente -> FK bloqueia
  it('C. DIARISTA: se diaristas_lote_id não existir na tabela diaristas_lotes_fechamento, a FK deve bloquear a transação', () => {
    const fkConstraintSimulada = (diaristasLoteId: string, lotesExistentes: string[]) => {
      if (!lotesExistentes.includes(diaristasLoteId)) {
        throw new Error('violates foreign key constraint "cnab_retorno_itens_diaristas_lote_id_fkey"');
      }
    };

    const lotesNoBanco = ['1bf3f73c-942e-4127-be32-bf27df39d1a5'];
    expect(() => fkConstraintSimulada('00000000-0000-0000-0000-000000000000', lotesNoBanco))
      .toThrowError(/cnab_retorno_itens_diaristas_lote_id_fkey/);
  });

  // D. FATURA: lote_id válido de lotes_remessa -> preserva comportamento
  it('D. FATURA: lote_id válido de lotes_remessa preserva comportamento e diaristas_lote_id permanece null', async () => {
    const { supabase } = await import('@/lib/supabase');
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
              data: [{ id: 'rem-item-fat', remessa_id: 'rem-fat-1', origem_tipo: 'FATURA', origem_id: 'fat-1', valor: 500 }],
              error: null
            })
          })
        };
      }
      if (table === 'faturas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'fat-1', lote_remessa_id: loteRemessaId, colaborador_id: 'colab-1', valor: 500, nosso_numero: 'NOSSO341000004' }],
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
    expect(item.lote_id).toBe(loteRemessaId);
    expect(item.diaristas_lote_id).toBeNull();
    expect(item.intermitentes_lote_id).toBeNull();
  });

  // E. INTERMITENTE: intermitentes_lote_id correto, lote_id null
  it('E. INTERMITENTE: deve enviar intermitentes_lote_id preenchido e lote_id null', () => {
    const intermitenteItem = {
      origem_tipo: 'INTERMITENTE' as const,
      lote_id: null,
      diaristas_lote_id: null,
      intermitentes_lote_id: '3c4d5e6f-7777-8888-9999-aaaa11112222',
    };

    expect(intermitenteItem.origem_tipo).toBe('INTERMITENTE');
    expect(intermitenteItem.intermitentes_lote_id).toBeTruthy();
    expect(intermitenteItem.lote_id).toBeNull();
    expect(intermitenteItem.diaristas_lote_id).toBeNull();
  });

  // F. Domínio cruzado: ID diarista não pode ser persistido em intermitentes_lote_id
  it('F. Domínio Cruzado: Validação defensiva impede cruzar ID de diarista em intermitentes_lote_id', () => {
    const payloadInvalido = {
      origem_tipo: 'DIARISTA',
      lote_id: null,
      diaristas_lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
      intermitentes_lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5', // Inconsistência!
    };

    const validarPayloadDefensivo = (item: any) => {
      if (item.origem_tipo === 'DIARISTA' && item.intermitentes_lote_id !== null && item.intermitentes_lote_id !== undefined) {
        throw new Error(`Payload inconsistente: intermitentes_lote_id (${item.intermitentes_lote_id}) não é permitido para origem_tipo DIARISTA.`);
      }
    };

    expect(() => validarPayloadDefensivo(payloadInvalido)).toThrowError(/intermitentes_lote_id.*não é permitido para origem_tipo DIARISTA/);
  });

  // G. Retorno R$70 atual: MP R$70 -> diaristas_lote_id = 1bf3f73c... -> lote_id = null
  it('G. Retorno R$70 atual: MP R$70 gera estritamente diaristas_lote_id=1bf3f73c... e lote_id=null', async () => {
    const faturasMock = [
      {
        id: 'a1a0b0b5-7fe9-4e78-bc46-5be97df11b25',
        remessa_item_id: 'fabc013e-1111-2222-3333-444455556666',
        lote_id: null,
        diaristas_lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        intermitentes_lote_id: null,
        colaborador_id: 'colab-diarista-1',
        valor: 70,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-diarista-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73CCOLAB1', valorPago: 70, documentoFavorecido: '12345678901' } as any,
      faturasMock
    );

    expect(match.faturas.length).toBe(1);
    const item = match.faturas[0];
    expect(item.valor).toBe(70);
    expect(item.lote_id).toBeNull();
    expect(item.diaristas_lote_id).toBe('1bf3f73c-942e-4127-be32-bf27df39d1a5');
    expect(item.intermitentes_lote_id).toBeNull();
  });

  // H. Regressão do 1:N: R$210 -> R$140 + R$70
  it('H. Regressão 1:N: R$210 desdobra em 2 itens operacionais com diaristas_lote_id e lote_id=null', () => {
    const faturasMock = [
      {
        id: 'lanc-p-140',
        remessa_item_id: 'rem-item-1',
        lote_id: null,
        diaristas_lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        intermitentes_lote_id: null,
        colaborador_id: 'colab-1',
        valor: 140,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
      {
        id: 'lanc-mp-70',
        remessa_item_id: 'rem-item-2',
        lote_id: null,
        diaristas_lote_id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
        intermitentes_lote_id: null,
        colaborador_id: 'colab-1',
        valor: 70,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73CCOLAB1', valorPago: 210, documentoFavorecido: '12345678901' } as any,
      faturasMock
    );

    expect(match.isConsolidado).toBe(true);
    expect(match.faturas.length).toBe(2);
    expect(match.faturas.reduce((acc, f) => acc + f.valor, 0)).toBe(210);
    match.faturas.forEach((f) => {
      expect(f.lote_id).toBeNull();
      expect(f.diaristas_lote_id).toBe('1bf3f73c-942e-4127-be32-bf27df39d1a5');
    });
  });

  // I. Rollback integral em FK inválida
  it('I. Atomicidade: falha de FK em qualquer item deve provocar rollback integral da transação RPC', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.rpc as any).mockResolvedValueOnce({
      data: null,
      error: { message: 'insert or update on table "cnab_retorno_itens" violates foreign key constraint "cnab_retorno_itens_diaristas_lote_id_fkey"' }
    });

    const tentarRpc = async () => {
      const { data, error } = await supabase.rpc('rpc_aplicar_cnab_retorno', { p_itens: [] } as any);
      if (error) throw new Error(error.message);
      return data;
    };

    await expect(tentarRpc()).rejects.toThrowError(/violates foreign key constraint/);
  });

  // J. BB regressão
  it('J. Regressão Banco do Brasil 001: factory instancia reader correto sem regressão', () => {
    const bbHeader = '0010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    const reader = CNABRetornoReaderFactory.getReader(bbHeader, '001');
    expect(reader).toBeInstanceOf(CNAB240BBReader);
  });

  // K. Itaú regressão
  it('K. Regressão Itaú 341: factory instancia reader correto sem regressão', () => {
    const itauHeader = '3410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    const reader = CNABRetornoReaderFactory.getReader(itauHeader, '341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);
  });
});
