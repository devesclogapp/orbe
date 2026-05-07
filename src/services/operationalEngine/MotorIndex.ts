import { EngineResolver } from "./Resolver";
import { EngineLogger } from "./Logger";
import { OperationalContext } from "../../types/motor.types";
import { OperationalCalendarService } from "./OperationalCalendarService";
import { MotorFinanceiro } from "./MotorFinanceiro";

export const MotorExecutavel = {
  /**
   * Recupera a regra (com hierarquia, vigência e fallback resolvida) aplicável ao contexto
   */
  resolveRule: (ctx: OperationalContext, regrasDisponiveis: any[]) => {
    return EngineResolver.resolve(ctx, regrasDisponiveis);
  },

  Logger: EngineLogger,
  Calendar: OperationalCalendarService,
  Financeiro: MotorFinanceiro,
};

export default MotorExecutavel;
