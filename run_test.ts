import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Iniciando sincronizacao dos 3 lotes...');

  // Lotes aguardando:
  const { data: q1, error: err1 } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, tenant_id, empresa_id, competencia, quantidade_registros, valor_total')
    .eq('status', 'FECHADO_FINANCEIRO');

  if (err1) {
    console.error('ERRO SUPABASE:', err1);
    process.exit(1);
  }

  console.log(`Lotes FECHADO_FINANCEIRO encontrados: ${q1?.length}`);

  for (const lote of q1 || []) {
    try {
      console.log(`> Processando Lote ${lote.id}...`);

      const { data: lancamentos } = await supabase
        .from('lancamentos_intermitentes')
        .select('*')
        .eq('lote_fechamento_id', lote.id);

      const aggregateTotal = (lancamentos || []).reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
      const uniqueColabs = new Set((lancamentos || []).map((l) => l.colaborador_id || l.nome_colaborador));

      let { data: rhLote, error: rhLoteErr } = await supabase
        .from('rh_financeiro_lotes')
        .select('id')
        .eq('tenant_id', lote.tenant_id)
        .eq('empresa_id', lote.empresa_id)
        .eq('competencia', lote.competencia)
        .eq('origem', 'OPERACIONAL')
        .eq('tipo', 'INTERMITENTES')
        .maybeSingle();

      let rhLoteId = rhLote?.id;
      
      if (!rhLoteId) {
        const { data: created, error: createErr } = await supabase
          .from('rh_financeiro_lotes')
          .insert({
            tenant_id: lote.tenant_id,
            empresa_id: lote.empresa_id,
            competencia: lote.competencia,
            origem: 'OPERACIONAL',
            tipo: 'INTERMITENTES',
            total_colaboradores: uniqueColabs.size,
            valor_total: aggregateTotal,
            status: 'AGUARDANDO_PAGAMENTO',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        rhLoteId = created.id;
      }

      if (lancamentos && lancamentos.length > 0) {
        // delete old just in case
        await supabase.from('rh_financeiro_lote_itens').delete().eq('lote_id', rhLoteId);
        
        const payloadItens = lancamentos.map((l) => ({
          lote_id: rhLoteId,
          tenant_id: lote.tenant_id,
          colaborador_id: l.colaborador_id,
          nome_colaborador: l.nome_colaborador || 'Desconhecido',
          tipo_evento: 'LANCAMENTO_INTERMITENTE',
          horas: Number(l.horas_trabalhadas || l.quantidade_horas || 0),
          minutos: Math.round(Number(l.horas_trabalhadas || l.quantidade_horas || 0) * 60),
          valor_calculado: Number(l.total || l.valor_pagamento || 0),
          origem_evento: 'lancamentos_intermitentes',
          referencia_evento_id: l.id,
          status: 'AGUARDANDO_PAGAMENTO'
        }));
        const { error: insErr } = await supabase.from('rh_financeiro_lote_itens').insert(payloadItens);
        if (insErr) throw insErr;
      }
      
      console.log(`> Lote ${lote.id} sincronizado com sucesso (RH_FINANCEIRO_ID: ${rhLoteId}).`);
    } catch (e: any) {
      console.error(`> Erro ao sincronizar ${lote.id}: ${e.message}`);
    }
  }

  const { data: fin } = await supabase.from('rh_financeiro_lotes').select('*').eq('tipo', 'INTERMITENTES');
  console.log(`Final: Total de lotes INTERMITENTES em rh_financeiro_lotes = ${fin?.length}`);
}

run();
