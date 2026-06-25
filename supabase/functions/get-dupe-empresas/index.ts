import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: benevides, error: err1 } = await supabase
        .from('empresas')
        .select('*')
        .ilike('nome', '%BENEVIDES%');
        
    const { data: castanhal, error: err2 } = await supabase
        .from('empresas')
        .select('*')
        .ilike('nome', '%Castanhal%');

    return new Response(JSON.stringify({ 
        success: true, 
        benevides, 
        castanhal,
        errors: [err1, err2].filter(Boolean)
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
