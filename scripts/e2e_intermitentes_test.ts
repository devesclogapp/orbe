// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing Supabase env vars");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
    console.log("Starting E2E Intermitentes Test...");
    
    // 0. Setup: Get test tenant and user (Service role is preferred, or test credentials)
    // We assume the script is run with valid env or we can just fetch some data
    const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single();
    if (!tenantData) {
        console.error("No tenant found");
        return;
    }
    const tenant_id = tenantData.id;
    console.log("Tenant:", tenant_id);

    const { data: authUser } = await supabase.auth.getSession();
    console.log("Is Authenticated?", !!authUser.session);

    // If not authenticated and we don't have service role, this script might fail due to RLS.
    // Let's assume we can fetch data since policies might allow read for test or we use service role.

    // Let's print out what we can see from lancamentos_intermitentes
    const { data: lancamentos, error: errLancamentos } = await supabase
        .from('lancamentos_intermitentes')
        .select('*')
        .limit(5);

    if (errLancamentos) {
        console.error("Error reading lancamentos:", errLancamentos);
    } else {
        console.log("Found lancamentos:", lancamentos?.length);
    }
}

runTest().catch(console.error);
