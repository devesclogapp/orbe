import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CentralBancariaDrawerOficial } from "@/components/bancario/CentralBancariaDrawerOficial";
import { ItemObrigacaoBancariaOficial } from "@/services/bancarioOficialAdapter";
import { EnvironmentService } from "@/services/environment/EnvironmentService";

// Mock do supabase e auth
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "user-123", email: "operador@orbe.com" },
  }),
}));

describe("FIX-CNAB-03 — SEGURANÇA VISUAL DA REMESSA DE HOMOLOGAÇÃO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseContaPagadora = {
    id: "faecb252-7b9e-407d-93a5-e10466d35b0e",
    empresaId: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
    bancoCodigo: "341",
    bancoNome: "Itaú Unibanco S.A.",
    agencia: "1234",
    conta: "56789",
    agenciaMascarada: "Ag: 1234",
    contaMascarada: "Cc: 56789-0",
    cedenteNome: "Empresa Teste LTDA",
    permiteCnab: true,
    ativo: true,
  };

  const itemHomologacao: ItemObrigacaoBancariaOficial = {
    id: "clt-7d132d84-f3a7-4a5a-a460-1d23727d2537",
    referencia: "CLT-2026-07",
    origemTipo: "CLT",
    loteId: "7d132d84-f3a7-4a5a-a460-1d23727d2537",
    loteCodigo: "RH-CLT-2026-07",
    empresaId: "28a560b5-37ef-403d-ae4f-b28a608b6a68",
    empresaNome: "Empresa Teste - Homologação",
    isEmpresaTeste: true,
    competencia: "2026-07",
    favorecidoDescricao: "4 Colaborador(es) CLT",
    favorecidoNomeMascarado: "Folha Salarial Mensal CLT",
    documentoFavorecidoMascarado: "Contas Salário Diversas",
    dadosBancariosFavorecidoMascarado: "Contas Salário / Corrente Diversas",
    quantidadeFavorecidos: 4,
    valorTotal: 2400,
    valorEsperado: 2400,
    contaPagadora: baseContaPagadora,
    situacao: "REMESSA_GERADA",
    estagioTab: "REMESSAS",
    remessaId: "b0ff6ec2-d99c-4089-8878-6732971bec44",
    remessaNumero: "REM-000008",
    remessaNsa: 8,
    remessaHash: "c98ee3e370e063ec4fa03c8baf0f018e340b42447738fd7eac628ddacd923091",
    remessaDataGeracao: "2026-10-14T15:41:11.883092+00:00",
    remessaNomeArquivo: "SIMULACAO_HOMOLOGACAO_ITAU_20261014_SEQ000008.txt",
    remessaQtdRegistros: 8,
    remessaModo: "homologacao", // Modo persistido no banco
    preValidacao: {
      contaValida: true,
      dadosObrigatorios: true,
      favorecidosAptos: true,
      qtdFavorecidosAptos: 4,
      qtdFavorecidosInaptos: 0,
      valorConsolidado: true,
      inconsistencias: [],
    },
    timeline: [
      {
        etapa: "Geração da Remessa",
        dataHora: "14/10/2026",
        responsavel: "Operador Financeiro",
        descricao: "Arquivo SIMULACAO_HOMOLOGACAO_ITAU_20261014_SEQ000008.txt gerado com sucesso.",
        status: "concluido",
      },
    ],
  };

  const itemProducao: ItemObrigacaoBancariaOficial = {
    ...itemHomologacao,
    id: "clt-prod-12345",
    empresaNome: "ESC LOG TRANSPORTES LTDA",
    isEmpresaTeste: false,
    remessaNomeArquivo: "CNAB240_ITAU_20261014_SEQ000008.txt",
    remessaModo: "producao", // Modo de produção persistido
  };

  it("1. REMESSA DE HOMOLOGAÇÃO: Exibe aviso explícito de arquivo não bancário e bloqueio de transmissão", () => {
    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemHomologacao}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // Confirma mensagem canônica exigida
    expect(
      screen.getByText(/SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Este arquivo foi gerado exclusivamente para testes do ERP ORBE\. Não possui estrutura posicional FEBRABAN válida e não deve ser transmitido ao banco\./i
      )
    ).toBeInTheDocument();

    // Orientações de auditoria substituem instruções de envio bancário
    expect(screen.getByText(/Orientações de Auditoria:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Baixe o arquivo e transmita manualmente pelo portal/i)).not.toBeInTheDocument();

    // Botão de download do relatório de simulação preservado
    expect(screen.getByText(/Baixar Relatório de Simulação/i)).toBeInTheDocument();
  });

  it("2. REMESSA DE HOMOLOGAÇÃO (ARQUIVO BAIXADO): Não oferece botão de envio bancário real e exibe badge de segurança", () => {
    const itemBaixado: ItemObrigacaoBancariaOficial = {
      ...itemHomologacao,
      situacao: "ARQUIVO_BAIXADO",
    };

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemBaixado}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // Botão 'Marcar como Enviado' NÃO deve aparecer para homologação
    expect(screen.queryByText("Marcar como Enviado")).not.toBeInTheDocument();

    // Badge de segurança de homologação presente
    expect(
      screen.getByText(/Simulação Homologada \(Sem Envio Bancário\)/i)
    ).toBeInTheDocument();

    // Botão de re-download preservado
    expect(screen.getByText(/Baixar Relatório Novamente/i)).toBeInTheDocument();
  });

  it("3. REMESSA DE PRODUÇÃO: Preserva instruções de transmissão bancária e fluxo de envio", () => {
    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemProducao}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // Mensagem de não-transmissão NÃO deve ser exibida em produção
    expect(
      screen.queryByText(/SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO/i)
    ).not.toBeInTheDocument();

    // Instruções normais de transmissão bancária preservadas
    expect(
      screen.getByText(/Atenção ao fluxo de envio bancário:/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Baixe o arquivo e transmita manualmente pelo portal do Itaú Unibanco S\.A\./i)
    ).toBeInTheDocument();

    // Botão de download de arquivo TXT padrão de produção
    expect(screen.getByText("Baixar Arquivo TXT")).toBeInTheDocument();
  });

  it("4. ATUALIZAÇÃO DE PÁGINA E ALTERNÂNCIA DE AMBIENTE: Classificação é soberana a partir do modo persistido", () => {
    // Simula que a sessão global foi alternada para 'production', mas a remessa persistida tem remessaModo = 'homologacao'
    vi.spyOn(EnvironmentService, "getCurrentEnvironment").mockReturnValue("production");

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemHomologacao}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // Permanece classificada como homologação com base em remessaModo
    expect(
      screen.getByText(/SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Baixar Relatório de Simulação/i)).toBeInTheDocument();
  });
});
