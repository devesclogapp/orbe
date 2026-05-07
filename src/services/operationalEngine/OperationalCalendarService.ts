import { Competencia, CalendarioContext, TipoJornada } from "../../types/motor.types";

export class OperationalCalendarService {
  /**
   * Identifica a competência do sistema dado uma data de processamento.
   */
  static getCompetencia(dataProcessamento: string): Competencia {
    const [year, month] = dataProcessamento.split("-").map(Number);
    return {
      mes: month,
      ano: year,
      competenciaString: `${year}-${String(month).padStart(2, "0")}`
    };
  }

  /**
   * Retorna os feriados nacionais simples (estáticos para fase 3).
   * Formato MM-DD
   */
  static getFeriadosEstaticos(): string[] {
    return [
      "01-01", // Ano Novo
      "04-21", // Tiradentes
      "05-01", // Dia do Trabalhador
      "09-07", // Independência
      "10-12", // Nossa Senhora
      "11-02", // Finados
      "11-15", // Proc. da República
      "12-25"  // Natal
    ];
  }

  /**
   * Avalia o calendário para uma data específica e tipo de jornada.
   */
  static getCalendario(dataProcessamento: string, tipoJornada: string = "CLT"): CalendarioContext {
    const dateObj = new Date(`${dataProcessamento}T00:00:00`);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo
    
    const isDomingo = dayOfWeek === 0;
    
    const mesDiaString = dataProcessamento.substring(5, 10); // MM-DD
    const feriados = this.getFeriadosEstaticos();
    const isFeriado = feriados.includes(mesDiaString);
    
    const isDiaUtil = !isDomingo && !isFeriado;

    // Jornada base mensal
    // CLT: 220h mensais -> 30 dias -> 7.3333h/dia
    // Fallback: 8h fixo (comportamento legado para outros tipos)
    let jornadaPrevistaDiaria = 8;
    if (tipoJornada === "CLT") {
      jornadaPrevistaDiaria = parseFloat((220 / 30).toFixed(4));
    }

    return {
      competencia: this.getCompetencia(dataProcessamento),
      isDomingo,
      isFeriado,
      isDiaUtil,
      jornadaPrevistaDiaria
    };
  }
}
