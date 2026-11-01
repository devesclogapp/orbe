import { OperationalContext, AbstractRule, RulePriority, RuleResolutionResult, EscopoResolvido } from "../../types/motor.types";
import { EngineLogger } from "./Logger";

export class EngineResolver {
  /**
   * Identifica a regra correta para o processamento dado o conjunto de regras já filtradas por tenant.
   * Hierarquia de Precedência Canônica (CP05.4):
   * 1. REGRA ESPECÍFICA (Prioridade 100) — Aplicada a 1 única empresa
   * 2. REGRA COMPARTILHADA (Prioridade 80) — Aplicada a 2+ empresas explicitamente selecionadas
   * 3. REGRA GERAL DO TENANT (Prioridade 40) — Aplicada a todas as empresas do tenant
   * 4. SEM REGRA (Fallback / Gate 3 Bloqueado)
   */
  static resolve(
    ctx: OperationalContext,
    bancoHorasRegras: any[]
  ): RuleResolutionResult {
    const dataProcStr = ctx.dataProcessamento ? String(ctx.dataProcessamento).slice(0, 10) : "";
    const targetEmpresaId = ctx.empresaId || null;

    type CandidateWithEscopo = AbstractRule & { escopoResolvido: EscopoResolvido };

    const candidates: CandidateWithEscopo[] = [];

    for (const r of bancoHorasRegras) {
      // 1. Verificação de status e ativação do banco
      const status = r.status || "ativo";
      const bhAtivo = r.bh_ativo !== false && r.payload?.bh_ativo !== false;
      if (status !== "ativo" || !bhAtivo) {
        continue;
      }

      // 2. Resolução temporal estrita (inclusiva no início e no fim)
      const vigenciaInicio = r.vigencia_inicio || r.vigenciaInicio || null;
      const vigenciaFim = r.vigencia_fim || r.vigenciaFim || null;
      if (dataProcStr) {
        if (vigenciaInicio && dataProcStr < vigenciaInicio) continue;
        if (vigenciaFim && dataProcStr > vigenciaFim) continue;
      }

      // 3. Extração e normalização do escopo
      const rawEscopo = r.escopo || r.payload?.escopo || null;
      const singleEmpresaId = r.empresa_id || r.payload?.empresa_id || null;
      const empresasIds: string[] = Array.isArray(r.empresas_ids)
        ? r.empresas_ids
        : Array.isArray(r.payload?.empresas_ids)
        ? r.payload.empresas_ids
        : (singleEmpresaId ? [singleEmpresaId] : []);

      let priority: RulePriority;
      let escopoResolvido: EscopoResolvido;

      // Determinação de escopo e pertinência à empresa do contexto:
      if (rawEscopo === "ESPECIFICA" || (!rawEscopo && singleEmpresaId && empresasIds.length <= 1)) {
        // REGRA ESPECÍFICA: Só se aplica à empresa específica
        if (targetEmpresaId && (singleEmpresaId === targetEmpresaId || (empresasIds.length === 1 && empresasIds[0] === targetEmpresaId))) {
          priority = RulePriority.ESPECIFICA;
          escopoResolvido = "ESPECIFICA";
        } else {
          // Não pertence a esta empresa específica
          continue;
        }
      } else if (rawEscopo === "COMPARTILHADA" || (!rawEscopo && empresasIds.length > 1)) {
        // REGRA COMPARTILHADA: Só se aplica se a empresa do contexto estiver explicitamente na lista
        if (targetEmpresaId && empresasIds.includes(targetEmpresaId)) {
          priority = RulePriority.COMPARTILHADA;
          escopoResolvido = "COMPARTILHADA";
        } else {
          // Empresa do contexto não faz parte desta regra compartilhada
          continue;
        }
      } else if (rawEscopo === "TODAS_EMPRESAS" || (!rawEscopo && !singleEmpresaId && empresasIds.length === 0)) {
        // REGRA GERAL DO TENANT: Válida para qualquer empresa do tenant (atuais e futuras)
        priority = RulePriority.GERAL_TENANT;
        escopoResolvido = "GERAL_TENANT";
      } else {
        // Caso não se enquadre em nenhum escopo válido
        continue;
      }

      candidates.push({
        id: r.id,
        nome: r.nome || "Regra Sem Nome",
        tipoOrigem: "banco_horas_regras",
        prioridade: priority,
        status: status,
        vigenciaInicio: vigenciaInicio,
        vigenciaFim: vigenciaFim,
        adicionalHoraExtraPercentual: (() => {
          const rawAdicional = r.adicional_hora_extra_percentual ?? r.adicionalHoraExtraPercentual ?? r.payload?.adicional_hora_extra_percentual;
          return rawAdicional !== null && rawAdicional !== undefined && !isNaN(Number(rawAdicional))
            ? Number(rawAdicional)
            : 50;
        })(),
        escopo: rawEscopo,
        empresasIds: empresasIds,
        escopoResolvido: escopoResolvido,
        payload: r
      });
    }

    // Ordenação e desempate determinístico:
    // 1. Maior prioridade hierárquica (ESPECIFICA 100 > COMPARTILHADA 80 > GERAL_TENANT 40)
    // 2. Vigência com início mais recente (política temporal mais específica)
    // 3. Regra criada mais recentemente (created_at DESC)
    candidates.sort((a, b) => {
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

    // Auditoria de advertência caso haja regras ativas de mesma precedência concorrentes no mesmo escopo/data
    if (candidates.length > 1 && candidates[0].prioridade === candidates[1].prioridade) {
      EngineLogger.warn(
        `[EngineResolver] Conflito de regras ativas concorrentes para o mesmo escopo (prioridade ${candidates[0].prioridade}) na data ${dataProcStr} para empresa ${targetEmpresaId}. Regra selecionada: "${candidates[0].nome}" (${candidates[0].id}) concorrendo com "${candidates[1].nome}" (${candidates[1].id})`,
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
    
    if (candidates.length > 0) {
      const bestRule = candidates[0];
      EngineLogger.logDecision({
        ...baseLog,
        regraUsadaId: bestRule.id,
        regraOrigem: bestRule.tipoOrigem,
        prioridadeAplicada: bestRule.prioridade,
        foiFallback: false,
        mensagem: `Regra aplicável encontrada (${bestRule.nome}) com escopo ${bestRule.escopoResolvido} e prioridade ${bestRule.prioridade}`,
      });
      return {
        rule: bestRule,
        isFallback: false,
        escopoResolvido: bestRule.escopoResolvido
      };
    }

    // FALLBACK SEGURO (BLOQUEIO NO GATE 3)
    EngineLogger.logDecision({
      ...baseLog,
      foiFallback: true,
      mensagem: "Nenhuma regra ativa encontrada para o contexto, assumindo Fallback Seguro (Gate 3 bloqueado).",
    });

    return {
      rule: this.getGlobalFallbackRule(),
      isFallback: true,
      escopoResolvido: "SEM_REGRA"
    };
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
      escopo: "TODAS_EMPRESAS",
      empresasIds: [],
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
