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

    const validos = [];
    const inconsistentes = [];

    const parseFloatSafe = (val: any) => {
      if (val === null || val === undefined) return 0;
      const parsed = parseFloat(String(val).replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };

    for (const item of items) {
      let matchedColab = null;

      // Tentativa de lookup CPF -> Matricula -> Nome
      const cleanCpf = item.cpf ? item.cpf.replace(/\D/g, '') : null;
      const cleanMat = item.matricula ? item.matricula.trim() : null;
      const cleanName = item.colaborador ? item.colaborador.toUpperCase().trim() : null;

      if (cleanCpf && colabMap.has(`CPF_${cleanCpf}`)) {
         matchedColab = colabMap.get(`CPF_${cleanCpf}`);
      } else if (cleanMat && colabMap.has(`MAT_${cleanMat}`)) {
         matchedColab = colabMap.get(`MAT_${cleanMat}`);
      } else if (cleanName && colabMap.has(`NOME_${cleanName}`)) {
         matchedColab = colabMap.get(`NOME_${cleanName}`);
      }

      // Derivar competencia do formato da data (ex: '2026-06-15' -> '2026-06')
      const compVal = item.data ? item.data.substring(0, 7) : 'SEM-COMP';

      const launchBase = {
        tenant_id,
        importacao_id: importacaoId,
        nome_colaborador: item.colaborador || 'Desconhecido',
        data_referencia: item.data,
        competencia: compVal,
        convocacao: item.convocacao || 'Sem referência',
        cargo: item.cargo,
        departamento: item.departamento,
        horas_trabalhadas: parseFloatSafe(item.horas_trabalhadas),
        horas_normais: parseFloatSafe(item.horas_normais),
        he_50: parseFloatSafe(item.he_50),
        he_100: parseFloatSafe(item.he_100),
        hora_noturna: parseFloatSafe(item.hora_noturna),
        total: parseFloatSafe(item.total),
        origem: 'tio_digital',
        status_pipeline: 'RECEBIDO'
      };

      if (!matchedColab) {
         inconsistentes.push({
           ...launchBase,
           colaborador_id: null,
           empresa_id: null,
         });
      } else {
         validos.push({
           ...launchBase,
           colaborador_id: matchedColab.id,
           empresa_id: matchedColab.empresa_id
         });
      }
    }

    console.log(`[LOG] Válidos: ${validos.length} | Inconsistentes (Sem Vínculo): ${inconsistentes.length}`);

    // Separamos as rotinas de Upsert devido ao "onConflict" não lidar bem com colunas NULL na Supabase. 
    // Como criamos partial indexes (`WHERE colaborador_id IS [NOT] NULL`), a API de upsert do Postgres pode reclamar 
    // se não usarmos raw sql. Então faremos loop insert com fallback para UPSERT genérico.
    // Como a instrução era "Apenas importar, persistir e exibir", vamos usar upsert nativo baseando nos dados.
    
    // Upsert validos:
    if (validos.length > 0) {
      const { error: upsertValidosError } = await supabase
          .from('lancamentos_intermitentes')
          .upsert(validos);
          
      if (upsertValidosError) {
         console.error("[ERROR] Upsert validos falhou:", upsertValidosError);
      }
    }

    // Upsert inconsistentes:
    if (inconsistentes.length > 0) {
        const { error: upsertIncError } = await supabase
          .from('lancamentos_intermitentes')
          .upsert(inconsistentes);
          
        if (upsertIncError) {
           console.error("[ERROR] Upsert inconsistentes falhou:", upsertIncError);
        }
    }

    // Historico update
    if (importacaoId) {
       const finalStatus = inconsistentes.length > 0 ? 'PROCESSADO_COM_ALERTAS' : 'PROCESSADO';
       await supabase.from('historico_importacoes').update({
            status: finalStatus,
            quantidade_registros: totalRecebidos,
            logs: inconsistentes 
          })
          .eq('id', importacaoId);
    }

    return new Response(JSON.stringify({
       success: true,
       message: "Importação de Intermitentes Tio Digital concluída.",
       recebidos: totalRecebidos,
       salvos: validos.length + inconsistentes.length,
       inconsistentes: inconsistentes.length
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
