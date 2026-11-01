import { supabase } from "@/lib/supabase";
import { getCurrentTenantId } from "@/services/domain/base.service";
import { differenceInDays, differenceInHours } from "date-fns";

export type SetorResponsavel = "Operação" | "RH" | "Financeiro" | "Governança";
export type SituacaoEtapa = "normal" | "atencao" | "bloqueado" | "concluido";
export type ProcessoSituacaoCategoria = "normal" | "aguardando_decisao" | "bloqueado";

export interface ProcessoResumoItem {
  id: string;
  codigo: string;
  tipo: string;
  cliente: string;
  unidade: string;
  tempoRegistro: string;
  idadeHoras: number;
  responsavelSetor: SetorResponsavel;
  situacaoCategoria: ProcessoSituacaoCategoria;
  situacaoTexto: string;
  motivo?: string;
  detalhe?: string;
  ctaLabel: string;
  rotaSugerida: string;
  isBloqueado?: boolean;
}

export interface EtapaOperacional {
  id: string;
  ordem: number;
  nome: string;
  subtitulo: string;
  trilhaId: "trilha-receitas" | "trilha-custos";
  trilhaTitulo: string;
  totalProcessos: number;
  processosEmAtencao: number;
  situacao: SituacaoEtapa;
  responsavelSetorial: SetorResponsavel;
  resumoSituacao: string;
  itens: ProcessoResumoItem[];
}

export interface TrilhaOperacional {
  id: "trilha-receitas" | "trilha-custos";
  titulo: string;
  badgeTrilha: string;
  descricao: string;
  etapas: EtapaOperacional[];
}

export interface RadarOperacionalData {
  aguardandoAcao: number;
  maiorEspera: string;
  inconsistenciasImpeditivas: number;
  emAndamento: number;
}

export interface TorreData {
  radar: RadarOperacionalData;
  trilhaReceitas: TrilhaOperacional;
  trilhaCustos: TrilhaOperacional;
}

function formatTempoDesdeRegistro(dateStr?: string | null): { texto: string; horasTotais: number } {
  if (!dateStr) return { texto: "Recém-registrado", horasTotais: 0 };
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const hours = Math.max(0, differenceInHours(now, d));
    if (hours < 1) return { texto: "Registrado há < 1h", horasTotais: 0 };
    if (hours < 24) return { texto: `Registrado há ${hours}h`, horasTotais: hours };
    const days = differenceInDays(now, d);
    return { texto: `Registrado há ${days}d ${hours % 24}h`, horasTotais: hours };
  } catch {
    return { texto: "Data não disponível", horasTotais: 0 };
  }
}

class TorreOperacionalServiceClass {
  async getTorreData(competencia: string, empresaId?: string): Promise<TorreData> {
    const tenantId = await getCurrentTenantId();
    const [year, mo] = competencia.split("-").map(Number);
    const inicioCompetencia = `${competencia}-01`;
    const nextMo = mo === 12 ? 1 : mo + 1;
    const nextYr = mo === 12 ? year + 1 : year;
    const fimCompetencia = `${nextYr}-${String(nextMo).padStart(2, "0")}-01`;

    // 1. Consultas Paralelas às Fontes Reais Canônicas
    let qOperacoes = supabase
      .from("operacoes_producao")
      .select("id, status, data_operacao, created_at, quantidade, valor_total, placa, empresas(nome), unidades(nome), tipos_servico_operacional(nome)")
      .gte("data_operacao", inicioCompetencia)
      .lt("data_operacao", fimCompetencia)
      .order("created_at", { ascending: false });

    let qServicos = supabase
      .from("servicos_extras_operacionais")
      .select("id, pipeline_status, data, created_at, valor, descricao, empresas(nome), unidades(nome)")
      .gte("data", inicioCompetencia)
      .lt("data", fimCompetencia)
      .order("created_at", { ascending: false });

    let qReceitas = supabase
      .from("receitas_operacionais")
      .select("id, status, competencia, data_operacao, valor_bruto, valor_liquido, descricao, empresas(nome)")
      .eq("competencia", competencia)
      .order("created_at", { ascending: false });

    let qDiaristas = supabase
      .from("diaristas_lotes_fechamento")
      .select("id, status, periodo_inicio, periodo_fim, valor_total, quantidade_lancamentos, created_at, empresas(nome)")
      .gte("periodo_inicio", inicioCompetencia)
      .lt("periodo_inicio", fimCompetencia)
      .order("created_at", { ascending: false });

    let qIntermitentes = supabase
      .from("intermitentes_lotes_fechamento")
      .select("id, status, periodo_inicio, periodo_fim, valor_total, quantidade_registros, created_at, empresa_id, empresas(nome)")
      .gte("periodo_inicio", inicioCompetencia)
      .lt("periodo_inicio", fimCompetencia)
      .order("created_at", { ascending: false });

    let qCustos = supabase
      .from("custos_extras_operacionais")
      .select("id, status_pagamento, data, created_at, valor, tipo_custo, descricao, empresas(nome)")
      .gte("data", inicioCompetencia)
      .lt("data", fimCompetencia)
      .order("created_at", { ascending: false });

    let qPontosInconsistentes = supabase
      .from("registros_ponto")
      .select("id, data, status_processamento, minutos_atraso, created_at, colaboradores(nome, empresas(nome))")
      .in("status_processamento", ["INCONSISTENTE", "inconsistente", "ERRO"])
      .gte("data", inicioCompetencia)
      .lt("data", fimCompetencia)
      .limit(20);

    if (tenantId) {
      qOperacoes = qOperacoes.eq("tenant_id", tenantId);
      qServicos = qServicos.eq("tenant_id", tenantId);
      qReceitas = qReceitas.eq("tenant_id", tenantId);
      qDiaristas = qDiaristas.eq("tenant_id", tenantId);
      qIntermitentes = qIntermitentes.eq("tenant_id", tenantId);
      qCustos = qCustos.eq("tenant_id", tenantId);
      qPontosInconsistentes = qPontosInconsistentes.eq("tenant_id", tenantId);
    }

    if (empresaId && empresaId !== "all") {
      qOperacoes = qOperacoes.eq("empresa_id", empresaId);
      qServicos = qServicos.eq("empresa_id", empresaId);
      qReceitas = qReceitas.eq("empresa_id", empresaId);
      qDiaristas = qDiaristas.eq("empresa_id", empresaId);
      qIntermitentes = qIntermitentes.eq("empresa_id", empresaId);
      qCustos = qCustos.eq("empresa_id", empresaId);
      qPontosInconsistentes = qPontosInconsistentes.eq("empresa_id", empresaId);
    }

    const [
      { data: operacoes = [] },
      { data: servicos = [] },
      { data: receitas = [] },
      { data: diaristas = [] },
      { data: intermitentes = [] },
      { data: custos = [] },
      { data: pontosInconsistentes = [] },
    ] = await Promise.all([
      qOperacoes,
      qServicos,
      qReceitas,
      qDiaristas,
      qIntermitentes,
      qCustos,
      qPontosInconsistentes,
    ]);

    // ==========================================
    // 2. PROJEÇÃO: TRILHA A (OPERAÇÕES & RECEITAS)
    // ==========================================
    const rNode1Items: ProcessoResumoItem[] = [];
    const rNode2Items: ProcessoResumoItem[] = [];
    const rNode3Items: ProcessoResumoItem[] = [];
    const rNode4Items: ProcessoResumoItem[] = [];

    // Mapeamento: Operações por Volume
    (operacoes || []).forEach((op: any) => {
      const st = String(op.status || "").toUpperCase();
      const clienteNome = (op.empresas as any)?.nome || "Empresa não informada";
      const unidadeNome = (op.unidades as any)?.nome || "Base Operacional";
      const tempo = formatTempoDesdeRegistro(op.created_at || op.data_operacao);

      const itemBase: ProcessoResumoItem = {
        id: op.id,
        codigo: `OP-${op.id.substring(0, 6).toUpperCase()}`,
        tipo: "Operação por Volume",
        cliente: clienteNome,
        unidade: unidadeNome,
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "Operação",
        situacaoCategoria: "normal",
        situacaoTexto: "Em andamento regular",
        motivo: `Operação de ${op.quantidade || 0} unidades (${op.placa ? `Placa ${op.placa}` : "Sem placa"}).`,
        detalhe: `Valor de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(op.valor_total || 0))}`,
        ctaLabel: "Abrir em Operações",
        rotaSugerida: `/operacoes-volume`,
      };

      if (st === "RECEBIDO" || st === "NOVO" || st === "") {
        rNode1Items.push({
          ...itemBase,
          situacaoTexto: "Entrada em conferência",
        });
      } else if (st === "EM_VALIDACAO" || st === "EM_RESTRICAO") {
        const isBloq = st === "EM_RESTRICAO";
        rNode2Items.push({
          ...itemBase,
          situacaoCategoria: isBloq ? "bloqueado" : "aguardando_decisao",
          situacaoTexto: isBloq ? "Restrição Operacional" : "Aguardando validação",
          isBloqueado: isBloq,
          ctaLabel: isBloq ? "Resolver Inconsistência" : "Ir para Aprovações",
          rotaSugerida: isBloq ? "/inconsistencias" : "/rh/aprovacoes",
        });
      } else if (st === "AGUARDANDO_FATURAMENTO") {
        rNode3Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoCategoria: "aguardando_decisao",
          situacaoTexto: "Pronto para Faturamento",
          ctaLabel: "Abrir em Receitas",
          rotaSugerida: "/financeiro/receitas",
        });
      } else if (st === "FATURADO" || st === "RECEBIDO_FINANCEIRO" || st === "CONCLUIDO") {
        rNode4Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoCategoria: "normal",
          situacaoTexto: "Faturado / Concluído",
          ctaLabel: "Ver no Financeiro",
          rotaSugerida: "/financeiro/receitas",
        });
      }
    });

    // Mapeamento: Serviços Extras
    (servicos || []).forEach((sx: any) => {
      const st = String(sx.pipeline_status || sx.status || "").toUpperCase();
      const clienteNome = (sx.empresas as any)?.nome || "Empresa não informada";
      const unidadeNome = (sx.unidades as any)?.nome || "Base Operacional";
      const tempo = formatTempoDesdeRegistro(sx.created_at || sx.data);

      const itemBase: ProcessoResumoItem = {
        id: sx.id,
        codigo: `SX-${sx.id.substring(0, 6).toUpperCase()}`,
        tipo: "Serviço Extra",
        cliente: clienteNome,
        unidade: unidadeNome,
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "Operação",
        situacaoCategoria: "normal",
        situacaoTexto: "Em andamento",
        motivo: sx.descricao || "Lançamento de serviço extra de campo",
        detalhe: `Valor de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(sx.valor || 0))}`,
        ctaLabel: "Abrir Serviços Extras",
        rotaSugerida: "/operacional/servicos-extras",
      };

      if (st === "PENDENTE" || st === "NOVO" || st === "") {
        rNode1Items.push(itemBase);
      } else if (st === "EM_VALIDACAO" || st === "APROVADO_OPERACAO" || st === "DEVOLVIDO") {
        const isBloq = st === "DEVOLVIDO";
        rNode2Items.push({
          ...itemBase,
          situacaoCategoria: isBloq ? "bloqueado" : "aguardando_decisao",
          situacaoTexto: isBloq ? "Serviço Devolvido" : "Aguardando aprovação",
          isBloqueado: isBloq,
          ctaLabel: isBloq ? "Resolver Inconsistência" : "Ir para Aprovações",
          rotaSugerida: isBloq ? "/inconsistencias" : "/rh/aprovacoes",
        });
      } else if (st === "APROVADO_FINANCEIRO" || st === "AGUARDANDO_FATURAMENTO") {
        rNode3Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoCategoria: "aguardando_decisao",
          situacaoTexto: "Aprovado para Faturamento",
          ctaLabel: "Abrir em Receitas",
          rotaSugerida: "/financeiro/receitas",
        });
      } else if (st === "FATURADO" || st === "CONCLUIDO" || st === "PAGO") {
        rNode4Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoTexto: "Faturamento Concluído",
          rotaSugerida: "/financeiro/receitas",
        });
      }
    });

    // Mapeamento: Receitas Operacionais diretas
    (receitas || []).forEach((rc: any) => {
      const st = String(rc.status || "").toUpperCase();
      const clienteNome = (rc.empresas as any)?.nome || "Cliente";
      const tempo = formatTempoDesdeRegistro(rc.created_at || rc.data_operacao);

      const itemBase: ProcessoResumoItem = {
        id: rc.id,
        codigo: `REC-${rc.id.substring(0, 6).toUpperCase()}`,
        tipo: "Receita Operacional",
        cliente: clienteNome,
        unidade: "Corporativo",
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "Financeiro",
        situacaoCategoria: "normal",
        situacaoTexto: "Em emissão",
        motivo: rc.descricao || "Título de faturamento operacional",
        detalhe: `Valor de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(rc.valor_liquido || rc.valor_bruto || 0))}`,
        ctaLabel: "Ver em Receitas",
        rotaSugerida: "/financeiro/receitas",
      };

      if (st === "PENDENTE" || st === "EMITIDA") {
        rNode3Items.push({
          ...itemBase,
          situacaoCategoria: "aguardando_decisao",
          situacaoTexto: "Título aguardando envio/faturamento",
        });
      } else if (st === "FATURADA" || st === "A_RECEBER" || st === "RECEBIDA" || st === "LIQUIDADA") {
        rNode4Items.push({
          ...itemBase,
          situacaoTexto: st === "LIQUIDADA" || st === "RECEBIDA" ? "Liquidado / Conciliado" : "Título faturado a receber",
        });
      }
    });

    // ==========================================
    // 3. PROJEÇÃO: TRILHA B (MÃO DE OBRA & CUSTOS)
    // ==========================================
    const cNode1Items: ProcessoResumoItem[] = [];
    const cNode2Items: ProcessoResumoItem[] = [];
    const cNode3Items: ProcessoResumoItem[] = [];
    const cNode4Items: ProcessoResumoItem[] = [];

    // Diaristas
    (diaristas || []).forEach((dia: any) => {
      const st = String(dia.status || "").toUpperCase();
      const clienteNome = (dia.empresas as any)?.nome || "Operação Diaristas";
      const tempo = formatTempoDesdeRegistro(dia.created_at || dia.periodo_inicio);

      const itemBase: ProcessoResumoItem = {
        id: dia.id,
        codigo: `DIA-${dia.id.substring(0, 6).toUpperCase()}`,
        tipo: "Diaristas",
        cliente: clienteNome,
        unidade: `Período: ${dia.periodo_inicio || ""} a ${dia.periodo_fim || ""}`,
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "Operação",
        situacaoCategoria: "normal",
        situacaoTexto: "Grade Semanal",
        motivo: `${dia.quantidade_lancamentos || 0} diárias registradas`,
        detalhe: `Total de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(dia.valor_total || 0))}`,
        ctaLabel: "Abrir Diaristas",
        rotaSugerida: "/operacional/diaristas",
      };

      if (st === "ABERTO" || st === "EM_ANDAMENTO") {
        cNode1Items.push(itemBase);
      } else if (st === "AGUARDANDO_VALIDACAO_RH") {
        cNode2Items.push({
          ...itemBase,
          responsavelSetor: "RH",
          situacaoCategoria: "aguardando_decisao",
          situacaoTexto: "Aguardando Validação RH",
          ctaLabel: "Ir para Aprovações",
          rotaSugerida: "/rh/aprovacoes",
        });
      } else if (st === "VALIDADO_RH") {
        cNode3Items.push({
          ...itemBase,
          responsavelSetor: "RH",
          situacaoTexto: "Lote Homologado pelo RH",
          ctaLabel: "Ver no Fechamento",
          rotaSugerida: "/fechamento",
        });
      } else if (st === "AGUARDANDO_FINANCEIRO" || st === "PRONTO_CNAB" || st === "CNAB_GERADO" || st === "PAGO") {
        cNode4Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoTexto: st === "PAGO" ? "Pagamento Liquidado" : "Pronto para Remessa CNAB",
          ctaLabel: "Central Bancária",
          rotaSugerida: "/bancario",
        });
      }
    });

    // Intermitentes
    (intermitentes || []).forEach((intItem: any) => {
      const st = String(intItem.status || "").toUpperCase();
      const clienteNome = (intItem.empresas as any)?.nome || "Operação Intermitentes";
      const tempo = formatTempoDesdeRegistro(intItem.created_at || intItem.periodo_inicio);

      const itemBase: ProcessoResumoItem = {
        id: intItem.id,
        codigo: `INT-${intItem.id.substring(0, 6).toUpperCase()}`,
        tipo: "Intermitentes",
        cliente: clienteNome,
        unidade: `Período: ${intItem.periodo_inicio || ""} a ${intItem.periodo_fim || ""}`,
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "RH",
        situacaoCategoria: "normal",
        situacaoTexto: "Lote Intermitente",
        motivo: `${intItem.quantidade_registros || 0} convocações registradas`,
        detalhe: `Total de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(intItem.valor_total || 0))}`,
        ctaLabel: "Abrir Intermitentes",
        rotaSugerida: "/operacional/intermitentes",
      };

      if (st === "AGUARDANDO_VALIDACAO_RH") {
        cNode2Items.push({
          ...itemBase,
          situacaoCategoria: "aguardando_decisao",
          situacaoTexto: "Aguardando Validação RH",
          ctaLabel: "Ir para Aprovações",
          rotaSugerida: "/rh/aprovacoes",
        });
      } else if (st === "VALIDADO_RH") {
        cNode3Items.push({
          ...itemBase,
          situacaoTexto: "Lote Homologado",
          ctaLabel: "Ver no Fechamento",
          rotaSugerida: "/fechamento",
        });
      } else if (st === "FECHADO_FINANCEIRO" || st === "CNAB_GERADO" || st === "PAGO") {
        cNode4Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoTexto: st === "PAGO" ? "Liquidado" : "Direcionado ao Financeiro",
          ctaLabel: "Central Bancária",
          rotaSugerida: "/bancario",
        });
      }
    });

    // Custos Extras Operacionais
    (custos || []).forEach((cst: any) => {
      const st = String(cst.status_pagamento || "").toUpperCase();
      const clienteNome = (cst.empresas as any)?.nome || "Despesa Operacional";
      const tempo = formatTempoDesdeRegistro(cst.created_at || cst.data);

      const itemBase: ProcessoResumoItem = {
        id: cst.id,
        codigo: `CST-${cst.id.substring(0, 6).toUpperCase()}`,
        tipo: "Custos Extras",
        cliente: clienteNome,
        unidade: cst.tipo_custo || "Insumos/EPI",
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "Operação",
        situacaoCategoria: "normal",
        situacaoTexto: "Lançamento Registrado",
        motivo: cst.descricao || "Custo operacional de apoio",
        detalhe: `Valor de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cst.valor || 0))}`,
        ctaLabel: "Ver Custos Extras",
        rotaSugerida: "/operacional/custos-extras",
      };

      if (st === "PENDENTE") {
        cNode1Items.push(itemBase);
      } else if (st === "A PAGAR" || st === "AGUARDANDO_PAGAMENTO") {
        cNode3Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoCategoria: "aguardando_decisao",
          situacaoTexto: "Homologado para Pagamento",
          ctaLabel: "Ver no Contas a Pagar",
          rotaSugerida: "/financeiro",
        });
      } else if (st === "PAGO") {
        cNode4Items.push({
          ...itemBase,
          responsavelSetor: "Financeiro",
          situacaoTexto: "Pago / Liquidado",
          rotaSugerida: "/financeiro",
        });
      }
    });

    // Pontos Inconsistentes CLT
    (pontosInconsistentes || []).forEach((pt: any) => {
      const colabNome = (pt.colaboradores as any)?.nome || "Colaborador CLT";
      const empNome = (pt.colaboradores as any)?.empresas?.nome || "Empresa";
      const tempo = formatTempoDesdeRegistro(pt.created_at || pt.data);

      cNode2Items.push({
        id: pt.id,
        codigo: `PTO-${pt.id.substring(0, 6).toUpperCase()}`,
        tipo: "Ponto CLT",
        cliente: empNome,
        unidade: colabNome,
        tempoRegistro: tempo.texto,
        idadeHoras: tempo.horasTotais,
        responsavelSetor: "RH",
        situacaoCategoria: "bloqueado",
        situacaoTexto: "Marcação com Inconsistência",
        motivo: `Espelho de ponto do dia ${pt.data} requer regularização no motor RH.`,
        detalhe: "Inconsistência cadastral ou batida incompleta",
        ctaLabel: "Abrir em Ponto & Jornadas",
        rotaSugerida: "/clt/pontos",
        isBloqueado: true,
      });
    });

    // ==========================================
    // 4. CONSTRUÇÃO DOS NÓS E SAÚDE DETERMINÍSTICA (SEM SLA ARBITRÁRIO)
    // ==========================================
    const buildNodeStatus = (items: ProcessoResumoItem[]): { situacao: SituacaoEtapa; resumo: string } => {
      if (items.length === 0) return { situacao: "normal", resumo: "Sem processos no ciclo" };
      const bloqCount = items.filter((i) => i.isBloqueado || i.situacaoCategoria === "bloqueado").length;
      const atencaoCount = items.filter((i) => i.situacaoCategoria === "aguardando_decisao").length;
      const concluidos = items.filter((i) => i.situacaoTexto.includes("Concluído") || i.situacaoTexto.includes("Liquidado")).length;

      if (bloqCount > 0) return { situacao: "bloqueado", resumo: `${bloqCount} com bloqueio impeditivo` };
      if (atencaoCount > 0) return { situacao: "atencao", resumo: `${atencaoCount} aguardando decisão` };
      if (concluidos === items.length) return { situacao: "concluido", resumo: "Etapa concluída no ciclo" };
      return { situacao: "normal", resumo: `${items.length} em andamento regular` };
    };

    const stR1 = buildNodeStatus(rNode1Items);
    const stR2 = buildNodeStatus(rNode2Items);
    const stR3 = buildNodeStatus(rNode3Items);
    const stR4 = buildNodeStatus(rNode4Items);

    const stC1 = buildNodeStatus(cNode1Items);
    const stC2 = buildNodeStatus(cNode2Items);
    const stC3 = buildNodeStatus(cNode3Items);
    const stC4 = buildNodeStatus(cNode4Items);

    const trilhaReceitas: TrilhaOperacional = {
      id: "trilha-receitas",
      titulo: "Trilha A · Operações & Receitas",
      badgeTrilha: "Ciclo de Faturamento",
      descricao: "Acompanhamento do ciclo de receita e execução de campo (Volumes, Serviços Extras e Faturamento)",
      etapas: [
        {
          id: "rec-1",
          ordem: 1,
          nome: "Entrada de Campo",
          subtitulo: "Descargas & Serviços Realizados",
          trilhaId: "trilha-receitas",
          trilhaTitulo: "Trilha A · Operações & Receitas",
          totalProcessos: rNode1Items.length,
          processosEmAtencao: rNode1Items.filter((i) => i.situacaoCategoria === "aguardando_decisao").length,
          situacao: stR1.situacao,
          responsavelSetorial: "Operação",
          resumoSituacao: stR1.resumo,
          itens: rNode1Items,
        },
        {
          id: "rec-2",
          ordem: 2,
          nome: "Validação Operacional",
          subtitulo: "Conferência de Volume & Avarias",
          trilhaId: "trilha-receitas",
          trilhaTitulo: "Trilha A · Operações & Receitas",
          totalProcessos: rNode2Items.length,
          processosEmAtencao: rNode2Items.filter((i) => i.situacaoCategoria === "aguardando_decisao" || i.isBloqueado).length,
          situacao: stR2.situacao,
          responsavelSetorial: "Operação",
          resumoSituacao: stR2.resumo,
          itens: rNode2Items,
        },
        {
          id: "rec-3",
          ordem: 3,
          nome: "Pronto para Faturar",
          subtitulo: "Liberação Comercial & Emissão",
          trilhaId: "trilha-receitas",
          trilhaTitulo: "Trilha A · Operações & Receitas",
          totalProcessos: rNode3Items.length,
          processosEmAtencao: rNode3Items.filter((i) => i.situacaoCategoria === "aguardando_decisao").length,
          situacao: stR3.situacao,
          responsavelSetorial: "Financeiro",
          resumoSituacao: stR3.resumo,
          itens: rNode3Items,
        },
        {
          id: "rec-4",
          ordem: 4,
          nome: "Faturado / Recebimento",
          subtitulo: "Títulos Emitidos & Conciliação",
          trilhaId: "trilha-receitas",
          trilhaTitulo: "Trilha A · Operações & Receitas",
          totalProcessos: rNode4Items.length,
          processosEmAtencao: 0,
          situacao: stR4.situacao,
          responsavelSetorial: "Financeiro",
          resumoSituacao: stR4.resumo,
          itens: rNode4Items,
        },
      ],
    };

    const trilhaCustos: TrilhaOperacional = {
      id: "trilha-custos",
      titulo: "Trilha B · Mão de Obra & Custos",
      badgeTrilha: "Ciclo de Despesas",
      descricao: "Acompanhamento de custos de equipe, diárias e despesas operacionais (Diaristas, Intermitentes, Custos e CLT)",
      etapas: [
        {
          id: "cst-1",
          ordem: 1,
          nome: "Lançamento de Campo",
          subtitulo: "Presenças, Diárias & Despesas",
          trilhaId: "trilha-custos",
          trilhaTitulo: "Trilha B · Mão de Obra & Custos",
          totalProcessos: cNode1Items.length,
          processosEmAtencao: cNode1Items.filter((i) => i.situacaoCategoria === "aguardando_decisao").length,
          situacao: stC1.situacao,
          responsavelSetorial: "Operação",
          resumoSituacao: stC1.resumo,
          itens: cNode1Items,
        },
        {
          id: "cst-2",
          ordem: 2,
          nome: "Validação Operacional / RH",
          subtitulo: "Conferência de Presença & Horas",
          trilhaId: "trilha-custos",
          trilhaTitulo: "Trilha B · Mão de Obra & Custos",
          totalProcessos: cNode2Items.length,
          processosEmAtencao: cNode2Items.filter((i) => i.situacaoCategoria === "aguardando_decisao" || i.isBloqueado).length,
          situacao: stC2.situacao,
          responsavelSetorial: "RH",
          resumoSituacao: stC2.resumo,
          itens: cNode2Items,
        },
        {
          id: "cst-3",
          ordem: 3,
          nome: "Lote Homologado",
          subtitulo: "Fechamento Aprovado pelo RH",
          trilhaId: "trilha-custos",
          trilhaTitulo: "Trilha B · Mão de Obra & Custos",
          totalProcessos: cNode3Items.length,
          processosEmAtencao: cNode3Items.filter((i) => i.situacaoCategoria === "aguardando_decisao").length,
          situacao: stC3.situacao,
          responsavelSetorial: "RH",
          resumoSituacao: stC3.resumo,
          itens: cNode3Items,
        },
        {
          id: "cst-4",
          ordem: 4,
          nome: "Direcionamento Financeiro",
          subtitulo: "Contas a Pagar & Preparação CNAB",
          trilhaId: "trilha-custos",
          trilhaTitulo: "Trilha B · Mão de Obra & Custos",
          totalProcessos: cNode4Items.length,
          processosEmAtencao: 0,
          situacao: stC4.situacao,
          responsavelSetorial: "Financeiro",
          resumoSituacao: stC4.resumo,
          itens: cNode4Items,
        },
      ],
    };

    // ==========================================
    // 5. RADAR OPERACIONAL FACTUAL (SEM LIMIARES ARBITRÁRIOS)
    // ==========================================
    const allActiveItems = [
      ...rNode1Items,
      ...rNode2Items,
      ...rNode3Items,
      ...cNode1Items,
      ...cNode2Items,
      ...cNode3Items,
    ];

    const aguardandoAcao = allActiveItems.filter(
      (i) => i.situacaoCategoria === "aguardando_decisao"
    ).length;

    const inconsistenciasImpeditivas = allActiveItems.filter(
      (i) => i.isBloqueado || i.situacaoCategoria === "bloqueado"
    ).length;

    const emAndamento = allActiveItems.filter(
      (i) => i.situacaoCategoria === "normal" && !i.isBloqueado
    ).length;

    // Maior espera observacional entre os processos ativos
    let maiorEspera = "—";
    if (allActiveItems.length > 0) {
      const maxHoras = Math.max(...allActiveItems.map((i) => i.idadeHoras || 0));
      if (maxHoras === 0) {
        maiorEspera = "< 1h";
      } else if (maxHoras < 24) {
        maiorEspera = `${maxHoras}h`;
      } else {
        const days = Math.floor(maxHoras / 24);
        const remHours = maxHoras % 24;
        maiorEspera = remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
      }
    }

    return {
      radar: {
        aguardandoAcao,
        maiorEspera,
        inconsistenciasImpeditivas,
        emAndamento,
      },
      trilhaReceitas,
      trilhaCustos,
    };
  }
}

export const TorreOperacionalService = new TorreOperacionalServiceClass();
