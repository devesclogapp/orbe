
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("Edge Function 'process-day' iniciada!")

serve(async (req) => {
  try {
    const { data_processamento, empresa_id } = await req.json()

    if (!data_processamento || !empresa_id) {
      return new Response(
        JSON.stringify({ error: "Parâmetros 'data_processamento' e 'empresa_id' são obrigatórios." }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar registros de ponto do dia
    const { data: pontos } = await supabase
      .from('registros_ponto')
      .select('*, colaboradores(*)')
      .eq('data', data_processamento)
      .eq('colaboradores.empresa_id', empresa_id)

    // 2. Buscar operações do dia
    const { data: operacoes } = await supabase
      .from('operacoes')
      .select('*')
      .eq('data', data_processamento)
      .eq('responsavel_id', empresa_id) // Precisa de ajuste na query se o vínculo for indireto

    // 3. Lógica de "IA" (Simulada por enquanto)
    // Aqui cruzaríamos dados para achar inconsistências
    let inconsistencias = 0
    let valor_total = 0

    // Exemplo: calcular valor total de operações
    operacoes?.forEach(op => {
      valor_total += Number(op.quantidade) * Number(op.valor_unitario || 0)
    })

    // 4. Salvar resultado do processamento
    const { data: resultado, error: errorResult } = await supabase
      .from('resultados_processamento')
      .upsert({
        data: data_processamento,
        empresa_id,
        valor_total_calculado: valor_total,
        total_operacoes: operacoes?.length || 0,
        contagem_inconsistencias: inconsistencias,
        status: 'processado'
      })
      .select()

    return new Response(
      JSON.stringify({ message: "Processamento concluído", resultado }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    )
  }
})
