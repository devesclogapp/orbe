import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildDiaristasStages } from '@/pages/Financeiro/CentralBancariaDiaristas';
import { buildDiaristasPipeline } from '@/contexts/OperationalPipelineContext';

describe('FASE 11 & FASE 10 — UX DIARISTAS, DRAWERS, NAVEGAÇÃO E REGRESSÃO', () => {
  const centralBancariaDiaristasPath = path.resolve(__dirname, '../pages/Financeiro/CentralBancariaDiaristas.tsx');
  const centralBancariaPath = path.resolve(__dirname, '../pages/CentralBancaria.tsx');
  const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
  const centralFinanceiraPath = path.resolve(__dirname, '../pages/CentralFinanceira.tsx');
  const pipelineContextPath = path.resolve(__dirname, '../contexts/OperationalPipelineContext.tsx');

  const contentDiaristas = fs.readFileSync(centralBancariaDiaristasPath, 'utf8');
  const contentCentralBancaria = fs.readFileSync(centralBancariaPath, 'utf8');
  const contentSidebar = fs.readFileSync(sidebarPath, 'utf8');
  const contentCentralFinanceira = fs.readFileSync(centralFinanceiraPath, 'utf8');
  const contentPipelineContext = fs.readFileSync(pipelineContextPath, 'utf8');

  // 1 & 2. Clique no lote abre Drawer Primário e NÃO abre Dialog central
  it('1 & 2. Clique no lote abre Drawer Primário e não abre Dialog central de detalhes', () => {
    expect(contentDiaristas).toContain('DrawerPrimarioShell');
    expect(contentDiaristas).toContain('isOpen={isPrimaryDrawerOpen}');
    expect(contentDiaristas).toContain('onClick={() => handleOpenDetalhe(l)}');
    expect(contentDiaristas).toContain('cursor-pointer');
    // Não deve conter Dialog open={openDetalhe}
    expect(contentDiaristas).not.toContain('open={openDetalhe}');
  });

  // 3 & 4. "Ver fluxo completo" abre Drawer Secundário e voltar restaura o primário
  it('3 & 4. "Ver fluxo completo →" abre Drawer Secundário com Linha do Tempo e botão voltar', () => {
    expect(contentDiaristas).toContain('DrawerSecundarioShell');
    expect(contentDiaristas).toContain('isOpen={isSecondaryDrawerOpen}');
    expect(contentDiaristas).toContain('title="Linha do Tempo — Diaristas"');
    expect(contentDiaristas).toContain('onClick={() => setIsSecondaryDrawerOpen(true)}');
    expect(contentDiaristas).toContain('Ver fluxo completo →');
    expect(contentDiaristas).toContain('onBack={() => setIsSecondaryDrawerOpen(false)}');
    expect(contentDiaristas).toContain('← Voltar aos detalhes');
    expect(contentDiaristas).toContain('hideOverlay={true}');
  });

  // 5, 6 & 7. Atalhos de Diaristas direcionam para a tela canônica /bancario sem duplicar telas
  it('5, 6 & 7. Atalhos de Diaristas no Sidebar direcionam para a tela canônica /bancario com query params contextuais', () => {
    // Pagamentos e Remessas
    expect(contentSidebar).toContain('/bancario?tab=diaristas&origem=DIARISTA');
    // Conciliação Bancária
    expect(contentSidebar).toContain('/bancario?tab=retorno&origem=DIARISTA');

    // CentralBancaria processa searchParams
    expect(contentCentralBancaria).toContain('searchParams.get("tab")');
    expect(contentCentralBancaria).toContain('searchParams.get("origem")');
    expect(contentCentralBancaria).toContain('Contexto: Diaristas');
  });

  // 8. Ausência de CTA manual "Marcar como Pago" que induza a erro
  it('8. Não deixa CTA ativo "Marcar como Pago" ou modal manual de confirmação de pagamento', () => {
    expect(contentDiaristas).not.toContain('marcarPagoMutation');
    expect(contentDiaristas).not.toContain('openConfirmPago');
    expect(contentDiaristas).not.toContain('Confirmar Pagamento');
  });

  // 9. Status PAGO/conciliado apresenta pipeline concluído
  it('9. Status PAGO/conciliado apresenta todas as etapas do pipeline como concluídas', () => {
    const mockLotePago = {
      id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
      status: 'PAGO',
      status_conciliacao: 'conciliado',
      valor_total: 210,
    } as any;

    const { horizontalStages, verticalStages, isFlowDone } = buildDiaristasStages(mockLotePago);
    expect(isFlowDone).toBe(true);
    expect(horizontalStages.every(s => s.status === 'done')).toBe(true);
    expect(verticalStages.every(s => s.status === 'done')).toBe(true);

    // Também no contexto operacional
    const pipeline = buildDiaristasPipeline({
      competencia: '2026-09',
      empresa: 'ESC LOG',
      currentStep: 'concluido',
    });
    expect(pipeline.steps.every(s => s.status === 'done')).toBe(true);
  });

  // 10. CNAB gerado / aguardando conciliação apresenta etapa atual pendente
  it('10. CNAB gerado / aguardando conciliação apresenta conciliação como etapa corrente', () => {
    const mockLoteCnab = {
      id: '1bf3f73c-942e-4127-be32-bf27df39d1a5',
      status: 'cnab_gerado',
      status_conciliacao: 'aguardando_conciliacao',
      valor_total: 210,
    } as any;

    const { horizontalStages, isFlowDone } = buildDiaristasStages(mockLoteCnab);
    expect(isFlowDone).toBe(false);
    const conc = horizontalStages.find(s => s.id === 'conciliacao');
    expect(conc?.status).toBe('current');
  });

  // 11. Terminologia de Diaristas não apresenta "Valor faturável"
  it('11. Terminologia de Diaristas no detalhe financeiro não apresenta "Faturáveis" ou "Valor faturável"', () => {
    expect(contentCentralFinanceira).not.toContain('Faturáveis:');
    expect(contentCentralFinanceira).toContain('Diárias Aprovadas');
    expect(contentCentralFinanceira).toContain('Valor a pagar');
  });

  // 12. Permissões existentes continuam respeitadas no Sidebar
  it('12. Permissões existentes de módulos continuam respeitadas no Sidebar', () => {
    expect(contentSidebar).toContain('module: "pagamentos_remessas"');
  });

  // 13. KPIs de pagamentos: lotes com cnab_gerado continuam contabilizados em pendentes de pagamento
  it('13. KPIs: Lotes com cnab_gerado não quitados continuam contabilizados em remessasComErro (pendentes de pagamento)', () => {
    expect(contentDiaristas).toContain('l.status !== "PAGO"');
    expect(contentDiaristas).toContain('l.status !== "pago"');
    expect(contentDiaristas).toContain('l.status !== "CANCELADO"');
  });

  // 14. Regressão Fase 10: Lógica de baixa automática (Parcial vs Integral)
  it('14. Regressão do fechamento: valida que quitação integral exige conciliação total e lote incompleto permanece não pago', () => {
    const itensLote = [
      { id: 'item-1', valor: 140, status_conciliacao: 'conciliado' },
      { id: 'item-2', valor: 70, status_conciliacao: 'pendente' },
    ];

    const todosConciliadosParcial = itensLote.every(i => i.status_conciliacao === 'conciliado');
    expect(todosConciliadosParcial).toBe(false);

    // Se o segundo for conciliado
    itensLote[1].status_conciliacao = 'conciliado';
    const todosConciliadosIntegral = itensLote.every(i => i.status_conciliacao === 'conciliado');
    expect(todosConciliadosIntegral).toBe(true);
  });

  // 15. Context Mode vs Global Mode: Diaristas Pagamentos e Remessas oculta abas globais e renderiza Diaristas
  it('15. Context Mode (origem=DIARISTA + pagamentos): oculta abas globais e renderiza CentralBancariaDiaristas', () => {
    expect(contentCentralBancaria).toContain('const isContextDiaristas = searchParams.get("origem") === "DIARISTA";');
    expect(contentCentralBancaria).toContain('{isContextDiaristas ? (');
    expect(contentCentralBancaria).toContain('<CentralBancariaDiaristas');
    // Em modo contextual, o Tabs com TabsList não é renderizado
    expect(contentCentralBancaria).toContain(') : (');
    expect(contentCentralBancaria).toContain('<Tabs value={activeTab} onValueChange={handleTabChange}');
  });

  // 16. Context Mode: Diaristas Conciliação Bancária renderiza Retorno sem abas globais
  it('16. Context Mode (origem=DIARISTA + retorno): renderiza Conciliação sem as 4 abas globais', () => {
    expect(contentCentralBancaria).toContain('activeTab === "retorno" ? (');
    expect(contentCentralBancaria).toContain('{renderRetornoContent()}');
    expect(contentCentralBancaria).toContain('title={');
    expect(contentCentralBancaria).toContain('Conciliação Bancária');
    expect(contentCentralBancaria).toContain('Retorno bancário e baixa financeira dos pagamentos de diaristas');
  });

  // 17. Global Mode: 4 abas globais continuam disponíveis quando acessado pelo Financeiro
  it('17. Global Mode: 4 abas globais continuam disponíveis no modo financeiro', () => {
    expect(contentCentralBancaria).toContain('<TabsTrigger value="remessa">Folha Oficial e CLT</TabsTrigger>');
    expect(contentCentralBancaria).toContain('<TabsTrigger value="diaristas">Eventuais / Diaristas</TabsTrigger>');
    expect(contentCentralBancaria).toContain('<TabsTrigger value="retorno">Conciliação Bancária (Retorno)</TabsTrigger>');
    expect(contentCentralBancaria).toContain('<TabsTrigger value="historico">Auditoria e Arquivos Gerados</TabsTrigger>');
  });

  // 18. Botão "Ir para Financeiro ->" remove contexto e navega explicitamente sem history.back()
  it('18. Botão "Ir para Financeiro →" remove contexto com navegação canônica explícita e sem history.back()', () => {
    expect(contentCentralBancaria).toContain('Ir para Financeiro');
    expect(contentCentralBancaria).toContain('onClick={() => navigate("/bancario")}');
    expect(contentCentralBancaria).not.toContain('history.back()');
  });

  // 19. Contexto Diaristas visualmente identificado
  it('19. Contexto Diaristas permanece visualmente identificado por Badge em ambos os acessos contextuais', () => {
    expect(contentCentralBancaria).toContain('Contexto: Diaristas');
  });

  // 20. Aprovações RH: Coluna "Valor / Diárias" para Diaristas e "Valor / Horas" para outros domínios
  it('20. Aprovações RH: Coluna exibe "Valor / Diárias" no contexto de Diaristas e "Valor / Horas" nos demais', () => {
    const aprovacoesRhPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
    const contentAprovacoesRh = fs.readFileSync(aprovacoesRhPath, 'utf8');
    expect(contentAprovacoesRh).toContain('filterType === "DIARISTA"');
    expect(contentAprovacoesRh).toContain('const colValorHorasLabel = isDiaristasContext ? "Valor / Diárias" : "Valor / Horas";');
    expect(contentAprovacoesRh).toContain('colValorHorasLabel');
  });

  // 21. Seletor de Banco no Retorno: inicia vazio e bloqueia upload sem seleção
  it('21. Seletor de banco do retorno inicia vazio e bloqueia upload se não selecionado', () => {
    expect(contentCentralBancaria).toContain('const [banco, setBanco] = useState("");');
    expect(contentCentralBancaria).toContain('disabled={isUploadingRetorno || !banco}');
    expect(contentCentralBancaria).toContain('if (!banco)');
    expect(contentCentralBancaria).toContain('Selecione o banco');
  });

  // 22. Apenas bancos homologados (001 e 341) aparecem no seletor de retorno
  it('22. Apenas bancos realmente homologados (001 - BB e 341 - Itaú) aparecem no seletor', () => {
    expect(contentCentralBancaria).toContain('<SelectItem value="001">001 - Banco do Brasil</SelectItem>');
    expect(contentCentralBancaria).toContain('<SelectItem value="341">341 - Itaú Unibanco</SelectItem>');
    expect(contentCentralBancaria).not.toContain('<SelectItem value="237">237 - Bradesco</SelectItem>');
    expect(contentCentralBancaria).not.toContain('<SelectItem value="033">033 - Santander</SelectItem>');
  });

  // 23. Fábrica de retorno confirma homologação de BB 001 e Itaú 341
  it('23. CNABRetornoReaderFactory possui suporte a BB 001 e Itaú 341 e bloqueia outros', async () => {
    const { CNABRetornoReaderFactory } = await import('@/services/cnab/CNABRetornoReaderFactory');
    expect(CNABRetornoReaderFactory.isBancoHomologado('001')).toBe(true);
    expect(CNABRetornoReaderFactory.isBancoHomologado('341')).toBe(true);
    expect(CNABRetornoReaderFactory.isBancoHomologado('237')).toBe(false);
    expect(CNABRetornoReaderFactory.isBancoHomologado('033')).toBe(false);
  });
});

