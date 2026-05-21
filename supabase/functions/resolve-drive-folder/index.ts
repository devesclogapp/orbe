
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("Edge Function 'resolve-drive-folder' iniciada!")

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { folder_id } = await req.json()

    if (!folder_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "INVALID_INPUT", 
          message: "O parâmetro 'folder_id' é obrigatório." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Localizar coletor pelo folder_entrada_id
    const { data: coletor, error } = await supabase
      .from('coletores')
      .select('*, empresa:empresas(*), unidade:unidades_operacionais(*)')
      .eq('folder_entrada_id', folder_id)
      .maybeSingle()

    if (error) {
      console.error("Erro ao buscar coletor:", error)
      throw error
    }

    // 2. Validar existência
    if (!coletor) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "FOLDER_NOT_FOUND", 
          message: "Nenhum coletor ativo encontrado para este folder_id." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      )
    }

    // 3. Validar integração ativa e tipo
    if (!coletor.integracao_ativa) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "INTEGRATION_DISABLED", 
          message: "Integração do coletor está desativada." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      )
    }

    if (coletor.tipo_integracao !== 'google_drive') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "INVALID_INTEGRATION_TYPE", 
          message: "Este coletor não está configurado para integração via Google Drive." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // 4. Retornar payload operacional padronizado
    return new Response(
      JSON.stringify({
        success: true,
        empresa_id: coletor.empresa_id,
        cliente_id: coletor.empresa?.cliente_id || null,
        unidade_id: coletor.unidade_id,
        coletor_id: coletor.id,
        modelo: coletor.modelo,
        numero_serie: coletor.serie,
        fabricante: coletor.fabricante,
        tipo_integracao: coletor.tipo_integracao,
        formato_arquivo: coletor.formato_arquivo,
        folder_entrada_id: coletor.folder_entrada_id,
        folder_processados_id: coletor.folder_processados_id,
        folder_erros_id: coletor.folder_erros_id,
        integracao_ativa: coletor.integracao_ativa,
        intervalo_sincronizacao_minutos: coletor.intervalo_sincronizacao_minutos
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    console.error("Internal Server Error:", error)
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
