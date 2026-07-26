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
import { EnvironmentService } from '@/services/environment/EnvironmentService';

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
        
        mockEq.mockResolvedValue({ data: [], error: null });

        mockSelect = vi.fn().mockReturnValue({
            eq: () => ({
                order: () => ({
                    in: mockIn,
                    or: mockOr,
                    eq: mockEq
                }),
                single: () => Promise.resolve({ data: { tenant_id: "mock-tenant" }, error: null })
            }),
            single: () => Promise.resolve({ data: { tenant_id: "mock-tenant" }, error: null })
        });

        vi.stubGlobal('location', { reload: vi.fn() });
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => Promise.resolve({ data: [{ id: "test-id-1" }, { id: "test-id-2" }], error: null })
                        })
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
        EnvironmentService.invalidate();
        localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
        
        await RHFinanceiroService.listLotesRecebidos();
        
        // Verifica se usou a inclusão restrita a empresas de teste
        expect(mockIn).toHaveBeenCalledWith('empresa_id', ["test-id-1", "test-id-2"]);
        expect(mockOr).not.toHaveBeenCalled();
    });

    it("deve usar a cláusula NOT IN e IS NULL em PRODUCAO", async () => {
        EnvironmentService.invalidate();
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        
        await RHFinanceiroService.listLotesRecebidos();
        
        // Verifica se usou a lógica padrão que oculta as empresas de teste
        expect(mockOr).toHaveBeenCalledWith('empresa_id.not.in.(test-id-1,test-id-2),empresa_id.is.null');
        expect(mockIn).not.toHaveBeenCalled();
    });

    it("tenant A não compartilha cache com tenant B", async () => {
        EnvironmentService.invalidate();
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: (field: string, val: any) => {
                            if (field === 'tenant_id') {
                                return {
                                    eq: () => Promise.resolve({ 
                                        data: val === 'tenant-A' ? [{ id: "test-A" }] : [{ id: "test-B" }], 
                                        error: null 
                                    })
                                };
                            }
                            return { eq: () => Promise.resolve({ data: [], error: null }) };
                        }
                    })
                };
            }
            return { select: mockSelect };
        });

        const idsA = await EnvironmentService.getTestEmpresaIds("tenant-A");
        const idsB = await EnvironmentService.getTestEmpresaIds("tenant-B");
        expect(idsA).toEqual(["test-A"]);
        expect(idsB).toEqual(["test-B"]);
    });

    it("troca de ambiente invalida o escopo", () => {
        const spyInvalidate = vi.spyOn(EnvironmentService, 'invalidate');
        EnvironmentService.handleEnvironmentChange();
        expect(spyInvalidate).toHaveBeenCalled();
        spyInvalidate.mockRestore();
    });

    it("falha na descoberta de testIds impede a execução da consulta e lança erro", async () => {
        EnvironmentService.invalidate();
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => Promise.resolve({ data: null, error: { message: "error" } })
                        })
                    })
                };
            }
            return { select: mockSelect };
        });

        await expect(RHFinanceiroService.listLotesRecebidos()).rejects.toThrow('Erro técnico ao buscar empresas de teste');
        
        // Assegura que o construtor financeiro sequer foi acionado
        expect(mockIn).not.toHaveBeenCalled();
        expect(mockOr).not.toHaveBeenCalled();
        expect(mockEq).not.toHaveBeenCalled();
    });

    it("HML sem empresas teste como sucesso legítimo filtra para UUID vazio seguro", async () => {
        EnvironmentService.invalidate();
        localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => Promise.resolve({ data: [], error: null })
                        })
                    })
                };
            }
            return { select: mockSelect };
        });

        await RHFinanceiroService.listLotesRecebidos();
        expect(mockEq).toHaveBeenCalledWith('empresa_id', '00000000-0000-0000-0000-000000000000');
    });

    it("PROD sem empresas teste como sucesso legítimo não adiciona restrição NOT IN", async () => {
        EnvironmentService.invalidate();
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => Promise.resolve({ data: [], error: null })
                        })
                    })
                };
            }
            return { select: mockSelect };
        });

        await RHFinanceiroService.listLotesRecebidos();
        expect(mockOr).not.toHaveBeenCalled();
    });
});
