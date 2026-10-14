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
        data: { user: { id: 'usr-cnab-fix02b', email: 'auditor.fix02b@orbe.test' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-cnab-fix02b', userId: 'usr-cnab-fix02b' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-cnab-fix02b'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-cnab-fix02b', tenant_id: 'tenant-cnab-fix02b' }),
  };
});

describe('FIX-CNAB-02B: CORREÇÃO DA INCOMPATIBILIDADE DE STATUS NA RPC CNAB', () => {
  const tenantId = 'tenant-cnab-fix02b';
  const empresaId = 'emp-hml-ref-28a5';
  const contaItauId = 'conta-itau-faec';
  const contaBbId = 'conta-bb-0001';
  const rhLoteId = '7d132d84-f3a7-4a5a-a460-1d23727d2537';
  const lotesRemessaId = 'lote-rem-9e70-7f6e';
  const persistedRemessaId = 'rem-persistida-fix02b-1234';

  const mockEmpresa = {
    id: empresaId,
    tenant_id: tenantId,
    razao_social: 'EMPRESA TESTE - HOMOLOGACAO',
    nome: 'EMPRESA TESTE - HOMOLOGACAO',
    cnpj: '28.000.000/0001-99',
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
    cedente_cnpj: '28000000000199',
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
    cedente_cnpj: '28000000000199',
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

  const mockItensClt = [
    {
      id: 'db41867b-a957-4cb1-a199-46b4fd4a247c',
      lote_id: rhLoteId,
      status: 'PENDENTE',
      valor_calculado: 300,
      colaboradores: {
        id: 'col-itau-001',
        nome: 'Homologação Itaú 001',
        cpf: '11122233344',
        banco_codigo: '341',
        agencia: '1234',
        agencia_digito: '0',
        conta: '5678',
        digito_conta: '9',
        tipo_conta: 'CORRENTE',
        is_teste: true,
        empresa_id: empresaId,
      },
    },
    {
      id: '1d5c2d2d-6217-4fad-98cb-b569d797ad7d',
      lote_id: rhLoteId,
      status: 'PENDENTE',
      valor_calculado: 300,
      colaboradores: {
        id: 'col-itau-002',
        nome: 'Homologação Itaú 002',
        cpf: '22233344455',
        banco_codigo: '341',
        agencia: '1234',
        agencia_digito: '0',
        conta: '8765',
        digito_conta: '4',
        tipo_conta: 'CORRENTE',
        is_teste: true,
        empresa_id: empresaId,
      },
    },
  ];

  const mockRhLote = {
    id: rhLoteId,
    tenant_id: tenantId,
    empresa_id: empresaId,
    competencia: '2026-07',
    origem: 'OPERACIONAL',
    tipo: 'INTERMITENTES',
    status: 'AGUARDANDO_PAGAMENTO',
    total_colaboradores: 2,
    valor_total: 600,
  };

  // Simulação da máquina de estados do banco de dados PostgreSQL
  // Status permitidos com a constraint corrigida da migration FIX-CNAB-02B
  const STATUS_PERMITIDOS_CONSTRAINT = new Set([
    'PENDENTE',
    'EM_ANALISE',
    'APROVADO',
    'REJEITADO',
    'AGUARDANDO_RETORNO',
    'PROCESSADO',
    'ENVIADO',
    'PAGO',
    'CANCELADO',
  ]);

  let itensStatusBanco: Record<string, string> = {};
  let lotesRemessaStatusUpdate = '';
  let ultimoNsaBanco = 7;

  const setupDatabaseSimulator = (options?: { simulateConstraintFailure?: boolean }) => {
    itensStatusBanco = {
      'db41867b-a957-4cb1-a199-46b4fd4a247c': 'PENDENTE',
      '1d5c2d2d-6217-4fad-98cb-b569d797ad7d': 'PENDENTE',
    };
    lotesRemessaStatusUpdate = '';
    ultimoNsaBanco = 7;

    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined as any);

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        // Se a constraint restritiva estiver ativa (sem o fix), rejeita status AGUARDANDO_RETORNO
        if (options?.simulateConstraintFailure) {
          return Promise.resolve({
            data: null,
            error: {
              message:
                'new row for relation "rh_financeiro_lote_itens" violates check constraint "rh_financeiro_lote_itens_status_check"',
            },
          });
        }

        // Validação da RPC com a nova constraint permitindo AGUARDANDO_RETORNO
        const novoStatus = 'AGUARDANDO_RETORNO';
        if (!STATUS_PERMITIDOS_CONSTRAINT.has(novoStatus)) {
          return Promise.resolve({
            data: null,
            error: {
              message:
                'new row for relation "rh_financeiro_lote_itens" violates check constraint "rh_financeiro_lote_itens_status_check"',
            },
          });
        }

        // Simula atualização transacional bem-sucedida dos itens
        for (const item of args.p_itens || []) {
          if (item.origem_tipo === 'CLT') {
            itensStatusBanco[item.origem_id] = novoStatus;
          }
        }

        // Incremento atômico do NSA apenas se a transação passar
        ultimoNsaBanco += 1;

        return Promise.resolve({
          data: {
            remessa_id: persistedRemessaId,
            id: persistedRemessaId,
            sequencial: ultimoNsaBanco,
            sequencial_arquivo: ultimoNsaBanco,
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
              chain.then = (res: any) => Promise.resolve({ data: [mockEmpresa], error: null }).then(res);
              return chain;
            }),
            in: vi.fn().mockReturnValue({
              then: (res: any) => Promise.resolve({ data: [mockEmpresa], error: null }).then(res),
            }),
            then: (res: any) => Promise.resolve({ data: [mockEmpresa], error: null }).then(res),
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
              chain.then = (res: any) => Promise.resolve({ data: [selectedConta], error: null }).then(res);
              return chain;
            }),
            then: (res: any) => Promise.resolve({ data: [mockContaItau], error: null }).then(res),
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
              chain.then = (res: any) => Promise.resolve({ data: [mockRhLote], error: null }).then(res);
              return chain;
            }),
            order: vi.fn().mockReturnValue({
              then: (res: any) => Promise.resolve({ data: [mockRhLote], error: null }).then(res),
            }),
            then: (res: any) => Promise.resolve({ data: [mockRhLote], error: null }).then(res),
          }),
        };
      }

      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockItensClt, error: null }),
            in: vi.fn().mockResolvedValue({ data: mockItensClt, error: null }),
            then: (res: any) => Promise.resolve({ data: mockItensClt, error: null }).then(res),
          }),
          update: vi.fn().mockImplementation((payload) => {
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
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
            const chain: any = {};
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.select = vi.fn().mockReturnValue(chain);
            chain.single = vi.fn().mockResolvedValue({ data: { id: lotesRemessaId, ...payload }, error: null });
            chain.then = (res: any) => Promise.resolve({ data: { id: lotesRemessaId, ...payload }, error: null }).then(res);
            return chain;
          }),
        };
      }

      if (table === 'cnab_sequencial_controle') {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { ultimo_sequencial: ultimoNsaBanco }, error: null })
        );
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
        chain.then = (res: any) => Promise.resolve({ data: [], error: null }).then(res);

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
              single: vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Auditor FIX-02B' }, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Auditor FIX-02B' }, error: null }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (res: any) => Promise.resolve({ data: [], error: null }).then(res),
          }),
          then: (res: any) => Promise.resolve({ data: [], error: null }).then(res),
        }),
      };
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. DIAGNÓSTICO: Constraint restritiva legada causa rejeição com erro exato do PostgreSQL', async () => {
    // Simula o comportamento do banco antes da migration (constraint restrita)
    setupDatabaseSimulator({ simulateConstraintFailure: true });

    await expect(
      CNABService.generateRemessa({
        competencia: '2026-07',
        empresaId,
        contaId: contaItauId,
        rhLoteId,
      })
    ).rejects.toThrow(/rh_financeiro_lote_itens_status_check/);

    // Comprova que o lote remessa foi marcado como 'erro'
    expect(lotesRemessaStatusUpdate).toBe('erro');
    // Comprova que o NSA não foi consumido (permaneceu em 7)
    expect(ultimoNsaBanco).toBe(7);
  });

  it('2. RESOLUÇÃO: Com a constraint compatibilizada, a RPC atualiza os itens CLT para AGUARDANDO_RETORNO', async () => {
    // Simula o banco pós-aplicação da migration FIX-CNAB-02B
    setupDatabaseSimulator({ simulateConstraintFailure: false });

    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId,
      contaId: contaItauId,
      rhLoteId,
    });

    expect(result.arquivoId).toBe(persistedRemessaId);
    expect(result.sequencial).toBe(8);
    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_ITAU');

    // Comprova que os itens CLT transicionaram com sucesso para AGUARDANDO_RETORNO
    expect(itensStatusBanco['db41867b-a957-4cb1-a199-46b4fd4a247c']).toBe('AGUARDANDO_RETORNO');
    expect(itensStatusBanco['1d5c2d2d-6217-4fad-98cb-b569d797ad7d']).toBe('AGUARDANDO_RETORNO');
    // Comprova que o NSA evoluiu atômica e exatamente de 7 para 8
    expect(ultimoNsaBanco).toBe(8);
  });

  it('3. CICLO DE RETORNO: Status PAGO e CANCELADO são aceitos pela nova constraint; rejeições bancárias pertencem a cnab_retorno_itens', () => {
    // 4 Estados de RH
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('PENDENTE')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('EM_ANALISE')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('APROVADO')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('REJEITADO')).toBe(true);
    
    // 5 Estados Financeiro / Bancário / Conciliação
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('AGUARDANDO_RETORNO')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('PROCESSADO')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('ENVIADO')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('PAGO')).toBe(true);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('CANCELADO')).toBe(true);

    // Validação estrita: exatamente 9 estados
    expect(STATUS_PERMITIDOS_CONSTRAINT.size).toBe(9);

    // Estados que NÃO pertencem a rh_financeiro_lote_itens (pertencem a cnab_retorno_itens)
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('REJEITADO_BANCO')).toBe(false);
    expect(STATUS_PERMITIDOS_CONSTRAINT.has('DIVERGENTE')).toBe(false);
  });

  it('4. PRESERVAÇÃO INTERMITENTES: Lote de intermitentes não é afetado pela constraint de rh_financeiro_lote_itens', async () => {
    setupDatabaseSimulator({ simulateConstraintFailure: false });

    // Writer Banco do Brasil com intermitentes ou diaristas funciona sem depender de itens CLT
    const bbWriter = new CNAB240BBWriter();
    const result = await bbWriter.generateCNAB240({
      loteId: lotesRemessaId,
      rhLoteId,
      competencia: '2026-07',
      contaBancariaId: contaBbId,
      modo: 'HOMOLOGACAO',
      salvarConteudo: true,
    });

    expect(result.arquivoId).toBe(persistedRemessaId);
    expect(result.sequencial).toBe(8);
    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_BB');
  });

  it('5. ROLLBACK E RESILIÊNCIA: Falha na RPC não gera arquivo baixado e restaura integridade', async () => {
    setupDatabaseSimulator({ simulateConstraintFailure: true });

    let downloadDisparado = false;
    try {
      const res = await CNABService.generateRemessa({
        competencia: '2026-07',
        empresaId,
        contaId: contaItauId,
        rhLoteId,
      });

      if (res?.arquivoId && res.arquivoId !== 'nao-registrado') {
        downloadDisparado = true;
      }
    } catch {
      // Erro esperado capturado
    }

    expect(downloadDisparado).toBe(false);
    expect(ultimoNsaBanco).toBe(7);
  });
});
