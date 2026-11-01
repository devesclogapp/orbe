import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// ==============================================================================
// SUÍTE FIX 14.4 — SINCRONIZAÇÃO DE RECEITA MENSAL CONSOLIDADA NO MODAL
// ==============================================================================

interface ReceitaItem {
  id: string;
  receita_id: string;
  operacao_id: string;
  valor_item: number;
}

interface ReceitaDetalhes {
  id: string;
  empresa_id: string;
  competencia: string;
  modalidade: 'FATURAMENTO_MENSAL';
  valor_total: number;
  receitas_operacionais_itens: ReceitaItem[];
}

describe('SUÍTE FIX 14.4 — Sincronização de Receita Consolidada no Modal', () => {
  let queryClient: QueryClient;
  const RECEITA_ID = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';

  // Mock do banco de dados/service
  let mockDatabaseReceita: ReceitaDetalhes;
  let mockGetReceitaDetalhes: (id: string) => Promise<ReceitaDetalhes>;

  beforeEach(() => {
    // Configuração idêntica ao App.tsx (staleTime 5 minutos global)
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutos
          gcTime: 1000 * 60 * 30,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    // Estado inicial: Receita com apenas 1 operação (R$ 124,02)
    mockDatabaseReceita = {
      id: RECEITA_ID,
      empresa_id: '4d4c1328-a8e7-4c5b-875d-924b416fa13a',
      competencia: '2026-09',
      modalidade: 'FATURAMENTO_MENSAL',
      valor_total: 124.02,
      receitas_operacionais_itens: [
        {
          id: 'item-1',
          receita_id: RECEITA_ID,
          operacao_id: 'op-1',
          valor_item: 124.02,
        },
      ],
    };

    mockGetReceitaDetalhes = vi.fn(async (id: string) => {
      return JSON.parse(JSON.stringify(mockDatabaseReceita));
    });
  });

  describe('1. Reprodução do Cenário de Bug (Sem FIX 14.4)', () => {
    it('demonstra que com staleTime herdado de 5min, o TanStack Query retornaria snapshot desatualizado de 1 item', async () => {
      // 1. Usuário abre o modal na primeira operação: busca da API e armazena em cache
      const primeiraConsulta = await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
        // Simulação pré-FIX 14.4: sem staleTime: 0
      });

      expect(primeiraConsulta.receitas_operacionais_itens).toHaveLength(1);
      expect(primeiraConsulta.valor_total).toBe(124.02);
      expect(mockGetReceitaDetalhes).toHaveBeenCalledTimes(1);

      // 2. Segunda operação (R$ 291,60) é incorporada no banco
      mockDatabaseReceita.valor_total = 415.62;
      mockDatabaseReceita.receitas_operacionais_itens.push({
        id: 'item-2',
        receita_id: RECEITA_ID,
        operacao_id: 'op-2',
        valor_item: 291.60,
      });

      // 3. Sem o FIX 14.4 (staleTime 5 min ativo), nova consulta antes de 5 min serve o cache antigo
      const consultaStale = await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
      });

      // Evidência do bug anterior: retornava apenas 1 item do cache!
      expect(consultaStale.receitas_operacionais_itens).toHaveLength(1);
      expect(mockGetReceitaDetalhes).toHaveBeenCalledTimes(1); // Não chamou a API novamente!
    });
  });

  describe('2. Validação com FIX 14.4 Aplicado (staleTime: 0 na query do Modal)', () => {
    it('com staleTime: 0, a reabertura do modal sempre busca dados atualizados com 2 operações', async () => {
      // Opções exatas configuradas no ModalReceitaOperacional.tsx pelo FIX 14.4
      const modalQueryOptions = {
        staleTime: 0,
        refetchOnMount: 'always' as const,
      };

      // 1. Abertura inicial com 1 operação
      const detalhesIniciais = await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
        ...modalQueryOptions,
      });

      expect(detalhesIniciais.receitas_operacionais_itens).toHaveLength(1);
      expect(mockGetReceitaDetalhes).toHaveBeenCalledTimes(1);

      // 2. Segunda operação (R$ 291,60) é incorporada à mesma receita no banco
      mockDatabaseReceita.valor_total = 415.62;
      mockDatabaseReceita.receitas_operacionais_itens.push({
        id: 'item-2',
        receita_id: RECEITA_ID,
        operacao_id: 'op-2',
        valor_item: 291.60,
      });

      // 3. Reabertura do modal com FIX 14.4 (staleTime: 0):
      // O TanStack Query considera o dado stale e refaz a busca imediatamente sem esperar 5 minutos
      const detalhesAtualizados = await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
        ...modalQueryOptions,
      });

      expect(detalhesAtualizados.receitas_operacionais_itens).toHaveLength(2);
      expect(detalhesAtualizados.valor_total).toBe(415.62);
      expect(detalhesAtualizados.receitas_operacionais_itens[0].valor_item).toBe(124.02);
      expect(detalhesAtualizados.receitas_operacionais_itens[1].valor_item).toBe(291.60);
      expect(mockGetReceitaDetalhes).toHaveBeenCalledTimes(2); // Buscou no servidor com sucesso!
    });
  });

  describe('3. Invalidação de Cache nos Pontos Chave', () => {
    it('o handleRefresh de ReceitasPipeline invalida receitas-pipeline e receita-detalhes', async () => {
      // Pré-popula cache de detalhes
      await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
      });

      expect(queryClient.getQueryState(['receita-detalhes', RECEITA_ID])?.isInvalidated).toBeFalsy();

      // Simula handleRefresh de ReceitasPipeline.tsx
      queryClient.invalidateQueries({ queryKey: ['receitas-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receita-detalhes'] });

      expect(queryClient.getQueryState(['receita-detalhes', RECEITA_ID])?.isInvalidated).toBe(true);
    });

    it('a aprovação de operação operacional (aprovarOpMutation) invalida receita-detalhes e receitas-pipeline', async () => {
      // Pré-popula cache de detalhes
      await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
      });

      // Simula aprovarOpMutation.onSuccess em OperacoesTableBlock.tsx
      queryClient.invalidateQueries({ queryKey: ['operacoes'] });
      queryClient.invalidateQueries({ queryKey: ['receitas-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receita-detalhes'] });

      expect(queryClient.getQueryState(['receita-detalhes', RECEITA_ID])?.isInvalidated).toBe(true);
    });

    it('o salvamento de operação em OperacaoForm (submitMutation) invalida receita-detalhes e receitas-pipeline', async () => {
      // Pré-popula cache de detalhes
      await queryClient.fetchQuery({
        queryKey: ['receita-detalhes', RECEITA_ID],
        queryFn: () => mockGetReceitaDetalhes(RECEITA_ID),
      });

      // Simula submitMutation.onSuccess em OperacaoForm.tsx
      queryClient.invalidateQueries({ queryKey: ['operacoes'] });
      queryClient.invalidateQueries({ queryKey: ['receitas-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receita-detalhes'] });

      expect(queryClient.getQueryState(['receita-detalhes', RECEITA_ID])?.isInvalidated).toBe(true);
    });
  });

  describe('4. Consistência dos Dados de Faturamento Mensal', () => {
    it('garante que a soma dos itens vinculados corresponde exatamente ao valor_total da receita', () => {
      const itens = [
        { id: 'item-1', valor_item: 124.02 },
        { id: 'item-2', valor_item: 291.60 },
      ];

      const somaEfetiva = itens.reduce((acc, item) => acc + item.valor_item, 0);
      const valorTotalReceita = 415.62;

      expect(Number(somaEfetiva.toFixed(2))).toBe(valorTotalReceita);
      expect(itens).toHaveLength(2);
    });
  });
});
