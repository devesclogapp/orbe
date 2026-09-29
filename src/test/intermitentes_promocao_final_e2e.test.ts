import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { buildIntermitentesStages } from '@/pages/Financeiro/CentralBancariaIntermitentes';
import {
  getRhStatusBadge,
  getFinanceiroStatusBadge,
  getSituacaoBadge,
  getLoteDrawerBadge,
  getDrawerFooterActions,
  getIntermitentesPipelineStages,
  getIntermitentesTimelineSteps,
} from '@/pages/Operacional/IntermitentesLotes';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-tester-id' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-test-uuid', userId: 'usr-tester-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-tester-id', tenant_id: 'tenant-test-uuid' }),
  };
});

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    getCurrentEnvironment: vi.fn().mockReturnValue('HOMOLOGACAO'),
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
  },
}));

describe('PROMOÇÃO FINAL INTERMITENTES — TESTES E2E E REGRAS DE INTEGRIDADE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. CNAB_GERADO + conciliação parcial → continua CNAB_GERADO
  it('1. CNAB_GERADO + conciliação parcial mantém lote em CNAB_GERADO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    let loteStatusAtualizado: string | null = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ret-arq-parcial', remessa_id: 'rem-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', valor_pago: 240, origem_id: 'lanc-1', intermitentes_lote_id: loteId },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'rem-item-1', status: 'conciliado', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-1', lote_item_id: loteId },
                  { id: 'rem-item-2', status: 'remetido', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-2', lote_item_id: loteId },
                ],
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' },
                { id: 'rem-item-2', status: 'remetido', origem_id: 'lanc-2' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-1', status_pipeline: 'PAGO' },
                { id: 'lanc-2', status_pipeline: 'ENVIADO_FINANCEIRO' }, // Apenas 1 de 2 pago!
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            loteStatusAtualizado = payload.status;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-parcial');
    expect(res.success).toBe(true);
    expect(loteStatusAtualizado).toBe('CNAB_GERADO');
  });

  // 2. CNAB_GERADO + todos os lançamentos PAGO + todos os itens conciliados → lote PAGO (sem paid_at)
  it('2. CNAB_GERADO + quitação integral promove lote para PAGO sem paid_at e com updated_at', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    let loteUpdatePayload: any = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ret-arq-total', remessa_id: 'rem-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', valor_pago: 240, origem_id: 'lanc-1', intermitentes_lote_id: loteId },
                { id: 'ret-item-2', status: 'pago', valor_pago: 330, origem_id: 'lanc-2', intermitentes_lote_id: loteId },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'rem-item-1', status: 'conciliado', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-1', lote_item_id: loteId },
                  { id: 'rem-item-2', status: 'conciliado', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-2', lote_item_id: loteId },
                ],
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' },
                { id: 'rem-item-2', status: 'conciliado', origem_id: 'lanc-2' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-1', status_pipeline: 'PAGO' },
                { id: 'lanc-2', status_pipeline: 'PAGO' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            loteUpdatePayload = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ lote_id: 'rh-fin-lote-1' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-total');
    expect(res.success).toBe(true);
    expect(loteUpdatePayload).toBeDefined();
    expect(loteUpdatePayload.status).toBe('PAGO');
    expect(loteUpdatePayload.updated_at).toBeDefined();
    // NÃO pode conter paid_at pois não existe no schema
    expect(loteUpdatePayload).not.toHaveProperty('paid_at');
  });

  // 3. lote PAGO → espelho financeiro PAGO
  it('3. Lote promovido a PAGO sincroniza espelho rh_financeiro_lotes sem violar constraint de rh_financeiro_lote_itens', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    let rhLoteUpdatePayload: any = null;
    let rhItensUpdateAttempted = false;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ret-arq-total', remessa_id: 'rem-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', valor_pago: 240, origem_id: 'lanc-1', intermitentes_lote_id: loteId },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'rem-item-1', status: 'conciliado', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-1', lote_item_id: loteId },
                ],
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1', status_pipeline: 'PAGO' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ lote_id: 'ca7a2d5c-da91-4bbd-945f-13f6c5510a5e' }],
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockImplementation(() => {
            rhItensUpdateAttempted = true;
            return {
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            rhLoteUpdatePayload = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-total');
    expect(res.success).toBe(true);
    expect(rhLoteUpdatePayload).toBeDefined();
    expect(rhLoteUpdatePayload.status).toBe('PAGO');
    expect(rhLoteUpdatePayload.updated_at).toBeDefined();
    // Confirma que rh_financeiro_lote_itens NÃO sofreu tentativa de update indevido
    expect(rhItensUpdateAttempted).toBe(false);
  });

  // 4. erro no UPDATE do lote → operação não pode aparentar sucesso
  it('4. Falha no UPDATE de intermitentes_lotes_fechamento lança exceção e retorna success: false', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ret-arq-err', remessa_id: 'rem-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', valor_pago: 240, origem_id: 'lanc-1', intermitentes_lote_id: loteId },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'rem-item-1', status: 'conciliado', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-1', lote_item_id: loteId },
                ],
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1', status_pipeline: 'PAGO' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'column "paid_at" of relation "intermitentes_lotes_fechamento" does not exist' },
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-err');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Falha ao atualizar lote de intermitentes');
    expect(res.message).toContain('paid_at');
  });

  // 5. erro na sincronização financeira → deve ser explicitamente detectado
  it('5. Falha na sincronização do espelho rh_financeiro_lotes é detectada e interrompe com erro explícito', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ret-arq-sync-err', remessa_id: 'rem-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-item-1', status: 'pago', valor_pago: 240, origem_id: 'lanc-1', intermitentes_lote_id: loteId },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'rem-item-1', status: 'conciliado', origem_tipo: 'INTERMITENTE', origem_id: 'lanc-1', lote_item_id: loteId },
                ],
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-item-1', status: 'conciliado', origem_id: 'lanc-1' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1', status_pipeline: 'PAGO' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ lote_id: 'rh-lote-bloqueado' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'deadlock detected on relation rh_financeiro_lotes' },
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-sync-err');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Falha ao sincronizar espelho financeiro');
    expect(res.message).toContain('deadlock detected');
  });

  // 6. PAGO → drawer 5/5
  it('6. Lote PAGO ativa todas as 5 etapas como done e isFlowDone: true no Drawer', () => {
    const lotePago: any = {
      id: '930915d6-cb8f-4739-8001-7fa49d3009e4',
      status: 'PAGO',
      fechado_por: 'Encarregado Teste',
      validated_by: 'RH Teste',
      paid_by: 'Retorno Bancário',
    };

    const result = buildIntermitentesStages(lotePago);

    // 5 etapas horizontais
    expect(result.horizontalStages).toHaveLength(5);
    expect(result.horizontalStages.every((s) => s.status === 'done')).toBe(true);

    // 5 etapas verticais da timeline
    expect(result.verticalStages).toHaveLength(5);
    expect(result.verticalStages.every((s) => s.status === 'done')).toBe(true);

    // Fluxo finalizado
    expect(result.isFlowDone).toBe(true);

    // Comparar com CNAB_GERADO que tem 4 done e 1 current (não finalizado)
    const loteCnab: any = {
      id: '930915d6-cb8f-4739-8001-7fa49d3009e4',
      status: 'CNAB_GERADO',
    };
    const resultCnab = buildIntermitentesStages(loteCnab);
    expect(resultCnab.isFlowDone).toBe(false);
    expect(resultCnab.horizontalStages.find((s) => s.id === 'conciliacao')?.status).toBe('current');
  });

  // 7. PAGO → Situação Pago
  it('7. getSituacaoBadge renderiza badge "Pago" com variante visual emerald quando status é PAGO', () => {
    const badgePago = getSituacaoBadge('PAGO');
    expect(badgePago).toBeDefined();
    // Elemento React com children "Pago" e classe bg-emerald-600
    expect(badgePago.props.children).toBe('Pago');
    expect(badgePago.props.className).toContain('bg-emerald-600');

    // CNAB_GERADO deve ser "Aprovado"
    const badgeCnab = getSituacaoBadge('CNAB_GERADO');
    expect(badgeCnab.props.children).toBe('Aprovado');
    expect(badgeCnab.props.className).toContain('bg-emerald-100');
  });

  // 8. PAGO → Status Financeiro Pago/Conciliado
  it('8. getFinanceiroStatusBadge renderiza "Pago / Conciliado" quando status é PAGO', () => {
    const badgeFin = getFinanceiroStatusBadge('PAGO');
    expect(badgeFin).toBeDefined();
    expect(badgeFin.props.className).toContain('bg-emerald-50');
    expect(badgeFin.props.className).toContain('text-emerald-700');

    // Conteúdo contém "Pago / Conciliado"
    const textChildren = badgeFin.props.children;
    const hasPagoText = React.Children.toArray(textChildren).some(
      (child: any) => typeof child === 'string' && child.includes('Pago / Conciliado')
    );
    expect(hasPagoText).toBe(true);
  });

  // 8.1 Defesa na leitura em intermitentes.service.ts
  it('8.1 listarLotes e getLoteDetalhe garantem status_financeiro PAGO para lote operacional PAGO', async () => {
    const { supabase } = await import('@/lib/supabase');
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: loteId,
                  status: 'PAGO',
                  empresa_id: 'emp-1',
                  competencia: '2026-10',
                  quantidade_registros: 2,
                  valor_total: 570,
                },
                error: null,
              }),
            }),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: loteId,
                  status: 'PAGO',
                  empresa_id: 'emp-1',
                  competencia: '2026-10',
                  quantidade_registros: 2,
                  valor_total: 570,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'l1', colaborador_id: 'c1', total: 240, status_pipeline: 'PAGO' },
                  { id: 'l2', colaborador_id: 'c2', total: 330, status_pipeline: 'PAGO' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { status: 'AGUARDANDO_PAGAMENTO' },
          error: null,
        });
        chain.then = (resolve: any) =>
          resolve({
            data: [
              // Simula espelho histórico desatualizado em AGUARDANDO_PAGAMENTO
              { empresa_id: 'emp-1', competencia: '2026-10', status: 'AGUARDANDO_PAGAMENTO' },
            ],
            error: null,
          });
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    // Testar getLoteDetalhe
    const detalhe = await IntermitentesLoteService.getLoteDetalhe(loteId);
    expect(detalhe.status).toBe('PAGO');
    // Defesa: status_financeiro NÃO regride para AGUARDANDO_PAGAMENTO
    expect(detalhe.status_financeiro).toBe('PAGO');
    // Preservação do diagnóstico: divergência detectada
    expect(detalhe.divergencia_financeira).toContain('Espelho financeiro desatualizado (AGUARDANDO_PAGAMENTO)');

    // Testar listarLotes
    const lista = await IntermitentesLoteService.listarLotes({ ano: '2026', mes: '10' });
    expect(lista).toHaveLength(1);
    expect(lista[0].status).toBe('PAGO');
    expect(lista[0].status_financeiro).toBe('PAGO');
    expect(lista[0].divergencia_financeira).toContain('Espelho financeiro desatualizado (AGUARDANDO_PAGAMENTO)');
  });

  // 9. Regressão de Segregação: CLT e Diaristas não sofrem nenhuma alteração
  it('9. Segregação rigorosa: baixa de Diaristas e CLT segue regras independentes sem cruzar domínios', async () => {
    const { supabase } = await import('@/lib/supabase');
    const tablesUpdated: string[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ret-arq-diaristas', remessa_id: 'rem-diaristas' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'ret-diar-1', status: 'pago', valor_pago: 150, diaristas_lote_id: 'lote-diar-1' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'rem-diar-1', status: 'conciliado', origem_tipo: 'DIARISTA', lote_item_id: 'lote-diar-1', origem_id: 'lanc-d-1' },
                ],
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-diar-1', status: 'conciliado', origem_id: 'lanc-d-1' }],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-d-1', status: 'PAGO' }],
              error: null,
            }),
          }),
          update: vi.fn().mockImplementation(() => {
            tablesUpdated.push('lancamentos_diaristas');
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            tablesUpdated.push('diaristas_lotes_fechamento');
            expect(payload.paid_at).toBeDefined(); // Diaristas possui paid_at
            expect(payload.status_conciliacao).toBe('conciliado');
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const res = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-diaristas');
    expect(res.success).toBe(true);

    // Diaristas atualizou suas tabelas
    expect(tablesUpdated).toContain('diaristas_lotes_fechamento');

    // Intermitentes NÃO foi tocado durante conciliação de diaristas
    expect(tablesUpdated).not.toContain('intermitentes_lotes_fechamento');
  });

  // 10. Drawer Header Badge: PAGO exibe badge terminal Pago (verde) e preserva Aprovado RH na listagem
  it('10. getLoteDrawerBadge exibe "Pago" no header do Drawer e preserva "Aprovado RH" na listagem', () => {
    // Drawer Header Badge para PAGO
    const drawerBadge = getLoteDrawerBadge('PAGO');
    expect(drawerBadge).toBeDefined();
    expect(drawerBadge.props.className).toContain('bg-emerald-600');
    expect(drawerBadge.props.className).toContain('text-white');
    const drawerBadgeHasPago = React.Children.toArray(drawerBadge.props.children).some(
      (child: any) => typeof child === 'string' && child.includes('Pago')
    );
    expect(drawerBadgeHasPago).toBe(true);

    // Listagem "Status RH" para lote PAGO continua "Aprovado RH" (preservação obrigatória)
    const rhStatusBadge = getRhStatusBadge('PAGO');
    expect(rhStatusBadge).toBeDefined();
    expect(rhStatusBadge.props.className).toContain('bg-emerald-50');
    expect(rhStatusBadge.props.className).toContain('text-emerald-700');
    const rhBadgeHasAprovadoRh = React.Children.toArray(rhStatusBadge.props.children).some(
      (child: any) => typeof child === 'string' && child.includes('Aprovado RH')
    );
    expect(rhBadgeHasAprovadoRh).toBe(true);
  });

  // 11. Drawer Primário Pipeline: PAGO ativa todas as 5 etapas como done e todos os 4 conectores verdes
  it('11. getIntermitentesPipelineStages ativa todas as 5 etapas como done e todos os 4 conectores verdes para PAGO', () => {
    const pipeline = getIntermitentesPipelineStages('PAGO');
    expect(pipeline.stages).toHaveLength(5);
    expect(pipeline.allCompleted).toBe(true);
    expect(pipeline.stages.every((st) => st.status === 'done')).toBe(true);

    // Conectores verdes
    expect(pipeline.connector1).toBe(true);
    expect(pipeline.connector2).toBe(true);
    expect(pipeline.connector3).toBe(true);
    expect(pipeline.connector4).toBe(true);

    // Nenhum estágio pendente ou em andamento
    expect(pipeline.stages.some((st) => st.status === 'pending')).toBe(false);
    expect(pipeline.stages.some((st) => st.status === 'current')).toBe(false);
    expect(pipeline.stages.some((st) => st.status === 'error')).toBe(false);
  });

  // 12. Drawer Primário Footer CTAs: PAGO não possui nenhum CTA de avanço e mantém Ver fluxo completo
  it('12. getDrawerFooterActions não permite CTA de avanço em lote terminal PAGO e mantém Ver fluxo completo', () => {
    const actions = getDrawerFooterActions('PAGO');
    expect(actions.canAprovarFinanceiro).toBe(false);
    expect(actions.canAvancarRemessa).toBe(false);
    expect(actions.canVerConciliacao).toBe(false);
    expect(actions.hasAvancoAction).toBe(false);
    expect(actions.canVerFluxoCompleto).toBe(true);
  });

  // 13. Drawer Secundário Timeline: PAGO conclui integralmente todas as 6 etapas na timeline com último passo Liquidado
  it('13. getIntermitentesTimelineSteps conclui todas as 6 etapas na timeline secundária para PAGO', () => {
    const steps = getIntermitentesTimelineSteps('PAGO', {
      quantidade_registros: 2,
      valor_total: 570,
      empresa: { nome: 'ESC Log Homologação' },
      validated_at: '2026-09-28T14:00:00Z',
    });

    expect(steps).toHaveLength(6);
    // Todas as etapas com status done
    expect(steps.every((st) => st.state === 'done')).toBe(true);

    // Último passo (Etapa 6) é liquidado
    const step6 = steps[5];
    expect(step6.title).toContain('6. Retorno Bancário & Quitação (PAGO)');
    expect(step6.badgeText).toBe('Concluído (Liquidado)');
    expect(step6.badgeClass).toContain('bg-emerald-600');

    // Etapas 1 a 5 todas concluídas
    for (let i = 0; i < 5; i++) {
      expect(steps[i].badgeText).toBe('Concluído');
      expect(steps[i].badgeClass).toContain('bg-emerald-50');
    }

    // Nenhuma etapa diz "Você está aqui" ou "Pendente" ou "Próxima Etapa"
    expect(steps.some((st) => st.badgeText.includes('Você está aqui'))).toBe(false);
    expect(steps.some((st) => st.badgeText.includes('Pendente'))).toBe(false);
    expect(steps.some((st) => st.badgeText.includes('Próxima Etapa'))).toBe(false);
  });

  // 14. Preservação dos estados intermediários: VALIDADO_RH, FECHADO_FINANCEIRO e CNAB_GERADO
  it('14. Preserva comportamento coerente dos estados intermediários (VALIDADO_RH, FECHADO_FINANCEIRO, CNAB_GERADO)', () => {
    // 14.1 VALIDADO_RH
    const badgeRh = getLoteDrawerBadge('VALIDADO_RH');
    expect(badgeRh.props.children.some((c: any) => typeof c === 'string' && c.includes('Aprovado RH'))).toBe(true);
    const pipeRh = getIntermitentesPipelineStages('VALIDADO_RH');
    expect(pipeRh.allCompleted).toBe(false);
    expect(pipeRh.stages[2].status).toBe('done'); // Validação RH feita
    expect(pipeRh.stages[3].status).toBe('current'); // Financeiro aguardando
    expect(pipeRh.stages[4].status).toBe('pending'); // CNAB pendente
    const actionsRh = getDrawerFooterActions('VALIDADO_RH');
    expect(actionsRh.canAprovarFinanceiro).toBe(true);
    expect(actionsRh.hasAvancoAction).toBe(true);
    const stepsRh = getIntermitentesTimelineSteps('VALIDADO_RH');
    expect(stepsRh[2].badgeText).toContain('Você está aqui');
    expect(stepsRh[3].badgeText).toBe('Próxima Etapa');

    // 14.2 FECHADO_FINANCEIRO / AGUARDANDO_PAGAMENTO
    const badgeFin = getLoteDrawerBadge('FECHADO_FINANCEIRO');
    expect(badgeFin.props.children.some((c: any) => typeof c === 'string' && c.includes('Aprovado Financeiro'))).toBe(true);
    const pipeFin = getIntermitentesPipelineStages('FECHADO_FINANCEIRO');
    expect(pipeFin.allCompleted).toBe(false);
    expect(pipeFin.stages[3].status).toBe('done'); // Financeiro feito
    expect(pipeFin.stages[4].status).toBe('pending'); // CNAB aguardando
    const actionsFin = getDrawerFooterActions('FECHADO_FINANCEIRO');
    expect(actionsFin.canAvancarRemessa).toBe(true);
    expect(actionsFin.hasAvancoAction).toBe(true);
    const stepsFin = getIntermitentesTimelineSteps('FECHADO_FINANCEIRO');
    expect(stepsFin[3].badgeText).toContain('Você está aqui');
    expect(stepsFin[4].badgeText).toBe('Próxima Etapa');

    // 14.3 CNAB_GERADO
    const badgeCnab = getLoteDrawerBadge('CNAB_GERADO');
    expect(badgeCnab.props.children.some((c: any) => typeof c === 'string' && c.includes('Remessa Gerada'))).toBe(true);
    const pipeCnab = getIntermitentesPipelineStages('CNAB_GERADO');
    expect(pipeCnab.allCompleted).toBe(false);
    expect(pipeCnab.stages[3].status).toBe('done');
    expect(pipeCnab.stages[4].status).toBe('current'); // CNAB gerado / aguardando retorno
    const actionsCnab = getDrawerFooterActions('CNAB_GERADO');
    expect(actionsCnab.canVerConciliacao).toBe(true);
    expect(actionsCnab.hasAvancoAction).toBe(true);
    const stepsCnab = getIntermitentesTimelineSteps('CNAB_GERADO');
    expect(stepsCnab[4].badgeText).toContain('Você está aqui');
    expect(stepsCnab[5].badgeText).toBe('Aguardando Retorno');
  });
});
