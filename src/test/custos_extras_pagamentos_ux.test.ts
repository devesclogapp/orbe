import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('REFINAMENTO UX — Tela de Destino "Pagamentos — Custos Extras"', () => {
  const centralFinanceiraPath = path.resolve(__dirname, '../pages/CentralFinanceira.tsx');
  const centralFinanceiraContent = fs.readFileSync(centralFinanceiraPath, 'utf-8');

  const tableBlockPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
  const tableBlockContent = fs.readFileSync(tableBlockPath, 'utf-8');

  describe('1. KPIs como Navegação de Processo (Sincronização Cards ↔ Filtros)', () => {
    it('CentralFinanceira deve manter estado custosPipelineFilter inicializado em "todos"', () => {
      expect(centralFinanceiraContent).toContain('const [custosPipelineFilter, setCustosPipelineFilter] = useState<string>("todos");');
    });

    it('Card "Total Despesas Extras" deve selecionar o filtro "todos"', () => {
      expect(centralFinanceiraContent).toContain('label="Total Despesas Extras"');
      expect(centralFinanceiraContent).toContain('onClick={() => setCustosPipelineFilter("todos")}');
      expect(centralFinanceiraContent).toContain('custosPipelineFilter === "todos"');
    });

    it('Card "Aguardando liberação para pagamento" deve selecionar o filtro "aguardando_liberacao"', () => {
      expect(centralFinanceiraContent).toContain('label="Aguardando liberação para pagamento"');
      expect(centralFinanceiraContent).toContain('onClick={() => setCustosPipelineFilter("aguardando_liberacao")}');
      expect(centralFinanceiraContent).toContain('custosPipelineFilter === "aguardando_liberacao"');
    });

    it('Card "A pagar" deve selecionar o filtro "a_pagar"', () => {
      expect(centralFinanceiraContent).toContain('label="A pagar"');
      expect(centralFinanceiraContent).toContain('onClick={() => setCustosPipelineFilter("a_pagar")}');
      expect(centralFinanceiraContent).toContain('custosPipelineFilter === "a_pagar"');
    });

    it('Card "Pago" deve selecionar o filtro "pagos"', () => {
      expect(centralFinanceiraContent).toContain('label="Pago"');
      expect(centralFinanceiraContent).toContain('onClick={() => setCustosPipelineFilter("pagos")}');
      expect(centralFinanceiraContent).toContain('custosPipelineFilter === "pagos"');
    });

    it('CentralFinanceira deve passar controlledPipelineFilter e onPipelineFilterChange para CustosExtrasTableBlock', () => {
      expect(centralFinanceiraContent).toContain('controlledPipelineFilter={custosPipelineFilter}');
      expect(centralFinanceiraContent).toContain('onPipelineFilterChange={setCustosPipelineFilter}');
    });

    it('CustosExtrasTableBlock deve suportar controlledPipelineFilter e propagar alterações via onPipelineFilterChange', () => {
      expect(tableBlockContent).toContain('controlledPipelineFilter?: string;');
      expect(tableBlockContent).toContain('onPipelineFilterChange?: (filter: string) => void;');
      expect(tableBlockContent).toContain('controlledPipelineFilter !== undefined ? controlledPipelineFilter : internalPipelineFilter');
      expect(tableBlockContent).toContain('onPipelineFilterChange?.(newFilter);');
    });
  });

  describe('2. Comunicação de Pendência e Affordance Discreta nos Cards', () => {
    it('Card "Aguardando liberação" deve comunicar que requer ação apenas quando quantidade > 0', () => {
      expect(centralFinanceiraContent).toContain('custosExtrasTotals.aguardandoLiberacaoQtd > 0 ?');
      expect(centralFinanceiraContent).toContain('requer');
      expect(centralFinanceiraContent).toContain('ação');
      expect(centralFinanceiraContent).toContain('0 despesas pendentes');
    });

    it('Card "A pagar" deve comunicar pendência apenas quando quantidade > 0', () => {
      expect(centralFinanceiraContent).toContain('custosExtrasTotals.aPagarQtd > 0 ?');
      expect(centralFinanceiraContent).toContain('pagamento');
      expect(centralFinanceiraContent).toContain('pendente');
      expect(centralFinanceiraContent).toContain('0 pagamentos pendentes');
    });

    it('Card "Pago" deve permanecer puramente histórico e informativo sem ação pendente', () => {
      expect(centralFinanceiraContent).toContain('sublabel={`${custosExtrasTotals.pagosQtd} liquidada(s)`}');
      // Não deve ter texto "requer ação" ou setas para o card pago
      const pagoBlock = centralFinanceiraContent.substring(
        centralFinanceiraContent.indexOf('label="Pago"'),
        centralFinanceiraContent.indexOf('label="Pago"') + 400
      );
      expect(pagoBlock).not.toContain('requer ação');
      expect(pagoBlock).not.toContain('ArrowRight');
    });

    it('Cards devem manter affordance discreta (cursor-pointer, hover e ring sutil)', () => {
      expect(centralFinanceiraContent).toContain('cursor-pointer transition-all duration-200');
      expect(centralFinanceiraContent).toContain('ring-2 ring-primary/30 border-primary/50');
      expect(centralFinanceiraContent).toContain('ring-2 ring-amber-500/35 border-amber-500/50');
      expect(centralFinanceiraContent).toContain('ring-2 ring-indigo-500/35 border-indigo-500/50');
      expect(centralFinanceiraContent).toContain('ring-2 ring-emerald-500/35 border-emerald-500/50');
    });
  });

  describe('3. Faixa de Orientação Contextual Discreta', () => {
    it('Faixa contextual deve ser renderizada somente quando existirem despesas aguardando liberação e o usuário NÃO estiver nesse filtro', () => {
      expect(centralFinanceiraContent).toContain(
        'custosExtrasTotals.aguardandoLiberacaoQtd > 0 && custosPipelineFilter !== "aguardando_liberacao"'
      );
    });

    it('Faixa contextual deve orientar a revisar e liberar para o Financeiro, sem abrir drawer', () => {
      expect(centralFinanceiraContent).toContain('aguarda sua liberação para pagamento.');
      expect(centralFinanceiraContent).toContain('Revise o lançamento aprovado e libere-o para o Financeiro.');
      expect(centralFinanceiraContent).toContain('onClick={() => setCustosPipelineFilter("aguardando_liberacao")}');
      // O botão apenas altera o filtro para aguardando_liberacao
      expect(centralFinanceiraContent).toContain('Ver despesa');
      expect(centralFinanceiraContent).toContain('pendente');
    });
  });

  describe('4. Governança e Isolamento de Escopo', () => {
    it('Comportamento contextual deve estar estritamente isolado a isCustosExtrasContext', () => {
      const isCustosContextPos = centralFinanceiraContent.indexOf('isCustosExtrasContext ?');
      expect(isCustosContextPos).toBeGreaterThan(-1);

      // A Central Financeira Global (ramo else) permanece intacta com seus MetricCards globais
      const globalCardsPos = centralFinanceiraContent.indexOf('label="Aguardando aprovação"');
      expect(globalCardsPos).toBeGreaterThan(isCustosContextPos);
      expect(centralFinanceiraContent).toContain('label="Prontos para CNAB"');
    });

    it('Nenhum drawer deve ser aberto automaticamente ao carregar a página de Pagamentos', () => {
      // Não deve ter chamada openPipeline dentro de useEffect que responda ao carregamento da página de Pagamentos
      expect(centralFinanceiraContent).not.toMatch(/useEffect\([^)]*openPipeline/);
    });
  });

  describe('5. Continuidade após Liberação para Pagamento', () => {
    const pipelineContextPath = path.resolve(__dirname, '../contexts/OperationalPipelineContext.tsx');
    const pipelineContextContent = fs.readFileSync(pipelineContextPath, 'utf-8');

    const continuityDrawerPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
    const continuityDrawerContent = fs.readFileSync(continuityDrawerPath, 'utf-8');

    it('Ao executar Liberar para pagamento com sucesso, CustosExtrasTableBlock deve alterar automaticamente o filtro para "a_pagar"', () => {
      expect(tableBlockContent).toContain("if (current === 'APROVADO_OPERACAO')");
      expect(tableBlockContent).toContain('setPipelineFilter("a_pagar");');
    });

    it('buildCustosExtrasPipeline e context devem receber e propagar registroId', () => {
      expect(tableBlockContent).toContain('registroId: currentItem.id');
      expect(pipelineContextContent).toContain('registroId?: string;');
      expect(pipelineContextContent).toContain('context: { competencia, empresa, fluxo: "Custos Extras", registroId }');
      expect(pipelineContextContent).toContain('actionPayload: { registroId },');
    });

    it('CustosExtrasContinuityDrawer: CTA "Registrar pagamento" deve despachar evento com registroId para continuidade imediata', () => {
      expect(continuityDrawerContent).toContain('actionPayload: { registroId: context?.registroId || rawNextAction?.actionPayload?.registroId }');
      expect(continuityDrawerContent).toContain('orbe:continuar-pagamento-custo-extra');
      expect(continuityDrawerContent).toContain('detail: { registroId }');
    });

    it('CustosExtrasTableBlock deve escutar o evento e abrir diretamente o drawer de detalhes do item correspondente', () => {
      expect(tableBlockContent).toContain('orbe:continuar-pagamento-custo-extra');
      expect(tableBlockContent).toContain('const item = data.find((d) => d.id === targetId);');
      expect(tableBlockContent).toContain('setSelectedItem(item);');
    });
  });
});

