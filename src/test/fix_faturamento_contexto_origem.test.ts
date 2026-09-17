import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isRouteMatchingItem } from '../components/layout/Sidebar';

// Função pura que replica exatamente a lógica implementada em ReceitasPipeline.tsx
function filterReceitas(
  receitas: any[],
  activeTab: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL',
  searchTerm: string,
  rawOrigemParam: string | null | undefined
) {
  // Normalização do parâmetro com fallback fail-safe para GLOBAL
  const origemParam = (rawOrigemParam === 'OPERACAO' || rawOrigemParam === 'SERVICO_EXTRA')
    ? rawOrigemParam
    : null;

  return receitas.filter((r: any) => {
    const matchSearch = !searchTerm || String(r.empresas?.nome || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchModalidade = r.modalidade === activeTab;
    if (!matchSearch || !matchModalidade) return false;

    // Filtro contextual de origem derivado dos itens da receita
    if (origemParam === 'OPERACAO') {
      return (r.receitas_operacionais_itens || []).some(
        (it: any) => it.operacao_id != null || it.operacoes_producao != null
      );
    }
    if (origemParam === 'SERVICO_EXTRA') {
      return (r.receitas_operacionais_itens || []).some(
        (it: any) => it.servico_extra_id != null || it.servicos_extras_operacionais != null
      );
    }

    return true; // GLOBAL
  });
}

describe('FIX — CONTEXTO DE ORIGEM NO FATURAMENTO', () => {
  // Mock dos dados reais auditados no banco
  const receitaSomenteOperacao = {
    id: 'f105f927-f165-40e5-97af-c3fa9e0d0f04',
    empresas: { nome: 'BENEVIDES' },
    modalidade: 'FATURAMENTO_MENSAL',
    status: 'conciliado',
    valor_total: 415.62,
    receitas_operacionais_itens: [
      { id: 'item-op-1', valor_item: 124.02, operacao_id: '5753a880-op1', servico_extra_id: null },
      { id: 'item-op-2', valor_item: 291.60, operacao_id: '0f0e30c5-op2', servico_extra_id: null }
    ]
  };

  const receitaSomenteServicoExtra = {
    id: 'bba7eec9-f288-462f-bb70-982a30d4ea39',
    empresas: { nome: 'BENEVIDES' },
    modalidade: 'FATURAMENTO_MENSAL',
    status: 'conciliado',
    valor_total: 60.00,
    receitas_operacionais_itens: [
      { id: 'item-se-1', valor_item: 60.00, operacao_id: null, servico_extra_id: '776a3c16-se1' }
    ]
  };

  const receitaMista = {
    id: 'mista-1111-2222-3333-444444444444',
    empresas: { nome: 'BENEVIDES' },
    modalidade: 'FATURAMENTO_MENSAL',
    status: 'aguardando_fechamento',
    valor_total: 200.00,
    receitas_operacionais_itens: [
      { id: 'item-misto-op', valor_item: 150.00, operacao_id: 'op-mista-1', servico_extra_id: null },
      { id: 'item-misto-se', valor_item: 50.00, operacao_id: null, servico_extra_id: 'se-misto-1' }
    ]
  };

  const mockReceitas = [receitaSomenteOperacao, receitaSomenteServicoExtra, receitaMista];

  describe('1. Cenários Obrigatórios de Filtragem Contextual', () => {
    it('Cenário A: Receita somente OPERACAO aparece em OPERACAO, não aparece em SERVICO_EXTRA e aparece no GLOBAL', () => {
      // Contexto OPERACAO
      const emOperacao = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'OPERACAO');
      expect(emOperacao.some(r => r.id === receitaSomenteOperacao.id)).toBe(true);

      // Contexto SERVICO_EXTRA
      const emServicoExtra = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'SERVICO_EXTRA');
      expect(emServicoExtra.some(r => r.id === receitaSomenteOperacao.id)).toBe(false);

      // Visão GLOBAL
      const emGlobal = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', null);
      expect(emGlobal.some(r => r.id === receitaSomenteOperacao.id)).toBe(true);
    });

    it('Cenário B: Receita somente SERVICO_EXTRA aparece em SERVICO_EXTRA, não aparece em OPERACAO e aparece no GLOBAL', () => {
      // Contexto SERVICO_EXTRA
      const emServicoExtra = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'SERVICO_EXTRA');
      expect(emServicoExtra.some(r => r.id === receitaSomenteServicoExtra.id)).toBe(true);

      // Contexto OPERACAO
      const emOperacao = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'OPERACAO');
      expect(emOperacao.some(r => r.id === receitaSomenteServicoExtra.id)).toBe(false);

      // Visão GLOBAL
      const emGlobal = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', null);
      expect(emGlobal.some(r => r.id === receitaSomenteServicoExtra.id)).toBe(true);
    });

    it('Cenário C: Receita MISTA aparece em OPERACAO, em SERVICO_EXTRA e aparece uma única vez no GLOBAL', () => {
      // Contexto OPERACAO
      const emOperacao = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'OPERACAO');
      expect(emOperacao.some(r => r.id === receitaMista.id)).toBe(true);

      // Contexto SERVICO_EXTRA
      const emServicoExtra = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'SERVICO_EXTRA');
      expect(emServicoExtra.some(r => r.id === receitaMista.id)).toBe(true);

      // Visão GLOBAL (aparece exatamente 1 vez)
      const emGlobal = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', null);
      const mistaMatches = emGlobal.filter(r => r.id === receitaMista.id);
      expect(mistaMatches.length).toBe(1);
    });

    it('Cenário D: Origem inválida/desconhecida faz fallback para a visão GLOBAL', () => {
      const comOrigemInvalida = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', 'ORIGEM_DESCONHECIDA');
      const comGlobal = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', null);

      expect(comOrigemInvalida.length).toBe(3);
      expect(comOrigemInvalida.map(r => r.id)).toEqual(comGlobal.map(r => r.id));
    });

    it('Cenário E: Ausência de origem preserva comportamento global atual', () => {
      const semOrigem = filterReceitas(mockReceitas, 'FATURAMENTO_MENSAL', '', undefined);
      expect(semOrigem.length).toBe(3);
    });

    it('Cenário F: Modalidade continua sendo respeitada simultaneamente com o filtro de origem', () => {
      // Se a modalidade for DUPLICATA, receitas de FATURAMENTO_MENSAL não devem aparecer
      const emDuplicata = filterReceitas(mockReceitas, 'DUPLICATA', '', 'OPERACAO');
      expect(emDuplicata.length).toBe(0);
    });
  });

  describe('2. Auditoria dos Menus e Roteamento (Sidebar.tsx)', () => {
    const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

    it('Operações por Volume -> Faturamento deve apontar para /financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=OPERACAO', () => {
      expect(sidebarContent).toContain('to: "/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=OPERACAO"');
    });

    it('Serviços Extras -> Faturamento deve apontar para /financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA', () => {
      expect(sidebarContent).toContain('to: "/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA"');
    });

    it('Financeiro -> Receitas deve permanecer sem origem (visão global)', () => {
      expect(sidebarContent).toContain('{ icon: Receipt, label: "Receitas", to: "/financeiro/receitas"');
    });

    it('Financeiro -> Contas a Receber deve permanecer sem origem (visão global)', () => {
      expect(sidebarContent).toContain('{ icon: Receipt, label: "Contas a Receber", to: "/financeiro/receitas"');
    });

    it('Financeiro -> Lotes continua utilizando /financeiro/faturamento (preservado)', () => {
      expect(sidebarContent).toContain('{ icon: FileText, label: "Lotes", to: "/financeiro/faturamento"');
    });
  });

  describe('3. Auditoria do Componente ReceitasPipeline.tsx', () => {
    const pipelinePath = path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx');
    const pipelineContent = fs.readFileSync(pipelinePath, 'utf-8');

    it('ReceitasPipeline.tsx deve ler o query param origem com fallback para GLOBAL', () => {
      expect(pipelineContent).toContain("const raw = searchParams.get('origem')");
      expect(pipelineContent).toContain("raw === 'OPERACAO' || raw === 'SERVICO_EXTRA'");
    });

    it('ReceitasPipeline.tsx deve filtrar por operacao_id e servico_extra_id nos itens', () => {
      expect(pipelineContent).toContain("origemParam === 'OPERACAO'");
      expect(pipelineContent).toContain("it.operacao_id != null");
      expect(pipelineContent).toContain("origemParam === 'SERVICO_EXTRA'");
      expect(pipelineContent).toContain("it.servico_extra_id != null");
    });

    it('ReceitasPipeline.tsx deve exibir indicação visual de contexto quando houver origem', () => {
      expect(pipelineContent).toContain('pageBadge = origemParam === \'OPERACAO\'');
      expect(pipelineContent).toContain('pageSubtitle = origemParam === \'OPERACAO\'');
      expect(pipelineContent).toContain('Visão contextualizada: exibindo receitas originadas de');
    });
  });

  describe('4. Validação Contextual de isActive no Sidebar (isRouteMatchingItem)', () => {

    const itemOpFaturamento = {
      icon: () => null,
      label: 'Faturamento',
      to: '/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=OPERACAO'
    };

    const itemSeFaturamento = {
      icon: () => null,
      label: 'Faturamento',
      to: '/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA'
    };

    const itemFinReceitas = {
      icon: () => null,
      label: 'Receitas',
      to: '/financeiro/receitas'
    };

    const itemFinContasReceber = {
      icon: () => null,
      label: 'Contas a Receber',
      to: '/financeiro/receitas'
    };

    it('Cenário A: /financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=OPERACAO -> somente Operações -> Faturamento ativo', () => {
      const loc = {
        pathname: '/financeiro/receitas',
        search: '?tab=FATURAMENTO_MENSAL&origem=OPERACAO'
      };

      expect(isRouteMatchingItem(itemOpFaturamento, loc)).toBe(true);
      expect(isRouteMatchingItem(itemSeFaturamento, loc)).toBe(false);
      expect(isRouteMatchingItem(itemFinReceitas, loc)).toBe(false);
      expect(isRouteMatchingItem(itemFinContasReceber, loc)).toBe(false);
    });

    it('Cenário B: /financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA -> somente Serviços Extras -> Faturamento ativo', () => {
      const loc = {
        pathname: '/financeiro/receitas',
        search: '?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA'
      };

      expect(isRouteMatchingItem(itemOpFaturamento, loc)).toBe(false);
      expect(isRouteMatchingItem(itemSeFaturamento, loc)).toBe(true);
      expect(isRouteMatchingItem(itemFinReceitas, loc)).toBe(false);
      expect(isRouteMatchingItem(itemFinContasReceber, loc)).toBe(false);
    });

    it('Cenário C: /financeiro/receitas (visão global sem origem) -> nenhum Faturamento contextual ativo; somente Receitas ativo', () => {
      const loc = {
        pathname: '/financeiro/receitas',
        search: ''
      };

      expect(isRouteMatchingItem(itemOpFaturamento, loc)).toBe(false);
      expect(isRouteMatchingItem(itemSeFaturamento, loc)).toBe(false);
      expect(isRouteMatchingItem(itemFinReceitas, loc)).toBe(true);
      expect(isRouteMatchingItem(itemFinContasReceber, loc)).toBe(false);
    });

    it('Cenário D: Trocar entre Caixa Imediato, Duplicata e Faturamento Mensal preserva o destaque contextual enquanto origem=OPERACAO permanecer', () => {
      const locCaixa = {
        pathname: '/financeiro/receitas',
        search: '?tab=CAIXA_IMEDIATO&origem=OPERACAO'
      };
      const locDuplicata = {
        pathname: '/financeiro/receitas',
        search: '?tab=DUPLICATA&origem=OPERACAO'
      };
      const locMensal = {
        pathname: '/financeiro/receitas',
        search: '?tab=FATURAMENTO_MENSAL&origem=OPERACAO'
      };

      // Em todas as abas, Operações -> Faturamento deve permanecer ativo
      expect(isRouteMatchingItem(itemOpFaturamento, locCaixa)).toBe(true);
      expect(isRouteMatchingItem(itemOpFaturamento, locDuplicata)).toBe(true);
      expect(isRouteMatchingItem(itemOpFaturamento, locMensal)).toBe(true);

      // E nenhum outro item deve ficar ativo
      expect(isRouteMatchingItem(itemSeFaturamento, locCaixa)).toBe(false);
      expect(isRouteMatchingItem(itemFinReceitas, locCaixa)).toBe(false);
      expect(isRouteMatchingItem(itemFinContasReceber, locCaixa)).toBe(false);
    });

    it('Cenário D (SE): Trocar de abas preserva Serviços Extras -> Faturamento enquanto origem=SERVICO_EXTRA permanecer', () => {
      const locCaixa = {
        pathname: '/financeiro/receitas',
        search: '?tab=CAIXA_IMEDIATO&origem=SERVICO_EXTRA'
      };
      const locDuplicata = {
        pathname: '/financeiro/receitas',
        search: '?tab=DUPLICATA&origem=SERVICO_EXTRA'
      };

      expect(isRouteMatchingItem(itemSeFaturamento, locCaixa)).toBe(true);
      expect(isRouteMatchingItem(itemSeFaturamento, locDuplicata)).toBe(true);
      expect(isRouteMatchingItem(itemOpFaturamento, locCaixa)).toBe(false);
      expect(isRouteMatchingItem(itemFinReceitas, locCaixa)).toBe(false);
    });

    it('Cenário Ações gerais: ?action=nova-operacao destaca somente o item de Nova Operação e não a lista normal', () => {
      const itemNovaOp = {
        icon: () => null,
        label: 'Nova Operação',
        to: '/operacoes-volume?action=nova-operacao'
      };
      const itemListaOp = {
        icon: () => null,
        label: 'Operações / Recebidos',
        to: '/operacoes-volume'
      };

      const locNovaOp = {
        pathname: '/operacoes-volume',
        search: '?action=nova-operacao'
      };
      const locListaOp = {
        pathname: '/operacoes-volume',
        search: ''
      };

      // Quando action=nova-operacao: apenas Nova Operação
      expect(isRouteMatchingItem(itemNovaOp, locNovaOp)).toBe(true);
      expect(isRouteMatchingItem(itemListaOp, locNovaOp)).toBe(false);

      // Quando sem action: apenas Lista normal
      expect(isRouteMatchingItem(itemNovaOp, locListaOp)).toBe(false);
      expect(isRouteMatchingItem(itemListaOp, locListaOp)).toBe(true);
    });
  });
});
