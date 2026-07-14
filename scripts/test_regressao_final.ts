import { getE2EContext } from './utils/e2e-guard.ts';
import dotenv from 'dotenv';
dotenv.config();

async function runRegression() {
    console.log("=== REGRESSÃO FUNCIONAL (PÓS-CORREÇÃO) ===");
    const { supabase, tenantId } = await getE2EContext();
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const dataRef = '2026-06-25';

    // Pegar ID de empresa válida existente
    const { data: dbEmp } = await supabase.from('empresas').select('id, nome').eq('tenant_id', tenantId).limit(1).single();
    if (!dbEmp) throw new Error("Sem empresa base");

    console.log("1 & 2. CLT com Empresa Existente e Empresa Nova");
    const payloadRhid = {
        tenant_id: tenantId,
        items: [
            { Object_ID: "P1", data: dataRef, pessoa_nome: "CLT Empresa Existente", pessoa_matricula: "MAT-EX1", empresa_nome: dbEmp.nome, horas_trabalhadas: 8 },
            { Object_ID: "P2", data: dataRef, pessoa_nome: "CLT Nova Empresa",      pessoa_matricula: "MAT-NOVA", empresa_nome: "Empresa Nova Via CLT (Teste)", horas_trabalhadas: 8 }
        ]
    };
    const r1 = await fetch(`${supabaseUrl}/functions/v1/importar-pontos-rhid`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` }, body: JSON.stringify(payloadRhid) }).then(res => res.json());
    console.log("-> Resultado RHID:", r1);

    console.log("\n3 & 4. Intermitente Válido e Malformado");
    const payloadTio = {
        tenant_id: tenantId,
        items: [
            { data: dataRef, cpf: "333.333.333-33", matricula: "MAT-INT1", colaborador_nome: "Intermitente Feliz", departamento: dbEmp.nome, horas: 8, total: 100 },
            { data: dataRef, cpf: "444.444.444-44", matricula: "MAT-INT2", colaborador_nome: "Intermitente Bad", departamento: "Dept (Teste), Filial B;", horas: 8, total: 150 }
        ]
    };
    const r2 = await fetch(`${supabaseUrl}/functions/v1/importar-intermitentes-tio`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` }, body: JSON.stringify(payloadTio) }).then(res => res.json());
    console.log("-> Resultado Tio Digital:", r2);

    // Verificar se o malformado virou DEVOLVIDO e não criou empresa fantasma
    const { data: badLancamentos } = await supabase.from('lancamentos_intermitentes').select('*').eq('nome_colaborador', 'INTERMITENTE BAD').order('created_at', { ascending: false }).limit(1);
    if (badLancamentos && badLancamentos.length > 0) {
        console.log(`\nVerificação Lançamento Malformado -> status_pipeline: ${badLancamentos[0].status_pipeline}, observacoes: ${badLancamentos[0].observacoes}`);
    }

    const { data: phantomEmp } = await supabase.from('empresas').select('id, nome').eq('tenant_id', tenantId).ilike('nome', '%Dept (Teste), Filial B;%').limit(1);
    if (!phantomEmp || phantomEmp.length === 0) {
        console.log("Verificação Empresa Fantasma -> SUCESSO: Nenhuma empresa fantasma foi criada!");
    } else {
        console.error("FALHA: Empresa fantasma foi criada: ", phantomEmp[0].nome);
    }
}
runRegression().catch(console.error);
