import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';

describe("Segregation of Produção e Homologação - Intermitentes", () => {
    let mockSelect: any;
    let mockEq: any;
    let mockIs: any;
    let mockOrder: any;
    let mockIn: any;
    let mockOr: any;
    let mockGte: any;
    let mockLte: any;
    let mockUpdate: any;
    let mockInsert: any;
    let mockSingle: any;
    let chainResponse: any;
    let globalState: any;

    beforeEach(() => {
        vi.clearAllMocks();
        EnvironmentService.invalidate();

        mockIn = vi.fn().mockReturnThis();
        mockOr = vi.fn().mockReturnThis();
        mockOrder = vi.fn().mockReturnThis();
        mockEq = vi.fn().mockReturnThis();
        mockIs = vi.fn().mockReturnThis();
        mockGte = vi.fn().mockReturnThis();
        mockLte = vi.fn().mockReturnThis();
        
        mockUpdate = vi.fn().mockReturnValue({
            eq: mockEq,
            in: mockIn
        });

        // Set base resolutions
        mockEq.mockResolvedValue({ data: [], error: null });
        mockIn.mockResolvedValue({ data: [], error: null });
        mockOr.mockResolvedValue({ data: [], error: null });
        mockIs.mockResolvedValue({ data: [], error: null });
        mockGte.mockResolvedValue({ data: [], error: null });
        mockLte.mockResolvedValue({ data: [], error: null });
        
        mockSingle = vi.fn().mockResolvedValue({ data: { id: 'mocked_lote_id' }, error: null });

        mockInsert = vi.fn().mockReturnValue({
            select: () => ({ single: mockSingle })
        });

        globalState = { methodCalled: '' };

        chainResponse = {
            single: mockSingle,
            not: (...args: any) => { globalState.methodCalled = 'not'; return chainResponse; },
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
        };
        chainResponse.eq = (...args: any) => { globalState.methodCalled = 'eq'; mockEq(...args); return chainResponse; };
        chainResponse.is = (col: string, val: any) => { 
            if (col === 'empresa_id' && val === null) globalState.methodCalled = 'isNull';
            else globalState.methodCalled = 'is';
            mockIs(col, val); 
            return chainResponse; 
        };
        chainResponse.gte = (...args: any) => { globalState.methodCalled = 'gte'; mockGte(...args); return chainResponse; };
        chainResponse.lte = (...args: any) => { globalState.methodCalled = 'lte'; mockLte(...args); return chainResponse; };
        chainResponse.in = (...args: any) => { globalState.methodCalled = 'in'; mockIn(...args); return chainResponse; };
        chainResponse.or = (...args: any) => { globalState.methodCalled = 'or'; mockOr(...args); return chainResponse; };
        chainResponse.order = (...args: any) => { globalState.methodCalled = 'order'; mockOrder(...args); return chainResponse; };

        mockSelect = vi.fn().mockReturnValue(chainResponse);

        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => Promise.resolve({ data: [{ id: "test-hml" }], error: null })
                        })
                    })
                };
            }
            if (table === 'lancamentos_intermitentes') {
               return {
                   select: mockSelect,
                   update: mockUpdate
               };
            }
            if (table === 'intermitentes_lotes_fechamento') {
                return {
                    select: mockSelect,
                    insert: mockInsert,
                    update: mockUpdate
                };
            }
            return { select: mockSelect, update: mockUpdate, insert: mockInsert };
        });
    });

    it("1. listarLotes em HML retorna somente empresas HML", async () => {
        localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
        await IntermitentesLoteService.listarLotes();
        expect(mockIn).toHaveBeenCalledWith('empresa_id', ["test-hml"]);
    });

    it("2. listarLotes em PROD exclui empresas HML (legacy null preservado)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        await IntermitentesLoteService.listarLotes();
        expect(mockOr).toHaveBeenCalledWith('empresa_id.not.in.(test-hml),empresa_id.is.null');
    });

    it("3. fecharPeriodo em HML fecha somente lançamentos HML", async () => {
        localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
        chainResponse.then = (resolve: any) => {
            if (globalState.methodCalled === 'lte') return Promise.resolve({ data: [] }).then(resolve); // Nulls ends with lte
            return Promise.resolve({ data: [{ id: 'lanc1', total: '100', empresa_id: 'test-hml' }] }).then(resolve); // Valid
        };

        await IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' });
        expect(mockIn).toHaveBeenCalledWith('empresa_id', ["test-hml"]);
    });

    it("4. fecharPeriodo em PROD fecha somente lançamentos PROD (excluindo nulls strict false)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        chainResponse.then = (resolve: any) => {
            if (globalState.methodCalled === 'lte') return Promise.resolve({ data: [] }).then(resolve); // Nulls ends with lte
            return Promise.resolve({ data: [{ id: 'lanc1', total: '100', empresa_id: 'prod-empresa' }] }).then(resolve); // Valid
        };

        await IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' });
        expect(globalState.methodCalled).toBe('not'); 
    });

    it("5. fecharPeriodo ignora empresa_id nulo e 6. empresa_id nulo gera inconsistência", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        chainResponse.then = (resolve: any) => {
            if (globalState.methodCalled === 'lte') return Promise.resolve({ data: [{ id: 'null-lanc' }] }).then(resolve); // Nulls end with lte
            return Promise.resolve({ data: [] }).then(resolve); // Valid
        };

        await expect(IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' }))
            .rejects.toThrow('Nenhum lançamento pendente encontrado para o período/filtro informado neste ambiente.');

        expect(mockUpdate).toHaveBeenCalledWith({ status_pipeline: 'DEVOLVIDO' });
        expect(mockIn).toHaveBeenCalledWith('id', ['null-lanc']);
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it("7. erro no discovery interrompe o fechamento antes de qualquer insert", async () => {
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'empresas') {
                return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "Network Error" } }) }) }) };
            }
            return { select: mockSelect, update: mockUpdate, insert: mockInsert };
        });

        await expect(IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' }))
              .rejects.toThrow('Erro técnico ao buscar empresas de teste');
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it("8. getByEmpresaParaFinanceiro não retorna outra empresa (utiliza includeNullInProduction: false)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        await IntermitentesLoteService.getByEmpresaParaFinanceiro("some-id");
        expect(mockOr).not.toHaveBeenCalled(); // Pois includesNull false não emite OR com Null
        expect(mockEq).toHaveBeenCalledWith('empresa_id', 'some-id'); 
    });

    it("9. chamada concorrente impede duplicação mockando Unique Constraint do PG no Insert", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        chainResponse.then = (resolve: any) => {
            if (globalState.methodCalled === 'lte') return Promise.resolve({ data: [] }).then(resolve); // Nulls
            return Promise.resolve({ data: [{ id: 'lanc1', total: '100', empresa_id: 'prod-empresa' }] }).then(resolve); // Valid
        };

        let inserts = 0;
        mockInsert.mockImplementation(() => {
            inserts++;
            if (inserts > 1) {
                return { select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'unique_violation' } }) }) };
            }
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'lote1' }, error: null }) }) };
        });

        const exec1 = IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' });
        const exec2 = IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' });
        const results = await Promise.allSettled([exec1, exec2]);

        expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
        expect(results.filter(r => r.status === 'rejected').length).toBe(1);
        expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it("10. updates usam somente IDs previamente segregados (scopedLancamentoIds)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        chainResponse.then = (resolve: any) => {
            if (globalState.methodCalled === 'lte') return Promise.resolve({ data: [] }).then(resolve);
            return Promise.resolve({ data: [{ id: 'segregated_id_1', total: '100', empresa_id: 'prod-empresa' }] }).then(resolve);
        };

        await IntermitentesLoteService.fecharPeriodo({ empresaId: 'emp1', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'QA' });
        expect(mockIn).toHaveBeenCalledWith('id', ['segregated_id_1']);
    });
});
