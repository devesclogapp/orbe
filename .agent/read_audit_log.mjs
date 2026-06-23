import fs from 'fs';

const envStr = fs.readFileSync('env_local_copy.txt', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const baseUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY.replace(/"/g, '');

async function fetchLogs() {
    const res = await fetch(`${baseUrl}/rest/v1/audit_log?select=*&limit=5`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const logs = await res.json();
    fs.writeFileSync('.agent/audit_res.json', JSON.stringify(logs, null, 2));
}

fetchLogs();
