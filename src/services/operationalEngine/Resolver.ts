import { OperationalContext, AbstractRule, RulePriority } from "../../types/motor.types";
import { EngineLogger } from "./Logger";

export class EngineResolver {
  /**
   * Identifica a regra correta para o processamento dado o conjunto de regras já filtradas por tenant.
   * Transforma as regras brutas num padrão de hierarquia aplicável.
   */
  static resolve(
    ctx: OperationalContext,
    bancoHorasRegras: any[]
  ): { rule: AbstractRule; isFallback: boolean } {
    const rawToAbstract = bancoHorasRegras.map((r): AbstractRule => {
      // Identificando prioridade:
      let priority = RulePriority.GLOBAL;
      if (r.empresa_id && ctx.empresaId && r.empresa_id === ctx.empresaId) priority = RulePriority.EMPRESA;
      // Adicionar outras heurísticas conforme serviço ou colaborador_id:
      // if (r.colaborador_id === ctx.colaboradorId) priority = RulePriority.COLABORADOR;

      return {
        id: r.id,
        nome: r.nome || "Regra Sem Nome",
        tipoOrigem: "banco_horas_regras",
        prioridade: priority,
        status: r.status,
        vigenciaInicio: r.vigencia_inicio || r.vigenciaInicio || null,
        vigenciaFim: r.vigencia_fim || r.vigenciaFim || null,
        adicionalHoraExtraPercentual: Number(r.adicional_hora_extra_percentual ?? r.adicionalHoraExtraPercentual ?? 50),
        payload: r
      };
    });

    // Filtra vigência temporal estrita e status ativo (comparação lexicográfica YYYY-MM-DD imune a fuso)
    const dataProcStr = ctx.dataProcessamento ? String(ctx.dataProcessamento).slice(0, 10) : "";
    const validRules = rawToAbstract.filter((r) => {
      if (r.status !== "ativo") return false;
      if (r.payload.bh_ativo === false) return false;

      // Resolução temporal estrita (inclusiva no início e no fim):
      if (dataProcStr) {
        if (r.vigenciaInicio && dataProcStr < r.vigenciaInicio) return false;
        if (r.vigenciaFim && dataProcStr > r.vigenciaFim) return false;
      }
      return true;
    });

    // Ordenação e desempate determinístico:
    // 1. Maior prioridade hierárquica (EMPRESA 80 > GLOBAL 20)
    // 2. Vigência com início mais recente (política temporal mais específica)
    // 3. Regra criada mais recentemente (created_at DESC)
    validRules.sort((a, b) => {
      if (b.prioridade !== a.prioridade) {
        return b.prioridade - a.prioridade;
      }
      const inicioA = a.vigenciaInicio || "1900-01-01";
      const inicioB = b.vigenciaInicio || "1900-01-01";
      if (inicioB !== inicioA) {
        return inicioB.localeCompare(inicioA);
      }
      const createdA = String(a.payload?.created_at || "");
      const createdB = String(b.payload?.created_at || "");
      return createdB.localeCompare(createdA);
    });

    // Auditoria de advertência caso haja regras concorrentes no mesmo escopo/data
    if (validRules.length > 1 && validRules[0].prioridade === validRules[1].prioridade) {
      EngineLogger.warn(
        `[EngineResolver] Conflito de regras ativas concorrentes para o mesmo escopo (prioridade ${validRules[0].prioridade}) na data ${dataProcStr}. Regra selecionada deterministicamente: "${validRules[0].nome}" (${validRules[0].id}) sobreposta com "${validRules[1].nome}" (${validRules[1].id})`,
        { component: "EngineResolver" }
      );
    }

    const hash = EngineLogger.buildContextHash(ctx);
    
    const hasCalendario = !!ctx.calendario;
    const baseLog = {
      tenantId: ctx.tenantId,
      dataProcessamento: ctx.dataProcessamento,
      contextoHash: hash,
      timestamp: new Date().toISOString(),
      calendarioAplicado: hasCalendario,
      competenciaUsada: hasCalendario ? ctx.calendario!.competencia.competenciaString : undefined,
      jornadaEsperada: hasCalendario ? ctx.calendario!.jornadaPrevistaDiaria : undefined,
    };
    
    if (validRules.length > 0) {
      const bestRule = validRules[0];
      EngineLogger.logDecision({
        ...baseLog,
        regraUsadaId: bestRule.id,
        regraOrigem: bestRule.tipoOrigem,
        prioridadeAplicada: bestRule.prioridade,
        foiFallback: false,
        mensagem: `Regra aplicável encontrada (${bestRule.nome}) com prioridade ${bestRule.prioridade}`,
      });
      return { rule: bestRule, isFallback: false };
    }

    // FALLBACK SEGURO (BLOQUEIO NO GATE 3)
    EngineLogger.logDecision({
      ...baseLog,
      foiFallback: true,
      mensagem: "Nenhuma regra ativa encontrada para o contexto, assumindo Fallback Seguro.",
    });

    return { rule: this.getGlobalFallbackRule(), isFallback: true };
  }

  static getGlobalFallbackRule(): AbstractRule {
    return {
      id: "fallback-motor-v1",
      nome: "Regra padrao automatica 8h (Motor)",
      tipoOrigem: "banco_horas_fallback",
      prioridade: RulePriority.GLOBAL,
      status: "ativo",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
      adicionalHoraExtraPercentual: 50,
      payload: {
        bh_ativo: true,
        adicional_hora_extra_percentual: 50,
        tolerancia_atraso: 10,
        tolerancia_hora_extra: 10,
        limite_diario_banco: 120,
        prazo_compensacao_dias: 60,
        tipo: "acumula"
      }
    };
  }
}
