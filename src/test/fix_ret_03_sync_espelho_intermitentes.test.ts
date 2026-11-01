import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-ret-fix03', email: 'auditor.ret03@orbe.test' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-001', userId: 'usr-ret-fix03' }),
  getCurrentTenantId: vi.fn().mockResolvedValue('tenant-001'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-ret-fix03', tenant_id: 'tenant-001' }),
}));

function createChainableMock(customResolvers: Record<string, any> = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(() => customResolvers.maybeSingle ?? Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => customResolvers.single ?? Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    then: (resolve: any) => resolve(customResolvers.then ?? { data: [], error: null }),
  };
  return chain;
}

describe('FIX-RET-03: Sincronização Atômica do Espelho RH/Financeiro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Deve reconhecer que rh_financeiro_lotes já está PAGO e não disparar UPDATE redundante', async () => {
    const retornoArquivoId = 'ret-arq-001';
    const remessaId = 'rem-001';
    const intermitenteLoteId = 'lote-int-001';
    const lancamentoId = 'lanc-001';
    const rhLoteId = 'rh-lote-mirror-001';

    const intermitentesUpdateMock = vi.fn().mockImplementation(() => createChainableMock({ then: { error: null } }));
    const rhLotesUpdateMock = vi.fn().mockImplementation(() => createChainableMock({ then: { error: null } }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return createChainableMock({
          then: {
            data: [
              {
                id: 'item-ret-001',
                status: 'pago',
                status_conciliacao: 'conciliado',
                remessa_arquivo_id: remessaId,
                intermitentes_lote_id: intermitenteLoteId,
                origem_tipo: 'INTERMITENTE',
                remessa_item: { id: 'rem-item-001', origem_id: lancamentoId },
              },
            ],
            error: null,
          },
        });
      }

      if (table === 'cnab_remessas_arquivos') {
        return createChainableMock({
          then: {
            data: [{ id: remessaId, modo: 'homologacao', intermitentes_lote_id: intermitenteLoteId }],
            error: null,
          },
        });
      }

      if (table === 'cnab_remessa_itens') {
        return createChainableMock({
          then: {
            data: [{ id: 'rem-item-001', remessa_id: remessaId, origem_id: lancamentoId, status: 'conciliado' }],
            error: null,
          },
        });
      }

      if (table === 'lancamentos_intermitentes') {
        return createChainableMock({
          then: {
            data: [{ id: lancamentoId, status_pipeline: 'PAGO' }],
            error: null,
          },
        });
      }

      if (table === 'intermitentes_lotes_fechamento') {
        const mock = createChainableMock({
          maybeSingle: Promise.resolve({
            data: { tenant_id: 'tenant-001', empresa_id: 'emp-001', competencia: '2026-11' },
            error: null,
          }),
          then: { error: null },
        });
        mock.update = intermitentesUpdateMock;
        return mock;
      }

      if (table === 'rh_financeiro_lote_itens') {
        return createChainableMock({
          then: {
            data: [{ lote_id: rhLoteId }],
            error: null,
          },
        });
      }

      if (table === 'rh_financeiro_lotes') {
        const mock = createChainableMock({
          maybeSingle: Promise.resolve({
            // Já está PAGO após a conciliação atômica da RPC!
            data: { id: rhLoteId, status: 'PAGO' },
            error: null,
          }),
        });
        mock.update = rhLotesUpdateMock;
        return mock;
      }

      return createChainableMock();
    });

    const resultado = await CnabConciliacaoService.processarBaixaAutomatica(retornoArquivoId);

    expect(resultado.success).toBe(true);
    expect(intermitentesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAGO' })
    );
    // Não dispara update redundante em rh_financeiro_lotes pois já estava PAGO
    expect(rhLotesUpdateMock).not.toHaveBeenCalled();
  });

  it('2. Deve atualizar rh_financeiro_lotes para PAGO caso ainda esteja pendente (fallback seguro)', async () => {
    const retornoArquivoId = 'ret-arq-002';
    const remessaId = 'rem-002';
    const intermitenteLoteId = 'lote-int-002';
    const lancamentoId = 'lanc-002';
    const rhLoteId = 'rh-lote-mirror-002';

    const intermitentesUpdateMock = vi.fn().mockImplementation(() => createChainableMock({ then: { error: null } }));
    const rhLotesUpdateMock = vi.fn().mockImplementation(() => createChainableMock({ then: { error: null } }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return createChainableMock({
          then: {
            data: [
              {
                id: 'item-ret-002',
                status: 'pago',
                status_conciliacao: 'conciliado',
                remessa_arquivo_id: remessaId,
                intermitentes_lote_id: intermitenteLoteId,
                origem_tipo: 'INTERMITENTE',
                remessa_item: { id: 'rem-item-002', origem_id: lancamentoId },
              },
            ],
            error: null,
          },
        });
      }

      if (table === 'cnab_remessas_arquivos') {
        return createChainableMock({
          then: {
            data: [{ id: remessaId, modo: 'homologacao', intermitentes_lote_id: intermitenteLoteId }],
            error: null,
          },
        });
      }

      if (table === 'cnab_remessa_itens') {
        return createChainableMock({
          then: {
            data: [{ id: 'rem-item-002', remessa_id: remessaId, origem_id: lancamentoId, status: 'conciliado' }],
            error: null,
          },
        });
      }

      if (table === 'lancamentos_intermitentes') {
        return createChainableMock({
          then: {
            data: [{ id: lancamentoId, status_pipeline: 'PAGO' }],
            error: null,
          },
        });
      }

      if (table === 'intermitentes_lotes_fechamento') {
        const mock = createChainableMock({
          maybeSingle: Promise.resolve({
            data: { tenant_id: 'tenant-001', empresa_id: 'emp-001', competencia: '2026-11' },
            error: null,
          }),
          then: { error: null },
        });
        mock.update = intermitentesUpdateMock;
        return mock;
      }

      if (table === 'rh_financeiro_lote_itens') {
        return createChainableMock({
          then: {
            data: [{ lote_id: rhLoteId }],
            error: null,
          },
        });
      }

      if (table === 'rh_financeiro_lotes') {
        const mock = createChainableMock({
          maybeSingle: Promise.resolve({
            // Ainda pendente
            data: { id: rhLoteId, status: 'AGUARDANDO_PAGAMENTO' },
            error: null,
          }),
        });
        mock.update = rhLotesUpdateMock;
        return mock;
      }

      return createChainableMock();
    });

    const resultado = await CnabConciliacaoService.processarBaixaAutomatica(retornoArquivoId);

    expect(resultado.success).toBe(true);
    expect(intermitentesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAGO' })
    );
    expect(rhLotesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PAGO' })
    );
  });

  it('3. Não deve liquidar lote operacional nem espelho em caso de quitação parcial', async () => {
    const retornoArquivoId = 'ret-arq-003';
    const remessaId = 'rem-003';
    const intermitenteLoteId = 'lote-int-003';
    const lancamento1Id = 'lanc-003a';
    const lancamento2Id = 'lanc-003b';

    const intermitentesUpdateMock = vi.fn().mockImplementation(() => createChainableMock({ then: { error: null } }));
    const rhLotesUpdateMock = vi.fn().mockImplementation(() => createChainableMock({ then: { error: null } }));

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return createChainableMock({
          then: {
            data: [
              {
                id: 'item-ret-003a',
                status: 'pago',
                status_conciliacao: 'conciliado',
                remessa_arquivo_id: remessaId,
                intermitentes_lote_id: intermitenteLoteId,
                origem_tipo: 'INTERMITENTE',
                remessa_item: { id: 'rem-item-003a', origem_id: lancamento1Id },
              },
            ],
            error: null,
          },
        });
      }

      if (table === 'cnab_remessas_arquivos') {
        return createChainableMock({
          then: {
            data: [{ id: remessaId, modo: 'homologacao', intermitentes_lote_id: intermitenteLoteId }],
            error: null,
          },
        });
      }

      if (table === 'cnab_remessa_itens') {
        return createChainableMock({
          then: {
            data: [
              { id: 'rem-item-003a', remessa_id: remessaId, origem_id: lancamento1Id, status: 'conciliado' },
              { id: 'rem-item-003b', remessa_id: remessaId, origem_id: lancamento2Id, status: 'remetido' },
            ],
            error: null,
          },
        });
      }

      if (table === 'lancamentos_intermitentes') {
        return createChainableMock({
          then: {
            data: [
              { id: lancamento1Id, status_pipeline: 'PAGO' },
              { id: lancamento2Id, status_pipeline: 'PROCESSADO_RH' },
            ],
            error: null,
          },
        });
      }

      if (table === 'intermitentes_lotes_fechamento') {
        const mock = createChainableMock({ then: { error: null } });
        mock.update = intermitentesUpdateMock;
        return mock;
      }

      if (table === 'rh_financeiro_lotes') {
        const mock = createChainableMock();
        mock.update = rhLotesUpdateMock;
        return mock;
      }

      return createChainableMock();
    });

    const resultado = await CnabConciliacaoService.processarBaixaAutomatica(retornoArquivoId);

    expect(resultado.success).toBe(true);
    // Em quitação parcial, intermitentes_lotes_fechamento é atualizado para CNAB_GERADO
    expect(intermitentesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CNAB_GERADO' })
    );
    // rh_financeiro_lotes NÃO pode ser atualizado para PAGO
    expect(rhLotesUpdateMock).not.toHaveBeenCalled();
  });
});
