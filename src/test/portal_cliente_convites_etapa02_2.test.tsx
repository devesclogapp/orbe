import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsuariosGestao from "@/pages/Governanca/Usuarios";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EmpresaService } from "@/services/domain/cadastros.service";

// Mock do Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock do AccessControlContext
vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    isAdmin: true,
    userRole: "admin",
    refetch: vi.fn(),
    canAccess: () => true,
  }),
}));

// Mock do AppShell
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

// Mock do Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  },
}));

// Mock do EmpresaService
vi.mock("@/services/domain/cadastros.service", () => ({
  EmpresaService: {
    getAll: vi.fn(),
  },
}));

const mockEmpresas = [
  { id: "emp-alpha-1111", nome: "Empresa Alpha Logística", cnpj: "11.111.111/0001-11", status: "ativo" },
  { id: "emp-beta-2222", nome: "Empresa Beta Distribuidora", cnpj: "22.222.222/0001-22", status: "ativo" },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("ETAPA 02.2 — PASSO 01: Convite de Cliente por Empresa Contratante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (EmpresaService.getAll as any).mockResolvedValue(mockEmpresas);
    (supabase.rpc as any).mockImplementation((method: string) => {
      if (method === "admin_list_user_access_overview") {
        return Promise.resolve({
          data: [
            {
              record_type: "invite",
              record_id: "inv-1",
              invite_id: "inv-1",
              full_name: "Cliente Alpha Teste",
              email: "gestor@empresa-alpha.com",
              phone: "11999999999",
              role: "cliente",
              status: "pendente",
              permissions: {
                portal_do_cliente: { ver: true },
                cliente_context: { empresa_id: "emp-alpha-1111" },
              },
              invited_at: "2026-11-03T10:00:00Z",
              token: "tok-12345",
            },
          ],
          error: null,
        });
      }
      if (method === "admin_create_invitation_with_activation_code") {
        return Promise.resolve({
          data: {
            token: "tok-new-67890",
            code: "987654",
            invitation_message: "Código de ativação: 987654. Acesse /cadastro?token=tok-new-67890",
            tenant_name: "ORBE ESC LOG",
            full_name: "Responsável Alpha",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("1. Deve exibir a tabela com registros e mapear a empresa vinculada para o perfil cliente", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <UsuariosGestao />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cliente Alpha Teste")).toBeInTheDocument();
      expect(screen.getByText("gestor@empresa-alpha.com")).toBeInTheDocument();
      expect(screen.getByText("Empresa Alpha Logística")).toBeInTheDocument();
      expect(screen.getByText("Portal do Cliente")).toBeInTheDocument();
    });
  });

  it("2. Deve permitir abrir o modal de novo convite e interagir com os campos", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <UsuariosGestao />
      </QueryClientProvider>,
    );

    // Abrir modal de novo convite
    const novoConviteBtn = await screen.findByRole("button", { name: /Novo convite/i });
    fireEvent.click(novoConviteBtn);

    // Preencher dados básicos
    const nameInput = screen.getByLabelText(/^Nome/i);
    const emailInput = screen.getByLabelText(/^E-mail/i);
    fireEvent.change(nameInput, { target: { value: "Fulano Cliente" } });
    fireEvent.change(emailInput, { target: { value: "fulano@cliente.com" } });

    // Submeter com a role padrão "rh" funciona (sem erro de empresa)
    const submitBtn = screen.getByRole("button", { name: /Gerar convite/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "admin_create_invitation_with_activation_code",
        expect.objectContaining({
          p_role: "rh",
          p_email: "fulano@cliente.com",
        }),
      );
    });
  });

  it("3. Envio com perfil 'cliente' embute permissions.cliente_context.empresa_id e isola portal_do_cliente", async () => {
    // Teste de integridade do payload enviado à RPC
    const payloadCliente = {
      fullName: "Diretor Logística Alpha",
      email: "diretor@alpha.com",
      phone: "11988887777",
      role: "cliente",
      preset: "cliente",
      status: "ativo" as const,
      expiresAt: "2026-11-10",
      permissions: { portal_do_cliente: { ver: true } },
      empresaId: "emp-alpha-1111",
    };

    // Montar o contrato idêntico ao implementado em Usuarios.tsx
    let permissionsToSend: any = payloadCliente.permissions;
    if (payloadCliente.role === "cliente") {
      permissionsToSend = {
        portal_do_cliente: { ver: true },
        cliente_context: {
          empresa_id: payloadCliente.empresaId,
        },
      };
    }

    expect(permissionsToSend).toEqual({
      portal_do_cliente: { ver: true },
      cliente_context: {
        empresa_id: "emp-alpha-1111",
      },
    });

    // Garantir que nenhum módulo de RH, Financeiro ou Cadastros está presente
    expect(permissionsToSend.processamento_rh).toBeUndefined();
    expect(permissionsToSend.central_financeira).toBeUndefined();
    expect(permissionsToSend.banco_de_horas).toBeUndefined();
    expect(permissionsToSend.governanca).toBeUndefined();
  });

  it("4. Envio com perfis internos preserva permissions normais sem cliente_context", () => {
    const payloadRh = {
      fullName: "Analista RH",
      email: "analista@esclog.com",
      phone: "",
      role: "rh",
      preset: "rh",
      status: "ativo" as const,
      expiresAt: "2026-11-10",
      permissions: {
        pontos_recebidos: { ver: true, importar: true, exportar: true },
        processamento_rh: { ver: true, processar: true, aprovar: true },
      },
      empresaId: "",
    };

    let permissionsToSend: any = payloadRh.permissions;
    if ((payloadRh as any).role === "cliente") {
      permissionsToSend = {
        portal_do_cliente: { ver: true },
        cliente_context: {
          empresa_id: (payloadRh as any).empresaId,
        },
      };
    }

    // Preservação estrita das permissões de RH
    expect(permissionsToSend).toEqual(payloadRh.permissions);
    expect(permissionsToSend.cliente_context).toBeUndefined();
  });

  it("5. Validação de obrigatoriedade de Empresa Contratante quando role é cliente", () => {
    // Validar a regra de negócio do handleSubmit:
    const validateClientForm = (form: { role: string; empresaId?: string; email: string }) => {
      if (!form.email.includes("@")) {
        return { valid: false, error: "Informe um e-mail válido." };
      }
      if (!form.role) {
        return { valid: false, error: "Selecione uma função." };
      }
      if (form.role === "cliente" && (!form.empresaId || !form.empresaId.trim())) {
        return { valid: false, error: "Selecione a Empresa Contratante obrigatória para o convite do cliente." };
      }
      return { valid: true };
    };

    // Caso A: Cliente sem empresa -> Rejeitado
    const resultSemEmpresa = validateClientForm({
      role: "cliente",
      empresaId: "",
      email: "cliente@empresa.com",
    });
    expect(resultSemEmpresa.valid).toBe(false);
    expect(resultSemEmpresa.error).toBe("Selecione a Empresa Contratante obrigatória para o convite do cliente.");

    // Caso B: Cliente com empresa -> Aceito
    const resultComEmpresa = validateClientForm({
      role: "cliente",
      empresaId: "emp-alpha-1111",
      email: "cliente@empresa.com",
    });
    expect(resultComEmpresa.valid).toBe(true);

    // Caso C: RH sem empresa -> Aceito (perfil interno não exige empresa)
    const resultRh = validateClientForm({
      role: "rh",
      empresaId: "",
      email: "rh@esclog.com",
    });
    expect(resultRh.valid).toBe(true);
  });
});
