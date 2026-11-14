export interface PontoIngestionRecord {
  tenant_id: string;
  importacao_id?: string | null;
  chave_importacao: string;
  data: string;
  competencia: string | null;
  entrada: string | null;
  saida_almoco: string | null;
  retorno_almoco: string | null;
  saida: string | null;
  origem: string;
  status: string;
  status_processamento: string;
  nome_colaborador: string;
  matricula_colaborador?: string | null;
  cpf_colaborador?: string | null;
  cargo_colaborador?: string | null;
  empresa_nome?: string | null;
  empresa_id: string | null;
  colaborador_id: string | null;
  horas_trabalhadas?: string | null;
  hora_extra?: string | null;
  falta?: string | null;
  atraso?: string | null;
  observacoes?: string | null;
  inconsistencias?: string | null;
  jornada_discriminator?: string | null;
  is_teste?: boolean | null;
  [key: string]: unknown;
}

export interface CorrecaoPendenteItem {
  tipo: 'CORRECAO_POS_PROCESSAMENTO' | 'COMPETENCIA_FECHADA' | 'PONTO_POS_FECHAMENTO';
  registro_ponto_id: string | null;
  colaborador_id: string | null;
  empresa_id: string | null;
  data: string;
  competencia: string;
  nome_colaborador: string;
  chave_importacao: string;
  anterior: {
    entrada: string | null;
    saida_almoco: string | null;
    retorno_almoco: string | null;
    saida: string | null;
    status_processamento: string | null;
  } | null;
  recebido: {
    entrada: string | null;
    saida_almoco: string | null;
    retorno_almoco: string | null;
    saida: string | null;
    origem: string;
  };
  descricao: string;
}

export interface PontoIngestionResult {
  inseridos: number;
  atualizados: number;
  ignorados_duplicados: number;
  correcoes_pendentes: CorrecaoPendenteItem[];
  bloqueados_fechamento: number;
}

export type Sha256Fn = (message: string) => Promise<string>;

const normalizeTextSimple = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeTimeComparable = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  // Normalizar HH:MM:SS vs HH:MM para comparação
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2];
    const s = match[3] || '00';
    return `${h}:${m}:${s}`;
  }
  return str;
};

/**
 * Validação de autenticação de entrada para Edge Functions de importação de pontos.
 * Suporta três vetores legítimos e seguros:
 * 1. Bearer JWT do operador autenticado (validado contra Supabase Auth).
 * 2. Token de serviço (service_role) fornecido no cabeçalho Authorization ou apikey.
 * 3. Segredo de webhook compartilhado (x-webhook-secret ou header Authorization) comparado contra a env PONTO_IMPORT_SECRET.
 *
 * Rejeita qualquer requisição que não comprove uma dessas credenciais (HTTP 401/403).
 */
export async function validatePontoIngestAuth(params: {
  req: Request;
  supabase: any;
  serviceRoleKey?: string;
  webhookSecretEnv?: string;
}): Promise<{
  authorized: boolean;
  authType: 'jwt' | 'service_role' | 'webhook_secret' | 'none';
  userId?: string;
  tenantId?: string;
  userRole?: string;
  errorResponse?: Response;
}> {
  const { req, supabase, serviceRoleKey, webhookSecretEnv } = params;

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('apikey') || req.headers.get('ApiKey') || '';
  const webhookSecretHeader = req.headers.get('x-webhook-secret') || req.headers.get('X-Webhook-Secret') || '';

  const configuredSecret = webhookSecretEnv || (typeof Deno !== 'undefined' ? Deno.env.get('PONTO_IMPORT_SECRET') : '');
  const configuredServiceKey = serviceRoleKey || (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : '');

  // 1. Verificação por segredo de webhook dedicado (n8n / coletor externo)
  if (configuredSecret && configuredSecret.length >= 16) {
    if (webhookSecretHeader && webhookSecretHeader === configuredSecret) {
      return { authorized: true, authType: 'webhook_secret' };
    }
    // Suportar também envio do segredo como Bearer Token quando x-webhook-secret não estiver presente
    if (authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === configuredSecret) {
      return { authorized: true, authType: 'webhook_secret' };
    }
  }

  // 2. Verificação por token service_role (chamadas server-to-server autorizadas do Supabase)
  if (configuredServiceKey && configuredServiceKey.length >= 20) {
    const cleanAuth = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (cleanAuth === configuredServiceKey || apiKeyHeader === configuredServiceKey) {
      return { authorized: true, authType: 'service_role' };
    }
  }

  // 3. Verificação por JWT de usuário autenticado (sessão do operador via frontend)
  if (authHeader.startsWith('Bearer ') && supabase?.auth?.getUser) {
    const token = authHeader.slice(7).trim();
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (!authErr && user?.id) {
        // Carregar o tenant oficial do perfil do operador para vincular a identidade
        let userTenantId: string | null = null;
        let userRole: string | null = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, role')
            .eq('user_id', user.id)
            .maybeSingle();
          userTenantId = profile?.tenant_id ?? null;
          userRole = profile?.role ?? null;
        } catch {
          // fallback se profiles falhar
        }

        return {
          authorized: true,
          authType: 'jwt',
          userId: user.id,
          tenantId: userTenantId ?? undefined,
          userRole: userRole ?? undefined,
        };
      }
    } catch {
      // Ignora erro e cai na rejeição 401
    }
  }

  // Nenhuma credencial válida comprovada: rejeição fail-closed
  const errorBody = JSON.stringify({
    error: 'Unauthorized',
    message: 'Acesso negado: requisição sem credencial válida de autenticação (JWT de operador, service_role ou webhook secret).',
  });

  return {
    authorized: false,
    authType: 'none',
    errorResponse: new Response(errorBody, {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }),
  };
}

export function hasPunchDifference(
  existing: Record<string, unknown>,
  incoming: PontoIngestionRecord,
): boolean {
  const fields: Array<keyof PontoIngestionRecord> = [
    'entrada',
    'saida_almoco',
    'retorno_almoco',
    'saida',
  ];
  for (const field of fields) {
    if (normalizeTimeComparable(existing[field as string]) !== normalizeTimeComparable(incoming[field])) {
      return true;
    }
  }
  return false;
}

/**
 * Constrói uma chave canônica determinística independente do meio de ingestão (RHiD, manual ou Drive):
 * - Usa `COLAB_<colaborador_id>` sempre que o colaborador estiver resolvido.
 * - Suporta jornada/turno legítimo distinto via `jornadaDiscriminator`.
 */
export async function buildCanonicalPontoKey(
  params: {
    tenantId: string;
    empresaId: string | null;
    colaboradorId: string | null;
    cpf: string | null;
    matricula: string | null;
    nome: string;
    data: string;
    jornadaDiscriminator?: string | null;
  },
  sha256Hex: Sha256Fn,
): Promise<string> {
  const cleanCpf = params.cpf ? String(params.cpf).replace(/\D/g, '') : '';
  const cleanMat = params.matricula ? String(params.matricula).trim() : '';

  let identityToken: string;
  if (params.colaboradorId) {
    identityToken = `COLAB_${params.colaboradorId}`;
  } else if (cleanCpf) {
    identityToken = `CPF_${cleanCpf}`;
  } else if (cleanMat) {
    identityToken = `MAT_${cleanMat}`;
  } else {
    identityToken = `NOME_${normalizeTextSimple(params.nome)}`;
  }

  const shiftToken = params.jornadaDiscriminator
    ? `_SHIFT_${normalizeTextSimple(String(params.jornadaDiscriminator))}`
    : '';

  const raw = `${params.tenantId}_${params.empresaId ?? 'null'}_${identityToken}_${params.data}${shiftToken}`;
  return await sha256Hex(raw);
}

export function buildLogicalPontoKey(params: {
  empresaId: string | null;
  colaboradorId: string | null;
  data: string;
  jornadaDiscriminator?: string | null;
}): string | null {
  if (!params.colaboradorId) return null;
  const shiftToken = params.jornadaDiscriminator
    ? normalizeTextSimple(String(params.jornadaDiscriminator))
    : 'DEFAULT';
  return `${params.empresaId ?? 'null'}_${params.colaboradorId}_${params.data}_${shiftToken}`;
}

export function isProcessedStatus(statusProcessamento: unknown, status?: unknown): boolean {
  const sp = String(statusProcessamento ?? '').trim().toUpperCase();
  if (sp === 'PROCESSADO' || sp === 'FECHADO') return true;
  const st = String(status ?? '').trim().toUpperCase();
  if (st === 'PROCESSADO' || st === 'FECHADO') return true;
  return false;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchExistingPontos(
  supabase: any,
  tenantId: string,
  dates: string[],
): Promise<Record<string, any>[]> {
  if (dates.length === 0) return [];
  const allRows: Record<string, any>[] = [];
  const dateChunks = chunkArray(dates, 100);

  for (const dateChunk of dateChunks) {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('registros_ponto')
        .select('id, tenant_id, empresa_id, colaborador_id, data, competencia, entrada, saida_almoco, retorno_almoco, saida, status, status_processamento, chave_importacao, observacoes')
        .eq('tenant_id', tenantId)
        .in('data', dateChunk)
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(`Falha ao consultar registros_ponto existentes: ${error.message}`);
      }
      const rows = data || [];
      allRows.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
  }

  return allRows;
}

async function fetchClosedEmpresaCompetencias(
  supabase: any,
  tenantId: string,
  competencias: string[],
): Promise<Set<string>> {
  const closed = new Set<string>();
  if (competencias.length === 0) return closed;

  // 1. Verificar rh_financeiro_lotes (lotes não cancelados travam a competência contra novas alterações operacionais)
  const { data: lotes, error: lotesError } = await supabase
    .from('rh_financeiro_lotes')
    .select('empresa_id, competencia, status')
    .eq('tenant_id', tenantId)
    .in('competencia', competencias);

  if (lotesError) {
    throw new Error(`Falha ao verificar lotes financeiros fechados: ${lotesError.message}`);
  }

  for (const lote of lotes || []) {
    const st = String(lote.status || '').toUpperCase();
    if (st && st !== 'CANCELADO' && st !== 'DEVOLVIDO_RH') {
      closed.add(`${lote.empresa_id ?? 'null'}_${lote.competencia}`);
    }
  }

  // 2. Verificar fechamento_mensal
  for (const comp of competencias) {
    const [anoStr, mesStr] = comp.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (!ano || !mes) continue;

    const { data: fechamentos, error: fechError } = await supabase
      .from('fechamento_mensal')
      .select('empresa_id, situacao')
      .eq('tenant_id', tenantId)
      .eq('ano', ano)
      .eq('mes', mes);

    if (fechError) {
      throw new Error(`Falha ao verificar fechamento_mensal: ${fechError.message}`);
    }

    for (const f of fechamentos || []) {
      const sit = String(f.situacao || '').toLowerCase();
      if (['fechado', 'concluido', 'aprovado'].includes(sit)) {
        closed.add(`${f.empresa_id ?? 'null'}_${comp}`);
      }
    }
  }

  return closed;
}

export async function isCompetenciaEmpresaFechada(
  supabase: any,
  tenantId: string,
  empresaId: string | null,
  competencia: string,
): Promise<boolean> {
  const set = await fetchClosedEmpresaCompetencias(supabase, tenantId, [competencia]);
  return set.has(`${empresaId ?? 'null'}_${competencia}`);
}

function extractShiftFromObservacoes(observacoes: unknown): string | null {
  if (!observacoes || typeof observacoes !== 'string') return null;
  try {
    const parsed = JSON.parse(observacoes);
    if (parsed && typeof parsed === 'object' && parsed.jornada_discriminator) {
      return String(parsed.jornada_discriminator);
    }
  } catch {
    // Texto simples
  }
  return null;
}

export const VALID_REGISTROS_PONTO_COLUMNS = new Set<string>([
  'id',
  'tenant_id',
  'empresa_id',
  'colaborador_id',
  'data',
  'competencia',
  'entrada',
  'saida_almoco',
  'retorno_almoco',
  'saida',
  'origem',
  'origem_dado',
  'status',
  'status_processamento',
  'nome_colaborador',
  'matricula_colaborador',
  'cpf_colaborador',
  'cargo_colaborador',
  'empresa_nome',
  'horas_trabalhadas',
  'hora_extra',
  'falta',
  'atraso',
  'observacoes',
  'inconsistencias',
  'inconsistencias_count',
  'is_teste',
  'chave_importacao',
  'periodo',
  'tipo_dia',
  'lote_id',
  'valor_dia',
  'cliente_id',
  'processado_em',
  'horas_calculadas',
  'saldo_dia',
  'valor_hora',
  'valor_extras',
  'jornada_calculada',
  'valor_hora_extra',
  'valor_atraso',
  'valor_falta',
  'minutos_atraso',
  'minutos_extra',
  'horas_extras_detalhadas',
  'saldo_acumulado_minutos',
  'ciclo_id',
  'semana_operacional',
  'regra_aplicada',
]);

export function sanitizeDbPayload(record: PontoIngestionRecord): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    // Descarta explicitamente campos de controle em memória
    if (key === 'importacao_id' || key === 'jornada_discriminator') continue;
    // Garante que apenas colunas válidas no schema de registros_ponto sejam enviadas
    if (VALID_REGISTROS_PONTO_COLUMNS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Ingestão controlada e atômica de pontos CLT:
 * - Evita duplicidades entre RHiD, manual e Google Drive.
 * - Bloqueia mutação silenciosa de pontos já processados ou competências fechadas.
 * - Aplica guarda otimista de status e competência no UPDATE com fallback explícito para inconsistência.
 * - Não usa ON CONFLICT com índice parcial (compatível com o PostgreSQL).
 */
export async function ingestPontosBatch(params: {
  supabase: any;
  tenantId: string;
  importacaoId: string | null;
  records: PontoIngestionRecord[];
}): Promise<PontoIngestionResult> {
  const { supabase, tenantId, importacaoId, records } = params;

  if (records.length === 0) {
    return {
      inseridos: 0,
      atualizados: 0,
      ignorados_duplicados: 0,
      correcoes_pendentes: [],
      bloqueados_fechamento: 0,
    };
  }

  const uniqueDates = Array.from(new Set(records.map((r) => r.data).filter(Boolean)));
  const uniqueCompetencias = Array.from(
    new Set(records.map((r) => r.competencia || r.data?.slice(0, 7)).filter(Boolean) as string[]),
  );

  const [existingRows, closedEmpresaComps] = await Promise.all([
    fetchExistingPontos(supabase, tenantId, uniqueDates),
    fetchClosedEmpresaCompetencias(supabase, tenantId, uniqueCompetencias),
  ]);

  const byChave = new Map<string, Record<string, any>>();
  const byLogical = new Map<string, Record<string, any>>();

  for (const row of existingRows) {
    if (row.chave_importacao) {
      byChave.set(row.chave_importacao, row);
    }
    const existingShift = extractShiftFromObservacoes(row.observacoes);
    const lKey = buildLogicalPontoKey({
      empresaId: row.empresa_id ?? null,
      colaboradorId: row.colaborador_id ?? null,
      data: row.data,
      jornadaDiscriminator: existingShift,
    });
    if (lKey && !byLogical.has(lKey)) {
      byLogical.set(lKey, row);
    }
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Array<{ id: string; rec: PontoIngestionRecord; existingSnapshot: Record<string, any> }> = [];
  const correcoesPendentes: CorrecaoPendenteItem[] = [];
  let ignoradosDuplicados = 0;
  let bloqueadosFechamento = 0;

  for (const rec of records) {
    const comp = rec.competencia || rec.data.slice(0, 7);
    const compKey = `${rec.empresa_id ?? 'null'}_${comp}`;
    const isClosedComp = closedEmpresaComps.has(compKey);

    const lKey = buildLogicalPontoKey({
      empresaId: rec.empresa_id ?? null,
      colaboradorId: rec.colaborador_id ?? null,
      data: rec.data,
      jornadaDiscriminator: rec.jornada_discriminator ?? null,
    });

    const existing =
      byChave.get(rec.chave_importacao) || (lKey ? byLogical.get(lKey) : undefined);

    if (isClosedComp) {
      if (existing && !hasPunchDifference(existing, rec)) {
        ignoradosDuplicados++;
      } else {
        bloqueadosFechamento++;
        const tipo: CorrecaoPendenteItem['tipo'] = existing
          ? 'COMPETENCIA_FECHADA'
          : 'PONTO_POS_FECHAMENTO';
        correcoesPendentes.push({
          tipo,
          registro_ponto_id: existing?.id ?? null,
          colaborador_id: rec.colaborador_id,
          empresa_id: rec.empresa_id,
          data: rec.data,
          competencia: comp,
          nome_colaborador: rec.nome_colaborador,
          chave_importacao: rec.chave_importacao,
          anterior: existing
            ? {
                entrada: existing.entrada ?? null,
                saida_almoco: existing.saida_almoco ?? null,
                retorno_almoco: existing.retorno_almoco ?? null,
                saida: existing.saida ?? null,
                status_processamento: existing.status_processamento ?? null,
              }
            : null,
          recebido: {
            entrada: rec.entrada ?? null,
            saida_almoco: rec.saida_almoco ?? null,
            retorno_almoco: rec.retorno_almoco ?? null,
            saida: rec.saida ?? null,
            origem: rec.origem,
          },
          descricao: existing
            ? `Reimportação divergente bloqueada: competência ${comp} já fechada. Ponto original preservado.`
            : `Ponto recebido após fechamento da competência ${comp}. Requer análise/reabertura controlada pelo RH.`,
        });
      }
      continue;
    }

    if (existing) {
      if (isProcessedStatus(existing.status_processamento, existing.status)) {
        if (!hasPunchDifference(existing, rec)) {
          ignoradosDuplicados++;
        } else {
          correcoesPendentes.push({
            tipo: 'CORRECAO_POS_PROCESSAMENTO',
            registro_ponto_id: existing.id,
            colaborador_id: rec.colaborador_id ?? existing.colaborador_id ?? null,
            empresa_id: rec.empresa_id ?? existing.empresa_id ?? null,
            data: rec.data,
            competencia: comp,
            nome_colaborador: rec.nome_colaborador,
            chave_importacao: rec.chave_importacao,
            anterior: {
              entrada: existing.entrada ?? null,
              saida_almoco: existing.saida_almoco ?? null,
              retorno_almoco: existing.retorno_almoco ?? null,
              saida: existing.saida ?? null,
              status_processamento: existing.status_processamento ?? null,
            },
            recebido: {
              entrada: rec.entrada ?? null,
              saida_almoco: rec.saida_almoco ?? null,
              retorno_almoco: rec.retorno_almoco ?? null,
              saida: rec.saida ?? null,
              origem: rec.origem,
            },
            descricao: `Divergência recebida na importação (${rec.origem}) para ponto já processado em ${rec.data}. Registro original preservado para revisão explícita do RH.`,
          });
        }
        continue;
      }

      // Registro existente em aberto/pendente/inconsistente
      const sameColab = (existing.colaborador_id ?? null) === (rec.colaborador_id ?? null);
      const sameKey = existing.chave_importacao === rec.chave_importacao;
      if (!hasPunchDifference(existing, rec) && sameColab && sameKey) {
        ignoradosDuplicados++;
        continue;
      }

      toUpdate.push({ id: existing.id, rec, existingSnapshot: existing });
    } else {
      toInsert.push(sanitizeDbPayload(rec));
    }
  }

  // Persistir inserções em lotes
  for (const chunk of chunkArray(toInsert, 200)) {
    const { error: insertErr } = await supabase.from('registros_ponto').insert(chunk);
    if (insertErr) {
      throw new Error(`Falha ao inserir registros_ponto: ${insertErr.message}`);
    }
  }

  // FIX 01 & FIX ATOMICIDADE:
  // Executa atualização atômica protegida por lock determinístico via RPC (ou fallback direto com guarda otimista)
  let totalAtualizados = 0;
  for (const item of toUpdate) {
    const comp = item.rec.competencia || item.rec.data.slice(0, 7);
    const dbPayload = sanitizeDbPayload(item.rec);

    // Tentar atualização atômica via RPC se disponível no Supabase client
    let rpcSupported = typeof supabase.rpc === 'function';
    let rpcResult: { status: string; message?: string } | null = null;

    if (rpcSupported) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          'rpc_atualizar_ponto_se_competencia_aberta',
          {
            p_tenant_id: tenantId,
            p_registro_id: item.id,
            p_empresa_id: item.rec.empresa_id ?? null,
            p_competencia: comp,
            p_payload: dbPayload,
          },
        );

        if (!rpcErr && rpcData && typeof rpcData === 'object' && rpcData.status) {
          rpcResult = rpcData;
        } else if (rpcErr && (rpcErr.code === '42883' || rpcErr.message?.includes('does not exist'))) {
          // RPC ainda não aplicada no ambiente: fallback gracioso para guarda otimista direta
          rpcSupported = false;
        } else if (rpcErr) {
          throw new Error(`Falha na RPC rpc_atualizar_ponto_se_competencia_aberta: ${rpcErr.message}`);
        }
      } catch (err: any) {
        if (err?.message?.includes('does not exist') || err?.code === '42883') {
          rpcSupported = false;
        } else {
          throw err;
        }
      }
    }

    if (rpcResult) {
      if (rpcResult.status === 'ATUALIZADO') {
        totalAtualizados++;
      } else if (rpcResult.status === 'INGESTAO_SUSPENSA') {
        throw new Error(`INGESTAO_SUSPENSA: ${rpcResult.message || 'Ingestão de pontos suspensa pelo administrador.'}`);
      } else if (rpcResult.status === 'MUTACAO_ESTRUTURAL_INVALIDA' || rpcResult.status === 'DIVERGENCIA_EMPRESA' || rpcResult.status === 'DIVERGENCIA_COMPETENCIA') {
        throw new Error(`MUTACAO_INVALIDA: ${rpcResult.message}`);
      } else if (rpcResult.status === 'COMPETENCIA_FECHADA') {
        bloqueadosFechamento++;
        correcoesPendentes.push({
          tipo: 'COMPETENCIA_FECHADA',
          registro_ponto_id: item.id,
          colaborador_id: item.rec.colaborador_id,
          empresa_id: item.rec.empresa_id,
          data: item.rec.data,
          competencia: comp,
          nome_colaborador: item.rec.nome_colaborador,
          chave_importacao: item.rec.chave_importacao,
          anterior: {
            entrada: item.existingSnapshot.entrada ?? null,
            saida_almoco: item.existingSnapshot.saida_almoco ?? null,
            retorno_almoco: item.existingSnapshot.retorno_almoco ?? null,
            saida: item.existingSnapshot.saida ?? null,
            status_processamento: item.existingSnapshot.status_processamento ?? null,
          },
          recebido: {
            entrada: item.rec.entrada ?? null,
            saida_almoco: item.rec.saida_almoco ?? null,
            retorno_almoco: item.rec.retorno_almoco ?? null,
            saida: item.rec.saida ?? null,
            origem: item.rec.origem,
          },
          descricao: `Concorrência atômica detectada (RPC): competência ${comp} foi fechada durante a atualização. Ponto original preservado.`,
        });
      } else if (rpcResult.status === 'FALHA_AUTORIZACAO') {
        throw new Error(`Falha de Autorização na RPC rpc_atualizar_ponto_se_competencia_aberta: ${rpcResult.message}`);
      } else {
        // STATUS_INVALIDO ou CONCORRENCIA_DETECTADA
        const { data: currentRow } = await supabase
          .from('registros_ponto')
          .select('id, entrada, saida_almoco, retorno_almoco, saida, status_processamento, status')
          .eq('id', item.id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        correcoesPendentes.push({
          tipo: 'CORRECAO_POS_PROCESSAMENTO',
          registro_ponto_id: item.id,
          colaborador_id: item.rec.colaborador_id,
          empresa_id: item.rec.empresa_id,
          data: item.rec.data,
          competencia: comp,
          nome_colaborador: item.rec.nome_colaborador,
          chave_importacao: item.rec.chave_importacao,
          anterior: {
            entrada: currentRow?.entrada ?? item.existingSnapshot.entrada ?? null,
            saida_almoco: currentRow?.saida_almoco ?? item.existingSnapshot.saida_almoco ?? null,
            retorno_almoco: currentRow?.retorno_almoco ?? item.existingSnapshot.retorno_almoco ?? null,
            saida: currentRow?.saida ?? item.existingSnapshot.saida ?? null,
            status_processamento: currentRow?.status_processamento ?? 'PROCESSADO',
          },
          recebido: {
            entrada: item.rec.entrada ?? null,
            saida_almoco: item.rec.saida_almoco ?? null,
            retorno_almoco: item.rec.retorno_almoco ?? null,
            saida: item.rec.saida ?? null,
            origem: item.rec.origem,
          },
          descricao: `Concorrência atômica detectada (RPC): o ponto ${item.rec.data} foi processado/fechado concorrentemente durante a importação. Registro original preservado para revisão explícita do RH.`,
        });
      }
      continue;
    }

    // Se a RPC não estiver disponível (e.g. migration ainda não aplicada no ambiente),
    // NÃO realizar atualização desprotegida silenciosa caso haja qualquer indicativo de fechamento.
    // Falha expressa com erro explícito para manter fail-closed.
    throw new Error(
      `RPC_INDISPONIVEL: A função transacional rpc_atualizar_ponto_se_competencia_aberta é obrigatória para garantir atomicidade entre importação e fechamento. Aplicação da migration pendente no ambiente.`,
    );
  }

  // Persistir trilha explícita de inconsistências
  if (correcoesPendentes.length > 0) {
    const inconsistenciasRows = correcoesPendentes.map((corr) => ({
      tenant_id: tenantId,
      registro_ponto_id: corr.registro_ponto_id,
      colaborador_id: corr.colaborador_id,
      empresa_id: corr.empresa_id,
      tipo: corr.tipo,
      descricao: `${corr.descricao} [importacao_id=${importacaoId ?? 'N/A'} | anterior=${JSON.stringify(corr.anterior)} | recebido=${JSON.stringify(corr.recebido)}]`,
      gravidade: 'alta',
      status: 'aberta',
      resolvida: false,
    }));

    for (const chunk of chunkArray(inconsistenciasRows, 200)) {
      const { error: incErr } = await supabase
        .from('processamento_rh_inconsistencias')
        .insert(chunk);
      if (incErr) {
        throw new Error(`Falha ao registrar divergências em processamento_rh_inconsistencias: ${incErr.message}`);
      }
    }
  }

  return {
    inseridos: toInsert.length,
    atualizados: totalAtualizados,
    ignorados_duplicados: ignoradosDuplicados,
    correcoes_pendentes: correcoesPendentes,
    bloqueados_fechamento: bloqueadosFechamento,
  };
}
