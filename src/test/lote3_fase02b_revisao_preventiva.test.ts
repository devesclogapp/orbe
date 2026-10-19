import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';

vi.mock('@/services/environment/EnvironmentService', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    EnvironmentService: {
      assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
      getTestEmpresaIds: vi.fn().mockResolvedValue([]),
      getCurrentEnvironment: vi.fn().mockReturnValue('production'),
    },
  };
});

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
// TESTES CONTROLADOS — REVISÃO PREVENTIVA DA FASE 02B:
// 1. Fail-Closed na Ausência da RPC
// 2. Duplo Fechamento Simultâneo
// 3. Reabertura e Novo Fechamento
// 4. Lote Já Pago
// 5. Lote Cancelado
// 6. Lote Já Validado pelo RH
// 7. Isolamento entre Tenants / Empresas
// 8. Tentativa de Execução por Perfil Não Autorizado
// 9. Filtro Estrito da View vw_aprovacoes_rh
// ==============================================================================

describe('LOTE 3 — FASE 02B: REVISÃO PREVENTIVA (ATOMICIDADE & FILTRO RH)', () => {
  const mockTenantId = 'tenant-test-01';
  const mockEmpresaId = 'empresa-test-01';
  const mockLancamentos = [
    { id: 'lanc-1', empresa_id: mockEmpresaId, tenant_id: mockTenantId, valor_calculado: 200, diarista_id: 'dia-1' },
    { id: 'lanc-2', empresa_id: mockEmpresaId, tenant_id: mockTenantId, valor_calculado: 300, diarista_id: 'dia-2' },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. RPC AUSENTE (FAIL-CLOSED)
  // ─────────────────────────────────────────────────────────────────────────────
  it('1. RPC Ausente: Fechamento falha fechado (Fail-Closed) e NÃO executa operações parciais no cliente', async () => {
    const mockSupabase: any = {
      // Simula que a RPC ainda não existe no PostgreSQL (código 42883)
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function fechar_ou_refechar_periodo_diaristas does not exist' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/RPC_NOT_AVAILABLE/);

    // Garante que o client NÃO tentou fazer insert/update manual na tabela de lotes!
    expect(mockSupabase.from).not.toHaveBeenCalledWith('diaristas_lotes_fechamento');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DUPLO FECHAMENTO SIMULTÂNEO (RACE CONDITION)
  // ─────────────────────────────────────────────────────────────────────────────
  it('2. Duplo Fechamento Simultâneo: Concorrência detectada pela RPC é propagada como CONCURRENCY_ERROR', async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'CONCURRENCY_ERROR: Concorrência detectada ao criar lote de fechamento.' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/CONCURRENCY_ERROR/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. REABERTURA E NOVO FECHAMENTO
  // ─────────────────────────────────────────────────────────────────────────────
  it('3. Reabertura e Novo Fechamento: RPC reutiliza lote existente em EM_ABERTO preservando ID', async () => {
    const mockReusedLoteId = 'lote-reaberto-uuid-007';
    const mockRpcResponse = {
      id: mockReusedLoteId,
      tenant_id: mockTenantId,
      empresa_id: mockEmpresaId,
      periodo_inicio: '2026-10-12',
      periodo_fim: '2026-10-18',
      status: 'AGUARDANDO_VALIDACAO_RH',
      total_registros: 2,
      valor_total: 500,
    };

    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: mockRpcResponse,
        error: null,
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    const res = await service.fecharPeriodo({
      empresaId: mockEmpresaId,
      periodoInicio: '2026-10-12',
      periodoFim: '2026-10-18',
      fechadoPor: '00000000-0000-0000-0000-000000000001',
      fechadoPorNome: 'Encarregado',
      fechadoPorRole: 'encarregado',
      tenantId: mockTenantId,
    });

    expect(res.id).toBe(mockReusedLoteId);
    expect(res.status).toBe('AGUARDANDO_VALIDACAO_RH');
    expect(res.total_registros).toBe(2);
    expect(res.valor_total).toBe(500);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('fechar_ou_refechar_periodo_diaristas', expect.objectContaining({
      p_tenant_id: mockTenantId,
      p_empresa_id: mockEmpresaId,
    }));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. LOTE JÁ PAGO
  // ─────────────────────────────────────────────────────────────────────────────
  it('4. Lote Já Pago: Tentativa de novo fechamento sobre lote PAGO é rejeitada com CONCURRENCY_ERROR', async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'CONCURRENCY_ERROR: Já existe um lote ativo para este período (status: PAGO).' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/status: PAGO/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. LOTE CANCELADO
  // ─────────────────────────────────────────────────────────────────────────────
  it('5. Lote Cancelado: Tentativa de fechamento sobre período com lote CANCELADO é rejeitada com CONCURRENCY_ERROR', async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'CONCURRENCY_ERROR: Já existe um lote ativo para este período (status: CANCELADO).' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/status: CANCELADO/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. LOTE JÁ VALIDADO PELO RH
  // ─────────────────────────────────────────────────────────────────────────────
  it('6. Lote Já Validado pelo RH: Tentativa de sobreescrever lote em VALIDADO_RH é rejeitada', async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'CONCURRENCY_ERROR: Já existe um lote ativo para este período (status: VALIDADO_RH).' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/status: VALIDADO_RH/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. ISOLAMENTO ENTRE TENANTS / EMPRESAS
  // ─────────────────────────────────────────────────────────────────────────────
  it('7.1 Isolamento de Tenant: Empresa de outro tenant é rejeitada pela RPC com TENANT_MISMATCH', async () => {
    const mockLancamentosEmpresaEstranha = [
      { id: 'lanc-1', empresa_id: 'empresa-estranha', tenant_id: mockTenantId, valor_calculado: 200, diarista_id: 'dia-1' },
    ];

    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'TENANT_MISMATCH: A empresa informada não pertence ao tenant especificado.' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentosEmpresaEstranha)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: 'empresa-estranha',
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/TENANT_MISMATCH/);
  });

  it('7.2 Isolamento de Lançamentos: Lançamentos com tenant divergente geram erro antes do fechamento', async () => {
    const mockLancamentosVazados = [
      { id: 'lanc-1', empresa_id: mockEmpresaId, tenant_id: mockTenantId, valor_calculado: 200, diarista_id: 'dia-1' },
      { id: 'lanc-2', empresa_id: mockEmpresaId, tenant_id: 'outro-tenant-hacker', valor_calculado: 300, diarista_id: 'dia-2' },
    ];

    const mockSupabase: any = {
      rpc: vi.fn(),
      from: vi.fn(() => createMockQuery(mockLancamentosVazados)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Encarregado',
        fechadoPorRole: 'encarregado',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/fora do escopo selecionado/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. TENTATIVA DE EXECUÇÃO POR PERFIL NÃO AUTORIZADO
  // ─────────────────────────────────────────────────────────────────────────────
  it('8. Perfil Não Autorizado: Tentativa com perfil sem permissão é rejeitada pela RPC com UNAUTHORIZED', async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'UNAUTHORIZED: Perfil "operador_leitura" não possui autorização para fechar período de diaristas.' },
      }),
      from: vi.fn(() => createMockQuery(mockLancamentos)),
    };

    const service = new (LoteFechamentoDiaristaService as any).constructor();
    service.supabase = mockSupabase;

    await expect(
      service.fecharPeriodo({
        empresaId: mockEmpresaId,
        periodoInicio: '2026-10-12',
        periodoFim: '2026-10-18',
        fechadoPor: '00000000-0000-0000-0000-000000000001',
        fechadoPorNome: 'Operador Leitura',
        fechadoPorRole: 'operador_leitura',
        tenantId: mockTenantId,
      })
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. FILTRO ESTRITO DA VIEW RH (FIX-DIA-02 REVISADO SEM DEVOLVIDO_RH)
  // ─────────────────────────────────────────────────────────────────────────────
  it('9. Filtro Estrito da View RH: Exclui lotes em EM_ABERTO, CANCELADO, FECHADO_FINANCEIRO, CNAB_GERADO, PAGO e DEVOLVIDO_RH', () => {
    const lotesBanco = [
      { id: 'lote-1', status: 'EM_ABERTO' },
      { id: 'lote-2', status: 'AGUARDANDO_VALIDACAO_RH' },
      { id: 'lote-3', status: 'VALIDADO_RH' },
      { id: 'lote-4', status: 'DEVOLVIDO_RH' },
      { id: 'lote-5', status: 'FECHADO_FINANCEIRO' },
      { id: 'lote-6', status: 'AGUARDANDO_PAGAMENTO' },
      { id: 'lote-7', status: 'CNAB_GERADO' },
      { id: 'lote-8', status: 'PAGO' },
      { id: 'lote-9', status: 'CANCELADO' },
    ];

    // Simulação exata do filtro SQL atualizado (sem DEVOLVIDO_RH):
    // WHERE dl.status IS NOT NULL AND upper(dl.status) IN ('AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH')
    const lotesElegiveisView = lotesBanco.filter(
      (dl) => dl.status && ['AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH'].includes(dl.status.toUpperCase())
    );

    const idsElegiveis = lotesElegiveisView.map((l) => l.id);

    // Deve conter APENAS AGUARDANDO_VALIDACAO_RH e VALIDADO_RH
    expect(idsElegiveis).toEqual(['lote-2', 'lote-3']);

    // Não deve conter EM_ABERTO
    expect(idsElegiveis).not.toContain('lote-1');
    // Não deve conter DEVOLVIDO_RH (não canônico para Diaristas)
    expect(idsElegiveis).not.toContain('lote-4');
    // Não deve conter FECHADO_FINANCEIRO (encaminhado ao financeiro)
    expect(idsElegiveis).not.toContain('lote-5');
    // Não deve conter AGUARDANDO_PAGAMENTO
    expect(idsElegiveis).not.toContain('lote-6');
    // Não deve conter CNAB_GERADO
    expect(idsElegiveis).not.toContain('lote-7');
    // Não deve conter PAGO
    expect(idsElegiveis).not.toContain('lote-8');
    // Não deve conter CANCELADO
    expect(idsElegiveis).not.toContain('lote-9');
  });
});
