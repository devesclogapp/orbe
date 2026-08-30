import { supabase } from '@/lib/supabase';
import type { CnabRetornoItem } from './cnabRetorno.service';
import { getCurrentTenantId } from '../domain/base.service';
import { EnvironmentService } from '../environment/EnvironmentService';

export const CnabConciliacaoService = {
  /**
   * Pós-processamento após importação de um remessa .ret
   * Executa a baixa financeira para RH/Faturas, Diaristas e Intermitentes.
   */
  async processarBaixaAutomatica(retornoArquivoId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data: todosItensData, error: errItens } = await supabase
        .from('cnab_retorno_itens')
        .select('*')
        .eq('retorno_arquivo_id', retornoArquivoId);

      if (errItens) throw errItens;
      const cnabRetornoItens = (todosItensData ?? []) as any[];

      const cnabRemessaIds = [...new Set(cnabRetornoItens.map(i => i.remessa_arquivo_id).filter(Boolean))];
      if (cnabRemessaIds.length === 0) return { success: true, message: 'Sem remessas atreladas.' };

      // 1. Encontrar todos os IDs mapeados em cnab_remessa_itens
      const { data: remessaItens } = await supabase.from('cnab_remessa_itens').select('remessa_id, origem_tipo, origem_id, fatura_id').in('remessa_id', cnabRemessaIds);
      const rmMap = new Map((remessaItens || []).map(r => [`${r.remessa_id}-${r.origem_id || r.fatura_id}`, r]));

      const rhLoteItemIdsPaid: string[] = [];
      const colabsPagosDiaria: { colabId: string, loteId: string }[] = [];
      const colabsPagosIntermitente: { colabId: string, loteId: string }[] = [];

      // 2. Classificá-los verificando origem_tipo
      for (const item of cnabRetornoItens) {
         if (item.status === 'pago' || item.status === 'PAGO') {
            const rel = rmMap.get(`${item.remessa_arquivo_id}-${item.fatura_id}`);
            if (rel?.origem_tipo === 'CLT' || rel?.origem_tipo === 'RH_FINANCEIRO_ITEM' || rel?.origem_tipo === 'INTERMITENTE') {
               rhLoteItemIdsPaid.push(item.fatura_id);
            }
         }
      }

      // 3. Resgatar os Detalhes da Origem (Para baixar os pipelines operacionais originais)
      if (rhLoteItemIdsPaid.length > 0) {
         const { data: rhItensList } = await supabase.from('rh_financeiro_lote_itens').select('id, lote_id, colaborador_id, rh_financeiro_lotes(tipo, competencia, empresa_id)').in('id', rhLoteItemIdsPaid);
         const lotesUnicos = new Map<string, any>();

         if (rhItensList) {
           for (const rhItem of rhItensList) {
             const parentNode = rhItem.rh_financeiro_lotes;
             const parent = Array.isArray(parentNode) ? parentNode[0] : parentNode;
             if (!parent) continue;

             lotesUnicos.set(rhItem.lote_id, parent);

             if (parent.tipo === 'DIARISTAS') colabsPagosDiaria.push({ colabId: rhItem.colaborador_id, loteId: rhItem.lote_id });
             if (parent.tipo === 'INTERMITENTES') colabsPagosIntermitente.push({ colabId: rhItem.colaborador_id, loteId: rhItem.lote_id });
           }

           // Trata as pendências Diaristas
           if (colabsPagosDiaria.length > 0) {
              for(const b of lotesUnicos.values()) {
                 if (b.tipo !== 'DIARISTAS') continue;
                 const { data: diagLote } = await supabase.from('diaristas_lotes_fechamento').select('id').eq('empresa_id', b.empresa_id).eq('mes_referencia', b.competencia).maybeSingle();
                 if (diagLote?.id) {
                    await supabase.from('diaristas_lotes_fechamento').update({ status: 'PAGO' }).eq('id', diagLote.id);
                    await supabase.from('lancamentos_diaristas').update({ status: 'PAGO' }).eq('lote_fechamento_id', diagLote.id).in('diarista_id', colabsPagosDiaria.map(x=>x.colabId));
                 }
              }
           }

           // Trata as pendências Intermitentes
           if (colabsPagosIntermitente.length > 0) {
              for(const b of lotesUnicos.values()) {
                 if (b.tipo !== 'INTERMITENTES') continue;
                 const { data: intLote } = await supabase.from('intermitentes_lotes_fechamento').select('id').eq('empresa_id', b.empresa_id).eq('competencia', b.competencia).maybeSingle();
                 if (intLote?.id) {
                    await supabase.from('intermitentes_lotes_fechamento').update({ status: 'PAGO' }).eq('id', intLote.id);
                    await supabase.from('lancamentos_intermitentes').update({ status_pipeline: 'PAGO' }).eq('lote_fechamento_id', intLote.id).in('colaborador_id', colabsPagosIntermitente.map(x=>x.colabId));
                 }
              }
           }
         }
      }

      // 4. Fechamento das Conciliações
      const itensConciliados = cnabRetornoItens.filter(i => i.status === 'pago' || i.status === 'PAGO').map(i => i.id);
      if (itensConciliados.length > 0) {
         // O Supabase tem limite de 1000 items em chamadas '.in()', se forem muitos é bom particionar. Assumo pequeno porte aqui.
         await supabase.from('cnab_retorno_itens')
           .update({ 
             status_conciliacao: 'conciliado',
             conciliado_em: new Date().toISOString()
           })
           .in('id', itensConciliados);
      }

      return { success: true, message: 'Baixa financeira executada.' };
    } catch (err: any) {
      console.error('[Baixa Financeira] Erro ao processar:', err);
      return { success: false, message: err.message };
    }
  }
};
