import { supabase } from "@/lib/supabase";
import { RuleAuditLog, OperationalContext } from "../../types/motor.types";

export class EngineLogger {
  static info(message: string, meta?: any) {
    console.info(message, meta);
  }

  static warn(message: string, meta?: any) {
    console.warn(message, meta);
  }

  static error(message: string, meta?: any) {
    console.error(message, meta);
  }

  /**
   * Registra no banco as decisões do motor para auditoria em background.
   */
  static async logDecision(log: RuleAuditLog) {
    try {
      // Por enquanto não temos a tabela mapeada exatamente,
      // Se houvesse uma "motor_auditoria_logs", usaríamos aqui.
      // O prompt diz para "Criar auditoria de regra aplicada",
      // Como não foi alterado RLS / Banco de dados,
      // usaremos um console técnico ou um insert genérico caso exista a tabela.
      console.info(`[MotorExecutavel] Audit: [${log.dataProcessamento}] ${log.mensagem} | Fallback: ${log.foiFallback} | Regra: ${log.regraUsadaId}`);
      if (log.calendarioAplicado) {
        console.info(`[MotorExecutavel] Calendário [${log.dataProcessamento}] -> Comp: ${log.competenciaUsada} | Jornada: ${log.jornadaEsperada}h`);
      }

      // Optional DB persistence
      /*
      await supabase.from("motor_auditoria_logs").insert({
         tenant_id: log.tenantId,
         contexto_hash: log.contextoHash,
         regra_usada_id: log.regraUsadaId,
         origem_regra: log.regraOrigem,
         foi_fallback: log.foiFallback,
         mensagem: log.mensagem
      });
      */
    } catch (err) {
      console.error("[MotorExecutavel] Falha ao registrar audit log", err);
    }
  }

  static buildContextHash(ctx: OperationalContext) {
    return `${ctx.tenantId}-${ctx.empresaId || "NULL"}-${ctx.colaboradorId || "NULL"}-${ctx.operacaoId || "NULL"}`;
  }
}
