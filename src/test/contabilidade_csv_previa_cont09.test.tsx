import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ContabilOficialService,
  PreviaContabilConsolidada,
} from "@/services/contabilOficial.service";
import IntegracaoContabil from "@/pages/Relatorios/IntegracaoContabil";
import * as AccessControlContext from "@/contexts/AccessControlContext";
import * as AuthContext from "@/contexts/AuthContext";
import { EmpresaService } from "@/services/base.service";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AppShell to isolate page testing
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}));

// Mock browser URL methods
if (typeof window !== "undefined") {
  window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  window.URL.revokeObjectURL = vi.fn();
}

describe("ERP ORBE — CONT-09 | Exportação de CSV de Prévia", () => {
  let queryClient: QueryClient;

  const mockPreviaValida: PreviaContabilConsolidada = {
    empresa_id: "emp-matriz",
    empresa_nome: "ESC Logística Matriz",
    competencia: "2026-09",
    status_fechamento: "FECHADO_FINANCEIRO",
    fechamento_detalhe: "Fechamento contábil homologado",
    total_lancamentos: 2,
    total_debito: 3500.5,
    total_credito: 3500.5,
    diferenca: 0,
    lancamentos_nao_mapeados: 0,
    inconsistencias: [],
    elegivel_exportacao: true,
    bloqueios: [],
    lancamentos: [
      {
        id: "lanc-1",
        data: "2026-09-10",
        origem: "Operação por Volume",
        origem_tipo: "RECEITA_OPERACAO_VOLUME",
        documento: "NF-1001",
        historico: "Descarga de mercadorias no CD 01",
        conta_debito: "1.1.02.001",
        conta_credito: "3.1.01.001",
        valor: 2000.5,
        empresa_id: "emp-matriz",
        empresa_nome: "ESC Logística Matriz",
        centro_custo: "OPERACIONAL",
        mapeado: true,
        status_origem: "FATURADO",
      },
      {
        id: "lanc-2",
        data: "2026-09-15",
        origem: "Diaristas",
        origem_tipo: "DESPESA_DIARISTAS",
        documento: "LOTE-SEM-37",
        historico: "Diárias operacionais semana 37",
        conta_debito: "4.1.02.005",
        conta_credito: "2.1.01.002",
        valor: 1500.0,
        empresa_id: "emp-matriz",
        empresa_nome: "ESC Logística Matriz",
        centro_custo: "OPERACIONAL",
        mapeado: true,
        status_origem: "PAGO",
      },
    ],
    content_hash: "hash_valida_123",
  };

  const mockPreviaComPendencias: PreviaContabilConsolidada = {
    empresa_id: "emp-matriz",
    empresa_nome: "ESC Logística Matriz",
    competencia: "2026-10",
    status_fechamento: "EM_ABERTO",
    fechamento_detalhe: "Competência operacional ainda em aberto",
    total_lancamentos: 2,
    total_debito: 2500.0,
    total_credito: 2500.0,
    diferenca: 0,
    lancamentos_nao_mapeados: 2,
    inconsistencias: ["Existem lançamentos sem contas contábeis configuradas."],
    elegivel_exportacao: false,
    bloqueios: [
      "A competência não possui fechamento financeiro homologado.",
      "Existem lançamentos sem contas de débito ou crédito mapeadas.",
    ],
    lancamentos: [
      {
        id: "lanc-pendente-1",
        data: "2026-10-05",
        origem: "Operação por Volume",
        origem_tipo: "RECEITA_OPERACAO_VOLUME",
        documento: "NF-2001",
        historico: "Faturamento Transporte Linha Norte",
        conta_debito: "", // Não configurada
        conta_credito: "3.1.01.001",
        valor: 1800.0,
        empresa_id: "emp-matriz",
        empresa_nome: "ESC Logística Matriz",
        centro_custo: "OPERACIONAL",
        mapeado: false,
        status_origem: "FATURADO",
      },
      {
        id: "lanc-pendente-2",
        data: "2026-10-12",
        origem: "Custos Extras",
        origem_tipo: "DESPESA_CUSTO_EXTRA",
        documento: "REC-994",
        historico: "Manutenção de empilhadeira externa",
        conta_debito: "", // Não configurada
        conta_credito: "", // Não configurada
        valor: 700.0,
        empresa_id: "emp-matriz",
        empresa_nome: "ESC Logística Matriz",
        centro_custo: "OPERACIONAL",
        mapeado: false,
        status_origem: "APROVADO",
      },
    ],
    content_hash: "hash_pendencias_456",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-1", email: "contador@esclog.com.br" },
      session: null,
      loading: false,
      signOut: async () => {},
    } as any);

    vi.spyOn(EmpresaService, "getAll").mockResolvedValue([
      { id: "emp-matriz", nome: "ESC Logística Matriz" },
    ] as any);
  });

  // 1. REQUISITO 1 & 2: REUTILIZAÇÃO DOS DADOS REAIS E ESTRUTURA DO CSV
  it("1. CSV VÁLIDO: gera cabeçalho correto e campos reais delimitados por ponto e vírgula", () => {
    const res = ContabilOficialService.gerarCSVPrevia(mockPreviaValida);

    expect(res.fileName).toBeDefined();
    expect(res.csvContent).toBeDefined();

    const lines = res.csvContent.split("\r\n");
    const header = lines[0];

    // Cabeçalho deve conter todas as colunas solicitadas
    expect(header).toBe(
      "Empresa;Competencia;Data;Origem;Documento;Historico;ContaDebito;ContaCredito;Valor;TipoExportacao"
    );

    // Linha 1 de dados
    expect(lines[1]).toBe(
      "ESC Logística Matriz;2026-09;2026-09-10;Operação por Volume;NF-1001;Descarga de mercadorias no CD 01;1.1.02.001;3.1.01.001;2000.50;PREVIA_NAO_OFICIAL"
    );

    // Linha 2 de dados
    expect(lines[2]).toBe(
      "ESC Logística Matriz;2026-09;2026-09-15;Diaristas;LOTE-SEM-37;Diárias operacionais semana 37;4.1.02.005;2.1.01.002;1500.00;PREVIA_NAO_OFICIAL"
    );
  });

  // 2. REQUISITO 3: IDENTIFICAÇÃO DE CONTAS NÃO CONFIGURADAS (PENDENTE DE MAPEAMENTO)
  it("2. CONTAS NÃO CONFIGURADAS: identifica contas em branco como 'PENDENTE DE MAPEAMENTO'", () => {
    const res = ContabilOficialService.gerarCSVPrevia(mockPreviaComPendencias);
    const lines = res.csvContent.split("\r\n");

    // Lançamento 1: conta_debito vazia, conta_credito preenchida
    expect(lines[1]).toContain("PENDENTE DE MAPEAMENTO;3.1.01.001;1800.00;PREVIA_NAO_OFICIAL");

    // Lançamento 2: ambas as contas vazias
    expect(lines[2]).toContain("PENDENTE DE MAPEAMENTO;PENDENTE DE MAPEAMENTO;700.00;PREVIA_NAO_OFICIAL");
  });

  // 3. REQUISITO 4: DOWNLOAD PERMITIDO COM COMPETÊNCIA ABERTA E PENDÊNCIAS
  it("3. DISPONIBILIDADE NA PRÉVIA: permite download com competência aberta e contas pendentes sem bloqueio", async () => {
    // 3.1. Exportação Oficial Bloqueada
    await expect(
      ContabilOficialService.exportarCSV(mockPreviaComPendencias, "contador@esclog.com.br")
    ).rejects.toThrow(/Exportação bloqueada/i);

    // 3.2. Prévia de Conferência Liberada
    expect(() => {
      const res = ContabilOficialService.gerarCSVPrevia(mockPreviaComPendencias);
      expect(res.fileName).toContain("ORBE_PREVIA_CONTABIL_NAO_OFICIAL_");
    }).not.toThrow();
  });

  // 4. REQUISITO 5: IDENTIFICAÇÃO CLARA COMO PRÉVIA NÃO OFICIAL
  it("4. IDENTIFICAÇÃO NÃO OFICIAL: destaca 'PREVIA' e 'NAO_OFICIAL' no nome do arquivo e coluna própria", () => {
    const res = ContabilOficialService.gerarCSVPrevia(mockPreviaValida);

    // Nome do arquivo:
    expect(res.fileName).toMatch(/^ORBE_PREVIA_CONTABIL_NAO_OFICIAL_esc-log-stica-matriz_2026-09_\d{14}\.csv$/);

    // Coluna do CSV:
    const lines = res.csvContent.split("\r\n");
    expect(lines[0].endsWith("TipoExportacao")).toBe(true);
    expect(lines[1].endsWith("PREVIA_NAO_OFICIAL")).toBe(true);
    expect(lines[2].endsWith("PREVIA_NAO_OFICIAL")).toBe(true);
  });

  // 5. REQUISITO 9: CARACTERES ESPECIAIS, ASPAS E QUEBRAS DE LINHA
  it("5. CARACTERES ESPECIAIS: sanitiza ponto e vírgula, aspas duplas e quebras de linha com integridade", () => {
    const previaComEspeciais: PreviaContabilConsolidada = {
      ...mockPreviaValida,
      lancamentos: [
        {
          id: "lanc-esp",
          data: "2026-09-20",
          origem: "Serviço Extra",
          origem_tipo: "RECEITA_SERVICO_EXTRA",
          documento: 'NF; "123/A"',
          historico: 'Serviço de etiquetagem;\r\nPaletes padrão "A"',
          conta_debito: "1.1.02.001",
          conta_credito: "3.1.01.002",
          valor: 850.75,
          empresa_id: "emp-matriz",
          empresa_nome: "ESC Logística Matriz",
          centro_custo: "OPERACIONAL",
          mapeado: true,
          status_origem: "FATURADO",
        },
      ],
    };

    const res = ContabilOficialService.gerarCSVPrevia(previaComEspeciais);
    const lines = res.csvContent.split("\r\n");

    // Quebra de linha interna deve ter sido substituída por espaço (mantendo exatamente 2 linhas no CSV total)
    expect(lines.length).toBe(2);

    // Documento com ';' e aspas escapadas
    expect(lines[1]).toContain('"NF; ""123/A"""');

    // Histórico com ';' e aspas duplas devidamente escapadas
    expect(lines[1]).toContain('"Serviço de etiquetagem; Paletes padrão ""A"""');
  });

  // 6. REQUISITO 9: DADOS VAZIOS (COMPETÊNCIA SEM LANÇAMENTOS)
  it("6. DADOS VAZIOS: gera CSV contendo cabeçalho válido mesmo sem lançamentos apurados", () => {
    const previaVazia: PreviaContabilConsolidada = {
      ...mockPreviaValida,
      total_lancamentos: 0,
      total_debito: 0,
      total_credito: 0,
      lancamentos: [],
    };

    const res = ContabilOficialService.gerarCSVPrevia(previaVazia);
    const lines = res.csvContent.split("\r\n");

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(
      "Empresa;Competencia;Data;Origem;Documento;Historico;ContaDebito;ContaCredito;Valor;TipoExportacao"
    );
  });

  // 7. REQUISITO 4 & RESTRIÇÃO: AUSÊNCIA DE EFEITOS FINANCEIROS E LOGS DEFINITIVOS
  it("7. ISENÇÃO DE EFEITOS FINANCEIROS: gerarCSVPrevia não registra log definitivo em contabil_logs_integracao", () => {
    const supabaseFromSpy = vi.spyOn(supabase, "from");

    ContabilOficialService.gerarCSVPrevia(mockPreviaValida);

    // A gravação em contabil_logs_integracao é exclusiva da exportação definitiva oficial
    expect(supabaseFromSpy).not.toHaveBeenCalledWith("contabil_logs_integracao");
  });

  // 8. REQUISITO 7 & 8: DESIGN SYSTEM CONT-08 E RBAC NA TELA
  it("8. DESIGN SYSTEM E RBAC: renderiza botão secundário 'Baixar CSV de Prévia' para Contador, Admin e Financeiro", async () => {
    // Simula perfil Contador
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "contador",
      isAdmin: false,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => true,
      hasPermission: () => true,
      refetch: async () => {},
      loading: false,
    } as any);

    vi.spyOn(ContabilOficialService, "gerarPreviaContabil").mockResolvedValue(mockPreviaComPendencias);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/integracao?empresa_id=emp-matriz&competencia=2026-10"]}>
          <IntegracaoContabil />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Botão secundário de prévia deve estar visível
    const previaBtn = await screen.findByRole("button", { name: /baixar csv de prévia/i });
    expect(previaBtn).toBeDefined();

    // Classes do Design System CONT-08 (secundário: h-9 px-3.5 gap-2 text-sm font-medium border-border)
    expect(previaBtn.className).toContain("h-9");
    expect(previaBtn.className).toContain("px-3.5");
    expect(previaBtn.className).toContain("gap-2");
    expect(previaBtn.className).toContain("text-sm");
    expect(previaBtn.className).toContain("font-medium");
    expect(previaBtn.className).toContain("border-border");

    // Aguarda a resolução da prévia para certificar que o botão fica habilitado mesmo com pendências
    await waitFor(() => {
      expect(previaBtn.hasAttribute("disabled")).toBe(false);
    });

    // Botão primário oficial deve permanecer DESABILITADO devido às pendências da competência
    const oficialBtn = screen.getByRole("button", { name: /exportar csv contábil/i });
    expect(oficialBtn.hasAttribute("disabled")).toBe(true);
    expect(oficialBtn.className).toContain("bg-primary");
  });

  // 9. REQUISITO 8: BLOQUEIO RBAC PARA PERFIS NÃO AUTORIZADOS
  it("9. RBAC: oculta botões e bloqueia visualização para perfis não autorizados (ex: operador)", async () => {
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "operador",
      isAdmin: false,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => false,
      hasPermission: () => false,
      refetch: async () => {},
      loading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/integracao?empresa_id=emp-matriz&competencia=2026-10"]}>
          <IntegracaoContabil />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Alerta de governança exibido
    expect(screen.getByText(/Acesso Restrito à Controladoria e Administração/i)).toBeDefined();

    // Nenhum botão de prévia ou exportação deve ser renderizado
    expect(screen.queryByRole("button", { name: /baixar csv de prévia/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /exportar csv contábil/i })).toBeNull();
  });

  // 10. REQUISITO 1 & FEEDBACK: DISPARO DO DOWNLOAD AO CLICAR NO BOTÃO
  it("10. INTERAÇÃO E TOAST: ao clicar no botão de prévia, gera o arquivo e notifica o usuário via toast", async () => {
    vi.spyOn(AccessControlContext, "useAccessControl").mockReturnValue({
      role: "contador",
      isAdmin: false,
      permissions: {},
      tenantId: "tenant-123",
      canAccess: () => true,
      hasPermission: () => true,
      refetch: async () => {},
      loading: false,
    } as any);

    vi.spyOn(ContabilOficialService, "gerarPreviaContabil").mockResolvedValue(mockPreviaComPendencias);
    const gerarPreviaSpy = vi.spyOn(ContabilOficialService, "gerarCSVPrevia");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/integracao?empresa_id=emp-matriz&competencia=2026-10"]}>
          <IntegracaoContabil />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const previaBtn = await screen.findByRole("button", { name: /baixar csv de prévia/i });

    // Aguarda o botão ficar habilitado após resolução da query
    await waitFor(() => {
      expect(previaBtn.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(previaBtn);

    expect(gerarPreviaSpy).toHaveBeenCalledWith(mockPreviaComPendencias);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/CSV de prévia gerado para conferência: ORBE_PREVIA_CONTABIL_NAO_OFICIAL_/i)
    );
  });
});
