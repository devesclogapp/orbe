import { supabase } from '@/lib/supabase';
import { getCurrentTenantId } from './domain/base.service';
import { differenceInDays } from 'date-fns';

export interface InadimplenciaBucket {
  dias_1_30: number;
  dias_31_60: number;
  dias_61_90: number;
  dias_mais_90: number;
  total_inadimplente: number;
}

export interface ClienteInadimplente extends InadimplenciaBucket {
  empresa_id: string;
  empresa_nome: string;
  titulos: any[];
}

export interface InadimplenciaConsolidada {
  totais: InadimplenciaBucket;
  clientes: ClienteInadimplente[];
}

class InadimplenciaServiceClass {
  async getAgingList(): Promise<InadimplenciaConsolidada> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) throw new Error('Tenant não encontrado.');

    // Fetch all active, unpaid revenues that have a valid vencimento
    // Exclude status: 'recebido', 'pago', 'conciliado', 'cancelado' (the canonical non-debt statuses)
    const { data, error } = await supabase
      .from('receitas_operacionais')
      .select(`
        *,
        empresas:empresa_id(nome)
      `)
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("recebido","pago","conciliado","cancelado")')
      .lt('vencimento', new Date().toISOString().split('T')[0]); // Overdue (before today)

    if (error) {
      console.error('Erro ao buscar inadimplência:', error);
      throw error;
    }

    const hoje = new Date();
    const totais: InadimplenciaBucket = {
      dias_1_30: 0,
      dias_31_60: 0,
      dias_61_90: 0,
      dias_mais_90: 0,
      total_inadimplente: 0,
    };

    const clientesMap = new Map<string, ClienteInadimplente>();

    for (const item of (data || [])) {
      if (!item.vencimento) continue;
      
      const vDate = new Date(item.vencimento + 'T12:00:00');
      const diffDays = differenceInDays(hoje, vDate);
      
      if (diffDays <= 0) continue; // Not overdue yet

      const valor = Number(item.valor_total) || 0;
      const empresaId = item.empresa_id;
      
      if (!clientesMap.has(empresaId)) {
        clientesMap.set(empresaId, {
          empresa_id: empresaId,
          empresa_nome: item.empresas?.nome || 'Empresa Desconhecida',
          dias_1_30: 0,
          dias_31_60: 0,
          dias_61_90: 0,
          dias_mais_90: 0,
          total_inadimplente: 0,
          titulos: [],
        });
      }
      
      const clientBucket = clientesMap.get(empresaId)!;
      clientBucket.titulos.push(item);
      clientBucket.total_inadimplente += valor;
      totais.total_inadimplente += valor;

      if (diffDays <= 30) {
        clientBucket.dias_1_30 += valor;
        totais.dias_1_30 += valor;
      } else if (diffDays <= 60) {
        clientBucket.dias_31_60 += valor;
        totais.dias_31_60 += valor;
      } else if (diffDays <= 90) {
        clientBucket.dias_61_90 += valor;
        totais.dias_61_90 += valor;
      } else {
        clientBucket.dias_mais_90 += valor;
        totais.dias_mais_90 += valor;
      }
    }

    return {
      totais,
      clientes: Array.from(clientesMap.values()).sort((a, b) => b.total_inadimplente - a.total_inadimplente)
    };
  }
}

export const InadimplenciaService = new InadimplenciaServiceClass();
