import { supabase } from '@/lib/supabase';
import { BaseService } from './base.service';

import { BankAccountService } from './bankAccount.service';
import { CnabBBValidatorService } from './cnabBBValidator.service';
import { CnabRetornoService } from './cnab/cnabRetorno.service';
import { CNAB240BBWriter } from './cnab/CNAB240BBWriter';
import { CnabRemessaArquivoService } from './cnab/cnabRemessaArquivo.service';

export { CnabRemessaArquivoService };
export { CnabRetornoService };
export const ContaBancariaService = BankAccountService;

class LoteRemessaServiceClass extends BaseService<'lotes_remessa'> {
  constructor() { super('lotes_remessa'); }

  async getFullHistory() {
    return CnabRemessaArquivoService.listarHistorico();
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
    const { data: faturas, error } = await supabase
      .from('faturas')
      .select('*')
      .eq('competencia', competencia);
    if (error) throw error;

    const { data: empresas } = await supabase.from('empresas').select('id, nome');
    const { data: colaboradores } = await supabase.from('colaboradores').select('id, nome');

    const empresaMap = new Map((empresas || []).map(e => [e.id, e]));
    const colaboradorMap = new Map((colaboradores || []).map(c => [c.id, c]));

    return (faturas || []).map(f => ({
      ...f,
      empresas: empresaMap.get(f.empresa_id) || null,
      colaboradores: colaboradorMap.get(f.colaborador_id) || null
    }));
  }
}
export const FaturaService = new FaturaServiceClass();

class LoteRetornoServiceClass extends BaseService<'lotes_retorno'> {
  constructor() { super('lotes_retorno'); }
}
export const LoteRetornoService = new LoteRetornoServiceClass();

export const CNABService = {
  async validateRemessa(competencia: string, empresaId: string, contaId: string) {
    const { data: faturas, error } = await supabase
      .from('faturas')
      .select('*')
      .eq('competencia', competencia)
      .eq('empresa_id', empresaId);

    if (error) throw error;

    let bnc = null;
    if (contaId) {
      const { data } = await supabase.from('contas_bancarias_empresa').select('*').eq('id', contaId).maybeSingle();
      bnc = data;
    }

    const result = await CnabBBValidatorService.validateLote(
      faturas ? faturas.map(f => f.id) : [],
      bnc
    );

    try {
      await CnabRemessaArquivoService.registrarAuditoria({
        acao: 'validacao',
        detalhes: {
          empresa_id: empresaId,
          competencia,
          conta_bancaria_id: contaId,
          isValid: result.isValid,
          errorsCount: result.errors.length,
          pendenciesCount: result.pendenciesByColaborador.length,
        }
      });

      await supabase.rpc('log_audit', {
        p_action: 'VALIDATE_CNAB_LOTE',
        p_details: JSON.stringify({
          empresa_id: empresaId,
          competencia,
          isValid: result.isValid,
          errorsCount: result.errors.length,
          pendenciesCount: result.pendenciesByColaborador.length
        })
      });
    } catch (e) {
      console.warn('Audit log fail', e);
    }

    return {
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
      pendenciesByColaborador: result.pendenciesByColaborador,
      summary: {
        totalItems: faturas?.length || 0,
        totalValue: faturas?.reduce((acc, f) => acc + Number(f.valor), 0) || 0
      }
    };
  },

  async generateRemessa(params: { competencia: string, empresaId: string, contaId: string, modo?: 'homologacao' | 'producao' }) {
    const { competencia, empresaId, contaId, modo = 'producao' } = params;

    const { data: faturas, error: fatError } = await supabase
      .from('faturas')
      .select('*')
      .eq('competencia', competencia)
      .eq('empresa_id', empresaId)
      .neq('status', 'pago');

    if (fatError) throw fatError;
    if (!faturas || faturas.length === 0) throw new Error('Sem faturas pendentes para gerar remessa nesta competência.');

    const lote = await LoteRemessaService.create({
      competencia,
      conta_bancaria_id: contaId,
      quantidade_titulos: faturas.length,
      valor_total: faturas.reduce((acc, f) => acc + Number(f.valor), 0),
      status: 'gerado'
    });

    await Promise.all(
      faturas.map(f => FaturaService.update(f.id, { lote_remessa_id: lote.id }))
    );

    let result;
    try {
      result = await CNAB240BBWriter.generateCNAB240({
        loteId: lote.id,
        competencia,
        contaBancariaId: contaId,
        modo,
        salvarConteudo: true,
      });
    } catch (error) {
      await LoteRemessaService.update(lote.id, { status: 'erro' });
      throw error;
    }

    try {
      await supabase.rpc('log_audit', {
        p_action: 'GENERATE_CNAB240',
        p_details: JSON.stringify({
          lote_id: lote.id,
          arquivo_id: result.arquivoId,
          nome_arquivo: result.fileName,
          sequencial: result.sequencial,
          total_valor: result.totalValor,
          total_linhas: result.totalLinhas,
          hash: result.hash.substring(0, 16) + '...',
          modo,
        }),
      });
    } catch (_e) {
      // audit never blocks
    }

    return {
      ...lote,
      fileName: result.fileName,
      content: result.content,
      arquivoId: result.arquivoId,
      sequencial: result.sequencial,
      hash: result.hash,
      inconsistencias: result.inconsistencias,
    };
  },

  async marcarComoEnviadoManual(arquivoId: string, observacoes?: string) {
    await CnabRemessaArquivoService.marcarComoEnviadoManual(arquivoId, observacoes);
  },

  async marcarComoHomologado(arquivoId: string, observacoes?: string) {
    await CnabRemessaArquivoService.marcarComoHomologado(arquivoId, observacoes);
  },

  async processRetorno(file: File, banco: string) {
    return CnabRetornoService.processarArquivo(file, banco);
  }
};

export const PortalService = {
  async getMyCliente() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome, empresa_id, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getClientStats() {
    const mesAtual = new Date().toISOString().slice(0, 7);

    const { data: faturas, error } = await supabase
      .from('faturas')
      .select('valor, status, competencia');
    if (error) throw error;

    const faturasMes = (faturas || []).filter(f => f.competencia?.startsWith(mesAtual));

    return {
      totalFaturadoMes: faturasMes.reduce((acc, f) => acc + Number(f.valor), 0),
      totalFaturadoGeral: (faturas || []).reduce((acc, f) => acc + Number(f.valor), 0),
      pendentes: (faturas || []).filter(f => f.status === 'pendente').length,
      aprovados: (faturas || []).filter(f => f.status === 'aprovado').length,
      consolidados: (faturas || []).length,
    };
  },

  async getConsolidados() {
    const { data, error } = await supabase
      .from('financeiro_consolidados_cliente')
      .select('id, competencia, valor_total, status, created_at')
      .order('competencia', { ascending: false })
      .limit(12);
    if (error) throw error;
    return data || [];
  },

  async getFaturasPendentes() {
    const { data, error } = await supabase
      .from('faturas')
      .select('id, competencia, valor, vencimento, status, created_at, motivo_rejeicao')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getHistoricoFaturas() {
    const { data, error } = await supabase
      .from('faturas')
      .select('id, competencia, valor, status, data_pagamento, created_at, motivo_rejeicao')
      .in('status', ['aprovado', 'pago', 'rejeitado'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async aprovarFatura(faturaId: string) {
    const { error } = await supabase
      .from('faturas')
      .update({ status: 'aprovado' })
      .eq('id', faturaId);
    if (error) throw error;
  },

  async rejeitarFatura(faturaId: string, motivo: string) {
    const { error } = await supabase
      .from('faturas')
      .update({ status: 'rejeitado', motivo_rejeicao: motivo })
      .eq('id', faturaId);
    if (error) throw error;
  },
};
