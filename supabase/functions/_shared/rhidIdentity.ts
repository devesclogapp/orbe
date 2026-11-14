import {
  buildCanonicalPontoKey,
  type PontoIngestionRecord,
} from './pontoIntegrity.ts';

export type Sha256Fn = (message: string) => Promise<string>;

export interface RhidColaboradorLookup {
  id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  empresa_id: string | null;
  tenant_id: string;
}

export interface RhidRawItem {
  data?: string | null;
  pessoa_nome?: string | null;
  pessoa_matricula?: string | number | null;
  cpf?: string | number | null;
  pessoa_cpf?: string | number | null;
  empresa_nome?: string | null;
  empresa?: string | null;
  entrada?: string | null;
  saida_almoco?: string | null;
  retorno_almoco?: string | null;
  saida?: string | null;
  jornada_id?: string | null;
  turno?: string | null;
  sequencia?: string | null;
  escala?: string | null;
  horas_trabalhadas?: string | null;
  horas?: string | null;
  hora_extra?: string | null;
  extras?: string | null;
  falta?: string | null;
  atraso?: string | null;
  observacoes?: string | null;
  is_teste?: boolean | null;
  [key: string]: unknown;
}

export type ItemEstadoFinal =
  | 'inserido'
  | 'atualizado'
  | 'duplicado'
  | 'mesclado'
  | 'conflito'
  | 'inconsistente'
  | 'ignorado'
  | 'bloqueado';

export interface ItemOutcome {
  index: number;
  estado: ItemEstadoFinal;
  motivo?: string;
  merged_into_key?: string;
  chave_importacao?: string;
  matched_colab_id?: string | null;
  matched_by?: string | null;
  item_ref?: RhidRawItem;
}

export interface ConflitoDetalhado {
  index: number;
  item: RhidRawItem;
  tipo: string;
  descricao: string;
}

export interface MescladoDetalhado {
  index: number;
  item: RhidRawItem;
  chave_destino: string;
}

export interface ReconciliacaoContagem {
  inserido: number;
  atualizado: number;
  duplicado: number;
  mesclado: number;
  conflito: number;
  inconsistente: number;
  ignorado: number;
  bloqueado: number;
}

export interface NovoColaboradorPayload {
  id: string; // ID canônico pré-gerado (crypto.randomUUID) para vínculo determinístico
  temp_key: string; // Chave de identidade temporária para correlação rápida
  tenant_id: string;
  empresa_id: string | null;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  tipo_colaborador: 'clt';
  regime_trabalho: 'CLT';
  modelo_calculo: 'CLT_MENSAL';
  tipo_contrato: 'mensal';
  status: 'pendente';
  status_cadastro: 'pendente_complemento';
  origem: 'api';
  origem_cadastro: 'ponto_importado';
  origem_detalhe: string;
  cadastro_provisorio: true;
  permitir_lancamento_operacional: false;
}

export interface ProcessedRhidBatch {
  itemsCount: number;
  somaEstados: number;
  divergenciaDetectada: boolean;
  contagemPorEstado: ReconciliacaoContagem;
  itemOutcomes: ItemOutcome[];
  conflitosDetalhados: ConflitoDetalhado[];
  mescladosDetalhados: MescladoDetalhado[];
  registrosParaSalvar: PontoIngestionRecord[];
  novosColaboradoresParaCriar: NovoColaboradorPayload[];
  empresasQueSeriamCriadas: string[];
}

export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export function parseCpfInput(value: unknown): {
  hasInput: boolean;
  isValid: boolean;
  cleaned: string | null;
  raw: string;
} {
  if (value === null || value === undefined) {
    return { hasInput: false, isValid: false, cleaned: null, raw: '' };
  }
  const rawStr = String(value).trim();
  if (!rawStr) {
    return { hasInput: false, isValid: false, cleaned: null, raw: '' };
  }
  const digits = rawStr.replace(/\D/g, '');
  if (digits.length === 11) {
    return { hasInput: true, isValid: true, cleaned: digits, raw: rawStr };
  }
  return { hasInput: true, isValid: false, cleaned: null, raw: rawStr };
}

export function cleanMatricula(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === '0' || str === '00' || str === '000' || str === '-') return null;
  return str;
}

export interface RhidIdentityMaps {
  cpfMap: Map<string, RhidColaboradorLookup[]>;
  matMap: Map<string, RhidColaboradorLookup[]>;
  nomeMap: Map<string, RhidColaboradorLookup[]>;
}

export function buildRhidIdentityMaps(colaboradores: RhidColaboradorLookup[]): RhidIdentityMaps {
  const cpfMap = new Map<string, RhidColaboradorLookup[]>();
  const matMap = new Map<string, RhidColaboradorLookup[]>();
  const nomeMap = new Map<string, RhidColaboradorLookup[]>();

  for (const c of colaboradores) {
    const cpfParsed = parseCpfInput(c.cpf);
    if (cpfParsed.isValid && cpfParsed.cleaned) {
      const list = cpfMap.get(cpfParsed.cleaned) || [];
      list.push(c);
      cpfMap.set(cpfParsed.cleaned, list);
    }
    const matClean = cleanMatricula(c.matricula);
    if (matClean) {
      const list = matMap.get(matClean) || [];
      list.push(c);
      matMap.set(matClean, list);
    }
    if (c.nome) {
      const nKey = normalizeText(c.nome);
      const list = nomeMap.get(nKey) || [];
      list.push(c);
      nomeMap.set(nKey, list);
    }
  }

  return { cpfMap, matMap, nomeMap };
}

export function generateCanonicalUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback seguro em ambientes sem crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function processRhidItems(params: {
  tenantId: string;
  items: RhidRawItem[];
  identityMaps: RhidIdentityMaps;
  resolveEmpresaId: (rawName: string) => Promise<string | null>;
  sha256Hex: Sha256Fn;
  schemaVersion?: number;
  importacaoId?: string | null;
  dryRun?: boolean;
}): Promise<ProcessedRhidBatch> {
  const {
    tenantId,
    items,
    identityMaps,
    resolveEmpresaId,
    sha256Hex,
    schemaVersion = 1,
    importacaoId = null,
    dryRun = false,
  } = params;

  const { cpfMap, matMap, nomeMap } = identityMaps;

  const itemOutcomes: ItemOutcome[] = [];
  const conflitosDetalhados: ConflitoDetalhado[] = [];
  const mescladosDetalhados: MescladoDetalhado[] = [];
  const novosColaboradoresParaCriar: NovoColaboradorPayload[] = [];
  const empresasQueSeriamCriadasSet = new Set<string>();

  const registrosMap = new Map<string, { record: PontoIngestionRecord; firstItemIndex: number }>();
  const logicalKeyMap = new Map<string, string>(); // logicalKey -> chaveImportacao

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 1. Validação mínima de Payload
    if (!item.data || !item.pessoa_nome) {
      itemOutcomes.push({
        index: i,
        estado: 'ignorado',
        motivo: 'Item sem data ou nome de colaborador',
        matched_colab_id: null,
        matched_by: null,
        item_ref: item,
      });
      continue;
    }

    // 2. Resolução da Empresa (Lookup em cache na fase pré-escrita)
    const rawCmpName = item.empresa_nome || item.empresa || 'Empresa Desconhecida API';
    const matchedEmpresaId = await resolveEmpresaId(rawCmpName);
    if (!matchedEmpresaId) {
      empresasQueSeriamCriadasSet.add(rawCmpName);
    }

    // 3. Análise Estrita do CPF
    const cpfAnalysis = parseCpfInput(item.cpf ?? item.pessoa_cpf);
    const itemMat = cleanMatricula(item.pessoa_matricula);
    const itemNomeKey = normalizeText(item.pessoa_nome);

    // REGRA 3: Se CPF foi informado mas é inválido (diferente de 11 dígitos),
    // classificar como inconsistente e NUNCA realizar fallback por matrícula ou nome!
    if (cpfAnalysis.hasInput && !cpfAnalysis.isValid) {
      const msg = `CPF informado inválido (${cpfAnalysis.raw}): deve conter exatamente 11 dígitos. Fallback para matrícula ou nome bloqueado por segurança.`;
      itemOutcomes.push({
        index: i,
        estado: 'inconsistente',
        motivo: msg,
        matched_colab_id: null,
        matched_by: null,
        item_ref: item,
      });
      continue;
    }

    let matchedColab: RhidColaboradorLookup | null = null;
    let matchedBy: string | null = null;
    let isAmbiguo = false;
    let ambiguidadeMotivo = '';

    if (cpfAnalysis.isValid && cpfAnalysis.cleaned) {
      // REGRA P0: Se CPF válido foi informado, buscar EXCLUSIVAMENTE pelo CPF.
      // Nunca associar por matrícula ou nome se o CPF foi fornecido!
      const candidates = cpfMap.get(cpfAnalysis.cleaned) || [];
      if (candidates.length === 1) {
        matchedColab = candidates[0];
        matchedBy = 'cpf';
      } else if (candidates.length > 1) {
        isAmbiguo = true;
        ambiguidadeMotivo = `CPF ambíguo: existem ${candidates.length} colaboradores com o mesmo CPF no tenant.`;
      }
    } else if (itemMat) {
      // Fallback por matrícula (apenas quando não há CPF no item)
      const candidates = matMap.get(itemMat) || [];
      if (candidates.length === 1) {
        matchedColab = candidates[0];
        matchedBy = 'matricula';
      } else if (candidates.length > 1) {
        isAmbiguo = true;
        ambiguidadeMotivo = `Matrícula ambígua: existem ${candidates.length} colaboradores com a mesma matrícula no tenant.`;
      }
    } else if (itemNomeKey) {
      // Fallback por nome (apenas quando não há CPF nem Matrícula no item)
      const candidates = nomeMap.get(itemNomeKey) || [];
      if (candidates.length === 1) {
        matchedColab = candidates[0];
        matchedBy = 'nome';
      } else if (candidates.length > 1) {
        isAmbiguo = true;
        ambiguidadeMotivo = `Nome ambíguo: existem ${candidates.length} colaboradores com o mesmo nome no tenant.`;
      }
    }

    // Se houver ambiguidade no tenant, registrar conflito e NÃO associar nem criar
    if (isAmbiguo) {
      conflitosDetalhados.push({
        index: i,
        item,
        tipo: 'AMBIGUIDADE_CADASTRO',
        descricao: ambiguidadeMotivo,
      });
      itemOutcomes.push({
        index: i,
        estado: 'conflito',
        motivo: ambiguidadeMotivo,
        matched_colab_id: null,
        matched_by: null,
        item_ref: item,
      });
      continue;
    }

    // 4. Self-Healing Seguro com ID Pré-Gerado Canônico
    if (!matchedColab) {
      if (cpfAnalysis.isValid && cpfAnalysis.cleaned) {
        // Verificar se a matrícula do item (se fornecida) conflita com outro colaborador existente
        let conflitaMatricula = false;
        if (itemMat && matMap.has(itemMat)) {
          conflitaMatricula = true;
        }

        if (conflitaMatricula) {
          const msg = `Conflito de identidade: CPF novo, porém matrícula (${itemMat}) já pertence a outro colaborador no tenant.`;
          conflitosDetalhados.push({
            index: i,
            item,
            tipo: 'CONFLITO_IDENTIDADE_MATRICULA',
            descricao: msg,
          });
          itemOutcomes.push({
            index: i,
            estado: 'conflito',
            motivo: msg,
            matched_colab_id: null,
            matched_by: null,
            item_ref: item,
          });
          continue;
        }

        // Pré-gerar UUID canônico imutável para vincular o colaborador ao ponto com precisão absoluta
        const pregeneratedId = generateCanonicalUuid();
        const tempKey = `CPF_${cpfAnalysis.cleaned}`;

        const newColPayload: NovoColaboradorPayload = {
          id: pregeneratedId,
          temp_key: tempKey,
          tenant_id: tenantId,
          empresa_id: matchedEmpresaId || null,
          nome: item.pessoa_nome.trim(),
          cpf: cpfAnalysis.cleaned,
          matricula: itemMat || null,
          tipo_colaborador: 'clt',
          regime_trabalho: 'CLT',
          modelo_calculo: 'CLT_MENSAL',
          tipo_contrato: 'mensal',
          status: 'pendente',
          status_cadastro: 'pendente_complemento',
          origem: 'api',
          origem_cadastro: 'ponto_importado',
          origem_detalhe: `Self-healing via Payload schema_version=${schemaVersion}${dryRun ? ' (DRY_RUN)' : ''}`,
          cadastro_provisorio: true,
          permitir_lancamento_operacional: false,
        };

        novosColaboradoresParaCriar.push(newColPayload);

        const newColLookup: RhidColaboradorLookup = {
          id: pregeneratedId,
          nome: item.pessoa_nome.trim(),
          matricula: itemMat || null,
          cpf: cpfAnalysis.cleaned,
          empresa_id: matchedEmpresaId || null,
          tenant_id: tenantId,
        };

        matchedColab = newColLookup;
        matchedBy = 'self_healing';

        // Atualizar mapas em memória para que os próximos itens do mesmo lote encontrem este colaborador
        cpfMap.set(cpfAnalysis.cleaned, [newColLookup]);
        if (itemMat) matMap.set(itemMat, [newColLookup]);
        const list = nomeMap.get(itemNomeKey) || [];
        list.push(newColLookup);
        nomeMap.set(itemNomeKey, list);
      } else if (itemMat) {
        // Self-healing com matrícula (sem CPF no item)
        const pregeneratedId = generateCanonicalUuid();
        const tempKey = `MAT_${itemMat}`;

        const newColPayload: NovoColaboradorPayload = {
          id: pregeneratedId,
          temp_key: tempKey,
          tenant_id: tenantId,
          empresa_id: matchedEmpresaId || null,
          nome: item.pessoa_nome.trim(),
          cpf: null,
          matricula: itemMat,
          tipo_colaborador: 'clt',
          regime_trabalho: 'CLT',
          modelo_calculo: 'CLT_MENSAL',
          tipo_contrato: 'mensal',
          status: 'pendente',
          status_cadastro: 'pendente_complemento',
          origem: 'api',
          origem_cadastro: 'ponto_importado',
          origem_detalhe: `Self-healing via Payload schema_version=${schemaVersion}${dryRun ? ' (DRY_RUN)' : ''}`,
          cadastro_provisorio: true,
          permitir_lancamento_operacional: false,
        };

        novosColaboradoresParaCriar.push(newColPayload);

        const newColLookup: RhidColaboradorLookup = {
          id: pregeneratedId,
          nome: item.pessoa_nome.trim(),
          matricula: itemMat,
          cpf: null,
          empresa_id: matchedEmpresaId || null,
          tenant_id: tenantId,
        };

        matchedColab = newColLookup;
        matchedBy = 'self_healing';

        matMap.set(itemMat, [newColLookup]);
        const list = nomeMap.get(itemNomeKey) || [];
        list.push(newColLookup);
        nomeMap.set(itemNomeKey, list);
      } else {
        itemOutcomes.push({
          index: i,
          estado: 'inconsistente',
          motivo: 'Registro sem identificador forte (CPF válido ou matrícula válida) recusou auto-cadastro.',
          matched_colab_id: null,
          matched_by: null,
          item_ref: item,
        });
        continue;
      }
    }

    // 5. Construção da Chave Canônica Determinística
    const jornadaDiscriminator = item.jornada_id || item.turno || item.sequencia || item.escala || null;
    const chaveImportacao = await buildCanonicalPontoKey({
      tenantId,
      empresaId: matchedEmpresaId,
      colaboradorId: matchedColab ? matchedColab.id : null,
      cpf: cpfAnalysis.cleaned,
      matricula: itemMat,
      nome: item.pessoa_nome,
      data: item.data,
      jornadaDiscriminator,
    }, sha256Hex);

    // 6. Detecção de Chave Divergente no Mesmo Lote
    const logicalKeyInBatch = matchedColab
      ? `${matchedEmpresaId ?? 'null'}_${matchedColab.id}_${item.data}_${jornadaDiscriminator ?? 'DEFAULT'}`
      : null;

    if (logicalKeyInBatch) {
      const existingKeyForColabData = logicalKeyMap.get(logicalKeyInBatch);
      if (existingKeyForColabData && existingKeyForColabData !== chaveImportacao) {
        const msg = `Conflito no lote: colaborador ${matchedColab.id} na data ${item.data} possui chaves de importação divergentes.`;
        conflitosDetalhados.push({
          index: i,
          item,
          tipo: 'CONFLITO_CHAVE_COLABORADOR_DATA',
          descricao: msg,
        });
        itemOutcomes.push({
          index: i,
          estado: 'conflito',
          motivo: msg,
          matched_colab_id: matchedColab?.id ?? null,
          matched_by: matchedBy,
          item_ref: item,
        });
        continue;
      }
      logicalKeyMap.set(logicalKeyInBatch, chaveImportacao);
    }

    const pointBase: PontoIngestionRecord = {
      tenant_id: tenantId,
      importacao_id: importacaoId,
      chave_importacao: chaveImportacao,
      data: item.data,
      competencia: item.data ? item.data.slice(0, 7) : null,
      entrada: item.entrada ?? null,
      saida_almoco: item.saida_almoco ?? null,
      retorno_almoco: item.retorno_almoco ?? null,
      saida: item.saida ?? null,
      origem: 'api',
      status: matchedColab ? 'Pendente' : 'Inconsistente',
      status_processamento: matchedColab ? 'PENDENTE_PROCESSAMENTO' : 'INCONSISTENTE',
      nome_colaborador: item.pessoa_nome,
      matricula_colaborador: itemMat,
      cpf_colaborador: cpfAnalysis.cleaned,
      empresa_nome: rawCmpName,
      empresa_id: matchedEmpresaId,
      colaborador_id: matchedColab ? matchedColab.id : null,
      horas_trabalhadas: item.horas_trabalhadas || item.horas || null,
      hora_extra: item.hora_extra || item.extras || null,
      falta: item.falta || null,
      atraso: item.atraso || null,
      observacoes: item.observacoes || JSON.stringify({
        matched_by: matchedBy,
        schema: schemaVersion,
        ...(importacaoId ? { importacao_id: importacaoId } : {}),
        ...(jornadaDiscriminator ? { jornada_discriminator: jornadaDiscriminator } : {})
      }),
      inconsistencias: matchedColab ? null : 'Registro recusou Self-Healing por falta de identificador forte.',
      jornada_discriminator: jornadaDiscriminator,
      ...(typeof item.is_teste === 'boolean' ? { is_teste: item.is_teste } : {}),
    };

    const existingBatchEntry = registrosMap.get(chaveImportacao);
    if (existingBatchEntry) {
      // Mesclagem com marcação prévia do mesmo colaborador na mesma data
      const existingRecord = existingBatchEntry.record;
      const mergedPoint: PontoIngestionRecord = {
        ...existingRecord,
        ...pointBase,
        entrada: pointBase.entrada || existingRecord.entrada,
        saida_almoco: pointBase.saida_almoco || existingRecord.saida_almoco,
        retorno_almoco: pointBase.retorno_almoco || existingRecord.retorno_almoco,
        saida: pointBase.saida || existingRecord.saida,
      };
      registrosMap.set(chaveImportacao, {
        record: mergedPoint,
        firstItemIndex: existingBatchEntry.firstItemIndex,
      });

      mescladosDetalhados.push({
        index: i,
        item,
        chave_destino: chaveImportacao,
      });

      itemOutcomes.push({
        index: i,
        estado: 'mesclado',
        merged_into_key: chaveImportacao,
        chave_importacao: chaveImportacao,
        matched_colab_id: matchedColab?.id ?? null,
        matched_by: matchedBy,
        motivo: `Mesclado ao item de índice ${existingBatchEntry.firstItemIndex} pela chave de importação.`,
        item_ref: item,
      });
    } else {
      registrosMap.set(chaveImportacao, { record: pointBase, firstItemIndex: i });
      itemOutcomes.push({
        index: i,
        estado: 'inserido', // estado provisório; ajustado após ingestão/dryRun
        chave_importacao: chaveImportacao,
        matched_colab_id: matchedColab?.id ?? null,
        matched_by: matchedBy,
        item_ref: item,
      });
    }
  }

  // Consolidação das Contagens Iniciais
  const contagemPorEstado: ReconciliacaoContagem = {
    inserido: 0,
    atualizado: 0,
    duplicado: 0,
    mesclado: 0,
    conflito: 0,
    inconsistente: 0,
    ignorado: 0,
    bloqueado: 0,
  };

  for (const outcome of itemOutcomes) {
    contagemPorEstado[outcome.estado]++;
  }

  const somaEstados = Object.values(contagemPorEstado).reduce((a, b) => a + b, 0);
  const divergenciaDetectada = somaEstados !== items.length;

  return {
    itemsCount: items.length,
    somaEstados,
    divergenciaDetectada,
    contagemPorEstado,
    itemOutcomes,
    conflitosDetalhados,
    mescladosDetalhados,
    registrosParaSalvar: Array.from(registrosMap.values()).map((v) => v.record),
    novosColaboradoresParaCriar,
    empresasQueSeriamCriadas: Array.from(empresasQueSeriamCriadasSet),
  };
}

/**
 * Trata falha na criação de colaboradores provisórios (Fail-Safe):
 * Se a inserção de um colaborador provisório falhar no banco, nenhum ponto dele pode ser gravado.
 * Os registros_ponto vinculados são descartados da lista de gravação e os itemOutcomes
 * correspondentes são marcados como 'inconsistente'.
 */
export function tratarFalhaCriacaoColaborador(params: {
  failedColabId: string;
  motivoErro: string;
  registrosParaSalvar: PontoIngestionRecord[];
  itemOutcomes: ItemOutcome[];
}): {
  registrosRestantes: PontoIngestionRecord[];
  contagemAtualizada: ReconciliacaoContagem;
} {
  const { failedColabId, motivoErro, registrosParaSalvar, itemOutcomes } = params;

  // 1. Remover registros do colaborador que falhou da lista que iria para o banco
  const registrosRestantes = registrosParaSalvar.filter((r) => r.colaborador_id !== failedColabId);

  // 2. Atualizar os itemOutcomes afetados para 'inconsistente'
  for (const outcome of itemOutcomes) {
    if (outcome.matched_colab_id === failedColabId) {
      outcome.estado = 'inconsistente';
      outcome.motivo = `Falha na autocriação do colaborador: ${motivoErro}. Registro de ponto descartado para preservar integridade.`;
      outcome.matched_colab_id = null;
    }
  }

  // 3. Recalcular contagem
  const contagemAtualizada: ReconciliacaoContagem = {
    inserido: 0,
    atualizado: 0,
    duplicado: 0,
    mesclado: 0,
    conflito: 0,
    inconsistente: 0,
    ignorado: 0,
    bloqueado: 0,
  };

  for (const outcome of itemOutcomes) {
    contagemAtualizada[outcome.estado]++;
  }

  return {
    registrosRestantes,
    contagemAtualizada,
  };
}

export function reconciliarContagensAposIngestao(params: {
  itemOutcomes: ItemOutcome[];
  registrosParaSalvar: PontoIngestionRecord[];
  ingestionResult: {
    inseridos: number;
    atualizados: number;
    ignorados_duplicados: number;
    correcoes_pendentes: Array<{ tipo: string; chave_importacao: string }>;
    bloqueados_fechamento: number;
  };
}): {
  contagemFinal: ReconciliacaoContagem;
  somaFinal: number;
  divergenciaDetectada: boolean;
} {
  const { itemOutcomes, registrosParaSalvar, ingestionResult } = params;

  const chaveToIngestStatus = new Map<string, 'inserido' | 'atualizado' | 'duplicado' | 'bloqueado' | 'conflito'>();

  for (const corr of ingestionResult.correcoes_pendentes) {
    if (corr.tipo === 'COMPETENCIA_FECHADA' || corr.tipo === 'PONTO_POS_FECHAMENTO') {
      chaveToIngestStatus.set(corr.chave_importacao, 'bloqueado');
    } else {
      chaveToIngestStatus.set(corr.chave_importacao, 'conflito');
    }
  }

  let remainingInseridos = ingestionResult.inseridos;
  let remainingAtualizados = ingestionResult.atualizados;
  let remainingDuplicados = ingestionResult.ignorados_duplicados;

  for (const rec of registrosParaSalvar) {
    if (!chaveToIngestStatus.has(rec.chave_importacao)) {
      if (remainingInseridos > 0) {
        chaveToIngestStatus.set(rec.chave_importacao, 'inserido');
        remainingInseridos--;
      } else if (remainingAtualizados > 0) {
        chaveToIngestStatus.set(rec.chave_importacao, 'atualizado');
        remainingAtualizados--;
      } else if (remainingDuplicados > 0) {
        chaveToIngestStatus.set(rec.chave_importacao, 'duplicado');
        remainingDuplicados--;
      }
    }
  }

  // Atualizar outcomes dos itens primários que estavam como 'inserido' provisório
  for (const outcome of itemOutcomes) {
    if (outcome.estado === 'inserido' && outcome.chave_importacao) {
      const finalEst = chaveToIngestStatus.get(outcome.chave_importacao) || 'inserido';
      outcome.estado = finalEst;
    }
  }

  const contagemFinal: ReconciliacaoContagem = {
    inserido: 0,
    atualizado: 0,
    duplicado: 0,
    mesclado: 0,
    conflito: 0,
    inconsistente: 0,
    ignorado: 0,
    bloqueado: 0,
  };

  for (const outcome of itemOutcomes) {
    contagemFinal[outcome.estado]++;
  }

  const somaFinal = Object.values(contagemFinal).reduce((a, b) => a + b, 0);
  const divergenciaDetectada = somaFinal !== itemOutcomes.length;

  return {
    contagemFinal,
    somaFinal,
    divergenciaDetectada,
  };
}

/**
 * REQUISITO 1 (FIX-RHID-IDENTIDADE-01):
 * Aplica o empresa_id das empresas recém-criadas aos registros_ponto e colaboradores provisórios,
 * recalculando deterministicamente a chave canônica (buildCanonicalPontoKey) e atualizando
 * as chaves correspondentes nos itemOutcomes (chave_importacao e merged_into_key).
 */
export async function aplicarEmpresasCriadas(params: {
  tenantId: string;
  empresasCriadasMap: Map<string, string>; // nome normalizado/raw -> createdEmpresaId
  registrosParaSalvar: PontoIngestionRecord[];
  novosColaboradoresParaCriar: NovoColaboradorPayload[];
  itemOutcomes: ItemOutcome[];
  sha256Hex: Sha256Fn;
}): Promise<void> {
  const {
    tenantId,
    empresasCriadasMap,
    registrosParaSalvar,
    novosColaboradoresParaCriar,
    itemOutcomes,
    sha256Hex,
  } = params;

  if (empresasCriadasMap.size === 0) return;

  // Mapa de chave antiga para chave recalculada para atualizar itemOutcomes com precisão
  const keyMap = new Map<string, string>();

  // 1. Atualizar registrosParaSalvar e recalcular chave canônica
  for (const reg of registrosParaSalvar) {
    if (reg.empresa_nome && !reg.empresa_id && empresasCriadasMap.has(reg.empresa_nome)) {
      const createdId = empresasCriadasMap.get(reg.empresa_nome)!;
      const oldKey = reg.chave_importacao;
      reg.empresa_id = createdId;

      const newKey = await buildCanonicalPontoKey({
        tenantId,
        empresaId: createdId,
        colaboradorId: reg.colaborador_id,
        cpf: reg.cpf_colaborador ?? null,
        matricula: reg.matricula_colaborador ?? null,
        nome: reg.nome_colaborador,
        data: reg.data,
        jornadaDiscriminator: reg.jornada_discriminator,
      }, sha256Hex);

      reg.chave_importacao = newKey;
      if (oldKey) {
        keyMap.set(oldKey, newKey);
      }
    }
  }

  // 2. Atualizar empresa_id nos colaboradores provisórios correspondentes
  for (const col of novosColaboradoresParaCriar) {
    if (!col.empresa_id) {
      // Localiza se algum registro_ponto deste colaborador vinculou empresa criada
      const regDoColab = registrosParaSalvar.find((r) => r.colaborador_id === col.id && r.empresa_id);
      if (regDoColab?.empresa_id) {
        col.empresa_id = regDoColab.empresa_id;
      }
    }
  }

  // 3. Atualizar chave_importacao e merged_into_key no itemOutcomes (item_destinos)
  for (const outcome of itemOutcomes) {
    if (outcome.chave_importacao && keyMap.has(outcome.chave_importacao)) {
      outcome.chave_importacao = keyMap.get(outcome.chave_importacao)!;
    }
    if (outcome.merged_into_key && keyMap.has(outcome.merged_into_key)) {
      outcome.merged_into_key = keyMap.get(outcome.merged_into_key)!;
    }
  }
}
