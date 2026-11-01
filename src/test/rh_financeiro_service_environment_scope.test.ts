import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock das dependências de infraestrutura base
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "mock-user-id" } } }) }
  }
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: "tenant-orbe-test-001" }),
    getCurrentTenantId: vi.fn().mockResolvedValue("tenant-orbe-test-001"),
  };
});

import { supabase } from '@/lib/supabase';
import { RHFinanceiroService } from '@/services/rhFinanceiro.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { EnvironmentQueryFilter } from '@/services/environment/EnvironmentQueryFilter';

describe("RHFinanceiroService — Contrato de Environment Scope em Homologação", () => {
  const testEmpresaId = "28a560b5-37ef-403d-ae4f-b28a608b6a68";
  const canonicalLotePago = {
    id: "ca7a2d5c-da91-4bbd-945f-13f6c5510a5e",
    tenant_id: "tenant-orbe-test-001",
    empresa_id: testEmpresaId,
    competencia: "2026-10",
    tipo: "INTERMITENTES",
    origem: "OPERACIONAL",
    status: "PAGO",
    total_colaboradores: 2,
    valor_total: 570.00,
    empresa: { nome: "Empresa Teste - Homologação" }
  };

  let mockQueryChain: any;
  let statusFiltersApplied: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    statusFiltersApplied = [];

    // Forçar ambiente de Homologação no EnvironmentService
    vi.spyOn(EnvironmentService, "getCurrentEnvironment").mockReturnValue("homologacao");
    vi.spyOn(EnvironmentService, "getTestEmpresaIds").mockResolvedValue([testEmpresaId]);

    mockQueryChain = {
      select: vi.fn().mockImplementation(() => mockQueryChain),
      eq: vi.fn().mockImplementation((column: string, value: any) => {
        if (column === "status") {
          statusFiltersApplied.push(value);
        }
        return mockQueryChain;
      }),
      in: vi.fn().mockImplementation(() => mockQueryChain),
      not: vi.fn().mockImplementation(() => mockQueryChain),
      or: vi.fn().mockImplementation(() => mockQueryChain),
      order: vi.fn().mockImplementation(() => mockQueryChain),
      limit: vi.fn().mockResolvedValue({ data: [canonicalLotePago], error: null }),
      then: (resolve: any) => resolve({ data: [canonicalLotePago], error: null })
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { tenant_id: "tenant-orbe-test-001", full_name: "Auditor Teste" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "rh_financeiro_lotes") {
        return mockQueryChain;
      }
      return mockQueryChain;
    });
  });

  describe("1. listLotesRecebidos()", () => {
    it("resolve getTestEmpresaIds e repassa testIds para o EnvironmentQueryFilter sem lançar TypeError", async () => {
      const applyScopeSpy = vi.spyOn(EnvironmentQueryFilter, "applyEmpresaScope");
      const getTestIdsSpy = vi.spyOn(EnvironmentService, "getTestEmpresaIds");

      // Execução do método real
      const lotes = await RHFinanceiroService.listLotesRecebidos("2026-10", testEmpresaId);

      // 1. Garante que getTestEmpresaIds foi resolvido com o tenant correto
      expect(getTestIdsSpy).toHaveBeenCalledWith("tenant-orbe-test-001");

      // 2. Garante que EnvironmentQueryFilter.applyEmpresaScope recebeu options completas incluindo testIds
      expect(applyScopeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId: "tenant-orbe-test-001",
          column: "empresa_id",
          includeNullInProduction: true,
          testIds: [testEmpresaId]
        })
      );

      // 3. Garante que a cláusula .in('empresa_id', [testEmpresaId]) foi acionada
      expect(mockQueryChain.in).toHaveBeenCalledWith("empresa_id", [testEmpresaId]);

      // 4. Garante que o lote retornado não foi filtrado ou perdido
      expect(lotes).toHaveLength(1);
      expect(lotes[0].id).toBe("ca7a2d5c-da91-4bbd-945f-13f6c5510a5e");
    });

    it("lote INTERMITENTES com status PAGO não é excluído por status na consulta", async () => {
      const lotes = await RHFinanceiroService.listLotesRecebidos("2026-10", testEmpresaId);

      // O SQL não deve aplicar nenhum filtro de status que elimine PAGO
      expect(statusFiltersApplied).toHaveLength(0);

      expect(lotes[0].tipo).toBe("INTERMITENTES");
      expect(lotes[0].status).toBe("PAGO");
      expect(lotes[0].valor_total).toBe(570.00);
      expect(lotes[0].empresa.nome).toBe("Empresa Teste - Homologação");
    });
  });

  describe("2. getPendingSummary()", () => {
    it("resolve getTestEmpresaIds e repassa testIds sem falha de testIds.length", async () => {
      const applyScopeSpy = vi.spyOn(EnvironmentQueryFilter, "applyEmpresaScope");
      const getTestIdsSpy = vi.spyOn(EnvironmentService, "getTestEmpresaIds");

      const summary = await RHFinanceiroService.getPendingSummary();

      expect(getTestIdsSpy).toHaveBeenCalledWith("tenant-orbe-test-001");
      expect(applyScopeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId: "tenant-orbe-test-001",
          column: "empresa_id",
          includeNullInProduction: true,
          testIds: [testEmpresaId]
        })
      );

      expect(summary.totalLotes).toBe(1);
      expect(summary.totalValor).toBe(570.00);
      expect(summary.totalColaboradores).toBe(2);
    });
  });
});
