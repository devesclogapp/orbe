import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContextualPipeline } from '@/components/help/ContextualPipeline';
import { ContextualHelpDrawer } from '@/components/help/ContextualHelpDrawer';
import { ContextualHelpProvider, useContextualHelp } from '@/contexts/ContextualHelpContext';
import {
  BUSINESS_PIPELINES,
  resolvePipelineForGuide,
  getPipelineForGuide,
} from '@/data/contextualPipelinesData';
import { CONTEXTUAL_HELP_CATALOG } from '@/data/contextualHelpData';

// Mock do auth context para simular perfis
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-encarregado', email: 'encarregado@esclog.com' },
    userRole: 'ENCARREGADO',
  })),
}));

describe('ContextualPipeline — Pipeline Visual do Guia Contextual', () => {
  it('1. Deve carregar todos os 8 pipelines canônicos do ERP ORBE sem omissões', () => {
    const requiredPipelines = [
      'pipeline-operacoes-volume',
      'pipeline-diaristas',
      'pipeline-servicos-extras',
      'pipeline-custos-extras',
      'pipeline-clt-pontos',
      'pipeline-intermitentes',
      'pipeline-receitas-faturamento',
      'pipeline-despesas-cnab',
    ];

    for (const pipelineId of requiredPipelines) {
      const pipeline = BUSINESS_PIPELINES[pipelineId];
      expect(pipeline).toBeDefined();
      expect(pipeline.id).toBe(pipelineId);
      expect(pipeline.steps.length).toBeGreaterThanOrEqual(3);
      expect(pipeline.title).toBeTruthy();
      expect(pipeline.description).toBeTruthy();
    }
  });

  it('2. Todas as etapas do pipeline devem conter os campos mandatórios (nome, objetivo, responsável, condições, próxima etapa)', () => {
    Object.values(BUSINESS_PIPELINES).forEach((pipeline) => {
      pipeline.steps.forEach((step) => {
        expect(step.id).toBeTruthy();
        expect(step.stepNumber).toBeGreaterThan(0);
        expect(step.name).toBeTruthy();
        expect(step.objective).toBeTruthy();
        expect(step.responsibleRole.length).toBeGreaterThan(0);
        expect(step.conditionsToAdvance).toBeTruthy();
        expect(step.nextStepPossible).toBeTruthy();
      });
    });
  });

  it('3. Deve destacar visualmente a etapa correspondente à tela atual com "Você está aqui (Tela atual)"', () => {
    const pipeline = BUSINESS_PIPELINES['pipeline-operacoes-volume'];
    render(
      <MemoryRouter>
        <ContextualPipeline pipeline={pipeline} currentStepId="op-lancamento" />
      </MemoryRouter>
    );

    expect(screen.getByText(/Você está aqui/i)).toBeInTheDocument();
    expect(screen.getByText(/Tela atual/i)).toBeInTheDocument();
    expect(screen.getByText(/Lançamento em Campo/i)).toBeInTheDocument();
  });

  it('4. Deve exibir aviso de pipeline educativo sem induzir conclusões baseadas apenas na rota', () => {
    const pipeline = BUSINESS_PIPELINES['pipeline-diaristas'];
    render(
      <MemoryRouter>
        <ContextualPipeline pipeline={pipeline} currentStepId="diarista-grade" />
      </MemoryRouter>
    );

    expect(screen.getByText(/Pipeline Educativo do Processo/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Demonstra a sequência oficial de ponta a ponta implementada no ERP/i)
    ).toBeInTheDocument();
  });

  it('5. RBAC: Encarregado não deve receber link de navegação para etapas restritas a RH/Financeiro', () => {
    const pipeline = BUSINESS_PIPELINES['pipeline-operacoes-volume'];
    render(
      <MemoryRouter>
        <ContextualPipeline pipeline={pipeline} currentStepId="op-lancamento" />
      </MemoryRouter>
    );

    // Etapas administrativas devem apresentar bloqueio educativo sem botão navegável
    const restritos = screen.getAllByText(/Acesso restrito ao perfil/i);
    expect(restritos.length).toBeGreaterThan(0);
  });

  it('6. Deve resolver automaticamente o pipeline correto para guias de diferentes domínios', () => {
    // Guia de Operações por Volume
    const guideVolume = CONTEXTUAL_HELP_CATALOG.find((g) => g.id === 'producao-operacoes-volume');
    const resolvedVolume = resolvePipelineForGuide(guideVolume);
    expect(resolvedVolume).not.toBeNull();
    expect(resolvedVolume?.pipeline.id).toBe('pipeline-operacoes-volume');

    // Guia de Diaristas
    const guideDiaristas = CONTEXTUAL_HELP_CATALOG.find((g) => g.id === 'producao-diaristas');
    const resolvedDiaristas = resolvePipelineForGuide(guideDiaristas);
    expect(resolvedDiaristas).not.toBeNull();
    expect(resolvedDiaristas?.pipeline.id).toBe('pipeline-diaristas');

    // Guia de Custos Extras
    const guideCustos = CONTEXTUAL_HELP_CATALOG.find((g) => g.id === 'producao-custos-extras');
    const resolvedCustos = resolvePipelineForGuide(guideCustos);
    expect(resolvedCustos).not.toBeNull();
    expect(resolvedCustos?.pipeline.id).toBe('pipeline-custos-extras');

    // Guia de Serviços Extras
    const guideServicos = CONTEXTUAL_HELP_CATALOG.find((g) => g.id === 'producao-servicos-extras');
    const resolvedServicos = resolvePipelineForGuide(guideServicos);
    expect(resolvedServicos).not.toBeNull();
    expect(resolvedServicos?.pipeline.id).toBe('pipeline-servicos-extras');

    // Guia de Ponto CLT
    const guideClt = CONTEXTUAL_HELP_CATALOG.find((g) => g.id === 'clt-pontos-jornadas');
    const resolvedClt = resolvePipelineForGuide(guideClt);
    expect(resolvedClt).not.toBeNull();
    expect(resolvedClt?.pipeline.id).toBe('pipeline-clt-pontos');
  });

  it('7. ContextualHelpDrawer deve renderizar a aba de Fluxo e abrir o guia com sucesso', () => {
    // Componente auxiliar para disparar o drawer com guia ativo
    const TestComponent = () => {
      const { openHelp } = useContextualHelp();
      return (
        <div>
          <button onClick={() => openHelp('producao-operacoes-volume')}>Abrir Guia Volume</button>
          <ContextualHelpDrawer />
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={['/producao']}>
        <ContextualHelpProvider>
          <TestComponent />
        </ContextualHelpProvider>
      </MemoryRouter>
    );

    // Clica para abrir o drawer
    fireEvent.click(screen.getByText('Abrir Guia Volume'));

    // Verifica que o drawer abriu com abas
    expect(screen.getByText('Lançamento de Operação por Volume')).toBeInTheDocument();
    
    // Aba dedicada Fluxo está visível na lista de abas
    const tabFluxo = screen.getByRole('tab', { name: /Fluxo/i });
    expect(tabFluxo).toBeInTheDocument();

    // Aba Dúvidas também existe
    const tabDuvidas = screen.getByRole('tab', { name: /Dúvidas/i });
    expect(tabDuvidas).toBeInTheDocument();
  });
});
