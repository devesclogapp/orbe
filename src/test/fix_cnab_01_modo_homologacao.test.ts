import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CNABService } from '@/services/financial.service';
import { CNAB240ItauWriter } from '@/services/cnab/CNAB240ItauWriter';
import { CNAB240BBWriter } from '@/services/cnab/CNAB240BBWriter';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-cnab-test', email: 'auditor@orbe.test' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-cnab-uuid', userId: 'usr-cnab-test' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-cnab-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-cnab-test', tenant_id: 'tenant-cnab-uuid' }),
  };
});

describe('FIX-CNAB-01: CORREÇÃO DO MODO DE HOMOLOGAÇÃO NA GERAÇÃO DE REMESSAS CNAB', () => {
  const tenantId = 'tenant-cnab-uuid';
  const empHmlId = 'emp-hml-1111-1111';
  const empProdId = 'emp-prod-2222-2222';
  const contaItauHmlId = 'conta-itau-hml-3333';
  const contaItauProdId = 'conta-itau-prod-4444';
  const rhLoteHmlId = 'rh-lote-hml-5555';
  const rhLoteProdId = 'rh-lote-prod-6666';

  const mockItemHml = {
    id: 'rh-item-hml-1',
    lote_id: rhLoteHmlId,
    valor_calculado: 2400.0,
    colaboradores: {
      id: 'col-hml-1',
      nome: 'Colaborador CLT Homologação',
      cpf: '12345678901',
      banco_codigo: '341',
      agencia: '1234',
      agencia_digito: '0',
      conta: '6789',
      digito_conta: '1',
      tipo_conta: 'CORRENTE',
      is_teste: true,
      empresa_id: empHmlId,
    },
  };

  const mockItemProd = {
    id: 'rh-item-prod-1',
    lote_id: rhLoteProdId,
    valor_calculado: 3500.0,
    colaboradores: {
      id: 'col-prod-1',
      nome: 'Colaborador CLT Produção',
      cpf: '98765432100',
      banco_codigo: '341',
      agencia: '4321',
      agencia_digito: '0',
      conta: '9876',
      digito_conta: '5',
      tipo_conta: 'CORRENTE',
      is_teste: false,
      empresa_id: empProdId,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(10);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined as any);
  });

  const setupMockDb = (options: {
    empresa: { id: string; is_teste: boolean | null; nome: string };
    conta: { id: string; empresa_id: string; banco_codigo: string; cedente_cnpj: string };
    rhLote: { id: string; empresa_id: string; valor_total: number };
    rhItens: any[];
  }) => {
    let rpcRegisteredPayload: any = null;

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        rpcRegisteredPayload = args;
        return Promise.resolve({
          data: {
            remessa_id: 'remessa-registrada-uuid',
            sucesso: true,
            modo: args.p_modo,
            sequencial: 10,
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
              const chain: any = {
                single: vi.fn().mockResolvedValue({ data: options.empresa, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: options.empresa, error: null }),
                then: (resolve: any) => Promise.resolve({ data: options.empresa, error: null }).then(resolve),
              };
              chain.eq = vi.fn().mockReturnValue(chain);
              return chain;
            }),
          }),
        };
      }

      if (table === 'contas_bancarias_empresa') {
        const contaData = {
          ...options.conta,
          empresas: {
            id: options.empresa.id,
            nome: options.empresa.nome,
            cidade: 'SAO PAULO',
            estado: 'SP',
            is_teste: options.empresa.is_teste,
          },
        };
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: contaData, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: contaData, error: null }),
            }),
          }),
        };
      }

      if (table === 'rh_financeiro_lotes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: options.rhLote, error: null }),
              single: vi.fn().mockResolvedValue({ data: options.rhLote, error: null }),
            }),
          }),
        };
      }

      if (table === 'rh_financeiro_lote_itens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: options.rhItens, error: null }),
            in: vi.fn().mockResolvedValue({ data: options.rhItens, error: null }),
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
                data: { id: 'lote-remessa-uuid', ...options.rhLote, status: 'gerado' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
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

      if (table === 'cnab_auditoria_bancaria') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Auditor' }, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: { tenant_id: tenantId, full_name: 'Auditor' }, error: null }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    return {
      getRpcPayload: () => rpcRegisteredPayload,
    };
  };

  // ── TESTE 1: Empresa HML gera arquivo identificado como simulação de homologação ──
  it('1. Empresa HML gera arquivo claramente identificado como homologação (Itaú 341)', async () => {
    const db = setupMockDb({
      empresa: { id: empHmlId, is_teste: true, nome: 'Empresa Teste - Homologação' },
      conta: { id: contaItauHmlId, empresa_id: empHmlId, banco_codigo: '341', cedente_cnpj: '12345678000199' },
      rhLote: { id: rhLoteHmlId, empresa_id: empHmlId, valor_total: 2400.0 },
      rhItens: [mockItemHml],
    });

    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: empHmlId,
      contaId: contaItauHmlId,
      rhLoteId: rhLoteHmlId,
    });

    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_ITAU_');
    expect(result.content).toContain('ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)');
    expect(result.content).toContain('ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN E NÃO PODE SER TRANSMITIDO AO BANCO');
    expect(result.content).toContain('STATUS: SIMULAÇÃO CONCLUÍDA — ARQUIVO BANCÁRIO DE TRANSMISSÃO BLOQUEADO');
    expect(result.modo).toBe('homologacao');

    const rpcPayload = db.getRpcPayload();
    expect(rpcPayload.p_modo).toBe('homologacao');
    expect(rpcPayload.p_total_valor).toBe(2400.0);
    expect(rpcPayload.p_total_registros).toBe(1);
  });

  // ── TESTE 2: Empresa PROD mantém o fluxo de geração convencional ──────────────────
  it('2. Empresa PROD mantém fluxo de geração convencional posicional 240 posições', async () => {
    const db = setupMockDb({
      empresa: { id: empProdId, is_teste: false, nome: 'ESC Logística Matriz' },
      conta: { id: contaItauProdId, empresa_id: empProdId, banco_codigo: '341', cedente_cnpj: '99887766000111' },
      rhLote: { id: rhLoteProdId, empresa_id: empProdId, valor_total: 3500.0 },
      rhItens: [mockItemProd],
    });

    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: empProdId,
      contaId: contaItauProdId,
      rhLoteId: rhLoteProdId,
    });

    expect(result.fileName).toContain('CNAB240_ITAU_');
    expect(result.fileName).not.toContain('SIMULACAO');
    // Conteúdo posicional Febraban: cada linha possui exatamente 240 caracteres
    const rawLines = result.content.split(/\r?\n/);
    const lines = rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines;
    expect(lines.length).toBeGreaterThanOrEqual(4); // Header arq, header lote, seg A, trailer lote, trailer arq
    for (const l of lines) {
      expect(l.length).toBe(240);
    }
    expect(result.modo).toBe('producao');

    const rpcPayload = db.getRpcPayload();
    expect(rpcPayload.p_modo).toBe('producao');
  });

  // ── TESTE 3: Tentativa de forçar producao para empresa HML é ignorada ──────────────
  it('3. Tentativa de passar modo="producao" para empresa HML é anulada pela verdade de empresas.is_teste', async () => {
    const db = setupMockDb({
      empresa: { id: empHmlId, is_teste: true, nome: 'Empresa Teste - Homologação' },
      conta: { id: contaItauHmlId, empresa_id: empHmlId, banco_codigo: '341', cedente_cnpj: '12345678000199' },
      rhLote: { id: rhLoteHmlId, empresa_id: empHmlId, valor_total: 2400.0 },
      rhItens: [mockItemHml],
    });

    // Chamador hostil tenta forçar producao
    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: empHmlId,
      contaId: contaItauHmlId,
      rhLoteId: rhLoteHmlId,
      modo: 'producao', // Tentativa maliciosa de override
    });

    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_ITAU_');
    expect(result.modo).toBe('homologacao');
    expect(db.getRpcPayload().p_modo).toBe('homologacao');
  });

  // ── TESTE 4: Tentativa de forçar homologacao para empresa PROD não altera modo ─────
  it('4. Tentativa de passar modo="homologacao" para empresa PROD não altera a verdade canônica', async () => {
    const db = setupMockDb({
      empresa: { id: empProdId, is_teste: false, nome: 'ESC Logística Matriz' },
      conta: { id: contaItauProdId, empresa_id: empProdId, banco_codigo: '341', cedente_cnpj: '99887766000111' },
      rhLote: { id: rhLoteProdId, empresa_id: empProdId, valor_total: 3500.0 },
      rhItens: [mockItemProd],
    });

    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: empProdId,
      contaId: contaItauProdId,
      rhLoteId: rhLoteProdId,
      modo: 'homologacao', // Tentativa divergente
    });

    expect(result.fileName).toContain('CNAB240_ITAU_');
    expect(result.modo).toBe('producao');
    expect(db.getRpcPayload().p_modo).toBe('producao');
  });

  // ── TESTE 5: Ausência ou indefinição de is_teste provoca bloqueio (Fail-Closed) ───
  it('5. Empresa com is_teste indefinido (null) é bloqueada imediatamente (Fail-Closed)', async () => {
    setupMockDb({
      empresa: { id: empHmlId, is_teste: null as any, nome: 'Empresa Sem Classificação' },
      conta: { id: contaItauHmlId, empresa_id: empHmlId, banco_codigo: '341', cedente_cnpj: '12345678000199' },
      rhLote: { id: rhLoteHmlId, empresa_id: empHmlId, valor_total: 2400.0 },
      rhItens: [mockItemHml],
    });

    await expect(
      CNABService.generateRemessa({
        competencia: '2026-07',
        empresaId: empHmlId,
        contaId: contaItauHmlId,
        rhLoteId: rhLoteHmlId,
      })
    ).rejects.toThrow(/Falha de Integridade.*is_teste nulo/);
  });

  // ── TESTE 6 & 7: Nenhuma transmissão externa e nenhum pagamento executado ──────────
  it('6 & 7. Geração não dispara nenhuma requisição HTTP externa nem liquida pagamentos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    setupMockDb({
      empresa: { id: empHmlId, is_teste: true, nome: 'Empresa Teste - Homologação' },
      conta: { id: contaItauHmlId, empresa_id: empHmlId, banco_codigo: '341', cedente_cnpj: '12345678000199' },
      rhLote: { id: rhLoteHmlId, empresa_id: empHmlId, valor_total: 2400.0 },
      rhItens: [mockItemHml],
    });

    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: empHmlId,
      contaId: contaItauHmlId,
      rhLoteId: rhLoteHmlId,
    });

    // Nenhuma chamada fetch externa foi disparada
    expect(fetchSpy).not.toHaveBeenCalled();
    // Status do lote criado no banco é 'gerado', nunca 'pago' ou 'liquidado'
    expect(result.status).toBe('gerado');
    fetchSpy.mockRestore();
  });

  // ── TESTE 8: Validação de consistência do Banco do Brasil (001) ────────────────────
  it('8. Gerador do Banco do Brasil (001) também respeita a autoridade canônica de empresas.is_teste', async () => {
    const db = setupMockDb({
      empresa: { id: empHmlId, is_teste: true, nome: 'Empresa Teste BB' },
      conta: { id: 'conta-bb-hml', empresa_id: empHmlId, banco_codigo: '001', cedente_cnpj: '12345678000199' },
      rhLote: { id: rhLoteHmlId, empresa_id: empHmlId, valor_total: 2400.0 },
      rhItens: [mockItemHml],
    });

    const result = await CNABService.generateRemessa({
      competencia: '2026-07',
      empresaId: empHmlId,
      contaId: 'conta-bb-hml',
      rhLoteId: rhLoteHmlId,
    });

    expect(result.fileName).toContain('SIMULACAO_HOMOLOGACAO_BB_');
    expect(result.content).toContain('BANCO DO BRASIL (001)');
    expect(result.content).toContain('ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)');
    expect(result.modo).toBe('homologacao');
    expect(db.getRpcPayload().p_modo).toBe('homologacao');
  });
});
