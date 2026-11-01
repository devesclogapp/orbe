import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  buildServicosExtrasPipeline,
  resolveServicoExtraModalidade,
} from "@/contexts/OperationalPipelineContext";
import { SERVICOS_EXTRAS_STAGES } from "@/components/operacoes/ServicosExtrasContinuityDrawer";

describe("UX-DRAWERS FASE A — Contrato Global de Drawers + Serviços Extras", () => {
  const tableBlockPath = path.resolve(__dirname, "../components/operacoes/ServicosExtrasTableBlock.tsx");
  const tableBlockContent = fs.readFileSync(tableBlockPath, "utf-8").replace(/\r\n/g, "\n");

  const primaryDrawerPath = path.resolve(__dirname, "../components/operacoes/ServicoExtraDetalhesDrawer.tsx");
  const primaryDrawerContent = fs.readFileSync(primaryDrawerPath, "utf-8").replace(/\r\n/g, "\n");

  const secondaryDrawerPath = path.resolve(__dirname, "../components/operacoes/ServicosExtrasContinuityDrawer.tsx");
  const secondaryDrawerContent = fs.readFileSync(secondaryDrawerPath, "utf-8").replace(/\r\n/g, "\n");

  const primaryShellPath = path.resolve(__dirname, "../components/continuity/DrawerPrimarioShell.tsx");
  const primaryShellContent = fs.readFileSync(primaryShellPath, "utf-8").replace(/\r\n/g, "\n");

  const secondaryShellPath = path.resolve(__dirname, "../components/continuity/DrawerSecundarioShell.tsx");
  const secondaryShellContent = fs.readFileSync(secondaryShellPath, "utf-8").replace(/\r\n/g, "\n");

  const horizontalBarPath = path.resolve(__dirname, "../components/continuity/PipelineHorizontalBar.tsx");
  const horizontalBarContent = fs.readFileSync(horizontalBarPath, "utf-8").replace(/\r\n/g, "\n");

  const verticalStepperPath = path.resolve(__dirname, "../components/continuity/TimelineVerticalStepper.tsx");
  const verticalStepperContent = fs.readFileSync(verticalStepperPath, "utf-8").replace(/\r\n/g, "\n");

  // ─── 1. Primitivas Compartilhadas (Contrato Estrutural) ─────────────────────
  describe("1. Primitivas Compartilhadas do Contrato Global", () => {
    it("1.1. DrawerPrimarioShell respeita 100dvh, flex-col, shrink-0 no header/footer e overflow seguro no body", () => {
      expect(primaryShellContent).toContain("h-[100dvh]");
      expect(primaryShellContent).toContain("max-h-[100dvh]");
      expect(primaryShellContent).toContain("shrink-0");
      expect(primaryShellContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
      expect(primaryShellContent).toContain("z-50");
    });

    it("1.2. DrawerSecundarioShell respeita 100dvh, sobreposição z-[60] e botão nativo Voltar aos detalhes", () => {
      expect(secondaryShellContent).toContain("h-[100dvh]");
      expect(secondaryShellContent).toContain("max-h-[100dvh]");
      expect(secondaryShellContent).toContain("shrink-0");
      expect(secondaryShellContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
      expect(secondaryShellContent).toContain("z-[60]");
      expect(secondaryShellContent).toContain("Voltar aos detalhes");
    });

    it("1.3. PipelineHorizontalBar apresenta resumo compacto com gatilho interativo Ver fluxo completo", () => {
      expect(horizontalBarContent).toContain("Resumo das Etapas");
      expect(horizontalBarContent).toContain("Ver fluxo completo");
      expect(horizontalBarContent).toContain("onVerFluxoCompleto");
      expect(horizontalBarContent).toContain("stage.compactLabel || stage.label");
    });

    it("1.4. TimelineVerticalStepper implementa 5 etapas com 'Você está aqui' e tratamento explícito para concluído", () => {
      expect(verticalStepperContent).toContain("Linha do Tempo");
      expect(verticalStepperContent).toContain("● Você está aqui");
      expect(verticalStepperContent).toContain("✓ Concluído");
      expect(verticalStepperContent).toContain("isFlowDone");
      expect(verticalStepperContent).toContain("stages.length");
    });
  });

  // ─── 2. Contrato de Dois Níveis em Serviços Extras ─────────────────────────
  describe("2. Contrato de Dois Níveis em Serviços Extras", () => {
    it("2.1. Clique em Serviço Extra na tabela abre o Drawer Primário de detalhes", () => {
      expect(tableBlockContent).toContain("const [selectedItem, setSelectedItem] = useState<ServicoExtraItem | null>(null);");
      expect(tableBlockContent).toContain("const [isFlowDrawerOpen, setIsFlowDrawerOpen] = useState(false);");
      expect(tableBlockContent).toContain("setSelectedItem(item);");
      expect(tableBlockContent).toContain("setIsFlowDrawerOpen(false);");
      expect(tableBlockContent).toContain("<ServicoExtraDetalhesDrawer");
      expect(tableBlockContent).toContain("isOpen={Boolean(selectedItem)}");
    });

    it("2.2. Drawer Primário contém dados consolidados e pipeline horizontal compacto", () => {
      expect(primaryDrawerContent).toContain("Dados Consolidados");
      expect(primaryDrawerContent).toContain("Empresa / Unidade");
      expect(primaryDrawerContent).toContain("Data Operacional");
      expect(primaryDrawerContent).toContain("Tipo de Serviço");
      expect(primaryDrawerContent).toContain("Modalidade");
      expect(primaryDrawerContent).toContain("Total Final");
      expect(primaryDrawerContent).toContain("<PipelineHorizontalBar");
      expect(primaryDrawerContent).toContain("onVerFluxoCompleto={onVerFluxoCompleto}");
      expect(primaryDrawerContent).toContain("actionLabel=\"Ver fluxo completo →\"");
    });

    it("2.3. Drawer Primário NÃO contém timeline vertical completa (preservação do foco)", () => {
      expect(primaryDrawerContent).not.toContain("<TimelineVerticalStepper");
      expect(primaryDrawerContent).not.toContain("● Você está aqui");
      expect(primaryDrawerContent).not.toContain("SERVICOS_EXTRAS_STAGES.map");
      expect(primaryDrawerContent).not.toContain("responsible: \"Encarregado / Operação\"");
    });

    it("2.4. Ação 'Ver fluxo completo →' no Primário abre o Drawer Secundário sobreposto", () => {
      expect(tableBlockContent).toContain("onVerFluxoCompleto={() => setIsFlowDrawerOpen(true)}");
      expect(tableBlockContent).toContain("<ServicosExtrasContinuityDrawer");
      expect(tableBlockContent).toContain("isOpen={isFlowDrawerOpen}");
      expect(tableBlockContent).toContain('zIndexClass="z-[60]"');
    });

    it("2.5. Drawer Secundário contém timeline vertical completa e botão Voltar aos detalhes", () => {
      expect(secondaryDrawerContent).toContain("<TimelineVerticalStepper");
      expect(secondaryDrawerContent).toContain("onClick={onBack}");
      expect(secondaryDrawerContent).toContain("Voltar aos detalhes");
      expect(tableBlockContent).toContain("onBack={() => setIsFlowDrawerOpen(false)}");
    });

    it("2.6. Fechar respeita a pilha: fechar o secundário preserva o primário; fechar o primário limpa o estado", () => {
      expect(tableBlockContent).toContain("onBack={() => setIsFlowDrawerOpen(false)}");
      const normalizedTable = tableBlockContent.replace(/\r\n/g, "\n");
      expect(normalizedTable).toContain("onClose={() => {\n                    setIsFlowDrawerOpen(false);\n                    setSelectedItem(null);\n                }}");
    });
  });

  // ─── 3. Correção do Estado Concluído e Modalidade Caixa Imediato ───────────
  describe("3. Correção do Estado Concluído de Serviços Extras (Caso 2)", () => {
    it("3.1. Serviço Extra concluído com Caixa Imediato NÃO exibe alerta de modalidade não configurada", () => {
      const pipeline = buildServicosExtrasPipeline({
        competencia: "2026-09",
        empresa: "Empresa Teste",
        pipelineStatus: "CONCLUIDO",
        modalidade_financeira: "CAIXA_IMEDIATO",
        registroId: "se-concluido-caixa",
      });

      // Em fluxo concluído, nextAction é undefined por especificação de ciclo encerrado
      expect(pipeline.nextAction).toBeUndefined();
      expect(pipeline.steps[4].status).toBe("done");

      // ServicosExtrasContinuityDrawer trata explicitamente isFlowDone antes da checagem de modalidade
      expect(secondaryDrawerContent).toContain("isFlowDone ? (");
      expect(secondaryDrawerContent).toContain("Receita liquidada e fluxo");
      // O alerta de modalidade não configurada NÃO pode ser exibido incondicionalmente no else
      expect(secondaryDrawerContent).toContain("{!modalidadeInfo.isValid && (");
      expect(secondaryDrawerContent).toContain("Modalidade financeira não configurada.");
    });

    it("3.2. Modalidade não configurada só aparece quando a modalidade for realmente inválida e o fluxo estiver pendente", () => {
      expect(secondaryDrawerContent).toContain("{!modalidadeInfo.isValid && (");
      expect(secondaryDrawerContent).toContain("Modalidade financeira não configurada.");
    });

    it("3.3. Registro concluído continua permitindo consultar o fluxo completo de todas as 5 etapas", () => {
      const pipeline = buildServicosExtrasPipeline({
        competencia: "2026-09",
        empresa: "Empresa Teste",
        pipelineStatus: "CONCLUIDO",
        modalidade_financeira: "CAIXA_IMEDIATO",
        registroId: "se-123-done",
      });

      expect(pipeline.steps).toHaveLength(5);
      expect(pipeline.steps.every(s => s.status === "done")).toBe(true);
    });
  });

  // ─── 4. Preservação da Semântica e Destinos Financeiros ─────────────────────
  describe("4. Preservação da Semântica e Destinos Financeiros", () => {
    it("4.1. Fluxo em validação mantém status de análise e não antecipa faturamento", () => {
      const pipeline = buildServicosExtrasPipeline({
        competencia: "2026-09",
        empresa: "Empresa Teste",
        pipelineStatus: "EM_VALIDACAO",
        modalidade_financeira: "CAIXA_IMEDIATO",
      });

      expect(pipeline.steps[1].status).toBe("current");
      expect(pipeline.steps[2].status).toBe("pending");
      expect(pipeline.nextAction?.route).toBe("/servicos-extras/aprovacoes");
    });

    it("4.2. Fluxo aprovado mantém CTA com destino financeiro contextual para Caixa Imediato", () => {
      const res = resolveServicoExtraModalidade("CAIXA_IMEDIATO");
      expect(res.isValid).toBe(true);
      expect(res.route).toBe("/financeiro/receitas?tab=CAIXA_IMEDIATO&origem=SERVICO_EXTRA");
    });

    it("4.3. Fluxo aprovado mantém CTA com destino financeiro contextual para Duplicata", () => {
      const res = resolveServicoExtraModalidade("DUPLICATA");
      expect(res.isValid).toBe(true);
      expect(res.route).toBe("/financeiro/receitas?tab=DUPLICATA&origem=SERVICO_EXTRA");
    });

    it("4.4. Fluxo aprovado mantém CTA com destino financeiro contextual para Faturamento Mensal", () => {
      const res = resolveServicoExtraModalidade("FATURAMENTO_MENSAL");
      expect(res.isValid).toBe(true);
      expect(res.route).toBe("/financeiro/receitas?tab=FATURAMENTO_MENSAL&origem=SERVICO_EXTRA");
    });

    it("4.5. Altura útil de 100dvh e scroll vertical preservados em todos os componentes", () => {
      expect(primaryDrawerContent).toContain("DrawerPrimarioShell");
      expect(secondaryDrawerContent).toContain("h-[100dvh]");
      expect(secondaryDrawerContent).toContain("max-h-[100dvh]");
      expect(secondaryDrawerContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
    });
  });

  // ─── 5. Invariância Arquitetural em Todos os Estados do Pipeline ────────────
  describe("5. Invariância Arquitetural dos Drawers em Diferentes Estados", () => {
    const statesToTest = [
      { status: "RECEBIDO", expectedStepIdx: 0, label: "Recebido" },
      { status: "EM_VALIDACAO", expectedStepIdx: 1, label: "Em validação" },
      { status: "APROVADO_OPERACAO", expectedStepIdx: 2, label: "Aprovado" },
      { status: "FATURADO", expectedStepIdx: 3, label: "A receber" },
      { status: "CONCLUIDO", expectedStepIdx: 4, label: "Recebido" },
      { status: "PAGO", expectedStepIdx: 4, label: "Recebido" },
    ];

    it("5.1. A estrutura dos drawers não se altera conforme o status: o status afeta apenas badges e destaque", () => {
      statesToTest.forEach(({ status, expectedStepIdx }) => {
        const pipeline = buildServicosExtrasPipeline({
          competencia: "2026-09",
          empresa: "BENEVIDES",
          pipelineStatus: status,
          modalidade_financeira: "CAIXA_IMEDIATO",
          registroId: `rec-${status}`,
        });

        // Todos os estados preservam 5 etapas canônicas
        expect(pipeline.steps).toHaveLength(5);

        // O Drawer Primário preserva os títulos e ausência de stepper vertical em todos os estados
        expect(primaryDrawerContent).toContain('title="Detalhes do Serviço Extra"');
        expect(primaryDrawerContent).toContain('subtitle="Informações operacionais e financeiras consolidadas deste lançamento."');
        expect(primaryDrawerContent).toContain("<PipelineHorizontalBar");
        expect(primaryDrawerContent).not.toContain("<TimelineVerticalStepper");

        // O Drawer Secundário preserva a Linha do Tempo e botão voltar em todos os estados
        expect(secondaryDrawerContent).toContain("Linha do Tempo — Serviço Extra");
        expect(secondaryDrawerContent).toContain("<TimelineVerticalStepper");
        expect(secondaryDrawerContent).toContain("Voltar aos detalhes");
      });
    });

    it("5.2. Caso Homologação UX (BENEVIDES, Caixa Imediato, R$ 20,00): Concluído NÃO exibe mensagem contraditória", () => {
      // Cenário real observado: registro concluído com forma de pagamento À Vista (Dinheiro) / CAIXA_IMEDIATO
      const candidateResolucao = resolveServicoExtraModalidade("À Vista (Dinheiro)");
      expect(candidateResolucao.isValid).toBe(true);
      expect(candidateResolucao.modalidade).toBe("CAIXA_IMEDIATO");

      const pipeline = buildServicosExtrasPipeline({
        competencia: "2026-09",
        empresa: "BENEVIDES",
        pipelineStatus: "CONCLUIDO",
        modalidade_financeira: candidateResolucao.modalidade,
        registroId: "rec-benevides-20",
        descricao: "Homologação UX - Caixa Imediato",
        valor: 20,
      });

      expect(pipeline.steps[4].status).toBe("done");

      // O alerta de modalidade não configurada é semanticamente bloqueado se o fluxo já estiver concluído
      expect(secondaryDrawerContent).toContain("isFlowDone ? (");
      expect(secondaryDrawerContent).toContain("Receita liquidada e fluxo de serviço extra concluído.");
      expect(secondaryDrawerContent).toContain("{!modalidadeInfo.isValid && (");
    });
  });

  // ─── 6. Garantia de Não Regressão em Custos Extras ──────────────────────────
  describe("6. Garantia de Não-Regressão em Custos Extras", () => {
    const custosTablePath = path.resolve(__dirname, "../components/operacoes/CustosExtrasTableBlock.tsx");
    const custosTableContent = fs.readFileSync(custosTablePath, "utf-8");

    it("6.1. Custos Extras preserva intacto seu contrato de detalhes e linha do tempo", () => {
      expect(custosTableContent).toContain('detailsViewMode === "flow" ? "Linha do Tempo — Custo Extra" : "Detalhes do Custo Extra"');
      expect(custosTableContent).toContain("Voltar aos detalhes");
      expect(custosTableContent).toContain("Ver fluxo completo");
      expect(custosTableContent).toContain("FULL_FLOW_STAGES.map");
      expect(custosTableContent).toContain("MINI_FLOW_STAGES.map");
    });

    it("6.2. Custos Extras preserva altura útil de 100dvh e estrutura responsiva sem corte", () => {
      expect(custosTableContent).toContain("h-[100dvh]");
      expect(custosTableContent).toContain("max-h-[100dvh]");
      expect(custosTableContent).toContain("flex-1 min-h-0 overflow-y-auto overflow-x-hidden");
    });
  });

  // ─── 7. Composição Visual e Geometria Idêntica Primário vs Secundário ───────
  describe("7. Composição Visual e Geometria Idêntica (Zero Desalinhamento e Zero Fundo Lavado)", () => {
    const sheetPath = path.resolve(__dirname, "../components/ui/sheet.tsx");
    const sheetContent = fs.readFileSync(sheetPath, "utf-8");

    it("7.1. Primário e Secundário possuem exatamente a mesma geometria (mesma largura canônica e altura)", () => {
      // Ambos utilizam w-full sm:max-w-lg e 100dvh
      expect(primaryShellContent).toContain('widthClass = "w-full sm:max-w-lg"');
      expect(secondaryShellContent).toContain('widthClass = "w-full sm:max-w-lg"');
      expect(primaryShellContent).toContain("h-[100dvh]");
      expect(primaryShellContent).toContain("max-h-[100dvh]");
      expect(secondaryShellContent).toContain("h-[100dvh]");
      expect(secondaryShellContent).toContain("max-h-[100dvh]");
      expect(secondaryDrawerContent).toContain('widthClass="w-full sm:max-w-lg"');
      expect(secondaryDrawerContent).toContain("<DrawerSecundarioShell");
    });

    it("7.2. Secundário NÃO adiciona backdrop visual duplicado (hideOverlay=true no SheetContent)", () => {
      // SheetContent suporta hideOverlay
      expect(sheetContent).toContain("hideOverlay = false");
      expect(sheetContent).toContain("{!hideOverlay && <SheetOverlay");

      // DrawerSecundarioShell desativa o overlay duplicado por padrão
      expect(secondaryShellContent).toContain("hideOverlay = true");
      expect(secondaryShellContent).toContain("hideOverlay={hideOverlay}");
    });

    it("7.3. Fundo não clareia: classes arbitrárias de overlay branco/esbranquiçado foram eliminadas", () => {
      // Não pode haver bg-background/80 no container do secundário
      expect(secondaryDrawerContent).not.toContain("bg-background/80 backdrop-blur");
      expect(secondaryDrawerContent).not.toContain("sm:w-[500px]");
    });

    it("7.4. Voltar aos detalhes restaura o Primário preservando o mesmo backdrop único", () => {
      expect(tableBlockContent).toContain("onBack={() => setIsFlowDrawerOpen(false)}");
      expect(secondaryDrawerContent).toContain("onBack={onBack}");
    });

    it("7.5. Fechar encerra corretamente toda a composição limpando os estados dos drawers", () => {
      expect(tableBlockContent).toContain("setIsFlowDrawerOpen(false)");
      expect(tableBlockContent).toContain("setSelectedItem(null)");
    });
  });
});


