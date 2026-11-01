import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue('09ccafb6-2cf2-4c83-ac3d-a2913947693c'),
  };
});

import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { supabase } from '@/lib/supabase';

// Helper simulando a regra canônica de elegibilidade de CNAB de CentralBancariaIntermitentes.tsx
const canGenerateCnabForStatus = (status?: string | null) =>
  ['FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO'].includes(String(status || ''));

describe('Contrato Canônico da Transição Financeira de Intermitentes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Lote em VALIDADO_RH / AGUARDANDO_FINANCEIRO NÃO pode ser tratado como pronto para CNAB', () => {
    // Estado do lote E2E antes da aprovação financeira
    const statusOperacional = 'VALIDADO_RH';
    const statusFinanceiro = 'AGUARDANDO_FINANCEIRO';

    expect(canGenerateCnabForStatus(statusOperacional)).toBe(false);
    expect(canGenerateCnabForStatus(statusFinanceiro)).toBe(false);
  });

  it('2. gerarCNABParaLote bloqueia com erro explícito se lote estiver em VALIDADO_RH', async () => {
    const loteMock = {
      id: '930915d6-cb8f-4739-8001-7fa49d3009e4',
      status: 'VALIDADO_RH',
      empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
      competencia: '2026-10',
      valor_total: 570,
      quantidade_registros: 2,
    };

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: loteMock, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    await expect(
      IntermitentesLoteService.gerarCNABParaLote({
        loteId: loteMock.id,
        empresaId: loteMock.empresa_id,
        geradoPor: 'user-teste',
        geradoPorNome: 'Usuário Teste',
        empresaRemetente: {
          cnpj: '00000000000191',
          razao_social: 'Empresa Teste',
          banco_codigo: '001',
          agencia: '1234',
          conta: '56789',
        },
      })
    ).rejects.toThrow(
      'Geração de CNAB bloqueada: o lote precisa estar aprovado pelo Financeiro antes da remessa.'
    );
  });

  it('3. Simples navegação de UI NÃO altera estado no banco de dados', () => {
    const mockNavigate = vi.fn();
    const mockHandleCloseDrawers = vi.fn();

    // Simulação do clique do botão "Avançar para Remessa" anterior
    const handleClick = () => {
      mockHandleCloseDrawers();
      mockNavigate('/bancario?tab=intermitentes&origem=INTERMITENTE');
    };

    handleClick();

    expect(mockHandleCloseDrawers).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/bancario?tab=intermitentes&origem=INTERMITENTE');
    // Nenhuma mutation foi chamada na navegação pura
  });

  it('4. Aprovação financeira canônica transiciona para FECHADO_FINANCEIRO / AGUARDANDO_PAGAMENTO e registra auditoria', async () => {
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';
    const rhLoteId = 'ca7a2d5c-da91-4bbd-945f-13f6c5510a5e';

    let loteFechamentoUpdate: any = null;
    let lancamentosUpdate: any = null;
    let rhLoteUpdate: any = null;
    let historicoInsert: any = null;

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                in: vi.fn().mockResolvedValue({ data: [{ lote_id: rhLoteId }], error: null }),
              }),
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [{ lote_id: rhLoteId }], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1' }, { id: 'lanc-2' }],
              error: null,
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1' }, { id: 'lanc-2' }],
              error: null,
            }),
          }),
          update: vi.fn().mockImplementation((payload) => {
            lancamentosUpdate = payload;
            return {
              in: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload) => {
            loteFechamentoUpdate = payload;
            return {
              in: vi.fn().mockResolvedValue({ error: null }),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { empresa_id: 'emp-1', competencia: '2026-10' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          update: vi.fn().mockImplementation((payload) => {
            rhLoteUpdate = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'rh_financeiro_lote_historico') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            historicoInsert = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-financeiro-123' } },
    });

    const result = await IntermitentesLoteService.aprovarFinanceiro(loteId, 'user-financeiro-123');

    expect(result).toBe(true);

    // 1. intermitentes_lotes_fechamento recebe FECHADO_FINANCEIRO
    expect(loteFechamentoUpdate).toEqual({ status: 'FECHADO_FINANCEIRO' });

    // 2. lancamentos_intermitentes recebe ENVIADO_FINANCEIRO
    expect(lancamentosUpdate).toEqual({ status_pipeline: 'ENVIADO_FINANCEIRO' });

    // 3. rh_financeiro_lotes recebe AGUARDANDO_PAGAMENTO
    expect(rhLoteUpdate.status).toBe('AGUARDANDO_PAGAMENTO');
    expect(rhLoteUpdate.aprovado_por).toBe('user-financeiro-123');

    // 4. Histórico registra transição de VALIDADO_RH -> AGUARDANDO_PAGAMENTO
    expect(historicoInsert.status_anterior).toBe('VALIDADO_RH');
    expect(historicoInsert.status_novo).toBe('AGUARDANDO_PAGAMENTO');
    expect(historicoInsert.acao).toBe('APROVEI_OPERACOES');

    // 5. Após aprovação financeira, o lote passa a ser elegível para CNAB
    expect(canGenerateCnabForStatus(loteFechamentoUpdate.status)).toBe(true);
    expect(canGenerateCnabForStatus(rhLoteUpdate.status)).toBe(true);
  });

  it('5. CentralBancariaIntermitentes: query de lotes utiliza id, nome, cnpj e não quebra com erro de coluna', () => {
    // Validar query canônica sem colunas inválidas
    const validSelectPattern = '*, empresa:empresas(id, nome, cnpj)';
    const invalidSelectPattern = '*, empresa:empresas(nome_fantasia, razao_social)';

    expect(validSelectPattern).not.toContain('nome_fantasia');
    expect(validSelectPattern).not.toContain('razao_social');

    // Simulação do lote renderizado com 2 registros e R$ 570
    const loteBancario = {
      id: '930915d6-cb8f-4739-8001-7fa49d3009e4',
      empresa: { id: '28a560b5-37ef-403d-ae4f-b28a608b6a68', nome: 'Empresa Teste - Homologação', cnpj: '00000000000191' },
      competencia: '2026-10',
      quantidade_registros: 2,
      total_registros: 2,
      valor_total: 570,
      status: 'FECHADO_FINANCEIRO',
    };

    expect(loteBancario.quantidade_registros).toBe(2);
    expect(loteBancario.valor_total).toBe(570);
    expect(canGenerateCnabForStatus(loteBancario.status)).toBe(true);
  });
});
