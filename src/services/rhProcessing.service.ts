import { supabase } from "@/lib/supabase";
import MotorExecutavel from "./operationalEngine/MotorIndex";
import { CicloOperacionalService } from "./operationalEngine/CicloOperacionalService";
import { ensurePreCadastroColaboradorFromPonto } from "./preCadastroColaborador.service";

type Empresa = {
  id: string;
  nome?: string | null;
  tenant_id?: string | null;
  status?: string | null;
  origem?: string | null;
  cadastro_provisorio?: boolean | null;
};

type Colaborador = {
  id: string;
  tenant_id?: string | null;
  empresa_id?: string | null;
  nome?: string | null;
  matricula?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  status?: string | null;
  origem?: string | null;
  cadastro_provisorio?: boolean | null;
  salario_base?: number | null;
  valor_hora?: number | null;
  valor_diaria?: number | null;
  valor_base?: number | null;
  tipo_contrato?: string | null;
  tipo_colaborador?: string | null;
};

type Regra = {
  id: string;
  tenant_id?: string | null;
  empresa_id?: string | null;
  nome?: string | null;
  bh_ativo?: boolean | null;
  carga_horaria_diaria?: number | null;
  jornada_contratada?: number | null;
  tolerancia_atraso?: number | null;
  tolerancia_hora_extra?: number | null;
  limite_diario_banco?: number | null;
  prazo_compensacao_dias?: number | null;
  regra_compensacao?: string | null;
  origem_ponto?: string | null;
};

type Ponto = {
  id: string;
  tenant_id: string;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  nome_empresa?: string | null;
  colaborador_id?: string | null;
  nome_colaborador?: string | null;
  matricula_colaborador?: string | null;
  cpf_colaborador?: string | null;
  cargo_colaborador?: string | null;
  data: string;
  entrada?: string | null;
  saida_almoco?: string | null;
  retorno_almoco?: string | null;
  saida?: string | null;
  status?: string | null;
  horas_trabalhadas?: string | null;
};

type RhSaldo = {
  tenant_id: string;
  empresa_id: string | null;
  colaborador_id: string;
  saldo_atual_minutos: number;
  horas_positivas_minutos: number;
  horas_negativas_minutos: number;
  ultima_movimentacao: string | null;
  ultima_atualizacao: string;
};

type ProcessParams = {
  tenantId: string;
  month: string;
  empresaId?: string | null;
  empresas: Empresa[];
  colaboradores: Colaborador[];
  regras: Regra[];
};

type ProcessResult = {
  totalRegistros: number;
  totalProcessados: number;
  totalInconsistencias: number;
  totalCreditos: number;
  totalDebitos: number;
  colaboradoresAfetados: number;
  inconsistencias: string[];
  durationMs: number;
};

const RH_EVENT_ORIGIN = "processamento_rh";
const EXTRA_RATE = 1.5;
const AUTO_IMPORT_ORIGIN = "importacao_ponto";

const normalizeText = (value?: string | null) =>
  value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() || "";

const timeToMinutes = (timeStr?: string | null): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const minutesToHourDecimal = (minutes: number) => Number((minutes / 60).toFixed(2));

const parseImportedDurationMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(-)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const sign = match[1] ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const calculateWorkedMinutes = (ponto: Ponto): number => {
  const entrada = timeToMinutes(ponto.entrada);
  const saida = timeToMinutes(ponto.saida);
  const saidaAlmoco = timeToMinutes(ponto.saida_almoco);
  const retornoAlmoco = timeToMinutes(ponto.retorno_almoco);

  const almocoDuration =
    saidaAlmoco > 0 && retornoAlmoco > 0 ? retornoAlmoco - saidaAlmoco : 0;

  return entrada > 0 && saida > 0 ? saida - entrada - Math.max(almocoDuration, 0) : 0;
};

const getPeriodRange = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1))
    .toISOString()
    .split("T")[0];
  const endDate = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .split("T")[0];
  return { year, monthNumber, startDate, endDate };
};

const getEmpresaFromPonto = (ponto: Ponto, empresas: Empresa[]) => {
  if (ponto.empresa_id) {
    return empresas.find((empresa) => empresa.id === ponto.empresa_id) ?? null;
  }

  const importedName = ponto.empresa_nome || ponto.nome_empresa;
  if (!importedName) return null;

  const normalizedImportedName = normalizeText(importedName);
  return (
    empresas.find((empresa) => normalizeText(empresa.nome) === normalizedImportedName) ||
    empresas.find((empresa) =>
      normalizeText(empresa.nome).includes(normalizedImportedName) ||
      normalizedImportedName.includes(normalizeText(empresa.nome)),
    ) ||
    null
  );
};

const getAutoCompanyDocument = (tenantId: string, companyName: string) => {
  const seed = `${tenantId}${companyName}`.replace(/\D/g, "").slice(0, 8) || "00000000";
  const random = `${Date.now()}`.slice(-6);
  return `AUTO-${seed}${random}`;
};

const createEmpresaFromPonto = async ({
  tenantId,
  ponto,
}: {
  tenantId: string;
  ponto: Ponto;
}): Promise<Empresa | null> => {
  const nome = (ponto.empresa_nome || ponto.nome_empresa || "").trim();
  if (!nome) return null;

  const payload = {
    tenant_id: tenantId,
    nome,
    cnpj: getAutoCompanyDocument(tenantId, nome),
    status: "ativa",
    origem: AUTO_IMPORT_ORIGIN,
    cadastro_provisorio: true,
    unidade: "Pendente validação",
  };

  const { data, error } = await (supabase as any)
    .from("empresas")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Empresa;
};

const createColaboradorFromPonto = async ({
  tenantId,
  empresaId,
  ponto,
  colaboradores,
}: {
  tenantId: string;
  empresaId: string;
  ponto: Ponto;
  colaboradores: Colaborador[];
}): Promise<Colaborador | null> => {
  const nome = (ponto.nome_colaborador || "").trim();
  if (!nome) return null;

  const colaborador = await ensurePreCadastroColaboradorFromPonto({
    tenantId,
    empresaId,
    nome,
    cpf: ponto.cpf_colaborador?.trim() || null,
    matricula: ponto.matricula_colaborador?.trim() || null,
    cargo: ponto.cargo_colaborador?.trim() || "Pendente validação",
    origemDetalhe: "planilha",
    colaboradoresExistentes: colaboradores,
  });

  return (colaborador as Colaborador | null) ?? null;
};

const createFallbackRegra = async (tenantId: string): Promise<Regra> => {
  const payload = {
    tenant_id: tenantId,
    empresa_id: null,
    nome: "Regra padrao automatica 8h",
    prazo_compensacao_dias: 60,
    tipo: "acumula",
    status: "ativo",
    carga_horaria_diaria: 8,
    jornada_contratada: 8,
    tolerancia_atraso: 10,
    tolerancia_hora_extra: 10,
    limite_diario_banco: 120,
    validade_horas: 60,
    regra_compensacao: "automatico",
    regra_vencimento: "acumula",
    bh_ativo: true,
    origem_ponto: "automatica",
  };

  const { data, error } = await (supabase as any)
    .from("banco_horas_regras")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Regra;
};

const findColaborador = (
  ponto: Ponto,
  colaboradores: Colaborador[],
  empresaId?: string | null,
) => {
  const sameEmpresa = empresaId
    ? colaboradores.filter((colaborador) => colaborador.empresa_id === empresaId)
    : colaboradores;

  if (ponto.colaborador_id) {
    const byId = colaboradores.find((colaborador) => colaborador.id === ponto.colaborador_id);
    if (byId) return byId;
  }

  if (ponto.matricula_colaborador) {
    const byMatricula = sameEmpresa.find(
      (colaborador) => colaborador.matricula === ponto.matricula_colaborador,
    );
    if (byMatricula) return byMatricula;
  }

  if (ponto.cpf_colaborador) {
    const byCpf = sameEmpresa.find((colaborador) => colaborador.cpf === ponto.cpf_colaborador);
    if (byCpf) return byCpf;
  }

  if (ponto.nome_colaborador) {
    const normalizedName = normalizeText(ponto.nome_colaborador);
    const byName =
      sameEmpresa.find((colaborador) => normalizeText(colaborador.nome) === normalizedName) ||
      sameEmpresa.find((colaborador) =>
        normalizeText(colaborador.nome).includes(normalizedName) ||
        normalizedName.includes(normalizeText(colaborador.nome)),
      );
    if (byName) return byName;
  }

  return null;
};

// getRegraByEmpresa removed - replaced by MotorExecutavel.resolveRule

const buildInconsistencias = (params: {
  ponto: Ponto;
  empresaId: string | null;
  colaborador: Colaborador | null;
  regra: Regra | null;
  workedMinutes: number;
  jornadaMinutes: number;
  atrasoMinutes: number;
}) => {
  const inconsistencias: Array<{ tipo: string; descricao: string; gravidade: string }> = [];
  const { ponto, empresaId, colaborador, regra, workedMinutes, jornadaMinutes, atrasoMinutes } = params;

  if (!empresaId) {
    inconsistencias.push({
      tipo: "empresa_nao_cadastrada",
      descricao: "Empresa do registro não encontrada no cadastro.",
      gravidade: "alta",
    });
  }

  if (!colaborador) {
    inconsistencias.push({
      tipo: "colaborador_nao_cadastrado",
      descricao: "Colaborador do registro não encontrado no cadastro.",
      gravidade: "alta",
    });
  }

  if (!regra) {
    inconsistencias.push({
      tipo: "regra_inexistente",
      descricao: "Nenhuma regra de banco de horas ativa foi encontrada para a empresa.",
      gravidade: "alta",
    });
  }

  if (!ponto.entrada && ponto.status !== "Ausente" && ponto.status !== "Falta") {
    inconsistencias.push({
      tipo: "entrada_ausente",
      descricao: "Registro sem horário de entrada.",
      gravidade: "media",
    });
  }

  if (!ponto.saida && ponto.status !== "Ausente" && ponto.status !== "Falta") {
    inconsistencias.push({
      tipo: "saida_ausente",
      descricao: "Registro sem horário de saída.",
      gravidade: "alta",
    });
  }

  const entrada = timeToMinutes(ponto.entrada);
  const saida = timeToMinutes(ponto.saida);
  if (entrada > 0 && saida > 0 && saida < entrada) {
    inconsistencias.push({
      tipo: "saida_menor_entrada",
      descricao: "Horário de saída anterior ao horário de entrada.",
      gravidade: "alta",
    });
  }

  const saidaAlmoco = timeToMinutes(ponto.saida_almoco);
  const retornoAlmoco = timeToMinutes(ponto.retorno_almoco);
  if (saidaAlmoco > 0 && retornoAlmoco > 0 && retornoAlmoco < saidaAlmoco) {
    inconsistencias.push({
      tipo: "intervalo_invalido",
      descricao: "Retorno do almoço anterior à saída para almoço.",
      gravidade: "media",
    });
  }

  if (jornadaMinutes <= 0) {
    inconsistencias.push({
      tipo: "jornada_invalida",
      descricao: "A regra de jornada diária está inválida para este colaborador.",
      gravidade: "alta",
    });
  }

  const horasImportadas = parseImportedDurationMinutes(ponto.horas_trabalhadas);
  if (horasImportadas !== null && Math.abs(horasImportadas - workedMinutes) > 5) {
    inconsistencias.push({
      tipo: "horas_divergentes",
      descricao: "Horas calculadas divergem do valor importado na planilha.",
      gravidade: "media",
    });
  }

  if ((ponto.status === "Ausente" || ponto.status === "Falta") && jornadaMinutes > 0) {
    inconsistencias.push({
      tipo: "falta",
      descricao: "Registro marcado como falta/ausência.",
      gravidade: "media",
    });
  }

  if (atrasoMinutes > 120) {
    inconsistencias.push({
      tipo: "atraso_excessivo",
      descricao: "Atraso acima de 120 minutos no dia.",
      gravidade: "media",
    });
  }

  return inconsistencias;
};

const calculateCompensation = (params: {
  ponto: Ponto;
  regra: Regra | null;
  colaborador: Colaborador | null;
}) => {
  const { ponto, regra, colaborador } = params;
  const workedMinutes =
    ponto.status === "Ausente" || ponto.status === "Falta" ? 0 : calculateWorkedMinutes(ponto);
  const jornadaHours =
    Number(regra?.carga_horaria_diaria ?? regra?.jornada_contratada ?? 8) || 8;
  const jornadaMinutes = Math.round(jornadaHours * 60);
  const toleranciaAtraso = Number(regra?.tolerancia_atraso ?? 5) || 0;
  const toleranciaExtra = Number(regra?.tolerancia_hora_extra ?? 0) || 0;
  const limiteDiarioBanco = Number(regra?.limite_diario_banco ?? 480) || 480;

  let saldoBase = workedMinutes - jornadaMinutes;
  let minutosExtra = 0;
  let minutosDebito = 0;

  if (ponto.status === "Ausente" || ponto.status === "Falta") {
    saldoBase = -jornadaMinutes;
    minutosDebito = jornadaMinutes;
  } else if (saldoBase > toleranciaExtra) {
    minutosExtra = Math.min(saldoBase - toleranciaExtra, limiteDiarioBanco);
  } else if (saldoBase < 0) {
    minutosDebito = Math.abs(saldoBase) > toleranciaAtraso ? Math.abs(saldoBase) - toleranciaAtraso : 0;
  }

  const saldoDia = minutosExtra - minutosDebito;
  const atrasoMinutes = saldoBase < 0 ? minutosDebito : 0;

  const valorHoraBase =
    Number(colaborador?.valor_hora ?? 0) ||
    (Number(colaborador?.salario_base ?? 0) > 0
      ? Number(colaborador?.salario_base) / (jornadaHours * 22)
      : 0) ||
    (Number(colaborador?.valor_diaria ?? 0) > 0
      ? Number(colaborador?.valor_diaria) / jornadaHours
      : 0) ||
    (Number(colaborador?.valor_base ?? 0) > 0
      ? Number(colaborador?.valor_base) / jornadaHours
      : 0);

  const valorDiaBase =
    Number(colaborador?.valor_diaria ?? 0) ||
    (valorHoraBase > 0 ? valorHoraBase * jornadaHours : 0);

  const valorExtras = minutesToHourDecimal(minutosExtra) * valorHoraBase * EXTRA_RATE;
  const valorAtraso = minutesToHourDecimal(atrasoMinutes) * valorHoraBase;
  const valorFalta = ponto.status === "Ausente" || ponto.status === "Falta" ? valorDiaBase : 0;
  const valorDia = Math.max(valorDiaBase + valorExtras - valorAtraso - valorFalta, 0);

  return {
    workedMinutes,
    jornadaHours,
    jornadaMinutes,
    saldoDia,
    minutosExtra,
    minutosDebito,
    atrasoMinutes,
    valorHoraBase,
    valorDiaBase,
    valorExtras,
    valorAtraso,
    valorFalta,
    valorDia,
  };
};

const loadPontosPendentes = async ({
  tenantId,
  month,
  empresaId,
}: {
  tenantId: string;
  month: string;
  empresaId?: string | null;
}) => {
  const { startDate, endDate } = getPeriodRange(month);

  let query = supabase
    .from("registros_ponto")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status_processamento", "pendente")
    .gte("data", startDate)
    .lte("data", endDate)
    .order("data", { ascending: true })
    .order("created_at", { ascending: true });

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Ponto[];
};

const loadExistingSaldos = async (tenantId: string) => {
  const { data, error } = await (supabase as any)
    .from("banco_horas_saldos")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;

  const map = new Map<string, RhSaldo>();
  for (const saldo of data ?? []) {
    map.set(saldo.colaborador_id, saldo);
  }
  return map;
};

const saveInconsistencias = async (
  tenantId: string,
  ponto: Ponto,
  colaboradorId: string | null,
  empresaId: string | null,
  inconsistencias: Array<{ tipo: string; descricao: string; gravidade: string }>,
) => {
  if (inconsistencias.length === 0) return;

  const rows = inconsistencias.map((inconsistencia) => ({
    tenant_id: tenantId,
    registro_ponto_id: ponto.id,
    colaborador_id: colaboradorId,
    empresa_id: empresaId,
    tipo: inconsistencia.tipo,
    descricao: inconsistencia.descricao,
    gravidade: inconsistencia.gravidade,
    status: "aberta",
    resolvida: false,
  }));

  const { error } = await (supabase as any)
    .from("processamento_rh_inconsistencias")
    .insert(rows);
  if (error) throw error;
};

const saveAlertas = async (
  tenantId: string,
  ponto: Ponto,
  colaboradorId: string | null,
  empresaId: string | null,
  alertas: Array<{ tipo: string; descricao: string }>,
) => {
  if (alertas.length === 0) return;

  const rows = alertas.map((alerta) => ({
    tenant_id: tenantId,
    registro_ponto_id: ponto.id,
    colaborador_id: colaboradorId,
    empresa_id: empresaId,
    tipo: alerta.tipo,
    descricao: alerta.descricao,
    gravidade: "baixa",
    status: "aberta",
    resolvida: false,
  }));

  const { error } = await (supabase as any)
    .from("processamento_rh_inconsistencias")
    .insert(rows);
  if (error) throw error;
};

const upsertSaldo = async (saldo: RhSaldo) => {
  const { error } = await (supabase as any)
    .from("banco_horas_saldos")
    .upsert(
      {
        tenant_id: saldo.tenant_id,
        empresa_id: saldo.empresa_id,
        colaborador_id: saldo.colaborador_id,
        saldo_atual_minutos: saldo.saldo_atual_minutos,
        horas_positivas_minutos: saldo.horas_positivas_minutos,
        horas_negativas_minutos: saldo.horas_negativas_minutos,
        ultima_movimentacao: saldo.ultima_movimentacao,
        ultima_atualizacao: saldo.ultima_atualizacao,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,colaborador_id" },
    );
  if (error) throw error;
};

const upsertFechamentoMensal = async ({
  tenantId,
  colaborador,
  empresaId,
  month,
}: {
  tenantId: string;
  colaborador: Colaborador;
  empresaId: string | null;
  month: string;
}) => {
  const { startDate, endDate, monthNumber, year } = getPeriodRange(month);

  const { data: pontos, error: pontosError } = await supabase
    .from("registros_ponto")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("colaborador_id", colaborador.id)
    .gte("data", startDate)
    .lte("data", endDate)
    .in("status_processamento", ["processado", "inconsistente"]);
  if (pontosError) throw pontosError;

  const { data: eventos, error: eventosError } = await supabase
    .from("banco_horas_eventos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("colaborador_id", colaborador.id)
    .eq("origem", RH_EVENT_ORIGIN)
    .gte("data", startDate)
    .lte("data", endDate);
  if (eventosError) throw eventosError;

  const diasTrabalhados = (pontos ?? []).filter(
    (ponto: any) => ponto.status !== "Ausente" && ponto.status !== "Falta",
  ).length;
  const horasTrabalhadas = (pontos ?? []).reduce(
    (acc: number, ponto: any) => acc + Number(ponto.jornada_calculada ?? 0),
    0,
  );
  const horasExtras = (pontos ?? []).reduce(
    (acc: number, ponto: any) => acc + minutesToHourDecimal(Number(ponto.minutos_extra ?? 0)),
    0,
  );
  const horasFaltas = (pontos ?? []).reduce(
    (acc: number, ponto: any) =>
      acc + minutesToHourDecimal(Number(ponto.minutos_atraso ?? 0) + (ponto.valor_falta ? 0 : 0)),
    0,
  );
  const bancoCredito = (eventos ?? [])
    .filter((evento: any) => evento.quantidade_minutos > 0)
    .reduce((acc: number, evento: any) => acc + Number(evento.quantidade_minutos), 0);
  const bancoDebito = Math.abs(
    (eventos ?? [])
      .filter((evento: any) => evento.quantidade_minutos < 0)
      .reduce((acc: number, evento: any) => acc + Number(evento.quantidade_minutos), 0),
  );
  const valorHoraExtra = (pontos ?? []).reduce(
    (acc: number, ponto: any) => acc + Number(ponto.valor_hora_extra ?? 0),
    0,
  );
  const valorFaltas = (pontos ?? []).reduce(
    (acc: number, ponto: any) =>
      acc + Number(ponto.valor_falta ?? 0) + Number(ponto.valor_atraso ?? 0),
    0,
  );
  const valorTotal = (pontos ?? []).reduce(
    (acc: number, ponto: any) => acc + Number(ponto.valor_dia ?? 0),
    0,
  );

  const { data: saldoAtualRow } = await (supabase as any)
    .from("banco_horas_saldos")
    .select("saldo_atual_minutos")
    .eq("tenant_id", tenantId)
    .eq("colaborador_id", colaborador.id)
    .maybeSingle();

  const { error: upsertError } = await (supabase as any)
    .from("fechamento_mensal")
    .upsert(
      {
        tenant_id: tenantId,
        colaborador_id: colaborador.id,
        empresa_id: empresaId,
        mes: monthNumber,
        ano: year,
        dias_trabalhados: diasTrabalhados,
        horas_trabalhadas: Number(horasTrabalhadas.toFixed(2)),
        horas_extras: Number(horasExtras.toFixed(2)),
        horas_faltas: Number(horasFaltas.toFixed(2)),
        banco_horas_credito: Number(minutesToHourDecimal(bancoCredito).toFixed(2)),
        banco_horas_debito: Number(minutesToHourDecimal(bancoDebito).toFixed(2)),
        saldo_banco_horas: Number(
          minutesToHourDecimal(Number(saldoAtualRow?.saldo_atual_minutos ?? 0)).toFixed(2),
        ),
        valor_hora_extra: Number(valorHoraExtra.toFixed(2)),
        valor_faltas: Number(valorFaltas.toFixed(2)),
        valor_total: Number(valorTotal.toFixed(2)),
        situacao: "pendente",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,colaborador_id,mes,ano" },
    );
  if (upsertError) throw upsertError;
};

const insertLog = async ({
  tenantId,
  month,
  empresaId,
  totalRegistros,
  totalProcessados,
  totalInconsistencias,
  totalCreditos,
  totalDebitos,
  durationMs,
  reprocessado,
  registrosLimpados,
}: {
  tenantId: string;
  month: string;
  empresaId?: string | null;
  totalRegistros: number;
  totalProcessados: number;
  totalInconsistencias: number;
  totalCreditos: number;
  totalDebitos: number;
  durationMs: number;
  reprocessado?: boolean;
  registrosLimpados?: number;
}) => {
  const { data: authData } = await supabase.auth.getUser();
  const [year, monthNumber] = month.split("-").map(Number);

  const { error } = await (supabase as any).from("processamento_rh_logs").insert({
    tenant_id: tenantId,
    empresa_id: empresaId ?? null,
    usuario_id: authData.user?.id ?? null,
    periodo_mes: monthNumber,
    periodo_ano: year,
    total_registros: totalRegistros,
    total_processados: totalProcessados,
    total_inconsistencias: totalInconsistencias,
    total_horas_positivas: totalCreditos,
    total_horas_negativas: totalDebitos,
    executado_em: new Date().toISOString(),
    duracao_ms: durationMs,
    reprocessado: Boolean(reprocessado),
    registros_limpados: registrosLimpados ?? 0,
  });
  if (error) throw error;
};

export const processRhPeriod = async ({
  tenantId,
  month,
  empresaId,
  empresas,
  colaboradores,
  regras,
}: ProcessParams): Promise<ProcessResult> => {
  const startedAt = Date.now();
  const pontos = await loadPontosPendentes({ tenantId, month, empresaId });
  const empresasRuntime = [...empresas];
  const colaboradoresRuntime = [...colaboradores];
  const regrasRuntime = [...regras];

  if (pontos.length === 0) {
    return {
      totalRegistros: 0,
      totalProcessados: 0,
      totalInconsistencias: 0,
      totalCreditos: 0,
      totalDebitos: 0,
      colaboradoresAfetados: 0,
      inconsistencias: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const { year, monthNumber } = getPeriodRange(month);
  const competenciaAtual = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const ciclosOperacionais = await CicloOperacionalService.getCiclosDaCompetencia(
    tenantId,
    competenciaAtual,
  );

  const validPontos = [];
  const lockedPontosCount = { total: 0 };

  for (const ponto of pontos) {
    const semanaDoPonto = CicloOperacionalService.getSemanaOperacionalDaData(ponto.data);
    const ciclo = ciclosOperacionais.find(
      (c) => c.semana_operacional === semanaDoPonto,
    );

    if (ciclo && (ciclo.status === "fechado" || ciclo.status === "enviado_financeiro")) {
      lockedPontosCount.total += 1;
    } else {
      validPontos.push({
        ...ponto,
        ciclo_id: ciclo?.id,
        competencia: competenciaAtual,
        semana_operacional: semanaDoPonto,
      });
    }
  }

  if (validPontos.length === 0) {
    return {
      totalRegistros: pontos.length,
      totalProcessados: 0,
      totalInconsistencias: 0,
      totalCreditos: 0,
      totalDebitos: 0,
      colaboradoresAfetados: 0,
      inconsistencias:
        lockedPontosCount.total > 0
          ? ["Todos os pontos pendentes encontram-se em ciclos fechados e não foram processados."]
          : [],
      durationMs: Date.now() - startedAt,
    };
  }

  const pontoIds = validPontos.map((ponto) => ponto.id);
  await (supabase as any)
    .from("banco_horas_eventos")
    .delete()
    .in("registro_ponto_id", pontoIds)
    .eq("origem", RH_EVENT_ORIGIN);
  await (supabase as any)
    .from("processamento_rh_inconsistencias")
    .delete()
    .in("registro_ponto_id", pontoIds);

  const saldosMap = await loadExistingSaldos(tenantId);
  const inconsistenciasResumo: string[] = [];
  const colaboradoresAfetados = new Map<string, Colaborador>();

  let totalInconsistencias = 0;
  let totalCreditos = 0;
  let totalDebitos = 0;

  for (const ponto of validPontos) {
    const alertas: Array<{ tipo: string; descricao: string }> = [];

    let empresa = getEmpresaFromPonto(ponto, empresasRuntime);
    if (!empresa && (ponto.empresa_nome || ponto.nome_empresa)) {
      empresa = await createEmpresaFromPonto({ tenantId, ponto });
      if (empresa) {
        empresasRuntime.push(empresa);
        alertas.push({
          tipo: "empresa_criada_automaticamente",
          descricao: "Empresa criada automaticamente a partir do ponto importado.",
        });
      }
    }

    const resolvedEmpresaId = empresa?.id ?? ponto.empresa_id ?? null;

    let colaborador = findColaborador(ponto, colaboradoresRuntime, resolvedEmpresaId);
    if (!colaborador && resolvedEmpresaId && (ponto.nome_colaborador || ponto.matricula_colaborador || ponto.cpf_colaborador)) {
      colaborador = await createColaboradorFromPonto({
        tenantId,
        empresaId: resolvedEmpresaId,
        ponto,
        colaboradores: colaboradoresRuntime,
      });

      if (colaborador) {
        colaboradoresRuntime.push(colaborador);
        alertas.push({
          tipo: "colaborador_criado_automaticamente",
          descricao: "Colaborador criado automaticamente a partir do ponto importado.",
        });
      }
    }

    const tipoColab = colaborador?.tipo_colaborador || "CLT";
    const calendario = MotorExecutavel.Calendar.getCalendario(ponto.data, tipoColab);

    const motorCtx = {
      tenantId: tenantId,
      empresaId: resolvedEmpresaId,
      colaboradorId: colaborador?.id || null,
      operacaoId: null,
      dataProcessamento: ponto.data,
      tipoColaborador: tipoColab,
      calendario
    };

    const { rule: abstractRegra, isFallback } = MotorExecutavel.resolveRule(motorCtx, regrasRuntime);
    let regra = abstractRegra.payload as Regra;

    if (isFallback) {
      const existingFallback = regrasRuntime.find(r => r.nome === regra.nome && r.origem_ponto === "automatica");
      if (!existingFallback) {
        regra = await createFallbackRegra(tenantId);
        regrasRuntime.push(regra);
      } else {
        regra = existingFallback as Regra;
      }
      alertas.push({
        tipo: "regra_padrao_aplicada",
        descricao: "Regra resolvida via Motor Seguro: " + abstractRegra.nome,
      });
    } else {
      alertas.push({
        tipo: "motor_regra_aplicada",
        descricao: `Motor aplicou regra: ${abstractRegra.nome} via prioridade ${abstractRegra.prioridade}`,
      });
    }

    const calculo = calculateCompensation({ ponto, regra, colaborador });
    const inconsistencias = buildInconsistencias({
      ponto,
      empresaId: resolvedEmpresaId,
      colaborador,
      regra,
      workedMinutes: calculo.workedMinutes,
      jornadaMinutes: calculo.jornadaMinutes,
      atrasoMinutes: calculo.atrasoMinutes,
    });

    await saveAlertas(
      tenantId,
      ponto,
      colaborador?.id ?? null,
      resolvedEmpresaId,
      alertas,
    );

    if (inconsistencias.length > 0) {
      totalInconsistencias += 1;
      inconsistenciasResumo.push(
        `${ponto.nome_colaborador || "Registro"}: ${inconsistencias
          .map((item) => item.descricao)
          .join(", ")}`,
      );
      await saveInconsistencias(
        tenantId,
        ponto,
        colaborador?.id ?? null,
        resolvedEmpresaId,
        inconsistencias,
      );
    }

    let saldoAcumulado = Number(
      saldosMap.get(colaborador?.id ?? "")?.saldo_atual_minutos ?? 0,
    );

    if (colaborador && calculo.saldoDia !== 0) {
      const saldoAnterior = saldoAcumulado;
      saldoAcumulado += calculo.saldoDia;

      const eventoPayload = {
        tenant_id: tenantId,
        colaborador_id: colaborador.id,
        empresa_id: resolvedEmpresaId,
        registro_ponto_id: ponto.id,
        data: ponto.data,
        tipo: calculo.saldoDia > 0 ? "credito" : "debito",
        quantidade_minutos: calculo.saldoDia,
        saldo_anterior: saldoAnterior,
        saldo_atual: saldoAcumulado,
        origem: RH_EVENT_ORIGIN,
        descricao:
          calculo.saldoDia > 0
            ? "Crédito diário gerado no processamento RH"
            : "Débito diário gerado no processamento RH",
        data_vencimento:
          calculo.saldoDia > 0 && Number(regra?.prazo_compensacao_dias ?? 0) > 0
            ? new Date(
                new Date(`${ponto.data}T00:00:00`).getTime() +
                  Number(regra?.prazo_compensacao_dias ?? 0) * 24 * 60 * 60 * 1000,
              )
                .toISOString()
                .split("T")[0]
            : null,
      };

      const { error: eventoError } = await (supabase as any)
        .from("banco_horas_eventos")
        .insert(eventoPayload);
      if (eventoError) throw eventoError;

      const saldoAnteriorRow = saldosMap.get(colaborador.id);
      const novoSaldo: RhSaldo = {
        tenant_id: tenantId,
        empresa_id: resolvedEmpresaId,
        colaborador_id: colaborador.id,
        saldo_atual_minutos: saldoAcumulado,
        horas_positivas_minutos:
          Number(saldoAnteriorRow?.horas_positivas_minutos ?? 0) +
          Math.max(calculo.saldoDia, 0),
        horas_negativas_minutos:
          Number(saldoAnteriorRow?.horas_negativas_minutos ?? 0) +
          Math.max(-calculo.saldoDia, 0),
        ultima_movimentacao: new Date(`${ponto.data}T00:00:00`).toISOString(),
        ultima_atualizacao: new Date().toISOString(),
      };

      await upsertSaldo(novoSaldo);
      saldosMap.set(colaborador.id, novoSaldo);
    }

    totalCreditos += Math.max(calculo.saldoDia, 0);
    totalDebitos += Math.max(-calculo.saldoDia, 0);

    if (colaborador) {
      colaboradoresAfetados.set(colaborador.id, colaborador);
    }

    const updatePayload = {
      status_processamento: inconsistencias.length > 0 ? "inconsistente" : "processado",
      processado_em: new Date().toISOString(),
      ciclo_id: ponto.ciclo_id ?? null,
      competencia: ponto.competencia,
      semana_operacional: ponto.semana_operacional,
      empresa_id: resolvedEmpresaId,
      colaborador_id: colaborador?.id ?? null,
      horas_calculadas: `${Math.floor(calculo.workedMinutes / 60)}:${String(
        Math.abs(calculo.workedMinutes % 60),
      ).padStart(2, "0")}`,
      saldo_dia: calculo.saldoDia,
      saldo_acumulado_minutos: saldoAcumulado,
      jornada_calculada: calculo.jornadaHours,
      valor_hora: Number(calculo.valorHoraBase.toFixed(2)),
      valor_dia: Number(calculo.valorDia.toFixed(2)),
      valor_hora_extra: Number(calculo.valorExtras.toFixed(2)),
      valor_atraso: Number(calculo.valorAtraso.toFixed(2)),
      valor_falta: Number(calculo.valorFalta.toFixed(2)),
      minutos_atraso: calculo.atrasoMinutes,
      minutos_extra: calculo.minutosExtra,
      horas_extras_detalhadas:
        calculo.minutosExtra > 0
          ? {
              minutos: calculo.minutosExtra,
              percentual: 50,
              multiplicador: EXTRA_RATE,
              valor: Number(calculo.valorExtras.toFixed(2)),
            }
          : null,
      inconsistencias_count: inconsistencias.length,
      inconsistencias: inconsistencias.map((item) => item.descricao).join("; "),
    };

    const { error: updateError } = await supabase
      .from("registros_ponto")
      .update(updatePayload)
      .eq("id", ponto.id)
      .eq("tenant_id", tenantId);
    if (updateError) throw updateError;
  }

  for (const colaborador of colaboradoresAfetados.values()) {
    await upsertFechamentoMensal({
      tenantId,
      colaborador,
      empresaId: colaborador.empresa_id ?? null,
      month,
    });
  }

  for (const ciclo of ciclosOperacionais) {
    const { count: totalProcessados } = await supabase
      .from("registros_ponto")
      .select("*", { count: "exact", head: true })
      .eq("ciclo_id", ciclo.id)
      .in("status_processamento", ["processado", "inconsistente"]);

    const { count: totalInconsistenciasCiclo } = await supabase
      .from("registros_ponto")
      .select("*", { count: "exact", head: true })
      .eq("ciclo_id", ciclo.id)
      .eq("status_processamento", "inconsistente");

    await CicloOperacionalService.updateCiclo(ciclo.id, {
      total_registros: totalProcessados || 0,
      total_processados: totalProcessados || 0,
      total_inconsistencias: totalInconsistenciasCiclo || 0,
    });
  }

  const durationMs = Date.now() - startedAt;
  await insertLog({
    tenantId,
    month,
    empresaId,
    totalRegistros: validPontos.length + lockedPontosCount.total,
    totalProcessados: validPontos.length,
    totalInconsistencias,
    totalCreditos,
    totalDebitos,
    durationMs,
  });

  return {
    totalRegistros: validPontos.length + lockedPontosCount.total,
    totalProcessados: validPontos.length,
    totalInconsistencias,
    totalCreditos,
    totalDebitos,
    colaboradoresAfetados: colaboradoresAfetados.size,
    inconsistencias: inconsistenciasResumo.slice(0, 10),
    durationMs,
  };
};

const recomputeSaldoFromEvents = async (tenantId: string, colaboradorId: string) => {
  const { data: eventos, error } = await supabase
    .from("banco_horas_eventos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("colaborador_id", colaboradorId)
    .order("data", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  const total = (eventos ?? []).reduce(
    (acc: number, evento: any) => acc + Number(evento.quantidade_minutos ?? 0),
    0,
  );
  const positivos = (eventos ?? [])
    .filter((evento: any) => Number(evento.quantidade_minutos ?? 0) > 0)
    .reduce((acc: number, evento: any) => acc + Number(evento.quantidade_minutos ?? 0), 0);
  const negativos = Math.abs(
    (eventos ?? [])
      .filter((evento: any) => Number(evento.quantidade_minutos ?? 0) < 0)
      .reduce((acc: number, evento: any) => acc + Number(evento.quantidade_minutos ?? 0), 0),
  );

  if ((eventos ?? []).length === 0) {
    await (supabase as any)
      .from("banco_horas_saldos")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("colaborador_id", colaboradorId);
    return;
  }

  const empresaId = eventos?.[eventos.length - 1]?.empresa_id ?? null;
  await upsertSaldo({
    tenant_id: tenantId,
    empresa_id: empresaId,
    colaborador_id: colaboradorId,
    saldo_atual_minutos: total,
    horas_positivas_minutos: positivos,
    horas_negativas_minutos: negativos,
    ultima_movimentacao: eventos?.[eventos.length - 1]?.data
      ? new Date(`${eventos[eventos.length - 1].data}T00:00:00`).toISOString()
      : null,
    ultima_atualizacao: new Date().toISOString(),
  });
};

export const reprocessRhPeriod = async ({
  tenantId,
  month,
  empresaId,
  colaboradores,
}: {
  tenantId: string;
  month: string;
  empresaId?: string | null;
  colaboradores: Colaborador[];
}) => {
  const startedAt = Date.now();
  const { startDate, endDate } = getPeriodRange(month);

  let pontosQuery = supabase
    .from("registros_ponto")
    .select("id, colaborador_id")
    .eq("tenant_id", tenantId)
    .gte("data", startDate)
    .lte("data", endDate);

  if (empresaId) {
    pontosQuery = pontosQuery.eq("empresa_id", empresaId);
  }

  const { data: pontos, error: pontosError } = await pontosQuery;
  if (pontosError) throw pontosError;

  const pontoIds = (pontos ?? []).map((ponto: any) => ponto.id);
  const colaboradorIds = Array.from(
    new Set((pontos ?? []).map((ponto: any) => ponto.colaborador_id).filter(Boolean)),
  ) as string[];

  if (pontoIds.length > 0) {
    await (supabase as any)
      .from("banco_horas_eventos")
      .delete()
      .in("registro_ponto_id", pontoIds)
      .eq("origem", RH_EVENT_ORIGIN);

    await (supabase as any)
      .from("processamento_rh_inconsistencias")
      .delete()
      .in("registro_ponto_id", pontoIds);

    let resetQuery = supabase
      .from("registros_ponto")
      .update({
        status_processamento: "pendente",
        processado_em: null,
        horas_calculadas: null,
        saldo_dia: null,
        saldo_acumulado_minutos: 0,
        jornada_calculada: null,
        valor_hora: null,
        valor_dia: 0,
        valor_hora_extra: 0,
        valor_atraso: 0,
        valor_falta: 0,
        minutos_atraso: 0,
        minutos_extra: 0,
        horas_extras_detalhadas: null,
        inconsistencias_count: 0,
        inconsistencias: null,
      })
      .eq("tenant_id", tenantId)
      .gte("data", startDate)
      .lte("data", endDate);

    if (empresaId) {
      resetQuery = resetQuery.eq("empresa_id", empresaId);
    }

    const { error: resetError } = await resetQuery;
    if (resetError) throw resetError;

    let fechamentoDeleteQuery = (supabase as any)
      .from("fechamento_mensal")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("mes", Number(month.split("-")[1]))
      .eq("ano", Number(month.split("-")[0]));
    if (empresaId) {
      fechamentoDeleteQuery = fechamentoDeleteQuery.eq("empresa_id", empresaId);
    }
    const { error: fechamentoError } = await fechamentoDeleteQuery;
    if (fechamentoError) throw fechamentoError;
  }

  for (const colaboradorId of colaboradorIds) {
    await recomputeSaldoFromEvents(tenantId, colaboradorId);
  }

  const durationMs = Date.now() - startedAt;
  await insertLog({
    tenantId,
    month,
    empresaId,
    totalRegistros: pontoIds.length,
    totalProcessados: 0,
    totalInconsistencias: 0,
    totalCreditos: 0,
    totalDebitos: 0,
    durationMs,
    reprocessado: true,
    registrosLimpados: pontoIds.length,
  });

  return {
    registrosLimpados: pontoIds.length,
    colaboradoresAfetados: colaboradores.filter((colaborador) =>
      colaboradorIds.includes(colaborador.id),
    ).length,
    durationMs,
  };
};

export const rhProcessingUtils = {
  normalizeText,
  timeToMinutes,
  minutesToHourDecimal,
  calculateWorkedMinutes,
};
