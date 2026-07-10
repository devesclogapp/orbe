import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
    const { data: emps } = await supabase.from('empresas').select('id, nome');

    let report = "EMPRESAS ENCONTRADAS:\n";
    let empHml = null;

    if (emps) {
        for (let e of emps) {
            report += `- ${e.nome} (${e.id})\n`;
            if (e.nome.includes("HML") ||
                e.nome.toUpperCase().includes("HOMOLOGA") ||
                e.nome === "Base Oficial de Homologação") {
                empHml = e;
            }
        }
    }

    if (!empHml) {
        // Try looking at colaboradores directly
        const { data: colabs } = await supabase.from('colaboradores').select('id, nome, empresa_id').like('nome', '%CLT-HML-%');
        report += "\nCOLABORADORES HML ENCONTRADOS:\n";
        if (colabs) {
            for (let c of colabs) {
                report += `- ${c.nome} (empresa_id: ${c.empresa_id})\n`;
                // Pegar empresa dessa forma
                if (!empHml) empHml = { id: c.empresa_id, nome: "Obtido via colab" };
            }
        }
    }

    if (empHml) {
        report += `\nEMPRESA HML FINAL A USAR: ${empHml.id} - ${empHml.nome}`;

        // Deletar qualquer registro de HML criado que ainda possa existir
        await supabase.from('banco_horas_eventos').delete().eq('empresa_id', empHml.id);
        await supabase.from('banco_horas_saldos').delete().eq('empresa_id', empHml.id);
        await supabase.from('lotes_rh_financeiro').delete().eq('empresa_id', empHml.id);
        await supabase.from('registros_ponto').delete().eq('empresa_id', empHml.id);
        await supabase.from('processamentos_rh').delete().eq('empresa_id', empHml.id);
        report += "\nRegistros HML limpos com sucesso.";
    }

    fs.writeFileSync('report_hml.txt', report);
    console.log("OK, gerou report_hml.txt");
}

run();
