import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';

// Mock do supabase e base.service
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

describe('CNAB CONCILIAÇÃO — FECHAMENTO DE LOTE DIARISTAS FAIL-CLOSED', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const loteId = '1bf3f73c-942e-4127-be32-bf27df39d1a5';
  const remessaId = '79aae5f6-6031-47fe-94cd-7bebe8fd5984';

  // 1. Parcial: 1 conciliado + 1 remetido -> lote NÃO PAGO
  it('1. Conciliação Parcial: 1 item conciliado e 1 remetido -> lote permanece cnab_gerado / parcial, NÃO PAGO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const updateCalls: Array<{ table: string; data: any }> = [];

    const retornoItensMock = [
      {
        id: 'ret-item-1',
        remessa_arquivo_id: remessaId,
        diaristas_lote_id: loteId,
        fatura_id: 'lanc-1',
        remessa_item_id: 'rem-item-1',
        status: 'pago',
        valor_retornado: 140,
        origem_tipo: 'DIARISTA',
      },
    ];

    const lancamentosLoteMock = [
      { id: 'lanc-1', status: 'PAGO' },
      { id: 'lanc-2', status: 'AGUARDANDO_PAGAMENTO' }, // Ainda pendente
    ];

    const remessaItensMock = [
      { id: 'rem-item-1', remessa_id: remessaId, origem_id: 'lanc-1', status: 'conciliado', valor: 140 },
      { id: 'rem-item-2', remessa_id: remessaId, origem_id: 'lanc-2', status: 'remetido', valor: 70 }, // Remetido, não conciliado
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: retornoItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: remessaItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaId, diaristas_lote_id: loteId }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosLoteMock, error: null }),
          }),
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'lancamentos_diaristas', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'diaristas_lotes_fechamento', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const result = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-parcial');
    expect(result.success).toBe(true);

    const lotePago = updateCalls.find((c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'PAGO');
    expect(lotePago).toBeUndefined(); // NUNCA deve ser PAGO!

    const loteParcial = updateCalls.find((c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'cnab_gerado');
    expect(loteParcial).toBeDefined();
    expect(loteParcial?.data.paid_at).toBeUndefined(); // NUNCA deve ter paid_at na conciliação parcial
  });

  // 2. Integral: 2 conciliados -> lote PAGO + conciliado + paid_at (e SEM conciliado_at)
  it('2. Conciliação Integral: 2 itens conciliados -> lote PAGO + conciliado + paid_at, sem a coluna inexistente conciliado_at', async () => {
    const { supabase } = await import('@/lib/supabase');
    const updateCalls: Array<{ table: string; data: any }> = [];

    const retornoItensMock = [
      {
        id: 'ret-item-2',
        remessa_arquivo_id: remessaId,
        diaristas_lote_id: loteId,
        fatura_id: 'lanc-2',
        remessa_item_id: 'rem-item-2',
        status: 'pago',
        valor_retornado: 70,
        origem_tipo: 'DIARISTA',
      },
    ];

    const lancamentosLoteMock = [
      { id: 'lanc-1', status: 'PAGO' },
      { id: 'lanc-2', status: 'PAGO' }, // Ambos pagos
    ];

    const remessaItensMock = [
      { id: 'rem-item-1', remessa_id: remessaId, origem_id: 'lanc-1', status: 'conciliado', valor: 140 },
      { id: 'rem-item-2', remessa_id: remessaId, origem_id: 'lanc-2', status: 'conciliado', valor: 70 }, // Ambos conciliados
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: retornoItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: remessaItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaId, diaristas_lote_id: loteId }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosLoteMock, error: null }),
          }),
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'lancamentos_diaristas', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'diaristas_lotes_fechamento', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const result = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-integral');
    expect(result.success).toBe(true);

    const lotePago = updateCalls.find((c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'PAGO');
    expect(lotePago).toBeDefined();
    expect(lotePago?.data.status).toBe('PAGO');
    expect(lotePago?.data.status_conciliacao).toBe('conciliado');
    expect(lotePago?.data.paid_at).toBeDefined(); // paid_at devidamente preenchido
    expect(lotePago?.data.conciliado_at).toBeUndefined(); // Coluna inexistente NUNCA deve ser enviada!
  });

  // 3. Falha no update do cabeçalho -> erro NÃO pode ser silenciado
  it('3. Fail-Closed: se o update de diaristas_lotes_fechamento falhar, o erro NÃO é silenciado e retorna success: false', async () => {
    const { supabase } = await import('@/lib/supabase');

    const retornoItensMock = [
      {
        id: 'ret-item-2',
        remessa_arquivo_id: remessaId,
        diaristas_lote_id: loteId,
        fatura_id: 'lanc-2',
        remessa_item_id: 'rem-item-2',
        status: 'pago',
        valor_retornado: 70,
        origem_tipo: 'DIARISTA',
      },
    ];

    const lancamentosLoteMock = [
      { id: 'lanc-1', status: 'PAGO' },
      { id: 'lanc-2', status: 'PAGO' },
    ];

    const remessaItensMock = [
      { id: 'rem-item-1', remessa_id: remessaId, origem_id: 'lanc-1', status: 'conciliado', valor: 140 },
      { id: 'rem-item-2', remessa_id: remessaId, origem_id: 'lanc-2', status: 'conciliado', valor: 70 },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: retornoItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: remessaItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaId, diaristas_lote_id: loteId }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosLoteMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            // Simula erro de schema ou permissão no banco
            eq: vi.fn().mockResolvedValue({ error: { message: 'relation constraint violation' } }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const result = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-error');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Falha ao atualizar cabeçalho do lote de diaristas');
  });

  // 4. paid_at só é preenchido na conclusão integral
  it('4. paid_at só é preenchido na conclusão integral (nunca em lotes com lançamentos pendentes)', async () => {
    const { supabase } = await import('@/lib/supabase');
    const updateCalls: Array<{ table: string; data: any }> = [];

    const retornoItensMock = [
      {
        id: 'ret-item-1',
        remessa_arquivo_id: remessaId,
        diaristas_lote_id: loteId,
        fatura_id: 'lanc-1',
        remessa_item_id: 'rem-item-1',
        status: 'pago',
        valor_retornado: 140,
        origem_tipo: 'DIARISTA',
      },
    ];

    const lancamentosLoteMock = [
      { id: 'lanc-1', status: 'PAGO' },
      { id: 'lanc-2', status: 'AGUARDANDO_PAGAMENTO' }, // Pendente
    ];

    const remessaItensMock = [
      { id: 'rem-item-1', remessa_id: remessaId, origem_id: 'lanc-1', status: 'conciliado', valor: 140 },
      { id: 'rem-item-2', remessa_id: remessaId, origem_id: 'lanc-2', status: 'remetido', valor: 70 },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: retornoItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: remessaItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaId, diaristas_lote_id: loteId }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosLoteMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'diaristas_lotes_fechamento', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-parcial');
    for (const call of updateCalls) {
      if (call.table === 'diaristas_lotes_fechamento') {
        expect(call.data.paid_at).toBeUndefined();
      }
    }
  });

  // 5. Não duplicar baixa dos lançamentos
  it('5. Não duplica baixa dos lançamentos: item já PAGO não sofre double-write indevido', async () => {
    const { supabase } = await import('@/lib/supabase');
    const lancUpdateCalls: any[] = [];

    // O retorno complementar traz apenas o item lanc-2 (R$70), lanc-1 já havia sido pago
    const retornoItensMock = [
      {
        id: 'ret-item-2',
        remessa_arquivo_id: remessaId,
        diaristas_lote_id: loteId,
        fatura_id: 'lanc-2',
        remessa_item_id: 'rem-item-2',
        status: 'pago',
        valor_retornado: 70,
        origem_tipo: 'DIARISTA',
      },
    ];

    const lancamentosLoteMock = [
      { id: 'lanc-1', status: 'PAGO' },
      { id: 'lanc-2', status: 'PAGO' },
    ];

    const remessaItensMock = [
      { id: 'rem-item-1', remessa_id: remessaId, origem_id: 'lanc-1', status: 'conciliado', valor: 140 },
      { id: 'rem-item-2', remessa_id: remessaId, origem_id: 'lanc-2', status: 'conciliado', valor: 70 },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: retornoItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: remessaItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaId, diaristas_lote_id: loteId }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosLoteMock, error: null }),
          }),
          update: vi.fn().mockImplementation((data) => {
            lancUpdateCalls.push(data);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-2');
    // Apenas 1 lançamento (lanc-2) foi baixado nesta execução
    expect(lancUpdateCalls.length).toBe(1);
    expect(lancUpdateCalls[0].status).toBe('PAGO');
  });

  // 6 & 7. Não modificar retornos existentes nem itens já conciliados
  it('6 & 7. Preservação: Itens já conciliados mantêm status conciliado e retornos anteriores permanecem imutáveis', async () => {
    const { supabase } = await import('@/lib/supabase');
    const remessaUpdateCalls: any[] = [];

    const retornoItensMock = [
      {
        id: 'ret-item-2',
        remessa_arquivo_id: remessaId,
        diaristas_lote_id: loteId,
        fatura_id: 'lanc-2',
        remessa_item_id: 'rem-item-2',
        status: 'pago',
        valor_retornado: 70,
        origem_tipo: 'DIARISTA',
      },
    ];

    const lancamentosLoteMock = [
      { id: 'lanc-1', status: 'PAGO' },
      { id: 'lanc-2', status: 'PAGO' },
    ];

    const remessaItensMock = [
      { id: 'rem-item-1', remessa_id: remessaId, origem_id: 'lanc-1', status: 'conciliado', valor: 140 },
      { id: 'rem-item-2', remessa_id: remessaId, origem_id: 'lanc-2', status: 'remetido', valor: 70 },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: retornoItensMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: remessaItensMock, error: null }),
          }),
          update: vi.fn().mockImplementation((data) => {
            remessaUpdateCalls.push(data);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaId, diaristas_lote_id: loteId }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: lancamentosLoteMock, error: null }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-2');
    // Apenas rem-item-2 teve seu status atualizado para conciliado
    expect(remessaUpdateCalls.length).toBe(1);
    expect(remessaUpdateCalls[0].status).toBe('conciliado');
  });
});
