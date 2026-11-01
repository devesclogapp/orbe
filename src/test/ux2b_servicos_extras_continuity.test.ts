import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildServicosExtrasPipeline,
  resolveServicoExtraModalidade,
} from '@/contexts/OperationalPipelineContext';
import { SERVICOS_EXTRAS_STAGES } from '@/components/operacoes/ServicosExtrasContinuityDrawer';

describe('FASE UX-2B — Continuidade de Serviços Extras: Aprovação → Financeiro', () => {
  const presenterPath = path.resolve(__dirname, '../components/layout/OperationalPipelinePresenter.tsx');
  const presenterContent = fs.readFileSync(presenterPath, 'utf-8');

  const aprovacoesPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const aprovacoesContent = fs.readFileSync(aprovacoesPath, 'utf-8');

  const receitasPipelinePath = path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx');
  const receitasPipelineContent = fs.readFileSync(receitasPipelinePath, 'utf-8');

  const drawerPath = path.resolve(__dirname, '../components/operacoes/ServicosExtrasContinuityDrawer.tsx');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

  it('1. Serviço Extra usa drawer especialista ServicosExtrasContinuityDrawer', () => {
    expect(presenterContent).toContain('import { ServicosExtrasContinuityDrawer } from "@/components/operacoes/ServicosExtrasContinuityDrawer"');
    expect(presenterContent).toContain('if (payload?.context?.fluxo === "Serviços Extras")');
    expect(presenterContent).toContain('return <ServicosExtrasContinuityDrawer />');
  });

  it('2. Custos Extras continua usando seu drawer atual CustosExtrasContinuityDrawer', () => {
    expect(presenterContent).toContain('import { CustosExtrasContinuityDrawer } from "@/components/operacoes/CustosExtrasContinuityDrawer"');
    expect(presenterContent).toContain('if (payload?.context?.fluxo === "Custos Extras")');
    expect(presenterContent).toContain('return <CustosExtrasContinuityDrawer />');
  });

  it('3. Outros fluxos continuam usando o presenter/modal atual OperationalPipelineModal', () => {
    expect(presenterContent).toContain('return <OperationalPipelineModal />');
  });

  it('4. Pipeline apresenta os 5 estágios canônicos com linguagem amigável de Receitas', () => {
    const stageLabels = SERVICOS_EXTRAS_STAGES.map(s => s.label);
    expect(stageLabels).toEqual([
      'Recebido',
      'Em validação',
      'Aprovado',
      'A receber / Faturamento',
      'Recebido',
    ]);

    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'Empresa Teste',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'FATURAMENTO_MENSAL',
      registroId: 'se-123',
    });

    expect(pipeline.steps.length).toBe(5);
    expect(pipeline.steps[0].label).toBe('Recebido');
    expect(pipeline.steps[1].label).toBe('Em validação');
    expect(pipeline.steps[2].label).toBe('Aprovado');
    expect(pipeline.steps[3].label).toBe('A receber / Faturamento');
    expect(pipeline.steps[4].label).toBe('Recebido');
    expect(pipeline.steps[2].status).toBe('current');
    expect(pipeline.steps[0].status).toBe('done');
    expect(pipeline.steps[1].status).toBe('done');
    expect(pipeline.steps[3].status).toBe('pending');
    expect(pipeline.steps[4].status).toBe('pending');
  });

  it('5. CAIXA_IMEDIATO gera CTA para tab CAIXA_IMEDIATO preservando origem=SERVICO_EXTRA', () => {
    const res = resolveServicoExtraModalidade('CAIXA_IMEDIATO');
    expect(res.isValid).toBe(true);
    expect(res.label).toBe('Continuar para Caixa Imediato →');
    expect(res.route).toBe('/financeiro/receitas?tab=CAIXA_IMEDIATO&origem=SERVICO_EXTRA');

    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'Empresa Teste',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'CAIXA_IMEDIATO',
      registroId: 'se-caixa-1',
    });

    expect(pipeline.nextAction?.label).toBe('Continuar para Caixa Imediato →');
    expect(pipeline.nextAction?.route).toBe('/financeiro/receitas?tab=CAIXA_IMEDIATO&origem=SERVICO_EXTRA');
    expect(pipeline.nextAction?.actionPayload?.highlightServicoExtraId).toBe('se-caixa-1');
  });

  it('6. DUPLICATA gera CTA para tab DUPLICATA preservando origem=SERVICO_EXTRA', () => {
    const res = resolveServicoExtraModalidade('DUPLICATA');
    expect(res.isValid).toBe(true);
    expect(res.label).toBe('Continuar para Duplicatas →');
    expect(res.route).toBe('/financeiro/receitas?tab=DUPLICATA&origem=SERVICO_EXTRA');

    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'Empresa Teste',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'DUPLICATA',
      registroId: 'se-dup-1',
    });

    expect(pipeline.nextAction?.label).toBe('Continuar para Duplicatas →');
    expect(pipeline.nextAction?.route).toBe('/financeiro/receitas?tab=DUPLICATA&origem=SERVICO_EXTRA');
    expect(pipeline.nextAction?.actionPayload?.highlightServicoExtraId).toBe('se-dup-1');
  });

  it('7. FATURAMENTO_MENSAL gera CTA para tab FATURAMENTO_MENSAL preservando origem=SERVICO_EXTRA', () => {
    const res = resolveServicoExtraModalidade('FATURAMENTO_MENSAL');
    expect(res.isValid).toBe(true);
    expect(res.label).toBe('Continuar para Faturamento Mensal →');
    expect(res.route).toBe('/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA');

    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'Empresa Teste',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'FATURAMENTO_MENSAL',
      registroId: 'se-mensal-1',
    });

    expect(pipeline.nextAction?.label).toBe('Continuar para Faturamento Mensal →');
    expect(pipeline.nextAction?.route).toBe('/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA');
    expect(pipeline.nextAction?.actionPayload?.highlightServicoExtraId).toBe('se-mensal-1');
  });

  it('8. Modalidade inválida ou ausente NÃO faz fallback silencioso para FATURAMENTO_MENSAL', () => {
    const resEmpty = resolveServicoExtraModalidade(null);
    expect(resEmpty.isValid).toBe(false);
    expect(resEmpty.route).toBe('');
    expect(resEmpty.label).toBe('');

    const resUnknown = resolveServicoExtraModalidade('MODALIDADE_INEXISTENTE');
    expect(resUnknown.isValid).toBe(false);
    expect(resUnknown.route).toBe('');

    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'Empresa Teste',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'DESCONHECIDO',
      registroId: 'se-err-1',
    });

    // nextAction deve ser undefined para evitar redirecionamento arbitrário
    expect(pipeline.nextAction).toBeUndefined();
    expect(pipeline.context.isModalidadeValida).toBe(false);
  });

  it('9. CTA em todas as modalidades válidas preserva origem=SERVICO_EXTRA', () => {
    const modalidades = ['CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL'];
    for (const m of modalidades) {
      const res = resolveServicoExtraModalidade(m);
      expect(res.route).toContain('origem=SERVICO_EXTRA');
    }
  });

  it('10. Aprovação individual em AprovacoesRh abre continuidade com buildServicosExtrasPipeline', () => {
    expect(aprovacoesContent).toContain('buildServicosExtrasPipeline');
    expect(aprovacoesContent).toContain('currentItem.tipo === "SERVIÇO EXTRA"');
    expect(aprovacoesContent).toContain('openPipeline(buildServicosExtrasPipeline({');
    expect(aprovacoesContent).toContain('registroId: currentItem.id');
    expect(aprovacoesContent).toContain('pipelineStatus: result?.pipeline_status || "APROVADO_OPERACAO"');
  });

  it('11. Aprovação em massa (handleBulkAprovar) não foi alterada com disparos de drawer', () => {
    const bulkIndex = aprovacoesContent.indexOf('const handleBulkAprovar = async ()');
    expect(bulkIndex).toBeGreaterThan(0);
    const bulkBlock = aprovacoesContent.substring(bulkIndex, bulkIndex + 600);
    expect(bulkBlock).not.toContain('openPipeline');
  });

  it('12. ReceitasPipeline consegue localizar receita por servico_extra_id nos itens', () => {
    expect(receitasPipelineContent).toContain('highlightServicoExtraId');
    expect(receitasPipelineContent).toContain('it.servico_extra_id === highlightSeId');

    // Simulação do matching de ReceitasPipeline
    const mockReceitas = [
      {
        id: 'rec-1',
        modalidade: 'FATURAMENTO_MENSAL',
        receitas_operacionais_itens: [{ servico_extra_id: 'se-alfa' }],
      },
      {
        id: 'rec-2',
        modalidade: 'DUPLICATA',
        receitas_operacionais_itens: [{ servico_extra_id: 'se-beta' }],
      },
    ];

    const targetSeId = 'se-beta';
    const found = mockReceitas.find(r =>
      (r.receitas_operacionais_itens || []).some(it => it.servico_extra_id === targetSeId)
    );

    expect(found).toBeDefined();
    expect(found?.id).toBe('rec-2');
    expect(found?.modalidade).toBe('DUPLICATA');
  });

  it('13. Localização em ReceitasPipeline não executa nenhuma ação financeira automaticamente', () => {
    // Garante que o efeito de highlight apenas seta o estado da receita selecionada
    const effectIndex = receitasPipelineContent.indexOf('const highlightSeId = location.state?.highlightServicoExtraId;');
    expect(effectIndex).toBeGreaterThan(0);
    const effectSnippet = receitasPipelineContent.substring(effectIndex, effectIndex + 1200);

    expect(effectSnippet).toContain('setSelectedReceita(found)');
    expect(effectSnippet).not.toContain('rpc_');
    expect(effectSnippet).not.toContain('transicionarStatus');
  });
});

describe('FASE UX-2B.2 — Consistência de Serviços Extras e Padrões de Interação', () => {
  const tableBlockPath = path.resolve(__dirname, '../components/operacoes/ServicosExtrasTableBlock.tsx');
  const tableBlockContent = fs.readFileSync(tableBlockPath, 'utf-8');

  const drawerPath = path.resolve(__dirname, '../components/operacoes/ServicosExtrasContinuityDrawer.tsx');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

  const aprovacoesPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const aprovacoesContent = fs.readFileSync(aprovacoesPath, 'utf-8');

  it('1. Clique na linha (tr) abre o drawer via handleRowClick', () => {
    expect(tableBlockContent).toContain('onClick={() => handleRowClick(item)}');
    expect(tableBlockContent).toContain('esc-table-row cursor-pointer');
  });

  it('2. Clique na linha (handleRowClick) NÃO executa mutação no banco', () => {
    const fnIndex = tableBlockContent.indexOf('const handleRowClick = (item: ServicoExtraItem) => {');
    expect(fnIndex).toBeGreaterThan(0);
    const fnBody = tableBlockContent.substring(fnIndex, fnIndex + 800);

    expect(fnBody).toContain('openPipeline(');
    expect(fnBody).not.toContain('updatePipelineMutation');
    expect(fnBody).not.toContain('updateStatusMutation');
    expect(fnBody).not.toContain('deleteMutation');
  });

  it('3. Drawer possui título dinâmico "Serviço Registrado" para estágio 0 (PENDENTE)', () => {
    expect(drawerContent).toContain('title: "Serviço Registrado"');
    expect(drawerContent).toContain('subtitle: "Serviço extra capturado. Aguardando encaminhamento para validação operacional."');
  });

  it('4. Drawer possui título dinâmico "Serviço em Validação" para estágio 1 (EM_VALIDACAO)', () => {
    expect(drawerContent).toContain('title: "Serviço em Validação"');
    expect(drawerContent).toContain('subtitle: "Conferência técnica e validação dos dados operacionais em andamento."');
  });

  it('5. Drawer em EM_VALIDACAO (estágio 1) NÃO exibe "Serviço aprovado"', () => {
    expect(drawerContent).toContain('currentStageIndex === 1');
    expect(drawerContent).toContain('title: "Serviço aguardando validação técnica e operacional."');
    expect(drawerContent).toContain('O lançamento está em análise pela equipe operacional');
  });

  it('6. Drawer possui título "Serviço Aprovado" para estágio 2 (APROVADO_OPERACAO)', () => {
    expect(drawerContent).toContain('case 2:');
    expect(drawerContent).toContain('title: "Serviço Aprovado"');
    expect(drawerContent).toContain('subtitle: "Acompanhe a geração da receita e o encaminhamento financeiro."');
  });

  it('7. Modalidade CAIXA_IMEDIATO chega corretamente ao drawer via handleRowClick', () => {
    const fnIndex = tableBlockContent.indexOf('const handleRowClick = (item: ServicoExtraItem) => {');
    const fnBody = tableBlockContent.substring(fnIndex, fnIndex + 800);
    expect(fnBody).toContain('modalidade_financeira: item.modalidade_financeira');
    expect(fnBody).toContain('registroId: item.id');
    expect(fnBody).toContain('descricao: item.descricao_servico');
    expect(fnBody).toContain('valor: item.total !== null');
  });

  it('8. CAIXA_IMEDIATO é apresentado corretamente no drawer', () => {
    expect(drawerContent).toContain('case "CAIXA_IMEDIATO":');
    expect(drawerContent).toContain('label: "Caixa Imediato"');
    expect(drawerContent).toContain('Recebimento imediato gerado.');
  });

  it('9. Modalidade ausente continua explicitamente "Não determinada"', () => {
    expect(drawerContent).toContain('label: rawModalidade || "Não determinada"');
    expect(drawerContent).toContain('Destino financeiro não pôde ser determinado.');
  });

  it('10. Ação de editar possui stopPropagation e não abre drawer', () => {
    expect(tableBlockContent).toContain("const event = new CustomEvent('open-edit-servico-extra', { detail: item });");
    expect(tableBlockContent).toMatch(/onClick=\{\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\);\s*\/\/ Dispatch custom event/);
  });

  it('11. Ação de remover/excluir possui stopPropagation e não abre drawer', () => {
    expect(tableBlockContent).toContain("deleteMutation.mutate(item.id);");
    expect(tableBlockContent).toMatch(/onClick=\{\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\);\s*deleteMutation\.mutate\(item\.id\);/);
  });

  it('12. Ação explícita de avançar pipeline possui stopPropagation e não dispara rowClick duplicado', () => {
    expect(tableBlockContent).toMatch(/onClick=\{\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\);\s*handleAdvance\(item\);/);
  });

  it('13. Badges de pipeline em ServicosExtrasTableBlock não possuem emojis', () => {
    const cfgIndex = tableBlockContent.indexOf('const getPipelineStatusConfig = (status?: string | null) => {');
    const cfgEnd = tableBlockContent.indexOf('// ─── Component', cfgIndex);
    const cfgBody = tableBlockContent.substring(cfgIndex, cfgEnd);

    expect(cfgBody).not.toContain('🟡');
    expect(cfgBody).not.toContain('🟢');
    expect(cfgBody).not.toContain('🔵');
    expect(cfgBody).not.toContain('🟣');
    expect(cfgBody).not.toContain('💰');
    expect(cfgBody).not.toContain('⚫');
  });

  it('14. PENDENTE é apresentado com label "Recebido"', () => {
    const cfgIndex = tableBlockContent.indexOf('const getPipelineStatusConfig = (status?: string | null) => {');
    const cfgEnd = tableBlockContent.indexOf('// ─── Component', cfgIndex);
    const cfgBody = tableBlockContent.substring(cfgIndex, cfgEnd);

    expect(cfgBody).toContain('case "PENDENTE":');
    expect(cfgBody).toContain('return { label: "Recebido", className: "bg-amber-50 text-amber-700 border-amber-200"');
  });

  it('15. EM_VALIDACAO é apresentado com label "Em validação"', () => {
    const cfgIndex = tableBlockContent.indexOf('const getPipelineStatusConfig = (status?: string | null) => {');
    const cfgEnd = tableBlockContent.indexOf('// ─── Component', cfgIndex);
    const cfgBody = tableBlockContent.substring(cfgIndex, cfgEnd);

    expect(cfgBody).toContain('case "EM_VALIDACAO":');
    expect(cfgBody).toContain('return { label: "Em validação", className: "bg-cyan-50 text-cyan-700 border-cyan-200"');
  });

  it('16. EM_VALIDACAO não é classificado como Aprovado em AprovacoesRh', () => {
    const mapIndex = aprovacoesContent.indexOf('const situacaoMap = (status?: string): SituacaoItem => {');
    const mapEnd = aprovacoesContent.indexOf('const SITUACAO_COLORS', mapIndex);
    const mapBody = aprovacoesContent.substring(mapIndex, mapEnd);

    expect(mapBody).toContain('"EM_VALIDACAO"');
    // "EM_VALIDACAO" deve estar no array emAnalise
    const emAnaliseBlock = mapBody.substring(mapBody.indexOf('const emAnalise'), mapBody.indexOf('const aprovado'));
    expect(emAnaliseBlock).toContain('"EM_VALIDACAO"');

    // E NÃO deve estar no array aprovado
    const aprovadoBlock = mapBody.substring(mapBody.indexOf('const aprovado'));
    expect(aprovadoBlock).not.toContain('"EM_VALIDACAO"');
  });

  it('17. Fluxo pós-aprovação em AprovacoesRh continua invocando openPipeline com dados canônicos', () => {
    expect(aprovacoesContent).toContain('openPipeline(buildServicosExtrasPipeline({');
    expect(aprovacoesContent).toContain('currentStep: "aprovacao"');
    expect(aprovacoesContent).toContain('pipelineStatus: result?.pipeline_status || "APROVADO_OPERACAO"');
    expect(aprovacoesContent).toContain('modalidade_financeira: result?.modalidade_financeira');
  });

  it('18. Aprovação de Serviço Extra em AprovacoesRh utiliza coluna canônica total e não referencia valor_total', () => {
    const seAprovarBlock = aprovacoesContent.substring(
      aprovacoesContent.indexOf('if (item.tipo === "SERVIÇO EXTRA")'),
      aprovacoesContent.indexOf('// Operações por Volume')
    );

    // Deve selecionar o campo canônico total
    expect(seAprovarBlock).toContain('total');
    // NÃO deve selecionar valor_total na tabela servicos_extras_operacionais
    expect(seAprovarBlock).not.toContain('valor_total');
    // Garante que o retorno do drawer de continuidade usa result?.total
    expect(aprovacoesContent).toContain('valor: currentItem.valor || result?.total');
    expect(aprovacoesContent).not.toContain('result?.valor_total');
  });

  it('19. Reabertura de item SERVIÇO EXTRA aprovado em AprovacoesRh reconstrói ServicosExtrasContinuityDrawer canônico', () => {
    // 1. handleRowClick intercepta itens aprovados de Serviço Extra
    expect(aprovacoesContent).toContain('const handleRowClick = (item: ApprovalItem) => {');
    expect(aprovacoesContent).toContain('if (item.tipo === "SERVIÇO EXTRA" && isApproved)');
    expect(aprovacoesContent).toContain('openServicoExtraContinuity(item);');

    // 2. onRowClick usa handleRowClick
    expect(aprovacoesContent).toContain('onRowClick={handleRowClick}');

    // 3. openServicoExtraContinuity fecha o DetailPanel e consulta o registro persistido
    expect(aprovacoesContent).toContain('const openServicoExtraContinuity = async (item: ApprovalItem) => {');
    expect(aprovacoesContent).toContain('setActiveItem(null);');
    expect(aprovacoesContent).toContain('.from("servicos_extras_operacionais" as any)');
    expect(aprovacoesContent).toContain('.select("id, empresa_id, data, descricao_servico, total, modalidade_financeira, pipeline_status")');
    expect(aprovacoesContent).toContain('.eq("id", item.id)');

    // 4. Invoca buildServicosExtrasPipeline com dados persistidos
    expect(aprovacoesContent).toContain('openPipeline(');
    expect(aprovacoesContent).toContain('buildServicosExtrasPipeline({');
    expect(aprovacoesContent).toContain('currentStep: "aprovacao"');
    expect(aprovacoesContent).toContain('pipelineStatus,');
    expect(aprovacoesContent).toContain('modalidade_financeira: modalidade,');
    expect(aprovacoesContent).toContain('registroId: item.id,');
  });

  it('20. Reabertura de Serviço Extra aprovado com modalidade CAIXA_IMEDIATO preserva CTA e rota financeira contextual', () => {
    // Simula a derivação do pipeline para o cenário homologado reaberto
    const pipeline = buildServicosExtrasPipeline({
      competencia: '2026-09',
      empresa: 'BENEVIDES',
      currentStep: 'aprovacao',
      pipelineStatus: 'APROVADO_OPERACAO',
      modalidade_financeira: 'CAIXA_IMEDIATO',
      registroId: '3bd5ce80-7045-4877-bffa-1efe52206556',
      descricao: 'Homologação UX - Caixa Imediato',
      valor: 20,
      data: '2026-09-22',
    });

    // Validar etapas
    expect(pipeline.steps).toHaveLength(5);
    expect(pipeline.steps[0].status).toBe('done'); // Recebido
    expect(pipeline.steps[1].status).toBe('done'); // Em validação
    expect(pipeline.steps[2].status).toBe('current'); // Aprovado (Você está aqui)
    expect(pipeline.steps[3].status).toBe('pending'); // A receber / Faturamento
    expect(pipeline.steps[4].status).toBe('pending'); // Recebido

    // Validar CTA financeiro
    expect(pipeline.nextAction).toBeDefined();
    expect(pipeline.nextAction?.label).toBe('Continuar para Caixa Imediato →');
    expect(pipeline.context.fluxo).toBe('Serviços Extras');
    expect(pipeline.context.modalidade_financeira).toBe('CAIXA_IMEDIATO');

    const modalidadeRes = resolveServicoExtraModalidade('CAIXA_IMEDIATO');
    expect(modalidadeRes.route).toBe('/financeiro/receitas?tab=CAIXA_IMEDIATO&origem=SERVICO_EXTRA');
  });

  it('21. ModalReceitaOperacional utiliza padrão lateral Sheet/Drawer (UX-2B.9)', () => {
    const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    // 1. Usa componentes Sheet do design system
    expect(modalContent).toContain('import {');
    expect(modalContent).toContain('Sheet, SheetContent, SheetHeader, SheetTitle');
    expect(modalContent).toContain('@/components/ui/sheet');

    // 2. Não utiliza mais Dialog central
    expect(modalContent).not.toContain('@/components/ui/dialog');

    // 3. SheetContent configurado na lateral direita
    expect(modalContent).toContain('<Sheet open={isOpen} onOpenChange=');
    expect(modalContent).toContain('<SheetContent side="right"');

    // 4. Exporta também o alias canônico DrawerReceitaOperacional
    expect(modalContent).toContain('export const DrawerReceitaOperacional = ModalReceitaOperacional;');
  });

  it('22. ModalReceitaOperacional preserva abas via ReceitaDetalhesDrawer, resumo financeiro e ação Confirmar Recebimento (UX-2B.9 / UX-2B.12)', () => {
    const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');
    const detalhesPath = path.resolve(__dirname, '../pages/Financeiro/components/ReceitaDetalhesDrawer.tsx');
    const detalhesContent = fs.readFileSync(detalhesPath, 'utf-8');

    // 1. Abas preservadas no Drawer 2 especializado: Operacional / Documentos / Timeline
    expect(detalhesContent).toContain('<TabsTrigger value="detalhes">Operacional</TabsTrigger>');
    expect(detalhesContent).toContain('<TabsTrigger value="documentos">Documentos</TabsTrigger>');
    expect(detalhesContent).toContain('<TabsTrigger value="historico">Timeline</TabsTrigger>');

    // 2. Botão Confirmar Recebimento do Pagamento preservado no Drawer 1
    expect(modalContent).toContain('Confirmar Recebimento do Pagamento');

    // 3. Suporte aos dois tipos de origem de receita (Serviço Extra e Operação)
    expect(modalContent).toContain('Serviço Extra');
    expect(modalContent).toContain('Operação por Volume');
  });
});

describe('FASE UX-2B.10 — Padronização Visual do Drawer Financeiro (Design System de Continuidade)', () => {
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  const detalhesPath = path.resolve(__dirname, '../pages/Financeiro/components/ReceitaDetalhesDrawer.tsx');
  const detalhesContent = fs.readFileSync(detalhesPath, 'utf-8');

  it('23. Proporção e largura dos Drawers em camadas seguem padrão canônico do ORBE (UX-2B.10 / UX-2B.14)', () => {
    // Drawer 1 e Drawer 2 compartilham a largura canônica padronizada
    expect(detalhesContent).toContain('RECEITA_DRAWER_WIDTH_CLASS = "w-full sm:max-w-md md:max-w-[480px]"');
    expect(modalContent).toContain('RECEITA_DRAWER_WIDTH_CLASS');
    expect(modalContent).toContain('p-0 flex flex-col h-full bg-background border-l shadow-2xl');

    // Drawer 2 usa a mesma largura canônica e camada superior z-[60]
    expect(detalhesContent).toContain('RECEITA_DRAWER_WIDTH_CLASS');
    expect(detalhesContent).toContain('z-[60]');
  });

  it('24. Cabeçalho compacto apresenta tag de origem, título dinâmico e contextualização', () => {
    expect(modalContent).toContain('Continuidade Financeira');
    expect(modalContent).toContain('RECEITA / SERVIÇO EXTRA');
    expect(modalContent).toContain('RECEITA / OPERAÇÃO POR VOLUME');
    expect(modalContent).toContain('RECEITA / FATURAMENTO MENSAL');
    expect(modalContent).toContain('Receita — Caixa Imediato');
    expect(modalContent).toContain('Receita — Duplicata');
    expect(modalContent).toContain('Receita — Faturamento Mensal');
  });

  it('25. Card de Status contextual compactado em Status Bar de faixa única (UX-2B.13)', () => {
    expect(modalContent).toContain('statusSummary.cardBg');
    expect(modalContent).toContain('statusSummary.title');
    expect(modalContent).toContain('statusSummary.shortNote');
    expect(modalContent).toContain('Recebimento Pendente');
    expect(modalContent).toContain('Aguardando confirmação do recebimento imediato deste serviço extra');
  });

  it('26. Card de Dados Essenciais compacto com Grid 2 colunas', () => {
    expect(modalContent).toContain('Dados Essenciais da Receita');
    expect(modalContent).toContain('Cliente / Empresa');
    expect(modalContent).toContain('Competência / Vencimento');
    expect(modalContent).toContain('Valor Total da Receita');
    expect(modalContent).toContain('Modalidade Financeira');
  });

  it('27. Stepper visual canônico de continuidade com indicador "Você está aqui" e badges de estágio no Drawer 2 e resumo compacto no Drawer 1 (UX-2B.13)', () => {
    expect(modalContent).toContain('Fluxo da Receita Operacional');
    expect(modalContent).toContain('Ver fluxo completo');
    expect(modalContent).toContain('pipelineStages.map');
    expect(detalhesContent).toContain('TabsContent value="fluxo"');
    expect(detalhesContent).toContain('● Você está aqui');
    expect(detalhesContent).toContain('✓ Concluído');
    expect(detalhesContent).toContain('Pendente');
  });

  it('28. Próxima Ação contextual e CTA principal destacado', () => {
    expect(modalContent).toContain('Próxima Ação Financeira');
    expect(modalContent).toContain('Confirmar Recebimento do Pagamento');
  });

  it('29. Conteúdo secundário técnico encapsulado em Detalhes Complementares (Operacional, Documentos, Timeline) (UX-2B.10 / UX-2B.12)', () => {
    expect(modalContent).toContain('Detalhes Complementares da Operação');
    expect(modalContent).toContain('Ver Detalhes Completos (Operacional, Documentos, Timeline)');
    expect(detalhesContent).toContain('TabsContent value="detalhes"');
    expect(detalhesContent).toContain('TabsContent value="documentos"');
    expect(detalhesContent).toContain('TabsContent value="historico"');
  });

  it('30. Rodapé fixo de encerramento sem poluição visual', () => {
    expect(modalContent).toContain('ORBE Financeiro • Central de Receitas');
    expect(modalContent).toContain('Fechar');
  });
});

describe('FASE UX-2B.12 — Central de Receitas + Drawers em Camadas', () => {
  const pipelinePath = path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx');
  const pipelineContent = fs.readFileSync(pipelinePath, 'utf-8');
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  const detalhesPath = path.resolve(__dirname, '../pages/Financeiro/components/ReceitaDetalhesDrawer.tsx');
  const detalhesContent = fs.readFileSync(detalhesPath, 'utf-8');

  it('31. ReceitasPipeline.tsx exporta VIEW_MODE_STORAGE_KEY e define Lista como padrão', () => {
    expect(pipelineContent).toContain("export const VIEW_MODE_STORAGE_KEY = 'orbe.financeiro.receitas.viewMode'");
    expect(pipelineContent).toContain("const [viewMode, setViewMode] = useState<'list' | 'kanban'>");
    expect(pipelineContent).toContain("return 'list'; // Regra UX-2B.12: Lista deve ser o padrão");
  });

  it('32. ReceitasPipeline.tsx inclui seletor com botões Lista e Kanban', () => {
    expect(pipelineContent).toContain("handleViewModeChange('list')");
    expect(pipelineContent).toContain("handleViewModeChange('kanban')");
    expect(pipelineContent).toContain("<span>Lista</span>");
    expect(pipelineContent).toContain("<span>Kanban</span>");
  });

  it('33. Visualização em Lista implementa colunas mínimas e linha inteira clicável para abrir Drawer 1', () => {
    expect(pipelineContent).toContain("viewMode === 'list' ? (");
    expect(pipelineContent).toContain('>Data</th>');
    expect(pipelineContent).toContain('>Cliente</th>');
    expect(pipelineContent).toContain('>Origem</th>');
    expect(pipelineContent).toContain('>Competência / Vencimento</th>');
    expect(pipelineContent).toContain('>Modalidade</th>');
    expect(pipelineContent).toContain('>Valor</th>');
    expect(pipelineContent).toContain('>Status</th>');
    expect(pipelineContent).toContain('onClick={() => setSelectedReceita(r)}');
    expect(pipelineContent).toContain('cursor-pointer');
  });

  it('34. Arquitetura de Drawers em Camadas (Drawer 1 compacto + Drawer 2 especializado sobreposto)', () => {
    // Drawer 1 dispara Drawer 2
    expect(modalContent).toContain('setIsDetalhesOpen(true)');
    expect(modalContent).toContain('<ReceitaDetalhesDrawer');
    expect(modalContent).toContain('isOpen={isDetalhesOpen}');
    expect(modalContent).toContain('onClose={() => setIsDetalhesOpen(false)}');

    // Drawer 2 tem sobreposição z-[60] e botão de retorno
    expect(detalhesContent).toContain('z-[60]');
    expect(detalhesContent).toContain('Voltar ao Fluxo');
  });

  it('35. Registro de homologação preservado (não mutado)', () => {
    // Garantia estática de que o ID de homologação 3bd5ce80 não está hardcoded para mutação direta
    expect(modalContent).not.toContain('3bd5ce80-7045-4877-bffa-1efe52206556');
    expect(pipelineContent).not.toContain('3bd5ce80-7045-4877-bffa-1efe52206556');
  });

  it('36. Badge está devidamente importado em ReceitasPipeline.tsx', () => {
    expect(pipelineContent).toMatch(/import\s*\{[^}]*Badge[^}]*\}\s*from\s*["']@\/components\/ui\/badge["']/);
  });

  it('37. documentosGerados está devidamente declarado e memorizado em ModalReceitaOperacional.tsx', () => {
    expect(modalContent).toContain('const documentosGerados = useMemo(');
    expect(modalContent).toContain('documentosGerados={documentosGerados}');
  });
});

describe('FASE UX-2B.13 — Pipeline Compacto no Drawer 1 e Detalhado no Drawer 2', () => {
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  const detalhesPath = path.resolve(__dirname, '../pages/Financeiro/components/ReceitaDetalhesDrawer.tsx');
  const detalhesContent = fs.readFileSync(detalhesPath, 'utf-8');

  it('38. Pipeline vertical detalhado com descrições e responsáveis não está mais no Drawer 1', () => {
    expect(modalContent).not.toContain('● Você está aqui');
    expect(modalContent).not.toContain('stage.responsible');
    expect(modalContent).not.toContain('min-h-[28px]');
  });

  it('39. Resumo compacto do pipeline está presente e é interativo/clicável no topo do Drawer 1', () => {
    expect(modalContent).toContain('Fluxo da Receita Operacional');
    expect(modalContent).toContain('Ver fluxo completo');
    expect(modalContent).toContain("setDetalhesInitialTab('fluxo')");
    expect(modalContent).toContain('setIsDetalhesOpen(true)');
  });

  it('40. Clique no resumo compacto abre Drawer 2 com aba de fluxo ativo', () => {
    expect(modalContent).toContain("<ReceitaDetalhesDrawer");
    expect(modalContent).toContain("initialTab={detalhesInitialTab}");
    expect(modalContent).toContain("pipelineStages={pipelineStages}");
    expect(detalhesContent).toContain('TabsContent value="fluxo"');
    expect(detalhesContent).toContain('● Você está aqui');
    expect(detalhesContent).toContain('stage.responsible');
  });

  it('41. Fechar o segundo nível (Drawer 2) preserva Drawer 1 e todo o contexto financeiro', () => {
    expect(detalhesContent).toContain('Voltar ao Fluxo');
    expect(modalContent).toContain('onClose={() => setIsDetalhesOpen(false)}');
    expect(modalContent).toContain('Confirmar Recebimento do Pagamento');
  });

  it('42. Ver Detalhes Completos continua funcionando no mesmo segundo nível (Drawer 2) via aba de detalhes', () => {
    expect(modalContent).toContain("setDetalhesInitialTab('detalhes')");
    expect(modalContent).toContain('Ver Detalhes Completos (Operacional, Documentos, Timeline)');
    expect(detalhesContent).toContain('TabsTrigger value="detalhes"');
    expect(detalhesContent).toContain('TabsTrigger value="fluxo"');
    expect(detalhesContent).toContain('TabsContent value="detalhes"');
  });

  it('43. Status bar do Drawer 1 é compacta (min-h-[48px]) em faixa única sem parágrafo explicativo longo', () => {
    expect(modalContent).toContain('min-h-[48px]');
    expect(modalContent).toContain('statusSummary.shortNote');
    expect(modalContent).not.toContain('<p className="text-[11px] leading-relaxed text-muted-foreground">\n                                    {statusSummary.description}');
  });

  it('44. Drawer 1 e Drawer 2 compartilham a mesma largura canônica padronizada (UX-2B.14)', () => {
    expect(detalhesContent).toContain('export const RECEITA_DRAWER_WIDTH_CLASS = "w-full sm:max-w-md md:max-w-[480px]"');
    expect(modalContent).toContain('RECEITA_DRAWER_WIDTH_CLASS');
    expect(modalContent).toContain('cn(RECEITA_DRAWER_WIDTH_CLASS');
    expect(detalhesContent).toContain('cn(RECEITA_DRAWER_WIDTH_CLASS');
    expect(detalhesContent).not.toContain('md:max-w-2xl');
  });

  it('45. Pipeline compacto no Drawer 1 não usa overflow-x-auto e suporta adaptação responsiva (UX-2B.14)', () => {
    expect(modalContent).not.toContain('overflow-x-auto');
    expect(modalContent).toContain('stage.compactLabel');
    expect(modalContent).toContain('flex-wrap sm:flex-nowrap');
    expect(modalContent).toContain('Ver fluxo completo');
  });

  it('46. Pipeline detalhado completo continua exclusivamente no Drawer 2 na aba de fluxo (UX-2B.14)', () => {
    expect(modalContent).not.toContain('● Você está aqui');
    expect(modalContent).not.toContain('stage.responsible');
    expect(detalhesContent).toContain('● Você está aqui');
    expect(detalhesContent).toContain('stage.responsible');
    expect(detalhesContent).toContain('TabsContent value="fluxo"');
  });
});





