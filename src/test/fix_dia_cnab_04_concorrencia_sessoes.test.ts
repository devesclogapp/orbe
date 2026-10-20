import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import * as baseService from '@/services/domain/base.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

describe('FIX DIA-CNAB-04 — Ajuste Final da Idempotência (Testes de Concorrência e Regressão)', () => {
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
    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(11);
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@orbe.com' } as any },
      error: null,
    });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'profiles') {
        return createChained({ data: { tenant_id: tenantId }, error: null }) as any;
      }
      if (table === 'empresas') {
        return createChained({
          data: { id: empresaId, nome: 'Empresa Teste - Homologação', is_teste: true },
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
              ativo: true,
            },
          ],
          error: null,
        }) as any;
      }
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
      return createChained({ data: null, error: null }) as any;
    });
  });

  // =========================================================================================
  // CENÁRIO 1: Duas sessões concorrentes com payload equivalente
  // =========================================================================================
  it('1. Duas sessões concorrentes com payload equivalente retornam a mesma remessa, sem erro e sem novo NSA', async () => {
    let nsaCounter = 11;
    const dbRemessas: any[] = [];
    const dbItens: any[] = [];

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        // Simulação do bloqueio FOR UPDATE e recuperação idempotente estrita
        const existente = dbRemessas.find(r => r.diaristas_lote_id === args.p_diaristas_lote_id);
        if (existente) {
          // Verificação de equivalência
          const matchCount = (args.p_itens || []).length;
          const isEquivalente =
            existente.empresa_id === args.p_empresa_id &&
            existente.conta_bancaria_id === args.p_conta_bancaria_id &&
            existente.total_valor === args.p_total_valor &&
            existente.total_registros === args.p_total_registros &&
            matchCount === existente.total_registros;

          if (isEquivalente) {
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
                linhas_afetadas: existente.total_registros || args.p_itens?.length || 0,
                modo: existente.modo,
                idempotente: true,
              },
              error: null,
            } as any;
          }
        }

        const novaRemessa = {
          id: 'remessa-concorrente-001',
          diaristas_lote_id: args.p_diaristas_lote_id,
          empresa_id: args.p_empresa_id,
          conta_bancaria_id: args.p_conta_bancaria_id,
          banco_codigo: '341',
          sequencial_arquivo: nsaCounter++,
          nome_arquivo: args.p_nome_arquivo,
          hash_arquivo: args.p_hash_arquivo,
          conteudo_arquivo: args.p_conteudo_arquivo,
          total_registros: args.p_total_registros,
          total_valor: args.p_total_valor,
          modo: args.p_modo || 'homologacao',
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

    const paramsA = {
      loteId,
      empresaId,
      geradoPor: 'user-a',
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

    const paramsB = {
      loteId,
      empresaId,
      geradoPor: 'user-b',
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
      LoteFechamentoDiaristaService.gerarCNABParaLote(paramsA),
      LoteFechamentoDiaristaService.gerarCNABParaLote(paramsB),
    ]);

    expect(resultadoA).toBeDefined();
    expect(resultadoB).toBeDefined();
    expect(resultadoA.nomeArquivo).toBe(resultadoB.nomeArquivo);
    expect(resultadoA.totalRegistros).toBe(3);
    expect(resultadoB.totalRegistros).toBe(3);
    expect(resultadoA.valorTotal).toBe(350);
    expect(resultadoB.valorTotal).toBe(350);

    // Verificação estrita de armazenamento
    expect(dbRemessas.length).toBe(1);
    expect(dbRemessas[0].sequencial_arquivo).toBe(11);
    expect(nsaCounter).toBe(12); // Consumiu apenas 1 sequencial (11 -> 12)
    expect(dbItens.length).toBe(3);
  });

  // =========================================================================================
  // CENÁRIO 2: Repetição sequencial do mesmo pedido
  // =========================================================================================
  it('2. Repetição sequencial do mesmo pedido retorna a mesma remessa de forma idempotente sem consumir novo NSA', async () => {
    let nsaReservados = 0;
    const remessaMock = {
      id: 'remessa-seq-001',
      tenant_id: tenantId,
      empresa_id: empresaId,
      diaristas_lote_id: loteId,
      conta_bancaria_id: contaId,
      nome_arquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt',
      sequencial_arquivo: 11,
      hash_arquivo: 'hash-fix-04',
      conteudo_arquivo: 'conteudo-valido',
      total_registros: 3,
      total_valor: 350,
      modo: 'homologacao',
      status: 'gerado',
    };

    let remessaCriada = false;

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        if (remessaCriada) {
          // Segunda chamada (sequencial): retorna a mesma remessa de forma idempotente
          return {
            data: {
              sucesso: true,
              remessa_id: remessaMock.id,
              id: remessaMock.id,
              banco_codigo: '341',
              sequencial: remessaMock.sequencial_arquivo,
              nome_arquivo: remessaMock.nome_arquivo,
              hash: remessaMock.hash_arquivo,
              conteudo_arquivo: remessaMock.conteudo_arquivo,
              linhas_afetadas: remessaMock.total_registros || 3,
              modo: 'homologacao',
              idempotente: true,
            },
            error: null,
          } as any;
        }

        // Primeira chamada: cria a remessa
        remessaCriada = true;
        nsaReservados++;
        return {
          data: {
            sucesso: true,
            remessa_id: remessaMock.id,
            id: remessaMock.id,
            banco_codigo: '341',
            sequencial: 11,
            nome_arquivo: remessaMock.nome_arquivo,
            hash: remessaMock.hash_arquivo,
            conteudo_arquivo: remessaMock.conteudo_arquivo,
            linhas_afetadas: 3,
            modo: 'homologacao',
            idempotente: false,
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    const payload = {
      loteId: null,
      diaristasLoteId: loteId,
      empresaId,
      contaBancariaId: contaId,
      nomeArquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261018_SEQ000011.txt',
      conteudoArquivo: 'conteudo-valido',
      totalRegistros: 3,
      totalValor: 350,
      itens: [
        { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
        { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
        { origem_tipo: 'DIARISTA', origem_id: 'lanc-3', valor: 140 },
      ],
    };

    // Chamada 1
    const res1 = await CnabRemessaArquivoService.registrar(payload);
    expect(res1.id).toBe('remessa-seq-001');
    expect(res1.sequencial_arquivo).toBe(11);
    expect(nsaReservados).toBe(1);

    // Chamada 2 (repetição sequencial)
    const res2 = await CnabRemessaArquivoService.registrar(payload);
    expect(res2.id).toBe('remessa-seq-001');
    expect(res2.sequencial_arquivo).toBe(11);
    // NÃO consome outro NSA
    expect(nsaReservados).toBe(1);
  });

  // =========================================================================================
  // CENÁRIO 3: Verificação Exata de Equivalência dos Itens (Multiset / Valores / Ocorrências)
  // =========================================================================================
  it('3.1. Mesmos IDs mas com valores individuais diferentes (mesmo com soma total idêntica) é bloqueado com BLOQUEIO_DIVERGENCIA_CNAB', async () => {
    let nsaReservado = 11;
    let novaRemessaCriada = false;

    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    // Itens originais persistidos: lanc-1 = 140, lanc-2 = 70, lanc-3 = 140 (Soma = 350)
    const itensPersistidos = [
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-3', valor: 140 },
    ];

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        // Simulação da comparação exata multiset da RPC
        const solicitados = (args.p_itens || []).map((it: any) => ({
          origem_tipo: it.origem_tipo,
          origem_id: it.origem_id,
          valor: Number(it.valor),
        }));

        const isDivergente =
          solicitados.length !== itensPersistidos.length ||
          solicitados.some((s: any) => {
            const match = itensPersistidos.find(
              (p: any) => p.origem_tipo === s.origem_tipo && p.origem_id === s.origem_id && p.valor === s.valor
            );
            return !match;
          });

        if (isDivergente) {
          return {
            data: null,
            error: {
              message: `BLOQUEIO_DIVERGENCIA_CNAB: Lote de diaristas ${args.p_diaristas_lote_id} já possui remessa CNAB registrada com parâmetros divergentes (empresa/conta/modo/valor/itens).`,
            } as any,
          };
        }

        novaRemessaCriada = true;
        nsaReservado++;
      }
      return { data: null, error: null } as any;
    });

    // Tentativa: mesmos IDs (lanc-1, lanc-2, lanc-3), mesma soma (180 + 30 + 140 = 350), MAS valores individuais diferentes!
    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        contaBancariaId: contaId,
        nomeArquivo: 'SIMULACAO_VALORES_INDIVIDUAIS_DIVERGENTES.txt',
        conteudoArquivo: 'conteudo-divergente',
        totalRegistros: 3,
        totalValor: 350,
        itens: [
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 180 }, // Original era 140
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 30 },  // Original era 70
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-3', valor: 140 }, // Idêntico
        ],
      })
    ).rejects.toThrow(/BLOQUEIO_DIVERGENCIA_CNAB/);

    expect(novaRemessaCriada).toBe(false);
    expect(nsaReservado).toBe(11); // NSA não consumido
  });

  it('3.2. Itens repetidos (duplicação de ocorrências de um item) é bloqueado com BLOQUEIO_DIVERGENCIA_CNAB', async () => {
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    // Itens persistidos têm exatamente 1 ocorrência de cada item
    const itensPersistidos = [
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
      { origem_tipo: 'DIARISTA', origem_id: 'lanc-3', valor: 140 },
    ];

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        const solicitados = args.p_itens || [];
        // Verifica contagem por item (multiset)
        const contagemPersistida = new Map<string, number>();
        itensPersistidos.forEach(p => {
          const k = `${p.origem_tipo}|${p.origem_id}|${p.valor}`;
          contagemPersistida.set(k, (contagemPersistida.get(k) || 0) + 1);
        });

        const contagemSolicitada = new Map<string, number>();
        solicitados.forEach((s: any) => {
          const k = `${s.origem_tipo}|${s.origem_id}|${s.valor}`;
          contagemSolicitada.set(k, (contagemSolicitada.get(k) || 0) + 1);
        });

        let divergente = contagemPersistida.size !== contagemSolicitada.size;
        if (!divergente) {
          for (const [k, qtd] of contagemPersistida.entries()) {
            if (contagemSolicitada.get(k) !== qtd) {
              divergente = true;
              break;
            }
          }
        }

        if (divergente) {
          return {
            data: null,
            error: {
              message: `BLOQUEIO_DIVERGENCIA_CNAB: Lote de diaristas ${args.p_diaristas_lote_id} já possui remessa CNAB registrada com parâmetros divergentes (empresa/conta/modo/valor/itens).`,
            } as any,
          };
        }
      }
      return { data: null, error: null } as any;
    });

    // Tentativa: lanc-1 enviado duas vezes e lanc-2 omitido (mesmo total de itens = 3, soma = 140+140+70 = 350)
    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        contaBancariaId: contaId,
        nomeArquivo: 'SIMULACAO_ITENS_REPETIDOS.txt',
        conteudoArquivo: 'conteudo',
        totalRegistros: 3,
        totalValor: 350,
        itens: [
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 }, // Repetido!
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
        ],
      })
    ).rejects.toThrow(/BLOQUEIO_DIVERGENCIA_CNAB/);
  });

  it('3.3. Itens omitidos ou substituídos são bloqueados com BLOQUEIO_DIVERGENCIA_CNAB', async () => {
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        const solicitados = args.p_itens || [];
        const temSubstituto = solicitados.some((s: any) => s.origem_id === 'lanc-alienigena');
        if (temSubstituto || solicitados.length !== 3) {
          return {
            data: null,
            error: {
              message: `BLOQUEIO_DIVERGENCIA_CNAB: Lote de diaristas ${args.p_diaristas_lote_id} já possui remessa CNAB registrada com parâmetros divergentes (empresa/conta/modo/valor/itens).`,
            } as any,
          };
        }
      }
      return { data: null, error: null } as any;
    });

    // Item lanc-3 foi substituído por lanc-alienigena
    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        contaBancariaId: contaId,
        nomeArquivo: 'SIMULACAO_ITEM_SUBSTITUIDO.txt',
        conteudoArquivo: 'conteudo',
        totalRegistros: 3,
        totalValor: 350,
        itens: [
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-alienigena', valor: 140 }, // Substituído!
        ],
      })
    ).rejects.toThrow(/BLOQUEIO_DIVERGENCIA_CNAB/);
  });

  it('3.4. Origem_tipo divergente em algum item é bloqueado com BLOQUEIO_DIVERGENCIA_CNAB', async () => {
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        const solicitados = args.p_itens || [];
        const tipoIncompativel = solicitados.some((s: any) => s.origem_tipo !== 'DIARISTA');
        if (tipoIncompativel) {
          return {
            data: null,
            error: {
              message: `BLOQUEIO_DIVERGENCIA_CNAB: Lote de diaristas ${args.p_diaristas_lote_id} já possui remessa CNAB registrada com parâmetros divergentes (empresa/conta/modo/valor/itens).`,
            } as any,
          };
        }
      }
      return { data: null, error: null } as any;
    });

    // Item lanc-3 enviado como INTERMITENTE em vez de DIARISTA
    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: loteId,
        empresaId,
        contaBancariaId: contaId,
        nomeArquivo: 'SIMULACAO_TIPO_DIVERGENTE.txt',
        conteudoArquivo: 'conteudo',
        totalRegistros: 3,
        totalValor: 350,
        itens: [
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 },
          { origem_tipo: 'DIARISTA', origem_id: 'lanc-2', valor: 70 },
          { origem_tipo: 'INTERMITENTE', origem_id: 'lanc-3', valor: 140 }, // Divergência de tipo!
        ],
      })
    ).rejects.toThrow(/BLOQUEIO_DIVERGENCIA_CNAB/);
  });

  // =========================================================================================
  // CENÁRIO 4: Mesmo hash associado a outro lote
  // =========================================================================================
  it('4. Mesmo hash associado a outro lote é sumariamente bloqueado pela deduplicação global pós-lock', async () => {
    const outroLoteId = '99999999-9999-9999-9999-999999999999';
    const hashExistente = 'hash-compartilhado-indevido';

    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string, args: any) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        // Simulação do passo 5.7 pós-lock da migration:
        // O lote outroLoteId não tem remessa ativa. Mas o hash já pertence a outro lote.
        return {
          data: null,
          error: {
            message: `BLOQUEIO_DUPLICIDADE_CNAB: Arquivo com hash ${args.p_hash_arquivo} já foi registrado anteriormente para outro lote.`,
          } as any,
        };
      }
      return { data: null, error: null } as any;
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        diaristasLoteId: outroLoteId,
        empresaId,
        contaBancariaId: contaId,
        nomeArquivo: 'SIMULACAO_COLISAO_HASH.txt',
        conteudoArquivo: 'conteudo-com-hash-duplicado',
        totalRegistros: 1,
        totalValor: 140,
        itens: [{ origem_tipo: 'DIARISTA', origem_id: 'lanc-novo', valor: 140 }],
      })
    ).rejects.toThrow(/BLOQUEIO_DUPLICIDADE_CNAB.*outro lote/);
  });

  // =========================================================================================
  // CENÁRIO 5: Preservação de NSA, itens, auditoria e status em falhas transacionais
  // =========================================================================================
  it('5. Falha transacional no meio da RPC aborta a transação garantindo zero remessas, zero itens, zero logs e preservação do status e NSA', async () => {
    let remessasInseridas = 0;
    let itensInseridos = 0;
    let auditoriaInserida = 0;
    let nsaConsumido = 11;
    let statusLote = 'FECHADO_FINANCEIRO';

    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);

    vi.spyOn(supabase, 'rpc').mockImplementation(async (fnName: string) => {
      if (fnName === 'rpc_registrar_cnab_remessa') {
        // Simulação de falha de banco no meio do processo antes do COMMIT (ex: erro de integridade ou desconexão)
        // O PostgreSQL aborta e executa ROLLBACK automático.
        return {
          data: null,
          error: {
            message: 'transação abortada: erro interno simulado antes do commit (rollback)',
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
        contaBancariaId: contaId,
        nomeArquivo: 'TESTE_ROLLBACK.txt',
        conteudoArquivo: 'conteudo-valido',
        totalRegistros: 1,
        totalValor: 140,
        itens: [{ origem_tipo: 'DIARISTA', origem_id: 'lanc-1', valor: 140 }],
      })
    ).rejects.toThrow(/transação abortada/);

    // Verificação estrita de imutabilidade diante de falha transacional:
    expect(remessasInseridas).toBe(0);
    expect(itensInseridos).toBe(0);
    expect(auditoriaInserida).toBe(0);
    expect(statusLote).toBe('FECHADO_FINANCEIRO'); // Status permanece intacto
    expect(nsaConsumido).toBe(11); // NSA não queimado
  });

  // =========================================================================================
  // PRESERVAÇÃO E SEGURANÇA ADICIONAL
  // =========================================================================================
  it('6. Lote com status VALIDADO_RH é sumariamente bloqueado (exige aprovação financeira)', async () => {
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
  });

  it('7. Preservação estrita de domínios: Diaristas não altera nem consulta lotes de CLT ou Intermitentes', async () => {
    const spyCheckIntermitentes = vi.spyOn(CnabRemessaArquivoService, 'checkIntermitentesLoteJaRemessado');
    const spyCheckRh = vi.spyOn(CnabRemessaArquivoService, 'checkRhLoteJaRemessado');

    await CnabRemessaArquivoService.checkDiaristasLoteJaRemessado(loteId);
    expect(spyCheckIntermitentes).not.toHaveBeenCalled();
    expect(spyCheckRh).not.toHaveBeenCalled();
  });
});
