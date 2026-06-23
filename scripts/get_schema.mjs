import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function fetchSchema() {
    const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(url);
    const text = await res.json();
    fs.writeFileSync('schema_rest.json', JSON.stringify(text.definitions.clientes.properties, null, 2));
}

fetchSchema();
