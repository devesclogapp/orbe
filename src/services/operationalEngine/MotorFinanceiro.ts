import { supabase } from "@/lib/supabase";
import { EngineLogger } from "./Logger";

export const MotorFinanceiro = {
  /**
   * Processa o fechamento financeiro consolidando as operações do ciclo e vinculando valores de faturamento do cliente
   * Cria 'financeiro_consolidados_cliente' e 'faturas' para remessas baseando nas operações_producao
   */
  processarFechamento: async (competencia: string, empresaId: string, tenantId: string) => {
    try {
      EngineLogger.info(`[MotorFinanceiro] Iniciando Fechamento: ${competencia} | Empresa: ${empresaId}`, { component: 'MotorFinanceiro' });

      // 1. Limpar consolidados existentes para ser idempotente
      await supabase.from("financeiro_consolidados_cliente").delete().eq("competencia", competencia).eq("empresa_id", empresaId);
      await supabase.from("financeiro_consolidados_colaborador").delete().eq("competencia", competencia).eq("empresa_id", empresaId);
      await supabase.from("faturas").delete().eq("competencia", competencia).eq("empresa_id", empresaId);

      // 2. Buscar Dados Operacionais do Mês/Ciclo
      const [year, month] = competencia.split("-");
      const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
      const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
      const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const { data: operacoes, error: opError } = await supabase
        .from('operacoes_producao')
        .select(`
          id, valor_total, valor_faturamento_nf, quantidade, 
          tipo_calculo_snapshot, custo_com_iss, valor_descarga, 
          colaborador_id, transportadora_id, status_pagamento
        `)
        .eq('empresa_id', empresaId)
        .eq('tenant_id', tenantId)
        .gte('data_operacao', `${competencia}-01`)
        .lt('data_operacao', nextMonthStr);

      if (opError) throw opError;

      EngineLogger.info(`[MotorFinanceiro] Operações encontradas: ${operacoes?.length || 0}`, { component: 'MotorFinanceiro' });

      if (!operacoes || operacoes.length === 0) return { success: true, message: 'Nenhuma operação para faturar.' };

      // 3. Consolidar por Cliente (Transportadora/Cliente da Operação)
      // Como não existe 'cliente_id' explícito na tabela, usaremos "transportadora_id" se ele atuar como cliente. Se houvesse cliente, usaríamos cliente_id.
      // E Consolidado de Colaborador e Diarista
      const consolidadosCliente: Record<string, { total: number, ops: number, ids: string[] }> = {};
      const consolidadosColab: Record<string, { total: number, ids: string[] }> = {};

      for (const op of operacoes) {
        // FATURAMENTO (Cliente/Transportadora)
        // Usa transportadora_id provisoriamente como cliente neste contexto logístico
        if (op.transportadora_id) {
          if (!consolidadosCliente[op.transportadora_id]) {
            consolidadosCliente[op.transportadora_id] = { total: 0, ops: 0, ids: [] };
          }
          const opTotal = Number(op.valor_faturamento_nf || op.valor_descarga || op.valor_total || 0);
          consolidadosCliente[op.transportadora_id].total += opTotal;
          consolidadosCliente[op.transportadora_id].ops += 1;
          consolidadosCliente[op.transportadora_id].ids.push(op.id);
        }

        // PAGAMENTO (Colaborador)
        if (op.colaborador_id) {
          if (!consolidadosColab[op.colaborador_id]) {
            consolidadosColab[op.colaborador_id] = { total: 0, ids: [] };
          }
          // Diaristas ou valores diretos de producao in loco
          const colabTotal = Number(op.custo_com_iss || op.valor_total || 0);
          consolidadosColab[op.colaborador_id].total += colabTotal;
          consolidadosColab[op.colaborador_id].ids.push(op.id);
        }
      }

      // 4. Salvar Consolidados de Cliente e Faturas Relacionadas
      for (const [clientId, data] of Object.entries(consolidadosCliente)) {
        if (data.total <= 0) continue;

        // Insere Consolidado (Tabela antiga/nova dependendo do schema, se cliente_id não houver, ajustaremos para aceitar id)
        const { error: insErr } = await supabase.from("financeiro_consolidados_cliente").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          cliente_id: clientId, // Usamos o transportadora_id aqui como mapeamento
          competencia: competencia,
          valor_base: data.total,
          valor_total: data.total, // valor_regras adicionaria depois
          quantidade_operacoes: data.ops,
          status: 'pendente'
        });

        if (insErr) EngineLogger.warn(`[MotorFinanceiro] Erro ao consolidar cliente ${clientId}: ${insErr.message}`, { component: 'MotorFinanceiro' });

        // Gera Fatura de Recebimento
        await supabase.from("faturas").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          cliente_id: clientId,
          competencia: competencia,
          valor: data.total,
          status: 'pendente'
        });

        // 5. Salvar na tabela de rastreio financeiro_calculos_memoria (Apenas pro primeiro op por ex, numa aplicacao inteira salvaria p/ todos)
        await supabase.from("financeiro_calculos_memoria").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          cliente_id: clientId,
          competencia: competencia,
          tipo_calculo: 'FATURAMENTO',
          valor_final: data.total,
          memoria_detalhada: {
            mensagem: 'Consolidado via MotorFinanceiro',
            operacoes: data.ids,
            quantidade_ops: data.ops
          }
        });
      }

      // 6. Salvar Consolidados de Colaboradores (Diaristas)
      for (const [colabId, data] of Object.entries(consolidadosColab)) {
        if (data.total <= 0) continue;

        await supabase.from("financeiro_consolidados_colaborador").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          colaborador_id: colabId,
          competencia: competencia,
          valor_total: data.total,
          status: 'pendente'
        });

        // Para diaristas pagamentos também podem gerar faturas a pagar
        await supabase.from("faturas").insert({
          tenant_id: tenantId,
          empresa_id: empresaId,
          colaborador_id: colabId,
          competencia: competencia,
          valor: data.total,
          status: 'pendente' 
        });
      }

      EngineLogger.info(`[MotorFinanceiro] Fechamento concluído: ${competencia}`, { component: 'MotorFinanceiro' });
      return { success: true };
    } catch (e: any) {
      EngineLogger.error(`[MotorFinanceiro] Erro: ${e.message}`, { component: 'MotorFinanceiro' });
      return { success: false, error: e };
    }
  }
};
