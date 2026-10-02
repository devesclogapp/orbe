import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  MOCK_TRILHA_RECEITAS,
  MOCK_TRILHA_CUSTOS,
} from "../pages/UxLab/torreMockData";

describe("UX02 — Torre Operacional V2 (Protótipo 2 — Drawer Operacional de Diagnóstico e Despacho)", () => {
  const drawerFilePath = path.resolve(__dirname, "../components/ux-lab/UxLabTorreDrawer.tsx");
  const drawerContent = fs.readFileSync(drawerFilePath, "utf-8");

  const pageFilePath = path.resolve(__dirname, "../pages/UxLab/UxLabTorreOperacional.tsx");
  const pageContent = fs.readFileSync(pageFilePath, "utf-8");

  it("1. O Drawer Operacional está conectado ao clique dos nós e renderizado sem deslocamento de página", () => {
    expect(pageContent).toContain("UxLabTorreDrawer");
    expect(pageContent).toContain("handleStageClick(etapa)");
    expect(pageContent).toContain("<UxLabTorreDrawer");
    expect(drawerContent).toContain("Sheet");
    expect(drawerContent).toContain("SheetContent");
    expect(drawerContent).toContain('side="right"');
  });

  it("2. O Cabeçalho do Drawer exibe Trilha, Etapa, Status, Responsável Setorial e Métricas", () => {
    // Trilha, Etapa, Status e Responsável
    expect(drawerContent).toContain("stage.trilhaTitulo");
    expect(drawerContent).toContain("stage.nome");
    expect(drawerContent).toContain("stage.responsavelSetorial");
    expect(drawerContent).toContain("Responsável atual");

    // Métricas: processos nesta etapa, atenção, tempo médio
    expect(drawerContent).toContain("processos nesta etapa");
    expect(drawerContent).toContain("exigem atenção");
    expect(drawerContent).toContain("Tempo médio:");
  });

  it("3. As 3 situações conceituais estão devidamente implementadas com CTAs de Despacho claros", () => {
    // Validação nos dados mockados que alimentam o Drawer
    const todosItens = [
      ...MOCK_TRILHA_RECEITAS.etapas.flatMap((e) => e.itensExemplo),
      ...MOCK_TRILHA_CUSTOS.etapas.flatMap((e) => e.itensExemplo),
    ];

    const ctas = todosItens.map((i) => i.ctaLabel);
    // A. Normal -> Abrir detalhes
    expect(ctas).toContain("Abrir detalhes");

    // B. Aguardando Decisão -> Ir para Aprovações
    expect(ctas).toContain("Ir para Aprovações");

    // C. Bloqueado por Inconsistência -> Resolver inconsistência
    expect(ctas).toContain("Resolver inconsistência");

    // O Drawer renderiza dinamicamente o ctaLabel do item
    expect(drawerContent).toContain("{item.ctaLabel}");
  });

  it("4. Princípio arquitetural: O Drawer NÃO implementa ações executivas especialistas (não aprova, não paga, não fatura)", () => {
    // Não deve conter botões de ação executiva direta dentro do drawer
    expect(drawerContent).not.toContain('button>Aprovar');
    expect(drawerContent).not.toContain('button>Rejeitar');
    expect(drawerContent).not.toContain('button>Pagar');
    expect(drawerContent).not.toContain('button>Faturar');
    expect(drawerContent).not.toContain('Gerar CNAB');
    expect(drawerContent).not.toContain('Corrigir Ponto');
  });

  it("5. O Despacho simula transporte de contexto com parâmetros canônicos (origem=torre&trilha=...&etapa=...&processo=...)", () => {
    expect(drawerContent).toContain("origem=");
    expect(drawerContent).toContain("trilha=");
    expect(drawerContent).toContain("etapa=");
    expect(drawerContent).toContain("processo=");
    expect(drawerContent).toContain("handleDispatch");

    // Verifica que todos os itens mockados possuem origem='torre'
    const todosItens = [
      ...MOCK_TRILHA_RECEITAS.etapas.flatMap((e) => e.itensExemplo),
      ...MOCK_TRILHA_CUSTOS.etapas.flatMap((e) => e.itensExemplo),
    ];
    todosItens.forEach((item) => {
      expect(item.ctaContexto.origem).toBe("torre");
      expect(item.ctaContexto.trilha).toBeDefined();
      expect(item.ctaContexto.etapa).toBeDefined();
      expect(item.ctaContexto.processoId).toBe(item.codigo);
      expect(item.ctaContexto.rotaSugerida).toBeDefined();
    });
  });

  it("6. O Drawer possui filtro compacto (Todos, Atenção, Bloqueados) e campo de busca por processo/lote/empresa", () => {
    expect(drawerContent).toContain('filterMode === "todos"');
    expect(drawerContent).toContain('filterMode === "atencao"');
    expect(drawerContent).toContain('filterMode === "bloqueados"');
    expect(drawerContent).toContain("Buscar processo, lote, cliente...");
  });

  it("7. Validação do Cenário 1: Trilha A → Validação Operacional (processo em atenção / bloqueado)", () => {
    const stageRec2 = MOCK_TRILHA_RECEITAS.etapas.find((e) => e.id === "rec-2");
    expect(stageRec2).toBeDefined();
    expect(stageRec2?.nome).toBe("Validação Operacional");
    expect(stageRec2?.responsavelSetorial).toBe("Operação");
    expect(stageRec2?.processosEmAtencao).toBeGreaterThan(0);

    const itemBloqueado = stageRec2?.itensExemplo.find((i) => i.situacaoCategoria === "bloqueado");
    expect(itemBloqueado).toBeDefined();
    expect(itemBloqueado?.ctaLabel).toBe("Resolver inconsistência");
    expect(itemBloqueado?.ctaDestinoTipo).toBe("inconsistencias");

    const itemAguardando = stageRec2?.itensExemplo.find((i) => i.situacaoCategoria === "aguardando_decisao");
    expect(itemAguardando).toBeDefined();
    expect(itemAguardando?.ctaLabel).toBe("Ir para Aprovações");
  });

  it("8. Validação do Cenário 2: Trilha A → Pronto para Faturar (processo fora do SLA)", () => {
    const stageRec3 = MOCK_TRILHA_RECEITAS.etapas.find((e) => e.id === "rec-3");
    expect(stageRec3).toBeDefined();
    expect(stageRec3?.nome).toBe("Pronto para Faturar");
    expect(stageRec3?.responsavelSetorial).toBe("Financeiro");
    expect(stageRec3?.situacao).toBe("atrasado");

    const itemForaSla = stageRec3?.itensExemplo.find((i) => i.isAtrasado);
    expect(itemForaSla).toBeDefined();
    expect(itemForaSla?.codigo).toBe("LOT-FAT-092");
    expect(itemForaSla?.ctaLabel).toBe("Abrir em Receitas");
    expect(itemForaSla?.ctaDestinoTipo).toBe("receitas");
  });

  it("9. Validação do Cenário 3: Trilha B → Validação Operacional / RH (lote aguardando decisão do RH)", () => {
    const stageCst2 = MOCK_TRILHA_CUSTOS.etapas.find((e) => e.id === "cst-2");
    expect(stageCst2).toBeDefined();
    expect(stageCst2?.nome).toBe("Validação Operacional / RH");
    expect(stageCst2?.responsavelSetorial).toBe("RH");
    expect(stageCst2?.totalProcessos).toBe(7);
    expect(stageCst2?.processosEmAtencao).toBe(2);
    expect(stageCst2?.tempoMedio).toBe("2,8 dias");

    const itemDiaristas = stageCst2?.itensExemplo.find((i) => i.tipo === "Diaristas");
    expect(itemDiaristas).toBeDefined();
    expect(itemDiaristas?.responsavelSetor).toBe("RH");
    expect(itemDiaristas?.ctaLabel).toBe("Ir para Aprovações");
    expect(itemDiaristas?.ctaDestinoTipo).toBe("aprovacoes");
  });

  it("10. Validação do Cenário 4: Trilha B → Lote Homologado (processo bloqueado por inconsistência)", () => {
    const stageCst3 = MOCK_TRILHA_CUSTOS.etapas.find((e) => e.id === "cst-3");
    expect(stageCst3).toBeDefined();
    expect(stageCst3?.nome).toBe("Lote Homologado");
    expect(stageCst3?.responsavelSetorial).toBe("RH");
    expect(stageCst3?.situacao).toBe("bloqueado");

    const itemBloqueado = stageCst3?.itensExemplo.find((i) => i.situacaoCategoria === "bloqueado");
    expect(itemBloqueado).toBeDefined();
    expect(itemBloqueado?.codigo).toBe("FECH-CLT-BAR");
    expect(itemBloqueado?.ctaLabel).toBe("Resolver inconsistência");
    expect(itemBloqueado?.ctaDestinoTipo).toBe("inconsistencias");
    expect(itemBloqueado?.motivo).toContain("sem batida de retorno de almoço");
  });
});
