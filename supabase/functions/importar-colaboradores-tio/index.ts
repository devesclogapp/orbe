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
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bodyText = await req.text();
    if (!bodyText) {
      return new Response(JSON.stringify({ success: false, error: "Empty body" }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body = JSON.parse(bodyText);

    // Suportar payload format: { tenant_id: 'uuid', items: [...] } 
    // ou apenas o array [{...}] e o tenant no header (x-tenant-id)
    const tenant_id = body.tenant_id || req.headers.get('x-tenant-id');
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
    
    if (!tenant_id) {
       return new Response(JSON.stringify({ success: false, error: "Missing tenant_id" }), { 
         status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Payload items vazio ou formato inválido." }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const processaveis = [];
    let ignorados = 0;

    for (const item of items) {
       // Ignorar item se faltar nome, matricula ou tenant (neste contexto tenant_id é global ou herdado do item)
       const currentTenant = item.tenant_id || tenant_id;
       if (!item.nome || !item.matricula || !currentTenant) {
          ignorados++;
          continue;
       }
       
       let admissao = null;
       if (item.data_admissao) {
          try {
             const d = new Date(item.data_admissao);
             if (!isNaN(d.getTime())) admissao = d.toISOString().split('T')[0];
          } catch(e) {
             // ignora data invalida
          }
       }
       
       const detalhes = item.departamento 
         ? `sincronizacao_automatica - Departamento original: ${item.departamento}` 
         : 'sincronizacao_automatica';

       processaveis.push({
         tenant_id: currentTenant,
         nome: item.nome,
         nome_completo: item.nome,
         matricula: String(item.matricula),
         cargo: item.cargo || null,
         tipo_colaborador: "INTERMITENTE",
         tipo_contrato: "INTERMITENTE",
         status: "PENDENTE_COMPLEMENTO",
         status_cadastro: "PENDENTE_COMPLEMENTO",
         cadastro_provisorio: true,
         origem: "tio_digital",
         origem_dado: "tio_digital",
         origem_cadastro: "integracao_tio",
         origem_detalhe: detalhes,
         data_admissao: admissao,
         gera_faturamento: false,
         updated_at: new Date().toISOString()
       });
    }

    if (processaveis.length > 0) {
      const { error: upsertError } = await supabase
        .from('colaboradores')
        .upsert(processaveis, {
          onConflict: 'tenant_id,matricula',
          ignoreDuplicates: false
        });

      if (upsertError) {
         console.error("[ERROR] Upsert falhou:", upsertError);
         throw upsertError;
      }
    }

    // Registrar no historico_importacoes
    try {
      await supabase.from('historico_importacoes').insert({
        tenant_id,
        origem: "tio_digital_colaboradores",
        quantidade_registros: items.length,
        status: "PROCESSADO",
        logs: { 
           mensagem: "Importacao finalizada", 
           recebidos: items.length, 
           processados: processaveis.length, 
           ignorados: ignorados 
        }
      });
    } catch(e) {
      console.error("[WARNING] Falha ao gravar historico de importacao", e);
    }

    return new Response(JSON.stringify({
       success: true,
       message: "Sincronização de colaboradores Tio concluída.",
       recebidos: items.length,
       processados: processaveis.length,
       ignorados: ignorados
    }), {
       status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("[CRITICAL] Falha na Edge Function colaboradores Tio:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
