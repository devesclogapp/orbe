import { supabase } from "@/lib/supabase";
import { CicloOperacionalService, CicloOperacional } from "./operationalEngine/CicloOperacionalService";
import { LoteFechamentoDiaristaService } from "./domain/diaristas.service";
import { IntermitentesLoteService } from "./domain/intermitentes.service";
import { RHFinanceiroService } from "./rhFinanceiro.service";

export type DominioFechamento = "OPERACIONAL" | "DIARISTAS" | "INTERMITENTES" | "CLT";

export type EstadoVisualFechamento =
  | "PRONTO_PARA_FECHAR"
  | "BLOQUEADO"
  | "AGUARDANDO_APROVACAO"
  | "FECHADO";

export interface SemanaOperacionalTimeline {
  numero: 1 | 2 | 3 | 4 | 5;
  periodo: string;
  status: "fechado" | "bloqueado" | "pronto" | "aberto";
  volume?: number;
  horas?: number;
  valor?: number;
  inconsistencias?: number;
  fechadoEm?: string;
  fechadoPor?: string;
}

export interface ChecklistItem {
  id: string;
  titulo: string;
  tipo: "sucesso" | "bloqueio" | "aviso";
  descricao?: string;
}

export interface DetalhesConsolidacao {
  colaboradores: number;
  quantidadePrincipal: string;
  valorTotal: number;
  detalhes?: { rotulo: string; quantidade: number; valor: number }[];
}

export interface CicloFechamentoItem {
  id: string;
  dominio: DominioFechamento;
  titulo: string;
  subtitulo: string;
  periodo: string;
  competencia: string;
  empresaId: string;
  empresaNome: string;
  estadoVisual: EstadoVisualFechamento;
  statusMotorOriginal: string;
  statusRhOriginal?: string;
  statusFinanceiroOriginal?: string;
  grandezaResumo: string;
  valorTotal: number;
  responsavelPapel: string;
  responsavelNome: string;
  totalImpedimentos: number;
  ctaTexto: string;
  ctaTipo: "FECHAMENTO" | "INCONSISTENCIAS" | "APROVACOES" | "CONSULTA";
  ctaRota?: string;
  semanasTimeline?: SemanaOperacionalTimeline[];
  checklist: ChecklistItem[];
  consolidacao?: DetalhesConsolidacao;
  efeitoFechamento: string;
  rastreabilidade: {
    empresa: string;
    competencia: string;
    periodo: string;
    responsavel: string;
    dataHoraRevisao: string;
    fechadoEm?: string;
    fechadoPor?: string;
  };
  raw: {
    tipoMotor: DominioFechamento;
    dadosOriginais: any;
  };
}

export interface FechamentoContextParams {
  tenantId: string;
  competencia: string;
  empresaId: string;
  empresaNome?: string;
}

export class FechamentoCiclosOficialService {
  /**
   * Helper para formatar moeda
   */
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  }

  /**
   * Consulta os 4 motores em paralelo e normaliza para o contrato de apresentação da UX10
   */
  static async carregarCiclosDaCompetencia(
    params: FechamentoContextParams
  ): Promise<CicloFechamentoItem[]> {
    const { tenantId, competencia, empresaId, empresaNome = "Empresa" } = params;

    const [ano, mes] = competencia.split("-");
    const dataInicioMes = `${competencia}-01`;
    const lastDay = new Date(Number(ano), Number(mes), 0).getDate();
    const dataFimMes = `${competencia}-${String(lastDay).padStart(2, "0")}`;

    // Executa queries em paralelo para os 4 motores e dados auxiliares
    const [
      ciclosOpRes,
      custosExtrasRes,
      servicosExtrasRes,
      diaristasLotesRes,
      intermitentesLotesRes,
      cltValidationRes,
      cltLotesRes,
    ] = await Promise.allSettled([
      // 1. Motor 01: Ciclo Operacional Semanal
      CicloOperacionalService.getCiclosDaCompetencia(tenantId, competencia, empresaId),
      // 1.1 Bloqueios Financeiros de Custos Extras
      supabase
        .from("custos_extras_operacionais")
        .select("id, empresa_id, data, status_pagamento, pipeline_status")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId)
        .gte("data", dataInicioMes)
        .lte("data", dataFimMes),
      // 1.2 Bloqueios Operacionais de Serviços Extras
      supabase
        .from("servicos_extras_operacionais")
        .select("id, empresa_id, data, pipeline_status")
        .eq("empresa_id", empresaId)
        .gte("data", dataInicioMes)
        .lte("data", dataFimMes),
      // 2. Motor 02: Diaristas
      LoteFechamentoDiaristaService.getLotesPorPeriodo(dataInicioMes, dataFimMes, empresaId),
      // 3. Motor 03: Intermitentes
      IntermitentesLoteService.listarLotes({ competencia, empresaId }),
      // 4. Motor 04: Validação CLT
      RHFinanceiroService.validateCompetenciaApproval(empresaId, competencia).catch((err) => {
        return {
          competencia,
          empresaId,
          empresaNome,
          impedimentos: [err?.message || "Erro ao consultar validação CLT"],
          bloqueiosCriticos: [],
          avisosOperacionais: [],
          pendenciasCadastrais: [],
          inconsistenciasAbertas: [],
          colaboradoresBloqueados: [],
          custosExtrasPendentes: [],
          servicosExtrasPendentes: [],
          resumo: {
            bloqueiosCriticos: 1,
            avisosOperacionais: 0,
            pendenciasCadastrais: 0,
            inconsistenciasAbertas: 0,
            colaboradoresBloqueados: 0,
            custosExtrasPendentes: 0,
            servicosExtrasPendentes: 0,
          },
        };
      }),
      // 4.1 Lotes CLT gerados
      supabase
        .from("rh_financeiro_lotes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId)
        .eq("competencia", competencia)
        .eq("origem", "RH"),
    ]);

    const ciclosOp: CicloOperacional[] =
      ciclosOpRes.status === "fulfilled" ? ciclosOpRes.value : [];
    const custosExtras =
      custosExtrasRes.status === "fulfilled" && !custosExtrasRes.value.error
        ? (custosExtrasRes.value.data as any[]) || []
        : [];
    const servicosExtras =
      servicosExtrasRes.status === "fulfilled" && !servicosExtrasRes.value.error
        ? (servicosExtrasRes.value.data as any[]) || []
        : [];
    const diaristasLotes =
      diaristasLotesRes.status === "fulfilled" ? (diaristasLotesRes.value as any[]) : [];
    const intermitentesLotes =
      intermitentesLotesRes.status === "fulfilled" ? (intermitentesLotesRes.value as any[]) : [];
    const cltValidation =
      cltValidationRes.status === "fulfilled" ? cltValidationRes.value : null;
    const cltLotes =
      cltLotesRes.status === "fulfilled" && !cltLotesRes.value.error
        ? (cltLotesRes.value.data as any[]) || []
        : [];

    const resultado: CicloFechamentoItem[] = [];

    // =========================================================================
    // ADAPTER 1: MOTOR 01 — CICLO OPERACIONAL SEMANAL
    // =========================================================================
    const itemOp = this.adaptarMotorOperacional({
      ciclos: ciclosOp,
      custosExtras,
      servicosExtras,
      competencia,
      empresaId,
      empresaNome,
    });
    if (itemOp) resultado.push(itemOp);

    // =========================================================================
    // ADAPTER 2: MOTOR 02 — DIARISTAS
    // =========================================================================
    const itensDiaristas = this.adaptarMotorDiaristas({
      lotes: diaristasLotes,
      competencia,
      empresaId,
      empresaNome,
      dataInicioMes,
      dataFimMes,
    });
    resultado.push(...itensDiaristas);

    // =========================================================================
    // ADAPTER 3: MOTOR 03 — INTERMITENTES
    // =========================================================================
    const itensIntermitentes = this.adaptarMotorIntermitentes({
      lotes: intermitentesLotes,
      competencia,
      empresaId,
      empresaNome,
    });
    resultado.push(...itensIntermitentes);

    // =========================================================================
    // ADAPTER 4: MOTOR 04 — CLT
    // =========================================================================
    const itemClt = this.adaptarMotorClt({
      validation: cltValidation,
      lotesExistentes: cltLotes,
      competencia,
      empresaId,
      empresaNome,
    });
    if (itemClt) resultado.push(itemClt);

    return resultado;
  }

  // ---------------------------------------------------------------------------
  // ADAPTADOR PRIVADO: MOTOR 01 (OPERACIONAL)
  // ---------------------------------------------------------------------------
  private static adaptarMotorOperacional(ctx: {
    ciclos: CicloOperacional[];
    custosExtras: any[];
    servicosExtras: any[];
    competencia: string;
    empresaId: string;
    empresaNome: string;
  }): CicloFechamentoItem | null {
    const { ciclos, custosExtras, servicosExtras, competencia, empresaId, empresaNome } = ctx;

    // Timeline S1..S5
    const semanasTimeline: SemanaOperacionalTimeline[] = ciclos.map((c) => {
      let statusSemana: "fechado" | "bloqueado" | "pronto" | "aberto" = "aberto";
      if (c.status === "fechado" || c.status === "enviado_financeiro") {
        statusSemana = "fechado";
      } else if (
        (c.total_inconsistencias || 0) > 0 ||
        c.status_automacao === "inconsistencias_detectadas" ||
        c.status_automacao === "bloqueado_automacao"
      ) {
        statusSemana = "bloqueado";
      } else if (c.status_automacao === "pronto_para_fechamento") {
        statusSemana = "pronto";
      }

      return {
        numero: c.semana_operacional as 1 | 2 | 3 | 4 | 5,
        periodo: `${new Date(`${c.data_inicio}T12:00:00Z`).toLocaleDateString("pt-BR")} a ${new Date(`${c.data_fim}T12:00:00Z`).toLocaleDateString("pt-BR")}`,
        status: statusSemana,
        volume: c.total_registros || 0,
        horas: c.total_processados || 0,
        valor: c.valor_operacional || 0,
        inconsistencias: c.total_inconsistencias || 0,
        fechadoEm: c.fechado_em || undefined,
        fechadoPor: c.fechado_por || undefined,
      };
    });

    // Semana foco (primeira semana aberta/pronta/bloqueada, ou a última se todas fechadas)
    const cicloAtivo =
      ciclos.find((c) => c.status !== "fechado" && c.status !== "enviado_financeiro") ||
      ciclos[ciclos.length - 1] ||
      null;

    if (!cicloAtivo && ciclos.length === 0) return null;

    const totalRegistrosMes = ciclos.reduce((acc, c) => acc + (c.total_registros || 0), 0);
    const totalProcessadosMes = ciclos.reduce((acc, c) => acc + (c.total_processados || 0), 0);
    const valorTotalMes = ciclos.reduce((acc, c) => acc + Number(c.valor_operacional || 0), 0);

    // Custos e serviços pendentes da semana ativa
    const custosPendentesSemana = cicloAtivo
      ? custosExtras.filter(
          (item) =>
            Boolean(item.data) &&
            item.data >= cicloAtivo.data_inicio &&
            item.data <= cicloAtivo.data_fim &&
            ["RECEBIDO", "EM_VALIDACAO"].includes(String(item.pipeline_status || "").toUpperCase()) &&
            String(item.status_pagamento || "").toUpperCase() !== "CANCELADO"
        )
      : [];

    const servicosPendentesSemana = cicloAtivo
      ? servicosExtras.filter(
          (item) =>
            Boolean(item.data) &&
            item.data >= cicloAtivo.data_inicio &&
            item.data <= cicloAtivo.data_fim &&
            ["PENDENTE", "EM_VALIDACAO", "DEVOLVIDO"].includes(
              String(item.pipeline_status || "").toUpperCase()
            )
        )
      : [];

    // Checklist factual
    const checklist: ChecklistItem[] = [];
    const semanasFechadasCount = ciclos.filter(
      (c) => c.status === "fechado" || c.status === "enviado_financeiro"
    ).length;

    if (semanasFechadasCount > 0) {
      checklist.push({
        id: "chk-op-fechadas",
        titulo: `${semanasFechadasCount} semana(s) operacional(is) já homologada(s)`,
        tipo: "sucesso",
        descricao: "Consolidações anteriores preservadas com integridade.",
      });
    }

    if (cicloAtivo) {
      const temInconsistencias = (cicloAtivo.total_inconsistencias || 0) > 0;
      const automacaoPronta = cicloAtivo.status_automacao === "pronto_para_fechamento";

      if (temInconsistencias) {
        checklist.push({
          id: "chk-op-inconsistencias",
          titulo: `${cicloAtivo.total_inconsistencias} inconsistência(s) crítica(s) na Semana ${cicloAtivo.semana_operacional}`,
          tipo: "bloqueio",
          descricao: "Batidas ou operações inconsistentes impedem o avanço.",
        });
      } else {
        checklist.push({
          id: "chk-op-sem-inconsistencias",
          titulo: `Zero inconsistências críticas na Semana ${cicloAtivo.semana_operacional}`,
          tipo: "sucesso",
          descricao: "Registros de ponto e produção íntegros no período.",
        });
      }

      if (automacaoPronta) {
        checklist.push({
          id: "chk-op-automacao",
          titulo: `Motor operacional liberou a Semana ${cicloAtivo.semana_operacional}`,
          tipo: "sucesso",
          descricao: "Validação canônica individual aprovada.",
        });
      } else if (!temInconsistencias) {
        checklist.push({
          id: "chk-op-automacao-pendente",
          titulo: `Validação operacional da Semana ${cicloAtivo.semana_operacional} pendente`,
          tipo: "aviso",
          descricao: "Revalidação necessária para liberar o fechamento.",
        });
      }

      if (custosPendentesSemana.length > 0) {
        checklist.push({
          id: "chk-op-custos",
          titulo: `${custosPendentesSemana.length} custo(s) extra(s) aguardam reflexo financeiro`,
          tipo: "bloqueio",
          descricao: "Validação financeira bloqueada até a conciliação desses custos.",
        });
      }

      if (servicosPendentesSemana.length > 0) {
        checklist.push({
          id: "chk-op-servicos",
          titulo: `${servicosPendentesSemana.length} serviço(s) extra(s) pendentes de validação`,
          tipo: "bloqueio",
          descricao: "Conclua a aprovação dos serviços extras da semana.",
        });
      }
    }

    // Determina o estado visual
    let estadoVisual: EstadoVisualFechamento = "FECHADO";
    let ctaTexto = "Ver Fechamento";
    let ctaTipo: "FECHAMENTO" | "INCONSISTENCIAS" | "APROVACOES" | "CONSULTA" = "CONSULTA";
    let ctaRota: string | undefined = undefined;

    if (cicloAtivo && cicloAtivo.status !== "fechado" && cicloAtivo.status !== "enviado_financeiro") {
      const temBloqueios =
        (cicloAtivo.total_inconsistencias || 0) > 0 ||
        custosPendentesSemana.length > 0 ||
        servicosPendentesSemana.length > 0;

      if (temBloqueios) {
        estadoVisual = "BLOQUEADO";
        const totalBloqueios =
          (cicloAtivo.total_inconsistencias || 0) +
          custosPendentesSemana.length +
          servicosPendentesSemana.length;
        ctaTexto = `Ver ${totalBloqueios} bloqueios`;
        ctaTipo = "INCONSISTENCIAS";
        ctaRota = "/inconsistencias";
      } else if (cicloAtivo.status_automacao === "pronto_para_fechamento") {
        estadoVisual = "PRONTO_PARA_FECHAR";
        ctaTexto = "Revisar e Fechar";
        ctaTipo = "FECHAMENTO";
      } else {
        estadoVisual = "BLOQUEADO";
        ctaTexto = "Ver Impedimentos";
        ctaTipo = "INCONSISTENCIAS";
        ctaRota = "/inconsistencias";
      }
    } else if (cicloAtivo && cicloAtivo.status === "fechado") {
      if (cicloAtivo.status_rh === "pendente") {
        estadoVisual = "AGUARDANDO_APROVACAO";
        ctaTexto = "Abrir Aprovações";
        ctaTipo = "APROVACOES";
        ctaRota = "/rh/aprovacoes";
      } else if (cicloAtivo.status_financeiro === "pendente") {
        estadoVisual = "AGUARDANDO_APROVACAO";
        ctaTexto = "Abrir Aprovações";
        ctaTipo = "APROVACOES";
        ctaRota = "/rh/aprovacoes";
      } else {
        estadoVisual = "FECHADO";
        ctaTexto = "Ver Fechamento";
        ctaTipo = "CONSULTA";
      }
    }

    const periodoStr = cicloAtivo
      ? `Semana ${cicloAtivo.semana_operacional} • ${new Date(`${cicloAtivo.data_inicio}T12:00:00Z`).toLocaleDateString("pt-BR")} a ${new Date(`${cicloAtivo.data_fim}T12:00:00Z`).toLocaleDateString("pt-BR")}`
      : `Competência ${competencia}`;

    return {
      id: cicloAtivo ? cicloAtivo.id : `ciclo-op-${competencia}`,
      dominio: "OPERACIONAL",
      titulo: "Ciclo Operacional Semanal",
      subtitulo: "Apuração de Volumes, Produtividade & Apontamentos Operacionais",
      periodo: periodoStr,
      competencia,
      empresaId,
      empresaNome,
      estadoVisual,
      statusMotorOriginal: cicloAtivo ? cicloAtivo.status : "aberto",
      statusRhOriginal: cicloAtivo ? cicloAtivo.status_rh : "pendente",
      statusFinanceiroOriginal: cicloAtivo ? cicloAtivo.status_financeiro : "pendente",
      grandezaResumo: `${totalRegistrosMes} regs • ${totalProcessadosMes} processados`,
      valorTotal: valorTotalMes,
      responsavelPapel: "Operação / RH",
      responsavelNome: cicloAtivo?.fechado_por || "Encarregado & Gestão Local",
      totalImpedimentos: cicloAtivo?.total_inconsistencias || 0,
      ctaTexto,
      ctaTipo,
      ctaRota,
      semanasTimeline,
      checklist,
      consolidacao: {
        colaboradores: totalProcessadosMes,
        quantidadePrincipal: `${totalRegistrosMes} volumes / apontamentos`,
        valorTotal: valorTotalMes,
        detalhes: ciclos.map((c) => ({
          rotulo: `Semana ${c.semana_operacional}`,
          quantidade: c.total_registros || 0,
          valor: Number(c.valor_operacional || 0),
        })),
      },
      efeitoFechamento:
        "Consolida as operações e horas da semana operacional, calculando a produtividade e disponibilizando o lote para validação formal de RH.",
      rastreabilidade: {
        empresa: empresaNome,
        competencia,
        periodo: periodoStr,
        responsavel: cicloAtivo?.fechado_por || "Gestor Operacional",
        dataHoraRevisao: cicloAtivo?.updated_at || new Date().toISOString(),
        fechadoEm: cicloAtivo?.fechado_em || undefined,
        fechadoPor: cicloAtivo?.fechado_por || undefined,
      },
      raw: {
        tipoMotor: "OPERACIONAL",
        dadosOriginais: cicloAtivo,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // ADAPTADOR PRIVADO: MOTOR 02 (DIARISTAS)
  // ---------------------------------------------------------------------------
  private static adaptarMotorDiaristas(ctx: {
    lotes: any[];
    competencia: string;
    empresaId: string;
    empresaNome: string;
    dataInicioMes: string;
    dataFimMes: string;
  }): CicloFechamentoItem[] {
    const { lotes, competencia, empresaId, empresaNome, dataInicioMes, dataFimMes } = ctx;

    if (!lotes || lotes.length === 0) {
      // Nenhum lote formal gerado na competência
      return [
        {
          id: `diaristas-aberto-${competencia}`,
          dominio: "DIARISTAS",
          titulo: "Diaristas — Lote Semanal",
          subtitulo: "Grade de Presença, Quantidade de Diárias & Liquidação Semanal",
          periodo: `Competência • ${competencia}`,
          competencia,
          empresaId,
          empresaNome,
          estadoVisual: "PRONTO_PARA_FECHAR",
          statusMotorOriginal: "EM_ABERTO",
          grandezaResumo: "0 diárias registradas",
          valorTotal: 0,
          responsavelPapel: "Encarregado / RH",
          responsavelNome: "Gestão Operacional de Campo",
          totalImpedimentos: 0,
          ctaTexto: "Abrir Diaristas",
          ctaTipo: "CONSULTA",
          ctaRota: "/operacional/diaristas",
          checklist: [
            {
              id: "chk-dia-aberto",
              titulo: "Lançamentos na grade de presença",
              tipo: "aviso",
              descricao: "Acesse o módulo de diaristas para conferir presenças da semana.",
            },
          ],
          efeitoFechamento:
            "Agrupa os lançamentos de diaristas da semana em lote fechado e encaminha para validação do RH.",
          rastreabilidade: {
            empresa: empresaNome,
            competencia,
            periodo: `Competência • ${competencia}`,
            responsavel: "Operação Diaristas",
            dataHoraRevisao: new Date().toISOString(),
          },
          raw: {
            tipoMotor: "DIARISTAS",
            dadosOriginais: null,
          },
        },
      ];
    }

    return lotes.map((lote) => {
      const statusRaw = String(lote.status || "").toUpperCase();
      let estadoVisual: EstadoVisualFechamento = "AGUARDANDO_APROVACAO";
      let ctaTexto = "Abrir Aprovações";
      let ctaTipo: "FECHAMENTO" | "INCONSISTENCIAS" | "APROVACOES" | "CONSULTA" = "APROVACOES";
      let ctaRota: string | undefined = "/rh/aprovacoes";

      if (statusRaw === "PAGO" || statusRaw === "FECHADO_FINANCEIRO" || statusRaw === "CNAB_GERADO") {
        estadoVisual = "FECHADO";
        ctaTexto = "Ver Fechamento";
        ctaTipo = "CONSULTA";
        ctaRota = undefined;
      } else if (statusRaw === "AGUARDANDO_VALIDACAO_RH" || statusRaw === "VALIDADO_RH") {
        estadoVisual = "AGUARDANDO_APROVACAO";
        ctaTexto = "Abrir Aprovações";
        ctaTipo = "APROVACOES";
        ctaRota = "/rh/aprovacoes";
      } else if (statusRaw === "DEVOLVIDO" || statusRaw === "REJEITADO_RH") {
        estadoVisual = "BLOQUEADO";
        ctaTexto = "Ver Impedimentos";
        ctaTipo = "INCONSISTENCIAS";
        ctaRota = "/inconsistencias";
      } else if (statusRaw === "EM_ABERTO") {
        estadoVisual = "PRONTO_PARA_FECHAR";
        ctaTexto = "Revisar e Fechar";
        ctaTipo = "FECHAMENTO";
      }

      const periodoStr = `${new Date(`${lote.periodo_inicio}T12:00:00Z`).toLocaleDateString("pt-BR")} a ${new Date(`${lote.periodo_fim}T12:00:00Z`).toLocaleDateString("pt-BR")}`;

      const checklist: ChecklistItem[] = [
        {
          id: `chk-dia-cad-${lote.id}`,
          titulo: "Grade semanal apurada",
          tipo: "sucesso",
          descricao: `${lote.total_registros || 0} registro(s) no lote`,
        },
      ];

      if (statusRaw === "VALIDADO_RH" || statusRaw === "FECHADO_FINANCEIRO" || statusRaw === "PAGO") {
        checklist.push({
          id: `chk-dia-rh-${lote.id}`,
          titulo: "Validação RH formalmente concluída",
          tipo: "sucesso",
          descricao: "Conferido e homologado pelo RH.",
        });
      } else if (statusRaw === "AGUARDANDO_VALIDACAO_RH") {
        checklist.push({
          id: `chk-dia-rh-pendente-${lote.id}`,
          titulo: "Validação RH pendente",
          tipo: "aviso",
          descricao: "Aguardando conferência formal na Central de Aprovações.",
        });
      }

      return {
        id: lote.id,
        dominio: "DIARISTAS",
        titulo: "Diaristas — Lote Semanal",
        subtitulo: "Grade de Presença, Quantidade de Diárias & Liquidação Semanal",
        periodo: periodoStr,
        competencia,
        empresaId,
        empresaNome,
        estadoVisual,
        statusMotorOriginal: lote.status,
        statusRhOriginal: lote.status,
        statusFinanceiroOriginal: lote.status_conciliacao || lote.status,
        grandezaResumo: `${lote.total_registros || 0} diárias apuradas`,
        valorTotal: Number(lote.valor_total || 0),
        responsavelPapel: "RH / Financeiro",
        responsavelNome: lote.fechado_por_nome || "RH Master",
        totalImpedimentos: statusRaw === "DEVOLVIDO" ? 1 : 0,
        ctaTexto,
        ctaTipo,
        ctaRota,
        checklist,
        consolidacao: {
          colaboradores: lote.total_registros || 0,
          quantidadePrincipal: `${lote.total_registros || 0} diárias registradas`,
          valorTotal: Number(lote.valor_total || 0),
        },
        efeitoFechamento:
          "Consolida o lote semanal de Diaristas e o disponibiliza para continuidade do processamento financeiro.",
        rastreabilidade: {
          empresa: empresaNome,
          competencia,
          periodo: periodoStr,
          responsavel: lote.fechado_por_nome || "Gestor RH",
          dataHoraRevisao: lote.created_at || new Date().toISOString(),
          fechadoEm: lote.fechado_em || undefined,
          fechadoPor: lote.fechado_por_nome || undefined,
        },
        raw: {
          tipoMotor: "DIARISTAS",
          dadosOriginais: lote,
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // ADAPTADOR PRIVADO: MOTOR 03 (INTERMITENTES)
  // ---------------------------------------------------------------------------
  private static adaptarMotorIntermitentes(ctx: {
    lotes: any[];
    competencia: string;
    empresaId: string;
    empresaNome: string;
  }): CicloFechamentoItem[] {
    const { lotes, competencia, empresaId, empresaNome } = ctx;

    if (!lotes || lotes.length === 0) {
      return [
        {
          id: `intermitentes-aberto-${competencia}`,
          dominio: "INTERMITENTES",
          titulo: "Contrato Intermitente — Lote Quinzenal",
          subtitulo: "Convocações, Horas Efetivas Apuradas & Remuneração",
          periodo: `Competência • ${competencia}`,
          competencia,
          empresaId,
          empresaNome,
          estadoVisual: "PRONTO_PARA_FECHAR",
          statusMotorOriginal: "RECEBIDO",
          grandezaResumo: "0 horas apuradas",
          valorTotal: 0,
          responsavelPapel: "Gestor RH / Operação",
          responsavelNome: "Gestão Operacional de Campo",
          totalImpedimentos: 0,
          ctaTexto: "Abrir Intermitentes",
          ctaTipo: "CONSULTA",
          ctaRota: "/operacional/intermitentes",
          checklist: [
            {
              id: "chk-int-aberto",
              titulo: "Convocações no período",
              tipo: "aviso",
              descricao: "Acesse o módulo de intermitentes para lançar convocações e horas.",
            },
          ],
          efeitoFechamento:
            "Agrupa as convocações e horas de intermitentes no lote da quinzena para envio ao Financeiro.",
          rastreabilidade: {
            empresa: empresaNome,
            competencia,
            periodo: `Competência • ${competencia}`,
            responsavel: "Operação Intermitentes",
            dataHoraRevisao: new Date().toISOString(),
          },
          raw: {
            tipoMotor: "INTERMITENTES",
            dadosOriginais: null,
          },
        },
      ];
    }

    return lotes.map((lote) => {
      const statusRaw = String(lote.status || "").toUpperCase();
      let estadoVisual: EstadoVisualFechamento = "AGUARDANDO_APROVACAO";
      let ctaTexto = "Abrir Aprovações";
      let ctaTipo: "FECHAMENTO" | "INCONSISTENCIAS" | "APROVACOES" | "CONSULTA" = "APROVACOES";
      let ctaRota: string | undefined = "/rh/aprovacoes";

      if (statusRaw === "PAGO" || statusRaw === "FECHADO_FINANCEIRO" || statusRaw === "CNAB_GERADO") {
        estadoVisual = "FECHADO";
        ctaTexto = "Ver Fechamento";
        ctaTipo = "CONSULTA";
        ctaRota = undefined;
      } else if (statusRaw === "AGUARDANDO_VALIDACAO_RH" || statusRaw === "VALIDADO_RH") {
        estadoVisual = "AGUARDANDO_APROVACAO";
        ctaTexto = "Abrir Aprovações";
        ctaTipo = "APROVACOES";
        ctaRota = "/rh/aprovacoes";
      } else if (statusRaw === "DEVOLVIDO" || statusRaw === "CANCELADO") {
        estadoVisual = "BLOQUEADO";
        ctaTexto = "Ver Impedimentos";
        ctaTipo = "INCONSISTENCIAS";
        ctaRota = "/inconsistencias";
      }

      const periodoStr = `${new Date(`${lote.periodo_inicio}T12:00:00Z`).toLocaleDateString("pt-BR")} a ${new Date(`${lote.periodo_fim}T12:00:00Z`).toLocaleDateString("pt-BR")}`;

      const checklist: ChecklistItem[] = [
        {
          id: `chk-int-conv-${lote.id}`,
          titulo: "Convocações e horas consolidadas",
          tipo: "sucesso",
          descricao: `${lote.quantidade_registros || 0} registro(s) • ${lote.horas_trabalhadas || 0}h`,
        },
      ];

      if (statusRaw === "VALIDADO_RH" || statusRaw === "FECHADO_FINANCEIRO" || statusRaw === "PAGO") {
        checklist.push({
          id: `chk-int-rh-${lote.id}`,
          titulo: "Validação RH formalmente concluída",
          tipo: "sucesso",
          descricao: "Conferido e homologado pelo RH.",
        });
      }

      return {
        id: lote.id,
        dominio: "INTERMITENTES",
        titulo: "Contrato Intermitente — Lote Quinzenal",
        subtitulo: "Convocações, Horas Efetivas Apuradas & Remuneração",
        periodo: periodoStr,
        competencia,
        empresaId,
        empresaNome,
        estadoVisual,
        statusMotorOriginal: lote.status,
        statusRhOriginal: lote.status,
        statusFinanceiroOriginal: lote.status_financeiro || lote.status,
        grandezaResumo: `${lote.quantidade_registros || 0} colabs • ${lote.horas_trabalhadas || 0}h apuradas`,
        valorTotal: Number(lote.valor_total || 0),
        responsavelPapel: "Gestor RH / Operação",
        responsavelNome: lote.created_by || "Gestão Operacional",
        totalImpedimentos: statusRaw === "DEVOLVIDO" ? 1 : 0,
        ctaTexto,
        ctaTipo,
        ctaRota,
        checklist,
        consolidacao: {
          colaboradores: lote.quantidade_registros || 0,
          quantidadePrincipal: `${lote.horas_trabalhadas || 0} horas apuradas`,
          valorTotal: Number(lote.valor_total || 0),
        },
        efeitoFechamento:
          "Consolida o lote quinzenal de intermitentes e o encaminha para fluxo financeiro.",
        rastreabilidade: {
          empresa: empresaNome,
          competencia,
          periodo: periodoStr,
          responsavel: lote.created_by || "Gestor RH",
          dataHoraRevisao: lote.created_at || new Date().toISOString(),
        },
        raw: {
          tipoMotor: "INTERMITENTES",
          dadosOriginais: lote,
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // ADAPTADOR PRIVADO: MOTOR 04 (CLT)
  // ---------------------------------------------------------------------------
  private static adaptarMotorClt(ctx: {
    validation: any;
    lotesExistentes: any[];
    competencia: string;
    empresaId: string;
    empresaNome: string;
  }): CicloFechamentoItem | null {
    const { validation, lotesExistentes, competencia, empresaId, empresaNome } = ctx;

    const temLoteFechado =
      lotesExistentes.length > 0 &&
      lotesExistentes.some((l) =>
        ["CONCLUIDO", "PAGO", "AGUARDANDO_PAGAMENTO"].includes(String(l.status || "").toUpperCase())
      );
    const temLoteAguardando =
      lotesExistentes.length > 0 &&
      lotesExistentes.some((l) =>
        ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(
          String(l.status || "").toUpperCase()
        )
      );

    const impedimentos: string[] = validation?.impedimentos || [];
    const bloqueiosCriticos: any[] = validation?.bloqueiosCriticos || [];
    const pendenciasCadastrais: any[] = validation?.pendenciasCadastrais || [];

    const checklist: ChecklistItem[] = [];

    if (pendenciasCadastrais.length === 0) {
      checklist.push({
        id: "chk-clt-cadastros",
        titulo: "Cadastros de colaboradores íntegros",
        tipo: "sucesso",
        descricao: "Dados bancários e contratuais completos.",
      });
    } else {
      checklist.push({
        id: "chk-clt-cadastros-pendentes",
        titulo: `${pendenciasCadastrais.length} colaborador(es) com cadastro incompleto`,
        tipo: "bloqueio",
        descricao: "Falta de dados bancários (PIX/Conta) ou cadastro provisório.",
      });
    }

    if (bloqueiosCriticos.length === 0) {
      checklist.push({
        id: "chk-clt-pontos",
        titulo: "Pontos processados e banco de horas íntegros",
        tipo: "sucesso",
        descricao: "Zero inconsistências impeditivas na competência.",
      });
    } else {
      checklist.push({
        id: "chk-clt-pontos-bloqueio",
        titulo: `${bloqueiosCriticos.length} impedimento(s) crítico(s) de ponto / RH`,
        tipo: "bloqueio",
        descricao: "Existem decisões de ponto ou conflitos operacionais pendentes.",
      });
    }

    let estadoVisual: EstadoVisualFechamento = "PRONTO_PARA_FECHAR";
    let ctaTexto = "Revisar e Fechar";
    let ctaTipo: "FECHAMENTO" | "INCONSISTENCIAS" | "APROVACOES" | "CONSULTA" = "FECHAMENTO";
    let ctaRota: string | undefined = undefined;

    if (temLoteFechado) {
      estadoVisual = "FECHADO";
      ctaTexto = "Ver Fechamento";
      ctaTipo = "CONSULTA";
    } else if (temLoteAguardando) {
      estadoVisual = "AGUARDANDO_APROVACAO";
      ctaTexto = "Abrir Aprovações";
      ctaTipo = "APROVACOES";
      ctaRota = "/rh/aprovacoes";
    } else if (impedimentos.length > 0) {
      estadoVisual = "BLOQUEADO";
      ctaTexto = `Ver ${impedimentos.length} impedimento(s)`;
      ctaTipo = "INCONSISTENCIAS";
      ctaRota = "/inconsistencias";
    }

    const valorTotalLotes = lotesExistentes.reduce(
      (acc, l) => acc + Number(l.valor_total || 0),
      0
    );

    const totalColabs = lotesExistentes.reduce(
      (acc, l) => Math.max(acc, Number(l.total_colaboradores || 0)),
      0
    );

    return {
      id: `clt-mensal-${competencia}`,
      dominio: "CLT",
      titulo: "CLT — Folha Mensal & Banco de Horas",
      subtitulo: "Consolidação de Ponto, Horas Extras, Adicionais e Folha Base",
      periodo: `Competência Mensal • ${competencia}`,
      competencia,
      empresaId,
      empresaNome,
      estadoVisual,
      statusMotorOriginal:
        lotesExistentes[0]?.status || (impedimentos.length > 0 ? "EM_APURACAO" : "APTO"),
      statusRhOriginal: lotesExistentes[0]?.status || "PENDENTE",
      statusFinanceiroOriginal: lotesExistentes[0]?.status || "PENDENTE",
      grandezaResumo: `${totalColabs || validation?.resumo?.financeiroPrevisto?.variaveis || 0} itens apurados`,
      valorTotal: valorTotalLotes,
      responsavelPapel: "RH Master",
      responsavelNome: "Departamento Pessoal (RH Master)",
      totalImpedimentos: impedimentos.length,
      ctaTexto,
      ctaTipo,
      ctaRota,
      checklist,
      consolidacao: {
        colaboradores: totalColabs,
        quantidadePrincipal: "Folha e Provisões Mensais",
        valorTotal: valorTotalLotes,
        detalhes: lotesExistentes.map((l) => ({
          rotulo: `Lote ${l.tipo}`,
          quantidade: l.total_colaboradores || 0,
          valor: Number(l.valor_total || 0),
        })),
      },
      efeitoFechamento:
        "Gera formalmente os 3 lotes no financeiro: FOLHA_BASE, FOLHA_VARIAVEL e BANCO_HORAS em rh_financeiro_lotes.",
      rastreabilidade: {
        empresa: empresaNome,
        competencia,
        periodo: `Competência Mensal • ${competencia}`,
        responsavel: "RH Master",
        dataHoraRevisao: new Date().toISOString(),
        fechadoEm: lotesExistentes[0]?.aprovado_em || undefined,
        fechadoPor: lotesExistentes[0]?.aprovado_por || undefined,
      },
      raw: {
        tipoMotor: "CLT",
        dadosOriginais: { validation, lotesExistentes },
      },
    };
  }
}
