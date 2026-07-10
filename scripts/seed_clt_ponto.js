import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    try {
        console.log("=== SEEDING PONTOS CLT HML ===");

        // Fetch HML Company and Tenant
        const { data: empHml } = await supabase.from('empresas').select('id, tenant_id').eq('nome', 'HOMOLOGAÇÃO').single();
        if (!empHml) throw new Error("Empresa HOMOLOGAÇÃO não encontrada!");

        const tenantId = empHml.tenant_id;
        const empId = empHml.id;

        // Fetch Colabs
        const { data: cols } = await supabase.from('colaboradores').select('id, nome, cpf, matricula').eq('empresa_id', empId);

        console.log(`Colaboradores achados: ${cols?.length || 0}`);

        const dateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // 1. Criar historico_importacoes
        const { data: hist } = await supabase.from('historico_importacoes').insert({
            tenant_id: tenantId,
            origem: 'api',
            workflow: 'importar-pontos-rhid',
            nome_arquivo: `payload_seeder_${Date.now()}.json`,
            quantidade_recebida: cols.length,
            quantidade_importada: cols.length,
            status: 'PROCESSADO',
            processado_em: new Date().toISOString(),
            finalizado_em: new Date().toISOString()
        }).select('id').single();

        const importacaoId = hist.id;

        const pts = [];

        for (let c of cols) {
            let entrada = '08:00', saida_almoco = '12:00', retorno_almoco = '13:00', saida = '17:00';
            let horas = '08:00', ext = '00:00', atr = '00:00', flt = '00:00';

            if (c.nome.includes('002')) { saida = '19:00'; horas = '10:00'; ext = '02:00'; }
            if (c.nome.includes('003')) { entrada = '09:00'; horas = '07:00'; atr = '01:00'; }
            if (c.nome.includes('004')) { saida = null; horas = '04:00'; }
            if (c.nome.includes('005')) { entrada = null; saida_almoco = null; retorno_almoco = null; saida = null; horas = '00:00'; flt = '08:00'; }

            pts.push({
                tenant_id: tenantId,
                importacao_id: importacaoId,
                chave_importacao: `seeder_${c.id}_${dateStr}`,
                data: dateStr,
                competencia: dateStr.slice(0, 7),
                entrada, saida_almoco, retorno_almoco, saida,
                origem: 'api',
                status: 'pendente',
                status_processamento: 'pendente',
                nome_colaborador: c.nome,
                matricula_colaborador: c.matricula,
                cpf_colaborador: c.cpf,
                empresa_nome: 'HOMOLOGAÇÃO',
                empresa_id: empId,
                colaborador_id: c.id,
                horas_trabalhadas: horas,
                hora_extra: ext,
                atraso: atr,
                falta: flt,
                observacoes: "Seed HML direto",
                inconsistencias: null
            });
        }

        const { error } = await supabase.from('registros_ponto').insert(pts);
        if (error) throw error;

        console.log("SUCESSO: Pontos HML semeados.");
    } catch (e) {
        console.error("ERRO:", e.message || e);
    } finally {
        setTimeout(() => process.exit(0), 100);
    }
}

run();
