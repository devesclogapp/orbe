const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function run() {
    console.log("Conectando...");

    // GET
    let res = await fetch(`${url}/rest/v1/operacoes_producao?select=id,quantidade,nf_numero,status&order=criado_em.desc&limit=1`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    let operations = await res.json();
    console.log("Operations found:", operations);

    if (!operations || !operations[0]) return;
    const op = operations[0];
    const newQty = (op.quantidade || 0) + 10;
    const newNf = op.nf_numero === "SIM" ? "NÃO" : "SIM";

    // PATCH
    console.log(`Update to ${newQty} and ${newNf}`);
    res = await fetch(`${url}/rest/v1/operacoes_producao?id=eq.${op.id}`, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ quantidade: newQty, nf_numero: newNf })
    });

    console.log("PATCH status:", res.status);
    let patchRes = await res.text();
    console.log("PATCH res:", patchRes);

    // Reverter
    await fetch(`${url}/rest/v1/operacoes_producao?id=eq.${op.id}`, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ quantidade: op.quantidade, nf_numero: op.nf_numero })
    });
}
run().catch(console.error);
