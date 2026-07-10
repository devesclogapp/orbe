import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("=== INICIANDO E2E HML - IMPORTAÇÃO DE PONTOS ===");

    // 1. Procurar os colaboradores HML (para pegar Matricula / CPF e garantir roteamento adequado)
    const { data: cols, error: errCol } = await supabase
        .from('colaboradores')
        .select('id, nome, cpf, matricula, tenant_id, empresa_id')
        .like('nome', '%CLT-HML-%');

    if (errCol || !cols || cols.length === 0) {
        console.error("Nenhum colaborador HML encontrado com bypass de RLS!", errCol);
        return;
    }

    console.log(`Encontrados ${cols.length} colaboradores HML.`);
    const tenantId = cols[0].tenant_id;

    // Configurando Payload para a Função Edge
    // 001 - Jornada Normal (8h trabalhadas)
    // 002 - Hora Extra (10h trabalhadas, 2 extras)
    // 003 - Atraso (7h trabalhadas, 1 atraso)
    // 004 - Batidas Incompletas (Falta batida)
    // 005 - Jornada Especial / Falta (0h)

    // Para simplificar, vou extrair a data de ontem
    const dateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const payload = [];

    for (const c of cols) {
        let entrada = '08:00';
        let saida_almoco = '12:00';
        let retorno_almoco = '13:00';
        let saida = '17:00';
        let horas = '08:00';
        let extras = '00:00';
        let atraso = '00:00';
        let falta = '00:00';

        if (c.nome.includes('002')) {
            // Extra
            saida = '19:00';
            horas = '10:00';
            extras = '02:00';
        } else if (c.nome.includes('003')) {
            // Atraso
            entrada = '09:00';
            horas = '07:00';
            atraso = '01:00';
        } else if (c.nome.includes('004')) {
            // Batida Incompleta
            saida = null;
        } else if (c.nome.includes('005')) {
            // Falta
            entrada = null; saida_almoco = null; retorno_almoco = null; saida = null;
            horas = '00:00';
            falta = '08:00';
        }

        payload.push({
            tenant_id: tenantId,
            empresa_nome: 'HOMOLOGAÇÃO', // Fallback normalizado para match
            pessoa_nome: c.nome,
            pessoa_cpf: c.cpf,
            pessoa_matricula: c.matricula,
            data: dateStr,
            entrada,
            saida_almoco,
            retorno_almoco,
            saida,
            horas_trabalhadas: horas,
            hora_extra: extras,
            atraso: atraso,
            falta: falta
        });
    }

    console.log("Enviando Payload para importar-pontos-rhid...");

    // No SUPABASE local/remote edge function endpoint
    const functionUrl = `${supabaseUrl}/functions/v1/importar-pontos-rhid`;

    try {
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log("Resultado da Importação:", res.status, text);
    } catch (e) {
        console.error("Falha ao chamar a Edge Function:", e);
    }
}

run();
