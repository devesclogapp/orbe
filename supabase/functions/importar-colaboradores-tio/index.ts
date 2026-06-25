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

    // --- ETAPA 1 E 2: RESOLUÇÃO DA EMPRESA ---
    const empresasUnicas = new Map();

    for (const item of items) {
       const currentTenant = item.tenant_id || tenant_id;
       if (!item.nome || !item.matricula || !currentTenant) {
          continue; // tratado no loop principal
       }

       const empId = item.empresa_id;
       const empCnpj = item.empresa_cnpj || item.cnpj;
       const numCnpj = empCnpj ? String(empCnpj).replace(/\D/g, '') : null;
       const empNomeExplicito = item.empresa_nome || item.empresa || item.razao_social || item.nome_empresa;

       const nomeBase = empNomeExplicito || item.departamento || item.unidade || 'Empresa Tio Digital';
       const mapKey = empId || numCnpj || String(nomeBase).toUpperCase().trim();

       let origemDetalhe: string | undefined = undefined;
       if (!empNomeExplicito) {
          if (item.departamento) {
             origemDetalhe = `Empresa provisória criada via departamento Tio Digital: ${item.departamento}`;
          } else if (item.unidade) {
             origemDetalhe = `Empresa provisória criada via unidade Tio Digital: ${item.unidade}`;
          }
       }

       if (!empresasUnicas.has(mapKey)) {
          empresasUnicas.set(mapKey, {
             id: empId,
             cnpj: numCnpj,
             nome: nomeBase,
             dbId: null,
             origemDetalhe
          });
       }
       item._empresaMapKey = mapKey;
    }

    let empresas_criadas = 0;
    let empresas_vinculadas = 0;
    let colaboradores_sem_empresa = 0;

    // --- ETAPA 2 E 3 UNIFICADAS: RESOLUÇÃO E CRIAÇÃO ATÔMICA (ANTI-RACE-CONDITION) ---
    for (const emp of empresasUnicas.values()) {
        // Tentamos usar a Função RPC segura primeiro
        const { data: empId, error: rpcErr } = await supabase.rpc('ensure_empresa_provisoria', {
            p_tenant_id: tenant_id,
            p_nome: emp.nome,
            p_cnpj: emp.cnpj || null,
            p_origem_detalhe: emp.origemDetalhe || null,
            p_origem: 'tio_digital',
            p_origem_cadastro: 'integracao_tio'
        });

        if (rpcErr) {
            console.error(`[WARNING] RPC ensure_empresa_provisoria falhou para ${emp.nome}. Fallback ativado. Erro:`, rpcErr);
            // Fallback de contingência caso a função SQL ainda não tenha sido rodada no banco
            const { data: chkData, error: chkErr } = await supabase
              .from('empresas')
              .select('id')
              .eq('tenant_id', tenant_id)
              .ilike('nome', `%${emp.nome.trim()}%`)
              .limit(1)
              .maybeSingle();

            if (chkErr) {
               console.error("[CRITICAL] Falha no fallback ao buscar empresa:", chkErr);
               // Interromper no lugar de gerar duplicatas cegas (Falha Silenciosa fixada)
               throw new Error(`Falha crística de banco ao buscar empresa ${emp.nome}: ${chkErr.message}`);
            }

            if (chkData?.id) {
               emp.dbId = chkData.id;
               empresas_vinculadas++;
            } else {
               // Inserção fallback (Sujeito a race-condition se houver muitos)
               const { data: inEmp, error: inErr } = await supabase
                 .from('empresas')
                 .insert({
                     tenant_id: tenant_id,
                     nome: emp.nome,
                     status: 'ATIVA',
                     cnpj: emp.cnpj,
                     origem_detalhe: emp.origemDetalhe,
                     origem: 'tio_digital',
                     origem_cadastro: 'integracao_tio',
                     cadastro_provisorio: true
                 })
                 .select('id').single();

               if (inEmp) {
                  emp.dbId = inEmp.id;
                  empresas_criadas++;
                  empresas_vinculadas++;
               } else {
                  throw new Error(`Falha ao inserir empresa fallback: ${inErr?.message}`);
               }
            }
        } else if (empId) {
            emp.dbId = empId;
            empresas_vinculadas++;
            // Nota: não temos como saber se foi recem-criada no RPC (a menos que a gnt retorne um TYPE RECORD no SQL), 
            // mas o importante é a integridade.
        }
    }

    // --- ETAPA 4: VINCULAR EMPRESA AO COLABORADOR ---
    for (const item of items) {
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

       const empRef = empresasUnicas.get(item._empresaMapKey);
       const finalEmpresaId = empRef ? empRef.dbId : null;

       if (!finalEmpresaId) colaboradores_sem_empresa++;

       processaveis.push({
         tenant_id: currentTenant,
         empresa_id: finalEmpresaId,
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
           ignorados: ignorados,
           empresas_criadas,
           empresas_vinculadas,
           colaboradores_sem_empresa
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
       ignorados: ignorados,
       empresas_criadas,
       empresas_vinculadas,
       colaboradores_sem_empresa
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
