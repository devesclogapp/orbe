
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("Edge Function 'process-day' iniciada!")

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
    const { data_processamento, empresa_id } = await req.json()

    if (!data_processamento || !empresa_id) {
      return new Response(
        JSON.stringify({ error: "Parâmetros 'data_processamento' e 'empresa_id' são obrigatórios." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar colaboradores da empresa para filtrar corretamente
    const { data: colabs } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('empresa_id', empresa_id)
    
    const colabIds = colabs?.map(c => c.id) || []

    if (colabIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum colaborador encontrado para esta empresa", resultado: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 2. Buscar registros de ponto do dia
    const { data: pontos } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('data', data_processamento)
      .in('colaborador_id', colabIds)

    // 3. Buscar operações do dia
    const { data: operacoes } = await supabase
      .from('operacoes')
      .select('*')
      .eq('data', data_processamento)
      .in('responsavel_id', colabIds)

    // 4. Lógica de "IA" (Simulada)
    // Identificar inconsistências: colaborador com operações mas sem entrada de ponto
    let inconsistenciasContagem = 0
    let valor_total = 0

    const colabsComPonto = new Set(pontos?.map(p => p.colaborador_id))
    
    operacoes?.forEach(op => {
      valor_total += Number(op.quantidade) * Number(op.valor_unitario || 0)
      if (!colabsComPonto.has(op.responsavel_id)) {
        inconsistenciasContagem++
        // Opcional: Marcar operação como inconsistente
      }
    })

    // Adicionar inconsistências vindas do próprio status do ponto
    inconsistenciasContagem += pontos?.filter((p: any) => p.status === 'inconsistente').length || 0

    // 5. Salvar resultado do processamento
    const { data: resultado, error: errorResult } = await supabase
      .from('resultados_processamento')
      .upsert({
        data: data_processamento,
        empresa_id,
        valor_total_calculado: valor_total,
        total_operacoes: operacoes?.length || 0,
        contagem_inconsistencias: inconsistenciasContagem,
        status: 'processado'
      }, { onConflict: 'data,empresa_id' })
      .select()

    if (errorResult) throw errorResult

    return new Response(
      JSON.stringify({ message: "Processamento concluído", resultado }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
