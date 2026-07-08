import { supabase } from '@/lib/supabase';

export class CNABBase {
  static async fetchLoteData(loteId: string, contaBancariaId?: string, rhLoteId?: string) {
    let conta: Record<string, any> | null = null;
  
    if (contaBancariaId) {
      const { data, error } = await supabase
        .from('contas_bancarias_empresa')
        .select(`
          *,
          empresas:empresa_id (
            id,
            nome,
            cidade,
            estado
          )
        `)
        .eq('id', contaBancariaId)
        .maybeSingle();
  
      if (error) {
        throw new Error(`Erro ao buscar conta bancária: ${error.message}`);
      }
  
      conta = data;
    }
  
    let faturas: any[] = [];
    
    if (rhLoteId) {
      // Banking data lives directly on colaboradores — no separate dados_bancarios table
      const { data: itensRh, error } = await supabase
        .from('rh_financeiro_lote_itens')
        .select(`
          id, valor_calculado,
          colaboradores (
            id, nome, cpf,
            banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta
          )
        `)
        .eq('lote_id', rhLoteId);
        
      if (error) throw new Error(`Erro ao buscar itens do RH: ${error.message}`);
      
      faturas = (itensRh || []).map(item => ({
        id: item.id,
        valor: item.valor_calculado || 0,
        colaboradores: item.colaboradores
      }));
    } else {
      const { data: faturasDb, error } = await supabase
        .from('faturas')
        .select(`
          id, valor, competencia,
          colaboradores (
            id, nome, cpf,
            banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta
          )
        `)
        .eq('lote_remessa_id', loteId)
        .neq('status', 'pago');
  
      if (error) throw new Error(`Erro ao buscar faturas do lote: ${error.message}`);
      faturas = faturasDb || [];
    }
  
    // Busca do valor total que originou o lote para auditoria rigorosa (Prevenção contra fraude/divergência)
    let valorEsperadoLote = 0;
    if (rhLoteId) {
       const { data: rhLot } = await supabase.from('rh_financeiro_lotes').select('valor_total').eq('id', rhLoteId).maybeSingle();
       if(rhLot) valorEsperadoLote = Number(rhLot.valor_total || 0);
    } else {
       const { data: lf } = await supabase.from('lotes_remessa').select('valor_total').eq('id', loteId).maybeSingle();
       if(lf) valorEsperadoLote = Number(lf.valor_total || 0);
    }
  
    return { conta, faturas, valorEsperadoLote: Number(valorEsperadoLote.toFixed(2)) };
  }
}
