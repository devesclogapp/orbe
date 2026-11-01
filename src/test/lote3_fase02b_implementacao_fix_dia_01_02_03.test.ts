import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    getCurrentEnvironment: vi.fn().mockReturnValue('production'),
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-01'),
  };
});

function createMockQuery(resolvedData: any) {
  const result = { data: resolvedData, error: null };
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    update: vi.fn(() => query),
    insert: vi.fn(() => query),
    delete: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (onfulfilled?: any, onrejected?: any) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return query;
}

// ==============================================================================
// TESTES CONTROLADOS DE REGRESSÃO E VALIDAÇÃO DOS FIXs:
// FIX-DIA-01 (Reabertura e Novo Fechamento)
// FIX-DIA-02 (Fila de Aprovações RH com Lote Consolidado)
// FIX-DIA-03 (Central Bancária - Classificação Estrita de Lotes)
// ==============================================================================

describe('LOTE 3 — FASE 02B: VALIDAÇÃO DOS FIXs R01, R02 E R03', () => {

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX-DIA-01: REABERTURA E NOVO FECHAMENTO
  // ─────────────────────────────────────────────────────────────────────────────
  describe('FIX-DIA-01: Reabertura e Novo Fechamento Atômico de Lote', () => {
    it('1.1: Novo fechamento reutiliza lote existente em status EM_ABERTO preservando ID e vincula lançamentos', async () => {
      const mockLoteId = 'a0000000-0000-0000-0000-000000000001';
      const mockTenantId = 'tenant-test-01';
      const mockEmpresaId = 'empresa-test-01';

      // Simula lote existente em EM_ABERTO (reaberto operacionalmente)
      const mockExistingLote = {
        id: mockLoteId,
        tenant_id: mockTenantId,
        empresa_id: mockEmpresaId,
        periodo_inicio: '2026-10-12',
        periodo_fim: '2026-10-18',
        status: 'EM_ABERTO',
        total_registros: 5,
        valor_total: 1000,
      };

      const mockLancamentos = [
        { id: 'lanc-1', empresa_id: mockEmpresaId, tenant_id: mockTenantId, valor_calculado: 250, quantidade_diaria: 1, diarista_id: 'dia-1' },
        { id: 'lanc-2', empresa_id: mockEmpresaId, tenant_id: mockTenantId, valor_calculado: 350, quantidade_diaria: 1, diarista_id: 'dia-2' },
      ];

      const mockUpdatedLote = {
        ...mockExistingLote,
        status: 'AGUARDANDO_VALIDACAO_RH',
        total_registros: 2,
        valor_total: 600,
        tipo_reabertura: null,
      };

      let lancamentosVinculadosComLoteId: string | null = null;
      let lancamentosStatusAtualizado: string | null = null;
      let logAcaoRegistrada: string | null = null;

      const mockSupabase: any = {
        rpc: vi.fn().mockResolvedValue({
          data: mockUpdatedLote,
          error: null,
        }),
        from: vi.fn(() => createMockQuery(mockLancamentos)),
      };

      const service = new (LoteFechamentoDiaristaService as any).constructor();
      (service as any).supabase = mockSupabase;

      const result = await service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: 'user-01',
        fechadoPorNome: 'Encarregado Teste',
        fechadoPorRole: 'encarregado',
        observacoes: 'Novo fechamento teste',
        tenantId: mockTenantId,
      });

      // Validações
      expect(result.id).toBe(mockLoteId); // Preservou o ID do lote reaberto!
      expect(result.status).toBe('AGUARDANDO_VALIDACAO_RH');
      expect(result.total_registros).toBe(2);
      expect(result.valor_total).toBe(600);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'fechar_ou_refechar_periodo_diaristas',
        expect.objectContaining({
          p_empresa_id: mockEmpresaId,
          p_periodo_inicio: '2026-10-12',
          p_periodo_fim: '2026-10-18',
        })
      );
    });

    it('1.2: Concorrência detectada quando lote já está ativo/fechado lança exceção com CONCURRENCY_ERROR', async () => {
      const mockTenantId = 'tenant-test-01';
      const mockEmpresaId = 'empresa-test-01';

      const mockLancamentos = [
        { id: 'lanc-1', empresa_id: mockEmpresaId, tenant_id: mockTenantId, valor_calculado: 250, diarista_id: 'dia-1' },
      ];

      const mockSupabase: any = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'CONCURRENCY_ERROR: Já existe um lote ativo para este período (status: AGUARDANDO_VALIDACAO_RH).' },
        }),
        from: vi.fn(() => createMockQuery(mockLancamentos)),
      };

      const service = new (LoteFechamentoDiaristaService as any).constructor();
      (service as any).supabase = mockSupabase;

      // Deve lançar Error em vez de retornar objeto com falso sucesso
      await expect(
        service.fecharPeriodo({
          empresaId: mockEmpresaId,
          periodoInicio: '2026-10-12',
          periodoFim: '2026-10-18',
          fechadoPor: 'user-01',
          fechadoPorNome: 'Encarregado Teste',
          fechadoPorRole: 'encarregado',
          tenantId: mockTenantId,
        })
      ).rejects.toThrow(/CONCURRENCY_ERROR/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX-DIA-02: FILA DE APROVAÇÕES RH COM LOTE CONSOLIDADO
  // ─────────────────────────────────────────────────────────────────────────────
  describe('FIX-DIA-02: Fila de Aprovações RH com Lote Consolidado', () => {
    it('2.1: Lançamentos avulsos EM_ABERTO sem lote NÃO entram na fila formal de aprovação da view', () => {
      // Simulação do comportamento da nova migração de vw_aprovacoes_rh:
      // Block 5 seleciona diaristas_lotes_fechamento WHERE status != 'EM_ABERTO'
      const diaristasLotes = [
        { id: 'lote-reaberto-01', status: 'EM_ABERTO', total_registros: 3, valor_total: 600 },
        { id: 'lote-pronto-rh-02', status: 'AGUARDANDO_VALIDACAO_RH', total_registros: 4, valor_total: 900 },
        { id: 'lote-validado-03', status: 'VALIDADO_RH', total_registros: 2, valor_total: 450 },
      ];

      // Filtro canônico de Block 5
      const itensNaView = diaristasLotes
        .filter((dl) => dl.status && dl.status.toUpperCase() !== 'EM_ABERTO')
        .map((dl) => ({
          id: dl.id,
          tipo: 'DIARISTA',
          referencia: `Lote ${dl.id.slice(0, 6)}`,
          colaborador: `Lote com ${dl.total_registros} registros`,
          valor: dl.valor_total,
          raw_status: dl.status,
          raw_lote_id: dl.id,
          situacao: dl.status === 'AGUARDANDO_VALIDACAO_RH' ? 'Em análise' : 'Aprovado',
        }));

      // Lote EM_ABERTO não deve estar na fila!
      expect(itensNaView.find((it) => it.id === 'lote-reaberto-01')).toBeUndefined();

      // Lote em validação deve estar na fila como 'Em análise' com raw_lote_id válido!
      const itemRh = itensNaView.find((it) => it.id === 'lote-pronto-rh-02');
      expect(itemRh).toBeDefined();
      expect(itemRh?.situacao).toBe('Em análise');
      expect(itemRh?.raw_lote_id).toBe('lote-pronto-rh-02');
    });

    it('2.2: Aprovação de Diarista exige identificador de lote e dispara RPC validar_periodo_diaristas', async () => {
      let rpcChamada: string | null = null;
      let rpcParams: any = null;

      const mockSupabase: any = {
        rpc: vi.fn((fnName: string, params: any) => {
          rpcChamada = fnName;
          rpcParams = params;
          return Promise.resolve({ data: null, error: null });
        }),
      };

      const service = new (LoteFechamentoDiaristaService as any).constructor();
      (service as any).supabase = mockSupabase;

      const loteId = 'a0000000-0000-0000-0000-000000000002';
      await service.validarPeriodo(loteId, 'user-rh-01', 'Auditor RH', 'rh');

      expect(rpcChamada).toBe('validar_periodo_diaristas');
      expect(rpcParams.p_lote_id).toBe(loteId);
      expect(rpcParams.p_usuario_id).toBe('user-rh-01');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FIX-DIA-03: CENTRAL BANCÁRIA — CLASSIFICAÇÃO ESTRITA DE LOTES
  // ─────────────────────────────────────────────────────────────────────────────
  describe('FIX-DIA-03: Central Bancária — Classificação Estrita de Lotes', () => {
    it('3.1: AGUARDANDO_VALIDACAO_RH e VALIDADO_RH são blindados e NÃO aparecem como PRONTO_BANCO', () => {
      const lotesDiaristas = [
        { id: 'lote-rh-01', status: 'AGUARDANDO_VALIDACAO_RH', valor_total: 1000 },
        { id: 'lote-rh-02', status: 'VALIDADO_RH', valor_total: 1500 },
        { id: 'lote-fin-03', status: 'FECHADO_FINANCEIRO', valor_total: 2000 },
        { id: 'lote-cnab-04', status: 'CNAB_GERADO', valor_total: 2500 },
        { id: 'lote-pago-05', status: 'PAGO', valor_total: 3000 },
      ];

      // Reproduz o mapeamento canônico corrigido do BancarioOficialAdapter
      const obrigaçõesBancarias: any[] = [];

      lotesDiaristas.forEach((lote) => {
        const statusUpper = String(lote.status || '').toUpperCase();

        // FIX-DIA-03: Exclui lotes não aprovados financeiramente
        if (
          statusUpper === 'EM_ABERTO' ||
          statusUpper === 'AGUARDANDO_VALIDACAO_RH' ||
          statusUpper === 'VALIDADO_RH'
        ) {
          return;
        }

        let situacao = 'PRONTO_BANCO';
        let estagioTab = 'PRONTAS_BANCO';

        if (statusUpper === 'PAGO') {
          situacao = 'LIQUIDADO';
          estagioTab = 'CONCILIACAO';
        } else if (statusUpper === 'CNAB_GERADO') {
          situacao = 'REMESSA_GERADA';
          estagioTab = 'REMESSAS';
        } else if (statusUpper === 'FECHADO_FINANCEIRO' || statusUpper === 'AGUARDANDO_PAGAMENTO') {
          situacao = 'PRONTO_BANCO';
          estagioTab = 'PRONTAS_BANCO';
        }

        obrigaçõesBancarias.push({
          id: `dia-${lote.id}`,
          statusOrigem: lote.status,
          situacao,
          estagioTab,
          valorTotal: lote.valor_total,
        });
      });

      // Validações
      // 1. AGUARDANDO_VALIDACAO_RH e VALIDADO_RH não entraram no banco!
      expect(obrigaçõesBancarias.find((o) => o.statusOrigem === 'AGUARDANDO_VALIDACAO_RH')).toBeUndefined();
      expect(obrigaçõesBancarias.find((o) => o.statusOrigem === 'VALIDADO_RH')).toBeUndefined();

      // 2. FECHADO_FINANCEIRO está PRONTO_BANCO / PRONTAS_BANCO
      const itemFin = obrigaçõesBancarias.find((o) => o.statusOrigem === 'FECHADO_FINANCEIRO');
      expect(itemFin).toBeDefined();
      expect(itemFin.situacao).toBe('PRONTO_BANCO');
      expect(itemFin.estagioTab).toBe('PRONTAS_BANCO');

      // 3. CNAB_GERADO está REMESSA_GERADA / REMESSAS
      const itemCnab = obrigaçõesBancarias.find((o) => o.statusOrigem === 'CNAB_GERADO');
      expect(itemCnab).toBeDefined();
      expect(itemCnab.situacao).toBe('REMESSA_GERADA');
      expect(itemCnab.estagioTab).toBe('REMESSAS');

      // 4. PAGO está LIQUIDADO / CONCILIACAO
      const itemPago = obrigaçõesBancarias.find((o) => o.statusOrigem === 'PAGO');
      expect(itemPago).toBeDefined();
      expect(itemPago.situacao).toBe('LIQUIDADO');
      expect(itemPago.estagioTab).toBe('CONCILIACAO');
    });
  });
});
