import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Bypass RLS para ingestão de background
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("[LOG] Payload Tio Digital body:", JSON.stringify({ bodyKeys: Object.keys(body) }));
    
    // Suportar payload format: { tenant_id: 'uuid', items: [...] } 
    // ou apenas o array [{...}] e o tenant no header (x-tenant-id)
    
    const tenant_id = body.tenant_id || req.headers.get('x-tenant-id');
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
    const rootOrigem = body.origem || 'tio_digital';
    const rootArquivoOrigem = body.arquivo_origem || null;
    
    if (!tenant_id) {
       return new Response(JSON.stringify({ error: "Missing tenant_id in payload or headers." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!items || items.length === 0) {
      console.log("[LOG] Payload items vazio ou incorreto.");
      return new Response(JSON.stringify({ error: "Payload items vazio ou formato inválido." }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const totalRecebidos = items.length;
    
    const { data: historico, error: histError } = await supabase
      .from('historico_importacoes')
      .insert({
        tenant_id,
        origem: 'tio_digital',
        quantidade_registros: totalRecebidos,
        status: 'VALIDANDO'
      })
      .select('id')
      .single();

    if (histError) console.error("[ERROR] Hitórico falhou:", histError);
    const importacaoId = historico?.id;

    // Buscar colaboradores do tenant para mapeamento
    const { data: dbColabs } = await supabase
       .from('colaboradores')
       .select('id, nome, cpf, matricula, empresa_id')
       .eq('tenant_id', tenant_id);
       
    const colabMap = new Map();
    if (dbColabs) {
       dbColabs.forEach(c => {
         if (c.cpf) colabMap.set(`CPF_${c.cpf.replace(/\D/g, '')}`, c);
         if (c.matricula) colabMap.set(`MAT_${c.matricula.trim()}`, c);
         if (c.nome) colabMap.set(`NOME_${c.nome.toUpperCase().trim()}`, c);
       });
    }

    const { data: dbEmpresas } = await supabase.from('empresas').select('id, nome, cnpj').eq('tenant_id', tenant_id);
    const empresaMap = new Map();
    if (dbEmpresas) {
      dbEmpresas.forEach(e => {
        if (e.id) empresaMap.set(`ID_${e.id}`, e.id);
        if (e.cnpj) empresaMap.set(`CNPJ_${e.cnpj.replace(/\D/g, '')}`, e.id);
        if (e.nome) empresaMap.set(`NOM_${e.nome.toUpperCase().trim()}`, e.id);
      });
    }

    const validos = [];
    const inconsistentes = [];

    const parseFloatSafe = (val: any) => {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'string' && val.includes(':')) {
         const parts = val.split(':');
         const hours = parseInt(parts[0], 10) || 0;
         const mins = parseInt(parts[1], 10) || 0;
         return hours + (mins / 60);
      }
      const parsed = parseFloat(String(val).replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };

    const normalizeDbDate = (d: string) => {
      if (!d) return '1970-01-01';
      
      // Se vier um range (ex: 24/06/2026 - 24/06/2026), pegamos apenas a primeira data
      let dateString = String(d).trim();
      if (dateString.includes(' - ')) {
         dateString = dateString.split(' - ')[0].trim();
      }

      // DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateString)) {
        const [dd, mm, yyyy] = dateString.split('/');
        return `${yyyy}-${mm}-${dd}`;
      }
      // Pega os primeiros 10 caracteres assumindo YYYY-MM-DD ou recorta T00:00:00Z
      if (dateString.length >= 10 && dateString.includes('-')) {
         return dateString.substring(0, 10);
      }
      return dateString;
    };

    // Buscar registros existentes para fallback/idempotencia
    const normDates = Array.from(new Set(items.map((i: any) => normalizeDbDate(i.data_periodo || i.data || i.data_referencia || i.DATA)).filter(Boolean)));
    const { data: existingRecords, error: extErr } = await supabase
      .from('lancamentos_intermitentes')
      .select('id, colaborador_id, nome_colaborador, data_referencia, convocacao, lote_fechamento_id, status_pipeline')
      .eq('tenant_id', tenant_id)
      .in('data_referencia', normDates.length > 0 ? normDates : ['1970-01-01']);
      
    if (extErr) console.error("[ERROR] Fetch existing falhou:", extErr);

    const existingMap = new Map();
    if (existingRecords) {
      existingRecords.forEach(r => {
        const keyData = normalizeDbDate(r.data_referencia);
        const key = r.colaborador_id 
          ? `COLAB_${r.colaborador_id}_${keyData}_${r.convocacao || 'Sem referência'}`
          : `NOME_${r.nome_colaborador}_${keyData}_${r.convocacao || 'Sem referência'}`;
        existingMap.set(key, r);
      });
    }

    const toInsert = [];
    const toUpdate = [];
    let ignorados = 0;
    let ignorados_por_lote = 0;
    const logsInconsistentes = [];

    for (const rawItem of items) {
      // Normalização de chaves flexível (lidar com Data, DATA, cpf, CPF, etc.)
      const item: any = {};
      for (const k in rawItem) {
         if (Object.prototype.hasOwnProperty.call(rawItem, k)) {
            item[k.toLowerCase()] = rawItem[k];
         }
      }
      
      let matchedColab = null;

      // Tentativa de lookup CPF -> Matricula -> Nome
      const cpfItem = item.cpf || rawItem.CPF || rawItem.Cpf;
      const cleanCpf = cpfItem ? String(cpfItem).replace(/\D/g, '') : null;
      
      const matItem = item.matricula || rawItem.Matricula || rawItem.MATRICULA;
      const cleanMat = matItem ? String(matItem).trim() : null;
      
      const rawName = item.colaborador_nome || item.colaborador || rawItem.Colaborador || rawItem.colaborador;
      const cleanName = rawName ? String(rawName).toUpperCase().trim() : null;

      if (cleanCpf && colabMap.has(`CPF_${cleanCpf}`)) {
         matchedColab = colabMap.get(`CPF_${cleanCpf}`);
      } else if (cleanMat && colabMap.has(`MAT_${cleanMat}`)) {
         matchedColab = colabMap.get(`MAT_${cleanMat}`);
      } else if (cleanName && colabMap.has(`NOME_${cleanName}`)) {
         matchedColab = colabMap.get(`NOME_${cleanName}`);
      }

      // Derivar competencia do formato da data (ex: '2026-06-15' -> '2026-06')
      const targetDate = normalizeDbDate(item.data_periodo || item.data || rawItem.Data || rawItem.DATA || rawItem.data_referencia);
      const compVal = targetDate && targetDate !== '1970-01-01' ? targetDate.substring(0, 7) : 'SEM-COMP';

      const baseNome = rawName || 'Desconhecido';
      const baseConvocacao = item.convocacao || rawItem.Convocacao || 'Sem referência';
      
      // Resolução de empresa fallback (Departamento)
      let fallbackEmpresaId = null;
      const depName = item.departamento || rawItem.Departamento || item.unidade || rawItem.Unidade;
      if (depName) {
         fallbackEmpresaId = empresaMap.get(`NOM_${String(depName).toUpperCase().trim()}`);
      }
      
      const launchBase = {
        tenant_id,
        importacao_id: importacaoId,
        nome_colaborador: baseNome,
        data_referencia: targetDate,
        competencia: compVal,
        convocacao: baseConvocacao,
        cargo: item.cargo || rawItem.Cargo,
        departamento: depName,
        horas_trabalhadas: parseFloatSafe(item.horas_trabalhadas || rawItem['H. Trabalhadas'] || rawItem.horas_trabalhada || 0),
        horas_normais: parseFloatSafe(item.horas_normais || rawItem['H. Normais'] || rawItem.horas_normal || 0),
        he_50: parseFloatSafe(item.he_50 || rawItem['HE 50%'] || rawItem.he50 || 0),
        he_100: parseFloatSafe(item.he_100 || rawItem['HE 100%'] || rawItem.he100 || 0),
        hora_noturna: parseFloatSafe(item.hora_noturna || rawItem['H. Noturna'] || rawItem.adicional_noturno || 0),
        total: parseFloatSafe(item.total || rawItem.Total || rawItem.valor_total || 0),
        origem: item.origem || rootOrigem,
        arquivo_origem: item.arquivo_origem || rootArquivoOrigem,
        status_pipeline: 'RECEBIDO'
      };

      const finalEmpresaId = matchedColab?.empresa_id || fallbackEmpresaId || null;

      const recordToProcess = {
        ...launchBase,
        colaborador_id: matchedColab ? matchedColab.id : null,
        empresa_id: finalEmpresaId
      };
      
      if (!matchedColab) {
          logsInconsistentes.push(recordToProcess);
      }

      const lookupKey = recordToProcess.colaborador_id 
          ? `COLAB_${recordToProcess.colaborador_id}_${recordToProcess.data_referencia}_${recordToProcess.convocacao}`
          : `NOME_${recordToProcess.nome_colaborador}_${recordToProcess.data_referencia}_${recordToProcess.convocacao}`;

      const existing = existingMap.get(lookupKey);

      if (existing) {
         // Registro já existe. Validar se pode atualizar
         if (existing.lote_fechamento_id !== null || existing.status_pipeline !== 'RECEBIDO') {
             ignorados_por_lote++;
             ignorados++;
         } else {
             // Pode atualizar preservando status_pipeline
             toUpdate.push({
                ...recordToProcess,
                id: existing.id, // necessário para o update massivo (upsert por PK)
                status_pipeline: existing.status_pipeline
             });
         }
      } else {
         toInsert.push(recordToProcess);
      }
    }

    console.log(`[LOG] Para Inserir: ${toInsert.length} | Para Atualizar: ${toUpdate.length} | Ignorados: ${ignorados}`);

    // Executar Insert
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
          .from('lancamentos_intermitentes')
          .insert(toInsert);
          
      if (insertErr) {
         console.error("[ERROR] Insert falhou:", insertErr);
         return new Response(JSON.stringify({ error: "DB Error", message: insertErr.message, hint: "Falha ao inserir itens novos." }), { 
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
      }
    }

    // Executar Update
    if (toUpdate.length > 0) {
        // Upsert na Supabase quando passamos a PK ('id') e onConflict: 'id', se comporta como um UPDATE em lote seguro
        const { error: updateErr } = await supabase
          .from('lancamentos_intermitentes')
          .upsert(toUpdate, { onConflict: 'id' });
          
        if (updateErr) {
           console.error("[ERROR] Update falhou:", updateErr);
           return new Response(JSON.stringify({ error: "DB Error", message: updateErr.message, hint: "Falha ao atualizar registros que já existiam." }), { 
              status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
           });
        }
    }

    // Historico update
    if (importacaoId) {
       const finalStatus = logsInconsistentes.length > 0 ? 'PROCESSADO_COM_ALERTAS' : 'PROCESSADO';
       await supabase.from('historico_importacoes').update({
            status: finalStatus,
            quantidade_registros: totalRecebidos,
            logs: logsInconsistentes.length > 0 ? logsInconsistentes : null 
          })
          .eq('id', importacaoId);
    }

    return new Response(JSON.stringify({
       success: true,
       message: "Importação de Intermitentes Tio Digital concluída.",
       recebidos: totalRecebidos,
       inseridos: toInsert.length,
       atualizados: toUpdate.length,
       ignorados: ignorados,
       ignorados_por_lote: ignorados_por_lote,
       inconsistentes: logsInconsistentes.length
    }), {
       status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("[CRITICAL] Falha na Edge Function Intermitentes:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
