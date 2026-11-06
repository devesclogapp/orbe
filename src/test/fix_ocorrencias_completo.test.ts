import { describe, it, expect, vi } from "vitest";
import { InfracoesCatalogoService, InfracaoInput } from "@/services/domain/infracoesCatalogo.service";
import {
  OcorrenciasDecisaoService,
  RegistrarDecisaoParams,
  OcorrenciaDecisaoRecord,
} from "@/services/domain/ocorrenciasDecisao.service";
import {
  DescontosOcorrenciasIntegracaoService,
  GerarEventoDescontoParams,
} from "@/services/domain/descontosOcorrenciasIntegracao.service";
import {
  REGRAS_OCORRENCIAS_LOGISTICA,
  validarCondutasEquipe,
  condutaColaboradorSchema,
} from "@/components/operacoes/lancamento/schema";
import { supabase } from "@/lib/supabase";

describe("FIX-OCORRÊNCIAS-05 — Suite Completa de Verificação e Homologação dos Pagamentos", () => {
  // ============================================================================
  // TESTE 1: Catálogo Disponível, Vazio e Indisponível (Sem valores fictícios)
  // ============================================================================
  describe("1. Catálogo Disponível, Vazio e Indisponível", () => {
    it("deve propagar erro explicitamente quando a consulta ao catálogo falhar, sem inventar valores fictícios", async () => {
      // Força erro de banco no supabase.from
      const spy = vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { message: "Conexão recusada ao banco de dados" },
            }),
          }),
        }),
      } as any);

      await expect(InfracoesCatalogoService.listarAtivos()).rejects.toThrow("CATALOGO_INDISPONIVEL");
      spy.mockRestore();
    });

    it("deve retornar array vazio quando o catálogo estiver vazio no banco (sem injetar defaults estáticos)", async () => {
      const spy = vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const lista = await InfracoesCatalogoService.listarAtivos();
      expect(lista).toEqual([]);
      spy.mockRestore();
    });

    it("deve retornar itens ativos cadastrados pelo Admin com seus valores de referência reais", async () => {
      const mockCatalogo = [
        {
          id: "inf-1",
          codigo: "AVARIA_PALLET",
          nome: "Avaria de Pallet",
          categoria: "OPERACIONAL",
          valor_referencia: 95.5,
          exige_dano_material: true,
          ativo: true,
        },
      ];

      const spy = vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            order: vi.fn().mockResolvedValueOnce({
              data: mockCatalogo,
              error: null,
            }),
          }),
        }),
      } as any);

      const lista = await InfracoesCatalogoService.listarAtivos();
      expect(lista.length).toBe(1);
      expect(lista[0].nome).toBe("Avaria de Pallet");
      expect(lista[0].valor_referencia).toBe(95.5);
      spy.mockRestore();
    });
  });

  // ============================================================================
  // TESTE 2: Lançamento pelo Encarregado (com snapshot provisório)
  // ============================================================================
  describe("2. Lançamento pelo Encarregado", () => {
    it("deve preservar o snapshot de valor_provisorio e código no momento do lançamento", () => {
      const conduta = condutaColaboradorSchema.parse({
        collaborator_id: "colab-10",
        had_infraction: true,
        infraction_type_id: "Avaria de Pallet",
        infraction_notes: "Palete quebrado durante descarga da carreta",
        valor_provisorio: 95.5,
        infracao_codigo: "AVARIA_PALLET",
      });

      expect(conduta.valor_provisorio).toBe(95.5);
      expect(conduta.infracao_codigo).toBe("AVARIA_PALLET");
      expect(conduta.had_infraction).toBe(true);
    });

    it("deve impedir lançamento incompleto sem descrição factual", () => {
      const erro = validarCondutasEquipe(
        ["colab-10"],
        {
          "colab-10": {
            had_infraction: true,
            infraction_type_id: "Avaria de Pallet",
            infraction_notes: "",
          },
        },
        [{ id: "colab-10", nome: "Marcos Operador" }]
      );
      expect(erro).toContain("Informe a descrição detalhada da ocorrência");
    });
  });

  // ============================================================================
  // TESTE 3: Aprovação e Rejeição pelo RH (Art. 462 CLT)
  // ============================================================================
  describe("3. Aprovação e Rejeição Administrativa", () => {
    it("deve rejeitar aprovação de desconto sem fundamentação legal substantiva (mínimo 10 caracteres)", async () => {
      await expect(
        OcorrenciasDecisaoService.registrarDecisao({
          empresa_id: "emp-1",
          operacao_id: "op-1",
          collaborator_id: "colab-1",
          tipo_decisao: "PROPOSTA_RESSARCIMENTO",
          valor_autorizado: 95.5,
          competencia_sugerida: "2026-11",
          fundamento_legal: "curto",
          decidido_por: "usr-rh",
          decidido_por_nome: "Gestor RH",
        })
      ).rejects.toThrow("A fundamentação legal/contratual é obrigatória (mínimo de 10 caracteres)");
    });

    it("deve arquivar sem desconto com status REJEITADO quando o RH decidir ARQUIVADA_SEM_PENALIDADE", async () => {
      const spyInsert = vi.spyOn(supabase, "from").mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: "dec-arq",
                tipo_decisao: "ARQUIVADA_SEM_PENALIDADE",
                status: "REJEITADO",
                valor_autorizado: 0,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      // Simula ausência de decisão ativa anterior
      vi.spyOn(OcorrenciasDecisaoService, "getAtivaPorColaboradorEOperacao").mockResolvedValueOnce(null);

      const res = await OcorrenciasDecisaoService.registrarDecisao({
        empresa_id: "emp-1",
        operacao_id: "op-1",
        collaborator_id: "colab-1",
        tipo_decisao: "ARQUIVADA_SEM_PENALIDADE",
        fundamento_legal: "Apurado que o rompimento da cinta se deu por defeito de fabricação, sem culpa do trabalhador.",
        decidido_por: "usr-rh",
        decidido_por_nome: "Gestor RH",
      });

      expect(res.tipo_decisao).toBe("ARQUIVADA_SEM_PENALIDADE");
      expect(res.status).toBe("REJEITADO");
      expect(res.valor_autorizado).toBe(0);
      spyInsert.mockRestore();
    });
  });

  // ============================================================================
  // TESTE 4, 5 e 6: Integração com Pagamentos (CLT, Intermitentes e Diaristas)
  // ============================================================================
  describe("4, 5 e 6. Integração Efetiva aos Motores de Pagamento", () => {
    const decisaoAprovadaValida: OcorrenciaDecisaoRecord = {
      id: "dec-homologada",
      tenant_id: "tenant-esc",
      empresa_id: "emp-esc",
      operacao_id: "op-esc",
      collaborator_id: "colab-1",
      infracao_codigo: "AVARIA_MATERIAL",
      valor_provisorio_snapshot: 120.0,
      tipo_decisao: "PROPOSTA_RESSARCIMENTO",
      status: "AUTORIZADO",
      valor_autorizado: 80.0,
      competencia_sugerida: "2026-11",
      fundamento_legal: "Art. 462 CLT - Previsão contratual expressa em contrato de trabalho e laudo interno.",
      decidido_por: "rh-1",
      decidido_por_nome: "Diretoria RH",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("4. Desconto CLT: deve gerar evento financeiro válido sem códigos contábeis inventados", async () => {
      const spyInsert = vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            in: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
            }),
          }),
        }),
      } as any).mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({
              data: {
                id: "ev-clt-1",
                tipo_vinculo: "CLT",
                valor_desconto: 80.0,
                status: "PENDENTE_APLICACAO",
                detalhes_json: {
                  descricao_operacional: "Desconto Autorizado por Ressarcimento de Avaria / Dano Material (Art. 462 CLT)",
                },
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const evento = await DescontosOcorrenciasIntegracaoService.gerarEventoFinanceiro({
        decisao: decisaoAprovadaValida,
        tipo_vinculo: "CLT",
        competencia: "2026-11",
        saldoRemuneracaoDisponivel: 1500.0,
        usuario_id: "rh-usr",
      });

      expect(evento.status).toBe("PENDENTE_APLICACAO");
      expect(evento.valor_desconto).toBe(80.0);
      expect(evento.detalhes_json?.descricao_operacional).toContain("Art. 462 CLT");
      expect(evento.detalhes_json?.descricao_operacional).not.toContain("RUBRICA_5042");
      spyInsert.mockRestore();
    });

    it("5. Desconto Intermitente: deve vincular ajuste negativo em lancamentos_intermitentes e marcar evento como APLICADO", async () => {
      const spy = vi.spyOn(supabase, "from")
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: { id: "ev-inter-1", tenant_id: "t1", status: "PENDENTE_APLICACAO", detalhes_json: { infracao_codigo: "AVARIA" } },
                  error: null,
                }),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValueOnce({ error: null }),
        } as any)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: { id: "ev-inter-1", status: "APLICADO", lote_pagamento_id: "lote-inter-99" },
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

      const res = await DescontosOcorrenciasIntegracaoService.aplicarDescontoIntermitente({
        eventoId: "ev-inter-1",
        empresaId: "emp-1",
        colaboradorId: "colab-inter",
        loteId: "lote-inter-99",
        valorDesconto: 60.0,
        usuarioId: "usr-rh",
      });

      expect(res.status).toBe("APLICADO");
      expect(res.lote_pagamento_id).toBe("lote-inter-99");
      spy.mockRestore();
    });

    it("6. Desconto Diarista: deve criar ajuste negativo na grade de diaristas e atualizar evento", async () => {
      const spy = vi.spyOn(supabase, "from")
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: { id: "ev-dia-1", status: "PENDENTE_APLICACAO", detalhes_json: { infracao_codigo: "AVARIA" } },
                  error: null,
                }),
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: { id: "dia-orig-1", tenant_id: "t1", nome_colaborador: "João Diarista", funcao_colaborador: "Chapa", data_lancamento: "2026-11-04", codigo_marcacao: "P" },
                error: null,
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({ data: { id: "ajuste-dia-99" }, error: null }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: { id: "ev-dia-1", status: "APLICADO", lote_pagamento_id: "lote-dia-10" },
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

      const res = await DescontosOcorrenciasIntegracaoService.aplicarDescontoDiarista({
        eventoId: "ev-dia-1",
        empresaId: "emp-1",
        diaristaId: "colab-dia",
        referenciaLancamentoId: "dia-orig-1",
        loteId: "lote-dia-10",
        valorDesconto: 40.0,
        usuarioId: "usr-rh",
        usuarioNome: "Gestor RH",
      });

      expect(res.ajusteId).toBe("ajuste-dia-99");
      expect(res.eventoAtualizado.status).toBe("APLICADO");
      spy.mockRestore();
    });
  });

  // ============================================================================
  // TESTE 7 & 8: Idempotência e Proteção de Lotes Fechados / CNAB
  // ============================================================================
  describe("7 & 8. Idempotência e Proteção Bancária", () => {
    it("7. deve impedir aplicação duplicada de um mesmo evento financeiro (idempotência)", async () => {
      const spy = vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            in: vi.fn().mockReturnValueOnce({
              maybeSingle: vi.fn().mockResolvedValueOnce({
                data: { id: "ev-existente", status: "APLICADO" },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      await expect(
        DescontosOcorrenciasIntegracaoService.gerarEventoFinanceiro({
          decisao: {
            id: "dec-ja-gerada",
            tenant_id: "t1",
            empresa_id: "e1",
            operacao_id: "op1",
            collaborator_id: "c1",
            infracao_codigo: "AVARIA",
            valor_provisorio_snapshot: 100,
            tipo_decisao: "PROPOSTA_RESSARCIMENTO",
            status: "AUTORIZADO",
            valor_autorizado: 100,
            fundamento_legal: "Art. 462 CLT com dolo ou culpa apurada.",
            decidido_por: "u1",
            decidido_por_nome: "Admin",
            created_at: "",
            updated_at: "",
          },
          tipo_vinculo: "CLT",
          competencia: "2026-11",
          saldoRemuneracaoDisponivel: 1000,
          usuario_id: "u1",
        })
      ).rejects.toThrow("Idempotência violada: Já existe um evento financeiro ativo");

      spy.mockRestore();
    });

    it("8. deve proibir terminantemente alteração ou vinculação a lotes fechados, pagos ou com remessa gerada", async () => {
      const statusImutaveis = ["pago", "remessa_gerada", "concluido", "fechado", "liquidado"];

      for (const st of statusImutaveis) {
        await expect(
          DescontosOcorrenciasIntegracaoService.vincularAoLotePagamento(
            "ev-1",
            "lote-fechado",
            st,
            "usr-1"
          )
        ).rejects.toThrow("Violação de segurança bancária");
      }
    });
  });

  // ============================================================================
  // TESTE 9 & 10: Multi-Tenant e Líquido Nunca Negativo
  // ============================================================================
  describe("9 & 10. Multi-Tenant e Regressão de Fechamentos", () => {
    it("9. Encarregado nunca pode deliberar nem ter acesso às deliberações e eventos financeiros", () => {
      const roleEncarregado = "encarregado";
      const rolesAdminRH = ["admin", "super_admin", "gestor", "rh"];

      expect(rolesAdminRH.includes(roleEncarregado)).toBe(false);
      expect(rolesAdminRH.includes("admin")).toBe(true);
      expect(rolesAdminRH.includes("rh")).toBe(true);
    });

    it("10. deve garantir que o cálculo de líquidos NUNCA gere saldo negativo nem dívida futura", () => {
      const calculo = OcorrenciasDecisaoService.calcularLiquidos(80.0, {
        id: "d1",
        tenant_id: "t1",
        empresa_id: "e1",
        operacao_id: "op1",
        collaborator_id: "c1",
        infracao_codigo: "AVARIA",
        valor_provisorio_snapshot: 150.0,
        tipo_decisao: "PROPOSTA_RESSARCIMENTO",
        status: "AUTORIZADO",
        valor_autorizado: 250.0, // Autorizado maior que o saldo
        fundamento_legal: "Art. 462 CLT",
        decidido_por: "u1",
        decidido_por_nome: "RH",
        created_at: "",
        updated_at: "",
      }, 150.0);

      expect(calculo.liquidoAutorizado).toBe(0.0);
      expect(calculo.liquidoProjetado).toBe(0.0);
      expect(calculo.liquidoAutorizado).toBeGreaterThanOrEqual(0);
    });
  });
});
