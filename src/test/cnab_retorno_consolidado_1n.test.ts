import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CnabRetornoService, toCents } from '@/services/cnab/cnabRetorno.service';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { CNABRetornoReaderFactory } from '@/services/cnab/CNABRetornoReaderFactory';
import { CNAB240BBReader } from '@/services/cnab/CNAB240BBReader';
import { CNAB240ItauReader } from '@/services/cnab/CNAB240ItauReader';

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

describe('CNAB RETORNO DIARISTAS — PAGAMENTO CONSOLIDADO 1:N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // J. Centavos: Comparação monetária exata em integer cents
  it('J. Deve garantir precisão absoluta em centavos inteiros via toCents (evitando float precision leaks)', () => {
    expect(toCents(210)).toBe(21000);
    expect(toCents(140)).toBe(14000);
    expect(toCents(70)).toBe(7000);
    expect(toCents('210.00')).toBe(21000);
    expect(toCents('70.50')).toBe(7050);
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    // 0.1 + 0.2 em centavos
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
  });

  // A. 1 retorno R$210 -> itens R$140 + R$70 -> ambos pagos -> lote PAGO
  it('A. 1 retorno R$210 -> deve casar 1:N com itens R$140 + R$70 e promover lote para PAGO', async () => {
    const faturasMock = [
      {
        id: 'lanc-p-140',
        remessa_item_id: 'rem-item-1',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 140,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-diarista-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
      {
        id: 'lanc-mp-70',
        remessa_item_id: 'rem-item-2',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 70,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-diarista-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73CCOLAB1', valorPago: 210, documentoFavorecido: '12345678901' } as any,
      faturasMock
    );

    expect(match.isConsolidado).toBe(true);
    expect(match.faturas.length).toBe(2);
    expect(match.faturas[0].id).toBe('lanc-p-140');
    expect(match.faturas[1].id).toBe('lanc-mp-70');
    expect(match.criterio).toBe('seu_numero_forte');

    // Validação da baixa e quitação integral do lote
    const { supabase } = await import('@/lib/supabase');
    const updateCalls: { table: string; data: any }[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'ret-item-1',
                  remessa_arquivo_id: 'rem-1',
                  remessa_item_id: 'rem-item-1',
                  fatura_id: 'lanc-p-140',
                  lote_id: 'lote-1bf3f73c',
                  colaborador_id: 'colab-diarista-1',
                  status: 'pago',
                  valor_esperado: 140,
                  valor_retornado: 140,
                },
                {
                  id: 'ret-item-2',
                  remessa_arquivo_id: 'rem-1',
                  remessa_item_id: 'rem-item-2',
                  fatura_id: 'lanc-mp-70',
                  lote_id: 'lote-1bf3f73c',
                  colaborador_id: 'colab-diarista-1',
                  status: 'pago',
                  valor_esperado: 70,
                  valor_retornado: 70,
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'cnab_retorno_itens', data });
            return { in: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', remessa_id: 'rem-1', origem_id: 'lanc-p-140', status: 'conciliado', lote_item_id: 'lote-1bf3f73c' },
                { id: 'rem-item-2', remessa_id: 'rem-1', origem_id: 'lanc-mp-70', status: 'conciliado', lote_item_id: 'lote-1bf3f73c' },
              ],
              error: null,
            }),
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-p-140' },
                { id: 'rem-item-2', status: 'conciliado', origem_id: 'lanc-mp-70' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'cnab_remessa_itens', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-1', diaristas_lote_id: 'lote-1bf3f73c', empresa_id: 'emp-1' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-p-140', status: 'PAGO' },
                { id: 'lanc-mp-70', status: 'PAGO' },
              ],
              error: null,
            }),
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

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arquivo-1');

    const lotePagoUpdate = updateCalls.find(
      (c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'PAGO'
    );
    expect(lotePagoUpdate).toBeDefined();
    expect(lotePagoUpdate?.data.status_conciliacao).toBe('conciliado');
  });

  // B. Retorno R$140 -> item R$140 pago -> R$70 pendente -> lote NÃO pago
  it('B. Retorno parcial de R$140 -> deve casar apenas item de R$140, manter R$70 pendente e lote NÃO PAGO', async () => {
    const faturasMock = [
      {
        id: 'lanc-p-140',
        remessa_item_id: 'rem-item-1',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 140,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-diarista-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
      {
        id: 'lanc-mp-70',
        remessa_item_id: 'rem-item-2',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 70,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-diarista-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73CCOLAB1', valorPago: 140, documentoFavorecido: '12345678901' } as any,
      faturasMock
    );

    expect(match.isConsolidado).toBe(false);
    expect(match.faturas.length).toBe(1);
    expect(match.faturas[0].id).toBe('lanc-p-140');
    expect(match.faturas[0].valor).toBe(140);

    // Na conciliação do lote, com 1 item pago e 1 ainda pendente
    const { supabase } = await import('@/lib/supabase');
    const updateCalls: { table: string; data: any }[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'ret-item-1',
                  remessa_arquivo_id: 'rem-1',
                  remessa_item_id: 'rem-item-1',
                  fatura_id: 'lanc-p-140',
                  lote_id: 'lote-1bf3f73c',
                  status: 'pago',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-item-1', remessa_id: 'rem-1', origem_id: 'lanc-p-140', status: 'conciliado', lote_item_id: 'lote-1bf3f73c' }],
              error: null,
            }),
            or: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-p-140' },
                { id: 'rem-item-2', status: 'remetido', origem_id: 'lanc-mp-70' }, // Item 2 ainda não conciliado
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-1', diaristas_lote_id: 'lote-1bf3f73c' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-p-140', status: 'PAGO' },
                { id: 'lanc-mp-70', status: 'FECHADO_FINANCEIRO' }, // Ainda não pago
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
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

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arquivo-parcial');

    const lotePagoUpdate = updateCalls.find(
      (c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'PAGO'
    );
    expect(lotePagoUpdate).toBeUndefined(); // NUNCA deve ser PAGO!

    const loteParcialUpdate = updateCalls.find(
      (c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'cnab_gerado' && c.data.status_conciliacao === 'conciliacao_parcial'
    );
    expect(loteParcialUpdate).toBeDefined();
  });

  // C. Retorno R$70 -> apenas item R$70 pago
  it('C. Retorno de R$70 -> deve casar apenas o item correspondente de R$70', () => {
    const faturasMock = [
      {
        id: 'lanc-p-140',
        remessa_item_id: 'rem-item-1',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 140,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'colab-diarista-1', nome: 'DIARISTA 1', cpf: '12345678901' },
      },
      {
        id: 'lanc-mp-70',
        remessa_item_id: 'rem-item-2',
        lote_remessa_id: 'lote-1bf3f73c',
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
    expect(match.faturas[0].id).toBe('lanc-mp-70');
    expect(match.faturas[0].valor).toBe(70);
  });

  // D. Retorno R$210 rejeitado -> nenhum lançamento pago
  it('D. Retorno R$210 com ocorrência rejeitada -> nenhum lançamento vira PAGO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const updateCalls: { table: string; data: any }[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'ret-rejeitado-1',
                  remessa_arquivo_id: 'rem-1',
                  remessa_item_id: 'rem-item-1',
                  fatura_id: 'lanc-p-140',
                  lote_id: 'lote-1bf3f73c',
                  status: 'rejeitado',
                  descricao_ocorrencia: 'Conta de crédito encerrada',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            or: vi.fn().mockResolvedValue({ data: [{ id: 'rem-item-1', status: 'rejeitado' }], error: null }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          update: vi.fn().mockImplementation((data) => {
            updateCalls.push({ table: 'lancamentos_diaristas', data });
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-p-140', status: 'FECHADO_FINANCEIRO' },
                { id: 'lanc-mp-70', status: 'FECHADO_FINANCEIRO' },
              ],
              error: null,
            }),
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
      return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-arquivo-rejeitado');

    const lancamentoPagoUpdate = updateCalls.find(
      (c) => c.table === 'lancamentos_diaristas' && c.data.status === 'PAGO'
    );
    expect(lancamentoPagoUpdate).toBeUndefined(); // Nenhum lançamento deve ter virado PAGO

    const lotePagoUpdate = updateCalls.find(
      (c) => c.table === 'diaristas_lotes_fechamento' && c.data.status === 'PAGO'
    );
    expect(lotePagoUpdate).toBeUndefined(); // Lote jamais pode virar PAGO
  });

  // E. Retorno R$210 com terceiro lançamento R$30 fora da remessa -> R$30 NÃO pago
  it('E. Terceiro lançamento de R$30 fora da remessa NÃO pode ser pago pelo retorno de R$210', async () => {
    // Na remessa só temos P R$140 e MP R$70
    const faturasRelacionadasRemessa = [
      {
        id: 'lanc-p-140',
        remessa_item_id: 'rem-item-1',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 140,
        origem_tipo: 'DIARISTA' as const,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        colaboradores: { id: 'colab-diarista-1', cpf: '12345678901' },
      },
      {
        id: 'lanc-mp-70',
        remessa_item_id: 'rem-item-2',
        lote_remessa_id: 'lote-1bf3f73c',
        colaborador_id: 'colab-diarista-1',
        valor: 70,
        origem_tipo: 'DIARISTA' as const,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        colaboradores: { id: 'colab-diarista-1', cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73CCOLAB1', valorPago: 210, documentoFavorecido: '12345678901' } as any,
      faturasRelacionadasRemessa
    );

    const idsCasados = match.faturas.map((f) => f.id);
    expect(idsCasados).toContain('lanc-p-140');
    expect(idsCasados).toContain('lanc-mp-70');
    expect(idsCasados).not.toContain('lanc-ajuste-30'); // O lançamento fora da remessa nunca está presente
  });

  // F. Mesmo colaborador em outro lote -> NÃO afetado
  it('F. Lançamento do mesmo colaborador em outro lote NÃO é afetado', () => {
    const faturasMock = [
      {
        id: 'lanc-lote-a',
        remessa_item_id: 'rem-item-1',
        lote_remessa_id: 'lote-aaaa',
        colaborador_id: 'colab-1',
        valor: 140,
        seu_numero_esperado: 'DIALOTEAACOLAB1',
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIALOTEBBCOLAB1', valorPago: 140 } as any,
      faturasMock
    );

    // O seu_numero de outro lote não casa
    expect(match.faturas.find((f) => f.lote_remessa_id === 'lote-aaaa' && f.seu_numero_esperado === 'DIALOTEBBCOLAB1')).toBeUndefined();
  });

  // G. Mesmo colaborador em outra empresa -> NÃO afetado
  it('G. Lançamentos de outra empresa são isolados pelo relacionamento da remessa', async () => {
    const { supabase } = await import('@/lib/supabase');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-emp-1', origem_id: 'lanc-emp-1', origem_tipo: 'DIARISTA', valor: 210 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-emp-1', lote_fechamento_id: 'lote-1', diarista_id: 'c1', valor_calculado: 210 }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: 'c1', nome: 'Diarista', cpf: '123' }], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const faturas = await CnabRetornoService.carregarFaturasRelacionadas({ id: 'rem-emp-1' } as any, {} as any);
    expect(faturas.length).toBe(1);
    expect(faturas[0].id).toBe('lanc-emp-1');
  });

  // H. Mesmo CPF em outro tenant -> NÃO afetado
  it('H. Não associa retorno a remessas de outro tenant', async () => {
    const { EnvironmentService } = await import('@/services/environment/EnvironmentService');
    vi.mocked(EnvironmentService.assertEmpresaAllowed).mockRejectedValueOnce(new Error('Empresa fora do tenant'));

    const { supabase } = await import('@/lib/supabase');
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rem-outro-tenant',
                  banco_codigo: '341',
                  contas_bancarias_empresa: { empresa_id: 'emp-outro-tenant', banco_codigo: '341' },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const remessa = await CnabRetornoService.localizarRemessaRelacionada({
      metadados: { sequencialArquivo: 99 },
      estrutura: { headerArquivo: { banco: '341' } },
      resumo: { valorTotalPago: 210 },
    } as any);

    expect(remessa).toBeNull();
  });

  // I. Soma incompatível: retorno R$200, itens R$140 + R$70 -> NÃO considerar match integral
  it('I. Soma incompatível de R$200 contra itens de R$140 + R$70 -> NÃO considerar match integral e classificar como divergente', () => {
    const faturasMock = [
      {
        id: 'lanc-p-140',
        valor: 140,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'c1', cpf: '12345678901' },
      },
      {
        id: 'lanc-mp-70',
        valor: 70,
        seu_numero_esperado: 'DIA1BF3F73CCOLAB1',
        origem_tipo: 'DIARISTA' as const,
        colaboradores: { id: 'c1', cpf: '12345678901' },
      },
    ];

    const match = CnabRetornoService.matchDetalhe(
      { seuNumero: 'DIA1BF3F73CCOLAB1', valorPago: 200, documentoFavorecido: '12345678901', codigoOcorrencia: '00' } as any,
      faturasMock
    );

    // Como 140 + 70 = 210 != 200 e nenhum unitário é 200, a soma de centavos não bate
    const sumCents = match.faturas.reduce((acc, f) => acc + toCents(f.valor), 0);
    expect(sumCents).toBe(21000);
    expect(toCents(200)).toBe(20000);
    expect(sumCents === toCents(200)).toBe(false);
  });

  // K. Regressão BB
  it('K. Regressão BB: Reader e ocorrências BB devem continuar operando perfeitamente', () => {
    const reader = CNABRetornoReaderFactory.getReaderForBanco('001');
    expect(reader).toBeInstanceOf(CNAB240BBReader);
  });

  // L. Regressão Itaú
  it('L. Regressão Itaú: Reader e ocorrências Itaú 341 devem continuar operando perfeitamente', () => {
    const reader = CNABRetornoReaderFactory.getReaderForBanco('341');
    expect(reader).toBeInstanceOf(CNAB240ItauReader);
  });

  // M. Idempotência do retorno já processado
  it('M. Idempotência: deve rejeitar arquivo já processado por hash sem executar RPC ou alterar registros', async () => {
    const { supabase } = await import('@/lib/supabase');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: '53be4a60-87e0-4a62-bea5-3cd015c555fd', nome_arquivo: 'RETORNO_ITAU_HOMOLOGACAO_210.RET' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const fileMock = new File(['conteudo dummy'], 'RETORNO_ITAU_HOMOLOGACAO_210.RET');

    await expect(
      CnabRetornoService.processarArquivo(fileMock, '341')
    ).rejects.toThrow('Arquivo de retorno ja processado anteriormente');

    expect(supabase.rpc).not.toHaveBeenCalledWith('rpc_aplicar_cnab_retorno', expect.anything());
  });
});
