import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock das dependências antes que o serviço as importe
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "mock-id" } } }) }
  }
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: "mock-tenant" }),
    getCurrentTenantId: vi.fn().mockResolvedValue("mock-tenant"),
  };
});

import { supabase } from '@/lib/supabase';
import { RHFinanceiroService } from '@/services/rhFinanceiro.service';

describe("Segregation of Produção and Homologação", () => {
    let mockSelect: any;
    let mockEq: any;
    let mockOrder: any;
    let mockIn: any;
    let mockOr: any;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockIn = vi.fn().mockReturnThis();
        mockOr = vi.fn().mockReturnThis();
        mockOrder = vi.fn().mockReturnThis();
        mockEq = vi.fn().mockReturnThis();
        
        // A corrente do Prisma/Supabase retorna uma promise resolvida no iterador final
        mockIn.mockResolvedValue({ data: [], error: null });
        mockOr.mockResolvedValue({ data: [], error: null });
        mockOrder.mockResolvedValue({ data: [], error: null });
        
        mockSelect = vi.fn().mockReturnValue({
            eq: () => ({
                order: () => ({
                    in: mockIn,
                    or: mockOr,
                    eq: () => ({
                        in: mockIn,
                        or: mockOr
                    })
                }),
                single: () => Promise.resolve({ data: { tenant_id: "mock-tenant" }, error: null })
            }),
            single: () => Promise.resolve({ data: { tenant_id: "mock-tenant" }, error: null })
        });

        // Simula o comportamento do cliente Supabase para o teste
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: () => Promise.resolve({ data: [{ id: "test-id-1" }, { id: "test-id-2" }] })
                    })
                };
            }
            if (table === 'profiles') {
                return { select: mockSelect };
            }
            if (table === 'rh_financeiro_lotes') {
                return { select: mockSelect };
            }
            return { select: mockSelect };
        });
    });

    it("deve usar a cláusula IN com as empresas de teste em HOMOLOGAÇÃO", async () => {
        localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
        
        await RHFinanceiroService.listLotesRecebidos();
        
        // Verifica se usou a inclusão restrita a empresas de teste
        expect(mockIn).toHaveBeenCalledWith('empresa_id', ["test-id-1", "test-id-2"]);
        expect(mockOr).not.toHaveBeenCalled();
    });

    it("deve usar a cláusula NOT IN e IS NULL em PRODUCAO", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        
        await RHFinanceiroService.listLotesRecebidos();
        
        // Verifica se usou a lógica padrão que oculta as empresas de teste
        expect(mockOr).toHaveBeenCalledWith('empresa_id.not.in.(test-id-1,test-id-2),empresa_id.is.null');
        expect(mockIn).not.toHaveBeenCalled();
    });
});
