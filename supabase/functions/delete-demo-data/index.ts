
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("Edge Function 'delete-demo-data' iniciada!")

serve(async (req: any) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lote_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const queryParams = lote_id ? { lote_id } : { is_teste: true }
    
    // Lista de tabelas para limpar (na ordem correta para FK)
    const tables = [
      'operacoes_producao_colaboradores',
      'production_entry_collaborators',
      'operacoes_producao',
      'operacoes',
      'registros_ponto',
      'banco_horas_eventos',
      'financeiro_consolidados_cliente',
      'financeiro_consolidados_colaborador',
      'faturas',
      'clientes',
      'coletores',
      'equipes',
      'unidades',
      'banco_horas_regras',
      'resultados_processamento',
      'financeiro_competencias',
      'financeiro_regras',
      'financeiro_snapshots',
      'lotes_remessa',
      'lotes_retorno',
      'auditoria',
      'fornecedor_valores_servico',
      'fornecedores',
      'tipos_servico_operacionais',
      'config_tipos_operacao',
      'config_produtos',
      'config_tipos_dia',
      'colaboradores',
      'empresas'
    ]

    const totais_excluidos: any = {}

    for (const table of tables) {
      try {
        const { count, error: countError } = await supabase.from(table).select('*', { count: 'exact', head: true }).match(queryParams)
        if (countError) throw countError;

        const { error: deleteError } = await supabase.from(table).delete().match(queryParams)
        if (deleteError) throw deleteError;

        totais_excluidos[table] = count || 0
      } catch (err: any) {
        console.warn(`[Delete Demo Data] Ignore error for table ${table}:`, err.message)
      }
    }

    if (lote_id) {
        await supabase.from('demo_lotes').delete().eq('id', lote_id)
    } else {
        await supabase.from('demo_lotes').delete().neq('id', '00000000-0000-0000-0000-000000000000') 
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        totais_excluidos: {
            ...totais_excluidos,
            lotes: lote_id ? 1 : 'todos'
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error: any) {
    console.error(error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
