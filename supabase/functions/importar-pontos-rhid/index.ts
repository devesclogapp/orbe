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
    
    // NOTA: Usando SERVICE ROLE KEY para poder bypassar RLS em inserções/leituras de apoio, se necessário
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Receber payload
    const payload = await req.json();
    console.log("[LOG] Payload recebido:", JSON.stringify({ items: Array.isArray(payload) ? payload.length : 1 }));
    
    // 2. Validar payload
    if (!Array.isArray(payload) || payload.length === 0) {
      console.log("[LOG] Payload vazio ou não é array.");
      return new Response(JSON.stringify({ error: "Payload vazio ou inválido." }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const totalRecebidos = payload.length;
    console.log(`[LOG] Total recebidos: ${totalRecebidos}`);

    // Criar histórico marcando como VALIDANDO
    const { data: historico, error: histError } = await supabase
      .from('historico_importacoes')
      .insert({
        origem: 'rhid_api',
        quantidade_registros: totalRecebidos,
        status: 'VALIDANDO'
      })
      .select('id')
      .single();

    if (histError) {
      console.error("[ERROR] Falha ao criar hitórico inicial:", histError);
    }
    const importacaoId = historico?.id;

    // Buscar todos os colaboradores para mapeamento rápido em RAM (para evitar 1 query por row)
    // Isso imita um lookup lookup map nativo para não estourar tempo.
    const { data: dbColabs } = await supabase.from('colaboradores').select('id, nome, matricula, empresa_id');
    const colabMap = new Map();
    if (dbColabs) {
       dbColabs.forEach(c => {
         // mapeia por matrícula se tiver, senao por nome maiusculo
         if (c.matricula) colabMap.set(`MAT_${c.matricula}`, c);
         if (c.nome) colabMap.set(`NOME_${c.nome.toUpperCase().trim()}`, c);
       });
    }

    const validos = [];
    const inconsistentes = [];

    // 3. Montar registros válidos/inconsistentes
    for (const item of payload) {
      let matchedColab = null;

      if (item.pessoa_matricula && colabMap.has(`MAT_${item.pessoa_matricula}`)) {
         matchedColab = colabMap.get(`MAT_${item.pessoa_matricula}`);
      } else if (item.pessoa_nome && colabMap.has(`NOME_${item.pessoa_nome.toUpperCase().trim()}`)) {
         matchedColab = colabMap.get(`NOME_${item.pessoa_nome.toUpperCase().trim()}`);
      }

      const pointBase = {
        importacao_id: importacaoId,
        data: item.data,
        entrada: item.entrada,
        saida_almoco: item.saida_almoco,
        retorno_almoco: item.retorno_almoco,
        saida: item.saida,
        origem: 'rhid_api',
        status: 'pendente' // status base do ponto inicial
      };

      if (!matchedColab) {
         // Inconsistente (sem vínculo de colaborador local)
         inconsistentes.push({
           ...pointBase,
           colaborador_id: null,
           status: 'inconsistente',
           inconsistencias: "Colaborador não encontrado no sistema: " + item.pessoa_nome
         });
      } else {
         validos.push({
           ...pointBase,
           colaborador_id: matchedColab.id
         });
      }
    }

    console.log(`[LOG] Total válidos: ${validos.length}`);
    console.log(`[LOG] Total inconsistentes: ${inconsistentes.length}`);

    // Prepara junção para salvar na mesma tabela (que acumula validos e inconstantes orfãos)
    const registrosParaSalvar = [...validos, ...inconsistentes];

    // 4 e 5. Persistir registros_ponto e inconsistências
    if (registrosParaSalvar.length > 0) {
      console.log(`[LOG] Início upsert registros_ponto (${registrosParaSalvar.length} registros)`);
      
      // OBS: Causa confirmada em relatórios passados = não há UNIQUE Index na DB.
      // Efetuar bulk upsert sem unique index explode em table scan.
      // Executaremos o upsert da maneira padronizada que existia, delegando a responsabilidade de estabilidade à DB (que terá o index criado).
      const { error: upsertError } = await supabase
          .from('registros_ponto')
          .upsert(registrosParaSalvar, { onConflict: 'data,colaborador_id' });

      if (upsertError) {
        // Se este upsert falhar, aqui loga-se "Erro upsert válidos: canceling statement due to statement timeout" (se demorar demais).
        console.error("[ERROR] Erro upsert válidos: ", upsertError.message);
        throw upsertError;
      }
      
      console.log("[LOG] Fim upsert registros_ponto");
    }

    // --- CORTADO: Processamento pesado (Return Fast) ---
    // [REMOVIDO] await supabase.rpc('processamento_rh_diario');
    // [REMOVIDO] await recalcularBancoHoras();
    // [REMOVIDO] fetch(webhook_consolidacao_BI);
    // --------------------------------------------------

    // 6. Atualizar historico_importacoes
    if (importacaoId) {
       console.log("[LOG] Início update histórico");
       const finalStatus = inconsistentes.length > 0 ? 'PROCESSADO_COM_ALERTAS' : 'PROCESSADO';
       
       const { error: histUpdateError } = await supabase
          .from('historico_importacoes')
          .update({
            status: finalStatus,
            quantidade_registros: totalRecebidos, // ou validos.length
            logs: inconsistentes // salva rastro na prop json
          })
          .eq('id', importacaoId);

       if (histUpdateError) {
         console.error("[ERROR] Falha ao atualizar histórico:", histUpdateError);
       } else {
         console.log(`[LOG] Fim update histórico (${finalStatus})`);
       }
    }

    // 7. Retornar HTTP 200 OK imediatamente
    console.log("[LOG] Resposta enviada ao N8N com Sucesso.");
    return new Response(JSON.stringify({
       success: true,
       message: "Importação concluída.",
       recebidos: totalRecebidos,
       salvos: registrosParaSalvar.length,
       inconsistentes: inconsistentes.length
    }), {
       status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("[CRITICAL] Falha geral na Edge Function:", err.message);
    
    // Tentativa de update de histórico para ERRO em caso de throw (fire & forget)
    // Não usar await aqui para garantir que o catch não exploda de timeout tb
    
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
