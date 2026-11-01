import { CicloFechamentoItem, ChecklistItem } from "@/services/fechamentoCiclosOficial.service";

export interface EmpresaFechamentoClt {
  id: string;
  nome: string;
}

export interface FechamentoCltKpis {
  totalEmpresas: number;
  prontosParaFechar: number;
  bloqueiosCriticos: number;
  lotesLiberados: number;
  folhaVariavelTotal: number;
  bancoHorasTotal: number;
}

export interface CompetenciaOption {
  value: string;
  label: string;
}

export class FechamentoMensalCltAdapter {
  /**
   * Formata YYYY-MM para formato amigável "Mês / Ano"
   */
  static formatCompetencia(competencia: string): string {
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return competencia || "—";
    const [ano, mes] = competencia.split("-");
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const idx = parseInt(mes, 10) - 1;
    return `${meses[idx] || mes} / ${ano}`;
  }

  /**
   * Gera lista de competências para seleção (últimos 12 meses até 2 meses futuros)
   */
  static getCompetenciasDisponiveis(referenceDate: Date = new Date()): CompetenciaOption[] {
    const options: CompetenciaOption[] = [];
    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth(); // 0-indexed

    // Começar de 2 meses no futuro até 12 meses no passado
    for (let offset = 2; offset >= -12; offset--) {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const value = `${y}-${m}`;
      options.push({
        value,
        label: this.formatCompetencia(value),
      });
    }

    return options;
  }

  /**
   * Converte uma validação de empresa (retorno de RHFinanceiroService.validateCompetenciaApproval)
   * e seus lotes correspondentes em um CicloFechamentoItem compatível com o FechamentoDrawer oficial.
   */
  static toCicloFechamentoItem(params: {
    validation: any;
    lotes: any[];
    competencia: string;
    userName?: string;
  }): CicloFechamentoItem {
    const { validation, lotes, competencia, userName = "RH Master" } = params;

    const empresaId = validation.empresaId;
    const empresaNome = validation.empresaNome || "Empresa";

    const loteEmpresa = lotes.filter((l) => l.empresa_id === empresaId);
    const hasErrors = (validation.impedimentos || []).length > 0;

    const statusLote = loteEmpresa[0]?.status || "pendente";
    const isLocked = ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA", "EM_PROCESSAMENTO", "AGUARDANDO_PAGAMENTO", "CONCLUIDO"].includes(
      statusLote.toUpperCase()
    );
    const isFechado = ["PAGO", "CONCLUIDO"].includes(statusLote.toUpperCase());
    const isAguardando = ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(statusLote.toUpperCase());

    // Estado Semântico Oficial
    let estadoVisual: CicloFechamentoItem["estadoVisual"] = "PRONTO_PARA_FECHAR";
    let ctaTexto = "Revisar e Liberar";
    let ctaTipo: CicloFechamentoItem["ctaTipo"] = "FECHAMENTO";
    let ctaRota: string | undefined = undefined;

    if (isFechado) {
      estadoVisual = "FECHADO";
      ctaTexto = "Ver Fechamento";
      ctaTipo = "CONSULTA";
    } else if (isAguardando) {
      estadoVisual = "AGUARDANDO_APROVACAO";
      ctaTexto = "Abrir Aprovações";
      ctaTipo = "APROVACOES";
      ctaRota = "/rh/aprovacoes";
    } else if (hasErrors) {
      estadoVisual = "BLOQUEADO";
      ctaTexto = `Ver ${validation.impedimentos.length} impedimento(s)`;
      ctaTipo = "INCONSISTENCIAS";
      ctaRota = "/inconsistencias";
    }

    // Composição financeira estimada em 3 componentes
    const prevBase = validation.resumo.financeiroPrevisto?.folhaBase || 0;
    const prevVar = validation.resumo.financeiroPrevisto?.variaveis || 0;
    const prevBh = validation.resumo.financeiroPrevisto?.bancoHoras || 0;

    // Composição do Checklist Semântico Estrito
    const checklist: ChecklistItem[] = [];

    // 1. Cadastros de Colaboradores
    const totalColaboradores = validation.resumo.financeiroPrevisto?.folhaBase || 0;
    if (validation.resumo.pendenciasCadastrais > 0) {
      checklist.push({
        id: `chk-${empresaId}-cadastros-pendentes`,
        titulo: `${validation.resumo.pendenciasCadastrais} colaborador(es) com cadastro pendente`,
        tipo: "bloqueio",
        descricao: "Colaboradores com pendência de complemento documental ou dados bancários.",
      });
    } else if ((validation.resumo.colaboradoresBloqueados || 0) > 0) {
      checklist.push({
        id: `chk-${empresaId}-cadastros-bloqueados`,
        titulo: `${validation.resumo.colaboradoresBloqueados} colaborador(es) inativo(s)/bloqueado(s)`,
        tipo: "bloqueio",
        descricao: "Colaborador com status inativo possui apontamentos na competência.",
      });
    } else if (totalColaboradores === 0) {
      checklist.push({
        id: `chk-${empresaId}-cadastros-sem-dados`,
        titulo: "Cadastros: sem colaboradores apurados",
        tipo: "aviso",
        descricao: "Nenhum colaborador com apontamentos ativos na competência.",
      });
    } else {
      checklist.push({
        id: `chk-${empresaId}-cadastros`,
        titulo: "Cadastros de colaboradores íntegros",
        tipo: "sucesso",
        descricao: `${totalColaboradores} colaborador(es) verificado(s) sem pendências cadastrais.`,
      });
    }

    // 2. Pontos & Jornadas (Evita falso positivo se houver 0 registros processados)
    const semPontos = (validation.impedimentos || []).some((imp: string) =>
      imp.includes("Nenhum registro processado")
    ) || (prevVar === 0 && (!loteEmpresa || loteEmpresa.length === 0));

    if (validation.resumo.inconsistenciasAbertas > 0) {
      checklist.push({
        id: `chk-${empresaId}-pontos-bloqueio`,
        titulo: `${validation.resumo.inconsistenciasAbertas} inconsistência(s) de ponto`,
        tipo: "bloqueio",
        descricao: "Existem apontamentos com divergência pendentes de regularização no Motor RH.",
      });
    } else if (semPontos) {
      checklist.push({
        id: `chk-${empresaId}-pontos-sem-dados`,
        titulo: "Sem marcações de ponto processadas",
        tipo: "aviso",
        descricao: "Nenhum registro de ponto processado foi identificado para a competência selecionada.",
      });
    } else {
      checklist.push({
        id: `chk-${empresaId}-pontos`,
        titulo: "Marcações de ponto homologadas",
        tipo: "sucesso",
        descricao: `${prevVar} ocorrência(s) apurada(s) sem pendências.`,
      });
    }

    // 3. Custos / Serviços Extras
    const custosPendentes = validation.resumo.custosExtrasPendentes || 0;
    const servicosPendentes = validation.resumo.servicosExtrasPendentes || 0;
    if (custosPendentes > 0 || servicosPendentes > 0) {
      checklist.push({
        id: `chk-${empresaId}-extras-bloqueio`,
        titulo: `${custosPendentes + servicosPendentes} pendência(s) de custos/serviços extras`,
        tipo: "bloqueio",
        descricao: "Aguardando validação operacional ou regularização de reflexo financeiro.",
      });
    } else {
      checklist.push({
        id: `chk-${empresaId}-extras`,
        titulo: "Custos e serviços extras: sem pendências",
        tipo: "sucesso",
        descricao: "Fluxo suplementar sem pendências impeditivas na competência.",
      });
    }

    // 4. Situação do Lote Financeiro
    if (isFechado) {
      checklist.push({
        id: `chk-${empresaId}-lote-fechado`,
        titulo: "Lotes financeiros consolidados",
        tipo: "sucesso",
        descricao: "Competência liberada e lotes formalmente encaminhados ao financeiro.",
      });
    } else if (isAguardando) {
      checklist.push({
        id: `chk-${empresaId}-lote-aguardando`,
        titulo: "Lotes em análise financeira",
        tipo: "aviso",
        descricao: "Lotes gerados aguardando aprovação/liquidação no financeiro.",
      });
    } else {
      checklist.push({
        id: `chk-${empresaId}-lote-pendente`,
        titulo: "Lote financeiro pendente de geração",
        tipo: "aviso",
        descricao: "Aguardando homologação e liberação da competência pelo RH.",
      });
    }

    const valorTotalLote = loteEmpresa.reduce((acc: number, l: any) => acc + Number(l.valor_total || 0), 0);
    const totalColabsLote = loteEmpresa.reduce((acc: number, l: any) => Math.max(acc, Number(l.total_colaboradores || 0)), 0);

    const detalhesLotes = loteEmpresa.length > 0
      ? loteEmpresa.map((l: any) => ({
          rotulo: `Lote ${l.tipo} (${l.status})`,
          quantidade: l.total_colaboradores || 0,
          valor: Number(l.valor_total || 0),
        }))
      : [
          { rotulo: "Folha Salarial Base (FOLHA_BASE)", quantidade: prevBase, valor: 0 },
          { rotulo: "Ocorrências Variáveis / HE (FOLHA_VARIAVEL)", quantidade: prevVar, valor: 0 },
          { rotulo: "Banco de Horas a Pagar (BANCO_HORAS)", quantidade: prevBh, valor: 0 },
        ];

    return {
      id: `clt-empresa-${empresaId}-${competencia}`,
      dominio: "CLT",
      titulo: `${empresaNome}`,
      subtitulo: `Competência Mensal • ${this.formatCompetencia(competencia)}`,
      periodo: `Competência • ${competencia}`,
      competencia,
      empresaId,
      empresaNome,
      estadoVisual,
      statusMotorOriginal: statusLote,
      statusRhOriginal: validation.resumo.pendenciasCadastrais > 0 ? "BLOQUEADO_CADASTRO" : "VALIDADO",
      statusFinanceiroOriginal: statusLote,
      grandezaResumo: `${prevVar} eventos de ponto apurados`,
      valorTotal: valorTotalLote,
      responsavelPapel: "RH Master",
      responsavelNome: userName,
      totalImpedimentos: (validation.impedimentos || []).length,
      ctaTexto,
      ctaTipo,
      ctaRota,
      checklist,
      consolidacao: {
        colaboradores: totalColabsLote || prevBase || 0,
        quantidadePrincipal: `${prevVar} ocorrências apuradas`,
        valorTotal: valorTotalLote,
        detalhes: detalhesLotes,
      },
      efeitoFechamento:
        "Gera formalmente os 3 lotes no financeiro: FOLHA_BASE, FOLHA_VARIAVEL e BANCO_HORAS em rh_financeiro_lotes, trancando a competência para edição operacional.",
      rastreabilidade: {
        empresa: empresaNome,
        competencia,
        periodo: `Competência Mensal • ${competencia}`,
        responsavel: userName,
        dataHoraRevisao: new Date().toISOString(),
        fechadoEm: loteEmpresa[0]?.aprovado_em || undefined,
        fechadoPor: loteEmpresa[0]?.aprovado_por || undefined,
      },
      raw: {
        tipoMotor: "CLT",
        dadosOriginais: { validation, loteEmpresa },
      },
    };
  }

  /**
   * Calcula os 4 KPIs de síntese oficial para a competência
   */
  static calcularKpis(validations: any[], lotes: any[]): FechamentoCltKpis {
    const totalEmpresas = validations.length;

    let prontosParaFechar = 0;
    let bloqueiosCriticos = 0;
    let folhaVariavelTotal = 0;
    let bancoHorasTotal = 0;

    for (const v of validations) {
      const hasErrors = (v.impedimentos || []).length > 0;
      const lote = lotes.find((l: any) => l.empresa_id === v.empresaId);
      const isLocked = lote && ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA", "CONCLUIDO", "PAGO"].includes(String(lote.status).toUpperCase());

      if (!hasErrors && !isLocked) {
        prontosParaFechar++;
      }

      bloqueiosCriticos += (v.resumo?.bloqueiosCriticos || 0);
      folhaVariavelTotal += (v.resumo?.financeiroPrevisto?.variaveis || 0);
      bancoHorasTotal += (v.resumo?.financeiroPrevisto?.bancoHoras || 0);
    }

    const lotesLiberados = lotes.filter((l: any) => l.origem === "RH").length;

    return {
      totalEmpresas,
      prontosParaFechar,
      bloqueiosCriticos,
      lotesLiberados,
      folhaVariavelTotal,
      bancoHorasTotal,
    };
  }
}
