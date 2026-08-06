import { supabase } from '@/lib/supabase';
import { EnvironmentService, EnvironmentScopeResolutionError } from '../environment/EnvironmentService';
import { EnvironmentQueryFilter } from '../environment/EnvironmentQueryFilter';
import { getCurrentTenantId } from '../domain/base.service';
export class CNABBase {
  static async fetchLoteData(loteId: string, contaBancariaId?: string, rhLoteId?: string) {
    const tenantId = await getCurrentTenantId();
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
      
      // Bloco 4 Segregation: Ensure origin bank account belongs to active environment
      if (data?.empresa_id) {
        await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId: data.empresa_id });
      }
  
      conta = data;
    }
  
    let faturas: any[] = [];
    let valorEsperadoLote = 0;
    
    if (rhLoteId) {
      // Bloco 4 Segregation: Parent lot environmental check
      const { data: rhLot, error: rhLotErr } = await supabase
        .from('rh_financeiro_lotes')
        .select('valor_total, empresa_id')
        .eq('id', rhLoteId)
        .maybeSingle();

      if (rhLotErr || !rhLot) throw new Error('Lote RH original não encontrado.');
      if (rhLot.empresa_id) {
         await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId: rhLot.empresa_id });
      }
      valorEsperadoLote = Number(rhLot.valor_total || 0);

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
      const { data: lf } = await supabase.from('lotes_remessa').select('valor_total').eq('id', loteId).maybeSingle();
      if(lf) valorEsperadoLote = Number(lf.valor_total || 0);

      let query = supabase
        .from('faturas')
        .select(`
          id, valor, competencia, empresa_id,
          colaboradores (
            id, nome, cpf,
            banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta
          )
        `)
        .eq('lote_remessa_id', loteId)
        .neq('status', 'pago');

      // Bloco 4 Segregation: Fail-closed query for faturas
      const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
      query = EnvironmentQueryFilter.applyEmpresaScope(query, {
        tenantId,
        column: 'empresa_id',
        includeNullInProduction: false,
        testIds
      });
  
      const { data: faturasDb, error } = await query;
      if (error) throw new Error(`Erro ao buscar faturas do lote: ${error.message}`);
      faturas = faturasDb || [];
    }
  
    return { conta, faturas, valorEsperadoLote: Number(valorEsperadoLote.toFixed(2)) };
  }
}
