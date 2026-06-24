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
       const empNome = item.empresa_nome || item.empresa || item.razao_social || item.nome_empresa;
       const unidade = item.unidade;
       const dep = item.departamento;

       const nomeBase = empNome || unidade || dep || 'Empresa Tio Digital';
       const mapKey = empId || numCnpj || nomeBase.toUpperCase().trim();

       if (!empresasUnicas.has(mapKey)) {
          empresasUnicas.set(mapKey, {
             id: empId,
             cnpj: numCnpj,
             nome: nomeBase,
             dbId: null
          });
       }
       item._empresaMapKey = mapKey;
    }

    let empresas_criadas = 0;
    let empresas_vinculadas = 0;
    let colaboradores_sem_empresa = 0;

    const { data: dbEmpresas, error: errEmp } = await supabase
      .from('empresas')
      .select('id, nome, cnpj')
      .eq('tenant_id', tenant_id);

    if (!errEmp && dbEmpresas) {
      for (const emp of empresasUnicas.values()) {
         let matched = null;
         if (emp.id) matched = dbEmpresas.find(e => e.id === emp.id);
         if (!matched && emp.cnpj) matched = dbEmpresas.find(e => (e.cnpj || '').replace(/\D/g, '') === emp.cnpj);
         if (!matched && emp.nome) matched = dbEmpresas.find(e => e.nome.toUpperCase().trim() === emp.nome.toUpperCase().trim());
         
         if (matched) {
            emp.dbId = matched.id;
            empresas_vinculadas++;
         }
      }
    }

    // --- ETAPA 3: CRIAÇÃO AUTOMÁTICA DE EMPRESAS ---
    for (const emp of empresasUnicas.values()) {
       if (!emp.dbId) {
          const insertPayload = {
             tenant_id: tenant_id,
             nome: emp.nome,
             status: 'ATIVA'
          };
          if (emp.cnpj) insertPayload.cnpj = emp.cnpj;
          
          let { data: inEmp, error: inErr } = await supabase
             .from('empresas')
             .insert({ ...insertPayload, origem: 'tio_digital', origem_cadastro: 'integracao_tio', cadastro_provisorio: true })
             .select('id').single();
             
          if (inErr) {
             let { data: inR2, error: err2 } = await supabase
                .from('empresas')
                .insert({ ...insertPayload, origem: 'tio_digital' })
                .select('id').single();
             inEmp = inR2;
             if (err2) {
                 const { data: inR3 } = await supabase.from('empresas').insert({ tenant_id, nome: emp.nome }).select('id').single();
                 inEmp = inR3;
             }
          }
          
          if (inEmp) {
             emp.dbId = inEmp.id;
             empresas_criadas++;
             empresas_vinculadas++;
          }
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
