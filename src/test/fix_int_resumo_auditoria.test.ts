import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { AuditoriaService } from '@/services/v4.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-audit-tester' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-audit-uuid', userId: 'usr-audit-tester' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-audit-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-audit-tester', tenant_id: 'tenant-audit-uuid' }),
  };
});

vi.mock('@/services/v4.service', () => ({
  AuditoriaService: {
    log: vi.fn().mockResolvedValue({ id: 'audit-log-123' }),
  },
}));

describe('FIX-INT-01 & FIX-INT-02 — RESUMO PERSISTENTE E AUDITORIA DE FECHAMENTO (INTERMITENTES)', () => {

  const empId = 'emp-intermitente-audit-123';
  const loteId = 'lote-intermitente-audit-456';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('esc-log-environment', 'HOMOLOGACAO');
    vi.spyOn(EnvironmentService, 'getTestEmpresaIds').mockResolvedValue([empId]);
  });

  // 1. Fechamento bem-sucedido com emissão de auditoria institucional (FIX-INT-02)
  it('1. fecharPeriodo registra evento estruturado FECHAR_PERIODO com dados do lote em AuditoriaService', async () => {
    const mockUpdateLancamentos = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const mockInsertLote = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: loteId,
            tenant_id: 'tenant-audit-uuid',
            empresa_id: empId,
            competencia: '2026-10',
            periodo_inicio: '2026-10-01',
            periodo_fim: '2026-10-31',
            quantidade_registros: 2,
            valor_total: 480.0,
            status: 'AGUARDANDO_VALIDACAO_RH',
            created_by: 'usr-audit-tester',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col) => {
              if (col === 'status_pipeline') {
                return {
                  is: vi.fn().mockReturnValue({
                    is: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          in: vi.fn().mockResolvedValue({
                            data: [
                              { id: 'lanc-1', total: 200, empresa_id: empId },
                              { id: 'lanc-2', total: 280, empresa_id: empId },
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
      fechadoPor: 'usr-audit-tester',
      observacoes: 'Fechamento de teste auditado',
    });

    expect(lotes).toHaveLength(1);
    expect(lotes[0].id).toBe(loteId);

    // Valida chamada formal ao AuditoriaService
    expect(AuditoriaService.log).toHaveBeenCalledWith(
      'FECHAR_PERIODO',
      'intermitentes',
      'medio',
      expect.objectContaining({
        acao_legada: 'INTERMITENTE_LOTE',
        lote_id: loteId,
        empresa_id: empId,
        competencia: '2026-10',
        quantidade_registros: 2,
        valor_total: 480.0,
        fechado_por: 'usr-audit-tester',
        tenant_id: 'tenant-audit-uuid',
      })
    );
  });

  // 2. Consulta posterior do resumo persistido (FIX-INT-01)
  it('2. getResumoLoteIntermitente calcula contadores persistidos de status e equivalência de montantes', async () => {
    vi.spyOn(IntermitentesLoteService, 'getLoteDetalhe').mockResolvedValue({
      id: loteId,
      tenant_id: 'tenant-audit-uuid',
      empresa_id: empId,
      competencia: '2026-10',
      periodo_inicio: '2026-10-01',
      periodo_fim: '2026-10-31',
      quantidade_registros: 3,
      valor_total: 650.0,
      status: 'AGUARDANDO_VALIDACAO_RH',
      empresa: { nome: 'ESC Logística Teste' },
      created_by: 'usr-audit-tester',
      created_at: '2026-10-11T12:00:00Z',
      itens: [
        {
          id: 'i-1',
          colaborador_id: 'col-1',
          nome_colaborador: 'João da Silva',
          horas_trabalhadas: 8,
          total: 200,
          status_pipeline: 'EM_ANALISE_RH',
          empresa_id: empId,
        },
        {
          id: 'i-2',
          colaborador_id: 'col-2',
          nome_colaborador: 'Maria Souza',
          horas_trabalhadas: 10,
          total: 250,
          status_pipeline: 'EM_ANALISE_RH',
          empresa_id: empId,
        },
        {
          id: 'i-3',
          colaborador_id: 'col-3',
          nome_colaborador: 'Carlos Santos',
          horas_trabalhadas: 8,
          total: 200,
          status_pipeline: 'EM_ANALISE_RH',
          empresa_id: empId,
        },
      ],
      total_colaboradores: 3,
      horas_trabalhadas: 26,
      horas_normais: 24,
      he_50: 2,
      he_100: 0,
    } as any);

    const resumo = await IntermitentesLoteService.getResumoLoteIntermitente(loteId);

    expect(resumo).not.toBeNull();
    expect(resumo?.loteId).toBe(loteId);
    expect(resumo?.quantidadeRegistros).toBe(3);
    expect(resumo?.quantidadeColaboradores).toBe(3);
    expect(resumo?.totalHoras).toBe(26);
    expect(resumo?.valorTotal).toBe(650);
    expect(resumo?.valorTotalLote).toBe(650);
    expect(resumo?.itensProcessados).toBe(3);
    expect(resumo?.itensDevolvidos).toBe(0);
    expect(resumo?.itensPendentes).toBe(0);
    expect(resumo?.lotePayloadMatches).toBe(true);
    expect(resumo?.loteValorMatches).toBe(true);
  });

  // 3. Resiliência: falha no serviço central de auditoria não aborta fechamento nem gera inconsistência
  it('3. Falha de rede/exceção em AuditoriaService não bloqueia a criação do lote nem quebra o fluxo', async () => {
    (AuditoriaService.log as any).mockRejectedValueOnce(new Error('Network timeout no log central'));

    const mockUpdateLancamentos = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const mockInsertLote = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'lote-fallback-id',
            tenant_id: 'tenant-audit-uuid',
            empresa_id: empId,
            competencia: '2026-10',
            periodo_inicio: '2026-10-01',
            periodo_fim: '2026-10-31',
            quantidade_registros: 1,
            valor_total: 150.0,
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
            eq: vi.fn().mockImplementation((col) => {
              if (col === 'status_pipeline') {
                return {
                  is: vi.fn().mockReturnValue({
                    is: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          in: vi.fn().mockResolvedValue({
                            data: [{ id: 'lanc-1', total: 150, empresa_id: empId }],
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
      fechadoPor: 'usr-audit-tester',
    });

    expect(lotes).toHaveLength(1);
    expect(lotes[0].id).toBe('lote-fallback-id');
    // Etapa 03A: Deve explicitar que a auditoria não foi confirmada
    expect(lotes[0].auditoriaConfirmada).toBe(false);
    expect(lotes[0].auditoriaAviso).toContain('Falha na gravação de auditoria');
  });

  // 4. Ausência de lançamentos no período
  it('4. fecharPeriodo falha graciosamente com erro explícito se não houver lançamentos pendentes', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col) => {
              if (col === 'status_pipeline') {
                return {
                  is: vi.fn().mockReturnValue({
                    is: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          in: vi.fn().mockResolvedValue({
                            data: [],
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
        };
      }
      return {};
    });

    await expect(
      IntermitentesLoteService.fecharPeriodo({
        empresaId: empId,
        periodoInicio: '2026-10-01',
        periodoFim: '2026-10-31',
        fechadoPor: 'usr-audit-tester',
      })
    ).rejects.toThrow('Nenhum lançamento pendente encontrado para o período/filtro informado neste ambiente.');
  });

  // 5. Etapa 03A: Falha silenciosa de auditoria (retorno nulo ou sem ID) não é reportada como confirmada
  it('5. Falha silenciosa de auditoria (AuditoriaService retorna null ou sem ID) resulta em auditoriaConfirmada: false', async () => {
    (AuditoriaService.log as any).mockResolvedValueOnce(null); // Sem erro, mas sem persistência

    const mockUpdateLancamentos = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const mockInsertLote = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'lote-silent-fail-id',
            tenant_id: 'tenant-audit-uuid',
            empresa_id: empId,
            competencia: '2026-10',
            periodo_inicio: '2026-10-01',
            periodo_fim: '2026-10-31',
            quantidade_registros: 1,
            valor_total: 100.0,
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
            eq: vi.fn().mockImplementation((col) => {
              if (col === 'status_pipeline') {
                return {
                  is: vi.fn().mockReturnValue({
                    is: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                          in: vi.fn().mockResolvedValue({
                            data: [{ id: 'lanc-silent', total: 100, empresa_id: empId }],
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
      fechadoPor: 'usr-audit-tester',
    });

    expect(lotes[0].auditoriaConfirmada).toBe(false);
    expect(lotes[0].auditoriaAviso).toContain('sem retorno de confirmação de ID');
  });

  // 6. Etapa 03A: Consulta posterior do lote diferencia Integridade dos Totais e Trilha de Auditoria
  it('6. getResumoLoteIntermitente reporta auditoriaStatus: CONFIRMADA quando log existe e PENDENTE quando ausente', async () => {
    // Cenário A: Com log persistido
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'auditoria') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              contains: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: 'audit-row-1', acao: 'FECHAR_PERIODO' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    vi.spyOn(IntermitentesLoteService, 'getLoteDetalhe').mockResolvedValue({
      id: loteId,
      tenant_id: 'tenant-audit-uuid',
      empresa_id: empId,
      competencia: '2026-10',
      periodo_inicio: '2026-10-01',
      periodo_fim: '2026-10-31',
      quantidade_registros: 1,
      valor_total: 100.0,
      status: 'AGUARDANDO_VALIDACAO_RH',
      itens: [{ id: 'i-1', colaborador_id: 'col-1', total: 100, horas_trabalhadas: 8, status_pipeline: 'EM_ANALISE_RH' }],
    } as any);

    const resumoComAudit = await IntermitentesLoteService.getResumoLoteIntermitente(loteId);
    expect(resumoComAudit?.auditoriaStatus).toBe('CONFIRMADA');

    // Cenário B: Sem log persistido
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'auditoria') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              contains: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const resumoSemAudit = await IntermitentesLoteService.getResumoLoteIntermitente(loteId);
    expect(resumoSemAudit?.auditoriaStatus).toBe('PENDENTE_OU_INDETERMINADA');
  });
});
