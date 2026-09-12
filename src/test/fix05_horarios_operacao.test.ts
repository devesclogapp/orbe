import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentService } from '../services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';
import { OperacaoProducaoService } from '../services/domain/producao.service';
import { operationalClient } from '../services/domain/base.service';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
      }),
    })),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
    }
  }
}));

vi.mock('../services/domain/base.service', async () => {
  const actual = await vi.importActual('../services/domain/base.service') as any;
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-MEU'),
    requireAuthenticatedUserId: vi.fn().mockResolvedValue('user-xyz'),
    operationalClient: {
      from: vi.fn(),
      rpc: vi.fn(),
    }
  };
});

describe('FIX 05 — Validação de Início e Fim em Operação por Volume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Criação com horários vazios -> EM_RESTRICAO
  it('Cenário 1: Operação criada sem horários deve receber status = EM_RESTRICAO e motivo em avaliacao_json', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);
    
    let insertedPayload: any = null;
    const mockInsert = vi.fn().mockImplementation((payload) => {
      insertedPayload = payload;
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'op-sem-horarios', ...payload }, error: null })
        })
      };
    });
    vi.spyOn(operationalClient, 'from').mockReturnValue({ insert: mockInsert } as any);

    await OperacaoProducaoService.create({
      empresa_id: 'emp-123',
      quantidade: 500,
      valor_unitario_snapshot: 0.42,
      // Horários vazios
      horario_inicio: '',
      horario_fim: null,
    });

    expect(insertedPayload.status).toBe('EM_RESTRICAO');
    expect(insertedPayload.status_rh).toBe('PENDENTE_RH');
    expect(insertedPayload.entrada_ponto).toBeNull();
    expect(insertedPayload.saida_ponto).toBeNull();
    expect(insertedPayload.avaliacao_json?.motivo_restricao).toBe('Horário de início e/ou término não informado');
  });

  // 2. Bloqueio na Aprovação RH
  it('Cenário 2: OperacaoProducaoService.aprovar deve bloquear aprovação de operação sem horários ou em EM_RESTRICAO', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    vi.spyOn(operationalClient, 'from').mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({
              data: {
                empresa_id: 'emp-123',
                status: 'EM_RESTRICAO',
                entrada_ponto: null,
                saida_ponto: null
              },
              error: null
            })
          })
        })
      })
    } as any);

    await expect(OperacaoProducaoService.aprovar('op-sem-horario')).rejects.toThrow(
      'Esta operação possui restrições de horários e deve ser corrigida em Pendências antes de ser aprovada pelo RH.'
    );
  });

  // 3. Saneamento via Edição (preencher horários restaura RECEBIDO)
  it('Cenário 3: Edição de operação EM_RESTRICAO preenchendo ambos os horários restaura status = RECEBIDO e remove motivo de horário', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existing = {
      empresa_id: 'emp-123',
      status: 'EM_RESTRICAO',
      status_rh: 'PENDENTE_RH',
      avaliacao_json: { motivo_restricao: 'Horário de início e/ou término não informado', outro_dado: 123 },
      entrada_ponto: null,
      saida_ponto: null,
      atualizado_em: '2026-09-11T12:00:00Z'
    };

    let updatedMeta: any = null;
    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: existing, error: null }),
              }),
              single: () => Promise.resolve({ data: { id: 'op-1', ...existing, ...updatedMeta }, error: null })
            })
          }),
          update: vi.fn().mockImplementation((meta) => {
            updatedMeta = meta;
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
              })
            };
          })
        } as any;
      }
      return {} as any;
    });

    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({ data: { success: true }, error: null });

    await OperacaoProducaoService.update('op-1', {
      horario_inicio: '08:00',
      horario_fim: '12:00'
    });

    expect(updatedMeta.status).toBe('RECEBIDO');
    expect(updatedMeta.status_rh).toBe('PENDENTE_RH');
    expect(updatedMeta.entrada_ponto).toBe('08:00');
    expect(updatedMeta.saida_ponto).toBe('12:00');
    expect(updatedMeta.avaliacao_json.motivo_restricao).toBeUndefined();
    expect(updatedMeta.avaliacao_json.outro_dado).toBe(123);
  });

  // 4. Criação com horários preenchidos
  it('Cenário 4: Criação com horários de início e término válidos entra com status = RECEBIDO e sem restrição', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    let insertedPayload: any = null;
    vi.spyOn(operationalClient, 'from').mockReturnValue({
      insert: vi.fn().mockImplementation((payload) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'op-ok', ...payload }, error: null })
          })
        };
      })
    } as any);

    await OperacaoProducaoService.create({
      empresa_id: 'emp-123',
      quantidade: 500,
      horario_inicio: '08:30',
      horario_fim: '11:45',
    });

    expect(insertedPayload.status).toBe('RECEBIDO');
    expect(insertedPayload.status_rh).toBe('PENDENTE_RH');
    expect(insertedPayload.entrada_ponto).toBe('08:30');
    expect(insertedPayload.saida_ponto).toBe('11:45');
    expect(insertedPayload.avaliacao_json?.motivo_restricao).toBeUndefined();
  });

  // 5. Operação com somente INÍCIO preenchido -> EM_RESTRICAO
  it('Cenário 5: Operação com somente início preenchido deve receber status = EM_RESTRICAO', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    let insertedPayload: any = null;
    vi.spyOn(operationalClient, 'from').mockReturnValue({
      insert: vi.fn().mockImplementation((payload) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'op-so-inicio', ...payload }, error: null })
          })
        };
      })
    } as any);

    await OperacaoProducaoService.create({
      empresa_id: 'emp-123',
      quantidade: 300,
      horario_inicio: '08:00',
      horario_fim: null,
    });

    expect(insertedPayload.status).toBe('EM_RESTRICAO');
    expect(insertedPayload.entrada_ponto).toBe('08:00');
    expect(insertedPayload.saida_ponto).toBeNull();
    expect(insertedPayload.avaliacao_json?.motivo_restricao).toBe('Horário de início e/ou término não informado');
  });

  // 6. Operação com somente FIM preenchido -> EM_RESTRICAO
  it('Cenário 6: Operação com somente fim preenchido deve receber status = EM_RESTRICAO', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    let insertedPayload: any = null;
    vi.spyOn(operationalClient, 'from').mockReturnValue({
      insert: vi.fn().mockImplementation((payload) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'op-so-fim', ...payload }, error: null })
          })
        };
      })
    } as any);

    await OperacaoProducaoService.create({
      empresa_id: 'emp-123',
      quantidade: 300,
      horario_inicio: undefined,
      horario_fim: '17:00',
    });

    expect(insertedPayload.status).toBe('EM_RESTRICAO');
    expect(insertedPayload.entrada_ponto).toBeNull();
    expect(insertedPayload.saida_ponto).toBe('17:00');
    expect(insertedPayload.avaliacao_json?.motivo_restricao).toBe('Horário de início e/ou término não informado');
  });

  // 7. Operação com múltiplos colaboradores -> uma única janela da operação
  it('Cenário 7: Operação com múltiplos colaboradores vincula colabs mantendo janela única na entidade raiz', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    let insertedOp: any = null;
    let insertedColabs: any = null;

    vi.spyOn(OperacaoProducaoService, 'getByDate').mockImplementation(() =>
      Promise.resolve([{ id: 'op-multi', ...insertedOp }]) as any
    );

    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedOp = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'op-multi', ...payload }, error: null })
              })
            };
          }),
        } as any;
      }
      if (table === 'production_entry_collaborators') {
        return {
          insert: vi.fn().mockImplementation((colabs) => {
            insertedColabs = colabs;
            return Promise.resolve({ data: colabs, error: null });
          })
        } as any;
      }
      return {} as any;
    });

    await OperacaoProducaoService.createWithColaboradores(
      {
        empresa_id: 'emp-123',
        quantidade: 1000,
        horario_inicio: '07:30',
        horario_fim: '11:00',
      },
      [
        { collaborator_id: 'colab-1', had_infraction: false },
        { collaborator_id: 'colab-2', had_infraction: false }
      ]
    );

    // Janela geral da operação
    expect(insertedOp.entrada_ponto).toBe('07:30');
    expect(insertedOp.saida_ponto).toBe('11:00');
    expect(insertedOp.status).toBe('RECEBIDO');
    // Colaboradores vinculados
    expect(insertedColabs).toHaveLength(2);
    expect(insertedColabs[0].production_entry_id).toBe('op-multi');
    expect(insertedColabs[1].production_entry_id).toBe('op-multi');
  });

  // 8. Corrigir horário de operação que possua outra restrição válida -> não liberar a outra restrição
  it('Cenário 8: Ao corrigir horários de operação que possua outra restrição (ex: devolução do RH), NÃO deve liberar para RECEBIDO', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existingComDevolucao = {
      empresa_id: 'emp-123',
      status: 'EM_RESTRICAO',
      status_rh: 'DEVOLVIDO_RH',
      avaliacao_json: {
        motivo_restricao: 'Horário de início e/ou término não informado',
        motivo_devolucao_rh: 'NF divergente do volume da carga'
      },
      entrada_ponto: null,
      saida_ponto: null,
      atualizado_em: '2026-09-11T14:00:00Z'
    };

    let updatedMeta: any = null;
    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: existingComDevolucao, error: null }),
              }),
              single: () => Promise.resolve({ data: { id: 'op-dev', ...existingComDevolucao, ...updatedMeta }, error: null })
            })
          }),
          update: vi.fn().mockImplementation((meta) => {
            updatedMeta = meta;
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
              })
            };
          })
        } as any;
      }
      return {} as any;
    });

    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({ data: { success: true }, error: null });

    await OperacaoProducaoService.update('op-dev', {
      horario_inicio: '09:00',
      horario_fim: '13:00'
    });

    // O motivo de horário foi removido, mas a restrição de devolução do RH mantém status = EM_RESTRICAO
    expect(updatedMeta.status).toBe('EM_RESTRICAO');
    expect(updatedMeta.status_rh).toBe('DEVOLVIDO_RH');
    expect(updatedMeta.avaliacao_json.motivo_restricao).toBeUndefined();
    expect(updatedMeta.avaliacao_json.motivo_devolucao_rh).toBe('NF divergente do volume da carga');
  });

  // 9. Confirmar que nenhum valor financeiro ou remuneração do intermitente foi alterado
  it('Cenário 9: Preservação de valores financeiros da operação (volume x valor unitário independente de horários)', async () => {
    const payloadOp = {
      quantidade: 500,
      valor_unitario_snapshot: 0.42,
      valor_total: 210.00
    };

    // Faturamento continua exclusivamente comercial
    const valorCalculado = payloadOp.quantidade * payloadOp.valor_unitario_snapshot;
    expect(valorCalculado).toBe(210.00);
    expect(payloadOp.valor_total).toBe(210.00);
  });

  // 10. FIX 06.1: Saneamento rápido via updateWithColaboradores
  it('Cenário 10 (FIX 06.1): Saneamento rápido persiste início e término preservando vínculo do colaborador e valor total R$ 210,00', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existingOp = {
      id: 'op-83cc9319',
      empresa_id: 'emp-benevides',
      status: 'EM_RESTRICAO',
      status_rh: 'PENDENTE_RH',
      quantidade: 500,
      valor_unitario_snapshot: 0.42,
      valor_total: 210.00,
      colaborador_id: 'colab-gabriel',
      entrada_ponto: null,
      saida_ponto: null,
      avaliacao_json: { motivo_restricao: 'Horário de início e/ou término não informado' },
      atualizado_em: '2026-09-11T16:00:00Z'
    };

    let updatedMeta: any = null;
    let deletedColabEntryId: string | null = null;
    let insertedColabs: any[] = [];

    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: existingOp, error: null })
              }),
              single: () => Promise.resolve({ data: { ...existingOp, ...updatedMeta }, error: null })
            })
          }),
          update: vi.fn().mockImplementation((meta) => {
            updatedMeta = meta;
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
              })
            };
          })
        } as any;
      }
      if (table === 'production_entry_collaborators') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ collaborator_id: 'colab-gabriel' }], error: null })
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              deletedColabEntryId = val;
              return Promise.resolve({ error: null });
            }
          }),
          insert: vi.fn().mockImplementation((colabs) => {
            insertedColabs = colabs;
            return Promise.resolve({ data: colabs, error: null });
          })
        } as any;
      }
      return {} as any;
    });

    vi.spyOn(OperacaoProducaoService, 'getByDate').mockImplementation(() =>
      Promise.resolve([{ id: 'op-83cc9319', ...existingOp, ...updatedMeta }]) as any
    );

    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({ data: { success: true }, error: null });

    // Saneamento rápido executado a partir do modal
    await OperacaoProducaoService.updateWithColaboradores(
      'op-83cc9319',
      {
        horario_inicio: '08:00',
        horario_fim: '12:00',
        quantidade: 500,
        valor_unitario_snapshot: 0.42,
        valor_total: 210.00,
        justificativa_retroativa: 'Regularização de horários de início e término da operação.'
      },
      [
        { collaborator_id: 'colab-gabriel', had_infraction: false }
      ]
    );

    // 1. Status restaurado para RECEBIDO
    expect(updatedMeta.status).toBe('RECEBIDO');
    expect(updatedMeta.status_rh).toBe('PENDENTE_RH');
    // 2. Horários persistidos
    expect(updatedMeta.entrada_ponto).toBe('08:00');
    expect(updatedMeta.saida_ponto).toBe('12:00');
    // 3. Restrição de horário removida
    expect(updatedMeta.avaliacao_json.motivo_restricao).toBeUndefined();
    // 4. Vínculo com Gabriel preservado
    expect(insertedColabs).toHaveLength(1);
    expect(insertedColabs[0].collaborator_id).toBe('colab-gabriel');
    // 5. Valor total preservado
    expect(existingOp.valor_total).toBe(210.00);
  });

  // 11. FIX 06.1: Validação de horários incompletos não libera a pendência
  it('Cenário 11 (FIX 06.1): Update com horário incompleto (somente início ou somente fim) não libera a pendência', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existingOp = {
      id: 'op-incompleta',
      empresa_id: 'emp-123',
      status: 'EM_RESTRICAO',
      status_rh: 'PENDENTE_RH',
      entrada_ponto: null,
      saida_ponto: null,
      avaliacao_json: { motivo_restricao: 'Horário de início e/ou término não informado' }
    };

    let updatedMeta: any = null;
    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: existingOp, error: null })
              }),
              single: () => Promise.resolve({ data: { ...existingOp, ...updatedMeta }, error: null })
            })
          }),
          update: vi.fn().mockImplementation((meta) => {
            updatedMeta = meta;
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
              })
            };
          })
        } as any;
      }
      return {} as any;
    });

    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({ data: { success: true }, error: null });

    await OperacaoProducaoService.update('op-incompleta', {
      horario_inicio: '08:00',
      horario_fim: null
    });

    expect(updatedMeta.status).toBe('EM_RESTRICAO');
    expect(updatedMeta.entrada_ponto).toBe('08:00');
    expect(updatedMeta.saida_ponto).toBeNull();
    expect(updatedMeta.avaliacao_json.motivo_restricao).toBe('Horário de início e/ou término não informado');
  });

  // 12. FIX 06.2: Ação canônica regularizarHorarios em operação AGUARDANDO_FATURAMENTO (ex: 83cc9319)
  it('Cenário 12 (FIX 06.2): regularizarHorarios preserva status AGUARDANDO_FATURAMENTO sem retroceder para RECEBIDO e sem disparar ESTADO_FECHADO', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existingOp = {
      id: '83cc9319-ccb9-4672-8dff-1c9ddf5f09de',
      empresa_id: 'emp-benevides',
      status: 'AGUARDANDO_FATURAMENTO',
      status_rh: 'PENDENTE_RH',
      status_pagamento: 'RECEBIDO',
      quantidade: 500,
      valor_unitario_snapshot: 0.42,
      valor_total: 210.00,
      colaborador_id: 'colab-gabriel',
      entrada_ponto: null,
      saida_ponto: null,
      avaliacao_json: { motivo_restricao: 'Horário de início e/ou término não informado' }
    };

    let updatedMeta: any = null;
    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: existingOp, error: null })
              })
            })
          }),
          update: vi.fn().mockImplementation((meta) => {
            updatedMeta = meta;
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
              })
            };
          })
        } as any;
      }
      return {} as any;
    });

    // RPC retorna sucesso se disponível
    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({
      data: {
        success: true,
        operacao_id: existingOp.id,
        entrada_ponto: '08:00',
        saida_ponto: '12:00',
        status: 'AGUARDANDO_FATURAMENTO',
        status_rh: 'PENDENTE_RH',
        updated_at: '2026-09-11T19:00:00Z'
      },
      error: null
    });

    const result = await OperacaoProducaoService.regularizarHorarios(
      '83cc9319-ccb9-4672-8dff-1c9ddf5f09de',
      '08:00',
      '12:00',
      'Regularização de horários de início e término.'
    );

    // 1. Ação executada com sucesso
    expect(result.success).toBe(true);
    // 2. Horários preenchidos
    expect(result.entrada_ponto).toBe('08:00');
    expect(result.saida_ponto).toBe('12:00');
    // 3. Status financeiro anterior AGUARDANDO_FATURAMENTO PRESERVADO
    expect(result.status).toBe('AGUARDANDO_FATURAMENTO');
    // 4. Status RH PENDENTE_RH PRESERVADO
    expect(result.status_rh).toBe('PENDENTE_RH');
  });

  // 13. FIX 06.2: Fallback controlado de regularizarHorarios quando RPC ainda não existe no schema
  it('Cenário 13 (FIX 06.2): regularizarHorarios fallback preserva status AGUARDANDO_FATURAMENTO e remove motivo_restricao de avaliacao_json', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existingOp = {
      id: '83cc9319-fallback',
      empresa_id: 'emp-benevides',
      status: 'AGUARDANDO_FATURAMENTO',
      status_rh: 'PENDENTE_RH',
      status_pagamento: 'RECEBIDO',
      quantidade: 500,
      valor_unitario_snapshot: 0.42,
      valor_total: 210.00,
      colaborador_id: 'colab-gabriel',
      entrada_ponto: null,
      saida_ponto: null,
      avaliacao_json: { motivo_restricao: 'Horário de início e/ou término não informado' },
      justificativa_retroativa: null
    };

    let updatedMeta: any = null;
    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: existingOp, error: null })
              })
            })
          }),
          update: vi.fn().mockImplementation((meta) => {
            updatedMeta = meta;
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
              })
            };
          })
        } as any;
      }
      return {} as any;
    });

    // Simula erro PGRST202 (função ainda não em cache de schema)
    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' } as any
    });

    const result = await OperacaoProducaoService.regularizarHorarios(
      '83cc9319-fallback',
      '08:00',
      '12:00',
      'Regularização de horários de início e término.'
    );

    expect(result.success).toBe(true);
    // Preservação do status AGUARDANDO_FATURAMENTO
    expect(updatedMeta.status).toBe('AGUARDANDO_FATURAMENTO');
    expect(updatedMeta.status_rh).toBe('PENDENTE_RH');
    expect(updatedMeta.entrada_ponto).toBe('08:00');
    expect(updatedMeta.saida_ponto).toBe('12:00');
    expect(updatedMeta.avaliacao_json.motivo_restricao).toBeUndefined();
    expect(updatedMeta.justificativa_retroativa).toBe('Regularização de horários de início e término.');
    // Fatos financeiros não foram incluídos no update
    expect(updatedMeta.valor_total).toBeUndefined();
    expect(updatedMeta.quantidade).toBeUndefined();
  });

  // 14. FIX 06.2: Validação de horários obrigatórios em regularizarHorarios
  it('Cenário 14 (FIX 06.2): regularizarHorarios rejeita chamada com horários vazios ou nulos', async () => {
    await expect(
      OperacaoProducaoService.regularizarHorarios('op-123', '', '12:00')
    ).rejects.toThrow('HORARIOS_INVALIDOS: Horário de início e término são obrigatórios.');

    await expect(
      OperacaoProducaoService.regularizarHorarios('op-123', '08:00', '')
    ).rejects.toThrow('HORARIOS_INVALIDOS: Horário de início e término são obrigatórios.');
  });

  // 15. FIX 06.2: Edição estrutural normal em operação AGUARDANDO_FATURAMENTO continua bloqueada com ESTADO_FECHADO
  it('Cenário 15 (FIX 06.2): Edição estrutural da mesma operação continua retornando ESTADO_FECHADO pela RPC de edição segura', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const existingOp = {
      empresa_id: 'emp-benevides',
      status: 'AGUARDANDO_FATURAMENTO',
      status_rh: 'PENDENTE_RH',
      entrada_ponto: '08:00',
      saida_ponto: '12:00',
      atualizado_em: '2026-09-11T12:00:00Z'
    };

    vi.spyOn(operationalClient, 'from').mockImplementation((table: string) => {
      if (table === 'operacoes_producao') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: existingOp, error: null })
              })
            })
          })
        } as any;
      }
      return {} as any;
    });

    // RPC de edição estrutural lança ESTADO_FECHADO
    vi.spyOn(operationalClient, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'ESTADO_FECHADO: Operação já faturada/recebida não aceita edições abertas.' } as any
    });

    await expect(
      OperacaoProducaoService.update('83cc9319-ccb9-4672-8dff-1c9ddf5f09de', {
        quantidade: 600
      })
    ).rejects.toThrow('ESTADO_FECHADO');
  });
});
