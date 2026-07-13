import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findCorrupted() {
  const { data, error } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('*')
    .is('empresa_id', null);
    
  console.log("Error:", error);
  console.log("Batches with empresa_id = null:");
  console.dir(data, { depth: null });
  
  const { data: all, error: allErr } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, empresa_id')
    .limit(5);
  console.log("Sample batches:", all);
}

findCorrupted();
