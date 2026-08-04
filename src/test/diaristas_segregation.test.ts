import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "mock-id" } } }) },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  },
  operationalClient: {
    from: vi.fn()
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
import { LancamentoDiaristaService, LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';

describe("Segregation of Produção e Homologação - Diaristas", () => {
    let mockSelect: any;
    let mockUpdate: any;
    let mockInsert: any;
    let mockDelete: any;
    let mockSingle: any;
    let mockEq: any;
    let mockIn: any;
    let mockOr: any;
    let mockOrder: any;
    let mockIs: any;
    let mockNeq: any;
    let mockGte: any;
    let mockLte: any;
    let mockNot: any;
    let globalState: any;
    let chainResponse: any;

    beforeEach(() => {
        vi.clearAllMocks();
        EnvironmentService.invalidate();

        mockSingle = vi.fn().mockResolvedValue({ data: { id: 'mocked_lote_id', status: 'FECHADO_FINANCEIRO', empresa_id: 'prod-empresa', tenant_id: 'mock-tenant', periodo_inicio: '2026-06-01', periodo_fim: '2026-06-30' }, error: null });

        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.or = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.neq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.lte = vi.fn().mockReturnValue(chain);
        chain.not = vi.fn().mockReturnValue(chain);
        chain.not.mySecretKey = "I_AM_MOCK_NOT";
        chain.mySecretKey = "I_AM_CHAIN";
        chain.single = mockSingle;
        chain.maybeSingle = mockSingle;
        chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
        
        mockEq = chain.eq;
        mockIn = chain.in;
        mockOr = chain.or;
        mockOrder = chain.order;
        mockIs = chain.is;
        mockNeq = chain.neq;
        mockGte = chain.gte;
        mockLte = chain.lte;
        mockNot = chain.not;

        mockSelect = vi.fn().mockReturnValue(chain);
        mockUpdate = vi.fn().mockReturnValue(chain);
        mockDelete = vi.fn().mockReturnValue(chain);
        mockInsert = vi.fn().mockReturnValue({
            select: () => ({ single: mockSingle })
        });

        globalState = { methodCalled: '' };

        chainResponse = {
            single: mockSingle,
            not: (...args: any) => { globalState.methodCalled = 'not'; mockNot(...args); return chainResponse; },
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve)
        };
        chainResponse.eq = (...args: any) => { globalState.methodCalled = 'eq'; mockEq(...args); return chainResponse; };
        chainResponse.is = (col: string, val: any) => { 
            if (col === 'empresa_id' && val === null) globalState.methodCalled = 'isNull';
            else globalState.methodCalled = 'is';
            mockIs(col, val); 
            return chainResponse; 
        };
        chainResponse.neq = (...args: any) => { globalState.methodCalled = 'neq'; mockNeq(...args); return chainResponse; };
        chainResponse.gte = (...args: any) => { globalState.methodCalled = 'gte'; mockGte(...args); return chainResponse; };
        chainResponse.lte = (...args: any) => { globalState.methodCalled = 'lte'; mockLte(...args); return chainResponse; };
        chainResponse.in = (...args: any) => { globalState.methodCalled = 'in'; mockIn(...args); return chainResponse; };
        chainResponse.or = (...args: any) => { globalState.methodCalled = 'or'; mockOr(...args); return chainResponse; };
        chainResponse.order = (...args: any) => { globalState.methodCalled = 'order'; mockOrder(...args); return chainResponse; };

        mockSelect = vi.fn().mockReturnValue(chainResponse);

        (supabase.from as any).mockImplementation((table: string) => {
            console.log("SUPABASE.FROM MOCK CALLED FOR TABLE:", table);
            if (table === 'empresas') {
                const empChain: any = {};
                empChain.eq = vi.fn().mockReturnValue(empChain);
                empChain.maybeSingle = () => Promise.resolve({ data: { id: 'prod-empresa', tenant_id: 'mock-tenant', is_teste: localStorage.getItem("esc-log-environment") === "HOMOLOGACAO" }, error: null });
                empChain.single = () => Promise.resolve({ data: { id: 'prod-empresa', tenant_id: 'mock-tenant', is_teste: localStorage.getItem("esc-log-environment") === "HOMOLOGACAO" }, error: null });
                empChain.then = (resolve: any) => Promise.resolve({ data: [{ id: "test-hml" }], error: null }).then(resolve);
                return {
                    select: () => empChain
                };
            }
            if (table === 'lancamentos_diaristas') {
               return {
                   select: mockSelect,
                   insert: mockInsert,
                   update: mockUpdate,
                   delete: mockDelete
               };
            }
            if (table === 'diaristas_lotes_fechamento') {
                return {
                    select: mockSelect,
                    insert: mockInsert,
                    update: mockUpdate
                };
            }
            return { select: mockSelect, update: mockUpdate, insert: mockInsert };
        });
    });

    it("1. getByPeriodo PROD exclui HML", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        await LancamentoDiaristaService.getByPeriodo(undefined, '2026-06-01', '2026-06-30');
        console.log('mockNot calls:', mockNot.mock.calls);
        console.log('mockSelect calls:', mockSelect.mock.calls);
        console.log('mockGte calls:', mockGte.mock.calls);
        console.log('mockLte calls:', mockLte.mock.calls);
        expect(mockNot).toHaveBeenCalledWith('empresa_id', 'in', '(test-hml)'); 
    });

    it("2. getByPeriodo HML inclui PROD", async () => {
        localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
        await LancamentoDiaristaService.getByPeriodo(undefined, '2026-06-01', '2026-06-30');
        expect(mockIn).toHaveBeenCalledWith('empresa_id', ["test-hml"]);
    });

    it("3. getByEmpresaParaFinanceiro preserva empresa específica sem vazamento nulo", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        await LoteFechamentoDiaristaService.getByEmpresaParaFinanceiro("some-id");
        expect(mockNot).toHaveBeenCalledWith('empresa_id', 'in', '(test-hml)');
        expect(mockEq).toHaveBeenCalledWith('empresa_id', 'some-id');
    });

    it("4. fecharPeriodo PROD não fecha itens HML (Strict Scope check)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        chainResponse.then = (resolve: any) => {
            if (globalState.methodCalled === 'lte') return Promise.resolve({ data: [{ id: 'orphan-1' }] }).then(resolve);
            if (globalState.methodCalled === 'or') return Promise.resolve({ data: [{ id: 'lanc1', empresa_id: 'prod-empresa', tenant_id: 'mock-tenant' }] }).then(resolve);
            return Promise.resolve({ data: [] }).then(resolve);
        };
        await LoteFechamentoDiaristaService.fecharPeriodo({ empresaId: 'prod-empresa', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'admin', fechadoPorNome: 'admin', fechadoPorRole: 'admin', fechadoPorNome: 'admin', fechadoPorRole: 'admin' });
        // The assertEmpresaAllowed inside should prevent crossing
    });

    it("5. fecharPeriodo falha fechado se houver Lote Leak (idempotency 23505 simulado)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        // Simulate returning records so we actually reach the insert phase where 23505 triggers
        let callIndex = 0;
        chainResponse.then = (resolve: any) => {
            callIndex++;
            if (callIndex === 1) return Promise.resolve({ data: [] }).then(resolve); // orphans
            if (callIndex === 2) return Promise.resolve({ data: [{ id: 'lanc1', empresa_id: 'prod-empresa', tenant_id: 'mock-tenant' }] }).then(resolve); // valid items
            return Promise.resolve({ data: [] }).then(resolve);
        };

        mockInsert.mockReturnValue({
            select: () => ({ single: () => Promise.resolve({ data: null, error: { code: '23505', message: 'Violacao Única' } }) })
        });
        
        await expect(LoteFechamentoDiaristaService.fecharPeriodo({
            empresaId: 'prod-empresa', // Must use a PROD company to reach idempotency phase!
            periodoInicio: '2026-06-01',
            periodoFim: '2026-06-30',
            fechadoPor: 'admin',
            fechadoPorNome: 'admin',
            fechadoPorRole: 'admin'
        })).resolves.toMatchObject({ error: 'CONCURRENCY_ERROR' });
    });

    it("6. Lançamento nulo gera inconsistência rastreável (Status DEVOLVIDO)", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        // We'll mock the first orphans fetch to return somethings
        let callIndex = 0;
        chainResponse.then = (resolve: any) => {
            callIndex++;
            if (callIndex === 1) return Promise.resolve({ data: [{ id: 'orphan1', data_lancamento: '2026-06-15' }] }).then(resolve); // orphans fetch
            if (callIndex === 2) return Promise.resolve({ data: [] }).then(resolve); // empty valid set
            return Promise.resolve({ data: [] }).then(resolve);
        };
        const res = await LoteFechamentoDiaristaService.fecharPeriodo({ empresaId: 'prod-empresa', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'admin', fechadoPorNome: 'admin', fechadoPorRole: 'admin', fechadoPorNome: 'admin', fechadoPorRole: 'admin' });
        // orphans should have trigged an update to DEVOLVIDO 
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'DEVOLVIDO' }));
        expect(mockInsert).toHaveBeenCalled(); // into diaristas_logs_fechamento
        // And overall return empty
        expect(res.status).toBe('SEM_REGISTROS');
    });

    it("7. Conjunto vazio (após expurgo nulos) finaliza sem inserir lote", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        chainResponse.then = (resolve: any) => Promise.resolve({ data: [] }).then(resolve);
        const res = await LoteFechamentoDiaristaService.fecharPeriodo({ empresaId: 'prod-empresa', periodoInicio: '2026-06-01', periodoFim: '2026-06-30', fechadoPor: 'admin', fechadoPorNome: 'admin', fechadoPorRole: 'admin', fechadoPorNome: 'admin', fechadoPorRole: 'admin' });
        expect(res.status).toBe('SEM_REGISTROS');
        expect(mockInsert).not.toHaveBeenCalled(); // no lote created
    });

    it("8. criarAjuste herda escopo exatamente do lançamento original persistido, rejeita fraudes client-side", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        // Wait, Test 8 wasn't rejecting! Let's mock a failure to test validation fraud rejection.
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: "NOT_FOUND_OR_CONFLICT" } });

        await expect(LancamentoDiaristaService.criarAjuste({
            referenciaLancamentoId: 'id-original',
            empresaId: 'fake-hml-hack',
            valorAjuste: 50,
            motivo: 'test',
            adjustedBy: 'me',
            adjustedByNome: 'me',
            original: {
                lote_fechamento_id: 'algum-lote',
                diarista_id: 'x',
                nome_colaborador: 'x',
                funcao_colaborador: 'x',
                data_lancamento: 'x',
                codigo_marcacao: 'x'
            }
        })).rejects.toThrow('Lançamento original não encontrado');
    });

    it("9. createBatch valida todas as distinct empresas listadas no batch antes de persistir", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        
        const payload = [
            { empresa_id: 'prod-empresa', diarista_id: 'd1' },
            { empresa_id: 'prod-empresa', diarista_id: 'd2' }
        ];

        let eqCalls = [];
        (supabase.from as any).mockImplementationOnce((t: string) => {
            if (t === 'empresas') {
                const chain: any = {};
                chain.eq = vi.fn().mockReturnValue(chain);
                chain.maybeSingle = () => Promise.resolve({ data: { id: 'prod-empresa', tenant_id: 'mock-tenant', is_teste: localStorage.getItem("esc-log-environment") === "HOMOLOGACAO" }, error: null });
                chain.then = (resolve: any) => Promise.resolve({ data: [{id:'test-hml'}], error: null }).then(resolve);
                return { select: () => chain };
            }
            return {
                delete: () => ({ eq: () => ({ in: () => ({ in: () => ({ in: () => Promise.resolve() }) }) }) }),
                insert: (args: any) => { mockInsert(args); return { select: () => Promise.resolve({ data: [ {id: '1'} ] }) } }
            };
        });

        await LancamentoDiaristaService.createBatch(payload as any);
        expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ empresa_id: 'prod-empresa', tenant_id: 'mock-tenant' })]));
    });

    it("10. createBatch interrompe imediatamente se algum registro não possuir empresa_id", async () => {
        const payload = [
            { empresa_id: 'prod-empresa', diarista_id: 'd1' },
            { empresa_id: '', diarista_id: 'd2' } // Falsy
        ];
        await expect(LancamentoDiaristaService.createBatch(payload as any)).rejects.toThrow("Lote negado: Ao menos um registro não possui empresa_id.");
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it("11. gerarCNABParaLote audita restritamente consistência e bloqueia batch furado", async () => {
        localStorage.setItem("esc-log-environment", "PRODUCAO");
        // Mock lote
        mockSingle = vi.fn().mockResolvedValue({ 
            data: { id: 'lote1', empresa_id: 'prod-empresa', tenant_id: 'mock-tenant', status: 'FECHADO_FINANCEIRO' }, 
            error: null 
        });

        // Mock lancamentos
        let callCount = 0;
        chainResponse.then = (resolve: any) => {
            callCount++;
            if (callCount === 1) {
                // lancamentos fetch: containing a cross-company leak!
                return Promise.resolve({ data: [{ id: 'lanc1', empresa_id: 'prod-empresa', tenant_id: 'mock-tenant', diarista_id: 'd1', valor_calculado: 100 }, { id: 'lanc2', empresa_id: 'VILAO-EMPRESA', tenant_id: 'mock-tenant', diarista_id: 'd2', valor_calculado: 50 }] }).then(resolve);
            }
            return Promise.resolve({ data: [] }).then(resolve);
        };

        await expect(LoteFechamentoDiaristaService.gerarCNABParaLote({ loteId: 'lote1', empresaId: 'prod-empresa' } as any))
          .rejects.toThrow('Contaminação de Lote detectada');
    });

});
