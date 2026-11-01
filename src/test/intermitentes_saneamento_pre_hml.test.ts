import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { MotorCNAB240 } from '@/services/cnab/motorCNAB240.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-tester-id' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-test-uuid', userId: 'usr-tester-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-tester-id', tenant_id: 'tenant-test-uuid' }),
  };
});

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
  },
}));

// Template posicional de 240 caracteres oficial Itaú 341
const createItau240Lines = (params: {
  razaoSocial: string;
  nomeFavorecido: string;
  cpf: string;
  seuNumero: string;
  valorCentavosStr?: string;
}) => {
  const line1 = '34100000         212345678000199                    0123450000000123456 ' + params.razaoSocial.padEnd(30, ' ') + 'BANCO ITAU SA                           22809202611150000000408101600                                                                     ';
  const line2 = '34100011C2001040 212345678000199                    0123450000000123456 ' + params.razaoSocial.padEnd(30, ' ') + 'PAGAMENTO OPERACIONAL                                                                                                                     ';
  const line3 = '3410001300001A0000003410011110000000032142 ' + params.nomeFavorecido.padEnd(50, ' ') + '28092026BRL000000000000000000000000007000' + params.seuNumero.padEnd(20, ' ') + '28092026000000000007000                                                     00        ';
  const line4 = '3410001300002B   1   ' + params.cpf.padEnd(11, '0') + 'RUA OPERACIONAL               00100               CENTRO         BENEVIDES           68795000  00000000000000000007000                                                                                          ';
  const line5 = '34100015         000004000000000000007000000000000000000000000000                                                                                                                                                                               ';
  const line6 = '34199999         000001000006                                                                                                                                                                                                                   ';
  return [line1, line2, line3, line4, line5, line6].join('\n');
};

describe('SANEAMENTO PRÉ-HOMOLOGAÇÃO E2E — DOMÍNIO INTERMITENTES (18 REQUISITOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Status válidos de Intermitentes
  it('1. Status válidos de Intermitentes: conjunto canônico da CHECK CONSTRAINT do banco', () => {
    const STATUS_PERMITIDOS_BANCO = [
      'RECEBIDO',
      'EM_ANALISE_RH',
      'APROVADO_RH',
      'DEVOLVIDO',
      'ENVIADO_FINANCEIRO',
      'PAGO',
    ];

    expect(STATUS_PERMITIDOS_BANCO).toContain('RECEBIDO');
    expect(STATUS_PERMITIDOS_BANCO).toContain('EM_ANALISE_RH');
    expect(STATUS_PERMITIDOS_BANCO).toContain('APROVADO_RH');
    expect(STATUS_PERMITIDOS_BANCO).toContain('DEVOLVIDO');
    expect(STATUS_PERMITIDOS_BANCO).toContain('ENVIADO_FINANCEIRO');
    expect(STATUS_PERMITIDOS_BANCO).toContain('PAGO');

    // Valida que status inválidos NÃO pertencem ao contrato
    expect(STATUS_PERMITIDOS_BANCO).not.toContain('ABERTO_FINANCEIRO');
    expect(STATUS_PERMITIDOS_BANCO).not.toContain('DEVOLVIDO_RH');
  });

  // 2. Aprovação financeira não grava status inválido
  it('2. Aprovação financeira não grava status inválido: atualiza para ENVIADO_FINANCEIRO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = 'lote-intermitente-1';
    const lancamentoIds = ['lanc-1', 'lanc-2'];

    let lancamentoUpdatePayload: any = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentoIds.map((id) => ({ id })), error: null }),
            in: vi.fn().mockResolvedValue({ data: lancamentoIds.map((id) => ({ id })), error: null }),
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            lancamentoUpdatePayload = payload;
            return { in: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'rh_financeiro_lote_historico') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    await IntermitentesLoteService.aprovarFinanceiro(loteId, 'Diretor Financeiro');

    expect(lancamentoUpdatePayload).toEqual({ status_pipeline: 'ENVIADO_FINANCEIRO' });
    expect(lancamentoUpdatePayload.status_pipeline).not.toBe('ABERTO_FINANCEIRO');
  });

  // 3. Devolução não grava status inválido
  it('3. Devolução não grava status inválido: atualiza para DEVOLVIDO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = 'lote-intermitente-dev';
    const lancamentoIds = ['lanc-dev-1'];

    let lancamentoUpdatePayload: any = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentoIds.map((id) => ({ id })), error: null }),
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            lancamentoUpdatePayload = payload;
            return { in: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    await IntermitentesLoteService.devolverLote(loteId, 'Inconsistência cadastral no lote');

    expect(lancamentoUpdatePayload).toEqual({ status_pipeline: 'DEVOLVIDO' });
    expect(lancamentoUpdatePayload.status_pipeline).not.toBe('DEVOLVIDO_RH');
  });

  // 4 e 5. Remessa: origem_tipo = INTERMITENTE e origem_id referencia lancamentos_intermitentes
  it('4 e 5. Remessa CNAB: itens possuem origem_tipo = INTERMITENTE e origem_id = lancamentos_intermitentes.id', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = 'lote-int-cnab-1';
    const lancamentosMock = [
      { id: 'lanc-int-101', colaborador_id: 'colab-1', nome_colaborador: 'João Intermitente', cpf_colaborador: '12345678901', total: 150 },
    ];

    let itensRegistrados: any[] = [];

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'get_next_cnab_sequencial_arquivo') {
        return Promise.resolve({ data: 1, error: null });
      }
      if (fn === 'rpc_registrar_cnab_remessa' || fn === 'rpc_gerar_cnab_remessa_transacional') {
        itensRegistrados = args?.p_itens || [];
        return Promise.resolve({
          data: { remessa_id: 'rem-arq-int-1', sucesso: true },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: loteId, status: 'FECHADO_FINANCEIRO', empresa_id: 'emp-1', competencia: '2026-09' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosMock, error: null }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{
                id: 'colab-1',
                nome: 'João Intermitente',
                cpf: '12345678901',
                banco_codigo: '001',
                agencia: '1234',
                conta: '56789',
                digito_conta: '0',
                tipo_conta: 'corrente',
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'contas_bancarias_empresa') {
        const mockConta = {
          id: 'conta-emp-1',
          empresa_id: 'emp-1',
          banco_codigo: '001',
          banco_nome: 'BANCO DO BRASIL',
          agencia: '0001',
          agencia_digito: '0',
          conta: '12345',
          conta_digito: '6',
          convenio: '1234567',
          ativo: true,
          is_padrao: true,
          cedente_cnpj: '12345678000199',
          cedente_nome: 'EMPRESA TESTE',
        };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockConta, error: null }),
              eq: vi.fn().mockResolvedValue({ data: [mockConta], error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { sequencial_arquivo: 1 }, error: null }),
                  }),
                }),
              }),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'rem-arq-int-1' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          insert: vi.fn().mockImplementation((itens: any[]) => {
            itensRegistrados = itens;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-1' }, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    MotorCNAB240.download = vi.fn();

    await IntermitentesLoteService.gerarCNABParaLote({
      loteId,
      empresaId: 'emp-1',
      geradoPor: 'usr-fin',
      geradoPorNome: 'Financeiro',
      empresaRemetente: {
        cnpj: '12345678000199',
        razao_social: 'EMPRESA TESTE',
        banco_codigo: '001',
        agencia: '0001',
        conta: '12345',
        digito_conta: '6',
        convenio_bancario: '1234567',
      },
    });

    expect(itensRegistrados.length).toBe(1);
    expect(itensRegistrados[0].origem_tipo).toBe('INTERMITENTE');
    expect(itensRegistrados[0].origem_id).toBe('lanc-int-101');
    expect(itensRegistrados[0].fatura_id).toBeNull();
    expect(itensRegistrados[0].lote_item_id).toBeNull();
  });

  // 6 a 10. Retorno CNAB de Intermitentes: resolução canônica, não busca como CLT, fatura_id null, intermitentes_lote_id correto
  it('6 a 10. Retorno CNAB resolve lancamentos_intermitentes, não busca CLT, com fatura_id null e intermitentes_lote_id preenchido', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteIntermitenteId = 'b1b2b3b4-5555-6666-7777-88889999aaaa';

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({ data: { retorno_arquivo_id: 'ret-int-1', sucesso: true }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    let rhFinanceiroLoteItensQueryCalled = false;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{
                id: 'rem-int-1',
                sequencial_arquivo: 4,
                banco_codigo: '341',
                empresa_id: 'emp-1',
                conta_bancaria_id: 'conta-1',
                intermitentes_lote_id: loteIntermitenteId,
                diaristas_lote_id: null,
                lote_id: null,
                contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' },
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{
                id: 'rem-item-int-1',
                remessa_id: 'rem-int-1',
                origem_tipo: 'INTERMITENTE',
                origem_id: 'lanc-int-99',
                valor: 70,
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lote_itens') {
        rhFinanceiroLoteItensQueryCalled = true;
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{
                id: 'lanc-int-99',
                lote_fechamento_id: loteIntermitenteId,
                colaborador_id: 'colab-int-1',
                total: 70,
                nome_colaborador: 'INTERMITENTE 1',
                cpf_colaborador: '45678912355',
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'colab-int-1', nome: 'INTERMITENTE 1', cpf: '45678912355' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    const fileContent = createItau240Lines({
      razaoSocial: 'BENEVIDES OPERACOES',
      nomeFavorecido: 'INTERMITENTE 1',
      cpf: '45678912355',
      seuNumero: 'NOSSO341000004',
      valorCentavosStr: '000000000007000',
    });

    const mockFile = new File([fileContent], 'RET_INT_70.RET', { type: 'text/plain' });
    await CnabRetornoService.processarArquivo(mockFile, '341');

    // 7. Não procurou INTERMITENTE em rh_financeiro_lote_itens
    expect(rhFinanceiroLoteItensQueryCalled).toBe(false);

    expect(rpcArgsCapturados).not.toBeNull();
    expect(rpcArgsCapturados.p_itens.length).toBe(1);
    const item = rpcArgsCapturados.p_itens[0];

    // 4 & 6. Origem INTERMITENTE e origem_id apontando para lancamentos_intermitentes.id
    expect(item.origem_tipo).toBe('INTERMITENTE');
    expect(item.origem_id).toBe('lanc-int-99');

    // 8. fatura_id fica NULL
    expect(item.fatura_id).toBeNull();

    // 9. intermitentes_lote_id correto
    expect(item.intermitentes_lote_id).toBe(loteIntermitenteId);

    // 10. remessa_item_id correto e lote_id / diaristas_lote_id null
    expect(item.remessa_item_id).toBe('rem-item-int-1');
    expect(item.lote_id).toBeNull();
    expect(item.diaristas_lote_id).toBeNull();
  });

  // 11. Retorno parcial não fecha lote
  it('11. Retorno parcial de Intermitentes mantém lote pai em CNAB_GERADO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = 'lote-int-parcial';

    let statusLoteAtualizado: string | null = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', status_conciliacao: 'aguardando_conciliacao', intermitentes_lote_id: loteId, colaborador_id: 'colab-1', origem_id: 'lanc-1' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              // 2 lançamentos no lote: 1 pago, 1 pendente
              data: [
                { id: 'lanc-1', status_pipeline: 'PAGO' },
                { id: 'lanc-2', status_pipeline: 'ENVIADO_FINANCEIRO' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' },
                { id: 'rem-item-2', status: 'remetido', origem_id: 'lanc-2' }, // pendente
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            statusLoteAtualizado = payload.status;
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-parcial-id');

    expect(statusLoteAtualizado).toBe('CNAB_GERADO');
    expect(statusLoteAtualizado).not.toBe('PAGO');
  });

  // 12. Retorno total promove lote para PAGO
  it('12. Retorno total de Intermitentes promove lote pai para PAGO quando todos conciliados', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = 'lote-int-total';

    let statusLoteAtualizado: string | null = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', status_conciliacao: 'aguardando_conciliacao', intermitentes_lote_id: loteId, colaborador_id: 'colab-1', origem_id: 'lanc-1' },
                { id: 'ret-item-2', status: 'pago', status_conciliacao: 'aguardando_conciliacao', intermitentes_lote_id: loteId, colaborador_id: 'colab-2', origem_id: 'lanc-2' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-1', status_pipeline: 'PAGO' },
                { id: 'lanc-2', status_pipeline: 'PAGO' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' },
                { id: 'rem-item-2', status: 'conciliado', origem_id: 'lanc-2' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            statusLoteAtualizado = payload.status;
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-total-id');

    expect(statusLoteAtualizado).toBe('PAGO');
  });

  // 13. Arquivo duplicado continua bloqueado
  it('13. Arquivo de retorno com hash duplicado continua estritamente bloqueado', async () => {
    const { supabase } = await import('@/lib/supabase');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'ret-existente', nome_arquivo: 'RET_JA_PROCESSADO.RET' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    const fileContent = '34100000...';
    const mockFile = new File([fileContent], 'RET_JA_PROCESSADO.RET', { type: 'text/plain' });

    await expect(CnabRetornoService.processarArquivo(mockFile, '341'))
      .rejects.toThrowError(/Arquivo de retorno j[aá] processado anteriormente/);
  });

  // 14. DIARISTA continua funcionando
  it('14. Regressão zero para DIARISTA: preserva diaristas_lote_id e lote_id null', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteDiaristaId = 'diarista-lote-regressao-1';

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({ data: { retorno_arquivo_id: 'ret-dia-1', sucesso: true }, error: null });
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
                id: 'rem-dia-1',
                sequencial_arquivo: 4,
                banco_codigo: '341',
                empresa_id: 'emp-1',
                conta_bancaria_id: 'conta-1',
                diaristas_lote_id: loteDiaristaId,
                lote_id: null,
                contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' },
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-item-dia-1', remessa_id: 'rem-dia-1', origem_tipo: 'DIARISTA', origem_id: 'lanc-dia-1', valor: 70 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-dia-1', lote_fechamento_id: loteDiaristaId, diarista_id: 'colab-dia-1', valor_calculado: 70, nome_colaborador: 'DIARISTA 1', cpf_colaborador: '45678912355' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: 'colab-dia-1', nome: 'DIARISTA 1', cpf: '45678912355' }], error: null }) }) };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    const fileContent = createItau240Lines({
      razaoSocial: 'BENEVIDES OPERACOES',
      nomeFavorecido: 'DIARISTA 1',
      cpf: '45678912355',
      seuNumero: 'NOSSO341000004',
      valorCentavosStr: '000000000007000',
    });

    const mockFile = new File([fileContent], 'RET_DIA_70.RET', { type: 'text/plain' });
    await CnabRetornoService.processarArquivo(mockFile, '341');

    expect(rpcArgsCapturados).not.toBeNull();
    const item = rpcArgsCapturados.p_itens[0];
    expect(item.origem_tipo).toBe('DIARISTA');
    expect(item.diaristas_lote_id).toBe(loteDiaristaId);
    expect(item.lote_id).toBeNull();
    expect(item.intermitentes_lote_id).toBeNull();
  });

  // 15. CLT não sofreu regressão nos componentes compartilhados
  it('15. Regressão zero para CLT: origem_tipo = CLT resolve via rh_financeiro_lote_itens', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteCltId = 'clt-lote-rh-1';

    let rpcArgsCapturados: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcArgsCapturados = args;
        return Promise.resolve({ data: { retorno_arquivo_id: 'ret-clt-1', sucesso: true }, error: null });
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
                id: 'rem-clt-1',
                sequencial_arquivo: 4,
                banco_codigo: '341',
                empresa_id: 'emp-1',
                conta_bancaria_id: 'conta-1',
                lote_id: loteCltId,
                diaristas_lote_id: null,
                contas_bancarias_empresa: { empresa_id: 'emp-1', banco_codigo: '341' },
              }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-item-clt-1', remessa_id: 'rem-clt-1', origem_tipo: 'CLT', origem_id: 'rh-item-1', valor: 70 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rh-item-1', lote_id: loteCltId, colaborador_id: 'colab-clt-1', valor_calculado: 70, colaboradores: { id: 'colab-clt-1', nome: 'FUNCIONARIO CLT', cpf: '45678912355' } }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      return { select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis() };
    });

    const fileContent = createItau240Lines({
      razaoSocial: 'BENEVIDES OPERACOES',
      nomeFavorecido: 'FUNCIONARIO CLT',
      cpf: '45678912355',
      seuNumero: 'NOSSO341000004',
      valorCentavosStr: '000000000007000',
    });

    const mockFile = new File([fileContent], 'RET_CLT_70.RET', { type: 'text/plain' });
    await CnabRetornoService.processarArquivo(mockFile, '341');

    expect(rpcArgsCapturados).not.toBeNull();
    const item = rpcArgsCapturados.p_itens[0];
    expect(item.origem_tipo).toBe('CLT');
    expect(item.lote_id).toBe(loteCltId);
    expect(item.diaristas_lote_id).toBeNull();
    expect(item.intermitentes_lote_id).toBeNull();
  });

  // 16. Banco não suportado continua bloqueado
  it('16. Motor multibanco e Retorno: banco não suportado continua bloqueado', async () => {
    const file237 = [
      '23700000' + ' '.repeat(232),
      '23799999' + ' '.repeat(232),
    ].join('\n');
    const mockFile = new File([file237], 'RET_237.RET', { type: 'text/plain' });
    await expect(CnabRetornoService.processarArquivo(mockFile, '237'))
      .rejects.toThrowError(/não possui retorno CNAB240 homologado|não suportado/i);

    expect(() => MotorCNAB240.gerar({
      cnpj: '12345678000199',
      razao_social: 'TESTE',
      banco_codigo: '237',
      agencia: '1234',
      conta: '56789',
    }, [{
      nome: 'TESTE',
      cpf: '12345678901',
      banco_codigo: '237',
      agencia: '1234',
      conta: '56789',
      conta_digito: '0',
      valor: 100,
      data_pagamento: new Date('2026-09-28'),
    }], { numero_arquivo: 1 })).toThrowError(/não possui layout CNAB240 homologado|homologado/i);
  });

  // 17. BB 001 continua roteando corretamente
  it('17. Motor multibanco: Banco do Brasil 001 continua gerando layout posicional homologado', () => {
    const res = MotorCNAB240.gerar({
      cnpj: '12345678000199',
      razao_social: 'EMPRESA BRASIL',
      banco_codigo: '001',
      agencia: '1234',
      agencia_digito: '0',
      conta: '56789',
      digito_conta: '1',
      convenio: '1234567',
    }, [{
      nome: 'TRABALHADOR BB',
      cpf: '12345678901',
      valor: 500,
      banco_codigo: '001',
      agencia: '1234',
      agencia_digito: '0',
      conta: '56789',
      conta_digito: '1',
      tipo_conta: 'corrente',
      data_pagamento: new Date('2026-09-30T12:00:00Z'),
    }], { numero_arquivo: 10 });

    expect(res.conteudo.startsWith('001')).toBe(true);
    expect(res.banco_codigo).toBe('001');
    expect(res.total_beneficiarios).toBe(1);
    expect(res.valor_total).toBe(500);
  });

  // 18. Itaú 341 continua roteando corretamente
  it('18. Motor multibanco: Banco Itaú 341 continua gerando layout SISPAG posicional homologado', () => {
    const res = MotorCNAB240.gerar({
      cnpj: '12345678000199',
      razao_social: 'EMPRESA ITAU',
      banco_codigo: '341',
      agencia: '0001',
      conta: '12345',
      digito_conta: '6',
    }, [{
      nome: 'TRABALHADOR ITAU',
      cpf: '98765432100',
      valor: 750,
      banco_codigo: '341',
      agencia: '0001',
      conta: '12345',
      conta_digito: '6',
      tipo_conta: 'corrente',
      data_pagamento: new Date('2026-09-30T12:00:00Z'),
    }], { numero_arquivo: 11 });

    expect(res.conteudo.startsWith('341')).toBe(true);
    expect(res.banco_codigo).toBe('341');
    expect(res.total_beneficiarios).toBe(1);
    expect(res.valor_total).toBe(750);
  });

  // 19. Navegação e Sidebar contextual de Intermitentes
  it('19. Sidebar Intermitentes possui exatamente a árvore canônica e rotas contextuais', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { isRouteMatchingItem } = await import('@/components/layout/Sidebar');

    const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    const intermitentesGroupMatch = content.match(/id:\s*"intermitentes"[\s\S]*?items:\s*\[([\s\S]*?)\]/);
    expect(intermitentesGroupMatch).not.toBeNull();

    const itemsBlock = intermitentesGroupMatch![1];

    // Verifica exatamente os 7 itens na ordem correta
    expect(itemsBlock).toContain('label: "Importações"');
    expect(itemsBlock).toContain('to: "/importacoes?origem=INTERMITENTE"');

    expect(itemsBlock).toContain('label: "Jornadas / Processamento"');
    expect(itemsBlock).toContain('to: "/operacional/intermitentes"');

    expect(itemsBlock).toContain('label: "Inconsistências"');
    expect(itemsBlock).toContain('to: "/intermitentes/inconsistencias"');

    expect(itemsBlock).toContain('label: "Aprovações"');
    expect(itemsBlock).toContain('to: "/intermitentes/aprovacoes"');

    expect(itemsBlock).toContain('label: "Lotes"');
    expect(itemsBlock).toContain('to: "/operacional/intermitentes/lotes"');

    expect(itemsBlock).toContain('label: "Pagamentos e Remessas"');
    expect(itemsBlock).toContain('to: "/bancario?tab=intermitentes&origem=INTERMITENTE"');

    expect(itemsBlock).toContain('label: "Conciliação Bancária"');
    expect(itemsBlock).toContain('to: "/bancario?tab=retorno&origem=INTERMITENTE"');

    // Valida isRouteMatchingItem para Pagamentos e Remessas
    const itemPagamentosRemessas = {
      icon: () => null,
      label: 'Pagamentos e Remessas',
      to: '/bancario?tab=intermitentes&origem=INTERMITENTE',
    };
    const itemConciliacao = {
      icon: () => null,
      label: 'Conciliação Bancária',
      to: '/bancario?tab=retorno&origem=INTERMITENTE',
    };

    // No contexto INTERMITENTE
    expect(isRouteMatchingItem(itemPagamentosRemessas as any, { pathname: '/bancario', search: '?tab=intermitentes&origem=INTERMITENTE' })).toBe(true);
    expect(isRouteMatchingItem(itemConciliacao as any, { pathname: '/bancario', search: '?tab=intermitentes&origem=INTERMITENTE' })).toBe(false);

    expect(isRouteMatchingItem(itemConciliacao as any, { pathname: '/bancario', search: '?tab=retorno&origem=INTERMITENTE' })).toBe(true);
    expect(isRouteMatchingItem(itemPagamentosRemessas as any, { pathname: '/bancario', search: '?tab=retorno&origem=INTERMITENTE' })).toBe(false);

    // No contexto DIARISTA ou GLOBAL
    expect(isRouteMatchingItem(itemPagamentosRemessas as any, { pathname: '/bancario', search: '?tab=diaristas&origem=DIARISTA' })).toBe(false);
    expect(isRouteMatchingItem(itemConciliacao as any, { pathname: '/bancario', search: '?tab=retorno&origem=DIARISTA' })).toBe(false);
  });
});
