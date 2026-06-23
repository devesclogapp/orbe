import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

export interface GetAprovacoesRhParams {
  page: number;
  itemsPerPage: number;
  tipo: string;
  empresaId: string;
  searchTerm: string;
  situacao: "Em análise" | "Aprovado" | "Devolvido";
  inicioCompetencia?: string;
  fimCompetencia?: string;
}

export class AprovacoesService {
  static async getAprovacoesRh(params: GetAprovacoesRhParams) {
    const { page, itemsPerPage, tipo, empresaId, searchTerm, situacao, inicioCompetencia, fimCompetencia } = params;
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage - 1;

    let query = supabase
      .from('vw_aprovacoes_rh')
      .select('*', { count: 'exact' })
      .eq('situacao', situacao)
      .order('data_recebimento', { ascending: false });

    if (tipo && tipo !== 'all') {
      query = query.eq('tipo', tipo);
    }
    
    if (empresaId && empresaId !== 'all') {
      query = query.eq('empresa_id', empresaId);
    }

    if (inicioCompetencia && fimCompetencia) {
        query = query.gte('filter_data', inicioCompetencia).lte('filter_data', fimCompetencia);
    } else if (inicioCompetencia) {
        query = query.gte('filter_data', inicioCompetencia);
    }

    if (searchTerm) {
      query = query.or(`colaborador.ilike.%${searchTerm}%,referencia.ilike.%${searchTerm}%,empresa.ilike.%${searchTerm}%,operacao.ilike.%${searchTerm}%`);
    }

    const { data, count, error } = await query.range(start, end);

    if (error) {
      console.error("Error fetching aprovacoes rh:", error);
      throw error;
    }

    return { data, count };
  }

  static async getKpis(params: Omit<GetAprovacoesRhParams, 'page'|'itemsPerPage'|'situacao'>) {
    const { tipo, empresaId, inicioCompetencia, fimCompetencia } = params;
    
    // We can do a single group by query using postgrest RPC later, or for now, just fetch the exact counts.
    // However, AprovacoesRh needs dynamic KPIs.
    // Instead of launching 6 queries, we'll launch a group-by RPC, but we don't have it.
    // The easiest way for now is to use exact counting on the view for each KPI.
    const baseQuery = () => {
        let q = supabase.from('vw_aprovacoes_rh').select('*', { count: 'exact', head: true });
        if (empresaId && empresaId !== 'all') q = q.eq('empresa_id', empresaId);
        if (inicioCompetencia && fimCompetencia) q = q.gte('filter_data', inicioCompetencia).lte('filter_data', fimCompetencia);
        return q;
    }

    const [
        pontosReq,
        diaristasReq,
        intermitentesReq,
        custosReq,
        servicosReq,
        devolvidosReq,
        totaisValorReq // Para o total de valores, precisariamos do select('valor').
    ] = await Promise.all([
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'PONTO'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'DIARISTA'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'INTERMITENTE'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'CUSTO EXTRA'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'SERVIÇO EXTRA'),
        baseQuery().eq('situacao', 'Devolvido'),
        // para a soma de valores dos devolvidos e pendentes:
        baseQuery().select('valor').eq('situacao', 'Devolvido'), // this fetch values to sum
    ]);

    // O frontend só precisa da soma aproximada se quisermos, mas como pode haver muitos devolvidos,
    // fazer select('valor') é aceitável, mas idéal é RPC.
    
    return {
        pontos: pontosReq.count || 0,
        diaristas: diaristasReq.count || 0,
        intermitentes: intermitentesReq.count || 0,
        custos: custosReq.count || 0,
        servicos: servicosReq.count || 0,
        devolvidos: devolvidosReq.count || 0,
    };
  }
}
