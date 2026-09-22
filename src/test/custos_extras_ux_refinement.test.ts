import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildCustosExtrasPipeline } from '@/contexts/OperationalPipelineContext';
import { isRouteMatchingItem } from '@/components/layout/Sidebar';

describe('ORBE — Refinamento UX do Fluxo de Custos Extras', () => {
  describe('1. Portal Encarregado — Storytelling pós-lançamento', () => {
    it('CustosExtrasLancamento.tsx deve informar que o lançamento foi recebido e aguarda validação', () => {
      const filePath = path.resolve(__dirname, '../pages/Producao/CustosExtrasLancamento.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('O lançamento foi recebido e aguarda validação. A etapa operacional do encarregado foi concluída.');
    });

    it('CustosExtrasForm.tsx deve informar que o lançamento foi recebido e aguarda validação', () => {
      const filePath = path.resolve(__dirname, '../components/forms/CustosExtrasForm.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('O lançamento foi recebido e aguarda validação. A etapa operacional do encarregado foi concluída.');
    });
  });

  describe('2. Modal Status do Custo Extra & Role-Aware NextAction', () => {
    it('RECEBIDO deve oferecer atalho para Lançamentos', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'EMPRESA TESTE',
        pipelineStatus: 'RECEBIDO',
        statusPagamento: 'A_PAGAR',
      });

      expect(pipeline.steps[0].label).toBe('Recebido');
      expect(pipeline.steps[0].status).toBe('current');
      expect(pipeline.nextAction).toBeDefined();
      expect(pipeline.nextAction?.route).toBe('/custos-extras/lancamentos');
      expect(pipeline.nextAction?.label).toContain('Lançamentos');
    });

    it('EM_VALIDACAO para Gestor/RH/Admin deve sugerir Continuar para Aprovações', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'EMPRESA TESTE',
        pipelineStatus: 'EM_VALIDACAO',
        statusPagamento: 'A_PAGAR',
        userRole: 'gestor',
        isAdmin: false,
      });

      expect(pipeline.steps[1].status).toBe('current');
      expect(pipeline.nextAction).toBeDefined();
      expect(pipeline.nextAction?.route).toBe('/custos-extras/aprovacoes');
      expect(pipeline.nextAction?.label).toContain('Aprovações');
    });

    it('EM_VALIDACAO para Encarregado NÃO deve exibir atalho de aprovação', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'EMPRESA TESTE',
        pipelineStatus: 'EM_VALIDACAO',
        statusPagamento: 'A_PAGAR',
        userRole: 'encarregado',
        isAdmin: false,
      });

      expect(pipeline.steps[1].status).toBe('current');
      expect(pipeline.nextAction).toBeUndefined();
    });

    it('APROVADO_OPERACAO deve sugerir Continuar para Pagamentos com origem=CUSTOS_EXTRAS', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'EMPRESA TESTE',
        pipelineStatus: 'APROVADO_OPERACAO',
        statusPagamento: 'A_PAGAR',
        userRole: 'gestor',
        isAdmin: false,
      });

      expect(pipeline.steps[2].status).toBe('current');
      expect(pipeline.nextAction).toBeDefined();
      expect(pipeline.nextAction?.route).toBe('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
      expect(pipeline.nextAction?.label).toContain('Pagamentos');
    });

    it('ENVIADO_FINANCEIRO para Financeiro deve sugerir Continuar para Pagamentos', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'EMPRESA TESTE',
        pipelineStatus: 'ENVIADO_FINANCEIRO',
        statusPagamento: 'A_PAGAR',
        userRole: 'financeiro',
        isAdmin: false,
      });

      expect(pipeline.steps[3].status).toBe('current');
      expect(pipeline.nextAction).toBeDefined();
      expect(pipeline.nextAction?.route).toBe('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
    });

    it('FINALIZADO + PAGO deve encerrar o fluxo (isDone = true e nextAction = undefined)', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'EMPRESA TESTE',
        pipelineStatus: 'FINALIZADO',
        statusPagamento: 'PAGO',
        userRole: 'financeiro',
        isAdmin: true,
      });

      expect(pipeline.steps[4].status).toBe('done');
      expect(pipeline.nextAction).toBeUndefined();
    });
  });

  describe('3. Aprovações — Storytelling e CTA em AprovacoesRh.tsx', () => {
    it('deve utilizar a terminologia "Despesa aprovada operacionalmente" e conter CTA para Pagamentos', () => {
      const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('Despesa aprovada operacionalmente');
      expect(content).toContain('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
      expect(content).toContain('Continuar para Pagamentos');
    });
  });

  describe('4. Sidebar — Navegação Contextual e Ativação Exata', () => {
    it('o item Pagamentos / Contas a Pagar em Custos Extras deve conter origem=CUSTOS_EXTRAS', () => {
      const filePath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
    });

    it('isRouteMatchingItem deve ativar Pagamentos sob Custos Extras apenas quando origem=CUSTOS_EXTRAS', () => {
      const itemCustosExtras = {
        icon: () => null as any,
        label: 'Pagamentos / Contas a Pagar',
        to: '/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS',
      };

      const itemCentralFinanceira = {
        icon: () => null as any,
        label: 'Central Financeira',
        to: '/financeiro',
        end: true,
      };

      // 1. URL com origem=CUSTOS_EXTRAS
      const locContextual = {
        pathname: '/financeiro',
        search: '?tab=custos-extras&origem=CUSTOS_EXTRAS',
      };
      expect(isRouteMatchingItem(itemCustosExtras, locContextual)).toBe(true);
      expect(isRouteMatchingItem(itemCentralFinanceira, locContextual)).toBe(false);

      // 2. URL global /financeiro sem origem
      const locGlobal = {
        pathname: '/financeiro',
        search: '',
      };
      expect(isRouteMatchingItem(itemCustosExtras, locGlobal)).toBe(false);
      expect(isRouteMatchingItem(itemCentralFinanceira, locGlobal)).toBe(true);
    });
  });

  describe('5. CentralFinanceira — Apresentação Contextual e Preservação Global', () => {
    it('deve conter visual contextual para origem=CUSTOS_EXTRAS com título Pagamentos — Custos Extras', () => {
      const filePath = path.resolve(__dirname, '../pages/CentralFinanceira.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('isCustosExtrasContext');
      expect(content).toContain('Pagamentos — Custos Extras');
      expect(content).toContain('Ver Central Financeira Global');
      expect(content).toContain('Aguardando liberação para pagamento');
      expect(content).toContain('A pagar');
    });

    it('no modo contextual origem=CUSTOS_EXTRAS NÃO deve exibir botão de Bancário (CNAB)', () => {
      const filePath = path.resolve(__dirname, '../pages/CentralFinanceira.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      const contextualBlockIndex = content.indexOf('isCustosExtrasContext ? (');
      const elseBlockIndex = content.indexOf(') : (', contextualBlockIndex);
      const contextualActions = content.substring(contextualBlockIndex, elseBlockIndex);

      expect(contextualActions).toContain('Ver Central Financeira Global');
      expect(contextualActions).not.toContain('Bancário (CNAB)');
    });

    it('MetricCard.tsx deve traduzir "vs. last month" para "em relação ao mês anterior" e suportar neutralidade visual', () => {
      const filePath = path.resolve(__dirname, '../components/painel/MetricCard.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('em relação ao mês anterior');
      expect(content).not.toContain('vs. last month');
      expect(content).toContain('delta.neutral');
    });

    it('CustosExtrasTableBlock.tsx deve mapear visualmente os estados e CTAs refinados', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('getDisplayPipelineStatus');
      expect(content).toContain('Aguardando liberação para pagamento');
      expect(content).toContain('Liberar para pagamento');
      expect(content).toContain('A pagar');
      expect(content).toContain('Registrar Pagamento');
      expect(content).toContain('Devolver para Operação');
      expect(content).toContain('Pago');
      expect(content).toContain('contextualOrigem');
    });
  });
});
