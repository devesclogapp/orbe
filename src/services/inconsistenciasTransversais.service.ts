import { supabase } from "@/lib/supabase";
import { OperacaoProducaoService } from "@/services/base.service";

export type DominioInconsistencia =
  | "OPERACAO"
  | "SERVICO_EXTRA"
  | "CUSTO_EXTRA"
  | "DIARISTA"
  | "INTERMITENTE"
  | "PONTO_CLT";

export type NaturezaInconsistencia =
  | "CADASTRAL_VINCULO"
  | "DOCUMENTAL"
  | "OPERACIONAL"
  | "RH_PONTO"
  | "FINANCEIRO_PAGAMENTO";

export type ResponsavelInconsistencia =
  | "ENCARREGADO"
  | "RH"
  | "FINANCEIRO"
  | "ADMIN";

export interface RastreabilidadeInconsistencia {
  origem: string;
  detectadoPor: string;
  detectadoEm: string;
  motivoDevolucao?: string;
}

export interface DetalhesDrawerInconsistencia {
  oqueAconteceu: string;
  porqueFluxoParou: string;
  impacto: string;
  oquePrecisaSerFeito: string;
  responsavel: string;
  ondeCorrigir: string;
  depoisDaCorrecao: string;
  rastreabilidade: RastreabilidadeInconsistencia;
}

export interface ItemInconsistenciaNormalizado {
  id: string;
  codigo: string;
  dominio: DominioInconsistencia;
  dominioLabel: string;
  empresaId: string;
  empresaNome: string;
  unidadeNome: string;
  referencia: string;
  colaboradorNome?: string;
  natureza: NaturezaInconsistencia;
  naturezaLabel: string;
  tituloHumano: string;
  oqueEstaErrado: string;
  impactoNoFluxo: string;
  responsavel: ResponsavelInconsistencia;
  responsavelLabel: string;
  detectadoEm: string;
  bloqueante: boolean;
  moduloDestino: string;
  rotaDestino: string;
  ctaLabel: string;
  statusOrigem: string;
  detalhesDrawer: DetalhesDrawerInconsistencia;
  rawReference?: any;
}

export const DOMINIO_ROTAS_OFICIAIS: Record<DominioInconsistencia, string> = {
  OPERACAO: "/operacoes-volume",
  SERVICO_EXTRA: "/operacional/servicos-extras",
  CUSTO_EXTRA: "/operacional/custos-extras",
  DIARISTA: "/operacional/diaristas",
  INTERMITENTE: "/operacional/intermitentes",
  PONTO_CLT: "/clt/pontos",
};

export const DOMINIO_LABELS: Record<DominioInconsistencia, string> = {
  OPERACAO: "Operações por Volume",
  SERVICO_EXTRA: "Serviços Extras",
  CUSTO_EXTRA: "Custos Extras",
  DIARISTA: "Diaristas",
  INTERMITENTE: "Intermitentes",
  PONTO_CLT: "Ponto CLT",
};

export const NATUREZA_LABELS: Record<NaturezaInconsistencia, string> = {
  CADASTRAL_VINCULO: "Cadastral & Vínculo",
  DOCUMENTAL: "Documental & Anexos",
  OPERACIONAL: "Operacional de Campo",
  RH_PONTO: "RH & Ponto",
  FINANCEIRO_PAGAMENTO: "Financeiro & Pagamento",
};

export const RESPONSAVEL_LABELS: Record<ResponsavelInconsistencia, string> = {
  ENCARREGADO: "Encarregado (Campo)",
  RH: "RH / Departamento Pessoal",
  FINANCEIRO: "Financeiro",
  ADMIN: "Administrador / Sistema",
};

class InconsistenciasTransversaisServiceClass {
  /**
   * Consulta os 6 domínios reais de forma READ-ONLY e normaliza para a UX09.
   * Não executa inserções, atualizações nem alterações de status.
   */
  async getTodasInconsistencias(filtros?: {
    empresaId?: string;
    tenantId?: string;
  }): Promise<ItemInconsistenciaNormalizado[]> {
    const empresaFiltro = filtros?.empresaId;
    const isEmpresaValida = Boolean(empresaFiltro && empresaFiltro !== "all" && empresaFiltro !== "todas");

    const [
      resOperacoes,
      resServicosExtras,
      resCustosExtras,
      resDiaristas,
      resIntermitentes,
      resPontoClt,
    ] = await Promise.allSettled([
      this.fetchOperacoesVolume(isEmpresaValida ? empresaFiltro : undefined),
      this.fetchServicosExtras(isEmpresaValida ? empresaFiltro : undefined),
      this.fetchCustosExtras(isEmpresaValida ? empresaFiltro : undefined),
      this.fetchDiaristas(isEmpresaValida ? empresaFiltro : undefined),
      this.fetchIntermitentes(isEmpresaValida ? empresaFiltro : undefined),
      this.fetchPontoClt(isEmpresaValida ? empresaFiltro : undefined),
    ]);

    const lista: ItemInconsistenciaNormalizado[] = [];

    if (resOperacoes.status === "fulfilled") lista.push(...resOperacoes.value);
    if (resServicosExtras.status === "fulfilled") lista.push(...resServicosExtras.value);
    if (resCustosExtras.status === "fulfilled") lista.push(...resCustosExtras.value);
    if (resDiaristas.status === "fulfilled") lista.push(...resDiaristas.value);
    if (resIntermitentes.status === "fulfilled") lista.push(...resIntermitentes.value);
    if (resPontoClt.status === "fulfilled") lista.push(...resPontoClt.value);

    // Ordenação canônica decrescente pela data de detecção
    return lista.sort((a, b) => {
      const da = new Date(a.detectadoEm).getTime() || 0;
      const db = new Date(b.detectadoEm).getTime() || 0;
      return db - da;
    });
  }

  // 1. OPERAÇÕES POR VOLUME
  private async fetchOperacoesVolume(empresaId?: string): Promise<ItemInconsistenciaNormalizado[]> {
    try {
      const raw = await OperacaoProducaoService.getInconsistencies();
      if (!Array.isArray(raw)) return [];

      return raw
        .filter((item: any) => {
          if (!empresaId) return true;
          return item.empresa_id === empresaId || item.empresas?.id === empresaId;
        })
        .map((it: any) => {
          const colabNome = it.colaboradores?.nome || undefined;
          const empresaNome = it.empresas?.nome || it.empresas?.razao_social || "Empresa não informada";
          const unidadeNome = it.unidades?.nome || "Base Operacional";
          const codigo = `OP-${String(it.id).substring(0, 6).toUpperCase()}`;

          let tituloHumano = "Pendência operacional em análise";
          let oqueEstaErrado = "Operação retida no fluxo operacional.";
          let natureza: NaturezaInconsistencia = "OPERACIONAL";
          let responsavel: ResponsavelInconsistencia = "ENCARREGADO";
          let rotaDestino = DOMINIO_ROTAS_OFICIAIS.OPERACAO;
          let ctaLabel = "Abrir em Operações";
          let motivoDevolucao: string | undefined = undefined;

          if (it.status_rh === "DEVOLVIDO_RH") {
            motivoDevolucao = it.avaliacao_json?.motivo_devolucao_rh || it.motivo_devolucao;
            tituloHumano = "Operação devolvida pelo RH para revisão";
            oqueEstaErrado = motivoDevolucao
              ? `Devolvido pelo RH: ${motivoDevolucao}`
              : "Operação devolvida pelo RH e requer revisão da equipe ou apontamentos.";
            responsavel = "ENCARREGADO";
          } else if (!it.entrada_ponto || !it.saida_ponto) {
            tituloHumano = "Horário de início e término não informado";
            oqueEstaErrado = "A operação foi lançada sem os horários de início e/ou término da jornada de campo.";
            responsavel = "ENCARREGADO";
          } else if (it.status === "EM_RESTRICAO") {
            const motivoRestricao = it.avaliacao_json?.motivo_restricao || it.motivo_exclusao;
            tituloHumano = "Operação retida em restrição operacional";
            oqueEstaErrado = motivoRestricao
              ? `Restrição: ${motivoRestricao}`
              : "Operação retida por parametrização ou regra comercial pendente.";
            natureza = "FINANCEIRO_PAGAMENTO";
            responsavel = "ADMIN";
          } else {
            const infraction = it.production_entry_collaborators?.find((c: any) => c.had_infraction);
            if (infraction) {
              const infColab = infraction.colaboradores?.nome || colabNome || "Colaborador";
              const nota = infraction.infraction_notes || "Infração registrada";
              tituloHumano = `Infração de equipe (${infColab})`;
              oqueEstaErrado = `Infração registrada: ${nota}`;
              responsavel = "ENCARREGADO";
            }
          }

          const createdAt = it.criado_em || it.created_at || new Date().toISOString();

          return {
            id: it.id,
            codigo,
            dominio: "OPERACAO",
            dominioLabel: DOMINIO_LABELS.OPERACAO,
            empresaId: it.empresa_id || "",
            empresaNome,
            unidadeNome,
            referencia: `Volume: ${Number(it.quantidade || 0).toLocaleString("pt-BR")} un.${colabNome ? ` · ${colabNome}` : ""}`,
            colaboradorNome: colabNome,
            natureza,
            naturezaLabel: NATUREZA_LABELS[natureza],
            tituloHumano,
            oqueEstaErrado,
            impactoNoFluxo: "Trava a validação das horas pelo RH e o faturamento comercial.",
            responsavel,
            responsavelLabel: RESPONSAVEL_LABELS[responsavel],
            detectadoEm: createdAt,
            bloqueante: true,
            moduloDestino: "Operações por Volume",
            rotaDestino,
            ctaLabel,
            statusOrigem: it.status || "EM_RESTRICAO",
            detalhesDrawer: {
              oqueAconteceu: oqueEstaErrado,
              porqueFluxoParou: "O motor de validação não pode autorizar o fluxo operacional enquanto a inconsistência persistir.",
              impacto: "A operação não avança para validação nem faturamento.",
              oquePrecisaSerFeito: "Acessar o módulo de Operações por Volume para saneamento dos dados.",
              responsavel: RESPONSAVEL_LABELS[responsavel],
              ondeCorrigir: "Operações por Volume",
              depoisDaCorrecao: "Após o preenchimento no módulo de origem, o registro poderá seguir para nova análise e continuidade do fluxo.",
              rastreabilidade: {
                origem: "Módulo Operações por Volume",
                detectadoPor: "Motor Operacional de Validação",
                detectadoEm: createdAt,
                motivoDevolucao,
              },
            },
            rawReference: it,
          };
        });
    } catch (err) {
      console.error("[InconsistenciasTransversais] Erro ao carregar Operações por Volume:", err);
      return [];
    }
  }

  // 2. SERVIÇOS EXTRAS
  private async fetchServicosExtras(empresaId?: string): Promise<ItemInconsistenciaNormalizado[]> {
    try {
      let query = supabase
        .from("servicos_extras_operacionais")
        .select(`
          id, data, quantidade, valor_total, pipeline_status, status, descricao,
          created_at, criado_em, motivo_devolucao, empresa_id,
          empresas(id, nome)
        `)
        .or("pipeline_status.eq.DEVOLVIDO,status.eq.DEVOLVIDO,status.eq.RECUSADO");

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];

      return data.map((it: any) => {
        const codigo = `SX-${String(it.id).substring(0, 6).toUpperCase()}`;
        const empresaNome = it.empresas?.nome || "Empresa não informada";
        const createdAt = it.criado_em || it.created_at || new Date().toISOString();
        const motivoDevolucao = it.motivo_devolucao || undefined;

        const oqueEstaErrado = motivoDevolucao
          ? `Devolvido: ${motivoDevolucao}`
          : "Registro devolvido e requer revisão no módulo de origem.";

        return {
          id: it.id,
          codigo,
          dominio: "SERVICO_EXTRA",
          dominioLabel: DOMINIO_LABELS.SERVICO_EXTRA,
          empresaId: it.empresa_id || "",
          empresaNome,
          unidadeNome: "Base Operacional",
          referencia: it.descricao || `Serviço Extra (${it.quantidade || 1} un)`,
          natureza: "OPERACIONAL",
          naturezaLabel: NATUREZA_LABELS.OPERACIONAL,
          tituloHumano: "Serviço extra devolvido para revisão",
          oqueEstaErrado,
          impactoNoFluxo: "Trava a autorização operacional e inclusão no faturamento.",
          responsavel: "ENCARREGADO",
          responsavelLabel: RESPONSAVEL_LABELS.ENCARREGADO,
          detectadoEm: createdAt,
          bloqueante: true,
          moduloDestino: "Serviços Extras",
          rotaDestino: DOMINIO_ROTAS_OFICIAIS.SERVICO_EXTRA,
          ctaLabel: "Abrir em Serviços Extras",
          statusOrigem: it.pipeline_status || it.status || "DEVOLVIDO",
          detalhesDrawer: {
            oqueAconteceu: oqueEstaErrado,
            porqueFluxoParou: "Serviços extras devolvidos requerem ajuste nas horas ou justificativa antes da aprovação.",
            impacto: "O serviço não pode ser aprovado nem faturado ao cliente.",
            oquePrecisaSerFeito: "Revisar o apontamento e reenviar no módulo de Serviços Extras.",
            responsavel: RESPONSAVEL_LABELS.ENCARREGADO,
            ondeCorrigir: "Operacional → Serviços Extras",
            depoisDaCorrecao: "Após a revisão no módulo especialista, o serviço segue para reanálise e prosseguimento do fluxo.",
            rastreabilidade: {
              origem: "Módulo Serviços Extras",
              detectadoPor: "Supervisão Operacional",
              detectadoEm: createdAt,
              motivoDevolucao,
            },
          },
          rawReference: it,
        };
      });
    } catch (err) {
      console.error("[InconsistenciasTransversais] Erro ao carregar Serviços Extras:", err);
      return [];
    }
  }

  // 3. CUSTOS EXTRAS (Despesa / Contas a Pagar)
  private async fetchCustosExtras(empresaId?: string): Promise<ItemInconsistenciaNormalizado[]> {
    try {
      let query = supabase
        .from("custos_extras_operacionais")
        .select(`
          id, data, valor, total, tipo_custo, categoria, descricao,
          pipeline_status, comprovante_url, created_at, criado_em,
          motivo_reprovacao, empresa_id,
          empresas(id, nome)
        `)
        .or("pipeline_status.eq.REPROVADO,status.eq.REPROVADO");

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];

      return data.map((it: any) => {
        const codigo = `CX-${String(it.id).substring(0, 6).toUpperCase()}`;
        const empresaNome = it.empresas?.nome || "Empresa não informada";
        const createdAt = it.criado_em || it.created_at || new Date().toISOString();
        const motivoReprovacao = it.motivo_reprovacao || undefined;

        const oqueEstaErrado = motivoReprovacao
          ? `Despesa reprovada: ${motivoReprovacao}`
          : "Despesa reprovada na conferência e requer ajuste.";

        return {
          id: it.id,
          codigo,
          dominio: "CUSTO_EXTRA",
          dominioLabel: DOMINIO_LABELS.CUSTO_EXTRA,
          empresaId: it.empresa_id || "",
          empresaNome,
          unidadeNome: "Base Operacional",
          referencia: it.descricao || `${it.tipo_custo || it.categoria || "Custo Extra"} · R$ ${Number(it.valor || it.total || 0).toFixed(2)}`,
          natureza: "DOCUMENTAL",
          naturezaLabel: NATUREZA_LABELS.DOCUMENTAL,
          tituloHumano: "Despesa reprovada na conferência operacional",
          oqueEstaErrado,
          impactoNoFluxo: "Trava a aprovação da despesa e liberação no Contas a Pagar.",
          responsavel: "ENCARREGADO",
          responsavelLabel: RESPONSAVEL_LABELS.ENCARREGADO,
          detectadoEm: createdAt,
          bloqueante: true,
          moduloDestino: "Custos Extras",
          rotaDestino: DOMINIO_ROTAS_OFICIAIS.CUSTO_EXTRA,
          ctaLabel: "Abrir em Custos Extras",
          statusOrigem: it.pipeline_status || "REPROVADO",
          detalhesDrawer: {
            oqueAconteceu: oqueEstaErrado,
            porqueFluxoParou: "Nenhuma despesa ou reembolso operacional pode seguir para Contas a Pagar sem conferência idônea.",
            impacto: "A despesa não pode ser autorizada pelo financeiro.",
            oquePrecisaSerFeito: "Revisar o valor, motivo ou anexar o comprovante correspondente em Custos Extras.",
            responsavel: RESPONSAVEL_LABELS.ENCARREGADO,
            ondeCorrigir: "Operacional → Custos Extras",
            depoisDaCorrecao: "Após o ajuste no módulo responsável, a despesa poderá seguir para nova conferência operacional.",
            rastreabilidade: {
              origem: "Módulo Custos Extras",
              detectadoPor: "Conferência Operacional",
              detectadoEm: createdAt,
              motivoDevolucao: motivoReprovacao,
            },
          },
          rawReference: it,
        };
      });
    } catch (err) {
      console.error("[InconsistenciasTransversais] Erro ao carregar Custos Extras:", err);
      return [];
    }
  }

  // 4. DIARISTAS
  private async fetchDiaristas(empresaId?: string): Promise<ItemInconsistenciaNormalizado[]> {
    try {
      let query = supabase
        .from("lancamentos_diaristas")
        .select(`
          id, data_lancamento, valor_diaria, valor_total, status, motivo_devolucao,
          created_at, empresa_id, diarista_id, nome_colaborador,
          empresas(id, nome),
          colaboradores:diarista_id(id, nome, chave_pix, dados_bancarios_json)
        `)
        .or("status.eq.DEVOLVIDO,status.eq.devolvido,status.eq.RECUSADO");

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];

      return data.map((it: any) => {
        const codigo = `DIA-${String(it.id).substring(0, 6).toUpperCase()}`;
        const empresaNome = it.empresas?.nome || "Empresa não informada";
        const createdAt = it.created_at || new Date().toISOString();
        const colabNome = it.colaboradores?.nome || it.nome_colaborador || "Diarista";
        const motivoDevolucao = it.motivo_devolucao || undefined;

        const oqueEstaErrado = motivoDevolucao
          ? `Devolvido: ${motivoDevolucao}`
          : "Apontamento de diária devolvido para conferência de presença e valores.";

        return {
          id: it.id,
          codigo,
          dominio: "DIARISTA",
          dominioLabel: DOMINIO_LABELS.DIARISTA,
          empresaId: it.empresa_id || "",
          empresaNome,
          unidadeNome: "Base Operacional",
          referencia: `Diarista: ${colabNome} · R$ ${Number(it.valor_total || it.valor_diaria || 0).toFixed(2)}`,
          colaboradorNome: colabNome,
          natureza: "RH_PONTO",
          naturezaLabel: NATUREZA_LABELS.RH_PONTO,
          tituloHumano: "Apontamento de diarista devolvido pelo RH",
          oqueEstaErrado,
          impactoNoFluxo: "Trava a consolidação do lote semanal de diaristas.",
          responsavel: "ENCARREGADO",
          responsavelLabel: RESPONSAVEL_LABELS.ENCARREGADO,
          detectadoEm: createdAt,
          bloqueante: true,
          moduloDestino: "Diaristas",
          rotaDestino: DOMINIO_ROTAS_OFICIAIS.DIARISTA,
          ctaLabel: "Abrir em Diaristas",
          statusOrigem: it.status || "DEVOLVIDO",
          detalhesDrawer: {
            oqueAconteceu: oqueEstaErrado,
            porqueFluxoParou: "Divergências na presença ou duplicidade de diárias impedem o fechamento do lote.",
            impacto: "O lote semanal de diaristas fica travado para validação do RH.",
            oquePrecisaSerFeito: "Ajustar o apontamento de presença na grade semanal de Diaristas.",
            responsavel: RESPONSAVEL_LABELS.ENCARREGADO,
            ondeCorrigir: "Operacional → Diaristas",
            depoisDaCorrecao: "Após a correção, o lote poderá ser revalidado para prosseguimento do fluxo.",
            rastreabilidade: {
              origem: "Módulo Diaristas",
              detectadoPor: "Conferência RH de Diaristas",
              detectadoEm: createdAt,
              motivoDevolucao,
            },
          },
          rawReference: it,
        };
      });
    } catch (err) {
      console.error("[InconsistenciasTransversais] Erro ao carregar Diaristas:", err);
      return [];
    }
  }

  // 5. INTERMITENTES
  private async fetchIntermitentes(empresaId?: string): Promise<ItemInconsistenciaNormalizado[]> {
    try {
      let query = supabase
        .from("lancamentos_intermitentes")
        .select(`
          id, data_referencia, empresa_id, colaborador_id, nome_colaborador, cpf_colaborador,
          total, status_pipeline, observacoes, created_at,
          empresas(id, nome, nome_fantasia, razao_social)
        `)
        .or("status_pipeline.eq.DEVOLVIDO,colaborador_id.is.null,empresa_id.is.null");

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];

      return data.map((it: any) => {
        const codigo = `INT-${String(it.id).substring(0, 6).toUpperCase()}`;
        const empresaNome = it.empresas?.nome_fantasia || it.empresas?.nome || it.empresas?.razao_social || "Sem empresa associada";
        const createdAt = it.created_at || new Date().toISOString();
        const colabNome = it.nome_colaborador || "Trabalhador Intermitente";

        let tituloHumano = "Lançamento intermitente com inconsistência";
        let oqueEstaErrado = "Lançamento requer conferência no módulo de origem.";
        let natureza: NaturezaInconsistencia = "CADASTRAL_VINCULO";
        let responsavel: ResponsavelInconsistencia = "RH";
        let rotaDestino = DOMINIO_ROTAS_OFICIAIS.INTERMITENTE;
        let ctaLabel = "Abrir em Intermitentes";
        let motivoDevolucao: string | undefined = undefined;

        if (it.status_pipeline === "DEVOLVIDO") {
          motivoDevolucao = it.observacoes || undefined;
          tituloHumano = "Lançamento intermitente devolvido pelo RH";
          oqueEstaErrado = motivoDevolucao
            ? `Devolvido pelo RH: ${motivoDevolucao}`
            : "Lançamento intermitente devolvido pelo RH para correção.";
          natureza = "OPERACIONAL";
          responsavel = "RH";
          rotaDestino = DOMINIO_ROTAS_OFICIAIS.INTERMITENTE;
          ctaLabel = "Abrir em Intermitentes";
        } else if (!it.colaborador_id) {
          tituloHumano = "Colaborador não vinculado (órfão cadastral)";
          oqueEstaErrado = `Colaborador não vinculado: ${it.nome_colaborador || "Sem nome"} (${it.cpf_colaborador || "Sem CPF"})`;
          natureza = "CADASTRAL_VINCULO";
          responsavel = "RH";
          rotaDestino = "/cadastros";
          ctaLabel = "Completar Cadastro";
        } else if (!it.empresa_id) {
          tituloHumano = "Empresa não associada ao lançamento";
          oqueEstaErrado = "O lançamento não possui empresa ou centro de custo associado.";
          natureza = "CADASTRAL_VINCULO";
          responsavel = "ADMIN";
          rotaDestino = "/cadastros";
          ctaLabel = "Completar Cadastro";
        }

        return {
          id: it.id,
          codigo,
          dominio: "INTERMITENTE",
          dominioLabel: DOMINIO_LABELS.INTERMITENTE,
          empresaId: it.empresa_id || "",
          empresaNome,
          unidadeNome: "Departamento Operacional",
          referencia: `Intermitente: ${colabNome} · R$ ${Number(it.total || 0).toFixed(2)}`,
          colaboradorNome: colabNome,
          natureza,
          naturezaLabel: NATUREZA_LABELS[natureza],
          tituloHumano,
          oqueEstaErrado,
          impactoNoFluxo: "Trava o fechamento do lote quinzenal e o repasse financeiro.",
          responsavel,
          responsavelLabel: RESPONSAVEL_LABELS[responsavel],
          detectadoEm: createdAt,
          bloqueante: true,
          moduloDestino: rotaDestino === "/cadastros" ? "Central de Cadastros" : "Intermitentes",
          rotaDestino,
          ctaLabel,
          statusOrigem: it.status_pipeline || "PENDENTE",
          detalhesDrawer: {
            oqueAconteceu: oqueEstaErrado,
            porqueFluxoParou: "Lançamentos sem vínculo cadastral ou devolvidos pelo RH não podem gerar folha nem remessa.",
            impacto: "O fechamento do período de intermitentes fica bloqueado.",
            oquePrecisaSerFeito: rotaDestino === "/cadastros"
              ? "Completar o cadastro ou vínculo na Central de Cadastros."
              : "Revisar as horas e valores do lançamento em Intermitentes.",
            responsavel: RESPONSAVEL_LABELS[responsavel],
            ondeCorrigir: rotaDestino === "/cadastros" ? "Central de Cadastros" : "Operacional → Intermitentes",
            depoisDaCorrecao: "Após o saneamento, o lançamento poderá ser incorporado ao fechamento do período.",
            rastreabilidade: {
              origem: "Módulo Intermitentes",
              detectadoPor: "Validação Cadastral & RH",
              detectadoEm: createdAt,
              motivoDevolucao,
            },
          },
          rawReference: it,
        };
      });
    } catch (err) {
      console.error("[InconsistenciasTransversais] Erro ao carregar Intermitentes:", err);
      return [];
    }
  }

  // 6. PONTO CLT
  private async fetchPontoClt(empresaId?: string): Promise<ItemInconsistenciaNormalizado[]> {
    try {
      let query = supabase
        .from("registros_ponto")
        .select(`
          id, data, status_processamento, status_aprovacao, motivo_inconsistencia,
          created_at, colaborador_id, empresa_id,
          colaboradores(id, nome, cpf, empresas(id, nome))
        `)
        .in("status_processamento", ["INCONSISTENTE", "inconsistente", "ERRO"])
        .limit(50);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];

      return data.map((it: any) => {
        const codigo = `PNT-${String(it.id).substring(0, 6).toUpperCase()}`;
        const empresaNome = (it.colaboradores as any)?.empresas?.nome || "Empresa não informada";
        const colabNome = (it.colaboradores as any)?.nome || "Colaborador CLT";
        const createdAt = it.created_at || new Date().toISOString();
        const oqueEstaErrado = it.motivo_inconsistencia || "Marcação de ponto com divergência apurada pelo motor de jornada.";

        return {
          id: it.id,
          codigo,
          dominio: "PONTO_CLT",
          dominioLabel: DOMINIO_LABELS.PONTO_CLT,
          empresaId: it.empresa_id || (it.colaboradores as any)?.empresas?.id || "",
          empresaNome,
          unidadeNome: "Unidade CLT",
          referencia: `Ponto: ${colabNome} · Data: ${it.data || "—"}`,
          colaboradorNome: colabNome,
          natureza: "RH_PONTO",
          naturezaLabel: NATUREZA_LABELS.RH_PONTO,
          tituloHumano: "Inconsistência na apuração do ponto",
          oqueEstaErrado,
          impactoNoFluxo: "Trava a apuração de saldo de horas e fechamento do espelho de ponto.",
          responsavel: "RH",
          responsavelLabel: RESPONSAVEL_LABELS.RH,
          detectadoEm: createdAt,
          bloqueante: true,
          moduloDestino: "Ponto CLT",
          rotaDestino: DOMINIO_ROTAS_OFICIAIS.PONTO_CLT,
          ctaLabel: "Abrir em Ponto CLT",
          statusOrigem: it.status_processamento || "INCONSISTENTE",
          detalhesDrawer: {
            oqueAconteceu: oqueEstaErrado,
            porqueFluxoParou: "O motor de apuração bloqueia batidas incompletas ou com erro de consistência para evitar passivos.",
            impacto: "O colaborador não pode ter o espelho de ponto fechado.",
            oquePrecisaSerFeito: "Regularizar a marcação no espelho de ponto do RH.",
            responsavel: RESPONSAVEL_LABELS.RH,
            ondeCorrigir: "RH → Ponto CLT",
            depoisDaCorrecao: "Após a regularização auditada, o ponto poderá ser reprocessado pelo Motor RH.",
            rastreabilidade: {
              origem: "Motor de Apuração de Ponto",
              detectadoPor: "Validador de Jornada CLT",
              detectadoEm: createdAt,
            },
          },
          rawReference: it,
        };
      });
    } catch (err) {
      console.error("[InconsistenciasTransversais] Erro ao carregar Ponto CLT:", err);
      return [];
    }
  }
}

export const InconsistenciasTransversaisService = new InconsistenciasTransversaisServiceClass();
