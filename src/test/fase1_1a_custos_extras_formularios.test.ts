import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  OPCOES_ORIGEM_RECURSO,
  validateCustoExtraForm,
  buildCustoExtraInsertPayload,
  getOrigemRecursoBadge,
  getOrigemRecursoApprovalNotice,
  getOrigemRecursoStatusNotice,
  type CustoExtraFormInput,
} from '@/types/custosExtrasForm';
import { buildCustosExtrasPipeline } from '@/contexts/OperationalPipelineContext';

describe('Fase 1.1A — Domínio e Validação de Custos Extras', () => {
  const baseValidInput: CustoExtraFormInput = {
    empresa_id: 'empresa-uuid-1',
    unidade_id: 'unidade-uuid-1',
    data: '2026-09-18',
    categoria: 'MERENDA/LANCHE',
    descricao: 'Café da manhã da equipe',
    quantidade: 1,
    valor_unitario: 50.0,
    forma_pagamento_id: 'fp-uuid-pix',
    origem_recurso: 'PAGO_EMPRESA',
    favorecido_colaborador_id: null,
    favorecido_fornecedor_id: null,
    data_vencimento: null,
    observacao: 'Comprado na padaria central',
  };

  it('1. Deve rejeitar submissão sem origem_recurso', () => {
    const inputSemOrigem = { ...baseValidInput, origem_recurso: undefined as any };
    const validation = validateCustoExtraForm(inputSemOrigem);
    expect(validation.valid).toBe(false);
    expect(validation.errors.origem_recurso).toBeDefined();

    expect(() =>
      buildCustoExtraInsertPayload(inputSemOrigem, { origemLancamento: 'encarregado' })
    ).toThrow(/origem do recurso/i);
  });

  it('2. Deve rejeitar origem_recurso inválida', () => {
    const inputOrigemInvalida = { ...baseValidInput, origem_recurso: 'OUTRA_ORIGEM' as any };
    const validation = validateCustoExtraForm(inputOrigemInvalida);
    expect(validation.valid).toBe(false);
    expect(validation.errors.origem_recurso).toContain('inválida');
  });

  it('3. PAGO_EMPRESA: deve gerar payload explícito com RECEBIDO / A_PAGAR e favorecidos nulos', () => {
    const payload = buildCustoExtraInsertPayload(baseValidInput, {
      tenantId: 'tenant-123',
      userId: 'user-456',
      origemLancamento: 'encarregado',
    });

    expect(payload.origem_recurso).toBe('PAGO_EMPRESA');
    expect(payload.pipeline_status).toBe('RECEBIDO');
    expect(payload.status_pagamento).toBe('A_PAGAR');
    expect(payload.favorecido_colaborador_id).toBeNull();
    expect(payload.favorecido_fornecedor_id).toBeNull();
    expect(payload.data_vencimento).toBeNull();
    expect(payload.total).toBe(50.0);
    expect(payload.origem_lancamento).toBe('encarregado');
    expect(payload.tenant_id).toBe('tenant-123');
    expect(payload.responsavel_id).toBe('user-456');
  });

  it('4. REEMBOLSO_COLABORADOR: deve rejeitar se colaborador não for informado', () => {
    const inputReembolsoSemColab: CustoExtraFormInput = {
      ...baseValidInput,
      origem_recurso: 'REEMBOLSO_COLABORADOR',
      favorecido_colaborador_id: null,
    };

    const validation = validateCustoExtraForm(inputReembolsoSemColab);
    expect(validation.valid).toBe(false);
    expect(validation.errors.favorecido_colaborador_id).toContain('Selecione o colaborador');

    expect(() =>
      buildCustoExtraInsertPayload(inputReembolsoSemColab, { origemLancamento: 'admin' })
    ).toThrow(/colaborador que realizou o pagamento/i);
  });

  it('5. REEMBOLSO_COLABORADOR: deve gerar payload correto com favorecido_colaborador_id preenchido', () => {
    const inputReembolsoValido: CustoExtraFormInput = {
      ...baseValidInput,
      origem_recurso: 'REEMBOLSO_COLABORADOR',
      favorecido_colaborador_id: 'colab-uuid-789',
      // Caso resquício de outro formulário venha preenchido, deve ser limpo
      favorecido_fornecedor_id: 'fornec-deve-sumir',
      data_vencimento: '2026-09-30',
    };

    const payload = buildCustoExtraInsertPayload(inputReembolsoValido, {
      tenantId: 'tenant-123',
      userId: 'user-456',
      origemLancamento: 'encarregado',
    });

    expect(payload.origem_recurso).toBe('REEMBOLSO_COLABORADOR');
    expect(payload.favorecido_colaborador_id).toBe('colab-uuid-789');
    expect(payload.favorecido_fornecedor_id).toBeNull(); // Limpo automaticamente
    expect(payload.data_vencimento).toBeNull(); // Limpo automaticamente
    expect(payload.pipeline_status).toBe('RECEBIDO');
    expect(payload.status_pagamento).toBe('A_PAGAR');
  });

  it('6. PAGAMENTO_PENDENTE: deve gerar payload com favorecido_fornecedor_id e data_vencimento', () => {
    const inputPendente: CustoExtraFormInput = {
      ...baseValidInput,
      origem_recurso: 'PAGAMENTO_PENDENTE',
      favorecido_fornecedor_id: 'fornec-uuid-111',
      data_vencimento: '2026-09-25',
      favorecido_colaborador_id: 'colab-deve-sumir',
    };

    const payload = buildCustoExtraInsertPayload(inputPendente, {
      tenantId: 'tenant-123',
      userId: 'user-admin',
      origemLancamento: 'admin',
    });

    expect(payload.origem_recurso).toBe('PAGAMENTO_PENDENTE');
    expect(payload.favorecido_fornecedor_id).toBe('fornec-uuid-111');
    expect(payload.data_vencimento).toBe('2026-09-25');
    expect(payload.favorecido_colaborador_id).toBeNull(); // Limpo automaticamente
    expect(payload.pipeline_status).toBe('RECEBIDO');
    expect(payload.status_pagamento).toBe('A_PAGAR');
    expect(payload.origem_lancamento).toBe('admin');
  });

  it('7. Troca de origem para PAGO_EMPRESA limpa campos condicionais incompatíveis', () => {
    const inputComResquicios: CustoExtraFormInput = {
      ...baseValidInput,
      origem_recurso: 'PAGO_EMPRESA',
      favorecido_colaborador_id: 'colab-uuid-123',
      favorecido_fornecedor_id: 'fornec-uuid-456',
      data_vencimento: '2026-09-28',
    };

    const payload = buildCustoExtraInsertPayload(inputComResquicios, {
      origemLancamento: 'encarregado',
    });

    expect(payload.favorecido_colaborador_id).toBeNull();
    expect(payload.favorecido_fornecedor_id).toBeNull();
    expect(payload.data_vencimento).toBeNull();
  });

  it('8. As 3 opções de origem devem estar definidas com labels e descrições claras', () => {
    expect(OPCOES_ORIGEM_RECURSO.length).toBe(3);
    const valores = OPCOES_ORIGEM_RECURSO.map(o => o.value);
    expect(valores).toEqual(['PAGO_EMPRESA', 'REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE']);
    
    expect(OPCOES_ORIGEM_RECURSO[0].label).toBe('Pago pela empresa');
    expect(OPCOES_ORIGEM_RECURSO[0].descricao).toBe('A empresa já realizou o pagamento.');

    expect(OPCOES_ORIGEM_RECURSO[1].label).toBe('Pago por colaborador');
    expect(OPCOES_ORIGEM_RECURSO[1].descricao).toBe('O colaborador utilizou recurso próprio e deverá ser reembolsado.');

    expect(OPCOES_ORIGEM_RECURSO[2].label).toBe('Ainda não foi pago');
    expect(OPCOES_ORIGEM_RECURSO[2].descricao).toBe('A despesa ainda possui pagamento pendente.');
  });

  it('9. getOrigemRecursoBadge deve retornar labels e estilos corretos para UI', () => {
    expect(getOrigemRecursoBadge('PAGO_EMPRESA').label).toBe('Empresa');
    expect(getOrigemRecursoBadge('REEMBOLSO_COLABORADOR').label).toBe('Reembolso');
    expect(getOrigemRecursoBadge('PAGAMENTO_PENDENTE').label).toBe('Pendente');
    expect(getOrigemRecursoBadge('LEGACY').label).toBe('Legado');
    expect(getOrigemRecursoBadge(null).label).toBe('Legado');
  });

  it('10. CustosExtrasLancamento.tsx deve utilizar o helper compartilhado e pré-selecionar PAGO_EMPRESA', () => {
    const filePath = path.resolve(__dirname, '../pages/Producao/CustosExtrasLancamento.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('buildCustoExtraInsertPayload');
    expect(content).toContain('OPCOES_ORIGEM_RECURSO');
    expect(content).toContain('origem_recurso: "PAGO_EMPRESA"');
    expect(content).toContain('Quem pagou esta despesa?');
    expect(content).toContain('favorecido_colaborador_id');
    expect(content).toContain('favorecido_fornecedor_id');
    expect(content).toContain('getOrigemRecursoBadge');
  });

  it('11. CustosExtrasForm.tsx (Admin) deve utilizar o helper compartilhado e pré-selecionar PAGO_EMPRESA', () => {
    const filePath = path.resolve(__dirname, '../components/forms/CustosExtrasForm.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('buildCustoExtraInsertPayload');
    expect(content).toContain('OPCOES_ORIGEM_RECURSO');
    expect(content).toContain('origem_recurso: "PAGO_EMPRESA"');
    expect(content).toContain('Quem pagou esta despesa?');
    expect(content).toContain('favorecido_colaborador_id');
    expect(content).toContain('favorecido_fornecedor_id');
  });

  it('12. UX: getOrigemRecursoBadge deve retornar labelCompleto legível para todas as origens', () => {
    expect(getOrigemRecursoBadge('PAGO_EMPRESA').labelCompleto).toBe('Pago pela empresa');
    expect(getOrigemRecursoBadge('REEMBOLSO_COLABORADOR').labelCompleto).toBe('Pago por colaborador / Reembolso');
    expect(getOrigemRecursoBadge('PAGAMENTO_PENDENTE').labelCompleto).toBe('Ainda não foi pago');
    expect(getOrigemRecursoBadge('LEGACY').labelCompleto).toBe('Registro legado');
    expect(getOrigemRecursoBadge(null).labelCompleto).toBe('Registro legado');
  });

  it('13. UX: getOrigemRecursoApprovalNotice deve retornar mensagens contextuais para aprovação', () => {
    expect(getOrigemRecursoApprovalNotice('PAGO_EMPRESA')).toBe(
      'Pago pela empresa — ao aprovar, o lançamento será concluído sem gerar novo pagamento.'
    );
    expect(getOrigemRecursoApprovalNotice('REEMBOLSO_COLABORADOR')).toBe(
      'Pago por colaborador — ao aprovar, seguirá para reembolso.'
    );
    expect(getOrigemRecursoApprovalNotice('PAGAMENTO_PENDENTE')).toBe(
      'Ainda não foi pago — ao aprovar, seguirá para o fluxo financeiro.'
    );
    expect(getOrigemRecursoApprovalNotice('LEGACY')).toBeNull();
    expect(getOrigemRecursoApprovalNotice(null)).toBeNull();
  });

  it('14. UX: AprovacoesRh.tsx deve invalidar custos-extras com refetchType all e exibir origem no DetailPanel', () => {
    const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Invalidação do cache de custos-extras no invalidate()
    expect(content).toContain('queryClient.invalidateQueries({ queryKey: ["custos-extras"], refetchType: "all" });');
    // Consulta direta dos detalhes de custo extra por id para não inventar valor no frontend
    expect(content).toContain('queryKey: ["custo-extra-detalhes-aprovacao", item.id]');
    // Exibição da origem do recurso e notice de aprovação no DetailPanel
    expect(content).toContain('getOrigemRecursoBadge');
    expect(content).toContain('getOrigemRecursoApprovalNotice');
    expect(content).toContain('origemBadge.labelCompleto');
  });

  it('15. UX: CustosExtrasTableBlock.tsx deve invalidar custos-extras com refetchType all e exibir origem no drawer de detalhes', () => {
    const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Invalidação em updatePipelineMutation com refetchType all
    expect(content).toContain('queryClient.invalidateQueries({ queryKey: ["custos-extras"], refetchType: "all" });');
    // Exibição de Origem do Recurso no Sheet de detalhes
    expect(content).toContain('getOrigemRecursoBadge');
    expect(content).toContain('origemBadge.labelCompleto');
  });

  it('16. UX: getOrigemRecursoStatusNotice deve diferenciar itens aprovados de itens em análise', () => {
    // Quando aprovado
    expect(getOrigemRecursoStatusNotice('PAGO_EMPRESA', true)).toBe(
      'Despesa paga pela empresa. Aprovada pelo RH e concluída sem gerar contas a pagar.'
    );
    expect(getOrigemRecursoStatusNotice('REEMBOLSO_COLABORADOR', true)).toBe(
      'Despesa aprovada pelo RH. Encaminhada para reembolso ao colaborador.'
    );
    expect(getOrigemRecursoStatusNotice('PAGAMENTO_PENDENTE', true)).toBe(
      'Despesa aprovada pelo RH. Encaminhada para o fluxo financeiro de pagamentos.'
    );

    // Quando em análise (pendente de aprovação)
    expect(getOrigemRecursoStatusNotice('PAGO_EMPRESA', false)).toBe(
      'Pago pela empresa — ao aprovar, o lançamento será concluído sem gerar novo pagamento.'
    );
    expect(getOrigemRecursoStatusNotice('REEMBOLSO_COLABORADOR', false)).toBe(
      'Pago por colaborador — ao aprovar, seguirá para reembolso.'
    );
  });

  it('17. UX: AprovacoesRh.tsx não deve apresentar botões de ação (Aprovar, Devolver, Solicitar Correção) em itens aprovados ou devolvidos', () => {
    const filePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica que isItemAprovado, isItemDevolvido e isItemEmAnalise são calculados canonicamente
    expect(content).toContain('const isItemAprovado =');
    expect(content).toContain('const isItemDevolvido =');
    expect(content).toContain('const isItemEmAnalise = !isItemAprovado && !isItemDevolvido;');

    // Verifica que os botões de ação estão estritamente condicionados a isItemEmAnalise
    expect(content).toContain('{isItemEmAnalise && (');
    
    // Verifica que para itens aprovados, exibe o bloco de somente leitura / concluído
    expect(content).toContain('{isItemAprovado && (');
    expect(content).toContain('Custo Extra Concluído — Pago pela Empresa');
    expect(content).toContain('Validação RH Concluída');

    // Verifica que para itens devolvidos, exibe o aviso e não oferece aprovação
    expect(content).toContain('{isItemDevolvido && !isItemAprovado && (');
    expect(content).toContain('Lançamento Devolvido');
  });

  it('18. UX: CustosExtrasTableBlock.tsx deve possuir drawer 100% responsivo sem corte do botão Registrar Pagamento', () => {
    const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica que o SheetContent protege contra overflow horizontal
    expect(content).toContain('overflow-x-hidden');
    // Verifica que o footer organiza o botão principal de avanço em largura total e ações secundárias flexíveis
    expect(content).toContain('Registrar Pagamento');
    expect(content).toContain('Devolver para Operação');
    expect(content).toContain('flex flex-wrap items-center justify-between gap-2 w-full min-w-0');
    // Verifica que não há overflow nos cards internos (min-w-0 presente)
    expect(content).toContain('grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-muted/30 border border-border/70 min-w-0');
  });

  it('19. Modal Liquidação: CustosExtrasTableBlock.tsx deve exibir Favorecido (Reembolso) quando origem_recurso for REEMBOLSO_COLABORADOR', () => {
    const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica que o modal de confirmação de liquidação contém a regra para REEMBOLSO_COLABORADOR
    expect(content).toContain('itemToPay.origem_recurso === "REEMBOLSO_COLABORADOR"');
    expect(content).toContain('Favorecido (Reembolso):');
    expect(content).toContain('itemToPay.favorecido_colaborador?.nome || itemToPay.favorecido_colaborador_id');
  });

  it('20. Regressão Pipeline: FINALIZADO + PAGO deve marcar etapa Finalizado como Concluído (status "done")', () => {
    const pipeline = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      pipelineStatus: 'FINALIZADO',
      statusPagamento: 'PAGO',
    });

    expect(pipeline.steps).toHaveLength(5);
    const [recebido, emValidacao, aprovadoOp, financeiro, finalizado] = pipeline.steps;

    // Todas as etapas devem estar concluídas
    expect(recebido.label).toBe('Recebido');
    expect(recebido.status).toBe('done');

    expect(emValidacao.label).toBe('Em Validação');
    expect(emValidacao.status).toBe('done');

    expect(aprovadoOp.label).toBe('Aprovado Operação');
    expect(aprovadoOp.status).toBe('done');

    expect(financeiro.label).toBe('Financeiro');
    expect(financeiro.status).toBe('done');

    expect(finalizado.label).toBe('Finalizado');
    // CRÍTICO: etapa Finalizado deve ser "done" (Concluído), JAMAIS "current" (Em andamento)
    expect(finalizado.status).toBe('done');

    // Quando concluído, não deve oferecer próxima ação
    expect(pipeline.nextAction).toBeUndefined();
  });

  it('21. Regressão Pipeline: estados intermediários devem continuar corretos e com "current" apenas na etapa ativa', () => {
    // 1. RECEBIDO
    const pRecebido = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      pipelineStatus: 'RECEBIDO',
      statusPagamento: 'A_PAGAR',
    });
    expect(pRecebido.steps[0].status).toBe('current');
    expect(pRecebido.steps[1].status).toBe('pending');
    expect(pRecebido.steps[4].status).toBe('pending');

    // 2. EM_VALIDACAO
    const pValidacao = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      pipelineStatus: 'EM_VALIDACAO',
      statusPagamento: 'A_PAGAR',
    });
    expect(pValidacao.steps[0].status).toBe('done');
    expect(pValidacao.steps[1].status).toBe('current');
    expect(pValidacao.steps[2].status).toBe('pending');

    // 3. APROVADO_OPERACAO
    const pAprovado = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      pipelineStatus: 'APROVADO_OPERACAO',
      statusPagamento: 'A_PAGAR',
    });
    expect(pAprovado.steps[0].status).toBe('done');
    expect(pAprovado.steps[1].status).toBe('done');
    expect(pAprovado.steps[2].status).toBe('current');
    expect(pAprovado.steps[3].status).toBe('pending');

    // 4. ENVIADO_FINANCEIRO
    const pFinanceiro = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      pipelineStatus: 'ENVIADO_FINANCEIRO',
      statusPagamento: 'A_PAGAR',
    });
    expect(pFinanceiro.steps[0].status).toBe('done');
    expect(pFinanceiro.steps[1].status).toBe('done');
    expect(pFinanceiro.steps[2].status).toBe('done');
    expect(pFinanceiro.steps[3].status).toBe('current');
    expect(pFinanceiro.steps[4].status).toBe('pending');
  });

  it('22. Regressão Pipeline: currentStep "concluido" legado deve marcar Finalizado como "done"', () => {
    const pipeline = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      currentStep: 'concluido',
    });

    expect(pipeline.steps[4].label).toBe('Finalizado');
    expect(pipeline.steps[4].status).toBe('done');
    expect(pipeline.steps.every(s => s.status === 'done')).toBe(true);
    expect(pipeline.nextAction).toBeUndefined();
  });

  it('23. Regressão Pipeline: devolução com motivo deve marcar etapa com status "devolved"', () => {
    const pipeline = buildCustosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'EMPRESA TESTE',
      pipelineStatus: 'EM_VALIDACAO',
      devolucaoMotivo: 'Comprovante ilegível',
    });

    expect(pipeline.steps[1].status).toBe('devolved');
  });

  it('24. Sincronização: CustosExtrasTableBlock.tsx deve invocar openPipeline no onSuccess de finalizar_pagamento com dados canônicos', () => {
    const filePath = path.resolve(__dirname, '../components/operacoes/CustosExtrasTableBlock.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verifica que openPipeline é chamado dentro do onSuccess com o resultado canônico
    expect(content).toContain('pipelineStatus: result?.pipeline_status || \'FINALIZADO\'');
    expect(content).toContain('statusPagamento: result?.status_pagamento || \'PAGO\'');
  });
});


