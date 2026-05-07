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
        payload: r
      };
    });

    // Filtra vigência e status ativo
    const dataProcDate = new Date(`${ctx.dataProcessamento}T00:00:00`);
    const validRules = rawToAbstract.filter((r) => {
      if (r.status !== "ativo") return false;
      if (r.payload.bh_ativo === false) return false;

      // Se houver validade temporal na regra:
      if (r.vigenciaInicio && new Date(`${r.vigenciaInicio}T00:00:00`) > dataProcDate) return false;
      if (r.vigenciaFim && new Date(`${r.vigenciaFim}T00:00:00`) < dataProcDate) return false;
      return true;
    });

    // Ordena pela maior prioridade
    validRules.sort((a, b) => b.prioridade - a.prioridade);

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

    // FALLBACK SEGURO
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
      payload: {
        bh_ativo: true,
        carga_horaria_diaria: 8,
        jornada_contratada: 8,
        tolerancia_atraso: 10,
        tolerancia_hora_extra: 10,
        limite_diario_banco: 120,
        prazo_compensacao_dias: 60,
        tipo: "acumula"
      }
    };
  }
}
