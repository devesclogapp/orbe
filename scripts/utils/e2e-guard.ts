import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

export async function getE2EContext() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    let tenantId = process.env.E2E_TENANT_ID;
    
    if (!tenantId) {
        const { data } = await supabase
            .from('tenants')
            .select('id, nome')
            .ilike('nome', '%homologacao%')
            .limit(1)
            .maybeSingle();

        if (data) {
            tenantId = data.id;
        } else {
            console.log("Tenant Homologação não encontrado. Criando base isolada automática...");
            const { data: newTenant, error: tErr } = await supabase.from('tenants').insert({
                nome: 'ESC LOG (Homologação)',
                status: 'ativo'
            }).select().single();
            if (tErr) throw new Error("Erro ao criar tenant HML: " + tErr.message);
            tenantId = newTenant.id;
            console.log(`✅ Tenant de Homologação Criado com sucesso (${tenantId})`);
        }
    }

    if (tenantId === PROD_TENANT_ID) {
        throw new Error("🚫 FAIL-FAST: O tenantId retornado pertence à Produção ESC LOG! " +
                        "Tentativa de Bypass detectada (E2E_TENANT_ID apontando para PROD). Teste E2E abortado.");
    }

    const { data: emp } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
    let empresaId = emp?.id;

    if (!empresaId) {
        console.log("Empresa de Teste não encontrada. Criando...");
        const { data: newEmp, error: eErr } = await supabase.from('empresas').insert({
            tenant_id: tenantId,
            nome: 'Empresa Teste E2E HML',
            cnpj: '00000000000100',
            status: 'ativa',
            cadastro_provisorio: false
        }).select().single();
        if (eErr) throw new Error("Erro ao criar empresa HML: " + eErr.message);
        empresaId = newEmp.id;
        console.log(`✅ Empresa de Homologação Criada (${empresaId})`);
    }

    return { supabase, tenantId, empresaId };
}

// For quick CLI check if run explicitly
if (import.meta.url === `file://${process.argv[1]}`) {
   getE2EContext().then(ctx => {
      console.log(`[E2E-GUARD] Success! Tenant: ${ctx.tenantId} | Empresa: ${ctx.empresaId}`);
      process.exit(0);
   }).catch(e => {
      console.error(e.message);
      process.exit(1);
   });
}
