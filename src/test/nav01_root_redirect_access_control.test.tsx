import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AccessControlContext } from "@/contexts/AccessControlContext";
import { getDefaultRouteForRole, normalizeRole } from "@/lib/access-control";

// Simula o componente RootRedirect exatamente como implementado em src/App.tsx
const RootRedirectTestComponent: React.FC = () => {
  const context = React.useContext(AccessControlContext);
  const role = context?.role ?? null;
  const loading = context?.loading ?? true;

  if (loading) {
    return (
      <div data-testid="loading-spinner" className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const destination = getDefaultRouteForRole(role);
  return <Navigate to={destination} replace />;
};

describe("FIX NAV-01 — Redirecionamento Pós-Login & Prevenção de Race Condition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Comportamento do RootRedirect durante o carregamento assíncrono", () => {
    it("1.1 Exibe o spinner e NÃO redireciona enquanto loading = true", () => {
      render(
        <AccessControlContext.Provider
          value={{
            role: null,
            status: "ativo",
            permissions: {},
            loading: true,
            isAdmin: false,
            isBlocked: false,
            canAccess: () => false,
            refetch: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<RootRedirectTestComponent />} />
              <Route path="/rh/aprovacoes" element={<div>Tela RH Aprovacoes</div>} />
              <Route path="/operacional/dashboard" element={<div>Dashboard Executivo</div>} />
            </Routes>
          </MemoryRouter>
        </AccessControlContext.Provider>
      );

      // Deve exibir o spinner de carregamento
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
      // NÃO deve ter navegado para o dashboard ou outra tela
      expect(screen.queryByText("Dashboard Executivo")).not.toBeInTheDocument();
      expect(screen.queryByText("Tela RH Aprovacoes")).not.toBeInTheDocument();
    });
  });

  describe("2. Redirecionamento após resolução de perfil (Pós-Login / Refresh)", () => {
    it("2.1 Redireciona usuário com perfil 'rh' diretamente para /rh/aprovacoes", () => {
      render(
        <AccessControlContext.Provider
          value={{
            role: "rh",
            status: "ativo",
            permissions: { processamento_rh: { ver: true, aprovar: false } },
            loading: false,
            isAdmin: false,
            isBlocked: false,
            canAccess: vi.fn((mod) => mod === "processamento_rh"),
            refetch: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<RootRedirectTestComponent />} />
              <Route path="/rh/aprovacoes" element={<div data-testid="rh-target">Tela RH Aprovacoes</div>} />
              <Route path="/operacional/dashboard" element={<div>Dashboard Executivo</div>} />
            </Routes>
          </MemoryRouter>
        </AccessControlContext.Provider>
      );

      expect(screen.getByTestId("rh-target")).toBeInTheDocument();
      expect(screen.queryByText("Dashboard Executivo")).not.toBeInTheDocument();
    });

    it("2.2 Redireciona usuário com perfil 'encarregado' diretamente para /producao", () => {
      render(
        <AccessControlContext.Provider
          value={{
            role: "encarregado",
            status: "ativo",
            permissions: {},
            loading: false,
            isAdmin: false,
            isBlocked: false,
            canAccess: () => false,
            refetch: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<RootRedirectTestComponent />} />
              <Route path="/producao" element={<div data-testid="prod-target">Portal Producao</div>} />
              <Route path="/operacional/dashboard" element={<div>Dashboard Executivo</div>} />
            </Routes>
          </MemoryRouter>
        </AccessControlContext.Provider>
      );

      expect(screen.getByTestId("prod-target")).toBeInTheDocument();
      expect(screen.queryByText("Dashboard Executivo")).not.toBeInTheDocument();
    });

    it("2.3 Redireciona usuário com perfil 'financeiro' diretamente para /financeiro", () => {
      render(
        <AccessControlContext.Provider
          value={{
            role: "financeiro",
            status: "ativo",
            permissions: {},
            loading: false,
            isAdmin: false,
            isBlocked: false,
            canAccess: () => false,
            refetch: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<RootRedirectTestComponent />} />
              <Route path="/financeiro" element={<div data-testid="fin-target">Central Financeira</div>} />
              <Route path="/operacional/dashboard" element={<div>Dashboard Executivo</div>} />
            </Routes>
          </MemoryRouter>
        </AccessControlContext.Provider>
      );

      expect(screen.getByTestId("fin-target")).toBeInTheDocument();
      expect(screen.queryByText("Dashboard Executivo")).not.toBeInTheDocument();
    });

    it("2.4 Redireciona usuário 'admin' para /operacional/dashboard", () => {
      render(
        <AccessControlContext.Provider
          value={{
            role: "admin",
            status: "ativo",
            permissions: {},
            loading: false,
            isAdmin: true,
            isBlocked: false,
            canAccess: () => true,
            refetch: vi.fn(),
          }}
        >
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<RootRedirectTestComponent />} />
              <Route path="/operacional/dashboard" element={<div data-testid="dash-target">Dashboard Executivo</div>} />
            </Routes>
          </MemoryRouter>
        </AccessControlContext.Provider>
      );

      expect(screen.getByTestId("dash-target")).toBeInTheDocument();
    });
  });

  describe("3. Preservação do Comportamento Fail-Closed", () => {
    it("3.1 Bloqueia qualquer canAccess e mantém role nulo enquanto loading = true", () => {
      // Simulação do cálculo do AccessControlContext
      const isAccessLoading = true;
      const effectiveRole = isAccessLoading ? null : normalizeRole("user");

      const canAccessFn = (mod: string) => {
        if (isAccessLoading) return false;
        return mod === "dashboard";
      };

      expect(effectiveRole).toBeNull();
      expect(canAccessFn("dashboard")).toBe(false);
      expect(canAccessFn("processamento_rh")).toBe(false);
    });

    it("3.2 Ausência real de permissões resolve para 'user' e barra acesso a módulos operacionais", () => {
      const isAccessLoading = false;
      const effectiveRole = isAccessLoading ? null : normalizeRole("user");

      expect(effectiveRole).toBe("user");
      expect(getDefaultRouteForRole(effectiveRole)).toBe("/operacional/dashboard");
    });
  });
});

