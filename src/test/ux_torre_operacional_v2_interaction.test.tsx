import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UxLabThemeProvider } from "@/components/ux-lab/UxLabThemeContext";
import { UxLabTorreDrawer } from "@/components/ux-lab/UxLabTorreDrawer";
import UxLabTorreOperacional from "@/pages/UxLab/UxLabTorreOperacional";
import {
  MOCK_TRILHA_RECEITAS,
  MOCK_TRILHA_CUSTOS,
  EtapaOperacional,
} from "@/pages/UxLab/torreMockData";

describe("UX02 — Torre Operacional V2 (Regressão de Interação & Ciclo de Hooks do Drawer)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Render fechado → Aberto (Etapa A) → Fechado → Aberto (Etapa B) não viola a ordem de Hooks", () => {
    const stageA = MOCK_TRILHA_RECEITAS.etapas[1]; // Validação Operacional
    const stageB = MOCK_TRILHA_RECEITAS.etapas[2]; // Pronto para Faturar
    const stageC = MOCK_TRILHA_CUSTOS.etapas[1];   // Validação Operacional / RH

    // Componente de teste com ciclo de vida idêntico à Torre Operacional
    function TestDrawerHost() {
      const [stage, setStage] = useState<EtapaOperacional | null>(null);
      const [isOpen, setIsOpen] = useState(false);

      return (
        <div>
          <button data-testid="btn-open-a" onClick={() => { setStage(stageA); setIsOpen(true); }}>
            Abrir A
          </button>
          <button data-testid="btn-open-b" onClick={() => { setStage(stageB); setIsOpen(true); }}>
            Abrir B
          </button>
          <button data-testid="btn-open-c" onClick={() => { setStage(stageC); setIsOpen(true); }}>
            Abrir C
          </button>
          <button data-testid="btn-close" onClick={() => setIsOpen(false)}>
            Fechar
          </button>

          <UxLabTorreDrawer
            stage={stage}
            open={isOpen}
            onClose={() => setIsOpen(false)}
          />
        </div>
      );
    }

    const { getByTestId, queryByText } = render(<TestDrawerHost />);

    // 1. Estado inicial: fechado (stage=null, open=false)
    expect(queryByText("Validação Operacional")).toBeNull();

    // 2. Transição 1: Fechado → Aberto com Etapa A
    act(() => {
      fireEvent.click(getByTestId("btn-open-a"));
    });
    expect(screen.getByText("Validação Operacional")).toBeDefined();
    expect(screen.getByText("Conferência de Volume & Avarias")).toBeDefined();

    // 3. Transição 2: Aberto com Etapa A → Fechado
    act(() => {
      fireEvent.click(getByTestId("btn-close"));
    });

    // 4. Transição 3: Fechado → Aberto com Etapa B
    act(() => {
      fireEvent.click(getByTestId("btn-open-b"));
    });
    expect(screen.getByText("Pronto para Faturar")).toBeDefined();
    expect(screen.getByText("Liberação Comercial & Emissão")).toBeDefined();
    // Confirma CTA semântico de Faturamento / Receitas
    expect(screen.getByText("Abrir em Receitas")).toBeDefined();

    // 5. Transição 4: Alternância direta sem fechar: Etapa B → Etapa C
    act(() => {
      fireEvent.click(getByTestId("btn-open-c"));
    });
    expect(screen.getByText("Validação Operacional / RH")).toBeDefined();
    expect(screen.getByText("Conferência de Presença & Horas")).toBeDefined();
  });

  it("2. Navegação E2E na página UxLabTorreOperacional: abrir nós de Trilha A e B sucessivamente sem crash", () => {
    render(
      <MemoryRouter initialEntries={["/ux-lab/torre"]}>
        <UxLabThemeProvider>
          <UxLabTorreOperacional />
        </UxLabThemeProvider>
      </MemoryRouter>
    );

    // Verifica que a Torre renderizou ambas as trilhas
    expect(screen.getByText("Trilha A · Operações & Receitas")).toBeDefined();
    expect(screen.getByText("Trilha B · Mão de Obra & Custos")).toBeDefined();

    // Clica no card da Etapa "Validação Operacional"
    const nodeValidacaoOp = screen.getByText("Conferência de Volume & Avarias");
    act(() => {
      fireEvent.click(nodeValidacaoOp);
    });

    // O Drawer deve abrir exibindo os processos da etapa
    expect(screen.getByText("OP-2026-1038")).toBeDefined();
    expect(screen.getByText("Resolver inconsistência")).toBeDefined();

    // Clica em outro nó da Trilha B: "Validação Operacional / RH"
    const nodeValidacaoRh = screen.getByText("Conferência de Presença & Horas");
    act(() => {
      fireEvent.click(nodeValidacaoRh);
    });

    // O Drawer deve transicionar para os processos de RH sem crash
    expect(screen.getByText("LOT-DIA-SEM-42")).toBeDefined();
    expect(screen.getByText("Aguardando validação das presenças semanais pelo RH para liberação do pagamento.")).toBeDefined();

    // Clica no nó "Lote Homologado"
    const nodeLoteHomologado = screen.getByText("Fechamento Aprovado pelo RH");
    act(() => {
      fireEvent.click(nodeLoteHomologado);
    });

    // O Drawer deve exibir a inconsistência de ponto
    expect(screen.getByText("FECH-CLT-BAR")).toBeDefined();
    expect(screen.getByText("2 colaboradores CLT sem batida de retorno de almoço bloqueiam o fechamento da unidade.")).toBeDefined();
  });

  it("3. Filtros com contador zero ficam disabled e Responsável Atual é exibido como metadado textual", () => {
    // Etapa rec-3 possui 0 bloqueados (Bloqueados (0))
    const stageRec3 = MOCK_TRILHA_RECEITAS.etapas[2]; // Pronto para Faturar

    render(
      <UxLabTorreDrawer
        stage={stageRec3}
        open={true}
        onClose={() => {}}
      />
    );

    // 1. Verifica metadado textual do Responsável Atual (sem badge/pill)
    expect(screen.getByText("Responsável atual")).toBeDefined();
    expect(screen.getAllByText("Financeiro").length).toBeGreaterThan(0);

    // 2. Localiza o botão "Bloqueados (0)"
    const btnBloqueados = screen.getByRole("button", { name: /Bloqueados \(0\)/i });
    expect(btnBloqueados).toBeDefined();
    expect(btnBloqueados.hasAttribute("disabled")).toBe(true);
    expect(btnBloqueados.getAttribute("disabled")).toBe("");

    // 3. Localiza o botão "Atenção (1)" que possui processos (deve estar habilitado)
    const btnAtencao = screen.getByRole("button", { name: /Atenção \(1\)/i });
    expect(btnAtencao).toBeDefined();
    expect(btnAtencao.hasAttribute("disabled")).toBe(false);

    // 4. Verifica tipografia limpa do Motivo (não envolve caixa cinza)
    expect(screen.getAllByText(/Motivo:/i).length).toBeGreaterThan(0);
  });
});
