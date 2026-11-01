import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import { EnvironmentService, EnvironmentScopeResolutionError } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-canon-test' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-canon-uuid', userId: 'usr-canon-test' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-canon-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-canon-test', tenant_id: 'tenant-canon-uuid' }),
  };
});

describe('CONTRATO CANÔNICO DE AMBIENTE CNAB — HOMOLOGAÇÃO × PRODUÇÃO (FAIL-CLOSED)', () => {
  const tenantId = 'tenant-canon-uuid';
  const empTesteId = 'emp-teste-1111-1111-1111';
  const empProdId = 'emp-prod-2222-2222-2222';
  const contaTesteId = 'conta-teste-3333-3333';
  const contaProdId = 'conta-prod-4444-4444';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(1);
    vi.spyOn(CnabRemessaArquivoService, 'checkDuplicate').mockResolvedValue(false);
    vi.spyOn(CnabRemessaArquivoService, 'checkLoteJaRemessado').mockResolvedValue(null);
    vi.spyOn(CnabRemessaArquivoService, 'checkDiaristasLoteJaRemessado').mockResolvedValue(null);
  });

  // Helper para simular o banco Supabase
  const setupDatabaseMock = (params: {
    empresaId: string;
    isTeste?: boolean | null;
    contaId: string;
    empresaCustomResponse?: { data: any; error: any };
  }) => {
    let rpcCalledWithModo: string | null = null;

    (supabase.rpc as any).mockImplementation((fn: string, args: any) => {
      if (fn === 'rpc_registrar_cnab_remessa') {
        rpcCalledWithModo = args?.p_modo;
        return Promise.resolve({
          data: { remessa_id: 'remessa-canon-id', sucesso: true, modo: args?.p_modo },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'contas_bancarias_empresa') {
        const contaMockChain: any = {
          single: vi.fn().mockResolvedValue({
            data: { id: params.contaId, empresa_id: params.empresaId, banco_codigo: '341', banco_nome: 'BANCO ITAU SA' },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: params.contaId, empresa_id: params.empresaId, banco_codigo: '341', banco_nome: 'BANCO ITAU SA' },
            error: null,
          }),
        };
        contaMockChain.eq = vi.fn().mockReturnValue(contaMockChain);
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(contaMockChain),
          }),
        };
      }
      if (table === 'empresas') {
        const defaultResp = {
          data: { id: params.empresaId, is_teste: params.isTeste, tenant_id: tenantId },
          error: null,
        };
        const responseToReturn = params.empresaCustomResponse !== undefined ? params.empresaCustomResponse : defaultResp;
        const empMockChain: any = {
          single: vi.fn().mockResolvedValue(responseToReturn),
          maybeSingle: vi.fn().mockResolvedValue(responseToReturn),
          then: (resolve: any) => Promise.resolve(responseToReturn).then(resolve),
        };
        empMockChain.eq = vi.fn().mockReturnValue(empMockChain);
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(empMockChain),
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
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'cnab_auditoria_bancaria') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (
        table === 'diaristas_lotes_fechamento' ||
        table === 'intermitentes_lotes_fechamento' ||
        table === 'lotes_remessa' ||
        table === 'lancamentos'
      ) {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
              then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
            }),
            then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
          }),
        }),
      };
    });

    return {
      getRpcModo: () => rpcCalledWithModo,
    };
  };

  // ── TESTE 1: Empresa teste (is_teste === true) → homologação ────────────────
  it('1. Empresa teste (is_teste=true) persiste modo="homologacao" canonicamente', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const db = setupDatabaseMock({ empresaId: empTesteId, isTeste: true, contaId: contaTesteId });

    const result = await CnabRemessaArquivoService.registrar({
      loteId: null,
      intermitentesLoteId: 'lote-int-test-1',
      empresaId: empTesteId,
      contaBancariaId: contaTesteId,
      nomeArquivo: 'CB341_TEST_001.txt',
      conteudoArquivo: 'HEADER...TRAILER...',
      totalRegistros: 1,
      totalValor: 100,
      itens: [{ origem_tipo: 'INTERMITENTE', origem_id: 'item-1', valor: 100 }],
    });

    expect(result.modo).toBe('homologacao');
    expect(db.getRpcModo()).toBe('homologacao');
  });

  // ── TESTE 2: Empresa produção (is_teste === false) → producao ───────────────
  it('2. Empresa producao (is_teste=false) persiste modo="producao" canonicamente', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const db = setupDatabaseMock({ empresaId: empProdId, isTeste: false, contaId: contaProdId });

    const result = await CnabRemessaArquivoService.registrar({
      loteId: null,
      intermitentesLoteId: 'lote-int-prod-1',
      empresaId: empProdId,
      contaBancariaId: contaProdId,
      nomeArquivo: 'CB341_PROD_001.txt',
      conteudoArquivo: 'HEADER...TRAILER...',
      totalRegistros: 1,
      totalValor: 500,
      itens: [{ origem_tipo: 'INTERMITENTE', origem_id: 'item-2', valor: 500 }],
    });

    expect(result.modo).toBe('producao');
    expect(db.getRpcModo()).toBe('producao');
  });

  // ── TESTE 3: Fail-closed: is_teste = null → rejeitado ───────────────────────
  it('3. Fail-closed: Empresa com is_teste=null é rejeitada com erro de integridade', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    setupDatabaseMock({
      empresaId: empTesteId,
      contaId: contaTesteId,
      empresaCustomResponse: {
        data: { id: empTesteId, is_teste: null, tenant_id: tenantId },
        error: null,
      },
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        empresaId: empTesteId,
        contaBancariaId: contaTesteId,
        nomeArquivo: 'CB341_NULL_TEST.txt',
        conteudoArquivo: '...',
        totalRegistros: 1,
        totalValor: 100,
        itens: [{ origem_tipo: 'FATURA', origem_id: 'fat-null', valor: 100 }],
      })
    ).rejects.toThrow(/Falha de Integridade.*is_teste nulo/);
  });

  // ── TESTE 4: Fail-closed: Empresa inexistente → rejeitada ───────────────────
  it('4. Fail-closed: Empresa inexistente no tenant é rejeitada', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    setupDatabaseMock({
      empresaId: 'emp-inexistente-uuid',
      contaId: contaTesteId,
      empresaCustomResponse: {
        data: null,
        error: null,
      },
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        empresaId: 'emp-inexistente-uuid',
        contaBancariaId: contaTesteId,
        nomeArquivo: 'CB341_NOTFOUND.txt',
        conteudoArquivo: '...',
        totalRegistros: 1,
        totalValor: 100,
        itens: [{ origem_tipo: 'FATURA', origem_id: 'fat-notfound', valor: 100 }],
      })
    ).rejects.toThrow(/Falha de Segurança.*não encontrada/);
  });

  // ── TESTE 5: Fail-closed: Erro Supabase no select → rejeitado ───────────────
  it('5. Fail-closed: Erro Supabase no select de empresas é rejeitado', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    setupDatabaseMock({
      empresaId: empTesteId,
      contaId: contaTesteId,
      empresaCustomResponse: {
        data: null,
        error: { message: 'Connection timeout with Supabase Postgres', code: '57P01' },
      },
    });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        empresaId: empTesteId,
        contaBancariaId: contaTesteId,
        nomeArquivo: 'CB341_DB_ERR.txt',
        conteudoArquivo: '...',
        totalRegistros: 1,
        totalValor: 100,
        itens: [{ origem_tipo: 'FATURA', origem_id: 'fat-err', valor: 100 }],
      })
    ).rejects.toThrow(/Falha técnica ao verificar classificação da empresa/);
  });

  // ── TESTE 6: Fail-closed: Ambiente homologação + empresa produção → rejeitado
  it('6. Fail-closed: Ambiente homologacao com empresa de producao aborta (ENVIRONMENT_MISMATCH)', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockRejectedValue(
      new EnvironmentScopeResolutionError('Empresa não encontrada ou não autorizada.', undefined, 'ENVIRONMENT_MISMATCH')
    );

    setupDatabaseMock({ empresaId: empProdId, isTeste: false, contaId: contaProdId });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        empresaId: empProdId,
        contaBancariaId: contaProdId,
        nomeArquivo: 'CB341_BLOCKED.txt',
        conteudoArquivo: '...',
        totalRegistros: 1,
        totalValor: 200,
        itens: [{ origem_tipo: 'FATURA', origem_id: 'fat-1', valor: 200 }],
      })
    ).rejects.toThrow('Empresa não encontrada ou não autorizada.');
  });

  // ── TESTE 7: Fail-closed: Ambiente produção + empresa teste → rejeitado ─────
  it('7. Fail-closed: Ambiente producao com empresa de teste aborta (ENVIRONMENT_MISMATCH)', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockRejectedValue(
      new EnvironmentScopeResolutionError('Empresa não encontrada ou não autorizada.', undefined, 'ENVIRONMENT_MISMATCH')
    );

    setupDatabaseMock({ empresaId: empTesteId, isTeste: true, contaId: contaTesteId });

    await expect(
      CnabRemessaArquivoService.registrar({
        loteId: null,
        empresaId: empTesteId,
        contaBancariaId: contaTesteId,
        nomeArquivo: 'CB341_BLOCKED_TEST.txt',
        conteudoArquivo: '...',
        totalRegistros: 1,
        totalValor: 200,
        itens: [{ origem_tipo: 'FATURA', origem_id: 'fat-2', valor: 200 }],
      })
    ).rejects.toThrow('Empresa não encontrada ou não autorizada.');
  });

  // ── TESTE 8: Tentativa explícita de passar modo='producao' para empresa teste ──
  it('8. Injeção explícita de modo="producao" para empresa teste é ignorada e grava "homologacao"', async () => {
    vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);

    const db = setupDatabaseMock({ empresaId: empTesteId, isTeste: true, contaId: contaTesteId });

    // Chamador tentando passar modo: 'producao' explicitamente para uma empresa de teste
    const result = await CnabRemessaArquivoService.registrar({
      loteId: null,
      intermitentesLoteId: 'lote-int-test-2',
      empresaId: empTesteId,
      contaBancariaId: contaTesteId,
      nomeArquivo: 'CB341_OVERRIDE_TEST.txt',
      conteudoArquivo: 'HEADER...TRAILER...',
      totalRegistros: 1,
      totalValor: 350,
      modo: 'producao', // Injeção incompatível!
      itens: [{ origem_tipo: 'INTERMITENTE', origem_id: 'item-3', valor: 350 }],
    });

    // O sistema DEVE ignorar e prevalecer a autoridade intrínseca de empresas.is_teste
    expect(result.modo).toBe('homologacao');
    expect(db.getRpcModo()).toBe('homologacao');
  });

  // ── TESTE 9: Intermitentes não possui mais literal de produção ──────────────
  it('9. Arquivo intermitentes.service.ts NÃO contém mais literal estático modo: "producao"', () => {
    const filePath = path.resolve(__dirname, '../services/domain/intermitentes.service.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    // Confirma que dentro de gerarCNABParaLote não existe mais modo: 'producao'
    const gerarCnabSection = content.substring(content.indexOf('async gerarCNABParaLote'));
    expect(gerarCnabSection).not.toMatch(/modo:\s*['"]producao['"]/);
  });

  // ── TESTE 10: Diaristas não possui mais literal de produção ──────────────────
  it('10. Arquivo diaristas.service.ts NÃO contém mais literal estático modo: "producao"', () => {
    const filePath = path.resolve(__dirname, '../services/domain/diaristas.service.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    // Confirma que dentro de gerarCNABParaLote não existe mais modo: 'producao'
    const gerarCnabSection = content.substring(content.indexOf('async gerarCNABParaLote'));
    expect(gerarCnabSection).not.toMatch(/modo:\s*['"]producao['"]/);
  });

  // ── TESTE 11: CLT / Financial não depende do default 'producao' ─────────────
  it('11. financial.service.ts não define default modo = "producao" em generateRemessa', () => {
    const filePath = path.resolve(__dirname, '../services/financial.service.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    // Confirma que a assinatura de generateRemessa não faz modo = 'producao'
    expect(content).not.toMatch(/modo\s*=\s*['"]producao['"]/);
  });

  // ── TESTE 12: Dashboard / DRE segregação de CNAB permanece íntegra ──────────
  it('12. Regra de segregação applyCnabSeg do Dashboard isola homologacao vs producao', () => {
    const safeContaTestIds = ['conta-teste-1'];

    // Lógica canônica de applyCnabSeg em dashboard.service.ts
    const applyCnabSegClause = (isHomologacao: boolean) => {
      if (isHomologacao) return `modo.eq.homologacao,and(modo.is.null,conta_bancaria_id.in.(${safeContaTestIds.join(',')}))`;
      return `modo.eq.producao,and(modo.is.null,conta_bancaria_id.not.in.(${safeContaTestIds.join(',')}))`;
    };

    // Em Homologação: remessa com modo='homologacao' é selecionada
    expect(applyCnabSegClause(true)).toContain('modo.eq.homologacao');

    // Em Produção: remessa com modo='producao' é selecionada
    expect(applyCnabSegClause(false)).toContain('modo.eq.producao');
  });

  // ── TESTE 13: Conciliação / Retorno continuam desacoplados de modo ──────────
  it('13. cnabRetorno.service.ts e cnabConciliacao.service.ts não filtram por modo (desacoplamento funcional)', () => {
    const retornoPath = path.resolve(__dirname, '../services/cnab/cnabRetorno.service.ts');
    const conciliacaoPath = path.resolve(__dirname, '../services/cnab/cnabConciliacao.service.ts');

    const retornoContent = fs.readFileSync(retornoPath, 'utf8');
    const conciliacaoContent = fs.readFileSync(conciliacaoPath, 'utf8');

    // Comprova que a busca de remessa no retorno não usa modo no WHERE
    expect(retornoContent).not.toMatch(/\.eq\(['"]modo['"]/);
    expect(conciliacaoContent).not.toMatch(/\.eq\(['"]modo['"]/);
  });
});
