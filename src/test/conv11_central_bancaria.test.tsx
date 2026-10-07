import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import { CentralBancariaDrawerOficial } from "@/components/bancario/CentralBancariaDrawerOficial";
import {
  BancarioOficialAdapter,
  calculateCentralBancariaKpiStats,
  ItemObrigacaoBancariaOficial,
  maskCnpj,
  maskCpf,
  maskConta,
  maskAgencia,
  getSituacaoBadge,
  getOrigemBadge,
} from "@/services/bancarioOficialAdapter";
import { MotorCNAB240, validarEmpresaPagadora } from "@/services/cnab/motorCNAB240.service";
import { CNABWriterFactory } from "@/services/cnab/CNABWriterFactory";
import { CNABRetornoReaderFactory } from "@/services/cnab/CNABRetornoReaderFactory";

describe("CONV-11 — CENTRAL BANCÁRIA & CNAB: Suíte Oficial de Convergência", () => {
  const centralBancariaPath = path.resolve(__dirname, "../pages/CentralBancaria.tsx");
  const centralBancariaContent = fs.readFileSync(centralBancariaPath, "utf-8");

  const adapterPath = path.resolve(__dirname, "../services/bancarioOficialAdapter.ts");
  const adapterContent = fs.readFileSync(adapterPath, "utf-8");

  const drawerPath = path.resolve(__dirname, "../components/bancario/CentralBancariaDrawerOficial.tsx");
  const drawerContent = fs.readFileSync(drawerPath, "utf-8");

  const modalRetornoPath = path.resolve(__dirname, "../components/bancario/ImportarRetornoModalOficial.tsx");
  const modalRetornoContent = fs.readFileSync(modalRetornoPath, "utf-8");

  const uxLabCentralBancariaPath = path.resolve(__dirname, "../pages/UxLab/UxLabCentralBancaria.tsx");
  const uxLabCentralBancariaContent = fs.readFileSync(uxLabCentralBancariaPath, "utf-8");

  // -------------------------------------------------------------------------
  // 1. ROTA OFICIAL E AUSÊNCIA DE MOCKS
  // -------------------------------------------------------------------------
  it("01. rota oficial /bancario implementa a esteira unificada da UX13", () => {
    expect(centralBancariaContent).toContain('"Central Bancária & CNAB"');
    expect(centralBancariaContent).toContain("Esteira unificada de remessas, retornos e conciliações dos pagamentos bancarizados.");
  });

  it("02. ZERO mocks na rota oficial /bancario", () => {
    expect(centralBancariaContent).not.toContain("MOCK_CENTRAL_BANCARIA_ITENS");
    expect(centralBancariaContent).not.toContain("centralBancariaMockData");
    expect(centralBancariaContent).not.toContain("UxLabCentralBancaria");
    expect(adapterContent).not.toContain("MOCK_CENTRAL_BANCARIA_ITENS");
  });

  // -------------------------------------------------------------------------
  // 2. FONTES REAIS E CUSTOS EXTRAS
  // -------------------------------------------------------------------------
  it("03. fontes reais CLT, Diaristas e Intermitentes aparecem no adapter", () => {
    expect(adapterContent).toContain('"rh_financeiro_lotes"');
    expect(adapterContent).toContain('"diaristas_lotes_fechamento"');
    expect(adapterContent).toContain('"intermitentes_lotes_fechamento"');
    expect(adapterContent).toContain('"cnab_remessas_arquivos"');
    expect(adapterContent).toContain('"cnab_retorno_itens"');
  });

  it("04. REGRA ABSOLUTA: CUSTOS EXTRAS → CNAB = NÃO", () => {
    // Custos extras NUNCA entram no motor CNAB nem no adapter bancário
    expect(adapterContent).not.toContain("custos_extras");
    expect(adapterContent).not.toContain("custo_extra");
    expect(adapterContent).not.toContain("CUSTO_EXTRA");
    expect(centralBancariaContent).not.toContain("custos_extras");
    expect(centralBancariaContent).not.toContain("custo_extra");
  });

  // -------------------------------------------------------------------------
  // 3. KPIS CONTEXTUAIS E COERÊNCIA MATEMÁTICA
  // -------------------------------------------------------------------------
  it("05. KPIs utilizam universo contextual e derivam estritamente dos itens", () => {
    const itensTeste: ItemObrigacaoBancariaOficial[] = [
      {
        id: "1",
        referencia: "CLT-2026-10",
        origemTipo: "CLT",
        loteId: "lote-1",
        empresaId: "emp-1",
        empresaNome: "Empresa 1",
        competencia: "2026-10",
        favorecidoDescricao: "10 CLT",
        favorecidoNomeMascarado: "Folha CLT",
        documentoFavorecidoMascarado: "Contas Diversas",
        dadosBancariosFavorecidoMascarado: "Contas Diversas",
        quantidadeFavorecidos: 10,
        valorTotal: 50000,
        valorEsperado: 50000,
        contaPagadora: {
          id: "cta-1",
          bancoCodigo: "001",
          bancoNome: "Banco do Brasil",
          agencia: "1234",
          agenciaMascarada: "Ag. 1234",
          conta: "56789-0",
          contaMascarada: "Cc •••• 89-0",
          cedenteNome: "Empresa 1",
          cedenteCnpjMascarado: "00.000.000/0001-••",
          permiteCnab: true,
          ativo: true,
        },
        situacao: "PRONTO_BANCO",
        estagioTab: "PRONTAS_BANCO",
        preValidacao: { contaValida: true, dadosObrigatorios: true, favorecidosAptos: true, valorConsolidado: true, inconsistencias: [] },
        timeline: [],
      },
      {
        id: "2",
        referencia: "DIA-SEM43",
        origemTipo: "DIARISTAS",
        loteId: "lote-2",
        empresaId: "emp-1",
        empresaNome: "Empresa 1",
        competencia: "2026-10",
        favorecidoDescricao: "5 Diaristas",
        favorecidoNomeMascarado: "Diaristas",
        documentoFavorecidoMascarado: "PIX",
        dadosBancariosFavorecidoMascarado: "PIX",
        quantidadeFavorecidos: 5,
        valorTotal: 15000,
        valorEsperado: 15000,
        contaPagadora: {
          id: "cta-1",
          bancoCodigo: "001",
          bancoNome: "Banco do Brasil",
          agencia: "1234",
          agenciaMascarada: "Ag. 1234",
          conta: "56789-0",
          contaMascarada: "Cc •••• 89-0",
          cedenteNome: "Empresa 1",
          cedenteCnpjMascarado: "00.000.000/0001-••",
          permiteCnab: true,
          ativo: true,
        },
        situacao: "ENVIADO_MANUAL",
        estagioTab: "AGUARDANDO_RETORNO",
        preValidacao: { contaValida: true, dadosObrigatorios: true, favorecidosAptos: true, valorConsolidado: true, inconsistencias: [] },
        timeline: [],
      },
      {
        id: "3",
        referencia: "INT-2026-10",
        origemTipo: "INTERMITENTES",
        loteId: "lote-3",
        empresaId: "emp-1",
        empresaNome: "Empresa 1",
        competencia: "2026-10",
        favorecidoDescricao: "3 Intermitentes",
        favorecidoNomeMascarado: "Intermitentes",
        documentoFavorecidoMascarado: "TED",
        dadosBancariosFavorecidoMascarado: "TED",
        quantidadeFavorecidos: 3,
        valorTotal: 8000,
        valorEsperado: 8000,
        contaPagadora: {
          id: "cta-1",
          bancoCodigo: "001",
          bancoNome: "Banco do Brasil",
          agencia: "1234",
          agenciaMascarada: "Ag. 1234",
          conta: "56789-0",
          contaMascarada: "Cc •••• 89-0",
          cedenteNome: "Empresa 1",
          cedenteCnpjMascarado: "00.000.000/0001-••",
          permiteCnab: true,
          ativo: true,
        },
        situacao: "LIQUIDADO",
        estagioTab: "CONCILIACAO",
        preValidacao: { contaValida: true, dadosObrigatorios: true, favorecidosAptos: true, valorConsolidado: true, inconsistencias: [] },
        timeline: [],
      },
      {
        id: "4",
        referencia: "DIA-SEM42",
        origemTipo: "DIARISTAS",
        loteId: "lote-4",
        empresaId: "emp-1",
        empresaNome: "Empresa 1",
        competencia: "2026-10",
        favorecidoDescricao: "1 Diarista Rejeitado",
        favorecidoNomeMascarado: "Diarista",
        documentoFavorecidoMascarado: "PIX",
        dadosBancariosFavorecidoMascarado: "PIX",
        quantidadeFavorecidos: 1,
        valorTotal: 500,
        valorEsperado: 500,
        contaPagadora: {
          id: "cta-1",
          bancoCodigo: "001",
          bancoNome: "Banco do Brasil",
          agencia: "1234",
          agenciaMascarada: "Ag. 1234",
          conta: "56789-0",
          contaMascarada: "Cc •••• 89-0",
          cedenteNome: "Empresa 1",
          cedenteCnpjMascarado: "00.000.000/0001-••",
          permiteCnab: true,
          ativo: true,
        },
        situacao: "REJEITADO",
        estagioTab: "PENDENCIAS",
        preValidacao: { contaValida: true, dadosObrigatorios: true, favorecidosAptos: true, valorConsolidado: true, inconsistencias: [] },
        timeline: [],
      },
    ];

    const stats = calculateCentralBancariaKpiStats(itensTeste);
    expect(stats.prontasValor).toBe(50000);
    expect(stats.prontasQtdLotes).toBe(1);
    expect(stats.emTransitoValor).toBe(15000);
    expect(stats.emTransitoEnviadasQtd).toBe(1);
    expect(stats.liquidadasValor).toBe(8000);
    expect(stats.liquidadasQtdItens).toBe(3);
    expect(stats.pendenciasValor).toBe(500);
    expect(stats.pendenciasRejeitadosQtd).toBe(1);
    expect(stats.pendenciasQtdTotal).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 4. MULTIBANCO BB (001) E ITAÚ (341) E FAIL-CLOSED
  // -------------------------------------------------------------------------
  it("06. BB (001) e Itaú (341) são suportados; qualquer outro banco é fail-closed", () => {
    expect(MotorCNAB240.isBancoSuportado("001")).toBe(true);
    expect(MotorCNAB240.isBancoSuportado("341")).toBe(true);
    expect(MotorCNAB240.isBancoSuportado("237")).toBe(false);
    expect(MotorCNAB240.isBancoSuportado("033")).toBe(false);

    expect(CNABRetornoReaderFactory.isBancoHomologado("001")).toBe(true);
    expect(CNABRetornoReaderFactory.isBancoHomologado("341")).toBe(true);
    expect(CNABRetornoReaderFactory.isBancoHomologado("104")).toBe(false);

    expect(() => CNABWriterFactory.create("999")).toThrow(/ainda não possui layout CNAB240 homologado/);
    expect(() => CNABRetornoReaderFactory.getReaderForBanco("999")).toThrow(/ainda não possui retorno CNAB240 homologado/);
  });

  // -------------------------------------------------------------------------
  // 5. GERAÇÃO DE REMESSA: EXIGE EMPRESA E CONTA E REUTILIZA SERVIÇOS
  // -------------------------------------------------------------------------
  it("07. geração CNAB exige empresa pagadora com CNPJ e razão social válidos", () => {
    const empresaSemCnpj = {
      razao_social: "Empresa Teste",
      cnpj: "",
      banco_codigo: "001",
      agencia: "1234",
      conta: "56789",
    };
    const validacao = validarEmpresaPagadora(empresaSemCnpj as any);
    expect(validacao.valido).toBe(false);
    expect(validacao.erro).toContain("CNPJ/CPF da empresa pagadora");
  });

  it("08. geração CNAB reutiliza os serviços e RPCs oficiais existentes", () => {
    expect(drawerContent).toContain("CNABService.generateRemessa");
    expect(drawerContent).toContain("LoteFechamentoDiaristaService.gerarRemessaCNAB");
    expect(drawerContent).toContain("IntermitentesLoteService.gerarRemessaCNAB");
  });

  // -------------------------------------------------------------------------
  // 6. DOWNLOAD ≠ TRANSMISSÃO
  // -------------------------------------------------------------------------
  it("09. Download do arquivo NÃO marca automaticamente como enviado", () => {
    expect(drawerContent).toContain("CnabRemessaArquivoService.marcarComoBaixado");
    expect(drawerContent).toContain("CnabRemessaArquivoService.marcarComoEnviadoManual");
    expect(drawerContent).toContain("Atenção ao fluxo de envio bancário");
    expect(drawerContent).toContain("O download do arquivo no ORBE não realiza a transmissão automática");
  });

  // -------------------------------------------------------------------------
  // 7. RETORNO BANCÁRIO E LIQUIDAÇÃO ITEM A ITEM
  // -------------------------------------------------------------------------
  it("10. modal de retorno utiliza CnabRetornoService.processarArquivo oficial", () => {
    expect(modalRetornoContent).toContain("CnabRetornoService.processarArquivo");
  });

  // -------------------------------------------------------------------------
  // 8. DEEP-LINKS E DESPACHO DO CONV-10
  // -------------------------------------------------------------------------
  it("11. deep-link ?origem= vira filtro da esteira unificada e não aprisiona em aba cega", () => {
    expect(centralBancariaContent).toContain('searchParams.get("origem")');
    expect(centralBancariaContent).toContain('if (orig === "DIARISTA") return "DIARISTAS";');
    expect(centralBancariaContent).toContain('if (orig === "INTERMITENTE") return "INTERMITENTES";');
  });

  it("12. CONV-10 despacha para /bancario", () => {
    const conv10TestPath = path.resolve(__dirname, "./conv10_despesas_contas_pagar.test.tsx");
    const conv10TestContent = fs.readFileSync(conv10TestPath, "utf-8");
    expect(conv10TestContent).toContain('navigate("/bancario")');
  });

  // -------------------------------------------------------------------------
  // 9. RECEITAS DESACOPLADAS DO CNAB DE PAGAMENTOS
  // -------------------------------------------------------------------------
  it("13. Receitas Operacionais permanecem desacopladas com CTA de despacho para /financeiro/retorno", () => {
    expect(centralBancariaContent).toContain('navigate("/financeiro/retorno?tab=receitas")');
    expect(centralBancariaContent).toContain("Conciliação Receitas");
  });

  // -------------------------------------------------------------------------
  // 10. PRESERVAÇÃO INTEGRAL DA UX LAB
  // -------------------------------------------------------------------------
  it("14. arquivos da UX13 no UX Lab permanecem congelados e intactos", () => {
    expect(uxLabCentralBancariaContent).toContain("UxLabCentralBancaria");
    expect(uxLabCentralBancariaContent).toContain("MOCK_CENTRAL_BANCARIA_ITENS");
  });

  // -------------------------------------------------------------------------
  // 11. MASCARAMENTO DE DADOS BANCÁRIOS
  // -------------------------------------------------------------------------
  it("15. dados de agência, conta, CPF e CNPJ são rigorosamente mascarados para visualização", () => {
    expect(maskCnpj("08765432000199")).toBe("08.765.432/0001-••");
    expect(maskCpf("12345678901")).toBe("CPF •••.456.789-••");
    expect(maskConta("45210-8")).toBe("Cc •••• 10-8");
    expect(maskAgencia("3240")).toBe("Ag. 3240");
  });

  // -------------------------------------------------------------------------
  // 12. DESIGN SYSTEM E FILTER BUTTONS
  // -------------------------------------------------------------------------
  it("16. botões de estágio utilizam padrão retangular do Design System (rounded-md, não rounded-full)", () => {
    expect(centralBancariaContent).toContain("rounded-md text-xs font-medium");
    expect(centralBancariaContent).toContain("ExecutiveMetricCard");
  });

  // -------------------------------------------------------------------------
  // 13. CONV-11-FIX01 & FIX02: REGRESSÃO BLOQUEANTE DRAWER PRONTO_BANCO
  // -------------------------------------------------------------------------
  it("17. CONV-11-FIX01: Drawer 'Gerar Remessa' renderiza sem ReferenceError: Check is not defined e exibe checklist de pré-validação", () => {
    const itemProntoBanco: ItemObrigacaoBancariaOficial = {
      id: "teste-pronto-1",
      referencia: "CLT-2026-10",
      origemTipo: "CLT",
      empresaId: "11111111-1111-4111-a111-111111111111",
      empresaNome: "Empresa Teste",
      empresaCnpj: "12345678000190",
      competencia: "10/2026",
      quantidadeBeneficiarios: 15,
      valorTotal: 50000,
      situacao: "PRONTO_BANCO",
      contaPagadora: {
        id: "22222222-2222-4222-a222-222222222222",
        bancoCodigo: "001",
        bancoNome: "Banco do Brasil",
        agenciaMascarada: "Ag. 1234",
        contaMascarada: "Cc •••• 56-7",
        permiteCnab: true,
        ativo: true,
      },
      favorecidoDescricao: "Folha CLT 10/2026",
      favorecidoDocumento: "12345678000190",
      timeline: [],
    };

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemProntoBanco}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // Checklist de pré-validação CNAB renderiza sem ReferenceError
    expect(screen.getByText("Checklist de Pré-Validação CNAB")).toBeInTheDocument();
    expect(screen.getByText("Conta pagadora ativa e habilitada para CNAB:")).toBeInTheDocument();
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(screen.getByText("100% Aptos")).toBeInTheDocument();
    expect(screen.getByText("Consolidado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Remessa CNAB/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 14. CONV-11-FIX02: ELIMINAÇÃO DE "padrao-empresa" E FAIL-CLOSED CANÔNICO
  // -------------------------------------------------------------------------
  it("18. CONV-11-FIX02: 'padrao-empresa' foi 100% eliminado de todos os arquivos oficiais", () => {
    expect(adapterContent).not.toContain('"padrao-empresa"');
    expect(adapterContent).not.toContain("'padrao-empresa'");
    expect(centralBancariaContent).not.toContain("padrao-empresa");
    expect(drawerContent).not.toContain("padrao-empresa");
  });

  it("19. CONV-11-FIX02: item com UUID canônico permite geração com identificadores reais", () => {
    const validEmpresaUuid = "33333333-3333-4333-a333-333333333333";
    const validContaUuid = "44444444-4444-4444-a444-444444444444";

    const itemComContaReal: ItemObrigacaoBancariaOficial = {
      id: "teste-pronto-real",
      referencia: "CLT-2026-07",
      origemTipo: "CLT",
      empresaId: validEmpresaUuid,
      empresaNome: "DISMELO CASTANHAL",
      empresaCnpj: "08765432000199",
      competencia: "07/2026",
      quantidadeBeneficiarios: 1,
      valorTotal: 221.62,
      situacao: "PRONTO_BANCO",
      contaPagadora: {
        id: validContaUuid,
        empresaId: validEmpresaUuid,
        bancoCodigo: "001",
        bancoNome: "Banco do Brasil",
        agenciaMascarada: "Ag. 3240",
        contaMascarada: "Cc •••• 10-8",
        permiteCnab: true,
        ativo: true,
      },
      favorecidoDescricao: "Folha CLT 07/2026",
      favorecidoDocumento: "08765432000199",
      timeline: [],
    };

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemComContaReal}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    const btnGerar = screen.getByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(btnGerar).not.toBeDisabled();
    expect(screen.queryByText(/Bloqueio: Conta bancária não vinculada/i)).not.toBeInTheDocument();
  });

  it("20. CONV-11-FIX02: FAIL-CLOSED bloqueia geração se conta pagadora não for UUID válido", () => {
    const itemSemContaValida: ItemObrigacaoBancariaOficial = {
      id: "teste-pronto-sem-conta",
      referencia: "CLT-2026-07",
      origemTipo: "CLT",
      empresaId: "33333333-3333-4333-a333-333333333333",
      empresaNome: "DISMELO CASTANHAL",
      empresaCnpj: "08765432000199",
      competencia: "07/2026",
      quantidadeBeneficiarios: 1,
      valorTotal: 221.62,
      situacao: "PRONTO_BANCO",
      contaPagadora: {
        id: "", // Sem conta ou ID inválido
        bancoCodigo: "",
        bancoNome: "Conta Não Vinculada",
        agenciaMascarada: "—",
        contaMascarada: "—",
        permiteCnab: false,
        ativo: false,
      },
      favorecidoDescricao: "Folha CLT 07/2026",
      favorecidoDocumento: "08765432000199",
      timeline: [],
    };

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemSemContaValida}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // Deve exibir bloqueio factual
    expect(screen.getByText(/Bloqueio: Conta bancária não vinculada/i)).toBeInTheDocument();
    expect(screen.getByText("Não configurada")).toBeInTheDocument();

    // Botão de geração DEVE estar desabilitado
    const btnGerar = screen.getByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(btnGerar).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 15. CONV-11-FIX03: ITAÚ SISPAG — READINESS FACTUAL & FAIL-CLOSED CADASTRAL
  // -------------------------------------------------------------------------
  it("21. CONV-11-FIX03: Itaú SISPAG com favorecido sem dados bancários bloqueia geração fail-closed", () => {
    const validEmpresaUuid = "4d4c1328-a8e7-4c5b-875d-924b416fa13a";
    const validContaItauUuid = "99999999-9999-4999-a999-999999999999";

    const itemItauIncompleto: ItemObrigacaoBancariaOficial = {
      id: "clt-b01ebe20-6a7f-4d94-9eaf-2de72a7ae8d6",
      referencia: "CLT-2026-07",
      origemTipo: "CLT",
      loteId: "b01ebe20-6a7f-4d94-9eaf-2de72a7ae8d6",
      loteCodigo: "RH-B01EBE20",
      empresaId: validEmpresaUuid,
      empresaNome: "BENEVIDES",
      competencia: "2026-07",
      favorecidoDescricao: "8 Colaborador(es) CLT",
      favorecidoNomeMascarado: "Folha Salarial Mensal CLT",
      documentoFavorecidoMascarado: "Contas Salário Diversas",
      dadosBancariosFavorecidoMascarado: "Contas Salário / Corrente Diversas",
      quantidadeFavorecidos: 8,
      valorTotal: 494.28,
      valorEsperado: 494.28,
      situacao: "PRONTO_BANCO",
      estagioTab: "PRONTAS_BANCO",
      contaPagadora: {
        id: validContaItauUuid,
        bancoCodigo: "341",
        bancoNome: "Itaú Unibanco",
        agencia: "1234",
        agenciaMascarada: "Ag. 1234",
        conta: "98765-4",
        contaMascarada: "Cc •••• 65-4",
        cedenteNome: "BENEVIDES",
        cedenteCnpjMascarado: "00.000.000/0001-••",
        permiteCnab: true,
        ativo: true,
      },
      preValidacao: {
        contaValida: true,
        dadosObrigatorios: true,
        favorecidosAptos: false, // Factual: nenhum colaborador possui domicílio bancário
        qtdFavorecidosAptos: 0,
        qtdFavorecidosInaptos: 8,
        valorConsolidado: true,
        inconsistencias: [
          "EVERTON DA PAIXÃO DA SILVA: Banco ausente, Agência ausente, Conta ausente, CPF ausente",
          "CARLOS HENRIQUE SILVA DO NASCIMENTO: Banco ausente, Agência ausente, Conta ausente, CPF ausente",
        ],
      },
      timeline: [],
    };

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemItauIncompleto}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // 1. Central NÃO declara "100% Aptos"
    expect(screen.queryByText("100% Aptos")).not.toBeInTheDocument();

    // 2. Central exibe "Pendências Cadastrais (8 inaptos)"
    expect(screen.getByText(/Pendências Cadastrais \(8 inaptos\)/i)).toBeInTheDocument();

    // 3. Central exibe banner de diagnóstico padronizado
    expect(screen.getByText(/Bloqueio: Favorecidos com Pendência Cadastral/i)).toBeInTheDocument();
    expect(screen.getByText(/Favorecidos com dados bancários incompletos para CNAB/i)).toBeInTheDocument();
    expect(screen.getByText(/Abrir Colaboradores \/ RH/i)).toBeInTheDocument();

    // 4. Botão "Gerar Remessa CNAB" fica DESABILITADO (fail-closed)
    const btnGerar = screen.getByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(btnGerar).toBeDisabled();
  });

  it("22. CONV-11-FIX03: Itaú SISPAG com 100% dos dados válidos permite geração normalmente", () => {
    const validEmpresaUuid = "4d4c1328-a8e7-4c5b-875d-924b416fa13a";
    const validContaItauUuid = "99999999-9999-4999-a999-999999999999";

    const itemItauValido: ItemObrigacaoBancariaOficial = {
      id: "clt-7d132d84-f3a7-4a5a-a460-1d23727d2537",
      referencia: "CLT-2026-07",
      origemTipo: "CLT",
      loteId: "7d132d84-f3a7-4a5a-a460-1d23727d2537",
      loteCodigo: "RH-7D132D84",
      empresaId: validEmpresaUuid,
      empresaNome: "BENEVIDES",
      competencia: "2026-07",
      favorecidoDescricao: "8 Colaborador(es) CLT",
      favorecidoNomeMascarado: "Folha Salarial Mensal CLT",
      documentoFavorecidoMascarado: "Contas Salário Diversas",
      dadosBancariosFavorecidoMascarado: "Contas Salário / Corrente Diversas",
      quantidadeFavorecidos: 8,
      valorTotal: 2400.0,
      valorEsperado: 2400.0,
      situacao: "PRONTO_BANCO",
      estagioTab: "PRONTAS_BANCO",
      contaPagadora: {
        id: validContaItauUuid,
        empresaId: validEmpresaUuid,
        bancoCodigo: "341",
        bancoNome: "Itaú Unibanco",
        agencia: "1234",
        agenciaMascarada: "Ag. 1234",
        conta: "98765-4",
        contaMascarada: "Cc •••• 65-4",
        cedenteNome: "BENEVIDES",
        cedenteCnpjMascarado: "00.000.000/0001-••",
        permiteCnab: true,
        ativo: true,
      },
      preValidacao: {
        contaValida: true,
        dadosObrigatorios: true,
        favorecidosAptos: true, // Todos os favorecidos com agência, conta, CPF válidos
        qtdFavorecidosAptos: 8,
        qtdFavorecidosInaptos: 0,
        valorConsolidado: true,
        inconsistencias: [],
      },
      timeline: [],
    };

    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial
          item={itemItauValido}
          open={true}
          onOpenChange={() => {}}
        />
      </MemoryRouter>
    );

    // 1. Central declara "100% Aptos"
    expect(screen.getByText("100% Aptos")).toBeInTheDocument();

    // 2. Não exibe banner de pendência cadastral
    expect(screen.queryByText(/Bloqueio: Favorecidos com Pendência Cadastral/i)).not.toBeInTheDocument();

    // 3. Botão "Gerar Remessa CNAB" fica HABILITADO
    const btnGerar = screen.getByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(btnGerar).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // CONV-11-FIX04 — IDENTIDADE CANÔNICA EMPRESA / CONTA / AMBIENTE
  // -------------------------------------------------------------------------
  const buildItemFix04 = (
    overrides: Partial<ItemObrigacaoBancariaOficial> & { contaEmpresaId?: string } = {}
  ): ItemObrigacaoBancariaOficial => {
    const empresaX = "28a560b5-37ef-403d-ae4f-b28a608b6a68";
    const { contaEmpresaId, ...rest } = overrides;
    return {
      id: "clt-7d132d84-f3a7-4a5a-a460-1d23727d2537",
      referencia: "CLT-2026-07",
      origemTipo: "CLT",
      loteId: "7d132d84-f3a7-4a5a-a460-1d23727d2537",
      loteCodigo: "RH-7D132D84",
      empresaId: empresaX,
      empresaNome: "Empresa X",
      isEmpresaTeste: false,
      competencia: "2026-07",
      favorecidoDescricao: "1 Colaborador(es) CLT",
      favorecidoNomeMascarado: "Folha Salarial Mensal CLT",
      documentoFavorecidoMascarado: "Contas Salário Diversas",
      dadosBancariosFavorecidoMascarado: "Contas Salário / Corrente Diversas",
      quantidadeFavorecidos: 1,
      valorTotal: 2400.0,
      valorEsperado: 2400.0,
      situacao: "PRONTO_BANCO",
      estagioTab: "PRONTAS_BANCO",
      contaPagadora: {
        id: "faecb252-7b9e-407d-93a5-e10466d35b0e",
        empresaId: contaEmpresaId ?? empresaX,
        bancoCodigo: "341",
        bancoNome: "Itaú Unibanco S.A.",
        agencia: "0000",
        agenciaMascarada: "Ag. ••••",
        conta: "00000-0",
        contaMascarada: "Cc •••• 00-0",
        cedenteNome: "Empresa X",
        cedenteCnpjMascarado: "00.000.000/0001-••",
        permiteCnab: true,
        ativo: true,
      },
      preValidacao: {
        contaValida: true,
        dadosObrigatorios: true,
        favorecidosAptos: true,
        qtdFavorecidosAptos: 1,
        qtdFavorecidosInaptos: 0,
        valorConsolidado: true,
        inconsistencias: [],
      },
      timeline: [],
      ...rest,
    } as ItemObrigacaoBancariaOficial;
  };

  it("23. CONV-11-FIX04: em 'Todas as Empresas', a mutation recebe o empresaId canônico do LOTE e a conta da mesma empresa", async () => {
    localStorage.removeItem("esc-log-environment"); // sessão em PRODUÇÃO
    const { CNABService } = await import("@/services/financial.service");
    const spy = vi
      .spyOn(CNABService, "generateRemessa")
      .mockResolvedValue({ fileName: "REM.txt", content: "X" } as any);
    const origCreate = (URL as any).createObjectURL;
    (URL as any).createObjectURL = vi.fn(() => "blob:x");

    const item = buildItemFix04();
    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial item={item} open={true} onOpenChange={() => {}} />
      </MemoryRouter>
    );

    const btnGerar = screen.getByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(btnGerar).not.toBeDisabled();
    fireEvent.click(btnGerar);
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar e Gerar Remessa/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const args = spy.mock.calls[0][0] as any;
    expect(args.empresaId).toBe("28a560b5-37ef-403d-ae4f-b28a608b6a68");
    expect(args.contaId).toBe("faecb252-7b9e-407d-93a5-e10466d35b0e");
    expect(args.rhLoteId).toBe("7d132d84-f3a7-4a5a-a460-1d23727d2537");
    expect(args.competencia).toBe("2026-07");
    // Nenhum contexto global ("Todas"/"all"/vazio) substitui o ID do lote
    expect(args.empresaId).not.toMatch(/todas|all/i);
    // Tenant NÃO é transportado pela UI: é resolvido pela sessão no serviço canônico
    expect(args.tenantId).toBeUndefined();

    // Fonte: o adapter aplica o escopo de ambiente em todas as fontes de obrigações
    expect((adapterContent.match(/EnvironmentQueryFilter\.applyEmpresaScope/g) || []).length).toBeGreaterThanOrEqual(4);

    spy.mockRestore();
    (URL as any).createObjectURL = origCreate;
  });

  it("24. CONV-11-FIX04 (negativo): conta de outra empresa bloqueia geração fail-closed sem mutation", async () => {
    localStorage.removeItem("esc-log-environment");
    const { CNABService } = await import("@/services/financial.service");
    const spy = vi.spyOn(CNABService, "generateRemessa");

    const item = buildItemFix04({ contaEmpresaId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" });
    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial item={item} open={true} onOpenChange={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Bloqueio: Conta de Outra Empresa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Remessa CNAB/i })).toBeDisabled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("25. CONV-11-FIX04 (negativo): empresa de HOMOLOGAÇÃO com sessão em PRODUÇÃO bloqueia geração sem mutation", async () => {
    localStorage.removeItem("esc-log-environment"); // PRODUÇÃO
    const { CNABService } = await import("@/services/financial.service");
    const spy = vi.spyOn(CNABService, "generateRemessa");

    const item = buildItemFix04({ isEmpresaTeste: true, empresaNome: "Empresa Teste - Homologação" });
    render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial item={item} open={true} onOpenChange={() => {}} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Bloqueio: Ambiente Incompatível/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Remessa CNAB/i })).toBeDisabled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    // Mesma empresa com a sessão em HOMOLOGAÇÃO → liberada
    localStorage.setItem("esc-log-environment", "HOMOLOGACAO");
    const { unmount } = render(
      <MemoryRouter>
        <CentralBancariaDrawerOficial item={item} open={true} onOpenChange={() => {}} />
      </MemoryRouter>
    );
    const botoes = screen.getAllByRole("button", { name: /Gerar Remessa CNAB/i });
    expect(botoes[botoes.length - 1]).not.toBeDisabled();
    unmount();
    localStorage.removeItem("esc-log-environment");
  });
});
