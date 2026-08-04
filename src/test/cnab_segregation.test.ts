import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Core Supabase Mock
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "mock-id" } } }) }
  }
}));

// 2. Base Auth Mock
vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: "mock-tenant", userId: "mock-user", userName: "Mock User" }),
    getCurrentTenantId: vi.fn().mockResolvedValue("mock-tenant"),
  };
});

// 3. Environment Mock
vi.mock('@/services/environment/EnvironmentService', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    EnvironmentService: {
       ...actual.EnvironmentService,
       assertEmpresaAllowed: vi.fn().mockResolvedValue(undefined),
       getCurrentEnvironment: vi.fn().mockReturnValue('PRODUCAO'),
       getTestEmpresaIds: vi.fn().mockResolvedValue(["empresa-hml-1"])
    }
  };
});

import { supabase } from '@/lib/supabase';
import { CNABBase } from '@/services/cnab/CNABBase';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';

describe("CNAB Segregation Tests", () => {
    let selectMock: any;
    let eqMock: any;
    let inMock: any;
    let limitMock: any;
    let maybeSingleMock: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        maybeSingleMock = vi.fn().mockResolvedValue({ data: {}, error: null });
        limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock, single: maybeSingleMock });
        inMock = vi.fn().mockReturnValue({ limit: limitMock });
        eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock, single: maybeSingleMock });
        
        selectMock = vi.fn().mockReturnValue({
            eq: eqMock,
            in: inMock
        });

        const supabaseMock = {
            from: (table: string) => ({
                select: selectMock,
                update: vi.fn().mockReturnValue({
                   in: vi.fn(),
                   eq: vi.fn().mockReturnValue({ in: vi.fn() })
                })
            })
        };

        (supabase.from as any).mockImplementation((table: string) => supabaseMock.from(table));
    });

    it("CNABBase.fetchLoteData - Deve bloquear acesso se was triggered on invalid environment context via Bank Account", async () => {
        // Given an origin account belonging to an unallowed environment
        const erroAmbiente = new Error("Empresa 000-XX pertence a um ambiente diferente e foi barrada.");
        (EnvironmentService.assertEmpresaAllowed as any).mockRejectedValueOnce(erroAmbiente);
        
        // Mock a single response containing an out-of-bounds empresa_id
        maybeSingleMock.mockResolvedValueOnce({ 
           data: { id: "conta-123", empresa_id: "000-XX" }, 
           error: null 
        });

        await expect(CNABBase.fetchLoteData("lote-id", "conta-123")).rejects.toThrow(erroAmbiente);
        expect(EnvironmentService.assertEmpresaAllowed).toHaveBeenCalledWith({
            tenantId: "mock-tenant",
            empresaId: "000-XX"
        });
    });

    it("CNABBase.fetchLoteData - Deve validar o Parent Lote do RH contra o ambiente nativo", async () => {
        // Reset and let Bank Account pass, but Lote RH fail
        (EnvironmentService.assertEmpresaAllowed as any)
             .mockResolvedValueOnce(undefined) // Bank Account passes
             .mockRejectedValueOnce(new Error("Lote RH de homologação interceptado no backend da producao.")); // RH Lot fails
        
        // Mock Bank Account
        maybeSingleMock.mockResolvedValueOnce({ 
           data: { id: "conta-production", empresa_id: "prod-empresa" }, error: null 
        });
        
        // Mock Lote RH payload
        maybeSingleMock.mockResolvedValueOnce({
           data: { valor_total: 1000, empresa_id: "hml-empresa" }, error: null
        });

        await expect(CNABBase.fetchLoteData("dummy-remessa", "conta-production", "lote-rh-id")).rejects.toThrow("Lote RH de homologação interceptado no backend da producao.");
        
        expect(EnvironmentService.assertEmpresaAllowed).toHaveBeenNthCalledWith(1, { tenantId: "mock-tenant", empresaId: "prod-empresa" });
        expect(EnvironmentService.assertEmpresaAllowed).toHaveBeenNthCalledWith(2, { tenantId: "mock-tenant", empresaId: "hml-empresa" });
    });

    it("CnabConciliacaoService - Deve ignorar Lotes isolados sem disparar falha em loop de conciliação financeira RH", async () => {
        const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (EnvironmentService.assertEmpresaAllowed as any).mockRejectedValueOnce(new Error("Rejected Boundary"));

        const fakeItens = [ { id: "item1", lote_id: "lote_cross_env", fatura_id: "fat1", status: "pago" } ];

        (supabase.from as any).mockImplementation((table: string) => {
             if (table === 'cnab_retorno_itens') {
                 return {
                     select: () => ({ eq: () => Promise.resolve({ data: fakeItens, error: null }) })
                 }
             }
             if (table === 'faturas') {
                 return {
                     select: () => ({
                         in: () => ({
                             limit: () => ({
                                 maybeSingle: () => Promise.resolve({ data: { empresa_id: "cross-env-empresa" }})
                             })
                         })
                     })
                 }
             }
             return { select: vi.fn(), update: vi.fn().mockReturnThis(), in: vi.fn(), eq: vi.fn() };
        });

        const res = await CnabConciliacaoService.processarBaixaAutomatica("retorno-id");
        expect(res.success).toBe(true);
        expect(EnvironmentService.assertEmpresaAllowed).toHaveBeenCalledWith({ tenantId: "mock-tenant", empresaId: "cross-env-empresa"});
        expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining("Lote de RH lote_cross_env pertence a contexto isolado e será ignorado"));
        spyWarn.mockRestore();
    });
});
