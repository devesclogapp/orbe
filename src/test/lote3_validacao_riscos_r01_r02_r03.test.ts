import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { LoteFechamentoDiaristaService } from '@/services/domain/diaristas.service';
import { BancarioOficialAdapter } from '@/services/bancarioOficialAdapter';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-admin-1' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-1234'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-admin-1', tenant_id: 'tenant-1234' }),
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-1234' }),
  };
});

vi.mock('@/services/environment/EnvironmentService', () => ({
  EnvironmentService: {
    assertEmpresaAllowed: vi.fn().mockResolvedValue(true),
    getTestEmpresaIds: vi.fn().mockResolvedValue([]),
    getCurrentEnvironment: vi.fn().mockReturnValue('PRODUCAO'),
    invalidate: vi.fn(),
  },
}));

describe('LOTE 3 — FASE 02A: VALIDAÇÃO CONTROLADA DOS RISCOS PRIORITÁRIOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // R01 — REABERTURA E NOVO FECHAMENTO (CONFLITO DE ÍNDICE ÚNICO 23505)
  // =========================================================================
  describe('R01 — Reabertura e Novo Fechamento de Lote', () => {
    it('R01.1: Simula erro 23505 (uq_diaristas_lote_periodo) e confirma que fecharPeriodo captura e retorna { error: "CONCURRENCY_ERROR" }', async () => {
      const empresaId = 'empresa-1111';
      const periodoInicio = '2026-10-12';
      const periodoFim = '2026-10-18';

      const lancamentosAbertos = [
        {
          id: 'lanc-01',
          empresa_id: empresaId,
          tenant_id: 'tenant-1234',
          diarista_id: 'colab-1',
          nome_colaborador: 'Diarista Teste 1',
          quantidade_diaria: 1,
          valor_diaria_base: 140,
          valor_calculado: 140,
          status: 'EM_ABERTO',
        },
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'lancamentos_diaristas') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      in: vi.fn().mockResolvedValue({ data: lancamentosAbertos, error: null }),
                    }),
                  }),
                }),
                is: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }

        if (table === 'diaristas_lotes_fechamento') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "uq_diaristas_lote_periodo"',
                    details: 'Key (tenant_id, empresa_id, periodo_inicio, periodo_fim)=(tenant-1234, empresa-1111, 2026-10-12, 2026-10-18) already exists.',
                  },
                }),
              }),
            }),
          };
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const resultado = await LoteFechamentoDiaristaService.fecharPeriodo({
        empresaId,
        periodoInicio,
        periodoFim,
        fechadoPor: 'usr-admin-1',
        fechadoPorNome: 'Encarregado Local',
        fechadoPorRole: 'encarregado',
      });

      // Confirma que o serviço captura o erro 23505 e retorna o objeto de erro
      expect(resultado).toEqual({ error: 'CONCURRENCY_ERROR' });
    });

    it('R01.2: Confirma que o toast da interface interpreta { error: "CONCURRENCY_ERROR" } como sucesso com valores NaN / undefined', () => {
      // Simula a lógica de onSuccess do componente DiaristasLancamento.tsx (linhas 546-547)
      const loteRetornadoPeloServico: any = { error: 'CONCURRENCY_ERROR' };

      const formatCurrency = (v: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

      // Código original da UI:
      // toast.success(`Período fechado. ${lote.total_registros} registro(s). ${formatCurrency(lote.valor_total)}`);
      const mensagemMontada = `Período fechado. ${loteRetornadoPeloServico.total_registros} registro(s). ${formatCurrency(loteRetornadoPeloServico.valor_total)}`;

      // O toast exibe "undefined registro(s). R$ NaN", enganando o operador
      expect(mensagemMontada).toContain('undefined registro(s)');
      expect(mensagemMontada).toContain('NaN');
      expect(loteRetornadoPeloServico.id).toBeUndefined();
    });
  });

  // =========================================================================
  // R02 — FILA DE APROVAÇÕES RH E DIÁRIAS EM ABERTO SEM LOTE
  // =========================================================================
  describe('R02 — Fila de Aprovações RH e Diárias Sem Lote', () => {
    it('R02.1: Demonstra como a view vw_aprovacoes_rh mapeia diária EM_ABERTO sem lote como "Em análise"', () => {
      // Simulação do comportamento da view vw_aprovacoes_rh para DIARISTAS
      const lancamentoAvulsoEmAberto = {
        id: 'lanc-avulso-123',
        empresa_id: 'empresa-1111',
        diarista_id: 'colab-1',
        nome_colaborador: 'Diarista Teste',
        data_lancamento: '2026-10-18',
        valor_calculado: 140,
        quantidade_diaria: 1,
        status: 'EM_ABERTO',
        lote_fechamento_id: null, // SEM LOTE
      };

      // Mapeamento idêntico ao SQL da view vw_aprovacoes_rh:
      // raw_status: d.status ('EM_ABERTO')
      // raw_lote_id: d.lote_fechamento_id (null)
      // situacao: CASE WHEN upper(raw_status) IN ('EM_ABERTO', ...) THEN 'Em análise'
      const itemMapeadoPelaView = {
        id: lancamentoAvulsoEmAberto.id,
        tipo: 'DIARISTA',
        referencia: 'Diária ' + lancamentoAvulsoEmAberto.id.substring(0, 6),
        colaborador: lancamentoAvulsoEmAberto.nome_colaborador,
        valor: lancamentoAvulsoEmAberto.valor_calculado,
        raw_status: lancamentoAvulsoEmAberto.status,
        raw_lote_id: lancamentoAvulsoEmAberto.lote_fechamento_id,
        situacao: 'Em análise',
      };

      expect(itemMapeadoPelaView.situacao).toBe('Em análise');
      expect(itemMapeadoPelaView.raw_lote_id).toBeNull();
    });

    it('R02.2: Demonstra que aprovarMutation falha silenciosamente quando raw_lote_id é nulo', async () => {
      const itemViewSemLote: any = {
        id: 'lanc-avulso-123',
        tipo: 'DIARISTA',
        raw_lote_id: null, // Sem lote!
        situacao: 'Em análise',
      };

      let updateChamado = false;
      (supabase.from as any).mockImplementation((table: string) => {
        return {
          update: vi.fn().mockImplementation(() => {
            updateChamado = true;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      });

      // Lógica exata de AprovacoesRh.tsx (linhas 417-429):
      // if (item.tipo === "DIARISTA" && item.raw_lote_id) { ... }
      let executouAprovacao = false;
      if (itemViewSemLote.tipo === 'DIARISTA' && itemViewSemLote.raw_lote_id) {
        await supabase
          .from('diaristas_lotes_fechamento')
          .update({ status: 'VALIDADO_RH' })
          .eq('id', itemViewSemLote.raw_lote_id);
        executouAprovacao = true;
      }

      // Como raw_lote_id é null, a aprovação é ignorada silenciosamente!
      expect(executouAprovacao).toBe(false);
      expect(updateChamado).toBe(false);
    });
  });

  // =========================================================================
  // R03 — CLASSIFICAÇÃO BANCÁRIA (ADAPTADOR VS DOMAIN SERVICE)
  // =========================================================================
  describe('R03 — Classificação Bancária dos Lotes de Diaristas', () => {
    it('R03.1: Confirma que lotes em AGUARDANDO_VALIDACAO_RH e VALIDADO_RH são marcados como PRONTO_BANCO no adaptador', async () => {
      const lotesDb = [
        {
          id: 'lote-aguardando-rh',
          empresa_id: 'empresa-1111',
          tenant_id: 'tenant-1234',
          periodo_inicio: '2026-10-12',
          periodo_fim: '2026-10-18',
          mes_referencia: '2026-10',
          total_registros: 5,
          valor_total: 700,
          status: 'AGUARDANDO_VALIDACAO_RH', // NÃO aprovado por RH nem Financeiro
        },
        {
          id: 'lote-validado-rh',
          empresa_id: 'empresa-1111',
          tenant_id: 'tenant-1234',
          periodo_inicio: '2026-10-12',
          periodo_fim: '2026-10-18',
          mes_referencia: '2026-10',
          total_registros: 4,
          valor_total: 560,
          status: 'VALIDADO_RH', // Validado pelo RH, mas NÃO aprovado pelo Financeiro
        },
        {
          id: 'lote-fechado-fin',
          empresa_id: 'empresa-1111',
          tenant_id: 'tenant-1234',
          periodo_inicio: '2026-10-12',
          periodo_fim: '2026-10-18',
          mes_referencia: '2026-10',
          total_registros: 3,
          valor_total: 420,
          status: 'FECHADO_FINANCEIRO', // Aprovado pelo Financeiro
        },
      ];

      const createChain = (data: any) => {
        const chain: any = {};
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.or = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.is = vi.fn().mockReturnValue(chain);
        chain.neq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.lte = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: any) => Promise.resolve({ data, error: null }).then(resolve);
        return chain;
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'diaristas_lotes_fechamento') {
          return { select: vi.fn().mockReturnValue(createChain(lotesDb)) };
        }
        if (table === 'contas_bancarias_empresa') {
          return {
            select: vi.fn().mockReturnValue(
              createChain([
                {
                  id: 'conta-1',
                  empresa_id: 'empresa-1111',
                  banco_codigo: '001',
                  banco_nome: 'BANCO DO BRASIL',
                  agencia: '1234',
                  conta: '56789',
                  ativo: true,
                  permite_cnab: true,
                  is_padrao: true,
                },
              ])
            ),
          };
        }
        if (table === 'empresas') {
          return {
            select: vi.fn().mockReturnValue(
              createChain([
                {
                  id: 'empresa-1111',
                  nome: 'Empresa Teste',
                  is_teste: false,
                },
              ])
            ),
          };
        }
        return { select: vi.fn().mockReturnValue(createChain([])) };
      });

      const obrigacoes = await BancarioOficialAdapter.carregarObrigacoes({
        tenantId: 'tenant-1234',
      });

      const obAguardandoRh = obrigacoes.find((o) => o.loteId === 'lote-aguardando-rh');
      const obValidadoRh = obrigacoes.find((o) => o.loteId === 'lote-validado-rh');
      const obFechadoFin = obrigacoes.find((o) => o.loteId === 'lote-fechado-fin');

      // Divergência confirmada: Lotes sem aprovação financeira aparecem como PRONTO_BANCO na aba PRONTAS_BANCO!
      expect(obAguardandoRh?.situacao).toBe('PRONTO_BANCO');
      expect(obAguardandoRh?.estagioTab).toBe('PRONTAS_BANCO');

      expect(obValidadoRh?.situacao).toBe('PRONTO_BANCO');
      expect(obValidadoRh?.estagioTab).toBe('PRONTAS_BANCO');

      expect(obFechadoFin?.situacao).toBe('PRONTO_BANCO');
      expect(obFechadoFin?.estagioTab).toBe('PRONTAS_BANCO');
    });

    it('R03.2: Confirma que o serviço real gerarCNABParaLote bloqueia a geração para lotes não aprovados pelo Financeiro', async () => {
      const loteAguardandoRh = {
        id: 'lote-aguardando-rh',
        empresa_id: 'empresa-1111',
        tenant_id: 'tenant-1234',
        status: 'AGUARDANDO_VALIDACAO_RH', // Bloqueado
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'diaristas_lotes_fechamento') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: loteAguardandoRh, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      // Invoca gerarCNABParaLote: deve estourar erro de segurança fail-closed
      await expect(
        LoteFechamentoDiaristaService.gerarCNABParaLote({
          loteId: 'lote-aguardando-rh',
          empresaId: 'empresa-1111',
          geradoPor: 'usr-admin-1',
          geradoPorNome: 'Operador Financeiro',
          empresaRemetente: {
            cnpj: '12345678000199',
            razao_social: 'Empresa Teste',
            banco_codigo: '001',
            agencia: '1234',
            conta: '56789',
          },
        })
      ).rejects.toThrow(/Geração de CNAB bloqueada: o lote precisa estar aprovado pelo Financeiro/);
    });
  });
});
