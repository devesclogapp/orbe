import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CNABService } from '@/services/financial.service';
import { CNAB240ItauWriter } from '@/services/cnab/CNAB240ItauWriter';
import { CNAB240BBWriter } from '@/services/cnab/CNAB240BBWriter';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import { BancarioOficialAdapter } from '@/services/bancarioOficialAdapter';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-cnab-fix02', email: 'auditor.cnab02@orbe.test' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-cnab-02', userId: 'usr-cnab-fix02' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-cnab-02'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-cnab-fix02', tenant_id: 'tenant-cnab-02' }),
  };
});

describe('FIX-CNAB-02: INTEGRIDADE TRANSACIONAL, PERSISTÊNCIA E RASTREABILIDADE CNAB', () => {
  const tenantId = 'tenant-cnab-02';
  const empresaId = 'emp-clt-ref-28a5';
  const contaItauId = 'conta-itau-ref-faec';
  const contaBbId = 'conta-bb-ref-bb01';
  const rhLoteId = '7d132d84-f3a7-4a5a-a460-1d23727d2537';
  const lotesRemessaId = 'lote-rem-0dbc-701e';
  const persistedRemessaId = 'rem-arq-persist-9999';

  const mockEmpresa = {
    id: empresaId,
    tenant_id: tenantId,
    razao_social: 'EMPRESA REF CLT LTDA',
    nome: 'EMPRESA REF CLT LTDA',
    cnpj: '12.345.678/0001-90',
    is_teste: true,
  };

  const mockContaItau = {
    id: contaItauId,
    tenant_id: tenantId,
    empresa_id: empresaId,
    banco_codigo: '341',
    agencia: '1234',
    agencia_digito: '0',
    conta: '56789',
    digito_conta: '0',
    convenio: 'CONV341',
    carteira: '109',
    cedente_cnpj: '12345678000190',
    ativo: true,
    permite_cnab: true,
    empresas: {
      id: empresaId,
      nome: mockEmpresa.nome,
      cidade: 'SAO PAULO',
      estado: 'SP',
      is_teste: true,
    },
  };

  const mockContaBb = {
    id: contaBbId,
    tenant_id: tenantId,
    empresa_id: empresaId,
    banco_codigo: '001',
    agencia: '1234',
    agencia_digito: 'X',
    conta: '9876',
    digito_conta: 'X',
    convenio: 'CONV001',
    carteira: '17',
    cedente_cnpj: '12345678000190',
    ativo: true,
    permite_cnab: true,
    empresas: {
      id: empresaId,
      nome: mockEmpresa.nome,
      cidade: 'SAO PAULO',
      estado: 'SP',
      is_teste: true,
    },
  };

  const mockItemClt = {
    id: 'item-clt-fav-01',
    lote_id: rhLoteId,
    valor_calculado: 2400.0,
    colaboradores: {
      id: 'col-fav-01',
      nome: 'Colaborador Homologação CLT',
      cpf: '12345678901',
      banco_codigo: '341',
      agencia: '1234',
      agencia_digito: '0',
      conta: '6789',
      digito_conta: '1',
      tipo_conta: 'CORRENTE',
      is_teste: true,
      empresa_id: empresaId,
    },
  };

  const mockRhLote = {
    id: rhLoteId,
    tenant_id: tenantId,
    empresa_id: empresaId,
    competencia: '2026-10',
    quantidade_colaboradores: 1,
    valor_total: 2400.0,
    status: 'AGUARDANDO_PAGAMENTO',
  };

  let lotesRemessaStatusUpdate = '';

  const setupDefaultMocks = (customRpc?: (fn: string, args: any) => Promise<any>) => {
    lotesRemessaStatusUpdate = '';
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined as any);

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (customRpc) {
        const res = customRpc(fn, args);
        if (res !== undefined) return res;
      }
      if (fn === 'rpc_registrar_cnab_remessa') {
        return Promise.resolve({
          data: {
            remessa_id: persistedRemessaId,
            id: persistedRemessaId,
            sequencial: 8,
            sequencial_arquivo: 8,
            nome_arquivo: args.p_nome_arquivo,
            status: 'gerado',
          },
          error: null,
        });
      }
      if (fn === 'log_audit') {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'empresas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const chain: any = {};
              chain.single = vi.fn().mockResolvedValue({ data: mockEmpresa, error: null });
              chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockEmpresa, error: null });
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.then = (resolve: any) => Promise.resolve({ data: [mockEmpresa], error: null }).then(resolve);
              return chain;
            }),
            in: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve({ data: [mockEmpresa], error: null }).then(resolve),
            }),
            then: (resolve: any) => Promise.resolve({ data: [mockEmpresa], error: null }).then(resolve),
          }),
        };
      }

      if (table === 'contas_bancarias_empresa') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              const selectedConta = val === contaBbId ? mockContaBb : mockContaItau;
              const chain: any = {};
              chain.single = vi.fn().mockResolvedValue({ data: selectedConta, error: null });
              chain.maybeSingle = vi.fn().mockResolvedValue({ data: selectedConta, error: null });
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.then = (resolve: any) => Promise.resolve({ data: [selectedConta], error: null }).then(resolve);
              return chain;
            }),
            then: (resolve: any) => Promise.resolve({ data: [mockContaItau], error: null }).then(resolve),
          }),
        };
      }

      if (table === 'rh_financeiro_lotes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const chain: any = {};
              chain.single = vi.fn().mockResolvedValue({ data: mockRhLote, error: null });
              chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockRhLote, error: null });
              chain.order = vi.fn().mockReturnValue(chain);
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.then = (resolve: any) => Promise.resolve({ data: [mockRhLote], error: null }).then(resolve);
              return chain;
            }),
            order: vi.fn().mockReturnValue({
              then: (resolve: any) => Promise.resolve({ data: [mockRhLote], error: null }).then(resolve),
            }),
            then: (resolve: any) => Promise.resolve({ data: [mockRhLote], error: null }).then(resolve),
          }),
        };
      }

      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [mockItemClt], error: null }),
            in: vi.fn().mockResolvedValue({ data: [mockItemClt], error: null }),
            then: (resolve: any) => Promise.resolve({ data: [mockItemClt], error: null }).then(resolve),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      if (table === 'lotes_remessa') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: lotesRemessaId, ...mockRhLote, status: 'gerado' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockImplementation((payload) => {
            if (payload.status) lotesRemessaStatusUpdate = payload.status;
            const chain: any = {
              eq: vi.fn().mockImplementation(() => chain),
              select: vi.fn().mockImplementation(() => chain),
              single: vi.fn().mockResolvedValue({ data: { id: lotesRemessaId, ...payload }, error: null }),
              then: (resolve: any) => Promise.resolve({ data: { id: lotesRemessaId, ...payload }, error: null }).then(resolve),
            };
            return chain;
          }),
        };
      }

      if (table === 'cnab_sequencial_controle') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: { ultimo_sequencial: 7 }, error: null });
        chain.single = vi.fn().mockResolvedValue({ data: { ultimo_sequencial: 7 }, error: null });
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }

      if (table === 'cnab_remessas_arquivos') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.not = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);

        return {
          select: vi.fn().mockReturnValue(chain),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      if (table === 'cnab_auditoria_bancaria') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Auditor CNAB' }, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Auditor CNAB' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'cnab_retorno_itens' || table === 'cnab_remessa_itens' || table === 'diaristas_lotes_fechamento' || table === 'intermitentes_lotes_fechamento') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
        chain.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          }),
          then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Persistência com Sucesso: Writer propaga arquivoId válido retornado pelo banco', async () => {
    setupDefaultMocks();

    const writer = new CNAB240ItauWriter();
    const result = await writer.generateCNAB240({
      loteId: lotesRemessaId,
      rhLoteId: rhLoteId,
      competencia: '2026-10',
      contaBancariaId: contaItauId,
      modo: 'HOMOLOGACAO',
      salvarConteudo: true,
    });

    expect(result.arquivoId).toBe(persistedRemessaId);
    expect(result.arquivoId).not.toBe('nao-registrado');
    expect(result.sequencial).toBe(8);
    expect(result.content).toBeDefined();
    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_ITAU');
  });

  it('2. Falha de Persistência na RPC: Writer NÃO mascara o erro e NÃO retorna falso sucesso', async () => {
    setupDefaultMocks((fn) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        return Promise.resolve({
          data: null,
          error: { message: 'Database connection failed during remittance registration' },
        });
      }
      return undefined;
    });

    const writer = new CNAB240ItauWriter();
    
    // Deve rejeitar a promise com erro explícito em vez de resolver com 'nao-registrado'
    await expect(
      writer.generateCNAB240({
        loteId: lotesRemessaId,
        rhLoteId: rhLoteId,
        competencia: '2026-10',
        contaBancariaId: contaItauId,
        modo: 'HOMOLOGACAO',
        salvarConteudo: true,
      })
    ).rejects.toThrow(/Erro Crítico na Transação CNAB RPC|Falha ao registrar remessa CNAB/);
  });

  it('3. Download Bloqueado: financial.service marca status erro no lote e propaga falha ao UI', async () => {
    setupDefaultMocks((fn) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        return Promise.resolve({
          data: null,
          error: { message: 'Erro RPC: timeout na transação' },
        });
      }
      return undefined;
    });

    await expect(
      CNABService.generateRemessa({
        competencia: '2026-10',
        empresaId,
        contaId: contaItauId,
        rhLoteId,
      })
    ).rejects.toThrow();

    expect(lotesRemessaStatusUpdate).toBe('erro');
  });

  it('4. NSA Autoridade Única: getNextSequencial projeta (peek) sem incrementar prematuramente', async () => {
    setupDefaultMocks();

    let rpcSequencialChamado = false;
    const originalRpc = (supabase.rpc as any).getMockImplementation();
    (supabase.rpc as any).mockImplementation((rpcName: string, args: any) => {
      if (rpcName === 'get_next_cnab_sequencial') {
        rpcSequencialChamado = true;
      }
      return originalRpc ? originalRpc(rpcName, args) : Promise.resolve({ data: null, error: null });
    });

    const nextSeq = await CnabRemessaArquivoService.getNextSequencial(contaItauId);

    // O sequencial projetado deve ser ultimo_sequencial + 1 = 8 (pois mock tem ultimo_sequencial: 7)
    expect(nextSeq).toBe(8);
    // NÃO deve ter chamado a RPC mutativa antes da persistência efetiva da remessa
    expect(rpcSequencialChamado).toBe(false);
  });

  it('5. Prevenção de Duplicidade: checkRhLoteJaRemessado detecta lote CLT já remessado', async () => {
    setupDefaultMocks();

    // Sobrescreve cnab_remessas_arquivos com remessa existente para o rhLoteId
    const originalFrom = (supabase.from as any).getMockImplementation();
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.not = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: any) =>
          Promise.resolve({
            data: [
              {
                id: 'rem-existente-01',
                nome_arquivo: 'REM_ITAU_EXISTENTE.txt',
                status: 'gerado',
                observacoes: JSON.stringify({ rh_lote_id: rhLoteId }),
              },
            ],
            error: null,
          }).then(resolve);
        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      return originalFrom(table);
    });

    const jaRemessado = await CnabRemessaArquivoService.checkRhLoteJaRemessado(rhLoteId);
    expect(jaRemessado).not.toBeNull();
    expect(jaRemessado?.id).toBe('rem-existente-01');
  });

  it('6. Associação Multicamadas em bancarioOficialAdapter: lote CLT vinculado via metadata evolui para REMESSA_GERADA', async () => {
    setupDefaultMocks();

    const originalFrom = (supabase.from as any).getMockImplementation();
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'cnab_remessas_arquivos') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: any) =>
          Promise.resolve({
            data: [
              {
                id: persistedRemessaId,
                tenant_id: tenantId,
                empresa_id: empresaId,
                competencia: '2026-10',
                lote_id: lotesRemessaId,
                sequencial_arquivo: 8,
                hash_arquivo: 'abcdef1234567890',
                nome_arquivo: 'SIMULACAO_HOMOLOGACAO_ITAU_20261014_SEQ000008.txt',
                status: 'gerado',
                total_registros: 10,
                observacoes: JSON.stringify({ rh_lote_id: rhLoteId }),
                created_at: new Date().toISOString(),
              },
            ],
            error: null,
          }).then(resolve);

        return {
          select: vi.fn().mockReturnValue(chain),
        };
      }
      return originalFrom(table);
    });

    const obrigacoes = await BancarioOficialAdapter.carregarObrigacoes({
      empresaId,
      competencia: '2026-10',
    });

    expect(obrigacoes).toHaveLength(1);
    const ob = obrigacoes[0];

    // O lote CLT foi perfeitamente associado à remessa
    expect(ob.remessaId).toBe(persistedRemessaId);
    expect(ob.remessaNsa).toBe(8);
    expect(ob.situacao).toBe('REMESSA_GERADA');
    expect(ob.estagioTab).toBe('REMESSAS');
  });

  it('7. Compatibilidade Banco do Brasil (001): Writer propaga erro e valida persistência', async () => {
    setupDefaultMocks();

    const bbWriter = new CNAB240BBWriter();
    const result = await bbWriter.generateCNAB240({
      loteId: lotesRemessaId,
      rhLoteId,
      competencia: '2026-10',
      contaBancariaId: contaBbId,
      modo: 'HOMOLOGACAO',
      salvarConteudo: true,
    });

    expect(result.arquivoId).toBe(persistedRemessaId);
    expect(result.sequencial).toBe(8);
    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_BB');

    // Testa caso de falha de persistência
    setupDefaultMocks((fn) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        return Promise.resolve({
          data: null,
          error: { message: 'DB Disk Full on BB Remessa' },
        });
      }
      return undefined;
    });

    await expect(
      bbWriter.generateCNAB240({
        loteId: lotesRemessaId,
        rhLoteId,
        competencia: '2026-10',
        contaBancariaId: contaBbId,
        modo: 'HOMOLOGACAO',
        salvarConteudo: true,
      })
    ).rejects.toThrow(/Erro Crítico na Transação CNAB RPC|Falha ao registrar remessa CNAB/);
  });
});
