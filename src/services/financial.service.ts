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

    // 4. "Gerar" o arquivo (mock de string CNAB)
    const cnabContent = `HEADER_CNAB_240_${lote.id}\n` + 
      faturas.map(f => `LINHA_TITULO_${f.id}_VALOR_${f.valor}`).join('\n') + 
      `\nTRAILER_CNAB`;

    // 5. Salvar no bucket (simulado aqui como se o service já tivesse o método ou fizesse manual)
    // Para simplificar no MVP, apenas retornamos o conteúdo ou um link fake
    const fileName = `remessa_${lote.id}.rem`;
    
    return { ...lote, fileName, content: cnabContent };
  },

  async processRetorno(file: File, banco: string) {
    // 1. Ler o arquivo (simulado)
    const text = await file.text();
    
    // 2. Criar registro de lote retorno
    const loteRetorno = await LoteRetornoService.create({
      banco,
      status: 'processado',
      resumo: { originalName: file.name, fileSize: file.size }
    });

    // 3. Lógica de processamento (MOCKED)
    // Procurar por "nosso_numero" no arquivo e dar baixa nas faturas
    const faturas = await FaturaService.getAll();
    let paidCount = 0;
    
    for (const fatura of faturas) {
       // Se o nosso_numero estiver no "arquivo", marcamos como pago
       if (fatura.nosso_numero && text.includes(fatura.nosso_numero)) {
         await FaturaService.update(fatura.id, { 
           status: 'pago', 
           data_pagamento: new Date().toISOString().split('T')[0] 
         });
         paidCount++;
       }
    }

    return {
      loteId: loteRetorno.id,
      resumo: {
        totalProcessado: faturas.length,
        pagos: paidCount,
        rejeitados: 0
      }
    };
  }
};

// PORTAL SERVICE
export const PortalService = {
  async getClientStats(clienteId: string) {
    const { data: faturas } = await supabase.from('faturas').select('*').eq('empresa_id', clienteId);
    
    return {
      totalFaturado: faturas?.reduce((acc, f) => acc + Number(f.valor), 0) || 0,
      pendentes: faturas?.filter(f => f.status === 'pendente').length || 0,
      aguardandoAprovacao: faturas?.filter(f => f.status === 'pendente').length || 0 // No MVP usamos pendente
    };
  },

  async getReports(clienteId: string) {
    const { data: faturas } = await supabase
      .from('faturas')
      .select('*, colaboradores(nome)')
      .eq('empresa_id', clienteId)
      .order('competencia', { ascending: false });
    return faturas;
  },

  async approveBilling(faturaId: string, observation?: string) {
    return await FaturaService.update(faturaId, { 
      status: 'pendente', // No portal isso confirmaria o faturamento interno
      motivo_rejeicao: observation 
    });
  }
};
