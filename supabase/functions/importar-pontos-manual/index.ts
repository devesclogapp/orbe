import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as XLSX from "https://esm.sh/xlsx"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  if (!value) return "RECEBIDO";
  const map: Record<string, string> = {
    sucesso: "PROCESSADO",
    processado: "PROCESSADO",
    pendente: "PENDENTE_PROCESSAMENTO",
    erro: "ERRO",
    inconsistente: "INCONSISTENTE",
    validando: "VALIDANDO",
    recebido: "RECEBIDO",
    presente: "RECEBIDO",
    ausente: "RECEBIDO",
    falta: "RECEBIDO",
    ok: "RECEBIDO",
  };
  return map[value.toLowerCase()] || "RECEBIDO";
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

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Parse multipart/form-data
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Content-Type deve ser multipart/form-data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null
    const empresa_id = (formData.get('empresa_id') as string) || null
    const nome_arquivo = (formData.get('nome_arquivo') as string) || file?.name || 'importacao_manual.xlsx'

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, message: 'Campo "arquivo" é obrigatório.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 2. Supabase client com service role (para bypass de RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Resolver tenant a partir do JWT do usuário
    let tenantId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single()
        tenantId = profile?.tenant_id ?? null
      }
    }

    // Fallback: resolver tenant via empresa_id
    if (!tenantId && empresa_id) {
      const { data: emp } = await supabase
        .from('empresas')
        .select('tenant_id')
        .eq('id', empresa_id)
        .single()
      tenantId = emp?.tenant_id ?? null
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tenant não identificado. Por favor, faça login novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // 4. Registrar histórico de importação
    const { data: historico, error: histError } = await supabase
      .from('historico_importacoes')
      .insert({
        tenant_id: tenantId,
        empresa_id: empresa_id || null,
        origem: 'manual',
        nome_arquivo,
        tipo_arquivo: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        status: 'VALIDANDO',
        quantidade_registros: 0,
      })
      .select()
      .single()

    if (histError) {
      console.error('[importar-pontos-manual] Erro ao registrar histórico:', histError)
      throw histError
    }

    // 5. Parsear arquivo Excel/CSV
    const arrayBuffer = await file.arrayBuffer()
    let workbook: any
    try {
      workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    } catch (err) {
      const text = new TextDecoder().decode(arrayBuffer).trim()
      const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
      workbook = base64Regex.test(text)
        ? XLSX.read(text, { type: 'base64' })
        : XLSX.read(text, { type: 'string' })
    }

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonRows = (XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false }) as Record<string, any>[])
      .filter(row => Object.values(row).some(v => String(v ?? "").trim() !== ""))

    // 6. Carregar dados de resolução (empresas e colaboradores do tenant)
    const [{ data: empresasList }, { data: colaboradoresList }] = await Promise.all([
      supabase.from('empresas').select('id, nome, tenant_id').eq('tenant_id', tenantId),
      supabase.from('colaboradores').select('id, empresa_id, nome, cpf, matricula, cargo').eq('tenant_id', tenantId),
    ])

    const empresaCache = new Map<string, any>(
      (empresasList || []).map(e => [normalizeCompanyText(e.nome), e])
    )
    const colabCache = new Map<string, any>()
    ;(colaboradoresList || []).forEach(c => {
      if (c.cpf) colabCache.set(`cpf:${String(c.cpf).replace(/\D/g, '')}`, c)
      if (c.matricula && c.empresa_id) colabCache.set(`mat:${c.matricula}:${c.empresa_id}`, c)
      if (c.nome && c.empresa_id) colabCache.set(`nome:${normalizeText(c.nome)}:${c.empresa_id}`, c)
    })

    const pointRecords: any[] = []
    let novosColabs = 0
    let novasEmpresas = 0

    // 7. Processar linhas da planilha
    for (const row of jsonRows) {
      const empresaNome = getImportRowValue(row, "EMPRESA", "EMPRESAS", "RAZÃO SOCIAL", "RAZAO SOCIAL", "CLIENTE", "NOME DA EMPRESA")
      const colaboradorNome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR", "NOME DO COLABORADOR", "NOME DO FUNCIONÁRIO")
      const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO", "CÓDIGO DO COLABORADOR")
      const cpf = getImportRowValue(row, "CPF", "DOCUMENTO", "CPF DO COLABORADOR")
      const cargo = getImportRowValue(row, "CARGO", "FUNÇÃO", "FUNCAO", "CARGO DO COLABORADOR")
      const dataStr = parseIsoDateLike(getImportRowValue(row, "DATA", "DATA DO PONTO", "DATA DE REGISTRO"))

      // Pular linha se não tiver colaborador ou data
      if (!colaboradorNome || !dataStr) continue

      // Resolver empresa
      let targetEmpresaId = (empresa_id && empresa_id !== '') ? empresa_id : null
      if (!targetEmpresaId && empresaNome) {
        const normName = normalizeCompanyText(empresaNome)
        let emp = empresaCache.get(normName)
        if (!emp) {
          // Tentar correspondência parcial
          emp = (empresasList || []).find(e => {
            const n = normalizeCompanyText(e.nome)
            return n.includes(normName) || normName.includes(n)
          })
        }
        if (!emp) {
          // Criar empresa provisória
          const { data: newEmp, error: errNewEmp } = await supabase.from('empresas').insert({
            tenant_id: tenantId,
            nome: empresaNome,
            cnpj: generatePlaceholderCnpj(),
            status: 'ativa',
            origem: 'ponto',
            cadastro_provisorio: true,
            unidade: 'Não informado',
            cidade: 'Não informado',
          }).select().single()
          if (!errNewEmp) {
            emp = newEmp
            empresaCache.set(normName, emp)
            novasEmpresas++
          }
        }
        targetEmpresaId = emp?.id ?? null
      }

      // Resolver colaborador
      const cpfNorm = cpf ? String(cpf).replace(/\D/g, '') : null
      const nomeNorm = normalizeText(colaboradorNome)
      const lookupKeys = [
        cpfNorm ? `cpf:${cpfNorm}` : null,
        matricula && targetEmpresaId ? `mat:${matricula}:${targetEmpresaId}` : null,
        nomeNorm && targetEmpresaId ? `nome:${nomeNorm}:${targetEmpresaId}` : null,
      ].filter(Boolean)

      let collab = lookupKeys.map(k => colabCache.get(k!)).find(Boolean)

      if (!collab) {
        // Criar pré-cadastro
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
          cadastro_provisorio: true,
        }).select().single()

        if (!errNewCollab) {
          collab = newCollab
          novosColabs++
          if (cpfNorm) colabCache.set(`cpf:${cpfNorm}`, collab)
          if (matricula && targetEmpresaId) colabCache.set(`mat:${matricula}:${targetEmpresaId}`, collab)
          if (nomeNorm && targetEmpresaId) colabCache.set(`nome:${nomeNorm}:${targetEmpresaId}`, collab)
        }
      }

      // Montar registro de ponto
      const entrada = parseTimeLike(getImportRowValue(row, "ENTRADA", "INICIO", "INÍCIO", "HORA DE ENTRADA"))
      const saidaAlmoco = parseTimeLike(getImportRowValue(row, "SAIDA ALMOCO", "SAÍDA ALMOÇO", "SAIDA INTERVALO"))
      const retornoAlmoco = parseTimeLike(getImportRowValue(row, "RETORNO ALMOCO", "RETORNO ALMOÇO", "RETORNO INTERVALO"))
      const saida = parseTimeLike(getImportRowValue(row, "SAIDA", "FIM", "SAÍDA", "HORA DE SAÍDA"))
      const status = normalizeStatus(getImportRowValue(row, "STATUS", "SITUAÇÃO", "SITUACAO"))

      pointRecords.push({
        tenant_id: tenantId,
        importacao_id: historico.id,
        colaborador_id: collab?.id ?? null,
        empresa_id: targetEmpresaId,
        data: dataStr,
        competencia: dataStr.slice(0, 7),
        entrada,
        saida_almoco: saidaAlmoco,
        retorno_almoco: retornoAlmoco,
        saida,
        status,
        status_processamento: 'pendente',
        // Campos brutos para auditoria
        nome_colaborador: colaboradorNome,
        empresa_nome: empresaNome || null,
        matricula_colaborador: matricula || null,
        cpf_colaborador: cpf || null,
        cargo_colaborador: cargo || null,
        horas_trabalhadas: getImportRowValue(row, "HORAS TRABALHADAS", "HORAS TRAB", "HR TRABALHADAS") || null,
        hora_extra: getImportRowValue(row, "HORA EXTRA", "HORAS EXTRAS", "HE") || null,
        falta: getImportRowValue(row, "FALTA", "FALTAS") || null,
        atraso: getImportRowValue(row, "ATRASO", "ATRASOS", "ATRASO MINUTOS") || null,
        observacoes: getImportRowValue(row, "OBSERVACOES", "OBSERVAÇÕES", "OBS", "OBSERVAÇÃO") || null,
        // Origem sempre 'importacao' para compatibilidade com deleteImported
        origem: 'importacao',
      })
    }

    // 8. Inserir registros em lote
    if (pointRecords.length > 0) {
      const { error: insertError } = await supabase.from('registros_ponto').insert(pointRecords)
      if (insertError) {
        console.error('[importar-pontos-manual] Erro ao inserir registros:', insertError)
        // Atualizar histórico com erro
        await supabase.from('historico_importacoes').update({
          status: 'ERRO',
          erro_processamento: insertError.message,
        }).eq('id', historico.id)
        throw insertError
      }
    }

    // 9. Atualizar histórico com sucesso
    await supabase.from('historico_importacoes').update({
      status: 'PROCESSADO',
      quantidade_registros: pointRecords.length,
      processado_em: new Date().toISOString(),
    }).eq('id', historico.id)

    return new Response(
      JSON.stringify({
        success: true,
        importacao_id: historico.id,
        quantidade_registros: pointRecords.length,
        novos_colaboradores: novosColabs,
        novas_empresas: novasEmpresas,
        status: 'PROCESSADO',
        message: `${pointRecords.length} registros importados com sucesso`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('[importar-pontos-manual] Erro fatal:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: error?.message ?? 'Erro interno na importação.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
