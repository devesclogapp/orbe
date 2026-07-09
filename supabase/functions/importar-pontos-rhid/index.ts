import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // NOTA: Usando SERVICE ROLE KEY para poder bypassar RLS em inserções/leituras de apoio, se necessário
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Receber payload
    const bodyStr = await req.text();
    if (!bodyStr) {
      return new Response(JSON.stringify({ error: "Empty body" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const payload = JSON.parse(bodyStr);
    
    // Suportar payload format: { tenant_id: 'uuid', items: [...] } 
    // ou apenas o array [{...}] e o tenant no header (x-tenant-id)
    let explicitTenantId = req.headers.get('x-tenant-id') || payload.tenant_id || null;
    const items = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);

    console.log("[LOG] Payload recebido. Itens:", items.length, "Explicit Tenant ID:", explicitTenantId);

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Payload vazio ou sem items." }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // --- TENTAR INFERIR TENANT SE NÃO VEIO NA REQUISIÇÃO (Self-Healing) ---
    // Isso é útil pois as integrações antigas (via n8n / API direta) enviavam o array cru 
    // sem conhecimento de multitenancy.
    if (!explicitTenantId) {
      for (const item of items) {
         if (item.pessoa_matricula) {
            const { data: col } = await supabase.from('colaboradores')
               .select('tenant_id')
               .eq('matricula', item.pessoa_matricula)
               .not('tenant_id', 'is', null)
               .limit(1).maybeSingle();
            if (col?.tenant_id) {
               explicitTenantId = col.tenant_id;
               break;
            }
         }
      }
      
      // Se ainda não encontrou, podemos tentar pelo CNPJ da empresa, se houver
      if (!explicitTenantId) {
         for (const item of items) {
             const cnpj = item.empresa_cnpj || item.cnpj;
             if (cnpj) {
                const numCnpj = String(cnpj).replace(/\D/g, '');
                const { data: emp } = await supabase.from('empresas')
                  .select('tenant_id')
                  .eq('cnpj', numCnpj)
                  .not('tenant_id', 'is', null)
                  .limit(1).maybeSingle();
                if (emp?.tenant_id) {
                   explicitTenantId = emp.tenant_id;
                   break;
                }
             }
         }
      }
    }

    const finalTenantId = explicitTenantId;
    if (!finalTenantId) {
       console.error("[CRITICAL] Impossível processar. tenant_id não fornecido no header/payload e impossível deduzir pelos dados.");
       return new Response(JSON.stringify({ error: "Missing tenant_id. Provide in headers as x-tenant-id or inside payload ({ tenant_id, items: [] })" }), { 
         status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    const totalRecebidos = items.length;
    console.log(`[LOG] Total recebidos: ${totalRecebidos} | Tenant ID final resolvido: ${finalTenantId}`);

    // Criar histórico marcando como VALIDANDO
    const { data: historico, error: histError } = await supabase
      .from('historico_importacoes')
      .insert({
        tenant_id: finalTenantId,
        origem: 'rhid_api',
        quantidade_registros: totalRecebidos,
        status: 'VALIDANDO'
      })
      .select('id')
      .single();

    if (histError) console.error("[ERROR] Falha ao criar hitórico inicial:", histError);
    const importacaoId = historico?.id;

    // Buscar colaboradores existentes para esse tenant para mapeamento
    const { data: dbColabs } = await supabase
       .from('colaboradores')
       .select('id, nome, matricula, empresa_id')
       .eq('tenant_id', finalTenantId);
       
    const colabMap = new Map();
    if (dbColabs) {
       dbColabs.forEach(c => {
         if (c.matricula) colabMap.set(`MAT_${String(c.matricula).trim()}`, c);
         if (c.nome) colabMap.set(`NOME_${c.nome.toUpperCase().trim()}`, c);
       });
    }

    // Dicionário de empresas únicas para tentar resolver caso a api envie os dados.
    const uniqueEmpresasMap = new Map();
    
    // --- PASSO 1: DETECTAR COLABORADORES FALTANTES E EFETUAR A CRIAÇÃO DE PRÉ-CADASTRO ---
    console.log("[LOG] Validando se existem colaboradores faltantes na base para efetuar o Self-Healing");
    const colaboradoresParaCriarMap = new Map(); // deduplicar no JSON

    for (const item of items) {
       if (!item.pessoa_nome) continue; // Nome é o mínimo vital
       
       let matched = null;
       const matQuery = item.pessoa_matricula ? `MAT_${String(item.pessoa_matricula).trim()}` : null;
       const nameQuery = item.pessoa_nome ? `NOME_${String(item.pessoa_nome).toUpperCase().trim()}` : null;

       if (matQuery && colabMap.has(matQuery)) {
          matched = colabMap.get(matQuery);
       } else if (nameQuery && colabMap.has(nameQuery)) {
          matched = colabMap.get(nameQuery);
       }

       if (!matched && !colaboradoresParaCriarMap.has(matQuery || nameQuery)) {
          // Não existe no banco e ainda não colocamos na lista de criação
          const cmpName = item.empresa_nome || item.empresa;
          const cmpId = cmpName && uniqueEmpresasMap.has(`NOME_${cmpName.toUpperCase().trim()}`) 
              ? uniqueEmpresasMap.get(`NOME_${cmpName.toUpperCase().trim()}`).id 
              : null;
              
          colaboradoresParaCriarMap.set(matQuery || nameQuery, {
             tenant_id: finalTenantId,
             empresa_id: cmpId || null, 
             nome: item.pessoa_nome.trim(),
             matricula: item.pessoa_matricula ? String(item.pessoa_matricula).trim() : null,
             tipo_colaborador: 'clt',
             regime_trabalho: 'CLT',
             modelo_calculo: 'CLT_MENSAL',
             tipo_contrato: 'mensal',
             status: 'pendente',
             status_cadastro: 'pendente_complemento',
             origem: 'ponto',
             origem_cadastro: 'ponto_importado',
             origem_detalhe: 'Sincronização automática via Ponto (Self-healing)',
             cadastro_provisorio: true,
             permitir_lancamento_operacional: false
          });
       }
    }

    let cltsCriados = 0;
    const colsToInsert = Array.from(colaboradoresParaCriarMap.values());
    if (colsToInsert.length > 0) {
       console.log(`[LOG] Realizando inserção em lote de ${colsToInsert.length} pré-cadastros desconhecidos...`);
       // Usando bulk insert com select
       const { data: newCols, error: errNewCols } = await supabase
         .from('colaboradores')
         .insert(colsToInsert)
         .select('id, nome, matricula, empresa_id');
         
       if (errNewCols) {
          console.error("[CRITICAL] Falha ao criar pré-cadastros de CLTs:", errNewCols);
       } else if (newCols) {
          cltsCriados = newCols.length;
          // Alimentamos de volta nosso MAPA para os pontos as acharem no proximo laço
          newCols.forEach(c => {
             if (c.matricula) colabMap.set(`MAT_${String(c.matricula).trim()}`, c);
             if (c.nome) colabMap.set(`NOME_${c.nome.toUpperCase().trim()}`, c);
          });
       }
    }

    const registrosMap = new Map();

    // --- PASSO 2: MONTAR OS REGISTROS DE PONTO (AGORA TOTALMENTE VINCULADOS) ---
    for (const item of items) {
      let matchedColab = null;
      const matQuery = item.pessoa_matricula ? `MAT_${String(item.pessoa_matricula).trim()}` : null;
      const nameQuery = item.pessoa_nome ? `NOME_${String(item.pessoa_nome).toUpperCase().trim()}` : null;

      if (matQuery && colabMap.has(matQuery)) matchedColab = colabMap.get(matQuery);
      else if (nameQuery && colabMap.has(nameQuery)) matchedColab = colabMap.get(nameQuery);

      const pointBase = {
        tenant_id: finalTenantId, // Importante: Prevenindo data-leak e mantendo padronização
        lote_id: importacaoId,
        data: item.data,
        competencia: item.data ? item.data.slice(0, 7) : null,
        entrada: item.entrada,
        saida_almoco: item.saida_almoco,
        retorno_almoco: item.retorno_almoco,
        saida: item.saida,
        origem: 'importacao', // Alterado padrao de string p/ melhor compatibilidade
        status: matchedColab ? 'pendente' : 'inconsistente',
        status_processamento: 'pendente',
        nome_colaborador: item.pessoa_nome,
        matricula_colaborador: item.pessoa_matricula,
        empresa_nome: item.empresa_nome || item.empresa || null,
        colaborador_id: matchedColab ? matchedColab.id : null,
        horas_trabalhadas: item.horas_trabalhadas || item.horas || null,
        hora_extra: item.hora_extra || item.extras || null,
        falta: item.falta || null,
        atraso: item.atraso || null,
        observacoes: item.observacoes || item.obs || null,
        inconsistencias: matchedColab ? null : "Colaborador falhou ao ser inserido na base automática."
      };

      // Garantir deduplicação no mesmo lote para evitar "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const uniqueKey = `${pointBase.tenant_id}_${pointBase.data}_${pointBase.colaborador_id || pointBase.matricula_colaborador || pointBase.nome_colaborador}`;
      
      const existingRecord = registrosMap.get(uniqueKey);
      let mergedPoint = pointBase;
      if (existingRecord) {
         // Mesclar marcações caso a API mande a mesma data quebrada em multiplas entradas do JSON
         mergedPoint = {
             ...existingRecord,
             ...pointBase,
             entrada: pointBase.entrada || existingRecord.entrada,
             saida_almoco: pointBase.saida_almoco || existingRecord.saida_almoco,
             retorno_almoco: pointBase.retorno_almoco || existingRecord.retorno_almoco,
             saida: pointBase.saida || existingRecord.saida
         };
      }
      
      registrosMap.set(uniqueKey, mergedPoint);
    }

    const registrosParaSalvar = Array.from(registrosMap.values());

    console.log(`[LOG] Pontos Prontos: ${registrosParaSalvar.length} (Inconsistentes inevitáveis: ${registrosParaSalvar.filter(r => !r.colaborador_id).length})`);

    // --- PASSO 3: PERSISTIR UPSERT (Deixamos os conflitos pro banco gerenciar) ---
    if (registrosParaSalvar.length > 0) {
      console.log(`[LOG] Início upsert registros_ponto (${registrosParaSalvar.length} registros)`);
      
      const { error: upsertError } = await supabase
          .from('registros_ponto')
          .upsert(registrosParaSalvar, { onConflict: 'colaborador_id,data' }); // Razoável assumir unicidade diária p/ pessoa

      if (upsertError) {
        console.error("[ERROR] Erro upsert de registros_ponto: ", upsertError.message);
        throw upsertError;
      }
      console.log("[LOG] Fim upsert registros_ponto");
    }

    // 4. Atualizar historico_importacoes
    if (importacaoId) {
       console.log("[LOG] Início update histórico");
       const inconsistentesC = registrosParaSalvar.filter(r => !r.colaborador_id).length;
       const finalStatus = inconsistentesC > 0 ? 'PROCESSADO_COM_ALERTAS' : 'PROCESSADO';
       
       await supabase.from('historico_importacoes')
          .update({
            status: finalStatus,
            quantidade_registros: totalRecebidos,
            logs: { mensagem: "Sucesso", clts_recem_criados: cltsCriados, inconsistencias_restantes: inconsistentesC }
          })
          .eq('id', importacaoId);
    }

    console.log("[LOG] Resposta enviada ao N8N com Sucesso.");
    return new Response(JSON.stringify({
       success: true,
       message: "Importação concluída.",
       recebidos: totalRecebidos,
       salvos: registrosParaSalvar.length,
       clts_autocriados: cltsCriados
    }), {
       status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("[CRITICAL] Falha geral na Edge Function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

