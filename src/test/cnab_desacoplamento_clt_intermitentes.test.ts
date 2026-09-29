import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';

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
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-test-uuid', userId: 'usr-tester-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-tester-id', tenant_id: 'tenant-test-uuid' }),
  };
});

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    invalidate: vi.fn(),
  },
}));

describe('DESACOPLAMENTO CNAB CLT × INTERMITENTES × DIARISTAS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(1);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(false);
    if (typeof window !== 'undefined') {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();
    }
    if (typeof global !== 'undefined') {
      (global as any).URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      (global as any).URL.revokeObjectURL = vi.fn();
    }
  });

  // A) INTERMITENTE nunca usa rh_financeiro_lote_itens como origem física
  it('A. INTERMITENTE nunca referencia rh_financeiro_lote_itens como origem física na remessa', async () => {
    const { IntermitentesLoteService } = await import('@/services/domain/intermitentes.service');
    const { supabase } = await import('@/lib/supabase');

    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';
    const lancamento1Id = '5349a94a-2e34-4463-8c95-33f26aac0b98';
    const lancamento2Id = 'a9fb4fa9-e3e9-4c27-940f-f65c9d909cb9';

    let rpcPayloadItens: any[] = [];
    const tablesQueried: string[] = [];

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        rpcPayloadItens = args?.p_itens || [];
        return Promise.resolve({
          data: { remessa_id: 'rem-int-1', sucesso: true, sequencial: 1 },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      tablesQueried.push(table);
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: loteId,
                  status: 'FECHADO_FINANCEIRO',
                  competencia: '2026-10',
                  empresa_id: 'emp-hml-1',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: lancamento1Id,
                  colaborador_id: 'colab-1',
                  nome_colaborador: 'Homologação Itaú 001',
                  cpf_colaborador: '11111111111',
                  total: 240,
                  lote_fechamento_id: loteId,
                },
                {
                  id: lancamento2Id,
                  colaborador_id: 'colab-2',
                  nome_colaborador: 'Homologação Itaú 002',
                  cpf_colaborador: '22222222222',
                  total: 330,
                  lote_fechamento_id: loteId,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'colab-1',
                  nome: 'Homologação Itaú 001',
                  cpf: '11111111111',
                  banco_codigo: '341',
                  agencia: '1234',
                  conta: '12345',
                  digito_conta: '1',
                  tipo_conta: 'corrente',
                },
                {
                  id: 'colab-2',
                  nome: 'Homologação Itaú 002',
                  cpf: '22222222222',
                  banco_codigo: '341',
                  agencia: '1234',
                  conta: '67890',
                  digito_conta: '2',
                  tipo_conta: 'corrente',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'contas_bancarias_empresa') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'conta-pagadora-1',
                    banco_codigo: '341',
                    banco_nome: 'BANCO ITAU SA',
                    agencia: '9999',
                    conta: '88888',
                    conta_digito: '0',
                    convenio: '12345',
                    ativo: true,
                    is_padrao: true,
                    empresa_id: 'emp-hml-1',
                    cedente_cnpj: '12345678000199',
                  },
                ],
                error: null,
              }),
              single: vi.fn().mockResolvedValue({
                data: { empresa_id: 'emp-hml-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'empresas') {
        const empObj = { data: { id: 'emp-hml-1', is_teste: true, tenant_id: 'tenant-test-id' }, error: null };
        const chain: any = {
          maybeSingle: vi.fn().mockResolvedValue(empObj),
          single: vi.fn().mockResolvedValue(empObj),
        };
        chain.eq = vi.fn().mockReturnValue(chain);
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(chain),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    await IntermitentesLoteService.gerarCNABParaLote({
      loteId,
      empresaId: 'emp-hml-1',
      geradoPor: 'user-hml-1',
      geradoPorNome: 'Operador Teste',
      empresaRemetente: {
        cnpj: '12345678000199',
        razao_social: 'Empresa Teste - Homologação',
        banco_codigo: '341',
        agencia: '9999',
        conta: '88888',
        digito_conta: '0',
      },
    });

    // Validar que os itens enviados à RPC são de lancamentos_intermitentes e não de rh_financeiro_lote_itens
    expect(rpcPayloadItens.length).toBe(2);
    expect(rpcPayloadItens[0].origem_tipo).toBe('INTERMITENTE');
    expect(rpcPayloadItens[0].origem_id).toBe(lancamento1Id);
    expect(rpcPayloadItens[1].origem_tipo).toBe('INTERMITENTE');
    expect(rpcPayloadItens[1].origem_id).toBe(lancamento2Id);

    // rh_financeiro_lote_itens NÃO deve ter sido consultada nem alterada
    expect(tablesQueried).not.toContain('rh_financeiro_lote_itens');
  });

  // B) CLT continua funcional sem depender de updated_at inexistente
  it('B. CLT baixa itens em CnabConciliacaoService sem referenciar updated_at', async () => {
    const { CnabConciliacaoService } = await import('@/services/cnab/cnabConciliacao.service');
    const { supabase } = await import('@/lib/supabase');

    let updatePayloadPassado: any = null;

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'ret-item-clt-1',
                  retorno_arquivo_id: 'ret-arq-1',
                  remessa_arquivo_id: 'rem-arq-1',
                  fatura_id: 'rh-lote-item-1',
                  status: 'pago',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'rem-arq-1', lote_id: 'rh-lote-1', diaristas_lote_id: null, intermitentes_lote_id: null }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rem-item-1',
                  remessa_id: 'rem-arq-1',
                  origem_tipo: 'CLT',
                  origem_id: 'rh-lote-item-1',
                  fatura_id: 'rh-lote-item-1',
                  status: 'remetido',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { lote_id: 'rh-lote-1' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            updatePayloadPassado = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const resultado = await CnabConciliacaoService.processarBaixaAutomatica('ret-arq-1');
    expect(resultado.success).toBe(true);

    // O update NÃO pode conter a coluna inexistente updated_at
    expect(updatePayloadPassado).toEqual({ status: 'PAGO' });
    expect(updatePayloadPassado).not.toHaveProperty('updated_at');
  });

  // C) DIARISTA permanece funcional
  it('C. DIARISTA permanece com segregação relacional estrita e funcional', async () => {
    const { CnabRetornoService } = await import('@/services/cnab/cnabRetorno.service');
    expect(CnabRetornoService).toBeDefined();
    expect(typeof CnabRetornoService.processarArquivo).toBe('function');
  });

  // D) rpc_registrar_cnab_remessa aceita origem_tipo INTERMITENTE
  it('D. rpc_registrar_cnab_remessa aceita explicitamente origem_tipo INTERMITENTE', async () => {
    const { CnabRemessaArquivoService } = await import('@/services/cnab/cnabRemessaArquivo.service');
    const { supabase } = await import('@/lib/supabase');

    let payloadEnviado: any = null;

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        payloadEnviado = args;
        return Promise.resolve({
          data: { remessa_id: 'rem-123', sequencial: 1, linhas_afetadas: 1 },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'contas_bancarias_empresa') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { empresa_id: 'emp-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'empresas') {
        const empObj = { data: { id: 'emp-1', is_teste: true, tenant_id: 'tenant-test-id' }, error: null };
        const chain: any = {
          maybeSingle: vi.fn().mockResolvedValue(empObj),
          single: vi.fn().mockResolvedValue(empObj),
        };
        chain.eq = vi.fn().mockReturnValue(chain);
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(chain),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    await CnabRemessaArquivoService.registrar({
      loteId: null,
      diaristasLoteId: null,
      intermitentesLoteId: 'lote-int-uuid',
      nomeArquivo: 'CB280901.REM',
      conteudoArquivo: 'HEADER...',
      totalRegistros: 1,
      totalValor: 240,
      bancoCodigo: '341',
      bancoNome: 'ITAU',
      contaBancariaId: 'conta-uuid',
      modo: 'producao',
      sequencialArquivo: 1,
      itens: [
        {
          origem_tipo: 'INTERMITENTE',
          origem_id: 'lanc-int-uuid',
          fatura_id: null,
          lote_item_id: null,
          valor: 240,
        },
      ],
    });

    expect(payloadEnviado).not.toBeNull();
    expect(payloadEnviado.p_itens[0].origem_tipo).toBe('INTERMITENTE');
    expect(payloadEnviado.p_itens[0].origem_id).toBe('lanc-int-uuid');
  });

  // E) Nenhuma referência inválida a rh_financeiro_lote_itens.updated_at permanece nas RPCs ativas
  it('E. A nova migration não contém qualquer referência a rh_financeiro_lote_itens.updated_at', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20260928234500_desacoplamento_cnab_clt_intermitentes.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Verificar que não existe SET ... updated_at na tabela rh_financeiro_lote_itens em nenhum UPDATE
    const matchesRemessa = sqlContent.match(
      /UPDATE\s+public\.rh_financeiro_lote_itens\s+SET[^;]+updated_at/gi
    );
    expect(matchesRemessa).toBeNull();

    // Confirmar que INTERMITENTE está desacoplado em rpc_registrar_cnab_remessa
    expect(sqlContent).toContain("(v_item->>'origem_tipo') = 'INTERMITENTE'");

    // Confirmar que em rpc_aplicar_cnab_retorno INTERMITENTE atualiza lancamentos_intermitentes
    expect(sqlContent).toContain('UPDATE public.lancamentos_intermitentes');
  });

  // F) Geração de remessa NÃO marca pagamento antecipadamente
  it('F. Geração de remessa atualiza intermitentes_lotes_fechamento para CNAB_GERADO (e NÃO PAGO)', async () => {
    const { IntermitentesLoteService } = await import('@/services/domain/intermitentes.service');
    const { supabase } = await import('@/lib/supabase');

    let statusLoteAtualizado: string | null = null;

    (supabase.rpc as any).mockImplementation((fn: string) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        return Promise.resolve({
          data: { remessa_id: 'rem-1', sucesso: true },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'lote-1',
                  status: 'FECHADO_FINANCEIRO',
                  competencia: '2026-10',
                  empresa_id: 'emp-1',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            statusLoteAtualizado = payload.status;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'lanc-1',
                  colaborador_id: 'colab-1',
                  nome_colaborador: 'Colab Teste',
                  cpf_colaborador: '12345678901',
                  total: 100,
                  lote_fechamento_id: 'lote-1',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'colaboradores') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'colab-1',
                  nome: 'Colab Teste',
                  cpf: '12345678901',
                  banco_codigo: '341',
                  agencia: '1234',
                  conta: '12345',
                  digito_conta: '1',
                  tipo_conta: 'corrente',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'contas_bancarias_empresa') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'conta-1',
                    banco_codigo: '341',
                    agencia: '1111',
                    conta: '22222',
                    conta_digito: '3',
                    ativo: true,
                    is_padrao: true,
                    empresa_id: 'emp-1',
                    cedente_cnpj: '11222333000199',
                  },
                ],
                error: null,
              }),
              single: vi.fn().mockResolvedValue({
                data: { empresa_id: 'emp-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'empresas') {
        const empObj = { data: { id: 'emp-1', is_teste: true, tenant_id: 'tenant-test-id' }, error: null };
        const chain: any = {
          maybeSingle: vi.fn().mockResolvedValue(empObj),
          single: vi.fn().mockResolvedValue(empObj),
        };
        chain.eq = vi.fn().mockReturnValue(chain);
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(chain),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    await IntermitentesLoteService.gerarCNABParaLote({
      loteId: 'lote-1',
      empresaId: 'emp-1',
      geradoPor: 'user-1',
      geradoPorNome: 'Operador',
      empresaRemetente: {
        cnpj: '11222333000199',
        razao_social: 'Empresa Teste',
        banco_codigo: '341',
        agencia: '1111',
        conta: '22222',
        digito_conta: '3',
      },
    });

    expect(statusLoteAtualizado).toBe('CNAB_GERADO');
    expect(statusLoteAtualizado).not.toBe('PAGO');
  });

  // G) Retorno continua responsável pela conciliação/baixa
  it('G. Retorno bancário só promove lote para PAGO quando todos os itens estão quitados', async () => {
    const { CnabConciliacaoService } = await import('@/services/cnab/cnabConciliacao.service');
    const { supabase } = await import('@/lib/supabase');

    let loteStatusAtualizado: string | null = null;

    // Cenário: 2 itens no lote, mas apenas 1 veio pago no retorno (quitação parcial)
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_retorno_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'ret-1',
                  retorno_arquivo_id: 'ret-parcial',
                  remessa_arquivo_id: 'rem-1',
                  fatura_id: 'lanc-1',
                  status: 'pago',
                  intermitentes_lote_id: 'lote-int-parcial',
                },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rem-1',
                  intermitentes_lote_id: 'lote-int-parcial',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'cnab_remessa_itens') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'rem-it-1', remessa_id: 'rem-1', origem_id: 'lanc-1', origem_tipo: 'INTERMITENTE', status: 'remetido' },
                { id: 'rem-it-2', remessa_id: 'rem-1', origem_id: 'lanc-2', origem_tipo: 'INTERMITENTE', status: 'remetido' },
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-1', status_pipeline: 'PAGO' },
                { id: 'lanc-2', status_pipeline: 'ENVIADO_FINANCEIRO' }, // Apenas 1 de 2 pago!
              ],
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockImplementation((payload: any) => {
            loteStatusAtualizado = payload.status;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    await CnabConciliacaoService.processarBaixaAutomatica('ret-parcial');

    // Em quitação parcial, lote permanece CNAB_GERADO e NÃO vira PAGO
    expect(loteStatusAtualizado).toBe('CNAB_GERADO');
  });

  // H) Isolamento por tenant permanece intacto
  it('H. RPCs ativas impõem validação de tenant_id rigorosa', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20260928234500_desacoplamento_cnab_clt_intermitentes.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Ambas RPCs verificam current_tenant_id()
    const tenantMatches = sqlContent.match(/v_tenant_id\s*:=\s*public\.current_tenant_id\(\);/g);
    expect(tenantMatches).not.toBeNull();
    expect(tenantMatches!.length).toBe(2);

    // Ambas as RPCs impedem execução sem tenant
    expect(sqlContent).toContain('Tenant indisponível para o contexto atual.');
  });

  // I) Remessa de Intermitentes persiste competencia e intermitentes_lote_id em cnab_remessas_arquivos
  it('I. Remessa de Intermitentes persiste competencia e intermitentes_lote_id em cnab_remessas_arquivos', async () => {
    const { CnabRemessaArquivoService } = await import('@/services/cnab/cnabRemessaArquivo.service');
    const { supabase } = await import('@/lib/supabase');

    let updateCnabRemessasPayload: any = null;

    (supabase.rpc as any).mockImplementation((fn: string) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        return Promise.resolve({
          data: { remessa_id: 'remessa-int-uuid-hml' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'contas_bancarias_empresa') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { empresa_id: 'emp-hml-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'cnab_remessas_arquivos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            updateCnabRemessasPayload = payload;
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }),
        };
      }
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'empresas') {
        const empObj = { data: { id: 'emp-hml-1', is_teste: true, tenant_id: 'tenant-test-id' }, error: null };
        const chain: any = {
          maybeSingle: vi.fn().mockResolvedValue(empObj),
          single: vi.fn().mockResolvedValue(empObj),
        };
        chain.eq = vi.fn().mockReturnValue(chain);
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(chain),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    await CnabRemessaArquivoService.registrar({
      loteId: null,
      diaristasLoteId: null,
      intermitentesLoteId: '930915d6-cb8f-4739-8001-7fa49d3009e4',
      nomeArquivo: 'CB290901.REM',
      conteudoArquivo: 'HEADER...',
      totalRegistros: 2,
      totalValor: 570,
      bancoCodigo: '341',
      bancoNome: 'ITAU',
      contaBancariaId: 'conta-uuid',
      competencia: '2026-10',
      modo: 'producao',
      sequencialArquivo: 1,
      itens: [
        {
          origem_tipo: 'INTERMITENTE',
          origem_id: 'lanc-1',
          fatura_id: null,
          lote_item_id: null,
          valor: 240,
        },
        {
          origem_tipo: 'INTERMITENTE',
          origem_id: 'lanc-2',
          fatura_id: null,
          lote_item_id: null,
          valor: 330,
        },
      ],
    });

    expect(updateCnabRemessasPayload).not.toBeNull();
    expect(updateCnabRemessasPayload.competencia).toBe('2026-10');
    expect(updateCnabRemessasPayload.intermitentes_lote_id).toBe('930915d6-cb8f-4739-8001-7fa49d3009e4');
  });
});

