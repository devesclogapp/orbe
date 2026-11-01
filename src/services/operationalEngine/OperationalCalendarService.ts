import { Competencia, CalendarioContext } from "../../types/motor.types";

export class OperationalCalendarService {
  /**
   * Identifica a competência do sistema dado uma data de processamento civil (YYYY-MM-DD).
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
   * Retorna os feriados nacionais fixos no formato MM-DD.
   * Inclui 20 de novembro (Dia da Consciência Negra, Lei 14.759/2023).
   */
  static getFeriadosEstaticos(): string[] {
    return [
      "01-01", // Confraternização Universal / Ano Novo
      "04-21", // Tiradentes
      "05-01", // Dia do Trabalhador
      "09-07", // Independência do Brasil
      "10-12", // Nossa Senhora Aparecida
      "11-02", // Finados
      "11-15", // Proclamação da República
      "11-20", // Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)
      "12-25"  // Natal
    ];
  }

  /**
   * Calcula o Domingo de Páscoa usando o algoritmo de Butcher / Meeus.
   * Retorna { month, day } em mês base 1 (1 = janeiro, 4 = abril, etc.)
   */
  static getEasterSunday(year: number): { month: number; day: number } {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
  }

  /**
   * Retorna os feriados nacionais móveis de um determinado ano (Carnaval, Sexta-Feira Santa, Corpus Christi).
   */
  static getFeriadosMoveis(year: number): Map<string, string> {
    const easter = this.getEasterSunday(year);
    // Usamos meio-dia UTC para evitar qualquer desvio de fuso horário
    const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day, 12, 0, 0));

    const addDays = (base: Date, days: number): string => {
      const target = new Date(base.getTime() + days * 86400000);
      const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(target.getUTCDate()).padStart(2, "0");
      return `${mm}-${dd}`;
    };

    const mapa = new Map<string, string>();
    mapa.set(addDays(easterDate, -47), "Carnaval");
    mapa.set(addDays(easterDate, -2), "Sexta-Feira Santa");
    mapa.set(addDays(easterDate, 60), "Corpus Christi");
    return mapa;
  }

  /**
   * Avalia se uma data civil (YYYY-MM-DD) é feriado nacional oficial, retornando nome e detalhe.
   */
  static getFeriadoNacionalInfo(dataProcessamento: string): { feriado: boolean; nome: string | null } {
    const [yearStr] = dataProcessamento.split("-");
    const year = Number(yearStr);
    const mmDd = dataProcessamento.substring(5, 10); // MM-DD

    // 1. Feriados Fixos
    const fixos: Record<string, string> = {
      "01-01": "Confraternização Universal",
      "04-21": "Tiradentes",
      "05-01": "Dia do Trabalhador",
      "09-07": "Independência do Brasil",
      "10-12": "Nossa Senhora Aparecida",
      "11-02": "Finados",
      "11-15": "Proclamação da República",
      "11-20": "Dia da Consciência Negra",
      "12-25": "Natal"
    };

    if (fixos[mmDd]) {
      return { feriado: true, nome: fixos[mmDd] };
    }

    // 2. Feriados Móveis
    if (!Number.isNaN(year) && year > 1900 && year < 2200) {
      const moveis = this.getFeriadosMoveis(year);
      if (moveis.has(mmDd)) {
        return { feriado: true, nome: moveis.get(mmDd)! };
      }
    }

    return { feriado: false, nome: null };
  }

  /**
   * Avalia o calendário para uma data específica e tipo de jornada (mantém compatibilidade legado).
   */
  static getCalendario(dataProcessamento: string, tipoJornada: string = "CLT"): CalendarioContext {
    const [year, month, day] = dataProcessamento.split("-").map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Domingo
    
    const isDomingo = dayOfWeek === 0;
    const feriadoInfo = this.getFeriadoNacionalInfo(dataProcessamento);
    const isFeriado = feriadoInfo.feriado;
    const isDiaUtil = !isDomingo && !isFeriado;

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
