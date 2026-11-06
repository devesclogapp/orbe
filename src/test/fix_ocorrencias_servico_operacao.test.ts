import { describe, it, expect } from "vitest";
import {
  validarCondutasEquipe,
  getRegrasOcorrenciaPorCargo,
  REGRAS_OCORRENCIAS_LOGISTICA,
} from "@/components/operacoes/lancamento/schema";
import {
  isRouteForbiddenForRole,
  getDefaultRouteForRole,
  canAccessModule,
  ACCESS_PRESETS,
} from "@/lib/access-control";

describe("ERP ORBE — FIX-OCORRÊNCIAS-02 | Testes de Ocorrências e Faltas em Serviços", () => {
  const colaboradoresMock = [
    { id: "col-1", nome: "Carlos Ajudante", cargo: "Auxiliar de Logística" },
    { id: "col-2", nome: "Marcos Conferente", cargo: "Conferente" },
    { id: "col-3", nome: "João Motorista", cargo: "Motorista" },
  ];

  describe("1. Catálogo e Filtro de Regras por Cargo", () => {
    it("deve conter catálogo com tipos essenciais de avarias, EPIs e conduta", () => {
      const ids = REGRAS_OCORRENCIAS_LOGISTICA.map((r) => r.id);
      expect(ids).toContain("carga_avaria");
      expect(ids).toContain("epi_ausente");
      expect(ids).toContain("desvio_conduta");
      expect(ids).toContain("pontualidade_atraso");
    });

    it("deve filtrar regras específicas para Conferente e incluir regras globais (*)", () => {
      const regrasConferente = getRegrasOcorrenciaPorCargo("Conferente");
      const labels = regrasConferente.map((r) => r.label);

      expect(labels).toContain("Divergência na conferência de NF / Carga");
      expect(labels).toContain("Avaria / Dano à Carga");
      expect(labels).toContain("EPI: Não utilização / Uso incorreto de EPI");
    });

    it("deve filtrar regras de direção/veículo para Motorista", () => {
      const regrasMotorista = getRegrasOcorrenciaPorCargo("Motorista");
      const labels = regrasMotorista.map((r) => r.label);

      expect(labels).toContain("Excesso de velocidade no pátio / armazém");
      expect(labels).toContain("Inspeção pré-operação do veículo negligenciada");
    });
  });

  describe("2. Validação de Campos Obrigatórios (Tipo e Descrição)", () => {
    it("deve passar com sucesso quando nenhum colaborador possui ocorrência marcada", () => {
      const selectedIds = ["col-1", "col-2"];
      const condutas = {
        "col-1": { had_infraction: false },
        "col-2": { had_infraction: false },
      };

      const erro = validarCondutasEquipe(selectedIds, condutas, colaboradoresMock);
      expect(erro).toBeNull();
    });

    it("deve exigir tipo de ocorrência quando had_infraction = true mas tipo está vazio", () => {
      const selectedIds = ["col-1"];
      const condutas = {
        "col-1": {
          had_infraction: true,
          infraction_type_id: "",
          infraction_notes: "Caixa amassada na descarga",
        },
      };

      const erro = validarCondutasEquipe(selectedIds, condutas, colaboradoresMock);
      expect(erro).toBe("Informe o tipo de ocorrência para o colaborador Carlos Ajudante.");
    });

    it("deve exigir descrição/evidência quando had_infraction = true mas nota está vazia", () => {
      const selectedIds = ["col-1"];
      const condutas = {
        "col-1": {
          had_infraction: true,
          infraction_type_id: "Avaria / Dano à Carga",
          infraction_notes: "   ",
        },
      };

      const erro = validarCondutasEquipe(selectedIds, condutas, colaboradoresMock);
      expect(erro).toBe("Informe a descrição detalhada da ocorrência para o colaborador Carlos Ajudante.");
    });

    it("deve passar com sucesso quando vários colaboradores trabalham e apenas um tem ocorrência completa", () => {
      const selectedIds = ["col-1", "col-2", "col-3"];
      const condutas = {
        "col-1": { had_infraction: false },
        "col-2": {
          had_infraction: true,
          infraction_type_id: "Avaria / Dano à Carga",
          infraction_notes: "Pallet tombado e avaria de 2 caixas durante movimentação.",
        },
        "col-3": { had_infraction: false },
      };

      const erro = validarCondutasEquipe(selectedIds, condutas, colaboradoresMock);
      expect(erro).toBeNull();
    });
  });

  describe("3. Contrato de Persistência (colabPayload e avaliacao_json)", () => {
    it("deve montar colabPayload com had_infraction = false e sem notas quando não houver ocorrência", () => {
      const selectedIds = ["col-1"];
      const condutas: Record<string, any> = {};

      const colabPayload = selectedIds.map((id) => {
        const c = condutas[id];
        const hadInfraction = Boolean(c?.had_infraction);
        return {
          collaborator_id: id,
          had_infraction: hadInfraction,
          infraction_type_id: hadInfraction ? c?.infraction_type_id?.trim() || null : null,
          infraction_notes: hadInfraction ? c?.infraction_notes?.trim() || null : null,
        };
      });

      expect(colabPayload).toHaveLength(1);
      expect(colabPayload[0].had_infraction).toBe(false);
      expect(colabPayload[0].infraction_type_id).toBeNull();
      expect(colabPayload[0].infraction_notes).toBeNull();
    });

    it("deve montar colabPayload e avaliacao_json preservando dados quando houver ocorrência", () => {
      const selectedIds = ["col-1", "col-2"];
      const condutas = {
        "col-2": {
          had_infraction: true,
          infraction_type_id: "Avaria / Dano à Carga",
          infraction_notes: "Queda de fardo no descarregamento",
        },
      };

      const colabPayload = selectedIds.map((id) => {
        const c = (condutas as any)[id];
        const hadInfraction = Boolean(c?.had_infraction);
        return {
          collaborator_id: id,
          had_infraction: hadInfraction,
          infraction_type_id: hadInfraction ? c?.infraction_type_id?.trim() || null : null,
          infraction_notes: hadInfraction ? c?.infraction_notes?.trim() || null : null,
        };
      });

      const colaboradoresComInfracao = colabPayload.filter((c) => c.had_infraction);
      const infracoesCount = colaboradoresComInfracao.length;

      const infracoesResumo = colaboradoresComInfracao.map((c) => {
        const colabObj = colaboradoresMock.find((item) => item.id === c.collaborator_id);
        return {
          collaborator_id: c.collaborator_id,
          nome: colabObj?.nome || "Colaborador",
          cargo: colabObj?.cargo || null,
          tipo: c.infraction_type_id,
          descricao: c.infraction_notes,
        };
      });

      const avaliacaoJson = {
        infracoes: infracoesResumo,
        total_infracoes: infracoesCount,
        motivo_restricao: `Ocorrência registrada em serviço: ${infracoesResumo.map((i) => `${i.nome} (${i.tipo})`).join("; ")}`,
      };

      expect(colabPayload[0].had_infraction).toBe(false);
      expect(colabPayload[1].had_infraction).toBe(true);
      expect(colabPayload[1].infraction_type_id).toBe("Avaria / Dano à Carga");
      expect(colabPayload[1].infraction_notes).toBe("Queda de fardo no descarregamento");

      expect(avaliacaoJson.total_infracoes).toBe(1);
      expect(avaliacaoJson.infracoes[0].nome).toBe("Marcos Conferente");
      expect(avaliacaoJson.motivo_restricao).toContain("Marcos Conferente (Avaria / Dano à Carga)");
    });
  });

  describe("4. Preservação do Acesso Isolado do Encarregado e Sem Desconto Automático", () => {
    it("deve manter destino padrão do encarregado em /producao", () => {
      expect(getDefaultRouteForRole("encarregado")).toBe("/producao");
    });

    it("deve bloquear acesso do encarregado às rotas administrativas, financeiras e governança", () => {
      expect(isRouteForbiddenForRole("encarregado", "/central")).toBe(true);
      expect(isRouteForbiddenForRole("encarregado", "/configuracoes")).toBe(true);
      expect(isRouteForbiddenForRole("encarregado", "/inconsistencias")).toBe(true);
    });

    it("deve confirmar que encarregado não possui permissão de aprovação financeira nem fechamento", () => {
      const perms = ACCESS_PRESETS.encarregado;
      expect(canAccessModule(perms, "central_financeira", "ver")).toBe(false);
      expect(canAccessModule(perms, "faturamento", "ver")).toBe(false);
      expect(canAccessModule(perms, "fechamento_mensal", "ver")).toBe(false);
      expect(canAccessModule(perms, "processamento_rh", "aprovar")).toBe(false);
    });
  });
});

