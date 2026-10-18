import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CONTEXTUAL_HELP_CATALOG, getHelpGuideForPath } from '@/data/contextualHelpData';
import { ContextualHelpProvider, useContextualHelp } from '@/contexts/ContextualHelpContext';
import { ContextualHelpButton } from '@/components/help/ContextualHelpButton';
import { ContextualHelpDrawer } from '@/components/help/ContextualHelpDrawer';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('Sistema Global de Ajuda Contextual — ERP ORBE', () => {
  it('1. O catálogo de guias deve conter todas as seções obrigatórias estruturadas', () => {
    expect(CONTEXTUAL_HELP_CATALOG.length).toBeGreaterThanOrEqual(15);

    CONTEXTUAL_HELP_CATALOG.forEach((guide) => {
      // Requisito 4: Para que serve?
      expect(guide.purpose, `Guia ${guide.id} sem purpose`).toBeTruthy();
      expect(guide.purpose.length).toBeGreaterThan(10);

      // Requisito 4: Quando devo utilizá-la?
      expect(guide.whenToUse, `Guia ${guide.id} sem whenToUse`).toBeTruthy();

      // Requisito 4: Como funciona? (passo a passo)
      expect(guide.howItWorks, `Guia ${guide.id} sem howItWorks`).toBeInstanceOf(Array);
      expect(guide.howItWorks.length).toBeGreaterThanOrEqual(2);

      // Requisito 4: O que significam os principais campos e status?
      expect(guide.fieldsAndStatus, `Guia ${guide.id} sem fieldsAndStatus`).toBeInstanceOf(Array);
      expect(guide.fieldsAndStatus.length).toBeGreaterThanOrEqual(1);

      // Requisito 4: O que devo conferir antes de concluir?
      expect(guide.checklist, `Guia ${guide.id} sem checklist`).toBeInstanceOf(Array);
      expect(guide.checklist.length).toBeGreaterThanOrEqual(1);

      // Requisito 4: O que acontece depois?
      expect(guide.nextSteps, `Guia ${guide.id} sem nextSteps`).toBeTruthy();

      // Requisito 4: Problemas comuns e como resolvê-los
      expect(guide.commonIssues, `Guia ${guide.id} sem commonIssues`).toBeInstanceOf(Array);
    });
  });

  it('2. Deve resolver guias para rotas operacionais, RH, Financeiras e de Campo', () => {
    // Portal Operacional (Encarregado)
    const guiaProducao = getHelpGuideForPath('/producao');
    expect(guiaProducao?.id).toBe('producao-operacoes-volume');
    expect(guiaProducao?.title).toContain('Operação por Volume');

    const guiaDiaristasCampo = getHelpGuideForPath('/producao/diaristas');
    expect(guiaDiaristasCampo?.id).toBe('producao-diaristas');

    // RH & Pessoas
    const guiaPonto = getHelpGuideForPath('/clt/pontos');
    expect(guiaPonto?.id).toBe('clt-pontos-jornadas');

    const guiaBancoHoras = getHelpGuideForPath('/clt/banco-horas');
    expect(guiaBancoHoras?.id).toBe('banco-horas-painel');

    // Aprovações RH
    const guiaAprovacoes = getHelpGuideForPath('/rh/aprovacoes');
    expect(guiaAprovacoes?.id).toBe('rh-aprovacoes-central');

    // Financeiro & Controladoria
    const guiaReceitas = getHelpGuideForPath('/financeiro/receitas');
    expect(guiaReceitas?.id).toBe('financeiro-receitas');

    const guiaDespesas = getHelpGuideForPath('/financeiro');
    expect(guiaDespesas?.id).toBe('financeiro-despesas');

    const guiaBancario = getHelpGuideForPath('/bancario');
    expect(guiaBancario?.id).toBe('financeiro-bancario-central');

    // Cadastros
    const guiaCadastros = getHelpGuideForPath('/cadastros');
    expect(guiaCadastros?.id).toBe('cadastros-central');
  });

  it('3. Deve sanitizar e isolar termos administrativos quando o perfil for ENCARREGADO', () => {
    const guiaEncarregado = getHelpGuideForPath('/producao', 'ENCARREGADO');
    expect(guiaEncarregado).toBeDefined();

    // Não deve instruir encarregado a acessar telas de financeiro, cnab ou folha
    expect(guiaEncarregado?.nextSteps.toLowerCase()).not.toContain('cnab');
    expect(guiaEncarregado?.nextSteps.toLowerCase()).not.toContain('remessa');
  });

  it('4. Deve abrir o drawer e exibir o conteúdo da tela ao clicar no botão de ajuda', () => {
    const TestComponent = () => {
      const { currentGuide } = useContextualHelp();
      return (
        <div>
          <span data-testid="guide-title">{currentGuide?.title}</span>
          <ContextualHelpButton showLabel />
          <ContextualHelpDrawer />
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={['/clt/pontos']}>
        <TooltipProvider>
          <ContextualHelpProvider>
            <TestComponent />
          </ContextualHelpProvider>
        </TooltipProvider>
      </MemoryRouter>
    );

    // O título do guia detectado na rota /clt/pontos deve bater
    expect(screen.getByTestId('guide-title').textContent).toBe('Ponto & Jornadas CLT Oficial');

    // O botão de acionamento está presente
    const btn = screen.getByRole('button', { name: /Ajuda/i });
    expect(btn).toBeDefined();

    // Ao clicar no botão, o Drawer deve abrir com o guia
    fireEvent.click(btn);
    expect(screen.getAllByText('Ponto & Jornadas CLT Oficial').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Para que serve esta tela?')).toBeDefined();
    expect(screen.getByText('Quando devo utilizá-la?')).toBeDefined();
  });
});
