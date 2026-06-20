import fs from 'fs';

let f = fs.readFileSync('src/services/operationalEngine/MotorFinanceiro.ts', 'utf8');

const markerPatterns = [
    "        // FATURAMENTO (Cliente/Transportadora)",
    "        // Usa transportadora_id provisoriamente como cliente neste contexto logístico",
    "        if (op.transportadora_id) {",
    "          if (!consolidadosCliente[op.transportadora_id]) {",
    "            consolidadosCliente[op.transportadora_id] = { total: 0, ops: 0, ids: [] };",
    "          }",
    "          const opTotal = Number(op.valor_faturamento_nf || op.valor_descarga || op.valor_total || 0);",
    "          consolidadosCliente[op.transportadora_id].total += opTotal;",
    "          consolidadosCliente[op.transportadora_id].ops += 1;",
    "          consolidadosCliente[op.transportadora_id].ids.push(op.id);",
    "        }"
];

const markerMatch1 = markerPatterns.join('\r\n');
const markerMatch2 = markerPatterns.join('\n');

const replacerPatterns = [
    "        // FATURAMENTO (Cliente/Transportadora)",
    "        // Usa transportadora_id provisoriamente como cliente neste contexto logístico, ou a própria empresa caso não haja transportadora",
    "        const clienteFatId = op.transportadora_id || op.empresa_id;",
    "        if (clienteFatId) {",
    "          if (!consolidadosCliente[clienteFatId]) {",
    "            consolidadosCliente[clienteFatId] = { total: 0, ops: 0, ids: [] };",
    "          }",
    "          const opTotal = Number(op.valor_faturamento_nf || op.valor_descarga || op.valor_total || 0);",
    "          consolidadosCliente[clienteFatId].total += opTotal;",
    "          consolidadosCliente[clienteFatId].ops += 1;",
    "          consolidadosCliente[clienteFatId].ids.push(op.id);",
    "        }"
];

const replacer1 = replacerPatterns.join('\r\n');
const replacer2 = replacerPatterns.join('\n');

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
