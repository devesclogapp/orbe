import dotenv from "dotenv";
import { getE2EContext } from "./utils/e2e-guard.ts";

dotenv.config();

async function runTest() {
    console.log("Starting E2E Intermitentes Test...");
    
    const { supabase, tenantId: tenant_id } = await getE2EContext();
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
