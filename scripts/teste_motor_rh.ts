import { processRhPeriod } from '../src/services/rhProcessing.service';
import { supabase } from '../src/lib/supabase';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    console.log("=== INICIANDO TESTE MOTOR RH ===");

    const { data: empHml } = await supabase.from('empresas').select('id, tenant_id').eq('nome', 'HOMOLOGAÇÃO').single();
    if (!empHml) throw new Error("Empresa HOMOLOGAÇÃO não encontrada!");

    const tenantId = empHml.tenant_id;
    const empresaId = empHml.id;

    // Load colaboradores and regras
    const { data: colaboradores } = await supabase.from('colaboradores').select('*').eq('tenant_id', tenantId);
    const { data: regras } = await supabase.from('banco_horas_regras').select('*').eq('tenant_id', tenantId);

    // Mês onde criamos o mock no script de seeding:
    const dataHmlStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const month = dataHmlStr.slice(0, 7);

    console.log(`Processando competencia ${month} para tenant ${tenantId}...`);
    try {
        const result = await processRhPeriod({
            tenantId,
            month,
            empresaId,
            empresas: [empHml],
            colaboradores: colaboradores || [],
            regras: regras || [],
            executionType: 'automatica'
        });

        console.log("=== RESULTADO DO MOTOR RH ===");
        console.dir(result, { depth: null });
        
        console.log("\n-> Auditoria de Saldos Gerados:");
        const { data: saldos } = await supabase.from('banco_horas_saldos').select('colaborador_id, saldo_atual_minutos, horas_positivas_minutos, horas_negativas_minutos').eq('empresa_id', empresaId);
        
        if (saldos) {
            for (const s of saldos) {
                const colab = colaboradores?.find(c => c.id === s.colaborador_id);
                console.log(`[${colab?.nome}] Saldo: ${s.saldo_atual_minutos}min | Crédito: ${s.horas_positivas_minutos}min | Débito: ${s.horas_negativas_minutos}min`);
            }
        }
        
    } catch (e) {
        console.error("ERRO CRITICO MOTOR RH:", e.message || e);
    }
}
run();
