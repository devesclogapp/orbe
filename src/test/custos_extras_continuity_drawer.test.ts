import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import {
  CUSTOS_EXTRAS_STAGES,
  CustosExtrasContinuityDrawer,
} from '@/components/operacoes/CustosExtrasContinuityDrawer';
import { buildCustosExtrasPipeline } from '@/contexts/OperationalPipelineContext';

describe('PROTÓTIPO UX — Drawer de Continuidade (Custos Extras)', () => {
  describe('1. Desacoplamento Arquitetural: Decisão Modal x Drawer', () => {
    it('OperationalPipelinePresenter.tsx deve existir e orquestrar a decisão de apresentação', () => {
      const filePath = path.resolve(__dirname, '../components/layout/OperationalPipelinePresenter.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useOperationalPipeline');
      expect(content).toContain('OperationalPipelineModal');
      expect(content).toContain('CustosExtrasContinuityDrawer');
      // Custos Extras direcionado para o Drawer
      expect(content).toContain('payload?.context?.fluxo === "Custos Extras"');
      // Demais fluxos direcionados para o Modal
      expect(content).toContain('return <OperationalPipelineModal />;');
    });

    it('OperationalPipelineModal.tsx deve permanecer genérico e NÃO conter regra acoplada a Custos Extras', () => {
      const filePath = path.resolve(__dirname, '../components/layout/OperationalPipelineModal.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // O modal central não tem conhecimento de "Custos Extras" diretamente
      expect(content).not.toContain('Custos Extras');
      expect(content).not.toContain('CustosExtrasContinuityDrawer');
    });

    it('App.tsx deve montar OperationalPipelinePresenter no lugar do modal direto', () => {
      const filePath = path.resolve(__dirname, '../App.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('import { OperationalPipelinePresenter } from "@/components/layout/OperationalPipelinePresenter"');
      expect(content).toContain('<OperationalPipelinePresenter />');
    });
  });

  describe('2. Definição dos 5 Estágios com Linguagem de Negócio', () => {
    it('CUSTOS_EXTRAS_STAGES deve conter exatamente as 5 etapas canônicas em linguagem de negócio', () => {
      expect(CUSTOS_EXTRAS_STAGES).toHaveLength(5);

      const labels = CUSTOS_EXTRAS_STAGES.map((s) => s.label);
      expect(labels).toEqual([
        'Recebido',
        'Em validação',
        'Aprovado',
        'A pagar',
        'Pago',
      ]);

      const keys = CUSTOS_EXTRAS_STAGES.map((s) => s.key);
      expect(keys).toEqual([
        'RECEBIDO',
        'EM_VALIDACAO',
        'APROVADO_OPERACAO',
        'ENVIADO_FINANCEIRO',
        'FINALIZADO',
      ]);
    });

    it('CustosExtrasContinuityDrawer.tsx deve conter indicador textual explícito "Você está aqui"', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('Você está aqui');
      expect(content).toContain('Resumo da Ação');
      expect(content).toContain('Continuar nesta tela');
    });
  });

  describe('3. CTAs Contextuais e Destinos de Navegação (Sem auto-transição backend)', () => {
    it('EM_VALIDACAO deve direcionar para /custos-extras/aprovacoes quando usuário autorizado', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'Empresa Teste',
        pipelineStatus: 'EM_VALIDACAO',
        userRole: 'gestor',
      });

      expect(pipeline.nextAction?.route).toBe('/custos-extras/aprovacoes');
      expect(pipeline.nextAction?.label).toContain('Continuar para Aprovações');
    });

    it('APROVADO_OPERACAO deve direcionar para Pagamentos com origem=CUSTOS_EXTRAS', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'Empresa Teste',
        pipelineStatus: 'APROVADO_OPERACAO',
        userRole: 'financeiro',
      });

      expect(pipeline.nextAction?.route).toBe('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
      expect(pipeline.nextAction?.label).toContain('Continuar para Pagamentos');
    });

    it('ENVIADO_FINANCEIRO deve direcionar para Pagamentos com origem=CUSTOS_EXTRAS', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'Empresa Teste',
        pipelineStatus: 'ENVIADO_FINANCEIRO',
        userRole: 'financeiro',
      });

      expect(pipeline.nextAction?.route).toBe('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
      expect(pipeline.nextAction?.label).toContain('Continuar para Pagamentos');
    });

    it('FINALIZADO + PAGO não deve inventar próximo passo artificial', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'Empresa Teste',
        pipelineStatus: 'FINALIZADO',
        statusPagamento: 'PAGO',
        userRole: 'admin',
        isAdmin: true,
      });

      expect(pipeline.nextAction).toBeUndefined();
    });
  });

  describe('4. Preservação de RBAC e Segurança de Papéis', () => {
    it('Encarregado não deve receber nextAction para rotas fora de /producao', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'Empresa Teste',
        pipelineStatus: 'EM_VALIDACAO',
        userRole: 'encarregado',
        isAdmin: false,
      });

      // Para encarregado, nextAction é bloqueada
      expect(pipeline.nextAction).toBeUndefined();
    });

    it('Drawer deve aplicar trava para impedir fuga de Encarregado para rotas administrativas', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('isEncarregado');
      expect(content).toContain('!rawNextAction.route.startsWith("/producao")');
    });
  });

  describe('5. Drawer de Detalhes — Mini-resumo e Alternância Interna (Anti-Sobreposição)', () => {
    it('CustosExtrasTableBlock.tsx deve ter mini-resumo com 5 etapas e alternância entre Detalhes e Fluxo', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('MINI_FLOW_STAGES');
      expect(content).toContain('FULL_FLOW_STAGES');
      expect(content).toContain('detailsViewMode');
      expect(content).toContain('Ver fluxo completo →');
      expect(content).toContain('Voltar aos detalhes');
      expect(content).toContain('Você está aqui');
    });

    it('Clique no badge de pipeline dentro dos detalhes deve alternar para viewMode flow em vez de modal', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('setDetailsViewMode("flow")');
    });
  });

  describe('6. Refinamentos Visuais do Drawer — Homologação UX', () => {
    it('Modo Fluxo Completo não deve exibir mini-fluxo do topo simultaneamente com a timeline', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // O mini-fluxo deve estar confinado ao branch de Detalhes
      const flowModeIndex = content.indexOf('{detailsViewMode === "flow" ?');
      const miniFlowIndex = content.indexOf('{/* Modo Detalhes: Mini-resumo compacto no topo com ação Ver fluxo completo */}');

      expect(flowModeIndex).toBeGreaterThan(-1);
      expect(miniFlowIndex).toBeGreaterThan(flowModeIndex);
      expect(content).toContain('Voltar aos detalhes');
    });

    it('A timeline deve diferenciar claramente: Concluído (✓), Atual (● Você está aqui) e Futuro (Pendente neutro)', () => {
      const drawerPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
      const tablePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const tableContent = fs.readFileSync(tablePath, 'utf-8');

      for (const content of [drawerContent, tableContent]) {
        expect(content).toContain('✓ Concluído');
        expect(content).toContain('● Você está aqui');
        expect(content).toContain('Pendente');
        // Indicador lateral forte na etapa atual
        expect(content).toContain('border-l-4 border-l-primary');
      }
    });

    it('Estado FINALIZADO / PAGO deve marcar todas as etapas como concluídas sem "Você está aqui" artificial', () => {
      const drawerPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
      const tablePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const tableContent = fs.readFileSync(tablePath, 'utf-8');

      // Em ambos os componentes, a etapa atual é falsa se o fluxo estiver concluído
      expect(drawerContent).toContain('const isStepCurrent = !isFlowDone && idx === currentStageIndex;');
      expect(drawerContent).toContain('const isStepDone = isFlowDone || idx < currentStageIndex;');

      expect(tableContent).toContain('const isStepCurrent = !isFinalizado && idx === currentStageIdx;');
      expect(tableContent).toContain('const isStepDone = isFinalizado || idx < currentStageIdx;');
    });

    it('Banner / Rodapé contextual deve conter exatamente as 5 frases oficiais do ciclo', () => {
      const tablePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const tableContent = fs.readFileSync(tablePath, 'utf-8');
      const drawerPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

      const expectedPhrases = [
        'Lançamento recebido. Aguardando encaminhamento para validação.',
        'Despesa em validação operacional.',
        'Despesa aprovada. Aguardando liberação para pagamento.',
        'Despesa liberada. Pagamento pendente.',
        'Despesa liquidada e finalizada no pipeline financeiro.',
      ];

      for (const phrase of expectedPhrases) {
        expect(tableContent).toContain(phrase);
        expect(drawerContent).toContain(phrase);
      }
    });

    it('Etapa Aprovado deve possuir a descrição de negócio esclarecedora', () => {
      const tablePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const tableContent = fs.readFileSync(tablePath, 'utf-8');
      const drawerPath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

      expect(tableContent).toContain('Despesa aprovada operacionalmente para pagamento.');
      expect(drawerContent).toContain('Despesa aprovada operacionalmente para pagamento.');
    });
  });

  describe('7. Disparo do Drawer de Continuidade após Aprovação em AprovacoesRh.tsx', () => {
    it('AprovacoesRh.tsx deve importar e instanciar useOperationalPipeline e buildCustosExtrasPipeline', () => {
      const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useOperationalPipeline');
      expect(content).toContain('buildCustosExtrasPipeline');
      expect(content).toContain('const { openPipeline } = useOperationalPipeline();');
    });

    it('Aprovação individual de Custo Extra deve fechar o drawer de detalhes primeiro e disparar o Drawer de Continuidade', () => {
      const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica fechamento prévio de activeItem e subsequente disparo do pipeline
      expect(content).toContain('setActiveItem(null);');
      expect(content).toContain('if (currentItem.tipo === "CUSTO EXTRA")');
      expect(content).toContain('openPipeline(buildCustosExtrasPipeline({');
      expect(content).toContain('currentStep: "financeiro"');
      expect(content).toContain('pipelineStatus: result?.pipeline_status || "APROVADO_OPERACAO"');
    });

    it('Pipeline gerado para aprovação de Custo Extra deve configurar APROVADO_OPERACAO com CTA para Pagamentos', () => {
      const pipeline = buildCustosExtrasPipeline({
        competencia: '2026-09',
        empresa: 'BENEVIDES',
        currentStep: 'financeiro',
        pipelineStatus: 'APROVADO_OPERACAO',
        statusPagamento: 'A_PAGAR',
        userRole: 'admin',
        isAdmin: true,
      });

      // Contexto canônico para acionar CustosExtrasContinuityDrawer
      expect(pipeline.context?.fluxo).toBe('Custos Extras');
      expect(pipeline.context?.empresa).toBe('BENEVIDES');

      // Steps: Recebido (done), Em validação (done), Aprovado (current), A pagar (pending), Pago (pending)
      expect(pipeline.steps[0].status).toBe('done');
      expect(pipeline.steps[1].status).toBe('done');
      expect(pipeline.steps[2].status).toBe('current');
      expect(pipeline.steps[3].status).toBe('pending');
      expect(pipeline.steps[4].status).toBe('pending');

      // Próxima Ação direciona para Pagamentos
      expect(pipeline.nextAction?.route).toBe('/financeiro?tab=custos-extras&origem=CUSTOS_EXTRAS');
      expect(pipeline.nextAction?.label).toContain('Continuar para Pagamentos');
    });
  });

  describe('8. Refinamento Final do Protótipo UX — Validação dos Ajustes Aprovados', () => {
    it('AprovacoesRh: aprovação individual deve selecionar aba "aprovados" e resetar paginação', () => {
      const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('setActiveTab("aprovados");');
      expect(content).toContain('setCurrentPage(1);');
    });

    it('AprovacoesRh: devolução e solicitação de correção devem selecionar aba "devolvidos" e resetar paginação', () => {
      const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('setActiveTab("devolvidos");');
    });

    it('CustosExtrasForm: criação com sucesso deve disparar openPipeline com estágio RECEBIDO', () => {
      const filePath = path.resolve(__dirname, '../components/forms/CustosExtrasForm.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('useOperationalPipeline');
      expect(content).toContain('buildCustosExtrasPipeline');
      expect(content).toContain('openPipeline(buildCustosExtrasPipeline({');
      expect(content).toContain('currentStep: "lancamento"');
      expect(content).toContain('pipelineStatus: "RECEBIDO"');
    });

    it('CustosExtrasContinuityDrawer: quando em Pagamentos, CTA deve ser "Registrar pagamento" sem redirecionamento artificial', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('isAlreadyAtPagamentos');
      expect(content).toContain('Registrar pagamento');
      expect(content).toContain('Você já está na visão de Pagamentos. Prossiga com o pagamento do item nesta tela.');
    });

    it('CustosExtrasContinuityDrawer: marcador e respiro do rodapé devem estar refinados', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasContinuityDrawer.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Marcador equilibrado
      expect(content).toContain('ring-3 ring-primary/20 ring-offset-1');
      // Respiro no scroll e rodapé
      expect(content).toContain('pb-8');
      expect(content).toContain('py-5 bg-muted/25 shrink-0');
      expect(content).toContain('Continuar nesta tela');
    });

    it('CustosExtrasTableBlock: badges de detalhes não devem sofrer corte/clipping e devem reservar linha para pipeline', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('grid grid-cols-1 sm:grid-cols-2 gap-3');
      expect(content).toContain('sm:col-span-2');
      expect(content).toContain('whitespace-normal');
    });

    it('CustosExtrasTableBlock: toast do pipeline deve usar ID específico evitando toast.dismiss global', () => {
      const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('toast.success("Status do pipeline atualizado", { id: "pipeline-status" });');
      expect(content).toContain('toast.dismiss("pipeline-status");');
      // Não deve conter toast.dismiss() sem parâmetros que limparia todos os toasts legítimos do app
      expect(content).not.toMatch(/toast\.dismiss\(\s*\)/);
    });
  });
});
