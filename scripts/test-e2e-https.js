import https from 'https';
import fs from 'fs';
import path from 'path';
import { getE2EContext } from './utils/e2e-guard.ts';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'] || process.env.SUPABASE_URL;
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing env.");
    process.exit(1);
}

const hostname = SUPABASE_URL.replace('https://', '');

function querySupabase(endpoint, method = 'GET', body = null, prefer = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname,
            port: 443,
            path: `/rest/v1/${endpoint}`,
            method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        if (prefer) {
            options.headers['Prefer'] = prefer;
        }

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try { if (data) parsed = JSON.parse(data); } catch (e) { }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(parsed);
                } else {
                    reject({ statusCode: res.statusCode, body: parsed });
                }
            });
        });

        req.on('error', e => reject(e));
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    try {
        console.log("=== INICIANDO HOMOLOGAÇÃO E2E INTERMITENTES (HTTPS) ===");
        const { tenantId: tId, empresaId: empId } = await getE2EContext();
        console.log("Tenant:", tId);

        const payload = {
            tenant_id: tId,
            empresa_id: empId,
            nome_colaborador: 'E2E INTERMITENTE TEST',
            data_referencia: '2026-06-02',
            competencia: '2026-06',
            convocacao: 'Carga e descarga',
            horas_trabalhadas: 8,
            total: 100.00,
            origem: 'teste_e2e_https',
            status_pipeline: 'RECEBIDO'
        };

        // 4.1 Insert (returns id)
        const inserted = await querySupabase('lancamentos_intermitentes', 'POST', payload, 'return=representation');
        if (!inserted || inserted.length === 0) throw new Error("Insert failed");
        const lanc_id = inserted[0].id;
        console.log("✅ 4.1 Importação: Criado lancamento", lanc_id);

        // 4.3 Fechar Período
        const lote = await querySupabase('intermitentes_lotes_fechamento', 'POST', {
            tenant_id: tId,
            empresa_id: empId,
            competencia: '2026-06',
            quantidade_intermitentes: 1,
            valor_total: 100.00,
            status: 'AGUARDANDO_VALIDACAO_RH'
        }, 'return=representation');
        const lote_id = lote[0].id;
        console.log("✅ 4.3 Fechamento: Lote criado", lote_id);

        await querySupabase(`lancamentos_intermitentes?id=eq.${lanc_id}`, 'PATCH', {
            status_pipeline: 'EM_ANALISE_RH',
            lote_fechamento_id: lote_id
        });

        // 4.4 Aprovação RH
        await querySupabase(`intermitentes_lotes_fechamento?id=eq.${lote_id}`, 'PATCH', { status: 'VALIDADO_RH' });
        await querySupabase(`lancamentos_intermitentes?id=eq.${lanc_id}`, 'PATCH', { status_pipeline: 'APROVADO_RH' });
        console.log("✅ 4.4 Aprovação RH: Concluído");

        // 4.5 Aprovação Financeira
        await querySupabase(`intermitentes_lotes_fechamento?id=eq.${lote_id}`, 'PATCH', { status: 'FECHADO_FINANCEIRO' });
        await querySupabase(`lancamentos_intermitentes?id=eq.${lanc_id}`, 'PATCH', { status_pipeline: 'ENVIADO_FINANCEIRO' });
        console.log("✅ 4.5 Aprovação Financeira: Concluído");

        // 4.6 CNAB
        await querySupabase(`intermitentes_lotes_fechamento?id=eq.${lote_id}`, 'PATCH', { status: 'CNAB_GERADO' });
        console.log("✅ 4.6 CNAB Gerado: Concluído");

        // 4.8 Conciliação -> PAGO
        await querySupabase(`lancamentos_intermitentes?id=eq.${lanc_id}`, 'PATCH', { status_pipeline: 'PAGO' });
        console.log("✅ 4.8 Pagamento Lancamento: Check constraint validada!");
        await querySupabase(`intermitentes_lotes_fechamento?id=eq.${lote_id}`, 'PATCH', { status: 'PAGO' });
        console.log("✅ 4.8 Pagamento Lote: Validadado!");

        console.log("=== TESTE CONCLUÍDO COM SUCESSO ===");
    } catch (e) {
        console.error("ERRO TESTE:", e);
    }
}
run();
