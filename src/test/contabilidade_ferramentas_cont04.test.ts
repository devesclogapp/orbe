import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ContabilOficialService,
  CategoriaContabil,
} from "@/services/contabilOficial.service";
import { ReportService, LayoutService } from "@/services/report.service";
import { supabase } from "@/lib/supabase";

describe("ERP ORBE — CONT-04 | Homologação das Ferramentas Contábeis", () => {
  const mockEmpresaId = "28a560b5-37ef-403d-ae4f-b28a608b6a68";
  const mockCompetencia = "2026-09";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. MAPEAMENTO CONTÁBIL
  describe("1. Mapeamento Contábil", () => {
    it("deve carregar mapeamentos oficiais com status INCOMPLETO quando não houver contas configuradas", async () => {
      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "contabil_mapeamento") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const mapeamentos = await ContabilOficialService.getMapeamentos(mockEmpresaId);

      expect(mapeamentos).toHaveLength(4);
      expect(mapeamentos.every((m) => m.status === "INCOMPLETO")).toBe(true);
      expect(mapeamentos.every((m) => m.conta_debito === "" && m.conta_credito === "")).toBe(true);
    });

    it("deve validar obrigatoriedade de empresa, débito e crédito ao salvar mapeamento", async () => {
      await expect(
        ContabilOficialService.salvarMapeamento(
          "",
          "RECEITA_OPERACAO_VOLUME" as CategoriaContabil,
          "1.1.02.001",
          "3.1.01.001"
        )
      ).rejects.toThrow(/Empresa ID é obrigatório/i);

      await expect(
        ContabilOficialService.salvarMapeamento(
          mockEmpresaId,
          "RECEITA_OPERACAO_VOLUME" as CategoriaContabil,
          "",
          "3.1.01.001"
        )
      ).rejects.toThrow(/obrigatórias/i);
    });
  });

  // 2. LOGS DE INTEGRAÇÃO
  describe("2. Logs de Integração", () => {
    it("deve consultar registros reais de contabil_logs_integracao com filtros", async () => {
      const mockDbLogs = [
        {
          id: "log-1",
          created_at: "2026-10-01T10:00:00Z",
          tipo_envio: "Mensal",
          status: "sucesso",
          sistema_destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
          user_id: "user-123",
          payload: {
            empresa_id: mockEmpresaId,
            empresa_nome: "ESC LOG Homologada",
            competencia: "2026-09",
            total_lancamentos: 42,
            total_debito: 125000.5,
            arquivo_nome: "lote_contabil_2026_09.csv",
            solicitante: "admin@esclog.com.br",
          },
        },
        {
          id: "log-2",
          created_at: "2026-10-02T11:00:00Z",
          tipo_envio: "Mensal",
          status: "falha",
          sistema_destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
          user_id: "user-456",
          erro_detalhe: "Bloqueio: competência em aberto",
          payload: {
            empresa_id: "outra-empresa",
            empresa_nome: "Outra Empresa",
            competencia: "2026-09",
            total_lancamentos: 0,
            total_debito: 0,
            solicitante: "operador@esclog.com.br",
          },
        },
      ];

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "contabil_logs_integracao") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockDbLogs, error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      // Busca filtrada por empresa
      const logs = await ContabilOficialService.getLogs(mockEmpresaId, "2026-09");

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe("log-1");
      expect(logs[0].empresa_nome).toBe("ESC LOG Homologada");
      expect(logs[0].total_lancamentos).toBe(42);
      expect(logs[0].total_valor).toBe(125000.5);
      expect(logs[0].solicitante).toBe("admin@esclog.com.br");
      expect(logs[0].status).toBe("sucesso");
    });
  });

  // 3. AGENDAMENTOS CONTÁBEIS
  describe("3. Agendamentos Contábeis", () => {
    it("deve consultar agendamentos persistidos em relatorios_agendamentos", async () => {
      const mockSchedules = [
        {
          id: "sched-1",
          nome: "Exportação Contábil Mensal — ESC LOG",
          empresa_id: mockEmpresaId,
          frequencia: "mensal",
          status: "aguardando_ativacao",
          destinatarios: ["dia:5", "horario:08:00", "financeiro@esclog.com.br"],
          created_at: "2026-10-01T00:00:00Z",
        },
      ];

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "relatorios_agendamentos") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ data: mockSchedules, error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const schedules = await ReportService.getAgendamentos(mockEmpresaId);

      expect(schedules).toHaveLength(1);
      expect(schedules[0].frequencia).toBe("mensal");
      expect(schedules[0].status).toBe("aguardando_ativacao");
      expect(schedules[0].destinatarios).toContain("dia:5");
    });

    it("deve criar agendamento com status aguardando_ativacao", async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "sched-new", status: "aguardando_ativacao" },
            error: null,
          }),
        }),
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "relatorios_agendamentos") {
          return { insert: insertSpy } as any;
        }
        return {} as any;
      });

      const res = await ReportService.createAgendamento({
        empresa_id: mockEmpresaId,
        nome: "Agendamento Mensal",
        frequencia: "mensal",
        status: "aguardando_ativacao",
        destinatarios: ["dia:5", "horario:08:00"],
      });

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "aguardando_ativacao",
          frequencia: "mensal",
        })
      );
      expect(res.status).toBe("aguardando_ativacao");
    });

    it("deve atualizar status de agendamento (ativar / pausar)", async () => {
      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "sched-1", status: "pausado" },
              error: null,
            }),
          }),
        }),
      });

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "relatorios_agendamentos") {
          return { update: updateSpy } as any;
        }
        return {} as any;
      });

      const res = await ReportService.updateAgendamento("sched-1", { status: "pausado" });
      expect(res.status).toBe("pausado");
    });
  });

  // 4. LAYOUTS DE EXPORTAÇÃO
  describe("4. Layouts de Exportação", () => {
    it("deve consultar e persistir layout configurado por empresa em relatorios_layouts_exportacao", async () => {
      const mockLayout = {
        id: "layout-1",
        empresa_id: mockEmpresaId,
        nome: "Layout CSV Partidas Dobradas — ESC LOG",
        tipo: "csv",
        destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
        status: "ativo",
        colunas: {
          delimitador: ";",
          codificacao: "UTF-8",
          formato_data: "DD/MM/YYYY",
          formato_numero: "BRL",
          colunas: ["DATA", "CONTA_DEBITO", "CONTA_CREDITO", "VALOR"],
        },
      };

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "relatorios_layouts_exportacao") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ data: [mockLayout], error: null }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const layouts = await LayoutService.getLayouts(mockEmpresaId);

      expect(layouts).toHaveLength(1);
      expect(layouts[0].destino).toBe("ORBE_CSV_PARTIDAS_DOBRADAS");
      expect(layouts[0].colunas.delimitador).toBe(";");
      expect(layouts[0].colunas.formato_data).toBe("DD/MM/YYYY");
    });
  });
});

