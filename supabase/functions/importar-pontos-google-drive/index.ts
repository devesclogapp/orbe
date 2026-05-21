import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as XLSX from "https://esm.sh/xlsx"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Helpers copy-pasted/adapted from Orbe codebase
const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeCompanyText = (value: string) => {
  const normalized = normalizeText(value);
  return normalized
    .replace(/\b(ltda|me|eireli)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeStatus = (status?: string | null): string => {
  const value = status?.toString().trim();
  if (!value) return "Pendente";
  const map: Record<string, string> = {
    presente: "Presente", ausente: "Ausente", falta: "Falta", atestado: "Atestado",
    folga: "Folga", ferias: "Férias", férias: "Férias", homeoffice: "Home Office",
    "home office": "Home Office", bancohoras: "Banco de Horas",
    "banco de horas": "Banco de Horas", pendente: "Pendente",
    processado: "Processado", inconsistente: "Inconsistente",
    ok: "ok", ajustado: "ajustado", incompleto: "incompleto",
  };
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toLowerCase();
  return map[normalized] || "Pendente";
};

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

const generatePlaceholderCnpj = (): string => {
  const ts = Date.now().toString().slice(-6);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `00000${ts}${rand}`;
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let parentImport = null
    if (parent_importacao_id) {
        const { data } = await supabase
            .from('historico_importacoes')
            .select('*')
            .eq('id', parent_importacao_id)
            .single()
        parentImport = data
        
        if (parentImport) {
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
    
    // For reprocessing without a file, we'd need to fetch it from Drive or Storage.
    // If not possible, user must provide file in the reprocess request.
    if (!file && parent_importacao_id) {
        // Here we could add logic to fetch from Drive if we had credentials
        // For now, let's assume the caller must provide the file if it's not a background retry
        throw new Error("Dados do arquivo não encontrados para reprocessamento automático. Por favor, envie o arquivo novamente.")
    }

    if (!file) throw new Error("Arquivo não disponível.")

    // 1. Get Tenant ID
    let tenantId = body.tenant_id
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

    // 4. Load common data for resolution
    const [
      { data: empresasList },
      { data: colaboradoresList }
    ] = await Promise.all([
      supabase.from('empresas').select('id, nome').eq('tenant_id', tenantId),
      supabase.from('colaboradores').select('id, tenant_id, empresa_id, nome, cpf, matricula, cargo').eq('tenant_id', tenantId)
    ])

    const empresaCache = new Map<string, any>((empresasList || []).map(e => [normalizeCompanyText(e.nome), e]))
    const colabCache = new Map<string, any>()
    ;(colaboradoresList || []).forEach(c => {
      if (c.cpf) colabCache.set(`cpf:${String(c.cpf).replace(/\D/g, '')}`, c)
      if (c.matricula && c.empresa_id) colabCache.set(`mat:${c.matricula}:${c.empresa_id}`, c)
      if (c.nome && c.empresa_id) colabCache.set(`nome:${normalizeText(c.nome)}:${c.empresa_id}`, c)
    })

    const pointRecords: any[] = []
    let novosColabs = 0
    let novasEmpresas = 0

    // 5. Process Rows
    for (const row of jsonRows) {
      const empresaNome = getImportRowValue(row, "EMPRESA", "EMPRESAS", "RAZÃO SOCIAL", "RAZAO SOCIAL", "CLIENTE", "NOME DA EMPRESA", "NOME DA CLIENTE");
      const colaboradorNome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR", "NOME DO COLABORADOR", "NOME DO FUNCIONÁRIO");
      const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO", "CÓDIGO DO COLABORADOR");
      const cpf = getImportRowValue(row, "CPF", "DOCUMENTO", "CPF DO COLABORADOR");
      const cargo = getImportRowValue(row, "CARGO", "FUNÇÃO", "FUNCAO", "CARGO DO COLABORADOR");
      const dataStr = parseIsoDateLike(getImportRowValue(row, "DATA", "DATA DO PONTO", "DATA DE REGISTRO"));
      
      if (!colaboradorNome || !dataStr) continue

      // Resolve Empresa
      let targetEmpresaId = empresa_id || null
      if (!targetEmpresaId && empresaNome) {
        const normName = normalizeCompanyText(empresaNome)
        let emp = empresaCache.get(normName)
        if (!emp) {
          // Create minimal empresa
          const { data: newEmp, error: errNewEmp } = await supabase.from('empresas').insert({
            tenant_id: tenantId,
            nome: empresaNome,
            cnpj: generatePlaceholderCnpj(),
            status: 'ativa',
            origem: 'ponto',
            cadastro_provisorio: true,
            unidade: 'Não informado',
            cidade: 'Não informado'
          }).select().single()
          if (!errNewEmp) {
            emp = newEmp
            empresaCache.set(normName, emp)
            novasEmpresas++
          }
        }
        targetEmpresaId = emp?.id
      }

      // Resolve Colaborador
      const cpfNorm = cpf ? String(cpf).replace(/\D/g, '') : null
      const nomeNorm = normalizeText(colaboradorNome)
      const lookupKeys = [
        cpfNorm ? `cpf:${cpfNorm}` : null,
        matricula && targetEmpresaId ? `mat:${matricula}:${targetEmpresaId}` : null,
        nomeNorm && targetEmpresaId ? `nome:${nomeNorm}:${targetEmpresaId}` : null
      ].filter(Boolean)

      let collab = lookupKeys.map(k => colabCache.get(k!)).find(Boolean)

      if (!collab) {
        // Create pre-registration
        const { data: newCollab, error: errNewCollab } = await supabase.from('colaboradores').insert({
          tenant_id: tenantId,
          empresa_id: targetEmpresaId,
          nome: colaboradorNome,
          cpf: cpfNorm,
          matricula: matricula || null,
          cargo: cargo || null,
          tipo_contrato: 'mensal',
          modelo_calculo: 'CLT_MENSAL',
          regime_trabalho: 'CLT',
          tipo_colaborador: 'clt',
          status: 'pendente',
          status_cadastro: 'pendente_complemento',
          origem: 'ponto',
          origem_cadastro: 'ponto_importado',
          cadastro_provisorio: true
        }).select().single()

        if (!errNewCollab) {
          collab = newCollab
          novosColabs++
          if (cpfNorm) colabCache.set(`cpf:${cpfNorm}`, collab)
          if (matricula && targetEmpresaId) colabCache.set(`mat:${matricula}:${targetEmpresaId}`, collab)
          if (nomeNorm && targetEmpresaId) colabCache.set(`nome:${nomeNorm}:${targetEmpresaId}`, collab)
        }
      }

      // Point Data
      const entrada = parseTimeLike(getImportRowValue(row, "ENTRADA"))
      const saidaAlmoco = parseTimeLike(getImportRowValue(row, "SAIDA ALMOCO"))
      const retornoAlmoco = parseTimeLike(getImportRowValue(row, "RETORNO ALMOCO"))
      const saida = parseTimeLike(getImportRowValue(row, "SAIDA"))

      pointRecords.push({
        tenant_id: tenantId,
        importacao_id: historico.id,
        execution_id: execution_id,
        colaborador_id: collab?.id,
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
        status: normalizeStatus(getImportRowValue(row, "STATUS")),
        // Raw fields for audit
        nome_colaborador: colaboradorNome,
        empresa_nome: empresaNome || null,
        matricula_colaborador: matricula || null,
        cpf_colaborador: cpf || null,
        horas_trabalhadas: getImportRowValue(row, "HORAS TRABALHADAS"),
        hora_extra: getImportRowValue(row, "HORA EXTRA"),
        falta: getImportRowValue(row, "FALTA"),
        atraso: getImportRowValue(row, "ATRASO"),
        observacoes: getImportRowValue(row, "OBSERVACOES"),
        origem: origem === 'google_drive' ? 'google_drive' : 'importacao'
      })
    }

    // 6. Bulk Insert Points
    if (pointRecords.length > 0) {
      const { error: insertError } = await supabase.from('registros_ponto').insert(pointRecords)
      if (insertError) throw insertError
    }

    // 7. Update History
    await supabase.from('historico_importacoes').update({
      status: 'PROCESSADO',
      quantidade_registros: pointRecords.length,
      processado_em: new Date().toISOString()
    }).eq('id', historico.id)

    return new Response(
      JSON.stringify({
        success: true,
        importacao_id: historico.id,
        empresa_id: historico.empresa_id,
        unidade_id: historico.unidade_id,
        coletor_id: historico.coletor_id,
        origem,
        quantidade_registros: pointRecords.length,
        novos_colaboradores: novosColabs,
        novas_empresas: novasEmpresas,
        status: 'PROCESSADO'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    console.error("Erro na importação:", error)
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
