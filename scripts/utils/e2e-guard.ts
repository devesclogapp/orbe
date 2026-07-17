import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROD_TENANT_ID = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';

export async function getE2EContext() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const testEmail = process.env.E2E_TEST_EMAIL;
    const testPassword = process.env.E2E_TEST_PASSWORD;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase env vars (URL ou ANON_KEY).");
    }

    if (!testEmail || !testPassword) {
        throw new Error(`
Acesso negado: Variáveis E2E_TEST_EMAIL e/ou E2E_TEST_PASSWORD não encontradas.
Os scripts E2E exigem autenticação real via Supabase Auth para respeitar o RLS.
Por favor, defina essas variáveis no seu .env.local.
        `.trim());
    }

    // Usar apenas a ANON_KEY (sem persistir sessão local para não poluir storage)
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Autenticar com o usuário de teste
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
    });

    if (authError || !authData.user) {
        throw new Error(`Falha na autenticação do E2E: ${authError?.message || 'Sem usuário'}`);
    }
    const userId = authData.user.id;

    const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', PROD_TENANT_ID)
        .single();
        
    let tenantId = tenantData?.id || PROD_TENANT_ID;

    console.log('tenantId usado:', tenantId);

    // Buscar a Empresa configurada como Teste/Homologação dentro desse Tenant
    const { data: emp, error: empErr } = await supabase
        .from('empresas')
        .select('id, nome, is_teste, cadastro_provisorio')
        .eq('tenant_id', tenantId)
        .eq('is_teste', true)
        .limit(1)
        .maybeSingle();

    let empresaId = emp?.id;

    if (!empresaId) {
        throw new Error("🚫 FAIL-FAST: Empresa de Homologação (is_teste=true) não econtrada dentro do Tenant da ESC LOG. As travas de E2E impedem o uso de empresas reais para testes. Pare o teste e crie a empresa de Sandbox primeiro.");
    }

    const manualOverride = process.env.E2E_EMPRESA_ID;
    if (manualOverride && manualOverride !== empresaId) {
        throw new Error("🚫 FAIL-FAST: A empresa informada via E2E_EMPRESA_ID no .env não corresponde à empresa oficial de Sandbox. Risco de escrita em produção detectado!");
    }

    return { supabase, tenantId, empresaId, userId };
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
