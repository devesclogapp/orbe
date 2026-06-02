import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';

export type ServicoEspecificoPeriodo = 'N1' | 'N2' | 'DIA' | 'INTEGRAL';
export type ServicoEspecificoStatus = 'RECEBIDO' | 'CONCLUIDO' | 'CANCELADO';

export interface ServicoEspecificoRegra {
    id: string;
    codigo: string;
    descricao: string;
    periodo: ServicoEspecificoPeriodo;
    quantidade_colaboradores: number;
    valor_padrao: number;
    empresa_id: string | null;
    tenant_id: string;
    ativo: boolean;
    created_at?: string;
}

export interface ServicoEspecificoLancamento {
    id: string;
    regra_id: string;
    empresa_id: string;
    unidade_id: string | null;
    data_operacao: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    colaboradores_vinculados: any[];
    observacao: string | null;
    forma_pagamento_id: string | null;
    encarregado_nome: string | null;
    status: ServicoEspecificoStatus;
    tenant_id: string;
}

// 1. Classe de Regras (Tabela Paramétrica)
class ServicosEspecificosRegrasServiceClass extends BaseService<any> {
    constructor() {
        super('servicos_especificos_regras' as any);
    }

    async getAtivosByEmpresa(empresaId?: string) {
        let query = this.supabase
            .from('servicos_especificos_regras')
            .select('*')
            .eq('ativo', true);

        if (empresaId) {
            query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
        } else {
            query = query.is('empresa_id', null);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro getAtivosByEmpresa', error);
            throw error;
        }

        return data as ServicoEspecificoRegra[];
    }
}

export const ServicosEspecificosRegrasService = new ServicosEspecificosRegrasServiceClass();

// 2. Classe de Lançamentos
class ServicosEspecificosLancamentoServiceClass extends BaseService<any> {
    constructor() {
        super('servicos_especificos_lancamentos' as any);
    }

    async createLancamento(payload: Partial<ServicoEspecificoLancamento>) {
        const { data, error } = await this.supabase
            .from('servicos_especificos_lancamentos')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Erro createLancamento:', error);
            throw error;
        }

        return data;
    }

    async getByPeriodo(inicio: string, fim: string, empresaId?: string) {
        let query = this.supabase
            .from('servicos_especificos_lancamentos')
            .select(`
                *,
                empresas (id, nome),
                unidades (id, nome),
                servicos_especificos_regras (id, codigo, descricao),
                formas_pagamento_operacional (id, nome)
            `)
            .gte('data_operacao', inicio)
            .lte('data_operacao', fim);

        if (empresaId) {
            query = query.eq('empresa_id', empresaId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro ServicosEspec getByPeriodo:', error);
            throw error;
        }

        return data;
    }
}

export const ServicosEspecificosLancamentoService = new ServicosEspecificosLancamentoServiceClass();
