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
            estado,
            is_teste
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
    let loteIsTeste: boolean | undefined = undefined;
    
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

      // Buscar classificação canônica da empresa do lote no banco (Fail-Closed)
      const { data: empLote, error: empLoteErr } = await supabase
        .from('empresas')
        .select('id, is_teste')
        .eq('id', rhLot.empresa_id)
        .maybeSingle();

      if (empLoteErr) throw new Error(`Falha técnica ao verificar empresa do lote: ${empLoteErr.message}`);
      if (!empLote) throw new Error(`Falha de Segurança: Empresa ${rhLot.empresa_id} do lote RH não encontrada.`);
      if (typeof empLote.is_teste !== 'boolean') {
        throw new Error(`Falha de Integridade: Empresa ${rhLot.empresa_id} possui classificação de ambiente indefinida (is_teste nulo). Operação abortada.`);
      }
      loteIsTeste = empLote.is_teste;

      // Banking data lives directly on colaboradores — no separate dados_bancarios table
      const { data: itensRh, error } = await supabase
        .from('rh_financeiro_lote_itens')
        .select(`
          id, valor_calculado,
          colaboradores (
            id, nome, cpf, is_teste, empresa_id,
            banco_codigo, agencia, agencia_digito, conta, digito_conta, tipo_conta
          )
        `)
        .eq('lote_id', rhLoteId);
        
      if (error) throw new Error(`Erro ao buscar itens do RH: ${error.message}`);
      
      // Validação estrita de contaminação cruzada: nenhum colaborador de teste em lote real e vice-versa
      for (const item of (itensRh || [])) {
        const col = (item as any)?.colaboradores;
        if (col && typeof col.is_teste === 'boolean' && col.is_teste !== loteIsTeste) {
          throw new Error(`BLOQUEIO DE SEGURANÇA CNAB: Colaborador ${col.nome || col.id} (${col.is_teste ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}) diverge da classificação da remessa (${loteIsTeste ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}).`);
        }
      }

      faturas = (itensRh || []).map(item => ({
        id: item.id,
        valor: item.valor_calculado || 0,
        colaboradores: item.colaboradores
      }));
    } else {
      const { data: lf } = await supabase.from('lotes_remessa').select('valor_total, empresa_id').eq('id', loteId).maybeSingle();
      if(lf) valorEsperadoLote = Number(lf.valor_total || 0);

      const targetEmpresaId = lf?.empresa_id || conta?.empresa_id;
      if (targetEmpresaId) {
        const { data: empDb, error: empDbErr } = await supabase.from('empresas').select('id, is_teste').eq('id', targetEmpresaId).maybeSingle();
        if (empDbErr) throw new Error(`Falha técnica ao verificar empresa da remessa: ${empDbErr.message}`);
        if (!empDb) throw new Error(`Falha de Segurança: Empresa ${targetEmpresaId} não encontrada.`);
        if (typeof empDb.is_teste !== 'boolean') {
          throw new Error(`Falha de Integridade: Empresa ${targetEmpresaId} possui classificação de ambiente indefinida (is_teste nulo). Operação abortada.`);
        }
        loteIsTeste = empDb.is_teste;
      }

      let query = supabase
        .from('faturas')
        .select(`
          id, valor, competencia, empresa_id,
          colaboradores (
            id, nome, cpf, is_teste, empresa_id,
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

      // Validação estrita de integridade para faturas
      for (const fat of (faturasDb || [])) {
        const col = (fat as any)?.colaboradores;
        if (col && typeof col.is_teste === 'boolean' && typeof loteIsTeste === 'boolean' && col.is_teste !== loteIsTeste) {
          throw new Error(`BLOQUEIO DE SEGURANÇA CNAB: Fatura ${fat.id} possui colaborador (${col.is_teste ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}) com classificação divergente da remessa.`);
        }
      }

      faturas = faturasDb || [];
    }

    if (loteIsTeste === undefined && conta?.empresas && typeof conta.empresas.is_teste === 'boolean') {
      loteIsTeste = conta.empresas.is_teste;
    }
  
    return { conta, faturas, valorEsperadoLote: Number(valorEsperadoLote.toFixed(2)), isTeste: loteIsTeste };
  }
}
