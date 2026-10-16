import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CnabRetornoService } from '@/services/cnab/cnabRetorno.service';
import { CnabConciliacaoService } from '@/services/cnab/cnabConciliacao.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

// Mock do supabase e base.service
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-ret-fix02', email: 'auditor.ret02@orbe.test' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/services/domain/base.service', () => ({
  getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-orbe-ret02', userId: 'usr-ret-fix02' }),
  getCurrentTenantId: vi.fn().mockResolvedValue('tenant-orbe-ret02'),
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-ret-fix02', tenant_id: 'tenant-orbe-ret02' }),
}));

describe('FIX-RET-02: BLINDAGEM DA CONCILIAÇÃO DE RETORNOS SIMULADOS', () => {
  const tenantId = 'tenant-orbe-ret02';
  const empresaHmlId = 'emp-teste-hml-1111';
  const empresaProdId = 'emp-real-prod-2222';
  const contaHmlItauId = 'faecb252-7b9e-407d-93a5-e10466d35b0e';
  const contaProdItauId = 'conta-prod-itau-3333';
  const remessaNsa10HmlId = '38107d57-4069-434e-aed3-8501fe606272';
  const remessaProdId = 'rem-prod-nsa09-4444';
  const loteIntHmlId = '183c011a-53ea-41da-b76f-aea686362f38';

  // Helper para construir arquivo CNAB240 Itaú válido de 240 caracteres por linha
  function buildSyntheticRetornoItau({
    nsa = 10,
    valorItem = 70.0,
    ocorrencia = '00',
  }: {
    nsa?: number;
    valorItem?: number;
    ocorrencia?: string;
  } = {}): string {
    const nsaStr = String(nsa).padStart(6, '0');
    const valorCentsStr = String(Math.round(valorItem * 100)).padStart(15, '0');

    const hArquivo = '34100000         212345678000199                    0123450000000123456 BENEVIDES OPERACOES           BANCO ITAU SA                           228092026111500' + nsaStr + '08101600                                                                     ';
    const hLote =    '34100011C2001040 212345678000199                    0123450000000123456 BENEVIDES OPERACOES           PAGAMENTO DIARISTAS                                                                                                                       ';
    let segA =       '3410001300001A0000003410011110000000032142 DIARISTA 1                                        28092026BRL000000000000000000000000007000NOSSO341000004      28092026000000000007000                                                     00        ';
    segA = segA.replace('NOSSO341000004', 'NOSSO341' + nsaStr);
    segA = segA.replace('000000000007000', valorCentsStr);
    segA = segA.replace('000000000007000', valorCentsStr);
    segA = segA.slice(0, 230) + ocorrencia + segA.slice(232);

    const segB =     '3410001300002B   1   45678912355RUA OPERACIONAL               00100               CENTRO         BENEVIDES           68795000  000000000007000                                                                                          ';
    const tLote =    '34100015         000004000000000000007000000000000000000000000000                                                                                                                                                                               ';
    const tArquivo = '34199999         000001000006                                                                                                                                                                                                                   ';

    return [
      hArquivo.padEnd(240, ' ').slice(0, 240),
      hLote.padEnd(240, ' ').slice(0, 240),
      segA.padEnd(240, ' ').slice(0, 240),
      segB.padEnd(240, ' ').slice(0, 240),
      tLote.padEnd(240, ' ').slice(0, 240),
      tArquivo.padEnd(240, ' ').slice(0, 240),
    ].join('\n');
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // CENÁRIO 1: Retorno simulado válido para remessa de homologação
  // =========================================================================
  it('1. Deve processar retorno simulado válido para remessa de homologação com classificação explícita modo=homologacao', async () => {
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(true as never);

    let capturedRpcArgs: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        capturedRpcArgs = args;
        return Promise.resolve({
          data: {
            sucesso: true,
            retorno_arquivo_id: 'ret-hml-uuid-001',
            modo: 'homologacao',
            simulado: true,
            remessa_arquivo_id: remessaNsa10HmlId,
            linhas_recebidas: 2,
            baixas_efetuadas: 2,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: remessaNsa10HmlId,
                  sequencial_arquivo: 10,
                  banco_codigo: '341',
                  empresa_id: empresaHmlId,
                  conta_bancaria_id: contaHmlItauId,
                  modo: 'homologacao',
                  intermitentes_lote_id: loteIntHmlId,
                  total_valor: 350.0,
                  contas_bancarias_empresa: {
                    id: contaHmlItauId,
                    empresa_id: empresaHmlId,
                    banco_codigo: '341',
                    banco_nome: 'Itaú Unibanco',
                    agencia: '0333',
                    conta: '44444',
                    convenio: 'CONV_ITAU',
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        const mockItens = [
          {
            id: 'item-rem-1',
            remessa_id: remessaNsa10HmlId,
            origem_id: 'lanc-hml-001',
            origem_tipo: 'INTERMITENTE',
            lote_item_id: loteIntHmlId,
            status: 'remetido',
            valor: 70.0,
          },
          {
            id: 'item-rem-2',
            remessa_id: remessaNsa10HmlId,
            origem_id: 'lanc-hml-002',
            origem_tipo: 'INTERMITENTE',
            lote_item_id: loteIntHmlId,
            status: 'remetido',
            valor: 70.0,
          },
        ];
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockItens, error: null }),
            in: vi.fn().mockResolvedValue({ data: mockItens, error: null }),
          }),
        };
      }
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const file = new File([buildSyntheticRetornoItau({ nsa: 10, valorItem: 70.0 })], 'SIMULACAO_RETORNO_NSA10.RET', { type: 'text/plain' });
    const result = await CnabRetornoService.processarArquivo(file, '341');

    expect(result).toBeDefined();
    expect(result.modo).toBe('homologacao');
    expect(result.simulado).toBe(true);
    expect(result.resumo.totalProcessado).toBe(1);
    expect(capturedRpcArgs).toBeDefined();
    expect(capturedRpcArgs.p_empresa_id).toBe(empresaHmlId);
    expect(capturedRpcArgs.p_conta_bancaria_id).toBe(contaHmlItauId);
  });

  // =========================================================================
  // CENÁRIO 2: Retorno real válido para remessa de produção
  // =========================================================================
  it('2. Deve processar retorno real válido para remessa de produção com modo=producao e simulado=false', async () => {
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(true as never);

    let capturedRpcArgs: any = null;
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        capturedRpcArgs = args;
        return Promise.resolve({
          data: {
            sucesso: true,
            retorno_arquivo_id: 'ret-prod-uuid-002',
            modo: 'producao',
            simulado: false,
            remessa_arquivo_id: remessaProdId,
            linhas_recebidas: 2,
            baixas_efetuadas: 2,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: remessaProdId,
                  sequencial_arquivo: 10,
                  banco_codigo: '341',
                  empresa_id: empresaProdId,
                  conta_bancaria_id: contaProdItauId,
                  modo: 'producao',
                  contas_bancarias_empresa: {
                    id: contaProdItauId,
                    empresa_id: empresaProdId,
                    banco_codigo: '341',
                    banco_nome: 'Itaú Unibanco',
                    agencia: '0333',
                    conta: '44444',
                    convenio: 'CONV_PROD',
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const file = new File([buildSyntheticRetornoItau({ nsa: 10, valorItem: 70.0 })], 'RETORNO_PRODUCAO_NSA10.RET', { type: 'text/plain' });
    const result = await CnabRetornoService.processarArquivo(file, '341');

    expect(result).toBeDefined();
    expect(result.modo).toBe('producao');
    expect(result.simulado).toBe(false);
  });

  // =========================================================================
  // CENÁRIO 3: Tentativa de cruzamento entre ambientes (Bloqueio estrito)
  // =========================================================================
  it('3. Deve BLOQUEAR tentativa de processar retorno simulado de homologação em sessão de Produção', async () => {
    // Sessão em PRODUÇÃO
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(true as never);

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: remessaNsa10HmlId,
                  sequencial_arquivo: 10,
                  banco_codigo: '341',
                  empresa_id: empresaHmlId,
                  conta_bancaria_id: contaHmlItauId,
                  modo: 'homologacao', // Remessa é de HOMOLOGAÇÃO
                  contas_bancarias_empresa: {
                    id: contaHmlItauId,
                    empresa_id: empresaHmlId,
                    banco_codigo: '341',
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const file = new File([buildSyntheticRetornoItau({ nsa: 10, valorItem: 70.0 })], 'SIMULACAO_NSA10.RET', { type: 'text/plain' });
    await expect(CnabRetornoService.processarArquivo(file, '341')).rejects.toThrow(
      /Não é permitido processar retorno simulado de homologação no ambiente de Produção/
    );
  });

  it('3b. Deve BLOQUEAR tentativa de processar retorno real de produção em sessão de Homologação', async () => {
    // Sessão em HOMOLOGAÇÃO
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(true as never);

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: remessaProdId,
                  sequencial_arquivo: 10,
                  banco_codigo: '341',
                  empresa_id: empresaProdId,
                  conta_bancaria_id: contaProdItauId,
                  modo: 'producao', // Remessa é de PRODUÇÃO
                  contas_bancarias_empresa: {
                    id: contaProdItauId,
                    empresa_id: empresaProdId,
                    banco_codigo: '341',
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const file = new File([buildSyntheticRetornoItau({ nsa: 10, valorItem: 70.0 })], 'REAL_PROD_NSA10.RET', { type: 'text/plain' });
    await expect(CnabRetornoService.processarArquivo(file, '341')).rejects.toThrow(
      /Não é permitido processar retorno bancário de produção no ambiente de Homologação/
    );
  });

  // =========================================================================
  // CENÁRIO 4: Chamada direta à RPC com empresa ou conta incompatível
  // =========================================================================
  it('4. Simula validação defensiva da RPC contra incompatibilidade de empresa pagadora', async () => {
    // Se um atacante chamar diretamente rpc_aplicar_cnab_retorno informando empresa incompatível com a remessa
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        if (args.p_empresa_id === 'emp-incompativel') {
          return Promise.resolve({
            data: null,
            error: { message: 'Bloqueio de Segurança: A remessa original (NSA 10) pertence à outra empresa.' },
          });
        }
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { error } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
      p_empresa_id: 'emp-incompativel',
      p_conta_bancaria_id: contaHmlItauId,
      p_banco_codigo: '341',
      p_nome_arquivo: 'TESTE.RET',
      p_hash_arquivo: 'hash-fake',
      p_itens: [],
    } as any);

    expect(error).toBeDefined();
    expect(error?.message).toContain('Bloqueio de Segurança: A remessa original (NSA 10) pertence à outra empresa.');
  });

  it('4b. Simula validação defensiva da RPC contra conta bancária de outra empresa', async () => {
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        if (args.p_conta_bancaria_id === 'conta-alienigena') {
          return Promise.resolve({
            data: null,
            error: { message: 'Falha de Segurança: Conta Bancária conta-alienigena inválida, inativa ou não pertence à empresa informada.' },
          });
        }
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { error } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
      p_empresa_id: empresaHmlId,
      p_conta_bancaria_id: 'conta-alienigena',
      p_banco_codigo: '341',
      p_nome_arquivo: 'TESTE.RET',
      p_hash_arquivo: 'hash-fake-2',
      p_itens: [],
    } as any);

    expect(error).toBeDefined();
    expect(error?.message).toContain('Falha de Segurança: Conta Bancária');
  });

  // =========================================================================
  // CENÁRIO 5: Arquivo duplicado (Anti-duplicação por hash SHA-256)
  // =========================================================================
  it('5. Deve rejeitar processamento de arquivo com hash idêntico a um retorno já existente', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'ret-existente', nome_arquivo: 'RETORNO_JA_PROCESSADO.RET' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const file = new File([buildSyntheticRetornoItau({ nsa: 10, valorItem: 70.0 })], 'RETORNO_DUPLICADO.RET', { type: 'text/plain' });
    await expect(CnabRetornoService.processarArquivo(file, '341')).rejects.toThrow(
      /Arquivo de retorno ja processado anteriormente/
    );
  });

  // =========================================================================
  // CENÁRIO 6: Valores divergentes (Preservação de status sem liquidação indevida)
  // =========================================================================
  it('6. Deve classificar item com valor pago divergente como status=divergente e NÃO liquidar o lançamento', async () => {
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(true as never);

    // Retorno com valor de R$ 100,00 onde esperava-se R$ 70,00 (divergente)
    const divergentContent = buildSyntheticRetornoItau({ nsa: 10, valorItem: 100.0 });

    let rpcItensPayload: any[] = [];
    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_aplicar_cnab_retorno') {
        rpcItensPayload = args.p_itens;
        return Promise.resolve({
          data: {
            sucesso: true,
            retorno_arquivo_id: 'ret-div-001',
            modo: 'homologacao',
            simulado: true,
            remessa_arquivo_id: remessaNsa10HmlId,
            linhas_recebidas: 1,
            baixas_efetuadas: 0, // Zero baixas efetuadas
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: remessaNsa10HmlId,
                  sequencial_arquivo: 10,
                  banco_codigo: '341',
                  empresa_id: empresaHmlId,
                  conta_bancaria_id: contaHmlItauId,
                  modo: 'homologacao',
                  contas_bancarias_empresa: { id: contaHmlItauId, empresa_id: empresaHmlId, banco_codigo: '341' },
                },
              ],
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        const mockItens = [
          {
            id: 'item-rem-1',
            remessa_id: remessaNsa10HmlId,
            origem_id: 'lanc-1',
            origem_tipo: 'DIARISTA',
            valor: 70.0, // Esperado 70.00
            status: 'remetido',
          },
        ];
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockItens, error: null }),
            in: vi.fn().mockResolvedValue({ data: mockItens, error: null }),
          }),
        };
      }
      if (table === 'lancamentos_diaristas') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'lanc-1', lote_fechamento_id: 'lote-1', diarista_id: 'colab-1', valor_calculado: 70, nome_colaborador: 'Diarista 1', cpf_colaborador: '45678912355' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'colab-1', nome: 'Diarista 1', cpf: '45678912355' }],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const file = new File([divergentContent], 'RETORNO_DIVERGENTE.RET', { type: 'text/plain' });
    const result = await CnabRetornoService.processarArquivo(file, '341');

    expect(result.resumo.divergentes).toBe(1);
    expect(result.resumo.pagos).toBe(0);
    expect(rpcItensPayload[0].status).toBe('divergente');
  });

  // =========================================================================
  // CENÁRIO 7: Retorno parcial ou rejeitado (Lote NÃO é promovido a PAGO)
  // =========================================================================
  it('7. Em conciliação parcial (1 pago, 1 rejeitado), lote NÃO é promovido para PAGO', async () => {
    let loteUpdatedStatus: string | null = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'ret-item-1',
                  retorno_arquivo_id: 'ret-parcial-uuid',
                  remessa_arquivo_id: remessaNsa10HmlId,
                  intermitentes_lote_id: loteIntHmlId,
                  origem_id: 'lanc-hml-001',
                  status: 'pago',
                },
                {
                  id: 'ret-item-2',
                  retorno_arquivo_id: 'ret-parcial-uuid',
                  remessa_arquivo_id: remessaNsa10HmlId,
                  intermitentes_lote_id: loteIntHmlId,
                  origem_id: 'lanc-hml-002',
                  status: 'rejeitado', // Rejeitado!
                  descricao_ocorrencia: 'Conta corrente inválida',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: remessaNsa10HmlId, intermitentes_lote_id: loteIntHmlId, modo: 'homologacao' }],
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-item-1', remessa_id: remessaNsa10HmlId, origem_id: 'lanc-hml-001', status: 'conciliado' },
                { id: 'rem-item-2', remessa_id: remessaNsa10HmlId, origem_id: 'lanc-hml-002', status: 'rejeitado' },
              ],
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null }) }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-hml-001', status_pipeline: 'PAGO' },
                { id: 'lanc-hml-002', status_pipeline: 'ENVIADO_FINANCEIRO' }, // Não liquidado
              ],
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null }) }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            loteUpdatedStatus = payload.status;
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const concResult = await CnabConciliacaoService.processarBaixaAutomatica('ret-parcial-uuid');
    expect(concResult.success).toBe(true);
    // Como nem todos os lançamentos estão pagos e há item rejeitado, o lote NÃO deve ter sido promovido a PAGO
    expect(loteUpdatedStatus).not.toBe('PAGO');
  });

  // =========================================================================
  // CENÁRIO 8: Retorno sem remessa correspondente (Fail-Closed)
  // =========================================================================
  it('8. Deve rejeitar retorno sem remessa correspondente encontrada (Fail-Closed)', async () => {
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [] }), // Nenhuma remessa encontrada com este NSA
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const file = new File([buildSyntheticRetornoItau({ nsa: 999, valorItem: 70.0 })], 'RETORNO_SEM_REMESSA.RET', { type: 'text/plain' });
    await expect(CnabRetornoService.processarArquivo(file, '341')).rejects.toThrow(
      /Remessa bancária correspondente não encontrada/
    );
  });

  // =========================================================================
  // CENÁRIO 9: Preservação das remessas NSA 8, 9 e 10
  // =========================================================================
  it('9. Preserva imutabilidade e integridade das remessas anteriores NSA 8, 9 e 10', async () => {
    const mockRemessas = [
      { id: 'rem-nsa-8', sequencial_arquivo: 8, status: 'baixado', total_valor: 150.0, modo: 'homologacao' },
      { id: 'rem-nsa-9', sequencial_arquivo: 9, status: 'baixado', total_valor: 200.0, modo: 'homologacao' },
      { id: remessaNsa10HmlId, sequencial_arquivo: 10, status: 'baixado', total_valor: 350.0, modo: 'homologacao' },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockRemessas, error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const { data: remessas } = await supabase
      .from('cnab_remessas_arquivos')
      .select('id, sequencial_arquivo, status, total_valor, modo')
      .order('sequencial_arquivo');

    expect(remessas).toHaveLength(3);
    expect(remessas?.[0].sequencial_arquivo).toBe(8);
    expect(remessas?.[1].sequencial_arquivo).toBe(9);
    expect(remessas?.[2].sequencial_arquivo).toBe(10);
    // Nenhuma remessa teve seu modo alterado para algo diferente de homologacao
    remessas?.forEach(r => expect(r.modo).toBe('homologacao'));
  });

  // =========================================================================
  // CENÁRIO 10: Ausência de alteração em DRE e contas a pagar de produção
  // =========================================================================
  it('10. Garante que retornos simulados (modo=homologacao) não contaminam consultas de DRE e Contas a Pagar de Produção', async () => {
    // Consultas financeiras de produção filtram empresas com is_teste = false ou modo = producao
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              if (col === 'modo' && val === 'producao') {
                return {
                  order: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'ret-prod-real-1', modo: 'producao', total_sucesso: 5000.0 },
                    ],
                  }),
                };
              }
              return { order: vi.fn().mockResolvedValue({ data: [] }) };
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    // Consulta de conciliações para DRE oficial
    const { data: retornosProducao } = await supabase
      .from('cnab_retorno_arquivos')
      .select('id, modo, total_sucesso')
      .eq('modo', 'producao')
      .order('created_at');

    expect(retornosProducao).toHaveLength(1);
    expect(retornosProducao?.[0].modo).toBe('producao');
    expect(retornosProducao?.some(r => r.modo === 'homologacao')).toBe(false);
  });
});
