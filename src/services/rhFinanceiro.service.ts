import { supabase } from "@/lib/supabase";

type ApprovalBlockers = {
  competencia: string;
  empresaId: string;
  empresaNome: string | null;
  impedimentos: string[];
  bloqueiosCriticos: Array<{ id: string; nome: string; motivo: string; categoria: string }>;
  avisosOperacionais: Array<{ id: string; nome: string; motivo: string; categoria: string }>;
  pendenciasCadastrais: Array<{ id: string; nome: string; motivo: string }>;
  inconsistenciasAbertas: Array<{ id: string; nome: string; motivo: string }>;
  colaboradoresBloqueados: Array<{ id: string; nome: string; motivo: string }>;
  resumo: {
    bloqueiosCriticos: number;
    avisosOperacionais: number;
    pendenciasCadastrais: number;
    inconsistenciasAbertas: number;
    colaboradoresBloqueados: number;
  };
};

type ApprovalLotResult = {
  lotesCriados: any[];
  lotesExistentes: any[];
  totalItens: number;
  totalColaboradores: number;
  valorTotal: number;
};

const RH_LOTE_ORIGEM = "RH";
const RH_LOTE_STATUS = "AGUARDANDO_FINANCEIRO";
const WARNING_INCONSISTENCY_TYPES = new Set([
  "empresa_criada_automaticamente",
  "colaborador_criado_automaticamente",
  "motor_regra_aplicada",
  "regra_padrao_aplicada",
]);

const WARNING_DESCRIPTION_PATTERNS = [
  "empresa criada automaticamente",
  "colaborador criado automaticamente",
  "regra aplicada",
  "motor seguro",
  "ajuste automatico",
  "ajuste automático",
  "log",
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const getPeriodRange = (competencia: string) => {
  const [year, month] = competencia.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split("T")[0];
  const endDate = new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0];
  return { startDate, endDate };
};

const safeNumber = (value: unknown) => Number(value || 0);

const normalizeText = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isOperationalWarning = (tipo?: string | null, descricao?: string | null) => {
  const normalizedTipo = normalizeText(tipo);
  const normalizedDescricao = normalizeText(descricao);

  if (WARNING_INCONSISTENCY_TYPES.has(normalizedTipo)) return true;

  return WARNING_DESCRIPTION_PATTERNS.some(
    (pattern) => normalizedTipo.includes(pattern) || normalizedDescricao.includes(pattern),
  );
};

const getSignedValue = (ponto: any, tipoEvento: string) => {
  if (tipoEvento === "hora_extra") return safeNumber(ponto.valor_hora_extra);
  if (tipoEvento === "atraso") return -Math.abs(safeNumber(ponto.valor_atraso));
  if (tipoEvento === "falta") return -Math.abs(safeNumber(ponto.valor_falta));
  return 0;
};

const getMinutesForEvent = (ponto: any, tipoEvento: string) => {
  if (tipoEvento === "hora_extra") return safeNumber(ponto.minutos_extra);
  if (tipoEvento === "atraso") return -Math.abs(safeNumber(ponto.minutos_atraso));
  if (tipoEvento === "falta") {
    const jornada = safeNumber(ponto.jornada_calculada);
    return jornada > 0 ? -Math.round(jornada * 60) : -Math.abs(safeNumber(ponto.minutos_atraso));
  }
  return 0;
};

const resolveValorHora = (colaborador: any) => {
  const valorHora = safeNumber(colaborador?.valor_hora);
  if (valorHora > 0) return valorHora;

  const salarioBase = safeNumber(colaborador?.salario_base);
  if (salarioBase > 0) return salarioBase / 220;

  const valorBase = safeNumber(colaborador?.valor_base);
  if (valorBase > 0) return valorBase / 220;

  return 0;
};

const getCurrentSessionContext = async () => {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user?.id) {
    throw new Error("Sessao invalida. Faca login novamente para aprovar a competencia.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id, full_name")
    .eq("user_id", user.id)
    .single();

  if (error || !profile?.tenant_id) {
    throw new Error("Tenant nao identificado para gerar o lote financeiro.");
  }

  return {
    userId: user.id,
    userName: profile.full_name || user.email || "Usuario",
    tenantId: profile.tenant_id as string,
  };
};

const loadCompetenciaContext = async (tenantId: string, empresaId: string, competencia: string) => {
  const [periodoAno, periodoMes] = competencia.split("-").map(Number);
  const { startDate, endDate } = getPeriodRange(competencia);

  const [
    { data: empresa },
    { data: pontos, error: pontosError },
    { data: colaboradores, error: colaboradoresError },
    { data: inconsistencias, error: inconsistenciasError },
    { data: logs, error: logsError },
  ] =
    await Promise.all([
      supabase.from("empresas").select("id, nome").eq("tenant_id", tenantId).eq("id", empresaId).maybeSingle(),
      supabase
        .from("registros_ponto")
        .select("id, tenant_id, empresa_id, colaborador_id, nome_colaborador, data, status_processamento, jornada_calculada, valor_hora_extra, valor_atraso, valor_falta, minutos_extra, minutos_atraso")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId)
        .gte("data", startDate)
        .lte("data", endDate),
      supabase
        .from("colaboradores")
        .select("id, nome, status, status_cadastro, cadastro_provisorio, tipo_colaborador, empresa_id, valor_hora, salario_base, valor_base")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId),
      (supabase as any)
        .from("processamento_rh_inconsistencias")
        .select("id, registro_ponto_id, colaborador_id, tipo, descricao, status, resolvida, created_at")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId)
        .gte("created_at", `${startDate}T00:00:00.000Z`)
        .lte("created_at", `${endDate}T23:59:59.999Z`),
      (supabase as any)
        .from("processamento_rh_logs")
        .select("id, tipo_execucao, total_processados, total_inconsistencias, executado_em")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId)
        .eq("periodo_ano", periodoAno)
        .eq("periodo_mes", periodoMes)
        .order("executado_em", { ascending: false }),
    ]);

  if (pontosError) throw pontosError;
  if (colaboradoresError) throw colaboradoresError;
  if (inconsistenciasError) throw inconsistenciasError;
  if (logsError) throw logsError;

  return {
    empresa: empresa ?? null,
    pontos: pontos ?? [],
    colaboradores: colaboradores ?? [],
    inconsistencias: inconsistencias ?? [],
    logs: logs ?? [],
    startDate,
    endDate,
  };
};

const buildFolhaVariavelItems = (pontos: any[]) => {
  const items: any[] = [];

  for (const ponto of pontos) {
    if (ponto.status_processamento !== "processado") continue;

    const eventos = ["hora_extra", "atraso", "falta"] as const;
    for (const tipoEvento of eventos) {
      const valorCalculado = getSignedValue(ponto, tipoEvento);
      if (Math.abs(valorCalculado) <= 0) continue;

      const minutos = getMinutesForEvent(ponto, tipoEvento);
      items.push({
        colaborador_id: ponto.colaborador_id ?? null,
        nome_colaborador: ponto.nome_colaborador || "Colaborador sem nome",
        tipo_evento: tipoEvento,
        minutos,
        horas: Number((Math.abs(minutos) / 60).toFixed(2)),
        valor_calculado: Number(valorCalculado.toFixed(2)),
        origem_evento: "registros_ponto",
        referencia_evento_id: ponto.id,
        status: "PENDENTE",
      });
    }
  }

  return items;
};

const buildBancoHorasItems = async (tenantId: string, empresaId: string, competencia: string, colaboradores: any[]) => {
  const { startDate, endDate } = getPeriodRange(competencia);

  const { data: eventos, error } = await (supabase as any)
    .from("banco_horas_eventos")
    .select("id, colaborador_id, empresa_id, tipo_evento, tipo, minutos, quantidade_minutos, descricao, data_evento, created_at, reflexo_financeiro_pendente, status")
    .eq("tenant_id", tenantId)
    .eq("empresa_id", empresaId)
    .eq("reflexo_financeiro_pendente", true)
    .gte("data_evento", startDate)
    .lte("data_evento", endDate);

  if (error) throw error;

  const collaboratorMap = new Map((colaboradores || []).map((item: any) => [item.id, item]));

  return (eventos || []).map((evento: any) => {
    const minutos = Math.abs(safeNumber(evento.minutos ?? evento.quantidade_minutos));
    const colaborador = collaboratorMap.get(evento.colaborador_id);
    const valorHora = resolveValorHora(colaborador);
    const valorCalculado = Number(((minutos / 60) * valorHora).toFixed(2));

    return {
      colaborador_id: evento.colaborador_id ?? null,
      nome_colaborador: colaborador?.nome || "Colaborador sem nome",
      tipo_evento: evento.tipo_evento || evento.tipo || "pagamento_banco_horas",
      minutos,
      horas: Number((minutos / 60).toFixed(2)),
      valor_calculado: valorCalculado,
      origem_evento: "banco_horas_eventos",
      referencia_evento_id: evento.id,
      status: "PENDENTE",
    };
  });
};

const summarizeItems = (items: any[]) => {
  const colaboradoresUnicos = new Set(items.map((item) => item.colaborador_id).filter(Boolean));
  const valorTotal = items.reduce((acc, item) => acc + safeNumber(item.valor_calculado), 0);
  return {
    totalColaboradores: colaboradoresUnicos.size,
    valorTotal: Number(valorTotal.toFixed(2)),
  };
};

const appendLoteHistorico = async (payload: {
  tenantId: string;
  loteId: string;
  userId: string;
  userName: string;
  acao: string;
  statusAnterior?: string | null;
  statusNovo: string;
  observacao?: string | null;
}) => {
  const { error } = await (supabase as any).from("rh_financeiro_lote_historico").insert({
    tenant_id: payload.tenantId,
    lote_id: payload.loteId,
    usuario_id: payload.userId,
    usuario_nome: payload.userName,
    acao: payload.acao,
    status_anterior: payload.statusAnterior ?? null,
    status_novo: payload.statusNovo,
    observacao: payload.observacao ?? null,
  });

  if (error) throw error;
};

class RHFinanceiroServiceClass {
  async validateCompetenciaApproval(empresaId: string, competencia: string): Promise<ApprovalBlockers> {
    if (!empresaId) {
      throw new Error("Selecione uma empresa para aprovar a competencia.");
    }

    if (!/^\d{4}-\d{2}$/.test(competencia || "")) {
      throw new Error("Selecione uma competencia valida no formato YYYY-MM.");
    }

    const { tenantId } = await getCurrentSessionContext();
    const { empresa, pontos, colaboradores, inconsistencias, logs } = await loadCompetenciaContext(tenantId, empresaId, competencia);

    if (!empresa) {
      throw new Error("Empresa nao encontrada para esta aprovacao.");
    }

    const pontosDoMes = pontos || [];
    const colaboradoresMap = new Map((colaboradores || []).map((item: any) => [item.id, item]));

    const pendenciasCadastrais = (colaboradores || [])
      .filter((colaborador: any) => colaborador.tipo_colaborador !== "DIARISTA")
      .filter((colaborador: any) => colaborador.status_cadastro === "pendente_complemento" || Boolean(colaborador.cadastro_provisorio))
      .map((colaborador: any) => ({
        id: colaborador.id,
        nome: colaborador.nome || "Colaborador sem nome",
        motivo: colaborador.status_cadastro === "pendente_complemento" ? "cadastro pendente de complemento" : "cadastro provisório",
      }));

    const colaboradoresBloqueados = Array.from(
      new Map(
        pontosDoMes
          .map((ponto: any) => colaboradoresMap.get(ponto.colaborador_id))
          .filter(Boolean)
          .filter((colaborador: any) => ["inativo", "bloqueado"].includes(String(colaborador.status || "").toLowerCase()))
          .map((colaborador: any) => [
            colaborador.id,
            {
              id: colaborador.id,
              nome: colaborador.nome || "Colaborador sem nome",
              motivo: `status ${String(colaborador.status || "bloqueado").toLowerCase()}`,
            },
          ]),
      ).values(),
    );

    const inconsistenciasAbertasMap = new Map<string, { id: string; nome: string; motivo: string }>();
    const avisosOperacionaisMap = new Map<string, { id: string; nome: string; motivo: string; categoria: string }>();
    const bloqueiosCriticosMap = new Map<string, { id: string; nome: string; motivo: string; categoria: string }>();
    const registroPontoComBloqueio = new Set<string>();

    for (const inconsistencia of inconsistencias || []) {
      if (inconsistencia.resolvida || String(inconsistencia.status || "").toLowerCase() === "resolvida") continue;
      const colaborador = colaboradoresMap.get(inconsistencia.colaborador_id);
      const itemBase = {
        id: inconsistencia.id,
        nome: colaborador?.nome || "Colaborador sem nome",
        motivo: inconsistencia.descricao || "inconsistencia aberta no processamento RH",
      };

      if (isOperationalWarning(inconsistencia.tipo, inconsistencia.descricao)) {
        avisosOperacionaisMap.set(inconsistencia.id, {
          ...itemBase,
          categoria: "Aviso do motor",
        });
        continue;
      }

      inconsistenciasAbertasMap.set(inconsistencia.id, itemBase);
      bloqueiosCriticosMap.set(inconsistencia.id, {
        ...itemBase,
        categoria: "Inconsistência crítica",
      });

      if (inconsistencia.registro_ponto_id) {
        registroPontoComBloqueio.add(inconsistencia.registro_ponto_id);
      }
    }

    for (const ponto of pontosDoMes.filter((item: any) => item.status_processamento === "inconsistente")) {
      if (registroPontoComBloqueio.has(ponto.id)) continue;

      inconsistenciasAbertasMap.set(ponto.id, {
        id: ponto.id,
        nome: ponto.nome_colaborador || "Colaborador sem nome",
        motivo: "registro de ponto ainda marcado como inconsistente",
      });
      bloqueiosCriticosMap.set(ponto.id, {
        id: ponto.id,
        nome: ponto.nome_colaborador || "Colaborador sem nome",
        motivo: "registro de ponto ainda marcado como inconsistente",
        categoria: "Conflito operacional",
      });
    }

    for (const item of pendenciasCadastrais) {
      bloqueiosCriticosMap.set(`pendencia-${item.id}`, {
        ...item,
        id: `pendencia-${item.id}`,
        categoria: "Pendência cadastral",
      });
    }

    for (const item of colaboradoresBloqueados) {
      bloqueiosCriticosMap.set(`bloqueado-${item.id}`, {
        ...item,
        id: `bloqueado-${item.id}`,
        categoria: "Colaborador bloqueado",
      });
    }

    if ((logs || []).length > 0) {
      avisosOperacionaisMap.set(`logs-${competencia}-${empresaId}`, {
        id: `logs-${competencia}-${empresaId}`,
        nome: "Logs do processamento",
        motivo: `${logs.length} execucao(oes) registrada(s) para a competencia, apenas para auditoria operacional.`,
        categoria: "Logs",
      });
    }

    const impedimentos: string[] = [];
    if (pontosDoMes.length === 0) {
      impedimentos.push("Nenhum registro processado foi encontrado para a competencia selecionada.");
    }
    if (pendenciasCadastrais.length > 0) {
      impedimentos.push(`${pendenciasCadastrais.length} pendencia(s) cadastral(is) impedem a aprovacao.`);
    }
    if (bloqueiosCriticosMap.size > pendenciasCadastrais.length + colaboradoresBloqueados.length) {
      impedimentos.push(`${inconsistenciasAbertasMap.size} bloqueio(s) critico(s) ainda exigem tratamento do RH.`);
    }
    if (colaboradoresBloqueados.length > 0) {
      impedimentos.push(`${colaboradoresBloqueados.length} colaborador(es) bloqueado(s) ou inativos aparecem na competencia.`);
    }

    return {
      competencia,
      empresaId,
      empresaNome: empresa.nome || null,
      impedimentos,
      bloqueiosCriticos: Array.from(bloqueiosCriticosMap.values()),
      avisosOperacionais: Array.from(avisosOperacionaisMap.values()),
      pendenciasCadastrais,
      inconsistenciasAbertas: Array.from(inconsistenciasAbertasMap.values()),
      colaboradoresBloqueados,
      resumo: {
        bloqueiosCriticos: bloqueiosCriticosMap.size,
        avisosOperacionais: avisosOperacionaisMap.size,
        pendenciasCadastrais: pendenciasCadastrais.length,
        inconsistenciasAbertas: inconsistenciasAbertasMap.size,
        colaboradoresBloqueados: colaboradoresBloqueados.length,
      },
    };
  }

  async approveCompetencia(empresaId: string, competencia: string): Promise<ApprovalLotResult> {
    const validation = await this.validateCompetenciaApproval(empresaId, competencia);
    if (validation.impedimentos.length > 0) {
      throw new Error(validation.impedimentos.join(" "));
    }

    const { tenantId, userId, userName } = await getCurrentSessionContext();
    const { pontos, colaboradores } = await loadCompetenciaContext(tenantId, empresaId, competencia);

    const tiposParaCriar = [
      { tipo: "FOLHA_VARIAVEL", items: buildFolhaVariavelItems(pontos) },
      { tipo: "BANCO_HORAS", items: await buildBancoHorasItems(tenantId, empresaId, competencia, colaboradores) },
    ];

    if (tiposParaCriar.every((entry) => entry.items.length === 0)) {
      throw new Error("Nenhum item financeiro elegivel foi encontrado para entregar ao Financeiro nesta competencia.");
    }

    const lotesCriados: any[] = [];
    const lotesExistentes: any[] = [];
    let totalItens = 0;
    let totalColaboradores = 0;
    let valorTotalGeral = 0;

    for (const entry of tiposParaCriar) {
      if (!entry.items.length) continue;

      const { data: loteExistente, error: loteExistenteError } = await (supabase as any)
        .from("rh_financeiro_lotes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaId)
        .eq("competencia", competencia)
        .eq("origem", RH_LOTE_ORIGEM)
        .eq("tipo", entry.tipo)
        .maybeSingle();

      if (loteExistenteError) throw loteExistenteError;
      if (loteExistente) {
        lotesExistentes.push(loteExistente);
        await appendLoteHistorico({
          tenantId,
          loteId: loteExistente.id,
          userId,
          userName,
          acao: "APROVOU_RH",
          statusAnterior: loteExistente.status || RH_LOTE_STATUS,
          statusNovo: loteExistente.status || RH_LOTE_STATUS,
          observacao: "RH aprovou competencia. Lote ja existente mantido para analise financeira.",
        });
        continue;
      }

      const resumo = summarizeItems(entry.items);
      const { data: lote, error: loteError } = await (supabase as any)
        .from("rh_financeiro_lotes")
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          competencia,
          origem: RH_LOTE_ORIGEM,
          tipo: entry.tipo,
          status: RH_LOTE_STATUS,
          total_colaboradores: resumo.totalColaboradores,
          valor_total: resumo.valorTotal,
          criado_por: userId,
        })
        .select("*")
        .single();

      if (loteError) throw loteError;

      const itensPayload = entry.items.map((item) => ({
        lote_id: lote.id,
        tenant_id: tenantId,
        colaborador_id: item.colaborador_id,
        nome_colaborador: item.nome_colaborador,
        tipo_evento: item.tipo_evento,
        minutos: item.minutos,
        horas: item.horas,
        valor_calculado: item.valor_calculado,
        origem_evento: item.origem_evento,
        referencia_evento_id: item.referencia_evento_id,
        status: "PENDENTE",
      }));

      const { error: itensError } = await (supabase as any)
        .from("rh_financeiro_lote_itens")
        .insert(itensPayload);
      if (itensError) throw itensError;

      await appendLoteHistorico({
        tenantId,
        loteId: lote.id,
        userId,
        userName,
        acao: "APROVOU_RH",
        statusNovo: RH_LOTE_STATUS,
        observacao: "RH aprovou competencia e encaminhou lote ao Financeiro.",
      });

      await appendLoteHistorico({
        tenantId,
        loteId: lote.id,
        userId,
        userName,
        acao: "CRIOU_LOTE",
        statusNovo: RH_LOTE_STATUS,
        observacao: `Lote ${entry.tipo} criado com ${itensPayload.length} item(ns) e enviado para analise financeira.`,
      });

      lotesCriados.push({ ...lote, itens_count: itensPayload.length });
      totalItens += itensPayload.length;
      totalColaboradores += resumo.totalColaboradores;
      valorTotalGeral += resumo.valorTotal;
    }

    return {
      lotesCriados,
      lotesExistentes,
      totalItens,
      totalColaboradores,
      valorTotal: Number(valorTotalGeral.toFixed(2)),
    };
  }

  async listLotesRecebidos(competencia?: string, empresaId?: string | null) {
    const { tenantId } = await getCurrentSessionContext();
    let query = (supabase as any)
      .from("rh_financeiro_lotes")
      .select("*, empresa:empresas(nome)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (competencia) {
      query = query.eq("competencia", competencia);
    }

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getLoteDetalhe(loteId: string) {
    const { tenantId } = await getCurrentSessionContext();
    const { data, error } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .select("*, empresa:empresas(nome), itens:rh_financeiro_lote_itens(*)")
      .eq("tenant_id", tenantId)
      .eq("id", loteId)
      .single();

    if (error) throw error;
    return data;
  }

  async getLogsLote(loteId: string) {
    const { tenantId } = await getCurrentSessionContext();
    const { data, error } = await (supabase as any)
      .from("rh_financeiro_lote_historico")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as Array<{
      id: string;
      usuario_nome: string | null;
      acao: string;
      status_anterior: string | null;
      status_novo: string;
      observacao: string | null;
      created_at: string;
    }>;
  }

  async iniciarAnalise(loteId: string): Promise<void> {
    const { tenantId, userId, userName } = await getCurrentSessionContext();

    const { data: lote, error: loteError } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("id", loteId)
      .single();

    if (loteError) throw loteError;
    if (!lote) throw new Error("Lote não encontrado.");

    const statusAnterior = lote.status as string;
    if (!["AGUARDANDO_FINANCEIRO", "DEVOLVIDO_RH"].includes(statusAnterior)) {
      throw new Error(`Lote no status "${statusAnterior}" não pode ser iniciado para análise.`);
    }

    const agora = new Date().toISOString();

    const { error: updateError } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .update({
        status: "EM_ANALISE_FINANCEIRA",
        analisado_por: userId,
        analisado_em: agora,
        updated_at: agora,
      })
      .eq("tenant_id", tenantId)
      .eq("id", loteId);

    if (updateError) throw updateError;

    await (supabase as any).from("rh_financeiro_lote_historico").insert({
      tenant_id: tenantId,
      lote_id: loteId,
      usuario_id: userId,
      usuario_nome: userName,
      acao: "INICIOU_ANALISE",
      status_anterior: statusAnterior,
      status_novo: "EM_ANALISE_FINANCEIRA",
      observacao: "Analista financeiro iniciou revisão do lote.",
    });
  }

  async aprovarFinanceiro(loteId: string, observacao?: string): Promise<void> {
    const { tenantId, userId, userName } = await getCurrentSessionContext();

    const { data: lote, error: loteError } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .select("id, status, total_colaboradores, valor_total, itens:rh_financeiro_lote_itens(id)")
      .eq("tenant_id", tenantId)
      .eq("id", loteId)
      .single();

    if (loteError) throw loteError;
    if (!lote) throw new Error("Lote não encontrado.");

    const statusAnterior = lote.status as string;
    if (!["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(statusAnterior)) {
      throw new Error(`Lote no status "${statusAnterior}" não pode ser aprovado.`);
    }

    const totalItens = Array.isArray(lote.itens) ? lote.itens.length : 0;
    if (totalItens === 0) {
      throw new Error("Não é possível aprovar um lote sem itens financeiros.");
    }

    const agora = new Date().toISOString();

    const { error: updateError } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .update({
        status: "AGUARDANDO_PAGAMENTO",
        aprovado_por: userId,
        aprovado_em: agora,
        observacao_financeiro: observacao || null,
        updated_at: agora,
      })
      .eq("tenant_id", tenantId)
      .eq("id", loteId);

    if (updateError) throw updateError;

    await appendLoteHistorico({
      tenantId,
      loteId,
      userId,
      userName,
      acao: "APROVOU_FINANCEIRO",
      statusAnterior,
      statusNovo: "APROVADO_FINANCEIRO",
      observacao: observacao || "Lote aprovado pelo Financeiro.",
    });

    await appendLoteHistorico({
      tenantId,
      loteId,
      userId,
      userName,
      acao: "PREPAROU_CNAB",
      statusAnterior: "APROVADO_FINANCEIRO",
      statusNovo: "AGUARDANDO_PAGAMENTO",
      observacao: "Lote encaminhado para preparação bancária/CNAB.",
    });

    try {
      await supabase.rpc("log_audit", {
        p_action: "RH_LOTE_ENCAMINHADO_BANCARIO",
        p_details: JSON.stringify({
          lote_id: loteId,
          tenant_id: tenantId,
          usuario_id: userId,
          usuario_nome: userName,
          status_anterior: statusAnterior,
          status_novo: "AGUARDANDO_PAGAMENTO",
          observacao: observacao || null,
          origem: "RH_FINANCEIRO",
        }),
      });
    } catch {
      // Auditoria global nunca bloqueia o fluxo principal.
    }
  }

  async devolverAoRH(loteId: string, motivo: string): Promise<void> {
    if (!motivo?.trim()) {
      throw new Error("O motivo da devolução é obrigatório.");
    }

    const { tenantId, userId, userName } = await getCurrentSessionContext();

    const { data: lote, error: loteError } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("id", loteId)
      .single();

    if (loteError) throw loteError;
    if (!lote) throw new Error("Lote não encontrado.");

    const statusAnterior = lote.status as string;
    if (!["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(statusAnterior)) {
      throw new Error(`Lote no status "${statusAnterior}" não pode ser devolvido.`);
    }

    const agora = new Date().toISOString();

    const { error: updateError } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .update({
        status: "DEVOLVIDO_RH",
        devolvido_por: userId,
        devolvido_em: agora,
        motivo_devolucao: motivo.trim(),
        updated_at: agora,
      })
      .eq("tenant_id", tenantId)
      .eq("id", loteId);

    if (updateError) throw updateError;

    await (supabase as any).from("rh_financeiro_lote_historico").insert({
      tenant_id: tenantId,
      lote_id: loteId,
      usuario_id: userId,
      usuario_nome: userName,
      acao: "DEVOLVEU",
      status_anterior: statusAnterior,
      status_novo: "DEVOLVIDO_RH",
      observacao: motivo.trim(),
    });
  }

  async getPendingSummary() {
    const { tenantId } = await getCurrentSessionContext();
    const { data: lotes, error } = await (supabase as any)
      .from("rh_financeiro_lotes")
      .select("id, competencia, origem, tipo, status, valor_total, total_colaboradores")
      .eq("tenant_id", tenantId)
      .eq("status", RH_LOTE_STATUS)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw error;

    const totalLotes = (lotes || []).length;
    const totalValor = (lotes || []).reduce((acc: number, lote: any) => acc + safeNumber(lote.valor_total), 0);
    const totalColaboradores = (lotes || []).reduce((acc: number, lote: any) => acc + safeNumber(lote.total_colaboradores), 0);

    return {
      totalLotes,
      totalValor: Number(totalValor.toFixed(2)),
      totalColaboradores,
      details: (lotes || []).map((lote: any) => ({
        id: lote.id,
        title: `${lote.competencia} · ${lote.tipo === "BANCO_HORAS" ? "Banco de Horas" : "Folha Variavel"}`,
        subtitle: "Origem RH",
        detail: `${formatMoney(safeNumber(lote.valor_total))} · ${safeNumber(lote.total_colaboradores)} colaborador(es)`,
        route: "/financeiro",
        tone: "blue" as const,
        actionLabel: "Analisar lote",
      })),
    };
  }
}

export const RHFinanceiroService = new RHFinanceiroServiceClass();
