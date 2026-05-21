
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
      console.error("[resolve-drive-folder] folder_id ausente no payload");
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

    // 1. Localizar coletor pelo folder_entrada_id (Query Manual para evitar erro de schema cache)
    console.log(`[resolve-drive-folder] Buscando coletor para folder_id: ${folder_id}`);
    const { data: coletor, error: coletorError } = await supabase
      .from('coletores')
      .select('*')
      .eq('folder_entrada_id', folder_id)
      .eq('tipo_integracao', 'google_drive')
      .maybeSingle()

    if (coletorError) {
      console.error("[resolve-drive-folder] Erro ao buscar coletor:", coletorError)
      throw coletorError
    }

    // 2. Validar existência
    if (!coletor) {
      console.warn(`[resolve-drive-folder] Coletor não encontrado para folder_id: ${folder_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "FOLDER_NOT_FOUND", 
          message: "Nenhum coletor ativo encontrado para este folder_id." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      )
    }

    // 3. Validar integração ativa
    if (!coletor.integracao_ativa) {
      console.warn(`[resolve-drive-folder] Integração desativada para o coletor: ${coletor.id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "INTEGRATION_DISABLED", 
          message: "Integração do coletor está desativada." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      )
    }

    // 4. Buscar empresa separadamente
    let empresa_nome = null;
    if (coletor.empresa_id) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('nome')
        .eq('id', coletor.empresa_id)
        .maybeSingle();
      empresa_nome = empresa?.nome || null;
    }

    // 5. Buscar unidade separadamente
    let unidade_nome = null;
    if (coletor.unidade_id) {
      const { data: unidade } = await supabase
        .from('unidades_operacionais')
        .select('nome')
        .eq('id', coletor.unidade_id)
        .maybeSingle();
      unidade_nome = unidade?.nome || null;
    }

    console.log(`[resolve-drive-folder] Contexto resolvido com sucesso: Coletor ${coletor.id}`);

    // 6. Retornar payload operacional padronizado montado manualmente
    return new Response(
      JSON.stringify({
        success: true,
        empresa_id: coletor.empresa_id,
        empresa_nome: empresa_nome,
        unidade_id: coletor.unidade_id,
        unidade_nome: unidade_nome,
        coletor_id: coletor.id,
        modelo: coletor.modelo,
        numero_serie: coletor.serie,
        fabricante: coletor.fabricante,
        tipo_integracao: coletor.tipo_integracao,
        formato_arquivo: coletor.formato_arquivo,
        folder_entrada_id: coletor.folder_entrada_id,
        folder_processados_id: coletor.folder_processados_id,
        folder_erros_id: coletor.folder_erros_id,
        integracao_ativa: coletor.integracao_ativa
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    console.error("[resolve-drive-folder] Internal Server Error:", error)
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
