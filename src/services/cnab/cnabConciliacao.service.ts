import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from '../domain/base.service';

export const CnabConciliacaoService = {
  /**
   * Pós-processamento após importação de um arquivo de retorno CNAB240 (.ret).
   * Executa a baixa financeira orientada por ITEM para Diaristas, Intermitentes, CLT e Faturas.
   *
   * REGRA CRÍTICA DE INTEGRIDADE:
   * Um lote (Diaristas, Intermitentes ou RH) NUNCA pode ser promovido para 'PAGO'
   * a menos que TODOS os itens ativos do lote tenham sido liquidados com sucesso.
   * Se houver itens pendentes ou rejeitados, o lote permanece em 'cnab_gerado' com
   * status de conciliação parcial.
   */
  async processarBaixaAutomatica(retornoArquivoId: string): Promise<{ success: boolean; message: string }> {
    try {
      const tenantId = await getCurrentTenantId();

      const { data: todosItensData, error: errItens } = await supabase
        .from('cnab_retorno_itens')
        .select('*')
        .eq('retorno_arquivo_id', retornoArquivoId);

      if (errItens) throw errItens;
      const cnabRetornoItens = (todosItensData ?? []) as any[];
      if (cnabRetornoItens.length === 0) {
        return { success: true, message: 'Nenhum item encontrado no retorno bancário.' };
      }

      const cnabRemessaIds = [...new Set(cnabRetornoItens.map((i) => i.remessa_arquivo_id).filter(Boolean))];

      // 1. Mapear itens da remessa
      const { data: remessaItens } = cnabRemessaIds.length > 0
        ? await supabase
            .from('cnab_remessa_itens')
            .select('id, remessa_id, origem_tipo, origem_id, fatura_id, lote_item_id, status')
            .in('remessa_id', cnabRemessaIds)
        : { data: [] };

      // Mapas auxiliares para vinculação rápida
      const remessaItensList = remessaItens || [];
      const rmMap = new Map(remessaItensList.map((r: any) => [`${r.remessa_id}-${r.origem_id || r.fatura_id}`, r]));
      const rmByRemessaId = new Map<string, any[]>();
      remessaItensList.forEach((r: any) => {
        const arr = rmByRemessaId.get(r.remessa_id) || [];
        arr.push(r);
        rmByRemessaId.set(r.remessa_id, arr);
      });

      // Buscar metadados das remessas atreladas (incluindo diaristas_lote_id e intermitentes_lote_id)
      const { data: remessasMeta } = cnabRemessaIds.length > 0
        ? await supabase
            .from('cnab_remessas_arquivos')
            .select('id, diaristas_lote_id, intermitentes_lote_id, lote_id, empresa_id')
            .in('id', cnabRemessaIds)
        : { data: [] };
      const remessaMetaMap = new Map((remessasMeta || []).map((rm: any) => [rm.id, rm]));

      // 2. Classificação de Itens do Retorno
      const itensPagos = cnabRetornoItens.filter((i) => i.status === 'pago' || i.status === 'PAGO');
      const itensRejeitados = cnabRetornoItens.filter((i) => i.status === 'rejeitado' || i.status === 'REJEITADO');

      // Acompanhamento de lotes para validação posterior de quitação integral
      const diaristasLotesAfetados = new Set<string>();
      const intermitentesLotesAfetados = new Set<string>();
      const rhLotesAfetados = new Set<string>();

      // ─────────────────────────────────────────────────────────────────
      // 3. Processar Itens REJEITADOS
      // ─────────────────────────────────────────────────────────────────
      for (const itemRejeitado of itensRejeitados) {
        // Atualizar status de conciliação no item de retorno
        await supabase
          .from('cnab_retorno_itens')
          .update({
            status_conciliacao: 'rejeitado_banco',
            observacao_conciliacao: itemRejeitado.descricao_ocorrencia || 'Rejeitado pela instituição bancária',
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemRejeitado.id);

        // Se houver vínculo com remessa_item, marcar como rejeitado
        const relRemessaItem = remessaItensList.find(
          (r: any) =>
            r.remessa_id === itemRejeitado.remessa_arquivo_id &&
            (r.origem_id === itemRejeitado.fatura_id || r.id === itemRejeitado.remessa_item_id)
        );
        if (relRemessaItem?.id) {
          await supabase
            .from('cnab_remessa_itens')
            .update({ status: 'rejeitado', updated_at: new Date().toISOString() })
            .eq('id', relRemessaItem.id);
        }

        // Identificar lote para não permitir fechamento como pago
        const remMeta = itemRejeitado.remessa_arquivo_id ? remessaMetaMap.get(itemRejeitado.remessa_arquivo_id) : null;
        if (remMeta?.diaristas_lote_id) diaristasLotesAfetados.add(remMeta.diaristas_lote_id);
        if (remMeta?.intermitentes_lote_id) intermitentesLotesAfetados.add(remMeta.intermitentes_lote_id);
      }

      // ─────────────────────────────────────────────────────────────────
      // 4. Processar Itens PAGOS (Baixa Item a Item)
      // ─────────────────────────────────────────────────────────────────
      for (const itemPago of itensPagos) {
        const remMeta = itemPago.remessa_arquivo_id ? remessaMetaMap.get(itemPago.remessa_arquivo_id) : null;
        const rel = rmMap.get(`${itemPago.remessa_arquivo_id}-${itemPago.fatura_id}`);

        // A) Origem DIARISTAS
        const diaristaLoteId = itemPago.diaristas_lote_id || remMeta?.diaristas_lote_id || (rel?.origem_tipo === 'DIARISTA' ? (itemPago.lote_id || remMeta?.lote_id || rel?.lote_item_id) : null);
        const isDiarista = rel?.origem_tipo === 'DIARISTA' || (Boolean(diaristaLoteId) && rel?.origem_tipo !== 'CLT' && rel?.origem_tipo !== 'RH_FINANCEIRO_ITEM' && rel?.origem_tipo !== 'INTERMITENTE' && rel?.origem_tipo !== 'FATURA');
        if (isDiarista) {
          const loteIdFinal = diaristaLoteId || rel?.lote_item_id;
          if (loteIdFinal) diaristasLotesAfetados.add(loteIdFinal);

          // Baixar estritamente o lançamento remetido correspondente (nunca pagar em lote sem vínculo com remessa)
          if (itemPago.fatura_id) {
            await supabase
              .from('lancamentos_diaristas')
              .update({ status: 'PAGO', updated_at: new Date().toISOString() })
              .eq('id', itemPago.fatura_id);

            // Garantir que o lote associado a este lançamento é registrado nos lotes afetados
            if (!loteIdFinal) {
              const { data: lancData } = await supabase
                .from('lancamentos_diaristas')
                .select('lote_fechamento_id')
                .eq('id', itemPago.fatura_id)
                .maybeSingle();
              if (lancData?.lote_fechamento_id) {
                diaristasLotesAfetados.add(lancData.lote_fechamento_id);
              }
            }
          }

          // Atualizar item específico da remessa para 'conciliado'
          const relItem = remessaItensList.find(
            (r: any) =>
              (itemPago.remessa_arquivo_id && r.remessa_id === itemPago.remessa_arquivo_id && r.origem_id === itemPago.fatura_id) ||
              r.id === itemPago.remessa_item_id ||
              r.origem_id === itemPago.fatura_id
          );
          const relRemessaItemId = itemPago.remessa_item_id || rel?.id || relItem?.id;
          if (relRemessaItemId) {
            await supabase
              .from('cnab_remessa_itens')
              .update({ status: 'conciliado', updated_at: new Date().toISOString() })
              .eq('id', relRemessaItemId);
          }
        }

        // B) Origem CLT / RH_FINANCEIRO_ITEM
        if (rel?.origem_tipo === 'CLT' || rel?.origem_tipo === 'RH_FINANCEIRO_ITEM') {
          if (itemPago.fatura_id) {
            await supabase
              .from('rh_financeiro_lote_itens')
              .update({ status: 'PAGO' })
              .eq('id', itemPago.fatura_id);

            const { data: rhItem } = await supabase
              .from('rh_financeiro_lote_itens')
              .select('lote_id')
              .eq('id', itemPago.fatura_id)
              .maybeSingle();
            if (rhItem?.lote_id) rhLotesAfetados.add(rhItem.lote_id);
          }
        }

        // C) Origem INTERMITENTE
        const intermitenteLoteId = itemPago.intermitentes_lote_id || remMeta?.intermitentes_lote_id;
        if (intermitenteLoteId || rel?.origem_tipo === 'INTERMITENTE') {
          let loteIdFinal = intermitenteLoteId || rel?.lote_item_id;
          const targetOrigemId = itemPago.origem_id || rel?.origem_id;

          // Se loteIdFinal ainda não foi resolvido, busca defensivamente pelo lançamento
          if (!loteIdFinal && targetOrigemId) {
            try {
              const { data: lancData } = await supabase
                .from('lancamentos_intermitentes')
                .select('lote_fechamento_id')
                .eq('id', targetOrigemId)
                .maybeSingle();
              if (lancData?.lote_fechamento_id) {
                loteIdFinal = lancData.lote_fechamento_id;
              }
            } catch (_e) {
              // fallback seguro
            }
          }

          if (loteIdFinal) intermitentesLotesAfetados.add(loteIdFinal);

          if (targetOrigemId) {
            await supabase
              .from('lancamentos_intermitentes')
              .update({ status_pipeline: 'PAGO', updated_at: new Date().toISOString() })
              .eq('id', targetOrigemId);
          } else if (loteIdFinal && itemPago.colaborador_id) {
            await supabase
              .from('lancamentos_intermitentes')
              .update({ status_pipeline: 'PAGO', updated_at: new Date().toISOString() })
              .eq('lote_fechamento_id', loteIdFinal)
              .eq('colaborador_id', itemPago.colaborador_id);
          }
        }

        // D) Origem FATURA
        if (rel?.origem_tipo === 'FATURA' && itemPago.fatura_id) {
          await supabase
            .from('faturas')
            .update({ status: 'paga', updated_at: new Date().toISOString() })
            .eq('id', itemPago.fatura_id);
        }
      }

      // Marcar itens de retorno conciliados
      const idsItensConciliados = itensPagos.map((i) => i.id);
      if (idsItensConciliados.length > 0) {
        await supabase
          .from('cnab_retorno_itens')
          .update({
            status_conciliacao: 'conciliado',
            conciliado_em: new Date().toISOString(),
          })
          .in('id', idsItensConciliados);
      }

      // ─────────────────────────────────────────────────────────────────
      // 5. REGRA DE INTEGRIDADE DE LOTE: DIARISTAS
      // ─────────────────────────────────────────────────────────────────
      // Um lote de diaristas SÓ pode ser PAGO se:
      // A) Todos os lançamentos ativos do lote estiverem PAGO
      // B) Todos os itens de remessa associados ao lote estiverem CONCILIADOS
      for (const loteId of diaristasLotesAfetados) {
        const { data: lancamentosLote } = await supabase
          .from('lancamentos_diaristas')
          .select('id, status')
          .eq('lote_fechamento_id', loteId);

        const ativos = (lancamentosLote || []).filter(
          (l: any) => l.status !== 'CANCELADO' && l.status !== 'cancelado' && l.status !== 'ausente'
        );
        const pagos = ativos.filter((l: any) => l.status === 'PAGO' || l.status === 'pago');

        // Buscar itens de remessa atrelados ao lote
        const lancamentoIds = ativos.map((l: any) => l.id);
        let remessaItens = remessaItensList.filter(
          (r: any) => r.lote_item_id === loteId || lancamentoIds.includes(r.origem_id)
        );
        if (remessaItens.length === 0 && lancamentoIds.length > 0) {
          try {
            const { data: remessaQuery } = await supabase
              .from('cnab_remessa_itens')
              .select('id, status, origem_id')
              .in('origem_id', lancamentoIds);
            if (remessaQuery && remessaQuery.length > 0) {
              remessaItens = remessaQuery;
            }
          } catch (_e) {
            // fallback seguro
          }
        }
        const temItemNaoConciliado = remessaItens.some(
          (r: any) => r.status === 'remetido' || r.status === 'rejeitado' || r.status === 'divergente' || (r.status && r.status !== 'conciliado')
        );

        const todosLancamentosPagos = ativos.length > 0 && pagos.length === ativos.length;

        if (todosLancamentosPagos && !temItemNaoConciliado) {
          // TODOS os lançamentos ativos estão pagos e nenhum item da remessa está pendente/rejeitado/divergente
          // -> Lote promovido para PAGO / conciliado
          const { error: updateLoteErr } = await supabase
            .from('diaristas_lotes_fechamento')
            .update({
              status: 'PAGO',
              status_conciliacao: 'conciliado',
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', loteId);

          if (updateLoteErr) {
            console.error(`[CnabConciliacaoService] Falha crítica ao atualizar lote diaristas ${loteId} para PAGO:`, updateLoteErr);
            throw new Error(`Falha ao atualizar cabeçalho do lote de diaristas ${loteId} para PAGO: ${updateLoteErr.message}`);
          }

          try {
            await supabase.rpc('log_audit', {
              p_action: 'DIARISTAS_LOTE_QUITADO_INTEGRAL',
              p_details: JSON.stringify({
                lote_id: loteId,
                total_itens: ativos.length,
                status: 'PAGO',
                status_conciliacao: 'conciliado',
              }),
            });
          } catch (_e) {
            // audit non-blocking
          }
        } else {
          // LIQUIDAÇÃO PARCIAL OU PENDENTE: LOTE NÃO PODE SER MARCADO COMO PAGO!
          // Preserva o status 'cnab_gerado' e tenta atualizar status_conciliacao para 'conciliacao_parcial'
          const { error: partialErr } = await supabase
            .from('diaristas_lotes_fechamento')
            .update({
              status: 'cnab_gerado',
              status_conciliacao: 'conciliacao_parcial',
              updated_at: new Date().toISOString(),
            })
            .eq('id', loteId);

          if (partialErr) {
            // Caso a constraint do banco ainda não tenha 'conciliacao_parcial', mantém 'aguardando_conciliacao'
            const { error: fallbackErr } = await supabase
              .from('diaristas_lotes_fechamento')
              .update({
                status: 'cnab_gerado',
                status_conciliacao: 'aguardando_conciliacao',
                updated_at: new Date().toISOString(),
              })
              .eq('id', loteId);

            if (fallbackErr) {
              console.error(`[CnabConciliacaoService] Falha ao atualizar lote diaristas ${loteId} para conciliação parcial:`, fallbackErr);
              throw new Error(`Falha ao atualizar conciliação parcial do lote ${loteId}: ${fallbackErr.message}`);
            }
          }

          try {
            await supabase.rpc('log_audit', {
              p_action: 'DIARISTAS_LOTE_CONCILIACAO_PARCIAL',
              p_details: JSON.stringify({
                lote_id: loteId,
                total_ativos: ativos.length,
                total_pagos: pagos.length,
                status: 'cnab_gerado',
                pendentes_ou_rejeitados: ativos.length - pagos.length,
              }),
            });
          } catch (_e) {
            // audit non-blocking
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // 6. REGRA DE INTEGRIDADE DE LOTE: INTERMITENTES
      // ─────────────────────────────────────────────────────────────────
      for (const loteId of intermitentesLotesAfetados) {
        const { data: lancamentosInt } = await supabase
          .from('lancamentos_intermitentes')
          .select('id, status_pipeline')
          .eq('lote_fechamento_id', loteId);

        const ativos = (lancamentosInt || []).filter((l: any) => l.status_pipeline !== 'CANCELADO');
        const pagos = ativos.filter((l: any) => l.status_pipeline === 'PAGO');

        // Buscar itens de remessa atrelados ao lote
        const lancamentoIds = ativos.map((l: any) => l.id);
        let remessaItens = remessaItensList.filter(
          (r: any) => r.lote_item_id === loteId || lancamentoIds.includes(r.origem_id)
        );
        if (remessaItens.length === 0 && lancamentoIds.length > 0) {
          try {
            const { data: remessaQuery } = await supabase
              .from('cnab_remessa_itens')
              .select('id, status, origem_id')
              .in('origem_id', lancamentoIds);
            if (remessaQuery && remessaQuery.length > 0) {
              remessaItens = remessaQuery;
            }
          } catch (_e) {
            // fallback seguro
          }
        }
        const temItemNaoConciliado = remessaItens.some(
          (r: any) => r.status === 'remetido' || r.status === 'rejeitado' || r.status === 'divergente' || (r.status && r.status !== 'conciliado')
        );

        const todosLancamentosPagos = ativos.length > 0 && pagos.length === ativos.length;

        if (todosLancamentosPagos && !temItemNaoConciliado) {
          const { error: updateLoteErr } = await supabase
            .from('intermitentes_lotes_fechamento')
            .update({
              status: 'PAGO',
              updated_at: new Date().toISOString(),
            })
            .eq('id', loteId);

          if (updateLoteErr) {
            console.error(`[CnabConciliacaoService] Falha crítica ao atualizar lote intermitentes ${loteId} para PAGO:`, updateLoteErr);
            throw new Error(`Falha ao atualizar lote de intermitentes ${loteId} para PAGO: ${updateLoteErr.message}`);
          }

          try {
            await supabase.rpc('log_audit', {
              p_action: 'INTERMITENTES_LOTE_QUITADO_INTEGRAL',
              p_details: JSON.stringify({
                lote_id: loteId,
                total_itens: ativos.length,
                status: 'PAGO',
              }),
            });
          } catch (_e) {
            // audit non-blocking
          }

          // Sincronização do espelho financeiro (rh_financeiro_lotes)
          try {
            let rhLoteId: string | null = null;
            if (lancamentoIds.length > 0) {
              const { data: finItem, error: finItemErr } = await supabase
                .from('rh_financeiro_lote_itens')
                .select('lote_id')
                .in('referencia_evento_id', lancamentoIds)
                .eq('origem_evento', 'lancamentos_intermitentes')
                .limit(1);

              if (!finItemErr && finItem && finItem.length > 0 && finItem[0].lote_id) {
                rhLoteId = finItem[0].lote_id;
              }
            }

            // Fallback unívoco e seguro por tenant + empresa + competência + tipo INTERMITENTES
            if (!rhLoteId) {
              const { data: opLote } = await supabase
                .from('intermitentes_lotes_fechamento')
                .select('tenant_id, empresa_id, competencia')
                .eq('id', loteId)
                .maybeSingle();

              if (opLote?.empresa_id && opLote?.competencia) {
                let queryRh = supabase
                  .from('rh_financeiro_lotes')
                  .select('id')
                  .eq('empresa_id', opLote.empresa_id)
                  .eq('competencia', opLote.competencia)
                  .eq('tipo', 'INTERMITENTES');

                if (opLote.tenant_id) {
                  queryRh = queryRh.eq('tenant_id', opLote.tenant_id);
                }

                const { data: rhLote, error: rhLoteErr } = await queryRh.maybeSingle();
                if (!rhLoteErr && rhLote?.id) {
                  rhLoteId = rhLote.id;
                }
              }
            }

            if (rhLoteId) {
              const { error: rhUpdateErr } = await supabase
                .from('rh_financeiro_lotes')
                .update({
                  status: 'PAGO',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', rhLoteId);

              if (rhUpdateErr) {
                console.error(`[CnabConciliacaoService] Falha ao atualizar espelho financeiro ${rhLoteId} para PAGO:`, rhUpdateErr);
                throw new Error(`Falha ao sincronizar espelho financeiro ${rhLoteId} para PAGO: ${rhUpdateErr.message}`);
              }
            }
          } catch (syncErr: any) {
            console.error(`[CnabConciliacaoService] Erro na sincronização do espelho financeiro do lote ${loteId}:`, syncErr);
            throw syncErr;
          }
        } else {
          const { error: partialUpdateErr } = await supabase
            .from('intermitentes_lotes_fechamento')
            .update({ status: 'CNAB_GERADO', updated_at: new Date().toISOString() })
            .eq('id', loteId);

          if (partialUpdateErr) {
            console.error(`[CnabConciliacaoService] Falha ao manter lote intermitentes ${loteId} em CNAB_GERADO:`, partialUpdateErr);
            throw new Error(`Falha ao atualizar conciliação parcial do lote de intermitentes ${loteId}: ${partialUpdateErr.message}`);
          }

          try {
            await supabase.rpc('log_audit', {
              p_action: 'INTERMITENTES_LOTE_CONCILIACAO_PARCIAL',
              p_details: JSON.stringify({
                lote_id: loteId,
                total_ativos: ativos.length,
                total_pagos: pagos.length,
                status: 'CNAB_GERADO',
                pendentes_ou_rejeitados: ativos.length - pagos.length,
              }),
            });
          } catch (_e) {
            // audit non-blocking
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // 7. REGRA DE INTEGRIDADE DE LOTE: CLT / RH FINANCEIRO
      // ─────────────────────────────────────────────────────────────────
      for (const loteId of rhLotesAfetados) {
        const { data: itensRh } = await supabase
          .from('rh_financeiro_lote_itens')
          .select('id, status')
          .eq('lote_id', loteId);

        const ativos = (itensRh || []).filter((l: any) => l.status !== 'CANCELADO');
        const pagos = ativos.filter((l: any) => l.status === 'PAGO');

        if (ativos.length > 0 && pagos.length === ativos.length) {
          await supabase
            .from('rh_financeiro_lotes')
            .update({ status: 'PAGO', updated_at: new Date().toISOString() })
            .eq('id', loteId);
        }
      }

      return {
        success: true,
        message: `Baixa financeira executada. Pagos: ${itensPagos.length}, Rejeitados: ${itensRejeitados.length}.`,
      };
    } catch (err: any) {
      console.error('[Baixa Financeira] Erro ao processar:', err);
      return { success: false, message: err.message };
    }
  },
};
