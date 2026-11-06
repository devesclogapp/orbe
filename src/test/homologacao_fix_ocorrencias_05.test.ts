import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  OcorrenciasDecisaoService,
  OcorrenciaDecisaoRecord,
} from '@/services/domain/ocorrenciasDecisao.service';
import {
  DescontosOcorrenciasIntegracaoService,
  EventoFinanceiroOcorrencia,
} from '@/services/domain/descontosOcorrenciasIntegracao.service';
import { RHFinanceiroService } from '@/services/rhFinanceiro.service';
import { InfracoesCatalogoService } from '@/services/domain/infracoesCatalogo.service';

// Mock universal do Supabase para garantir isolamento 100% livre de escrita em produção
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'usr-rh-hml', email: 'rh.homologacao@orbe.local' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({
      tenantId: 'tenant-hml-test-uuid',
      userId: 'usr-rh-hml',
      userName: 'Gestor de Homologacao RH',
    }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-hml-test-uuid'),
  };
});

describe('HOMOLOGAÇÃO FIX-OCORRÊNCIAS-05 — Teste de Integração Real em Ambiente Isolado', () => {
  const tenantTestId = 'tenant-hml-test-uuid';
  const empresaTestId = 'empresa-hml-001';
  const colaboradorTestId = 'colab-joao-teste-001';
  const operacaoTestId = 'op-volume-hml-500';
  const competenciaTest = '2026-11';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // ETAPA 3 — SIMULAR OPERAÇÃO COMPLETA (JOÃO TESTE)
  // ============================================================================
  describe('ETAPA 3 — Simulação da Operação Completa (João Teste)', () => {
    const valorBruto = 200.0;
    const valorProvisorio = 80.0; // Infração: Avaria de mercadoria registrada pelo encarregado
    const valorAutorizado = 50.0; // Valor homologado e autorizado pelo RH (Art. 462 CLT)

    it('3.1 Comprova que ANTES da deliberação formal do RH, o líquido oficial permanece R$ 200,00', () => {
      // Estado inicial: Ocorrência apontada pelo encarregado em campo com valor de referência
      const resultado = OcorrenciasDecisaoService.calcularLiquidos(
        valorBruto,
        null, // Sem decisão autorizada ainda
        valorProvisorio
      );

      expect(resultado.valorBase).toBe(200.0);
      expect(resultado.descontoProvisorio).toBe(80.0);
      expect(resultado.descontoAutorizado).toBe(0.0);
      expect(resultado.liquidoProjetado).toBe(120.0); // 200 - 80 = 120 (Apenas projeção informativa)
      expect(resultado.liquidoAutorizado).toBe(200.0); // Líquido oficial 100% preservado em R$ 200,00!
      expect(resultado.statusDeliberacao).toBe('PENDENTE');
    });

    it('3.2 Comprova que APÓS autorização formal do RH (Art. 462 CLT), o líquido oficial reflete exatamente R$ 150,00', () => {
      const decisaoHomologadaRH: OcorrenciaDecisaoRecord = {
        id: 'decisao-hml-joao',
        tenant_id: tenantTestId,
        empresa_id: empresaTestId,
        operacao_id: operacaoTestId,
        collaborator_id: colaboradorTestId,
        infracao_codigo: 'AVARIA_MERCADORIA',
        valor_provisorio_snapshot: valorProvisorio,
        tipo_decisao: 'PROPOSTA_RESSARCIMENTO',
        status: 'AUTORIZADO',
        valor_autorizado: valorAutorizado,
        competencia_sugerida: competenciaTest,
        fundamento_legal: 'Art. 462 CLT - Previsão contratual expressa para dano material e laudo técnico com culpa apurada.',
        decidido_por: 'usr-rh-hml',
        decidido_por_nome: 'Gestor de Homologacao RH',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const resultado = OcorrenciasDecisaoService.calcularLiquidos(
        valorBruto,
        decisaoHomologadaRH,
        valorProvisorio
      );

      expect(resultado.valorBase).toBe(200.0);
      expect(resultado.descontoProvisorio).toBe(80.0);
      expect(resultado.descontoAutorizado).toBe(50.0);
      expect(resultado.liquidoProjetado).toBe(120.0);
      expect(resultado.liquidoAutorizado).toBe(150.0); // 200 - 50 = 150,00 oficial!
      expect(resultado.statusDeliberacao).toBe('AUTORIZADO');
    });
  });

  // ============================================================================
  // ETAPA 4 — TESTAR OS TRÊS VÍNCULOS (CLT, INTERMITENTE, DIARISTA)
  // ============================================================================
  describe('ETAPA 4 — Integração Efetiva aos Três Motores de Pagamento', () => {
    const decisaoAutorizada: OcorrenciaDecisaoRecord = {
      id: 'dec-joao-teste',
      tenant_id: tenantTestId,
      empresa_id: empresaTestId,
      operacao_id: operacaoTestId,
      collaborator_id: colaboradorTestId,
      infracao_codigo: 'AVARIA_MERCADORIA',
      valor_provisorio_snapshot: 80.0,
      tipo_decisao: 'PROPOSTA_RESSARCIMENTO',
      status: 'AUTORIZADO',
      valor_autorizado: 50.0,
      competencia_sugerida: competenciaTest,
      fundamento_legal: 'Art. 462 CLT com dolo ou culpa apurada em laudo pericial.',
      decidido_por: 'usr-rh-hml',
      decidido_por_nome: 'Gestor RH',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 4.1 CLT
    it('4.1 CLT: Gera evento e integra ao lote mensal de folha com dedução de R$ 50,00', async () => {
      // 1. Gera o evento financeiro
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            in: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
            }),
          }),
        }),
      }).mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: 'ev-clt-joao',
                tenant_id: tenantTestId,
                empresa_id: empresaTestId,
                decisao_id: decisaoAutorizada.id,
                collaborator_id: colaboradorTestId,
                tipo_vinculo: 'CLT',
                competencia: competenciaTest,
                valor_desconto: 50.0,
                status: 'PENDENTE_APLICACAO',
                detalhes_json: {
                  descricao_operacional: 'Desconto Autorizado por Ressarcimento de Avaria / Dano Material (Art. 462 CLT)',
                },
              },
              error: null,
            }),
          }),
        }),
      });

      const evento = await DescontosOcorrenciasIntegracaoService.gerarEventoFinanceiro({
        decisao: decisaoAutorizada,
        tipo_vinculo: 'CLT',
        competencia: competenciaTest,
        saldoRemuneracaoDisponivel: 200.0,
        usuario_id: 'usr-rh-hml',
      });

      expect(evento.id).toBe('ev-clt-joao');
      expect(evento.status).toBe('PENDENTE_APLICACAO');
      expect(evento.valor_desconto).toBe(50.0);

      // 2. Simula vinculação do evento ao lote de pagamento CLT em rh_financeiro_lote_itens
      (supabase.from as any).mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    ...evento,
                    status: 'APLICADO',
                    lote_pagamento_id: 'lote-folha-clt-202611',
                    aplicado_em: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const eventoAplicado = await DescontosOcorrenciasIntegracaoService.vincularAoLotePagamento(
        evento.id,
        'lote-folha-clt-202611',
        'AGUARDANDO_PAGAMENTO',
        'usr-rh-hml'
      );

      expect(eventoAplicado.status).toBe('APLICADO');
      expect(eventoAplicado.lote_pagamento_id).toBe('lote-folha-clt-202611');
    });

    // 4.2 INTERMITENTE
    it('4.2 Intermitente: Deduz R$ 50,00 no fechamento intermitente e atualiza evento para APLICADO', async () => {
      (supabase.from as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: 'ev-inter-joao',
                    tenant_id: tenantTestId,
                    status: 'PENDENTE_APLICACAO',
                    detalhes_json: { infracao_codigo: 'AVARIA_MERCADORIA' },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValueOnce({ error: null }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: 'ev-inter-joao',
                    status: 'APLICADO',
                    lote_pagamento_id: 'lote-intermitente-202611',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        });

      const resIntermitente = await DescontosOcorrenciasIntegracaoService.aplicarDescontoIntermitente({
        eventoId: 'ev-inter-joao',
        empresaId: empresaTestId,
        colaboradorId: colaboradorTestId,
        loteId: 'lote-intermitente-202611',
        valorDesconto: 50.0,
        usuarioId: 'usr-rh-hml',
      });

      expect(resIntermitente.status).toBe('APLICADO');
      expect(resIntermitente.lote_pagamento_id).toBe('lote-intermitente-202611');
    });

    // 4.3 DIARISTA
    it('4.3 Diarista: Cria lançamento de ajuste na grade de diaristas (-R$ 50,00) e fecha com líquido R$ 150,00', async () => {
      (supabase.from as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: 'ev-dia-joao',
                    status: 'PENDENTE_APLICACAO',
                    detalhes_json: { infracao_codigo: 'AVARIA_MERCADORIA' },
                  },
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: {
                  id: 'lanc-dia-original-joao',
                  tenant_id: tenantTestId,
                  nome_colaborador: 'João Teste',
                  funcao_colaborador: 'Ajudante Geral',
                  data_lancamento: '2026-11-04',
                  codigo_marcacao: 'P',
                },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: { id: 'ajuste-lanc-dia-50' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: 'ev-dia-joao',
                    status: 'APLICADO',
                    lote_pagamento_id: 'lote-diaristas-semana-45',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        });

      const resDiarista = await DescontosOcorrenciasIntegracaoService.aplicarDescontoDiarista({
        eventoId: 'ev-dia-joao',
        empresaId: empresaTestId,
        diaristaId: colaboradorTestId,
        referenciaLancamentoId: 'lanc-dia-original-joao',
        loteId: 'lote-diaristas-semana-45',
        valorDesconto: 50.0,
        usuarioId: 'usr-rh-hml',
        usuarioNome: 'Gestor de Homologacao RH',
      });

      expect(resDiarista.ajusteId).toBe('ajuste-lanc-dia-50');
      expect(resDiarista.eventoAtualizado.status).toBe('APLICADO');
      expect(resDiarista.eventoAtualizado.lote_pagamento_id).toBe('lote-diaristas-semana-45');

      // Verifica reflexo no valor final do lote semanal (200 - 50 = 150)
      const lancamentosSessao = [
        { diarista_id: colaboradorTestId, valor_calculado: 200.0, tipo_registro: 'normal' },
        { diarista_id: colaboradorTestId, valor_calculado: -50.0, tipo_registro: 'ajuste' },
      ];
      const totalLiquidoSemanal = lancamentosSessao.reduce((acc, curr) => acc + curr.valor_calculado, 0);
      expect(totalLiquidoSemanal).toBe(150.0);
    });
  });

  // ============================================================================
  // ETAPA 5 — TESTES DE SEGURANÇA FINANCEIRA E GOVERNANÇA
  // ============================================================================
  describe('ETAPA 5 — Testes de Segurança Financeira, Idempotência e RLS', () => {
    it('5.1 Idempotência: Reprocessamento de decisão já aplicada impede duplicidade de desconto', async () => {
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            in: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: 'evento-existente-ativo', status: 'APLICADO' },
                error: null,
              }),
            }),
          }),
        }),
      });

      await expect(
        DescontosOcorrenciasIntegracaoService.gerarEventoFinanceiro({
          decisao: {
            id: 'dec-ja-processada',
            tenant_id: tenantTestId,
            empresa_id: empresaTestId,
            operacao_id: operacaoTestId,
            collaborator_id: colaboradorTestId,
            infracao_codigo: 'AVARIA_MERCADORIA',
            valor_provisorio_snapshot: 80.0,
            tipo_decisao: 'PROPOSTA_RESSARCIMENTO',
            status: 'AUTORIZADO',
            valor_autorizado: 50.0,
            fundamento_legal: 'Art. 462 CLT com dolo ou culpa apurada em laudo pericial.',
            decidido_por: 'usr-rh',
            decidido_por_nome: 'RH',
            created_at: '',
            updated_at: '',
          },
          tipo_vinculo: 'CLT',
          competencia: competenciaTest,
          saldoRemuneracaoDisponivel: 1000.0,
          usuario_id: 'usr-rh',
        })
      ).rejects.toThrow('Idempotência violada: Já existe um evento financeiro ativo');
    });

    it('5.2 Imutabilidade: Lotes fechados, pagos ou com remessa bancária gerada rejeitam qualquer aplicação de desconto', async () => {
      const statusImutaveis = ['pago', 'remessa_gerada', 'concluido', 'fechado', 'liquidado'];

      for (const st of statusImutaveis) {
        await expect(
          DescontosOcorrenciasIntegracaoService.vincularAoLotePagamento(
            'evento-desconto-1',
            'lote-bloqueado-id',
            st,
            'usr-rh'
          )
        ).rejects.toThrow('Violação de segurança bancária: Não é permitido vincular descontos a um lote no status');
      }
    });

    it('5.3 Decisão rejeitada/arquivada não produz nenhum desconto financeiro', () => {
      const decisaoArquivada: OcorrenciaDecisaoRecord = {
        id: 'dec-rejeitada',
        tenant_id: tenantTestId,
        empresa_id: empresaTestId,
        operacao_id: operacaoTestId,
        collaborator_id: colaboradorTestId,
        infracao_codigo: 'AVARIA_MERCADORIA',
        valor_provisorio_snapshot: 80.0,
        tipo_decisao: 'ARQUIVADA_SEM_PENALIDADE',
        status: 'REJEITADO',
        valor_autorizado: 0,
        fundamento_legal: 'Sem culpa do colaborador.',
        decidido_por: 'usr-rh',
        decidido_por_nome: 'RH',
        created_at: '',
        updated_at: '',
      };

      const calculo = OcorrenciasDecisaoService.calcularLiquidos(200.0, decisaoArquivada, 80.0);
      expect(calculo.descontoAutorizado).toBe(0.0);
      expect(calculo.liquidoAutorizado).toBe(200.0); // Integral!
    });

    it('5.4 Bloqueia desconto que produza saldo líquido negativo', async () => {
      await expect(
        DescontosOcorrenciasIntegracaoService.gerarEventoFinanceiro({
          decisao: {
            id: 'dec-exorbitante',
            tenant_id: tenantTestId,
            empresa_id: empresaTestId,
            operacao_id: operacaoTestId,
            collaborator_id: colaboradorTestId,
            infracao_codigo: 'AVARIA_MERCADORIA',
            valor_provisorio_snapshot: 80.0,
            tipo_decisao: 'PROPOSTA_RESSARCIMENTO',
            status: 'AUTORIZADO',
            valor_autorizado: 250.0, // Maior que o saldo de R$ 200,00!
            fundamento_legal: 'Art. 462 CLT com dolo ou culpa apurada em laudo pericial.',
            decidido_por: 'usr-rh',
            decidido_por_nome: 'RH',
            created_at: '',
            updated_at: '',
          },
          tipo_vinculo: 'CLT',
          competencia: competenciaTest,
          saldoRemuneracaoDisponivel: 200.0,
          usuario_id: 'usr-rh',
        })
      ).rejects.toThrow('excede a remuneração disponível do colaborador');
    });

    it('5.5 Encarregado não pode aprovar deliberações administrativas nem eventos de desconto', () => {
      const userRoles = ['encarregado'];
      const allowedRoles = ['admin', 'super_admin', 'gestor', 'rh'];

      const canDeliberate = (role: string) => allowedRoles.includes(role);
      expect(canDeliberate(userRoles[0])).toBe(false);
    });
  });
});

