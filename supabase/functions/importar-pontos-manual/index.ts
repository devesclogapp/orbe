import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as XLSX from "https://esm.sh/xlsx"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"
import { EmpresaResolver } from "../_shared/EmpresaResolver.ts"

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ success: false, message: 'Content-Type deve ser multipart/form-data' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null
    const empresa_id = (formData.get('empresa_id') as string) || null
    const nome_arquivo = (formData.get('nome_arquivo') as string) || file?.name || 'importacao_manual.xlsx'

    if (!file) {
      return new Response(JSON.stringify({ success: false, message: 'Campo "arquivo" é obrigatório.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    
    let tenantId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', user.id).single()
        tenantId = profile?.tenant_id ?? null
      }
    }

    if (!tenantId && empresa_id) {
      const { data: emp } = await supabase.from('empresas').select('tenant_id').eq('id', empresa_id).single()
      tenantId = emp?.tenant_id ?? null
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, message: 'Tenant não identificado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }

    // 5. Parsear arquivo
    const arrayBuffer = await file.arrayBuffer()
    let workbook: any
    try {
      workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    } catch {
      const text = new TextDecoder().decode(arrayBuffer).trim()
      const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
      workbook = base64Regex.test(text) ? XLSX.read(text, { type: 'base64' }) : XLSX.read(text, { type: 'string' })
    }

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonRows = (XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false }) as Record<string, any>[]).filter(row => Object.values(row).some(v => String(v ?? "").trim() !== ""));
    const schemaVersion = 1;

    // Criar histórico
    const { data: historico, error: histError } = await supabase.from('historico_importacoes').insert({
        tenant_id: tenantId,
        empresa_id: empresa_id || null,
        origem: 'manual',
        workflow: 'importar-pontos-manual',
        nome_arquivo,
        tipo_arquivo: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        status: 'VALIDANDO',
        quantidade_recebida: jsonRows.length,
      }).select().single();

    if (histError) throw histError;
    const importacaoId = historico.id;

    // Dicionarios de Cache
    const cpfs = new Set<string>();
    const matriculas = new Set<string>();
    const nomes = new Set<string>();
    
    for (const row of jsonRows) {
        const cpf = getImportRowValue(row, "CPF", "DOCUMENTO");
        const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO");
        const nome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR");
        
        if (cpf) cpfs.add(String(cpf).replace(/\D/g, ''));
        if (matricula) matriculas.add(String(matricula).trim());
        if (nome) nomes.add(normalizeText(nome));
    }

    let colabQuery = supabase.from('colaboradores').select('id, nome, matricula, cpf, empresa_id').eq('tenant_id', tenantId);
    let colabFilter = [];
    if (cpfs.size > 0) colabFilter.push(`cpf.in.(${Array.from(cpfs).join(',')})`);
    if (matriculas.size > 0) colabFilter.push(`matricula.in.(${Array.from(matriculas).join(',')})`);
    if (nomes.size > 0) colabFilter.push(`nome.in.(${Array.from(nomes).map(n => '"' + n + '"').join(',')})`);
    if (colabFilter.length > 0) colabQuery = colabQuery.or(colabFilter.join(','));

    const resolver = new EmpresaResolver(supabase, tenantId, 'manual');
    await resolver.loadCache();
    const { data: dbColabs } = await colabQuery;

    const colabMap = new Map();
    if (dbColabs) {
       dbColabs.forEach(c => {
         if (c.cpf) colabMap.set(`CPF_${String(c.cpf).replace(/\D/g, '')}`, c);
         if (c.matricula) colabMap.set(`MAT_${String(c.matricula).trim()}`, c);
         if (c.nome) colabMap.set(`NOME_${normalizeText(c.nome)}`, c);
       });
    }

    const registrosMap = new Map();
    let novosColabs = 0;
    let quantidadeIgnorada = 0;
    let quantidadeInconsistente = 0;

    for (const row of jsonRows) {
      const empresaNome = getImportRowValue(row, "EMPRESA", "EMPRESAS", "RAZÃO SOCIAL", "RAZAO SOCIAL", "CLIENTE", "NOME DA EMPRESA")
      const colaboradorNome = getImportRowValue(row, "COLABORADOR", "NOME", "FUNCIONÁRIO", "FUNCIONARIO", "TRABALHADOR", "NOME DO COLABORADOR", "NOME DO FUNCIONÁRIO")
      const matricula = getImportRowValue(row, "MATRICULA", "MATRÍCULA", "CODIGO", "CÓDIGO", "CÓDIGO DO COLABORADOR")
      const cpf = getImportRowValue(row, "CPF", "DOCUMENTO", "CPF DO COLABORADOR")
      const cargo = getImportRowValue(row, "CARGO", "FUNÇÃO", "FUNCAO", "CARGO DO COLABORADOR")
      const dataStr = parseIsoDateLike(getImportRowValue(row, "DATA", "DATA DO PONTO", "DATA DE REGISTRO"))

      if (!colaboradorNome || !dataStr) {
          quantidadeIgnorada++;
          continue;
      }

      let matchedEmpresaId = empresa_id || null;

      if (!matchedEmpresaId && empresaNome) {
         matchedEmpresaId = await resolver.resolveOrCreate(empresaNome);
      }

      const rawCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      const matQuery = matricula ? `MAT_${String(matricula).trim()}` : null;
      const cpfQuery = rawCpf ? `CPF_${rawCpf}` : null;
      const nomeQuery = colaboradorNome ? `NOME_${normalizeText(colaboradorNome)}` : null;

      let matchedColab = null;
      let matchedBy = null;

      if (cpfQuery && colabMap.has(cpfQuery)) { matchedColab = colabMap.get(cpfQuery); matchedBy = 'cpf'; }
      else if (matQuery && colabMap.has(matQuery)) { matchedColab = colabMap.get(matQuery); matchedBy = 'matricula'; }
      else if (nomeQuery && colabMap.has(nomeQuery)) { matchedColab = colabMap.get(nomeQuery); matchedBy = 'nome'; }

      if (!matchedColab) {
          const possuiIdentificadorForte = (cpfQuery || matQuery);
          if (possuiIdentificadorForte) {
              const { data: newCol } = await supabase.from('colaboradores').insert({
                  tenant_id: tenantId,
                  empresa_id: matchedEmpresaId || null, 
                  nome: colaboradorNome.trim(),
                  cpf: rawCpf,
                  matricula: matricula ? String(matricula).trim() : null,
                  cargo: cargo || null,
                  tipo_colaborador: 'clt',
                  regime_trabalho: 'CLT',
                  modelo_calculo: 'CLT_MENSAL',
                  tipo_contrato: 'mensal',
                  status: 'pendente',
                  status_cadastro: 'pendente_complemento',
                  origem: 'manual',
                  origem_cadastro: 'ponto_importado',
                  origem_detalhe: `Self-healing manual schema_version=${schemaVersion}`,
                  cadastro_provisorio: true,
              }).select('id, nome, matricula, cpf, empresa_id').single();

              if (newCol) {
                  matchedColab = newCol;
                  matchedBy = 'self_healing';
                  novosColabs++;
                  if (cpfQuery) colabMap.set(cpfQuery, newCol);
                  if (matQuery) colabMap.set(matQuery, newCol);
                  if (nomeQuery) colabMap.set(nomeQuery, newCol);
              }
          } else {
             quantidadeInconsistente++;
          }
      }

      const idenForte = rawCpf || (matricula ? String(matricula).trim() : normalizeText(colaboradorNome));
      const hashStr = `${tenantId}_${matchedEmpresaId ?? 'null'}_manual_${idenForte}_${dataStr}`;
      const chaveImportacao = await sha256Hex(hashStr);

      const entrada = parseTimeLike(getImportRowValue(row, "ENTRADA", "INICIO", "INÍCIO", "HORA DE ENTRADA"))
      const saidaAlmoco = parseTimeLike(getImportRowValue(row, "SAIDA ALMOCO", "SAÍDA ALMOÇO", "SAIDA INTERVALO"))
      const retornoAlmoco = parseTimeLike(getImportRowValue(row, "RETORNO ALMOCO", "RETORNO ALMOÇO", "RETORNO INTERVALO"))
      const saida = parseTimeLike(getImportRowValue(row, "SAIDA", "FIM", "SAÍDA", "HORA DE SAÍDA"))
      const rowStatus = normalizeStatus(getImportRowValue(row, "STATUS", "SITUAÇÃO", "SITUACAO"))

      const pointBase = {
        tenant_id: tenantId,
        importacao_id: importacaoId,
        chave_importacao: chaveImportacao,
        colaborador_id: matchedColab?.id ?? null,
        empresa_id: matchedEmpresaId,
        data: dataStr,
        competencia: dataStr.slice(0, 7),
        entrada,
        saida_almoco: saidaAlmoco,
        retorno_almoco: retornoAlmoco,
        saida,
        status: matchedColab ? rowStatus : 'inconsistente',
        status_processamento: 'pendente',
        nome_colaborador: colaboradorNome,
        empresa_nome: empresaNome || null,
        matricula_colaborador: matricula || null,
        cpf_colaborador: rawCpf,
        cargo_colaborador: cargo || null,
        horas_trabalhadas: getImportRowValue(row, "HORAS TRABALHADAS", "HORAS TRAB", "HR TRABALHADAS") || null,
        hora_extra: getImportRowValue(row, "HORA EXTRA", "HORAS EXTRAS", "HE") || null,
        falta: getImportRowValue(row, "FALTA", "FALTAS") || null,
        atraso: getImportRowValue(row, "ATRASO", "ATRASOS", "ATRASO MINUTOS") || null,
        observacoes: getImportRowValue(row, "OBSERVACOES", "OBSERVAÇÕES", "OBS") || JSON.stringify({ matched_by: matchedBy, schema: schemaVersion }),
        origem: 'manual', // mantém manual
        inconsistencias: matchedColab ? null : "Registro recusou Self-Healing por falta de identificador forte (CPF/Matrícula)."
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
               saida: pointBase.saida || existingRecord.saida
           };
      }
      registrosMap.set(chaveImportacao, mergedPoint);
    }

    const registrosParaSalvar = Array.from(registrosMap.values());
    let inseridos_ou_atualizados = 0;

    if (registrosParaSalvar.length > 0) {
      const { error: insertError } = await supabase.from('registros_ponto').upsert(registrosParaSalvar, { onConflict: 'tenant_id,chave_importacao' })
      if (insertError) {
        await supabase.from('historico_importacoes').update({ status: 'ERRO', erro_processamento: insertError.message }).eq('id', importacaoId)
        throw insertError
      }
      inseridos_ou_atualizados = registrosParaSalvar.length;
    }

    const finalStatus = quantidadeInconsistente > 0 ? 'INCONSISTENTE' : 'PROCESSADO';
    await supabase.from('historico_importacoes').update({
      status: finalStatus,
      quantidade_importada: inseridos_ou_atualizados,
      quantidade_inconsistencias: quantidadeInconsistente,
      quantidade_ignorada: quantidadeIgnorada,
      processado_em: new Date().toISOString(),
      finalizado_em: new Date().toISOString(),
      logs: { 
         mensagem: "Importação Manual concluída.", 
         clts_autocriados: novosColabs, 
         empresas_criadas: resolver.empresasCriadas,
         esquema_utilizado: schemaVersion
      }
    }).eq('id', importacaoId)

    return new Response(
      JSON.stringify({
        success: true,
        importacao_id: importacaoId,
        resumo: {
          recebidos: jsonRows.length,
          importados_vazados: inseridos_ou_atualizados,
          ignorados: quantidadeIgnorada,
          inconsistentes: quantidadeInconsistente,
          clts_criados: novosColabs,
          empresas_criadas: resolver.empresasCriadas,
          schema: schemaVersion
        },
        message: `${inseridos_ou_atualizados} registros importados com sucesso`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('[importar-pontos-manual] Erro:', error)
    return new Response(JSON.stringify({ success: false, message: error?.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
