import fs from 'fs';

let content = fs.readFileSync('src/services/operationalEngine/MotorFinanceiro.ts', 'utf8');

// 1. Add ensureClienteEspelho at the top of MotorFinanceiro object
const search1 = "export const MotorFinanceiro = {";
const replace1 = "export const MotorFinanceiro = {\n  ensureClienteEspelho: async (tenant_id: string, source_id: string, is_empresa: boolean): Promise<string> => {\n    const { data: existing } = await supabase.from('clientes').select('id').eq('id', source_id).maybeSingle();\n    if (existing) return existing.id;\n\n    let nome = 'Desconhecido';\n    if (is_empresa) {\n      const { data: emp } = await supabase.from('empresas').select('nome').eq('id', source_id).maybeSingle();\n      if (emp) nome = emp.nome;\n    } else {\n      const { data: transp } = await supabase.from('transportadoras').select('nome').eq('id', source_id).maybeSingle();\n      if (transp) nome = transp.nome;\n      else {\n        const { data: tc } = await supabase.from('transportadoras_clientes').select('nome').eq('id', source_id).maybeSingle();\n        if (tc) nome = tc.nome;\n      }\n    }\n\n    const { data: newClient, error } = await supabase.from('clientes').insert({ id: source_id, tenant_id, nome }).select('id').single();\n    if (error) {\n      const { data: retry } = await supabase.from('clientes').select('id').eq('id', source_id).maybeSingle();\n      if (retry) return retry.id;\n      throw error;\n    }\n    return newClient.id;\n  },";

if (content.includes(search1)) {
    content = content.replace(search1, replace1);
    console.log("Added ensureClienteEspelho successfully.");
}

// 2. Change consolidadosCliente structure
const search2 = "const consolidadosCliente: Record<string, { total: number, ops: number, ids: string[] }> = {};";
const replace2 = "const consolidadosCliente: Record<string, { total: number, ops: number, ids: string[], isEmpresa: boolean }> = {};";
if (content.includes(search2)) {
    content = content.replace(search2, replace2);
    console.log("Updated consolidadosCliente structure successfully.");
}

// 3. Update initialization
const search3Match1 = "consolidadosCliente[clienteFatId] = { total: 0, ops: 0, ids: [] };".replace(/\r\n/g, '\n');
const search3Match2 = "consolidadosCliente[clienteFatId] = { total: 0, ops: 0, ids: [] };";

let search3 = "";
if (content.indexOf(search3Match1) > -1) search3 = search3Match1;
else if (content.indexOf(search3Match2) > -1) search3 = search3Match2;

const replace3 = "consolidadosCliente[clienteFatId] = { total: 0, ops: 0, ids: [], isEmpresa: !op.transportadora_id };";
if (search3 && content.includes(search3)) {
    content = content.replace(search3, replace3);
    console.log("Updated consolidadosCliente initialization.");
} else {
    console.log("search 3 failed: " + search3);
}

// 4. Update the loop
const search4 = `      // 4. Salvar Consolidados de Cliente e Faturas Relacionadas
      for (const [clientId, data] of Object.entries(consolidadosCliente)) {
        if (data.total <= 0) continue;

        // Insere Consolidado (Tabela antiga/nova dependendo do schema, se cliente_id não houver, ajustaremos para aceitar id)
        const { error: insErr } = await supabase.from("financeiro_consolidados_cliente").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          cliente_id: clientId, // Usamos o transportadora_id aqui como mapeamento`;

const replace4 = `      // 4. Salvar Consolidados de Cliente e Faturas Relacionadas
      for (const [clientId, data] of Object.entries(consolidadosCliente)) {
        if (data.total <= 0) continue;

        let clienteFinalId = clientId;
        try {
          clienteFinalId = await MotorFinanceiro.ensureClienteEspelho(tenantId, clientId, data.isEmpresa);
        } catch (e: any) {
          EngineLogger.warn('[MotorFinanceiro] Erro garantindo espelho para ' + clientId + ': ' + e.message, { component: 'MotorFinanceiro' });
        }

        // Insere Consolidado
        const { error: insErr } = await supabase.from("financeiro_consolidados_cliente").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          cliente_id: clienteFinalId, // Usamos clienteFinalId amarrado da transportadora espelhada`;

// normalizing line endings for search 4
const search4_crlf = search4.replace(/\n/g, '\r\n');

if (content.includes(search4)) {
    content = content.replace(search4, replace4);
    console.log("Updated consolidadosCliente saving loop. (LF)");
} else if (content.includes(search4_crlf)) {
    content = content.replace(search4_crlf, replace4.replace(/\n/g, '\r\n'));
    console.log("Updated consolidadosCliente saving loop. (CRLF)");
} else {
    console.log("Failed to find saving loop. Surrounding text was:");
}

fs.writeFileSync('src/services/operationalEngine/MotorFinanceiro.ts', content, 'utf8');
