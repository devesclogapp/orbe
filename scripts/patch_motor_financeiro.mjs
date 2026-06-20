import fs from 'fs';
let f = fs.readFileSync('src/services/operationalEngine/MotorFinanceiro.ts', 'utf8');

const markerRows = [
    '      // 1. Limpar consolidados existentes para ser idempotente',
    '      await supabase.from("financeiro_consolidados_cliente").delete().eq("competencia", competencia).eq("empresa_id", empresaId);',
    '      await supabase.from("financeiro_consolidados_colaborador").delete().eq("competencia", competencia).eq("empresa_id", empresaId);',
    '      await supabase.from("faturas").delete().eq("competencia", competencia).eq("empresa_id", empresaId);'
];

const markerMatch1 = markerRows.join('\r\n');
const markerMatch2 = markerRows.join('\n');

const replacerRows = [
    '      // 1. Validar Idempotência: bloquear se já houver consolidação financeira não-pendente',
    '      const { data: consolidadosExistentes } = await supabase',
    '        .from("financeiro_consolidados_cliente")',
    '        .select("id, status")',
    '        .eq("competencia", competencia)',
    '        .eq("empresa_id", empresaId);',
    '        ',
    '      if (consolidadosExistentes?.some(c => c.status !== "pendente")) {',
    '         const msg = `Faturamento já aprovado ou finalizado para a competência ${competencia}. O recálculo automático não pode sobrescrever faturamentos finalizados.`;',
    '         EngineLogger.warn(`[MotorFinanceiro] ${msg}`, { component: "MotorFinanceiro" });',
    '         throw new Error(msg);',
    '      }',
    '',
    '      // Limpar consolidados *pendentes* existentes para reconstruir (Substituir com Segurança)',
    '      await supabase.from("financeiro_consolidados_cliente").delete().eq("competencia", competencia).eq("empresa_id", empresaId);',
    '      await supabase.from("financeiro_consolidados_colaborador").delete().eq("competencia", competencia).eq("empresa_id", empresaId);',
    '      await supabase.from("faturas").delete().eq("competencia", competencia).eq("empresa_id", empresaId);'
];

const replacer1 = replacerRows.join('\r\n');
const replacer2 = replacerRows.join('\n');

if (f.includes(markerMatch1)) {
    fs.writeFileSync('src/services/operationalEngine/MotorFinanceiro.ts', f.replace(markerMatch1, replacer1), 'utf8');
    console.log('Replaced successfully (CRLF)');
} else if (f.includes(markerMatch2)) {
    fs.writeFileSync('src/services/operationalEngine/MotorFinanceiro.ts', f.replace(markerMatch2, replacer2), 'utf8');
    console.log('Replaced successfully (LF)');
} else {
    console.log('Marker not found. First lines are:');
    console.log(f.substring(0, 500));
}
