import { getE2EContext } from './utils/e2e-guard.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    console.log("=== BUSCANDO DADOS REAIS DE CLT ===");
    const { supabase, tenantId: tId } = await getE2EContext();

    // Buscar empresas
    const { data: empresas } = await supabase.from('empresas').select('id, nome').eq('tenant_id', tId);
    console.log("Empresas reais (Qtd:", empresas.length, ")");

    // Buscar Colaboradores REAIS (nao HML) CLT
    const { data: colaboradores } = await supabase.from('colaboradores')
        .select('id, nome, cpf, matricula')
        .eq('tenant_id', tId)
        .eq('tipo', 'CLT')
        .not('nome', 'ilike', '%HML%')
        .limit(10);

    console.log("Colaboradores reais CLT (Amostra):");
    console.table(colaboradores.map(c => ({ matricula: c.matricula, nome: c.nome })));

    // Buscar Lotes/Importacoes de Ponto reais
    const { data: importacoes } = await supabase.from('historico_importacoes')
        .select('id, competencia, total_registros')
        .eq('tenant_id', tId)
        .limit(5);

    console.log("Historico Importacoes (Amostra):");
    console.table(importacoes);

    // Buscar pontos aguardando processamento
    const { data: pontos } = await supabase.from('registros_ponto')
        .select('id, colaborador_id, data_ponto, horas_trabalhadas, status_processamento')
        .eq('tenant_id', tId)
        .eq('status_processamento', 'RECEBIDO')
        .limit(10);

    console.log("Registros Ponto aguardando processamento (Amostra Qtd:", pontos ? pontos.length : 0, "):");
    if (pontos && pontos.length > 0) {
        console.table(pontos);
    }
}
run();
