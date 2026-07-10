import { supabase } from '@/lib/supabase';
import type { CnabRetornoItem } from './cnabRetorno.service';

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
      const todosItens = (todosItensData ?? []) as CnabRetornoItem[];
      if (todosItens.length === 0) return { success: true, message: 'Nenhum item analisável' };

      const lotesRhItens = new Map<string, CnabRetornoItem[]>();
      const diaristasLotes = new Map<string, CnabRetornoItem[]>();
      const intermitentesLotes = new Map<string, CnabRetornoItem[]>();

      for (const item of todosItens) {
        if (item.lote_id) {     
          if (!lotesRhItens.has(item.lote_id)) lotesRhItens.set(item.lote_id, []);
          lotesRhItens.get(item.lote_id)!.push(item);
        }
        if (item.diaristas_lote_id) {
          if (!diaristasLotes.has(item.diaristas_lote_id)) diaristasLotes.set(item.diaristas_lote_id, []);
          diaristasLotes.get(item.diaristas_lote_id)!.push(item);
        }
        if (item.intermitentes_lote_id) {
          if (!intermitentesLotes.has(item.intermitentes_lote_id)) intermitentesLotes.set(item.intermitentes_lote_id, []);
          intermitentesLotes.get(item.intermitentes_lote_id)!.push(item);
        }
      }

      const itensConciliados: string[] = [];

      // ——— RH / Faturas (genérico) ———
      for (const [loteId, itens] of lotesRhItens.entries()) {
        const itemPagoIds = itens.filter(i => i.status === 'pago').map(i => i.fatura_id).filter(Boolean);
        
        if (itemPagoIds.length > 0) {
          await supabase.from('faturas')
            .update({ status: 'pago' })
            .in('id', itemPagoIds);
          
          itens.filter(i => i.status === 'pago').forEach(i => itensConciliados.push(i.id));
        }

        const temDivergencia = itens.some(i => i.status === 'divergente' || i.status === 'rejeitado' || i.status === 'pendente' || i.status === 'desconhecido');
        const { data: faturasLote } = await supabase.from('faturas').select('status').eq('lote_remessa_id', loteId);
        // Considerando que as aprovadas foram transformadas em pago agorinha
        const todasPagas = (faturasLote ?? []).every(f => f.status === 'pago' || f.status === 'PAGO');

        if (!temDivergencia && todasPagas) {
          await supabase.from('lotes_remessa')
            .update({ status: 'pago', updated_at: new Date().toISOString() })
            .eq('id', loteId);
        }
      }

      // ——— Diaristas ———
      for (const [loteId, itens] of diaristasLotes.entries()) {
        const itensPagos = itens.filter(i => i.status === 'pago');
        const colabIds = itensPagos.map(i => i.colaborador_id).filter(Boolean);
        
        if (colabIds.length > 0) {
          await supabase.from('lancamentos_diaristas')
            .update({ status: 'PAGO' })
            .eq('lote_fechamento_id', loteId)
            .in('diarista_id', colabIds);
            
          itensPagos.forEach(i => itensConciliados.push(i.id));
        }

        const temDivergencia = itens.some(i => i.status === 'divergente' || i.status === 'rejeitado' || i.status === 'pendente' || i.status === 'desconhecido');
        const { data: lancamentosLote } = await supabase.from('lancamentos_diaristas').select('status').eq('lote_fechamento_id', loteId);
        const todasPagas = (lancamentosLote || []).every(f => f.status === 'PAGO' || f.status === 'pago');

        if (!temDivergencia && todasPagas) {
           await supabase.from('diaristas_lotes_fechamento')
             .update({ status: 'PAGO' })
             .eq('id', loteId);
        }
      }

      // ——— Intermitentes ———
      for (const [loteId, itens] of intermitentesLotes.entries()) {
        const itensPagos = itens.filter(i => i.status === 'pago');
        const colabIds = itensPagos.map(i => i.colaborador_id).filter(Boolean);

        if (colabIds.length > 0) {
          const { error: errLancamentos } = await supabase.from('lancamentos_intermitentes')
            .update({ status_pipeline: 'PAGO' })
            .eq('lote_fechamento_id', loteId)
            .in('colaborador_id', colabIds);

          if (errLancamentos) {
            console.error(`[Baixa Financeira] Falha ao atualizar lancamentos_intermitentes para lote ${loteId}:`, errLancamentos.message);
            // Não bloqueia os outros lotes, mas registra explicitamente
          } else {
            itensPagos.forEach(i => itensConciliados.push(i.id));
          }
        }

        const temDivergencia = itens.some(i => i.status === 'divergente' || i.status === 'rejeitado' || i.status === 'pendente' || i.status === 'desconhecido');
        const { data: lancamentosLote } = await supabase.from('lancamentos_intermitentes').select('status_pipeline').eq('lote_fechamento_id', loteId);
        const todasPagas = (lancamentosLote || []).every(f => f.status_pipeline === 'PAGO' || f.status_pipeline === 'pago');

        if (!temDivergencia && todasPagas) {
          const { error: errLote } = await supabase.from('intermitentes_lotes_fechamento')
            .update({ status: 'PAGO' })
            .eq('id', loteId);

          if (errLote) {
            console.error(`[Baixa Financeira] Falha ao atualizar lote de intermitentes ${loteId} para PAGO:`, errLote.message);
          }
        }
      }


      // 3. Atualizar status de retorno `cnab_retorno_itens`
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
