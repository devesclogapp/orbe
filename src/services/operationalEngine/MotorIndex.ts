import { EngineResolver } from "./Resolver";
import { EngineLogger } from "./Logger";
import { OperationalContext } from "../../types/motor.types";
import { OperationalCalendarService } from "./OperationalCalendarService";
import { MotorFinanceiro } from "./MotorFinanceiro";

import { JornadaResolver } from "./JornadaResolver";
import { RemuneracaoResolver } from "./RemuneracaoResolver";
import {
  avaliarMarcacoesPonto,
  parseMarcacoesPonto,
  parseTimeToMinutes,
} from "./MarcacoesPontoParser";

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
  JornadaResolver: JornadaResolver,
  RemuneracaoResolver: RemuneracaoResolver,
  MarcacoesParser: {
    avaliarMarcacoesPonto,
    parseMarcacoesPonto,
    parseTimeToMinutes,
  },
};

export default MotorExecutavel;

