import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
   throw new Error("Missing Supabase env vars");
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function setupHomologation() {
   let tenantId = null;

   // Search for existing
   const { data: tenant } = await supabase.from('tenants').select('id, nome').ilike('nome', '%homologacao%').limit(1).maybeSingle();
   
   if (!tenant) {
      console.log("Tenant Homologação not found. Creating...");
      const { data: newTenant, error: tErr } = await supabase.from('tenants').insert({
         nome: 'ESC LOG (Homologação)',
         status: 'ativo'
      }).select().single();
      
      if (tErr) throw tErr;
      tenantId = newTenant.id;
      console.log(`Created Tenant: ESC LOG (Homologação) - ID: ${tenantId}`);
   } else {
      tenantId = tenant.id;
      console.log(`Found existing Tenant: ${tenant.nome} - ID: ${tenantId}`);
   }

   // Search for existing company
   const { data: emp } = await supabase.from('empresas').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
   
   if (!emp) {
      console.log("Homologation Company not found. Creating...");
      const { data: newEmp, error: eErr } = await supabase.from('empresas').insert({
         tenant_id: tenantId,
         nome: 'Empresa Teste E2E HML',
         cnpj: '00000000000100',
         status: 'ativa',
         cadastro_provisorio: false
      }).select().single();
      
      if (eErr) throw eErr;
      console.log(`Created Company: Empresa Teste E2E HML - ID: ${newEmp.id}`);
   } else {
      console.log(`Found existing Company - ID: ${emp.id}`);
   }
}

setupHomologation().catch(console.error);
