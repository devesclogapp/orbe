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

    const env = typeof window !== 'undefined' ? localStorage.getItem('esc-log-environment') : null;
    const isHomologacao = env === 'HOMOLOGACAO' || env === 'homologacao';
    
    // DECISÃO ARQUITETURAL (CHECKPOINT 06):
    // A separação de ambientes é ESTRITA e BIDIRECIONAL por design.
    // - Produção: Exibe EXCLUSIVAMENTE dados operacionais reais (is_teste = false ou is_teste is null).
    // - Homologação: Exibe EXCLUSIVAMENTE dados gerados no sandbox (is_teste = true).
    // Isso evita contaminação de métricas e garante que cenários de teste não inflem o faturamento real.
    
    // Instead of fetching all valid IDs (which drops nulls and RLS-hidden genuine records),
    // we fetch ONLY explicitly marked test companies and perform an exclusion.
    let queryBuilder = supabase.from('empresas').select('id');
    if (!isHomologacao) {
      queryBuilder = queryBuilder.eq('is_teste', true);
    } else {
      // In homologation, we exclusively WANT test companies. We keep the validIds logic.
      queryBuilder = queryBuilder.eq('is_teste', true);
    }
    const { data: testEmpresas } = await queryBuilder;
    const testIds = testEmpresas?.map(e => e.id) || [];

    let query = supabase
      .from('vw_aprovacoes_rh')
      .select('*', { count: 'exact' })
      .eq('situacao', situacao)
      .order('data_recebimento', { ascending: false });

    // Conditional Application
    if (isHomologacao) {
        if (testIds.length > 0) {
           query = query.in('empresa_id', testIds);
        } else {
           // No test companies found, return an impossible condition to return 0
           query = query.in('empresa_id', ['00000000-0000-0000-0000-000000000000']);
        }
    } else if (testIds.length > 0) {
        // Prod: Filter out test companies but KEEP nulls and legitimate ids.
        query = query.or(`empresa_id.not.in.(${testIds.join(',')}),empresa_id.is.null`);
    }

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
    
    // Evaluate current environment to exclude non-matching companies
    const env = typeof window !== 'undefined' ? localStorage.getItem('esc-log-environment') : null;
    const isHomologacao = env === 'HOMOLOGACAO' || env === 'homologacao';
    
    // DECISÃO ARQUITETURAL (CHECKPOINT 06):
    // A separação de ambientes deve ser bidirecional para evitar KPIs enganosos.
    // Produção nunca reflete resultados com is_teste=true, e Homologação ignora dados reais.
    
    let queryBuilder = supabase.from('empresas').select('id');
    if (!isHomologacao) {
      queryBuilder = queryBuilder.eq('is_teste', true);
    } else {
      queryBuilder = queryBuilder.eq('is_teste', true);
    }
    const { data: testEmpresas } = await queryBuilder;
    const testIds = testEmpresas?.map(e => e.id) || [];
    
    // We can do a single group by query using postgrest RPC later, or for now, just fetch the exact counts.
    // However, AprovacoesRh needs dynamic KPIs.
    // Instead of launching 6 queries, we'll launch a group-by RPC, but we don't have it.
    // The easiest way for now is to use exact counting on the view for each KPI.
    const baseQuery = () => {
        let q = supabase.from('vw_aprovacoes_rh').select('*', { count: 'exact', head: true });
        
        if (isHomologacao) {
            if (testIds.length > 0) q = q.in('empresa_id', testIds);
            else q = q.in('empresa_id', ['00000000-0000-0000-0000-000000000000']);
        } else if (testIds.length > 0) {
            q = q.or(`empresa_id.not.in.(${testIds.join(',')}),empresa_id.is.null`);
        }

        if (empresaId && empresaId !== 'all') q = q.eq('empresa_id', empresaId);
        if (inicioCompetencia && fimCompetencia) q = q.gte('filter_data', inicioCompetencia).lte('filter_data', fimCompetencia);
        return q;
    }

    const baseQueryWithTipo = () => {
        let q = baseQuery();
        if (tipo && tipo !== 'all') q = q.eq('tipo', tipo);
        return q;
    }

    const [
        pontosReq,
        diaristasReq,
        intermitentesReq,
        custosReq,
        servicosReq,
        devolvidosReq,
        totaisValorReq,
        filaTotalReq,
        aprovadosTotalReq,
        devolvidosTabTotalReq
    ] = await Promise.all([
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'PONTO'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'DIARISTA'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'INTERMITENTE'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'CUSTO EXTRA'),
        baseQuery().eq('situacao', 'Em análise').eq('tipo', 'SERVIÇO EXTRA'),
        baseQuery().eq('situacao', 'Devolvido'),
        baseQuery().select('valor').eq('situacao', 'Devolvido'),
        baseQueryWithTipo().eq('situacao', 'Em análise'),
        baseQueryWithTipo().eq('situacao', 'Aprovado'),
        baseQueryWithTipo().eq('situacao', 'Devolvido'),
    ]);
    
    return {
        pontos: pontosReq.count || 0,
        diaristas: diaristasReq.count || 0,
        intermitentes: intermitentesReq.count || 0,
        custos: custosReq.count || 0,
        servicos: servicosReq.count || 0,
        devolvidos: devolvidosReq.count || 0,
        filaTotal: filaTotalReq.count || 0,
        aprovadosTotal: aprovadosTotalReq.count || 0,
        devolvidosTabTotal: devolvidosTabTotalReq.count || 0,
    };
  }
}
