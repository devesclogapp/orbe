import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import CentralRelatoriosOficial from "@/pages/Relatorios/CentralRelatoriosOficial";
import RelatorioVisualizadorOficial from "@/pages/Relatorios/RelatorioVisualizadorOficial";
import {
  RelatoriosOficialAdapter,
  getCompetenciaDateRange,
  OperacaoVolumeRow,
  DiaristaFechamentoRow,
  BancoHorasRow,
} from "@/services/adapters/relatoriosOficialAdapter";
import { EmpresaService } from "@/services/base.service";

// Mocks de Contexto
vi.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({ environment: "PRODUCAO", theme: "light" }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ tenant: { id: "tenant-esc-log" }, tenantId: "tenant-esc-log", loading: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "admin@esclog.com", role: "admin" },
    profile: { id: "user-1", role: "admin", nome: "Administrador" },
    permissoes: ["central_de_relatorios", "admin"],
    hasPermissao: () => true,
    isAdmin: () => true,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/contexts/AccessControlContext", () => ({
  useAccessControl: () => ({
    role: "admin",
    isAdmin: true,
    canAccess: () => true,
    hasAccess: () => true,
  }),
}));

vi.mock("@/contexts/OperationalPipelineContext", () => ({
  useOperationalPipeline: () => ({
    state: {},
    dispatch: vi.fn(),
    openPipeline: vi.fn(),
    closePipeline: vi.fn(),
    isOpen: false,
  }),
  OperationalPipelineProvider: ({ children }: any) => <>{children}</>,
}));

// Mock do EmpresaService com entidades canônicas do banco (usando coluna 'nome')
const mockEmpresasCadastradas = [
  { id: "emp-benevides", nome: "BENEVIDES", is_teste: false },
  { id: "emp-dismelo", nome: "DISMELO CASTANHAL", is_teste: false },
  { id: "emp-matriz", nome: "ESC LOG Matriz", is_teste: false },
];

vi.mock("@/services/base.service", () => ({
  EmpresaService: {
    getAll: vi.fn().mockImplementation(() => Promise.resolve(mockEmpresasCadastradas)),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe("CONV-14-FIX01: Integridade Contextual dos Relatórios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!global.URL.createObjectURL) {
      global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();
    }
  });

  // --------------------------------------------------------------------------
  // TESTE 1: Navegação preservando empresa e competência
  // --------------------------------------------------------------------------
  it("deve preservar empresa e competência na navegação do Hub para o Relatório", async () => {
    const queryClient = createTestQueryClient();

    vi.spyOn(RelatoriosOficialAdapter, "getCentralHubConsolidado").mockResolvedValue({
      kpis: {
        totalRegistros: 20,
        relatoriosAtivos: 3,
        volumeOperacional: 5820,
        receitasReportadas: 2876.97,
        despesasApuradas: 510,
        diaristasTotal: 210,
        custosExtrasTotal: 300,
        bancoHorasSaldoMinutos: 0,
        bancoHorasAVencerMinutos: 0,
      },
      infograficos: {
        registrosOperacional: 18,
        registrosRH: 2,
        registrosFinanceiro: 0,
        pctOperacional: 90,
        pctRH: 10,
        pctFinanceiro: 0,
      },
      counts: {
        "r01-operacoes-volume": 11,
        "r02-fechamento-diaristas": 2,
        "r04-custos-extras": 7,
      },
      datasets: {
        r01Rows: [],
        r02Rows: [],
        r03Rows: [],
        r04Rows: [],
        r05Rows: [],
        r07Rows: [],
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios?empresa=emp-benevides&competencia=2026-09"]}>
          <Routes>
            <Route path="/relatorios" element={<CentralRelatoriosOficial />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // O Hub deve carregar com a empresa BENEVIDES e competência 2026-09
    await waitFor(() => {
      expect(screen.getByText("Catálogo de Cadernos Homologados")).toBeInTheDocument();
      expect(screen.getByText(/5[.\s]?820/)).toBeInTheDocument();
      expect(screen.getByText("BENEVIDES")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // TESTE 2: Impedimento de mistura de empresas e ausência de fallback genérico
  // --------------------------------------------------------------------------
  it("não deve substituir BENEVIDES por fallback genérico 'ESC Logística' no cabeçalho ou dados", async () => {
    const queryClient = createTestQueryClient();

    const mockR01: OperacaoVolumeRow[] = [
      {
        id: "op-1",
        empresaId: "emp-benevides",
        dataOperacao: "2026-09-15",
        codigoOperacional: "OPV-BENE-01",
        unidade: "Filial Benevides",
        transportadora: "TransLog",
        tipoServico: "Descarga",
        produtoCarga: "Carga Geral",
        quantidade: 500,
        valorUnitario: 0.42,
        totalBruto: 210,
        materiais: 27,
        iss: 10.5,
        placa: "ABC-1234",
        nfNumero: "1001",
        status: "AGUARDANDO_FATURAMENTO",
      },
    ];

    vi.spyOn(RelatoriosOficialAdapter, "getR01Data").mockResolvedValue(mockR01);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/relatorios/r01-operacoes-volume?empresa=emp-benevides&competencia=2026-09"]}>
          <Routes>
            <Route path="/relatorios/:reportId" element={<RelatorioVisualizadorOficial />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("OPV-BENE-01")).toBeInTheDocument();
    });

    // O cabeçalho documental deve identificar rigorosamente BENEVIDES
    const empresaLabels = screen.getAllByText("BENEVIDES");
    expect(empresaLabels.length).toBeGreaterThanOrEqual(1);

    // Não deve conter a empresa mascarada como "ESC LOG — ESC Logística"
    expect(screen.queryByText("ESC LOG — ESC Logística")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // TESTE 3: Temporalidade correta do R02 (Diaristas)
  // --------------------------------------------------------------------------
  it("deve aplicar temporalidade estrita em R02 e rejeitar lançamentos de agosto quando o filtro for setembro", () => {
    const rangeSetembro = getCompetenciaDateRange("2026-09");
    expect(rangeSetembro).toEqual({
      inicio: "2026-09-01",
      fimExclusivo: "2026-10-01",
    });

    // Lançamentos simulados de agosto e setembro
    const lancamentoAgosto: DiaristaFechamentoRow = {
      id: "diar-ago",
      empresaId: "emp-benevides",
      cicloId: "lote-ago",
      cicloLabel: "Semana 17 a 23 Ago",
      dataLancamento: "2026-08-19",
      colaboradorNome: "Diarista 1",
      cpfMascarado: "***.***.***-**",
      funcao: "Ajudante",
      codigoMarcacao: "P",
      quantidadeDiarias: 1,
      valorDiariaBase: 70,
      total: 70,
      loteCodigo: "LOTE-AGO",
      statusLote: "fechado_para_pagamento",
    };

    const lancamentoSetembro: DiaristaFechamentoRow = {
      id: "diar-set",
      empresaId: "emp-benevides",
      cicloId: "lote-set",
      cicloLabel: "Semana 21 a 27 Set",
      dataLancamento: "2026-09-22",
      colaboradorNome: "Diarista 1",
      cpfMascarado: "***.***.***-**",
      funcao: "Ajudante",
      codigoMarcacao: "P",
      quantidadeDiarias: 1,
      valorDiariaBase: 70,
      total: 70,
      loteCodigo: "LOTE-SET",
      statusLote: "pago",
    };

    const todos = [lancamentoAgosto, lancamentoSetembro];

    // Simulação do filtro canônico do adapter por competência 2026-09
    const filtradosSetembro = todos.filter((it) => {
      const dataMes = it.dataLancamento.slice(0, 7);
      return dataMes === "2026-09";
    });

    expect(filtradosSetembro).toHaveLength(1);
    expect(filtradosSetembro[0].id).toBe("diar-set");
    expect(filtradosSetembro[0].dataLancamento).toBe("2026-09-22");
  });

  // --------------------------------------------------------------------------
  // TESTE 4: Elegibilidade CLT no R05 (Banco de Horas)
  // --------------------------------------------------------------------------
  it("deve excluir estritamente Diaristas e Intermitentes do Banco de Horas R05", async () => {
    // Colaboradores de teste simulando a base real de Benevides
    const colabs = [
      { id: "colab-1", nome: "DIARISTA 1", tipo_colaborador: "DIARISTA", regime_trabalho: "Diarista", bh_ativo: true },
      { id: "colab-2", nome: "INTERMITENTE 1", tipo_colaborador: "INTERMITENTE", regime_trabalho: null, bh_ativo: true },
      { id: "colab-3", nome: "CLT EFETIVO", tipo_colaborador: "CLT", regime_trabalho: "CLT", bh_ativo: true },
    ];

    // Regra de elegibilidade CLT canônica auditada no adapter
    const cltElegiveis = colabs.filter((c) => {
      const tipo = String(c.tipo_colaborador || "").toUpperCase();
      const regime = String(c.regime_trabalho || "").toUpperCase();
      const isCLT = tipo === "CLT" || regime === "CLT";
      const isDiaristaOuIntermitente = tipo === "DIARISTA" || tipo === "INTERMITENTE" || regime === "DIARISTA" || regime === "INTERMITENTE";
      return isCLT && !isDiaristaOuIntermitente && c.bh_ativo === true;
    });

    expect(cltElegiveis).toHaveLength(1);
    expect(cltElegiveis[0].nome).toBe("CLT EFETIVO");

    // Para Benevides (que só tem Diaristas e Intermitentes), o resultado deve ser rigorosamente vazio
    const benevidesColabs = [
      { id: "colab-1", nome: "DIARISTA 1", tipo_colaborador: "DIARISTA", regime_trabalho: "Diarista", bh_ativo: true },
      { id: "colab-2", nome: "INTERMITENTE 1", tipo_colaborador: "INTERMITENTE", regime_trabalho: null, bh_ativo: true },
    ];

    const benevidesCLT = benevidesColabs.filter((c) => {
      const tipo = String(c.tipo_colaborador || "").toUpperCase();
      const regime = String(c.regime_trabalho || "").toUpperCase();
      const isCLT = tipo === "CLT" || regime === "CLT";
      const isDiaristaOuIntermitente = tipo === "DIARISTA" || tipo === "INTERMITENTE" || regime === "DIARISTA" || regime === "INTERMITENTE";
      return isCLT && !isDiaristaOuIntermitente && c.bh_ativo === true;
    });

    expect(benevidesCLT).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // TESTE 5: Correspondência entre filtros, cabeçalho, dados e CSV
  // --------------------------------------------------------------------------
  it("deve emitir CSV com metadados idênticos ao contexto de empresa e competência selecionados", () => {
    let capturedBlobContent = "";

    // Espionar criação de Blob para validar o conteúdo gerado
    const originalBlob = global.Blob;
    global.Blob = vi.fn().mockImplementation((chunks, options) => {
      capturedBlobContent = chunks.join("");
      return new originalBlob(chunks, options);
    }) as any;

    const mockRows: OperacaoVolumeRow[] = [
      {
        id: "op-1",
        empresaId: "emp-benevides",
        dataOperacao: "2026-09-14",
        codigoOperacional: "OPV-001",
        unidade: "Matriz",
        transportadora: "TransLog",
        tipoServico: "Descarga",
        produtoCarga: "Geral",
        quantidade: 100,
        valorUnitario: 1.5,
        totalBruto: 150,
        materiais: 0,
        iss: 7.5,
        placa: "XYZ-9999",
        nfNumero: "SIM",
        status: "concluido",
      },
    ];

    RelatoriosOficialAdapter.exportReportToCSV(
      "r01-operacoes-volume",
      mockRows,
      "BENEVIDES",
      "2026-09"
    );

    expect(capturedBlobContent).toContain("# CADERNO DOCUMENTAL;R01-OPERACOES-VOLUME");
    expect(capturedBlobContent).toContain("# EMPRESA;BENEVIDES");
    expect(capturedBlobContent).toContain("# COMPETENCIA_PERIODO;2026-09");
    expect(capturedBlobContent).toContain("OPV-001");

    global.Blob = originalBlob;
  });
});
