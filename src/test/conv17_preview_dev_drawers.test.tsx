import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import DevIntermitentesDrawersPreview from "@/pages/Dev/DevIntermitentesDrawersPreview";

// Mocks dos contextos e componentes estruturais
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title, description }: any) => (
    <div data-testid="app-shell">
      <header>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "usr-dev-hml-01", email: "auditor@esclog.com.br" },
    role: "admin",
  }),
}));

describe("CONV-17 / PREVIEW DEV — Homologação Visual Isolada dos Drawers de Intermitentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ISOLAMENTO DEV E SEGURANÇA ARQUITETURAL (ANÁLISE ESTÁTICA)
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. Garantias de Isolamento DEV e Segurança (Static & Code Audit)", () => {
    const pagePath = path.resolve(__dirname, "../pages/Dev/DevIntermitentesDrawersPreview.tsx");
    const appPath = path.resolve(__dirname, "../App.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    const appContent = fs.readFileSync(appPath, "utf-8");

    it("1.1 Garante que DevIntermitentesDrawersPreview NÃO importa cliente Supabase", () => {
      expect(pageContent).not.toMatch(/from\s+['"]@\/lib\/supabase['"]/);
      expect(pageContent).not.toMatch(/from\s+['"]@supabase\/supabase-js['"]/);
      expect(pageContent).not.toMatch(/supabase\.from\(/);
      expect(pageContent).not.toMatch(/supabase\.rpc\(/);
    });

    it("1.2 Garante que a página NÃO aciona serviços de mutação financeira ou CNAB", () => {
      expect(pageContent).not.toMatch(/gerarRemessaCNAB/);
      expect(pageContent).not.toMatch(/gerarCNABParaLote/);
      expect(pageContent).not.toMatch(/IntermitentesLoteService\./);
      expect(pageContent).not.toMatch(/financeiroService\./);
    });

    it("1.3 Garante que a rota /dev/intermitentes-drawers em App.tsx está protegida por import.meta.env.DEV", () => {
      expect(appContent).toContain("import.meta.env.DEV");
      expect(appContent).toContain('path="/dev/intermitentes-drawers"');
      expect(appContent).toContain("DevIntermitentesDrawersPreview");
    });

    it("1.4 Garante que todas as fixtures possuem identificadores de homologação (hml-*) sem IDs reais", () => {
      expect(pageContent).toContain("hml-int-lote-rh-001");
      expect(pageContent).toContain("hml-int-lote-fin-002");
      expect(pageContent).toContain("hml-int-lote-pago-003");
      expect(pageContent).toContain("hml-int-lote-cnab-004");
      expect(pageContent).toContain("hml-int-lote-rh-005");
      expect(pageContent).toContain("hml-int-lote-dev-006");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. RENDERIZAÇÃO DA PÁGINA E TABELA DE FIXTURES
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Renderização da Tabela de Cenários e Badges Canônicos", () => {
    it("2.1 Renderiza cabeçalho, banner de isolamento DEV e tabela com 6 lotes", () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      // Título e banner de segurança
      expect(screen.getByText("Preview DEV — Drawers de Lotes de Intermitentes")).toBeInTheDocument();
      expect(screen.getByText(/Ambiente de Laboratório DEV — 100% em Memória/i)).toBeInTheDocument();
      expect(screen.getByText("DEV MODE ONLY")).toBeInTheDocument();

      // Cenários de status na tabela
      expect(screen.getAllByText(/Aprovado RH/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Aprovado Financeiro/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Pago \/ Conciliado/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Remessa Gerada/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Em análise RH/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Devolvido RH/i).length).toBeGreaterThanOrEqual(1);

      // Botões de Detalhes
      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      expect(botoesDetalhes.length).toBe(6);
    });

    it("2.2 Permite filtrar a tabela por cenário de lote", () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      // Clicar no filtro "Pago / Conciliado"
      const btnFiltroPago = screen.getByRole("button", { name: /Pago \/ Conciliado/i });
      fireEvent.click(btnFiltroPago);

      expect(screen.getByText(/Exibindo/i)).toHaveTextContent("1 de 6 lotes");
      expect(screen.getAllByRole("button", { name: /Detalhes/i }).length).toBe(1);

      // Voltar para "Todos os Lotes"
      const btnFiltroTodos = screen.getByRole("button", { name: /Todos os Lotes/i });
      fireEvent.click(btnFiltroTodos);

      expect(screen.getByText(/Exibindo/i)).toHaveTextContent("6 de 6 lotes");
      expect(screen.getAllByRole("button", { name: /Detalhes/i }).length).toBe(6);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. FLUXO DO DRAWER PRIMÁRIO (COMPOSIÇÃO DO LOTE)
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Drawer Primário Shell: Abertura, Pipeline e Composição", () => {
    it("3.1 Abre Drawer Primário ao clicar em Detalhes em lote VALIDADO_RH", async () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      // Clicar no primeiro botão de Detalhes (lote VALIDADO_RH)
      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      fireEvent.click(botoesDetalhes[0]);

      // Esperar Drawer Primário abrir com o título do lote e métricas
      await waitFor(() => {
        expect(screen.getByText(/Pipeline do Lote/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Lote Homologado pelo RH — Aguardando Financeiro/i)).toBeInTheDocument();
      expect(screen.getByText(/Ação Necessária/i)).toBeInTheDocument();

      // Métricas do lote (tabela + drawer)
      expect(screen.getAllByText(/1\.420,50/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Composição do Lote \(4 lançamentos\)/i)).toBeInTheDocument();

      // Colaboradores listados
      expect(screen.getByText(/CLT-HML-001 João Pereira/i)).toBeInTheDocument();
      expect(screen.getByText(/CLT-HML-002 Maria Fernandes/i)).toBeInTheDocument();

      // Botões do rodapé no estado VALIDADO_RH
      expect(screen.getByRole("button", { name: /Ver fluxo completo/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Fechar$/i })).toBeInTheDocument();
    });

    it("3.2 Fecha o Drawer Primário ao clicar no botão Fechar do rodapé", async () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      fireEvent.click(botoesDetalhes[0]);

      await waitFor(() => {
        expect(screen.getByText(/Pipeline do Lote/i)).toBeInTheDocument();
      });

      const btnFechar = screen.getByRole("button", { name: /^Fechar$/i });
      fireEvent.click(btnFechar);

      // Drawer Primário deve ser fechado
      await waitFor(() => {
        expect(screen.queryByText(/Pipeline do Lote/i)).not.toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. FLUXO DO DRAWER SECUNDÁRIO (LINHA DO TEMPO)
  // ──────────────────────────────────────────────────────────────────────────
  describe("4. Drawer Secundário Shell: Linha do Tempo e Navegação", () => {
    it("4.1 Abre Drawer Secundário ao clicar em 'Ver fluxo completo'", async () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      // Abrir primeiro o drawer primário
      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      fireEvent.click(botoesDetalhes[0]);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Ver fluxo completo/i })).toBeInTheDocument();
      });

      // Clicar em "Ver fluxo completo"
      const btnFluxoCompleto = screen.getByRole("button", { name: /Ver fluxo completo/i });
      fireEvent.click(btnFluxoCompleto);

      // Esperar Drawer Secundário abrir com as 6 etapas canônicas
      await waitFor(() => {
        expect(screen.getByText("Linha do Tempo — Intermitentes")).toBeInTheDocument();
      });

      expect(screen.getByText("1. Importação Tio Digital")).toBeInTheDocument();
      expect(screen.getByText("2. Fechamento de Período")).toBeInTheDocument();
      expect(screen.getByText("3. Validação do RH")).toBeInTheDocument();
      expect(screen.getByText("4. Aprovação Financeira / Remessa")).toBeInTheDocument();
      expect(screen.getByText("5. Geração de Arquivo CNAB 240")).toBeInTheDocument();
      expect(screen.getByText("6. Retorno Bancário & Quitação (PAGO)")).toBeInTheDocument();

      // Botão "← Voltar aos detalhes"
      expect(screen.getByRole("button", { name: /← Voltar aos detalhes/i })).toBeInTheDocument();
    });

    it("4.2 Permite voltar aos detalhes a partir da Linha do Tempo", async () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      fireEvent.click(botoesDetalhes[0]);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Ver fluxo completo/i })).toBeInTheDocument();
      });

      const btnFluxoCompleto = screen.getByRole("button", { name: /Ver fluxo completo/i });
      fireEvent.click(btnFluxoCompleto);

      await waitFor(() => {
        expect(screen.getByText("Linha do Tempo — Intermitentes")).toBeInTheDocument();
      });

      // Clicar em voltar
      const btnVoltar = screen.getByRole("button", { name: /← Voltar aos detalhes/i });
      fireEvent.click(btnVoltar);

      // Linha do tempo fechada, drawer primário ativo
      await waitFor(() => {
        expect(screen.queryByText("Linha do Tempo — Intermitentes")).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Pipeline do Lote/i)).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. MODAL DE APROVAÇÃO FINANCEIRA (SIMULAÇÃO ISOLADA)
  // ──────────────────────────────────────────────────────────────────────────
  describe("5. Modal de Confirmação de Aprovação Financeira em Memória", () => {
    it("5.1 Abre modal ao clicar em 'Aprovar Financeiro' e cancela sem mutações", async () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      // Abrir lote VALIDADO_RH
      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      fireEvent.click(botoesDetalhes[0]);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
      });

      // Clicar em Aprovar Financeiro
      const btnAprovar = screen.getByRole("button", { name: /Aprovar Financeiro/i });
      fireEvent.click(btnAprovar);

      // Esperar modal abrir
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Confirmar Aprovação Financeira/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/Efeito desta ação \(Simulado em Memória\)/i)).toBeInTheDocument();

      // Cancelar fecha o modal
      const btnCancelar = screen.getByRole("button", { name: /^Cancelar$/i });
      fireEvent.click(btnCancelar);

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: /Confirmar Aprovação Financeira/i })).not.toBeInTheDocument();
      });
    });

    it("5.2 Simula a confirmação da aprovação financeira em memória e avança o status visual do lote", async () => {
      render(
        <BrowserRouter>
          <DevIntermitentesDrawersPreview />
        </BrowserRouter>
      );

      // Abrir lote VALIDADO_RH
      const botoesDetalhes = screen.getAllByRole("button", { name: /Detalhes/i });
      fireEvent.click(botoesDetalhes[0]);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Aprovar Financeiro/i })).toBeInTheDocument();
      });

      // Clicar em Aprovar Financeiro
      const btnAprovar = screen.getByRole("button", { name: /Aprovar Financeiro/i });
      fireEvent.click(btnAprovar);

      // Esperar modal abrir
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Confirmar Aprovação Financeira/i })).toBeInTheDocument();
      });

      // Confirmar simulação no modal
      const btnConfirmar = screen.getByRole("button", { name: /Confirmar Aprovação Financeira \(Simulação\)/i });
      fireEvent.click(btnConfirmar);

      // Modal deve fechar
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: /Confirmar Aprovação Financeira/i })).not.toBeInTheDocument();
      });

      // O diagnóstico do lote deve ter avançado em tempo real para Aprovado pelo Financeiro / Liberado para Remessa
      await waitFor(() => {
        expect(screen.getByText(/Aprovado pelo Financeiro — Liberado para Remessa/i)).toBeInTheDocument();
      });

      // Agora deve aparecer o botão de Avançar para Remessa no rodapé
      expect(screen.getByRole("button", { name: /Avançar para Remessa/i })).toBeInTheDocument();

      // O feed de eventos deve ter registrado a ação
      expect(screen.getByText(/APROVACAO_FINANCEIRA_SIMULADA/i)).toBeInTheDocument();
    });
  });
});
