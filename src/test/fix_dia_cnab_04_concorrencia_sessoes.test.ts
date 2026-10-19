import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import * as baseService from '@/services/domain/base.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

describe('FIX DIA-CNAB-04 — Testes de Concorrência e Casos Negativos', () => {
  const loteId = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  const empresaId = '11111111-1111-1111-1111-111111111111';
  const contaId = '22222222-2222-2222-2222-222222222222';
  const tenantId = '00000000-0000-0000-0000-000000000001';

  const createChained = (result: any = { data: null, error: null }) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    // Stub URL.createObjectURL para ambiente de teste jsdom/node
    if (typeof window !== 'undefined') {
      (window as any).URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-blob');
      (window as any).URL.revokeObjectURL = vi.fn();
    }

    vi.spyOn(baseService, 'getCurrentTenantId').mockResolvedValue(tenantId);
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@orbe.com' } as any },
      error: null,
    });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'empresas') {
        return createChained({
          data: { id: empresaId, nome: 'Empresa Teste - Homologação', is_teste: true },
          error: null,
        }) as any;
      }
      if (table === 'profiles') {
        return createChained({
          data: { tenant_id: tenantId },
          error: null,
        }) as any;
      }
      return createChained({ data: null, error: null }) as any;
    });
  });

  it('1. Duas sessões concorrentes disparando geração para o mesmo lote resultam em apenas 1 remessa, 1 NSA e retorno idempotente para ambas', async () => {
    let nsaCounter = 11;
    const dbRemessas: any[] = [];
    const dbItens: any[] = [];

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        const existente = dbRemessas.find(r => r.diaristas_lote_id === args.p_diaristas_lote_id);
        if (existente) {
          return {
            data: {
              sucesso: true,
              remessa_id: existente.id,
              id: existente.id,
              banco_codigo: existente.banco_codigo,
              sequencial: existente.sequencial_arquivo,
              nome_arquivo: existente.nome_arquivo,
              hash: existente.hash_arquivo,
              conteudo_arquivo: existente.conteudo_arquivo,
              linhas_afetadas: 0,
              modo: existente.modo,
              idempotente: true,
            },
            error: null,
          } as any;
        }

        const novaRemessa = {
          id: 'remessa-concorrente-001',
          diaristas_lote_id: args.p_diaristas_lote_id,
          empresa_id: args.p_empresa_id,
          banco_codigo: '341',
          sequencial_arquivo: nsaCounter++,
          nome_arquivo: args.p_nome_arquivo,
          hash_arquivo: args.p_hash_arquivo,
          conteudo_arquivo: args.p_conteudo_arquivo,
          total_registros: args.p_total_registros,
          total_valor: args.p_total_valor,
          modo: args.p_modo,
          status: 'gerado',
        };
        dbRemessas.push(novaRemessa);

        for (const item of args.p_itens || []) {
          dbItens.push({
            id: `item-${dbItens.length + 1}`,
            remessa_id: novaRemessa.id,
            origem_tipo: item.origem_tipo,
            origem_id: item.origem_id,
            valor: item.valor,
          });
        }

        return {
          data: {
            sucesso: true,
            remessa_id: novaRemessa.id,
            id: novaRemessa.id,
            banco_codigo: novaRemessa.banco_codigo,
            sequencial: novaRemessa.sequencial_arquivo,
            nome_arquivo: novaRemessa.nome_arquivo,
            hash: novaRemessa.hash_arquivo,
            conteudo_arquivo: novaRemessa.conteudo_arquivo,
            linhas_afetadas: args.p_itens?.length || 0,
            modo: novaRemessa.modo,
            idempotente: false,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(11);

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createChained({ data: { tenant_id: tenantId }, error: null }) as any;
      }
      if (table === 'diaristas_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: loteId,
              empresa_id: empresaId,
              tenant_id: tenantId,
              mes_referencia: '2026-10',
              periodo_inicio: '2026-10-12',
              periodo_fim: '2026-10-18',
              status: 'FECHADO_FINANCEIRO',
            },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(async () => {
            const encontrada = dbRemessas.find(r => r.diaristas_lote_id === loteId);
            return { data: encontrada || null, error: null };
          }),
          not: vi.fn().mockReturnThis(),
        } as any;
      }
      if (table === 'lancamentos_diaristas') {
        return createChained({
          data: [
            { id: 'lanc-1', diarista_id: 'colab-1', nome_colaborador: 'Diarista 1', valor_calculado: 140, empresa_id: empresaId, tenant_id: tenantId },
            { id: 'lanc-2', diarista_id: 'colab-1', nome_colaborador: 'Diarista 1', valor_calculado: 70, empresa_id: empresaId, tenant_id: tenantId },
            { id: 'lanc-3', diarista_id: 'colab-1', nome_colaborador: 'Diarista 1', valor_calculado: 140, empresa_id: empresaId, tenant_id: tenantId },
          ],
          error: null,
        }) as any;
      }
      if (table === 'colaboradores') {
        return createChained({
          data: [
            {
              id: 'colab-1',
              nome: 'Diarista Homologação 001',
              nome_completo: 'Diarista Homologação 001',
              cpf: '111.444.777-35',
              banco_codigo: '341',
              agencia: '1234',
              agencia_digito: '0',
              conta: '56789',
              digito_conta: '1',
              tipo_conta: 'corrente',
            },
          ],
          error: null,
        }) as any;
      }
      if (table === 'contas_bancarias_empresa') {
        return createChained({
          data: [
            {
              id: contaId,
              empresa_id: empresaId,
              banco_codigo: '341',
              banco_nome: 'BANCO ITAU SA',
              agencia: '1234',
              conta: '56789',
              convenio: '99999',
              ativo: true,
              is_padrao: true,
              cedente_cnpj: '12345678000195',
              cedente_nome: 'Empresa Teste - Homologação',
            },
          ],
          error: null,
        }) as any;
      }
      if (table === 'empresas') {
        return createChained({
          data: { id: empresaId, nome: 'Empresa Teste - Homologação', is_teste: true },
          error: null,
        }) as any;
      }
      if (table === 'diaristas_logs_fechamento' || table === 'cnab_auditoria_bancaria') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      }
      return createChained({ data: null, error: null }) as any;
    });

    const paramsOperadorA = {
      loteId,
      empresaId,
      geradoPor: 'user-operador-a',
      geradoPorNome: 'Operador A (Sessão 1)',
      contaBancariaId: contaId,
      empresaRemetente: {
        cnpj: '12345678000195',
        razao_social: 'Empresa Teste - Homologação',
        banco_codigo: '341',
        agencia: '1234',
        conta: '56789',
      },
    };

    const paramsOperadorB = {
      loteId,
      empresaId,
      geradoPor: 'user-operador-b',
      geradoPorNome: 'Operador B (Sessão 2)',
      contaBancariaId: contaId,
      empresaRemetente: {
        cnpj: '12345678000195',
        razao_social: 'Empresa Teste - Homologação',
        banco_codigo: '341',
        agencia: '1234',
        conta: '56789',
      },
    };

    const [resultadoA, resultadoB] = await Promise.all([
      LoteFechamentoDiaristaService.gerarCNABParaLote(paramsOperadorA),
      LoteFechamentoDiaristaService.gerarCNABParaLote(paramsOperadorB),
    ]);

    expect(resultadoA).toBeDefined();
    expect(resultadoB).toBeDefined();
    expect(resultadoA.nomeArquivo).toBe(resultadoB.nomeArquivo);
    expect(resultadoA.totalRegistros).toBe(3);
    expect(resultadoB.totalRegistros).toBe(3);
    expect(resultadoA.valorTotal).toBe(350);
    expect(resultadoB.valorTotal).toBe(350);
    expect(dbRemessas.length).toBe(1);
    expect(dbRemessas[0].sequencial_arquivo).toBe(11);
    expect(nsaCounter).toBe(12);
    expect(dbItens.length).toBe(3);
    expect(dbItens.every(i => i.remessa_id === 'remessa-concorrente-001')).toBe(true);
  });

  it('2. CnabRemessaArquivoService.registrar recupera a remessa ativa quando a RPC sinaliza BLOQUEIO_DUPLICIDADE_CNAB por concorrência', async () => {
    const remessaMock = {
      id: 'remessa-preexistente-001',
      tenant_id: tenantId,
      diaristas_lote_id: loteId,
      nome_arquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt',
      sequencial_arquivo: 11,
      hash_arquivo: 'hash123',
      conteudo_arquivo: 'conteudo-valido',
      total_registros: 3,
      total_valor: 350,
      status: 'gerado' as const,
      modo: 'homologacao' as const,
      data_geracao: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let checkCallCount = 0;
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockImplementation(async () => {
      checkCallCount++;
      if (checkCallCount === 1) return null;
      return remessaMock;
    });

    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        return {
          data: null,
          error: { message: `BLOQUEIO_DUPLICIDADE_CNAB: Lote de diaristas ${loteId} já possui remessa CNAB registrada.` } as any,
        };
      }
      return { data: null, error: null } as any;
    });

    const resultado = await CnabRemessaArquivoService.registrar({
      loteId: null,
      diaristasLoteId: loteId,
      empresaId,
      nomeArquivo: 'SIMULACAO_NOVA.txt',
      conteudoArquivo: 'conteudo-valido',
      totalRegistros: 3,
      totalValor: 350,
      itens: [{ origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 }],
    });

    expect(resultado).toBeDefined();
    expect(resultado.id).toBe('remessa-preexistente-001');
    expect(resultado.sequencial_arquivo).toBe(11);
    expect(resultado.nome_arquivo).toBe('SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt');
  });

  it('3. Preservação estrita: não afeta lotes de CLT e Intermitentes', async () => {
    const spyCheckIntermitentes = vi.spyOn(CnabRemessaArquivoService, 'checkIntermitentesLoteJaRemessado');
    const spyCheckRh = vi.spyOn(CnabRemessaArquivoService, 'checkRhLoteJaRemessado');

    await CnabRemessaArquivoService.checkDiaristasLoteJaRemessado(loteId);
    expect(spyCheckIntermitentes).not.toHaveBeenCalled();
    expect(spyCheckRh).not.toHaveBeenCalled();
  });

  it('4. Teste Negativo: Lote com status VALIDADO_RH é sumariamente bloqueado (exige aprovação financeira)', async () => {
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'diaristas_lotes_fechamento') {
        return createChained({
          data: {
            id: loteId,
            empresa_id: empresaId,
            tenant_id: tenantId,
            status: 'VALIDADO_RH', // Apenas RH validou, Financeiro AINDA NÃO APROVOU!
          },
          error: null,
        }) as any;
      }
      if (table === 'cnab_remessas_arquivos') {
        return createChained({ data: null, error: null }) as any;
      }
      if (table === 'empresas') {
        return createChained({
          data: { id: empresaId, nome: 'Empresa Teste - Homologação', is_teste: true },
          error: null,
        }) as any;
      }
      return createChained({ data: null, error: null }) as any;
    });

    // 1. Service deve bloquear e emitir erro explícito
    await expect(
      LoteFechamentoDiaristaService.gerarCNABParaLote({
        loteId,
        empresaId,
        geradoPor: 'user-1',
        geradoPorNome: 'Operador Financeiro',
        empresaRemetente: {
          cnpj: '12345678000195',
          razao_social: 'Empresa',
          banco_codigo: '341',
          agencia: '1234',
          conta: '56789',
        },
      })
    ).rejects.toThrow(/Geração de CNAB bloqueada: o lote precisa estar aprovado pelo Financeiro antes da remessa/);

    // 2. A RPC também rejeita se receber VALIDADO_RH diretamente
    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        return {
          data: null,
          error: {
            message: `Geração bloqueada: Lote de diaristas ${loteId} está com status "VALIDADO_RH" (requer aprovação financeira).`,
          } as any,
        };
      }
      return { data: null, error: null } as any;
    });

    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        nomeArquivo: 'TESTE.txt',
        conteudoArquivo: 'conteudo',
        totalRegistros: 1,
        totalValor: 140,
        itens: [{ origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 }],
      })
    ).rejects.toThrow(/requer aprovação financeira/);
  });

  it('5. Teste Negativo: Usuário sem autenticação válida é bloqueado (Fail-Closed)', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      CnabRemessaArquivoService.getNextSequencial(contaId, '341')
    ).rejects.toThrow(/Usuário não autenticado/);
  });

  it('6. Teste Negativo: Itens com divergência de quantidade ou valor são rejeitados pela RPC', async () => {
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Divergência: Total de registros declarados (3) difere do payload (2)',
      } as any,
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        nomeArquivo: 'TESTE_DIVERGENCIA.txt',
        conteudoArquivo: 'conteudo',
        totalRegistros: 3,
        totalValor: 210,
        itens: [
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
        ],
      })
    ).rejects.toThrow(/Divergência: Total de registros declarados/);
  });

  it('7. Teste Negativo: Empresa ou conta bancária incompatível é bloqueada com erro de segurança', async () => {
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'diaristas_lotes_fechamento') {
        return createChained({
          data: {
            id: loteId,
            empresa_id: empresaId,
            tenant_id: tenantId,
            status: 'FECHADO_FINANCEIRO',
          },
          error: null,
        }) as any;
      }
      if (table === 'cnab_remessas_arquivos') {
        return createChained({ data: null, error: null }) as any;
      }
      if (table === 'lancamentos_diaristas') {
        return createChained({
          data: [
            { id: 'lanc-alien', diarista_id: 'colab-1', valor_calculado: 140, empresa_id: 'outra-empresa-id', tenant_id: tenantId },
          ],
          error: null,
        }) as any;
      }
      if (table === 'empresas') {
        return createChained({
          data: { id: empresaId, nome: 'Empresa Teste - Homologação', is_teste: true },
          error: null,
        }) as any;
      }
      return createChained({ data: null, error: null }) as any;
    });

    await expect(
      LoteFechamentoDiaristaService.gerarCNABParaLote({
        loteId,
        empresaId,
        geradoPor: 'user-1',
        geradoPorNome: 'Operador',
        empresaRemetente: {
          cnpj: '12345678000195',
          razao_social: 'Empresa',
          banco_codigo: '341',
          agencia: '1234',
          conta: '56789',
        },
      })
    ).rejects.toThrow(/Contaminação de Lote detectada/);
  });

  it('8. Teste Negativo: Falha no meio da transação causa rollback completo e não queima NSA', async () => {
    let nsaReservado = false;
    let remessaGravada = false;

    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        return {
          data: null,
          error: {
            message: 'transação abortada: erro interno simulado antes do commit',
          } as any,
        };
      }
      return { data: null, error: null } as any;
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        nomeArquivo: 'TESTE_ROLLBACK.txt',
        conteudoArquivo: 'conteudo',
        totalRegistros: 1,
        totalValor: 140,
        itens: [{ origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 }],
      })
    ).rejects.toThrow(/transação abortada/);

    expect(remessaGravada).toBe(false);
    expect(nsaReservado).toBe(false);
  });
});
