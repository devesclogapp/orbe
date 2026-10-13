import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { MotorFinanceiro } from '@/services/operationalEngine/MotorFinanceiro';
import { CNABBase } from '@/services/cnab/CNABBase';
import { CnabRemessaArquivoService } from '@/services/cnab/cnabRemessaArquivo.service';
import { CNAB240BBWriter } from '@/services/cnab/CNAB240BBWriter';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { HomologacaoEncerramentoService } from '@/services/environment/HomologacaoEncerramentoService';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-hml-test-id' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-secure-uuid', userId: 'usr-hml-test-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-secure-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-hml-test-id', tenant_id: 'tenant-secure-uuid' }),
  };
});

// Helper universal para encadeamento do Supabase
const createMockChain = (data: any) => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  chain.then = (resolve: any) => Promise.resolve({ data, error: null }).then(resolve);
  return chain;
};

describe('FIX-HML-02 — BLINDAGEM FINANCEIRA, CNAB E ENCERRAMENTO SEGURO', () => {
  const tenantId = 'tenant-secure-uuid';
  const empProdId = 'emp-prod-1111';
  const empHmlId = 'emp-hml-2222';
  const contaProdId = 'conta-prod-3333';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. ISOLAMENTO FINANCEIRO ENTRE PRODUÇÃO E HOMOLOGAÇÃO
  // ============================================================================
  describe('1. Isolamento Financeiro e Regras de Cálculo', () => {
    it('1.1 Bloqueia consolidação no MotorFinanceiro se operações HML forem processadas em contexto PROD', async () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'financeiro_consolidados_cliente') {
          return createMockChain([]);
        }
        if (table === 'operacoes_producao') {
          return createMockChain([
            {
              id: 'op-hml-1',
              tenant_id: tenantId,
              empresa_id: empHmlId,
              valor_total: 1000,
              status: 'AGUARDANDO_FATURAMENTO',
              empresas: { is_teste: true }
            }
          ]);
        }
        return createMockChain(null);
      });

      const res = await MotorFinanceiro.processarFechamento('2026-10', empHmlId, tenantId);
      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Operação PROD detectou registros HML');
    });

    it('1.2 Bloqueia consolidação no MotorFinanceiro se operações PROD forem processadas em contexto HML', async () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'financeiro_consolidados_cliente') {
          return createMockChain([]);
        }
        if (table === 'operacoes_producao') {
          return createMockChain([
            {
              id: 'op-prod-1',
              tenant_id: tenantId,
              empresa_id: empProdId,
              valor_total: 2000,
              status: 'AGUARDANDO_FATURAMENTO',
              empresas: { is_teste: false }
            }
          ]);
        }
        return createMockChain(null);
      });

      const res = await MotorFinanceiro.processarFechamento('2026-10', empProdId, tenantId);
      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Operação HML detectou registros PROD');
    });

    it('1.3 Permite fluxo legítimo e cálculos para dados de homologação em ambiente HML', async () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');

      (supabase.rpc as any).mockResolvedValue({ data: 'cliente-espelho-id', error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'financeiro_consolidados_cliente') {
          const c = createMockChain([]);
          c.upsert = vi.fn().mockResolvedValue({ error: null });
          return c;
        }
        if (table === 'operacoes_producao') {
          return createMockChain([
            {
              id: 'op-hml-1',
              tenant_id: tenantId,
              empresa_id: empHmlId,
              valor_total: 1500,
              valor_faturamento_nf: 1500,
              quantidade: 10,
              status: 'AGUARDANDO_FATURAMENTO',
              empresas: { is_teste: true },
              production_entry_collaborators: []
            }
          ]);
        }
        if (table === 'clientes' || table === 'empresas') {
          return createMockChain({ id: empHmlId, nome: 'Empresa Teste HML' });
        }
        if (table === 'faturas' || table === 'financeiro_calculos_memoria' || table === 'financeiro_consolidados_colaborador') {
          const c = createMockChain(null);
          c.upsert = vi.fn().mockResolvedValue({ error: null });
          c.insert = vi.fn().mockResolvedValue({ error: null });
          return c;
        }
        return createMockChain(null);
      });

      const res = await MotorFinanceiro.processarFechamento('2026-10', empHmlId, tenantId);
      expect(res.success).toBe(true);
    });
  });

  // ============================================================================
  // 2. BLOQUEIO DE MISTURA ENTRE EMPRESAS REAIS E DE TESTE
  // ============================================================================
  describe('2. Bloqueio de Mistura (Lotes e Modo TODOS)', () => {
    it('2.1 MotorFinanceiro recusa fechamento com fontes mistas (ENVIRONMENT_MIXED_SOURCE)', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'financeiro_consolidados_cliente') {
          return createMockChain([]);
        }
        if (table === 'operacoes_producao') {
          return createMockChain([
            { id: 'op-1', tenant_id: tenantId, empresa_id: empProdId, empresas: { is_teste: true } },
            { id: 'op-2', tenant_id: tenantId, empresa_id: empProdId, empresas: { is_teste: false } },
          ]);
        }
        return createMockChain(null);
      });

      const res = await MotorFinanceiro.processarFechamento('2026-10', empProdId, tenantId);
      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Fontes mistas não são permitidas');
    });

    it('2.2 No modo TODOS, rejeita qualquer operação com tenant divergente (TENANT_MISMATCH)', async () => {
      vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('todos');

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'financeiro_consolidados_cliente') {
          return createMockChain([]);
        }
        if (table === 'operacoes_producao') {
          return createMockChain([
            { id: 'op-1', tenant_id: 'outro-tenant-hack', empresa_id: empProdId, empresas: { is_teste: false } },
          ]);
        }
        return createMockChain(null);
      });

      const res = await MotorFinanceiro.processarFechamento('2026-10', empProdId, tenantId);
      expect(res.success).toBe(false);
      expect(res.error?.message).toContain('Tenant Mismatch');
    });
  });

  // ============================================================================
  // 3. BLOQUEIO CNAB REAL CONTENDO REGISTROS DE TESTE
  // ============================================================================
  describe('3. Proteção CNAB e Bloqueio de Remessas', () => {
    it('3.1 CNABBase.fetchLoteData bloqueia geração de remessa CLT se colaborador for de teste em lote real', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'contas_bancarias_empresa') {
          return createMockChain({
            id: contaProdId,
            empresa_id: empProdId,
            banco_codigo: '001',
            cedente_cnpj: '12345678000199'
          });
        }
        if (table === 'empresas') {
          // Retorna lista com empresa de teste (para EnvironmentService.getTestEmpresaIds)
          // ou single empresa (para assertEmpresaAllowed e busca canônica)
          const chain = createMockChain([
            { id: 'emp-teste-id', is_teste: true, tenant_id: tenantId }
          ]);
          chain.single = vi.fn().mockResolvedValue({
            data: { id: empProdId, is_teste: false, tenant_id: tenantId },
            error: null
          });
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: empProdId, is_teste: false, tenant_id: tenantId },
            error: null
          });
          return chain;
        }
        if (table === 'rh_financeiro_lotes') {
          return createMockChain({
            id: 'rh-lote-prod',
            valor_total: 1000,
            empresa_id: empProdId
          });
        }
        if (table === 'rh_financeiro_lote_itens') {
          return createMockChain([
            {
              id: 'item-1',
              valor_calculado: 1000,
              colaboradores: {
                id: 'colab-teste-leak',
                nome: 'Colaborador Fake Teste',
                is_teste: true, // VAZAMENTO DE HOMOLOGAÇÃO
                empresa_id: empProdId
              }
            }
          ]);
        }
        return createMockChain(null);
      });

      await expect(
        CNABBase.fetchLoteData('lote-1', contaProdId, 'rh-lote-prod')
      ).rejects.toThrow(/BLOQUEIO DE SEGURANÇA CNAB.*diverge da classificação da remessa/);
    });

    it('3.2 CnabRemessaArquivoService.marcarComoEnviadoManual rejeita arquivo de homologação', async () => {
      vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValueOnce({
        id: 'remessa-hml-1',
        tenant_id: tenantId,
        lote_id: 'lote-1',
        nome_arquivo: 'CNAB240_BB_HOMOLOGACAO.txt',
        sequencial_arquivo: 1,
        hash_arquivo: 'hash-test',
        total_registros: 1,
        total_valor: 500,
        status: 'gerado',
        modo: 'homologacao', // REMESSA DE TESTE
        data_geracao: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await expect(
        CnabRemessaArquivoService.marcarComoEnviadoManual('remessa-hml-1', 'Tentativa de envio real')
      ).rejects.toThrow(/Remessas geradas no ambiente de Homologação não podem ser transmitidas/);
    });

    it('3.3 CnabRemessaArquivoService.marcarComoHomologado rejeita arquivo de produção', async () => {
      vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValueOnce({
        id: 'remessa-prod-1',
        tenant_id: tenantId,
        lote_id: 'lote-1',
        nome_arquivo: 'CNAB240_BB_PRODUCAO.txt',
        sequencial_arquivo: 1,
        hash_arquivo: 'hash-prod',
        total_registros: 5,
        total_valor: 10000,
        status: 'gerado',
        modo: 'producao', // REMESSA REAL
        data_geracao: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await expect(
        CnabRemessaArquivoService.marcarComoHomologado('remessa-prod-1')
      ).rejects.toThrow(/Remessas do ambiente de Produção não utilizam status de homologação/);
    });

    it('3.4 Bloqueia redownload e marcarComoBaixado de arquivo de homologação', async () => {
      vi.spyOn(CnabRemessaArquivoService, 'buscarPorId').mockResolvedValue({
        id: 'remessa-hml-download-test',
        tenant_id: tenantId,
        lote_id: 'lote-1',
        nome_arquivo: 'CNAB240_BB_TESTE.txt',
        sequencial_arquivo: 1,
        hash_arquivo: 'hash-test',
        total_registros: 1,
        total_valor: 500,
        status: 'gerado',
        modo: 'homologacao',
        conteudo_arquivo: 'conteudo de teste',
        data_geracao: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // 1. Redownload deve abortar
      await expect(
        CNAB240BBWriter.redownload('remessa-hml-download-test')
      ).rejects.toThrow(/Bloqueio de Segurança Bancária.*não podem ser baixadas/);

      // 2. Marcar como baixado deve abortar
      await expect(
        CnabRemessaArquivoService.marcarComoBaixado('remessa-hml-download-test')
      ).rejects.toThrow(/Bloqueio de Segurança Bancária.*não podem ser baixadas/);
    });

    it('3.5 generateRemessa em Homologação produz relatório de simulação não-bancário', async () => {
      const faturasMock = [
        {
          id: 'fat-hml-1',
          valor: 1500,
          colaboradores: {
            id: 'col-hml-1',
            nome: 'Colaborador Homologacao',
            cpf: '12345678901',
            banco_codigo: '001',
            agencia: '1234',
            agencia_digito: '0',
            conta: '56789',
            digito_conta: '1',
            is_teste: true
          }
        }
      ];

      const envSpy = vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
      const testEmpSpy = vi.spyOn(EnvironmentService, 'getTestEmpresaIds').mockResolvedValue([empHmlId]);

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'contas_bancarias_empresa') {
          return createMockChain({
            id: contaProdId,
            empresa_id: empHmlId,
            banco_codigo: '001',
            cedente_cnpj: '12345678000199',
            empresas: { nome: 'Empresa Teste HML', is_teste: true, tenant_id: tenantId }
          });
        }
        if (table === 'empresas') {
          return createMockChain({ id: empHmlId, is_teste: true, nome: 'Empresa Teste HML', tenant_id: tenantId });
        }
        if (table === 'faturas') {
          return createMockChain(faturasMock);
        }
        return createMockChain(null);
      });

      vi.spyOn(CnabRemessaArquivoService, 'getNextSequencial').mockResolvedValue(1);
      vi.spyOn(CnabRemessaArquivoService, 'registrar').mockResolvedValue({
        id: 'remessa-registrada-hml',
        modo: 'homologacao'
      } as any);

      try {
        const writer = new CNAB240BBWriter();
        const res = await writer.generateCNAB240({
          loteId: 'lote-hml-1',
          contaBancariaId: contaProdId,
          competencia: '2026-10',
          modo: 'homologacao',
          salvarConteudo: true,
        });

        // Validação de Segurança Bancária:
        // O nome do arquivo NÃO é um nome bancário oficial, e o conteúdo é um relatório de simulação
        expect(res.fileName).toContain('SIMULACAO_HOMOLOGACAO_BB_');
        expect(res.content).toContain('ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)');
        expect(res.content).toContain('ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN E NÃO PODE SER TRANSMITIDO AO BANCO');
        expect(res.modo).toBe('homologacao');
      } finally {
        envSpy.mockRestore();
        testEmpSpy.mockRestore();
      }
    });
  });

  // ============================================================================
  // 4. ENCERRAMENTO LÓGICO SEM EXCLUSÃO FÍSICA
  // ============================================================================
  describe('4. Encerramento Lógico Seguro (Sem Deletes)', () => {
    it('4.1 Bloqueia encerramento se a empresa for de produção (is_teste = false)', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'empresas') {
          return createMockChain({
            id: empProdId,
            nome: 'Empresa Real',
            is_teste: false,
            tenant_id: tenantId
          });
        }
        return createMockChain(null);
      });

      await expect(
        HomologacaoEncerramentoService.encerrarHomologacao({
          empresaId: empProdId,
          justificativa: 'Tentativa de limpar dados de produção'
        })
      ).rejects.toThrow(/Apenas empresas de homologação.*podem ser encerradas/);
    });

    it('4.2 Bloqueia encerramento sem justificativa válida (mínimo 10 caracteres)', async () => {
      await expect(
        HomologacaoEncerramentoService.encerrarHomologacao({
          empresaId: empHmlId,
          justificativa: 'curto'
        })
      ).rejects.toThrow(/Justificativa obrigatória com no mínimo 10 caracteres/);
    });

    it('4.3 Encerra logicamente todos os fluxos de teste sem executar DELETE no banco', async () => {
      const updatedTables: string[] = [];
      const deletedTables: string[] = [];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'empresas') {
          return createMockChain({
            id: empHmlId,
            nome: 'Empresa Teste HML',
            is_teste: true,
            tenant_id: tenantId
          });
        }

        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.lte = vi.fn().mockReturnValue(chain);
        chain.update = vi.fn().mockImplementation(() => {
          updatedTables.push(table);
          return chain;
        });
        chain.delete = vi.fn().mockImplementation(() => {
          deletedTables.push(table);
          return chain;
        });
        chain.insert = vi.fn().mockResolvedValue({ error: null });
        chain.then = (resolve: any) => resolve({ data: [{ id: 'mock-1' }], error: null });
        return chain;
      });

      const res = await HomologacaoEncerramentoService.encerrarHomologacao({
        empresaId: empHmlId,
        justificativa: 'Finalização do ciclo de testes de homologação com sucesso'
      });

      expect(res.success).toBe(true);
      expect(res.empresaId).toBe(empHmlId);
      expect(res.justificativa).toBe('Finalização do ciclo de testes de homologação com sucesso');
      
      // CONFIRMAÇÃO ABSOLUTA: ZERO DELETES
      expect(deletedTables.length).toBe(0);
      
      // CONFIRMAÇÃO DE TRANSIÇÕES LÓGICAS NATIVAS
      expect(updatedTables).toContain('operacoes_producao');
      expect(updatedTables).toContain('servicos_extras_operacionais');
      expect(updatedTables).toContain('custos_extras_operacionais');
      expect(updatedTables).toContain('lancamentos_diaristas');
      expect(updatedTables).toContain('receitas_operacionais');
      expect(updatedTables).toContain('faturas');
    });

    it('4.4 Operações com soft delete ou EM_RESTRICAO são ignoradas pelo MotorFinanceiro (Zero Faturamento/DRE)', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'financeiro_consolidados_cliente') {
          return createMockChain([]);
        }
        if (table === 'operacoes_producao') {
          return createMockChain([
            {
              id: 'op-hml-encerrada',
              tenant_id: tenantId,
              empresa_id: empHmlId,
              valor_total: 5000,
              valor_faturamento_nf: 5000,
              status: 'EM_RESTRICAO',
              status_rh: 'DEVOLVIDO_RH',
              deleted_at: '2026-10-13T00:00:00Z',
              empresas: { is_teste: true },
              production_entry_collaborators: []
            }
          ]);
        }
        return createMockChain(null);
      });

      const envSpy = vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
      try {
        const res = await MotorFinanceiro.processarFechamento('2026-10', empHmlId, tenantId);
        // Nenhuma operação elegível para faturar
        expect(res.success).toBe(true);
        expect(res.message).toContain('Nenhuma operação elegível para faturar');
      } finally {
        envSpy.mockRestore();
      }
    });
  });

  // ============================================================================
  // 5. PRESERVAÇÃO DOS FLUXOS FINANCEIROS LEGÍTIMOS
  // ============================================================================
  describe('5. Preservação dos Fluxos Financeiros de Produção', () => {
    it('5.1 CNABBase.fetchLoteData opera normalmente para lotes e colaboradores de produção', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'contas_bancarias_empresa') {
          return createMockChain({
            id: contaProdId,
            empresa_id: empProdId,
            banco_codigo: '001',
            cedente_cnpj: '12345678000199'
          });
        }
        if (table === 'empresas') {
          const chain = createMockChain([
            { id: 'emp-teste-id', is_teste: true, tenant_id: tenantId }
          ]);
          chain.single = vi.fn().mockResolvedValue({
            data: { id: empProdId, is_teste: false, tenant_id: tenantId },
            error: null
          });
          chain.maybeSingle = vi.fn().mockResolvedValue({
            data: { id: empProdId, is_teste: false, tenant_id: tenantId },
            error: null
          });
          return chain;
        }
        if (table === 'rh_financeiro_lotes') {
          return createMockChain({
            id: 'rh-lote-prod',
            valor_total: 5000,
            empresa_id: empProdId
          });
        }
        if (table === 'rh_financeiro_lote_itens') {
          return createMockChain([
            {
              id: 'item-prod-1',
              valor_calculado: 5000,
              colaboradores: {
                id: 'colab-real-1',
                nome: 'Colaborador Efetivo Real',
                is_teste: false,
                empresa_id: empProdId,
                banco_codigo: '001',
                agencia: '1234',
                agencia_digito: '5',
                conta: '98765',
                digito_conta: '0'
              }
            }
          ]);
        }
        return createMockChain(null);
      });

      const data = await CNABBase.fetchLoteData('lote-prod', contaProdId, 'rh-lote-prod');
      expect(data.conta?.empresa_id).toBe(empProdId);
      expect(data.faturas.length).toBe(1);
      expect(data.valorEsperadoLote).toBe(5000);
      expect(data.faturas[0].colaboradores.is_teste).toBe(false);
    });
  });
});
