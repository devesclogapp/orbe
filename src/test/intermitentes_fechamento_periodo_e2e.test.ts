import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-tester-id' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-test-uuid', userId: 'usr-tester-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-tester-id', tenant_id: 'tenant-test-uuid' }),
  };
});

describe('FECHAMENTO DE PERÍODO INTERMITENTES — REGRA EMPRESARIAL E ESCOPO', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // 1. Exigência de Empresa Específica: fecharPeriodo rejeita empresaId null
  it('1. fecharPeriodo rejeita empresaId nulo com mensagem explícita', async () => {
    await expect(
      IntermitentesLoteService.fecharPeriodo({
        empresaId: null,
        periodoInicio: '2026-10-01',
        periodoFim: '2026-10-31',
        fechadoPor: 'user-tester',
      })
    ).rejects.toThrow('Para fechar o período, selecione uma empresa.');
  });

  // 2. Proteção contra execução de empresa HML em ambiente de PRODUÇÃO
  it('2. fecharPeriodo bloqueia empresa HML se a sessão estiver em PRODUCAO com mensagem orientativa', async () => {
    localStorage.setItem('esc-log-environment', 'PRODUCAO');

    vi.spyOn(EnvironmentService, 'getTestEmpresaIds').mockResolvedValue(['emp-hml-test-id']);

    await expect(
      IntermitentesLoteService.fecharPeriodo({
        empresaId: 'emp-hml-test-id',
        periodoInicio: '2026-10-01',
        periodoFim: '2026-10-31',
        fechadoPor: 'user-tester',
      })
    ).rejects.toThrow('A empresa selecionada pertence ao ambiente de Homologação. Alterne o seletor no topo da página para "Homologação (Testes)" antes de fechar o período.');
  });

  // 3. Sucesso no fechamento E2E: 2 lançamentos em HOMOLOGAÇÃO
  it('3. Em HOMOLOGAÇÃO com empresa HML selecionada: fecha exatamente 2 lançamentos e cria 1 lote com R$ 570,00', async () => {
    localStorage.setItem('esc-log-environment', 'HOMOLOGACAO');

    const empId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
    vi.spyOn(EnvironmentService, 'getTestEmpresaIds').mockResolvedValue([empId]);

    const mockLoteId = 'lote-novo-uuid-1234';

    // Mock das chamadas Supabase encadeadas
    const mockUpdateLancamentos = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const mockInsertLote = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockLoteId,
            tenant_id: 'tenant-test-uuid',
            empresa_id: empId,
            competencia: '2026-10',
            quantidade_registros: 2,
            valor_total: 570.0,
            status: 'AGUARDANDO_VALIDACAO_RH',
          },
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col, val) => {
              if (col === 'status_pipeline') {
                return {
                  is: vi.fn().mockReturnValue({
                    is: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: [], error: null }), // nullLancamentos
                      }),
                    }),
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          in: vi.fn().mockResolvedValue({
                            data: [
                              { id: '5349a94a-2e34-4463-8c95-33f26aac0b98', total: 240, empresa_id: empId },
                              { id: 'a9fb4fa9-e3e9-4c27-940f-f65c9d909cb9', total: 330, empresa_id: empId },
                            ],
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                };
              }
              return {};
            }),
          }),
          update: mockUpdateLancamentos,
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          insert: mockInsertLote,
        };
      }
      return {};
    });

    const lotes = await IntermitentesLoteService.fecharPeriodo({
      empresaId: empId,
      periodoInicio: '2026-10-01',
      periodoFim: '2026-10-31',
      fechadoPor: 'user-tester-id',
    });

    // Validar lote gerado
    expect(lotes).toHaveLength(1);
    expect(lotes[0].id).toBe(mockLoteId);
    expect(lotes[0].empresa_id).toBe(empId);
    expect(lotes[0].quantidade_registros).toBe(2);
    expect(lotes[0].valor_total).toBe(570.0);
    expect(lotes[0].status).toBe('AGUARDANDO_VALIDACAO_RH');

    // Validar que os 2 lançamentos receberam status EM_ANALISE_RH e lote_fechamento_id
    expect(mockUpdateLancamentos).toHaveBeenCalledWith({
      lote_fechamento_id: mockLoteId,
      status_pipeline: 'EM_ANALISE_RH',
    });
  });

  // 4. Validação estática da UI (IntermitentesRecebidos.tsx)
  it('4. IntermitentesRecebidos.tsx bloqueia fechamento em "Todas as Empresas" e aplica EnvironmentQueryFilter', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/Operacional/IntermitentesRecebidos.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Botão desabilitado quando filterEmpresaId === "all"
    expect(content).toContain('filterEmpresaId === "all"');
    expect(content).toContain('Selecione uma Empresa para Fechar');

    // Validação na mutation
    expect(content).toContain('if (filterEmpresaId === "all")');
    expect(content).toContain('throw new Error("Para fechar o período, selecione uma empresa.");');

    // Aplicação do EnvironmentQueryFilter na listagem
    expect(content).toContain('EnvironmentQueryFilter.applyEmpresaScope(query');
  });
});
