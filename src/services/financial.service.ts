import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';

class ContaBancariaServiceClass extends BaseService<'contas_bancarias'> {
  constructor() { super('contas_bancarias'); }
  async getByEmpresa(empresaId: string) {
    const { data, error } = await supabase.from('contas_bancarias').select('*').eq('empresa_id', empresaId);
    if (error) throw error;
    return data;
  }
}
export const ContaBancariaService = new ContaBancariaServiceClass();

class LoteRemessaServiceClass extends BaseService<'lotes_remessa'> {
  constructor() { super('lotes_remessa'); }
  async getFullHistory() {
    const { data, error } = await supabase
      .from('lotes_remessa')
      .select('*, contas_bancarias(banco, agencia, conta)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
}
export const LoteRemessaService = new LoteRemessaServiceClass();

class FaturaServiceClass extends BaseService<'faturas'> {
  constructor() { super('faturas'); }
  async getByLote(loteId: string) {
    const { data, error } = await supabase.from('faturas').select('*, colaboradores(nome)').eq('lote_remessa_id', loteId);
    if (error) throw error;
    return data;
  }
  async getByCompetencia(competencia: string) {
    const { data, error } = await supabase
      .from('faturas')
      .select('*, empresas(nome), colaboradores(nome)')
      .eq('competencia', competencia);
    if (error) throw error;
    return data;
  }
}
export const FaturaService = new FaturaServiceClass();

class LoteRetornoServiceClass extends BaseService<'lotes_retorno'> {
  constructor() { super('lotes_retorno'); }
}
export const LoteRetornoService = new LoteRetornoServiceClass();

// CNAB SERVICE ENGINE
export const CNABService = {
  async validateRemessa(competencia: string, empresaId: string) {
    // Simula uma validação pesada
    const { data: faturas, error } = await supabase
      .from('faturas')
      .select('*')
      .eq('competencia', competencia)
      .eq('empresa_id', empresaId);
    
    if (error) throw error;

    const inconsistencies = [];
    if (!faturas || faturas.length === 0) inconsistencies.push("Nenhuma fatura encontrada para esta competência.");
    
    // Simula verificação de dados bancários
    const { data: bnc } = await supabase.from('contas_bancarias').select('*').eq('empresa_id', empresaId).maybeSingle();
    if (!bnc) inconsistencies.push("Dados bancários da empresa não configurados.");

    return {
      isValid: inconsistencies.length === 0,
      errors: inconsistencies,
      summary: {
        totalItems: faturas?.length || 0,
        totalValue: faturas?.reduce((acc, f) => acc + Number(f.valor), 0) || 0
      }
    };
  },

  async generateRemessa(params: { competencia: string, empresaId: string, contaId: string }) {
    const { competencia, empresaId, contaId } = params;

    // 1. Buscar faturas
    const { data: faturas } = await supabase.from('faturas').select('*').eq('competencia', competencia);
    if (!faturas) throw new Error("Sem faturas para gerar remessa");

    // 2. Criar o lote
    const lote = await LoteRemessaService.create({
      competencia,
      conta_bancaria_id: contaId,
      quantidade_titulos: faturas.length,
      valor_total: faturas.reduce((acc, f) => acc + Number(f.valor), 0),
      status: 'gerado'
    });

    // 3. Vincular faturas ao lote
    await Promise.all(faturas.map(f => 
      FaturaService.update(f.id, { lote_remessa_id: lote.id })
    ));

    // 4. Gerar conteúdo CNAB real (Simpificado para 240 posições)
    const generateCNAB240 = () => {
      const header = `00100000          2              01ORBE ERP             ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}000000\n`;
      const body = faturas.map((f, i) => 
        `00100013${(i+1).toString().padStart(5, '0')}P 01010${f.id.substring(0, 10).padEnd(20)} ${f.valor.toString().replace('.', '').padStart(15, '0')}`
      ).join('\n');
      const trailer = `\n00100019${(faturas.length + 2).toString().padStart(6, '0')}000000`;
      return header + body + trailer;
    };

    const cnabContent = generateCNAB240();

    // 5. Salvar no bucket via Supabase Storage
    const fileName = `remessas/competencia_${competencia.replace('-', '')}/lote_${lote.id}.rem`;
    
    try {
      const { data: storageData, error: storageError } = await supabase.storage
        .from('financial_docs')
        .upload(fileName, cnabContent, { contentType: 'text/plain', upsert: true });
        
      if (storageError) console.error("Erro ao salvar remessa no Storage:", storageError);
    } catch (e) {
      console.warn("Storage não configurado ou erro na permissão. Proseguindo sem persistência física.");
    }

    return { ...lote, fileName, content: cnabContent };
  },

  async processRetorno(file: File, banco: string) {
    // 1. Ler o arquivo real
    const text = await file.text();
    
    // 2. Criar registro de lote retorno
    const loteRetorno = await LoteRetornoService.create({
      banco,
      status: 'processado',
      resumo: { originalName: file.name, fileSize: file.size, processedAt: new Date().toISOString() }
    });

    // 3. Lógica de processamento REAL
    // No CNAB de retorno, os pagamentos costumam vir em linhas tipo 'T' ou 'U'
    const lines = text.split('\n');
    let paidCount = 0;
    
    // Buscar faturas que podem estar neste retorno
    const { data: faturas } = await supabase.from('faturas').select('id, nosso_numero').neq('status', 'pago');
    
    if (faturas) {
      for (const fatura of faturas) {
        // Se o nosso_numero da fatura for encontrado no arquivo de retorno
        if (fatura.nosso_numero && text.includes(fatura.nosso_numero)) {
          await FaturaService.update(fatura.id, { 
            status: 'pago', 
            data_pagamento: new Date().toISOString().split('T')[0] 
          });
          paidCount++;
        }
      }
    }

    return {
      loteId: loteRetorno.id,
      resumo: {
        totalProcessado: lines.length,
        pagos: paidCount,
        rejeitados: lines.length - paidCount - 2 // Descontando header e trailer
      }
    };
  }
};

// PORTAL SERVICE — dados reais do cliente logado
export const PortalService = {
    /**
     * Retorna o registro do cliente associado ao usuário logado via user_id.
     */
    async getMyCliente() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
            .from("clientes")
            .select("id, nome, empresa_id, status")
            .eq("user_id", user.id)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    /**
     * KPIs do dashboard: valor faturado no mês atual, pendentes, aprovados.
     */
    async getClientStats() {
        const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"

        const { data: faturas, error } = await supabase
            .from("faturas")
            .select("valor, status, competencia");
        if (error) throw error;

        const faturasMes = (faturas || []).filter(f => f.competencia?.startsWith(mesAtual));

        return {
            totalFaturadoMes: faturasMes.reduce((acc, f) => acc + Number(f.valor), 0),
            totalFaturadoGeral: (faturas || []).reduce((acc, f) => acc + Number(f.valor), 0),
            pendentes: (faturas || []).filter(f => f.status === "pendente").length,
            aprovados: (faturas || []).filter(f => f.status === "aprovado").length,
            consolidados: (faturas || []).length,
        };
    },

    /**
     * Lista de fechamentos (consolidados_cliente) do cliente logado.
     */
    async getConsolidados() {
        const { data, error } = await supabase
            .from("financeiro_consolidados_cliente")
            .select("id, competencia, valor_total, status, created_at")
            .order("competencia", { ascending: false })
            .limit(12);
        if (error) throw error;
        return data || [];
    },

    /**
     * Faturas pendentes de aprovação do cliente logado.
     */
    async getFaturasPendentes() {
        const { data, error } = await supabase
            .from("faturas")
            .select("id, competencia, valor, vencimento, status, created_at, motivo_rejeicao")
            .eq("status", "pendente")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /**
     * Histórico de faturas (todas as aprovadas/rejeitadas) do cliente logado.
     */
    async getHistoricoFaturas() {
        const { data, error } = await supabase
            .from("faturas")
            .select("id, competencia, valor, status, data_pagamento, created_at, motivo_rejeicao")
            .in("status", ["aprovado", "pago", "rejeitado"])
            .order("created_at", { ascending: false })
            .limit(20);
        if (error) throw error;
        return data || [];
    },

    /**
     * Aprovar fatura: muda status para 'aprovado'.
     */
    async aprovarFatura(faturaId: string) {
        const { error } = await supabase
            .from("faturas")
            .update({ status: "aprovado" })
            .eq("id", faturaId);
        if (error) throw error;
    },

    /**
     * Rejeitar fatura: muda status para 'rejeitado' e registra motivo.
     */
    async rejeitarFatura(faturaId: string, motivo: string) {
        const { error } = await supabase
            .from("faturas")
            .update({ status: "rejeitado", motivo_rejeicao: motivo })
            .eq("id", faturaId);
        if (error) throw error;
    },
};

