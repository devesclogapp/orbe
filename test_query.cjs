const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('tipos_servico_operacional')
        .select('*')
        .limit(5);

    if (error) console.error(error);
    else {
        console.log("Keys available:", Object.keys(data[0]));
        console.log("Sample data:", JSON.stringify(data, null, 2));
    }
}

run();
