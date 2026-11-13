import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as XLSX from "https://esm.sh/xlsx"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { EmpresaResolver } from "../_shared/EmpresaResolver.ts"
import { buildCanonicalPontoKey, ingestPontosBatch, validatePontoIngestAuth, type PontoIngestionRecord } from "../_shared/pontoIntegrity.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const parseIsoDateLike = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, day, month, year] = slashMatch;
    day = day.padStart(2, "0");
    month = month.padStart(2, "0");
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  if (/^\d{5}$/.test(raw)) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Number(raw) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  return "";
};

const parseTimeLike = (value: string) => {
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.replace(".", ":");
  if (/^\d{1,2}:\d{2}$/.test(normalized)) return `${normalized.padStart(5, "0")}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(normalized)) return normalized.padStart(8, "0");
  if (/^0\.\d+$/.test(normalized)) {
    const totalSeconds = Math.round(Number(normalized) * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return null;
};

const getImportRowValue = (row: Record<string, unknown>, ...columns: string[]) => {
  const targets = columns.map((column) => normalizeText(column));
  const entry = Object.entries(row).find(([key]) => targets.includes(normalizeText(key)));
  return String(entry?.[1] ?? "").trim();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const contentType = req.headers.get('content-type') || ''
    let body: any = {}
    let file: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      body = Object.fromEntries(formData.entries())
      file = formData.get('arquivo') as File
    } else {
      body = await req.json()
    }

    const parent_importacao_id = body.parent_importacao_id
    const reprocessado_motivo = body.reprocessado_motivo
    let empresa_id = body.empresa_id
    let unidade_id = body.unidade_id
    let coletor_id = body.coletor_id
    let origem = body.origem || 'google_drive'
    let drive_file_id = body.drive_file_id
    let drive_folder_id = body.drive_folder_id
    let nome_arquivo = body.nome_arquivo
    let tipo_arquivo = body.tipo_arquivo

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // FIX 01 — Autenticação de Entrada Obrigatória (Fail-Closed antes de qualquer leitura ou escrita)
    const authCheck = await validatePontoIngestAuth({
      req,
      supabase,
      serviceRoleKey: supabaseKey,
      webhookSecretEnv: Deno.env.get('PONTO_IMPORT_SECRET'),
    });

    if (!authCheck.authorized && authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    let parentImport: any = null
    if (parent_importacao_id) {
        const { data, error } = await supabase
            .from('historico_importacoes')
            .select('*')
            .eq('id', parent_importacao_id)
            .single()
        if (!error && data) {
            parentImport = data
            empresa_id = empresa_id || parentImport.empresa_id
            unidade_id = unidade_id || parentImport.unidade_id
            coletor_id = coletor_id || parentImport.coletor_id
            origem = origem || parentImport.origem
            drive_file_id = drive_file_id || parentImport.drive_file_id
            drive_folder_id = drive_folder_id || parentImport.drive_folder_id
            nome_arquivo = nome_arquivo || parentImport.nome_arquivo
            tipo_arquivo = tipo_arquivo || parentImport.tipo_arquivo
        }
    }

    if (!file && !parent_importacao_id) throw new Error("Arquivo não enviado.")
    if (!file && parent_importacao_id) {
        throw new Error("Dados do arquivo não encontrados para reprocessamento automático. Por favor, envie o arquivo novamente.")
    }
    if (!file) throw new Error("Arquivo não disponível.")

    // 1. Get Tenant ID com amarração estrita da identidade
    let tenantId = body.tenant_id;

    // Se a requisição foi autenticada via JWT do operador, o tenant é OBRIGATORIAMENTE o do operador autenticado
    if (authCheck.authType === 'jwt' && authCheck.tenantId) {
      if (tenantId && tenantId !== authCheck.tenantId) {
        return new Response(JSON.stringify({
          error: "TenantMismatch",
          message: "Acesso negado: operador não possui autorização para importar dados em outro tenant."
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      tenantId = authCheck.tenantId;
    }

    if (!tenantId && empresa_id) {
       const { data: emp } = await supabase.from('empresas').select('tenant_id').eq('id', empresa_id).single()
       tenantId = emp?.tenant_id
    }
    
    if (!tenantId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', user.id).single()
          tenantId = profile?.tenant_id
        }
      }
    }

    if (!tenantId) throw new Error("Tenant não identificado.")

    // 2. Create History Record
    const execution_id = crypto.randomUUID()
    const version = parentImport ? (parentImport.version || 1) + 1 : 1

    const { data: historico, error: histError } = await supabase
      .from('historico_importacoes')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresa_id || null,
        unidade_id: unidade_id || null,
        coletor_id: coletor_id || null,
        origem,
        workflow: 'importar-pontos-google-drive',
        nome_arquivo: nome_arquivo || file.name,
        tipo_arquivo: tipo_arquivo || file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        drive_file_id,
        drive_folder_id,
        status: parent_importacao_id ? 'REPROCESSANDO' : 'VALIDANDO',
        parent_importacao_id,
        reprocessado_motivo,
        execution_id,
        version
      })
      .select()
      .single()

    if (histError) throw histError

    // If reprocessing, mark old records as superseded
    if (parent_importacao_id) {
        await supabase.rpc('mark_old_import_records_superseded', {
            p_importacao_id: parent_importacao_id,
            p_new_importacao_id: historico.id
        })
    }

    // 3. Parse File
    const arrayBuffer = await file.arrayBuffer()
    let workbook;
    try {
      workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    } catch (err) {
      const text = new TextDecoder().decode(arrayBuffer).trim();
      const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
      if (base64Regex.test(text)) {
         workbook = XLSX.read(text, { type: 'base64' })
      } else {
         workbook = XLSX.read(text, { type: 'string' })
      }
    }
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonRows = (XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false }) as Record<string, any>[])
      .filter(row => Object.values(row).some(v => String(v ?? "").trim() !== ""));

    // 4. Resolver Empresa e Colaboradores com EmpresaResolver padronizado
    const resolver = new EmpresaResolver(supabase, tenantId, origem);
    await resolver.loadCache();

    const cpfs = new Set<string>();
    const matriculas = new Set<string>();
    const nomes = new Set<string>();

    for (const row of jsonRows) {
      const cpf = getImportRowValue(row, "CPF", "DOCUMENTO", "CPF DO COLABORADOR");
      const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO", "CÓDIGO DO COLABORADOR");
      const nome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR", "NOME DO COLABORADOR", "NOME DO FUNCIONÁRIO");
      if (cpf) cpfs.add(String(cpf).replace(/\D/g, ''));
      if (matricula) matriculas.add(String(matricula).trim());
      if (nome) nomes.add(normalizeText(nome));
    }

    let colabQuery = supabase.from('colaboradores').select('id, nome, matricula, cpf, empresa_id').eq('tenant_id', tenantId);
    const colabFilter: string[] = [];
    if (cpfs.size > 0) colabFilter.push(`cpf.in.(${Array.from(cpfs).join(',')})`);
    if (matriculas.size > 0) colabFilter.push(`matricula.in.(${Array.from(matriculas).join(',')})`);
    if (nomes.size > 0) colabFilter.push(`nome.in.(${Array.from(nomes).map(n => '"' + n + '"').join(',')})`);
    if (colabFilter.length > 0) {
      colabQuery = colabQuery.or(colabFilter.join(','));
    }

    const { data: dbColabs } = await colabQuery;
    const colabMap = new Map<string, any>();
    if (dbColabs) {
      dbColabs.forEach(c => {
        if (c.cpf) colabMap.set(`CPF_${String(c.cpf).replace(/\D/g, '')}`, c);
        if (c.matricula) colabMap.set(`MAT_${String(c.matricula).trim()}`, c);
        if (c.nome) colabMap.set(`NOME_${normalizeText(c.nome)}`, c);
      });
    }

    const registrosMap = new Map<string, PontoIngestionRecord>();
    let novosColabs = 0;
    let quantidadeIgnorada = 0;
    let quantidadeInconsistente = 0;

    // 5. Process Rows
    for (const row of jsonRows) {
      const empresaNome = getImportRowValue(row, "EMPRESA", "EMPRESAS", "RAZÃO SOCIAL", "RAZAO SOCIAL", "CLIENTE", "NOME DA EMPRESA", "NOME DA CLIENTE");
      const colaboradorNome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR", "NOME DO COLABORADOR", "NOME DO FUNCIONÁRIO");
      const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO", "CÓDIGO DO COLABORADOR");
      const cpf = getImportRowValue(row, "CPF", "DOCUMENTO", "CPF DO COLABORADOR");
      const cargo = getImportRowValue(row, "CARGO", "FUNÇÃO", "FUNCAO", "CARGO DO COLABORADOR");
      const dataStr = parseIsoDateLike(getImportRowValue(row, "DATA", "DATA DO PONTO", "DATA DE REGISTRO"));
      
      if (!colaboradorNome || !dataStr) {
        quantidadeIgnorada++;
        continue;
      }

      // Resolve Empresa via EmpresaResolver
      let targetEmpresaId = empresa_id || null;
      if (!targetEmpresaId && empresaNome) {
        targetEmpresaId = await resolver.resolveOrCreate(empresaNome);
      }

      // Resolve Colaborador com fallback CPF -> matricula -> nome
      const rawCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      const matQuery = matricula ? `MAT_${String(matricula).trim()}` : null;
      const cpfQuery = rawCpf ? `CPF_${rawCpf}` : null;
      const nomeQuery = colaboradorNome ? `NOME_${normalizeText(colaboradorNome)}` : null;

      let matchedColab: any = null;
      let matchedBy: string | null = null;

      if (cpfQuery && colabMap.has(cpfQuery)) { matchedColab = colabMap.get(cpfQuery); matchedBy = 'cpf'; }
      else if (matQuery && colabMap.has(matQuery)) { matchedColab = colabMap.get(matQuery); matchedBy = 'matricula'; }
      else if (nomeQuery && colabMap.has(nomeQuery)) { matchedColab = colabMap.get(nomeQuery); matchedBy = 'nome'; }

      if (!matchedColab) {
        const possuiIdentificadorForte = (cpfQuery || matQuery);
        if (possuiIdentificadorForte) {
          const { data: newCollab } = await supabase.from('colaboradores').insert({
            tenant_id: tenantId,
            empresa_id: targetEmpresaId || null,
            nome: colaboradorNome.trim(),
            cpf: rawCpf,
            matricula: matricula ? String(matricula).trim() : null,
            cargo: cargo || null,
            tipo_contrato: 'mensal',
            modelo_calculo: 'CLT_MENSAL',
            regime_trabalho: 'CLT',
            tipo_colaborador: 'clt',
            status: 'pendente',
            status_cadastro: 'pendente_complemento',
            origem,
            origem_cadastro: 'ponto_importado',
            origem_detalhe: 'Self-healing Google Drive',
            cadastro_provisorio: true,
            permitir_lancamento_operacional: false
          }).select('id, nome, matricula, cpf, empresa_id').single();

          if (newCollab) {
            matchedColab = newCollab;
            matchedBy = 'self_healing';
            novosColabs++;
            if (cpfQuery) colabMap.set(cpfQuery, newCollab);
            if (matQuery) colabMap.set(matQuery, newCollab);
            if (nomeQuery) colabMap.set(nomeQuery, newCollab);
          }
        } else {
          quantidadeInconsistente++;
        }
      }

      // Point Data
      const entrada = parseTimeLike(getImportRowValue(row, "ENTRADA", "INICIO", "INÍCIO", "HORA DE ENTRADA"))
      const saidaAlmoco = parseTimeLike(getImportRowValue(row, "SAIDA ALMOCO", "SAÍDA ALMOÇO", "SAIDA INTERVALO"))
      const retornoAlmoco = parseTimeLike(getImportRowValue(row, "RETORNO ALMOCO", "RETORNO ALMOÇO", "RETORNO INTERVALO"))
      const saida = parseTimeLike(getImportRowValue(row, "SAIDA", "FIM", "SAÍDA", "HORA DE SAÍDA"))

      const jornadaDiscriminator = getImportRowValue(row, "TURNO", "JORNADA", "ESCALA", "SEQUENCIA") || null;
      const chaveImportacao = await buildCanonicalPontoKey({
        tenantId,
        empresaId: targetEmpresaId,
        colaboradorId: matchedColab?.id ?? null,
        cpf: rawCpf,
        matricula: matricula ? String(matricula).trim() : null,
        nome: colaboradorNome,
        data: dataStr,
        jornadaDiscriminator,
      }, sha256Hex);

      const pointBase: PontoIngestionRecord = {
        tenant_id: tenantId,
        importacao_id: historico.id,
        execution_id,
        chave_importacao: chaveImportacao,
        colaborador_id: matchedColab?.id ?? null,
        empresa_id: targetEmpresaId,
        coletor_id: coletor_id || null,
        unidade_id: unidade_id || null,
        drive_file_id: drive_file_id || null,
        data: dataStr,
        competencia: dataStr.slice(0, 7),
        entrada,
        saida_almoco: saidaAlmoco,
        retorno_almoco: retornoAlmoco,
        saida,
        status: matchedColab ? 'Pendente' : 'Inconsistente',
        status_processamento: matchedColab ? 'PENDENTE_PROCESSAMENTO' : 'INCONSISTENTE',
        nome_colaborador: colaboradorNome,
        empresa_nome: empresaNome || null,
        matricula_colaborador: matricula || null,
        cpf_colaborador: rawCpf,
        cargo_colaborador: cargo || null,
        horas_trabalhadas: getImportRowValue(row, "HORAS TRABALHADAS", "HORAS TRAB", "HR TRABALHADAS") || null,
        hora_extra: getImportRowValue(row, "HORA EXTRA", "HORAS EXTRAS", "HE") || null,
        falta: getImportRowValue(row, "FALTA", "FALTAS") || null,
        atraso: getImportRowValue(row, "ATRASO", "ATRASOS", "ATRASO MINUTOS") || null,
        observacoes: getImportRowValue(row, "OBSERVACOES", "OBSERVAÇÕES", "OBS") || JSON.stringify({ matched_by: matchedBy, ...(jornadaDiscriminator ? { jornada_discriminator: jornadaDiscriminator } : {}) }),
        origem,
        inconsistencias: matchedColab ? null : "Registro recusou Self-Healing por falta de identificador forte (CPF/Matrícula).",
        jornada_discriminator: jornadaDiscriminator,
      };

      const existingRecord = registrosMap.get(chaveImportacao);
      let mergedPoint = pointBase;
      if (existingRecord) {
        mergedPoint = {
          ...existingRecord,
          ...pointBase,
          entrada: pointBase.entrada || existingRecord.entrada,
          saida_almoco: pointBase.saida_almoco || existingRecord.saida_almoco,
          retorno_almoco: pointBase.retorno_almoco || existingRecord.retorno_almoco,
          saida: pointBase.saida || existingRecord.saida,
        };
      }
      registrosMap.set(chaveImportacao, mergedPoint);
    }

    const registrosParaSalvar = Array.from(registrosMap.values());
    let ingestionResult = {
      inseridos: 0,
      atualizados: 0,
      ignorados_duplicados: 0,
      correcoes_pendentes: [] as any[],
      bloqueados_fechamento: 0,
    };

    // 6. Ingestão controlada compartilhada
    try {
      ingestionResult = await ingestPontosBatch({
        supabase,
        tenantId,
        importacaoId: historico.id,
        records: registrosParaSalvar,
      });
    } catch (insertError: any) {
      await supabase.from('historico_importacoes').update({
        status: 'ERRO',
        erro_processamento: insertError.message,
        finalizado_em: new Date().toISOString(),
      }).eq('id', historico.id);
      throw insertError;
    }

    const inseridos_ou_atualizados = ingestionResult.inseridos + ingestionResult.atualizados;
    const totalInconsistentesFinal = quantidadeInconsistente + ingestionResult.correcoes_pendentes.length;
    const finalStatus = totalInconsistentesFinal > 0 ? 'INCONSISTENTE' : 'PROCESSADO';

    // 7. Update History
    await supabase.from('historico_importacoes').update({
      status: finalStatus,
      quantidade_registros: jsonRows.length,
      quantidade_importada: inseridos_ou_atualizados,
      quantidade_inconsistencias: totalInconsistentesFinal,
      quantidade_ignorada: quantidadeIgnorada + ingestionResult.ignorados_duplicados,
      processado_em: new Date().toISOString(),
      finalizado_em: new Date().toISOString(),
      logs: {
        mensagem: "Importação Google Drive concluída.",
        clts_autocriados: novosColabs,
        empresas_criadas: resolver.empresasCriadas,
        inseridos: ingestionResult.inseridos,
        atualizados: ingestionResult.atualizados,
        ignorados_duplicados: ingestionResult.ignorados_duplicados,
        bloqueados_fechamento: ingestionResult.bloqueados_fechamento,
        correcoes_pendentes: ingestionResult.correcoes_pendentes,
      }
    }).eq('id', historico.id);

    return new Response(
      JSON.stringify({
        success: true,
        importacao_id: historico.id,
        empresa_id: historico.empresa_id,
        unidade_id: historico.unidade_id,
        coletor_id: historico.coletor_id,
        origem,
        quantidade_registros: jsonRows.length,
        inseridos: ingestionResult.inseridos,
        atualizados: ingestionResult.atualizados,
        ignorados_duplicados: ingestionResult.ignorados_duplicados,
        bloqueados_fechamento: ingestionResult.bloqueados_fechamento,
        inconsistentes: totalInconsistentesFinal,
        correcoes_pendentes: ingestionResult.correcoes_pendentes.length,
        novos_colaboradores: novosColabs,
        novas_empresas: resolver.empresasCriadas,
        status: finalStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error("Erro na importação Google Drive:", error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "INTERNAL_SERVER_ERROR", 
        message: error.message 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
