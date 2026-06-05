import { BaseService } from './base.service';
import { supabase } from '@/lib/supabase';

export type ServicoEspecificoPeriodo = 'N1' | 'N2' | 'DIA' | 'INTEGRAL';
export type ServicoEspecificoStatus = 'RECEBIDO' | 'CONCLUIDO' | 'CANCELADO';

export interface ServicoEspecificoRegra {
    id: string;
    codigo: string; // Agora representa o Período (D1, N1...)
    descricao: string;
    tipo_periodo: 'DIURNO' | 'NOTURNO';
    peso_multiplicador: number;
    periodo?: string; // Legado ou informativo
    quantidade_colaboradores?: number; // Legado ou informativo
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
    fornecedor_id?: string | null;
    transportadora_id?: string | null;
    produto_carga_id?: string | null;
    tipo_servico_id?: string | null;
    data_operacao: string;
    quantidade: number;
    quantidade_colaboradores: number;
    codigo_operacional: string;
    valor_unitario: number; // Agora mantido por compatibilidade
    valor_total: number;
    // Snapshots obrigatórios
    valor_unitario_snapshot: number;
    fator_periodo_snapshot: number;
    tipo_calculo_snapshot: string;
    
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

    /**
     * Auto-provisionamento de períodos padrão para o tenant atual
     */
    async ensureDefaultPeriods(tenantId: string) {
        const defaults = [
            { codigo: 'D1', descricao: 'Primeiro Período Diurno', tipo_periodo: 'DIURNO', peso_multiplicador: 1.00 },
            { codigo: 'D2', descricao: 'Segundo Período Diurno', tipo_periodo: 'DIURNO', peso_multiplicador: 1.00 },
            { codigo: 'N1', descricao: 'Primeiro Período Noturno', tipo_periodo: 'NOTURNO', peso_multiplicador: 1.25 },
            { codigo: 'N2', descricao: 'Segundo Período Noturno', tipo_periodo: 'NOTURNO', peso_multiplicador: 1.50 },
        ];

        for (const item of defaults) {
            await this.supabase
                .from('servicos_especificos_regras')
                .upsert({
                    ...item,
                    tenant_id: tenantId,
                    ativo: true,
                    valor_padrao: 0 
                }, { onConflict: 'tenant_id,codigo' });
        }
    }

    async duplicar(id: string) {
        const { data: original, error: fetchError } = await this.supabase
            .from('servicos_especificos_regras')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const { id: _, created_at: __, ...copyData } = original;
        const newPayload = {
            ...copyData,
            codigo: `${original.codigo} (C)`,
            descricao: `${original.descricao} (Cópia)`,
            ativo: true
        };

        const { data: novo, error: insertError } = await this.supabase
            .from('servicos_especificos_regras')
            .insert(newPayload)
            .select()
            .single();

        if (insertError) throw insertError;
        return novo;
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
