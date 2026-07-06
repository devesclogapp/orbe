import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function patchCompetencia() {
    console.log("Fetching receitas missing competencia...");
    const { data: receitas, error } = await supabase
        .from('receitas_operacionais')
        .select('id, created_at')
        .is('competencia', null);

    if (error) {
        console.error("Error fetching:", error);
        return;
    }

    console.log(`Found ${receitas.length} records. Backfilling...`);

    for (const rec of receitas) {
        const comp = rec.created_at.substring(0, 7);
        const { error: updateErr } = await supabase
            .from('receitas_operacionais')
            .update({ competencia: comp })
            .eq('id', rec.id);

        if (updateErr) {
            console.error(`Failed to update ${rec.id}:`, updateErr);
        }
    }

    console.log("Backfill complete!");
}

patchCompetencia();
