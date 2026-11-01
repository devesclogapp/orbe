import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  CustosExtrasDetalhesDrawer,
  CustoExtraItemReal,
  CUSTOS_EXTRAS_PIPELINE_STEPS,
} from "@/components/operacoes/CustosExtrasDetalhesDrawer";
import { UxPipelineStepper } from "@/components/ux-lab/UxPipelineStepper";
import { normalizarCustoExtra } from "@/services/despesasOficial.service";

// Mock do hook useNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe("GATE 5.16-D — Testes Obrigatórios de Rastreabilidade Operacional (T01 a T12)", () => {
  const baseItem: CustoExtraItemReal = {
    id: "faa91987-3ce7-429c-a547-5d9aeaed11f6",
    data: "2026-10-22",
    empresa_id: "emp-hml-01",
    empresa_nome: "Empresa Teste - Homologação",
    empresas: { nome: "Empresa Teste - Homologação" },
    unidade_id: "unid-01",
    unidade_nome: "Unidade Central",
    categoria_custo: "OPERACIONAL",
    descricao: "HML CEX-01 - Teste Sintetico de Devolucao",
    quantidade: 1,
    valor_unitario: 55.0,
    total: 55.0,
    origem_recurso: "PAGAMENTO_PENDENTE",
    pipeline_status: "RECEBIDO",
    status_pagamento: "A_PAGAR",
    responsavel_nome: "Gestor Teste",
    atualizado_em: "2026-10-23T02:11:15.867832+00:00",
  };

  it("T01 — Registro novo: Diagnóstico de primeira conferência e sem card de devolução", () => {
    const itemNovo: CustoExtraItemReal = {
      ...baseItem,
      justificativa_devolucao: undefined,
      pipeline_status: "RECEBIDO",
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemNovo}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Lançamento recebido em campo aguardando primeira conferência operacional/i)).toBeInTheDocument();
    expect(screen.queryByText(/Devolvido pelo Financeiro — Justificativa:/i)).not.toBeInTheDocument();
  });

  it("T02 — Registro devolvido ativo: Diagnóstico de devolução e justificativa visível em card âmbar", () => {
    const itemDevolvido: CustoExtraItemReal = {
      ...baseItem,
      pipeline_status: "RECEBIDO",
      justificativa_devolucao: "HML FIX CEX-01 — Devolução para validação do fluxo de aprovação.",
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemDevolvido}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Devolvido pelo Financeiro — Justificativa:/i)).toBeInTheDocument();
    expect(screen.getByText("HML FIX CEX-01 — Devolução para validação do fluxo de aprovação.")).toBeInTheDocument();
    expect(screen.getByText(/Caso a pendência envolva alteração de valor ou favorecido, encaminhe a situação à administração/i)).toBeInTheDocument();
  });

  it("T03 — Listagem em tabela: Stepper compacto exibe estado de exceção Devolvido para RECEBIDO com justificativa", () => {
    const itemDevolvido = {
      stPip: "RECEBIDO",
      justificativa_devolucao: "HML FIX CEX-01 — Devolução para validação do fluxo de aprovação.",
    };

    const exceptionState =
      itemDevolvido.stPip === "REPROVADO"
        ? {
            isException: true,
            label: "Reprovado",
            stepKey: "EM_VALIDACAO",
            description: itemDevolvido.justificativa_devolucao || undefined,
          }
        : itemDevolvido.stPip === "RECEBIDO" && Boolean(itemDevolvido.justificativa_devolucao?.trim())
        ? {
            isException: true,
            label: "Devolvido",
            stepKey: "RECEBIDO",
            description: itemDevolvido.justificativa_devolucao || undefined,
          }
        : null;

    render(
      <UxPipelineStepper
        steps={CUSTOS_EXTRAS_PIPELINE_STEPS as any}
        currentStepKey={itemDevolvido.stPip}
        exceptionState={exceptionState}
        variant="compact"
      />
    );

    // O aria-label do stepper compacto indica o status de exceção Devolvido
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", expect.stringContaining("Devolvido"));
  });

  it("T04 — Registro rejeitado: Motivo de rejeição/cancelamento preservado em card vermelho", () => {
    const itemRejeitado: CustoExtraItemReal = {
      ...baseItem,
      pipeline_status: "REPROVADO",
      motivo_rejeicao: "Comprovante ilegível e sem valor fiscal.",
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemRejeitado}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Justificativa de Devolução \/ Bloqueio:/i)).toBeInTheDocument();
    expect(screen.getByText("Comprovante ilegível e sem valor fiscal.")).toBeInTheDocument();
    expect(screen.getByText(/Bloqueio impeditivo. Nenhum pagamento será efetuado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resolver pendência/i })).toBeInTheDocument();
  });

  it("T05 & T10 — Registro corrigido/reaprovado com justificativa histórica: NÃO sinalizado como devolvido", () => {
    const itemReaprovado: CustoExtraItemReal = {
      ...baseItem,
      pipeline_status: "APROVADO_OPERACAO",
      // Justificativa histórica que permaneceu no banco pelo COALESCE da RPC
      justificativa_devolucao: "Devolução anterior já superada",
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemReaprovado}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    // Como o status é APROVADO_OPERACAO, isDevolvidoAtivo DEVE ser falso
    expect(screen.queryByText(/Devolvido pelo Financeiro — Justificativa:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Valores operacionais protegidos após aprovação/i)).toBeInTheDocument();
  });

  it("T06 — Segunda devolução: Nova justificativa é renderizada fielmente", () => {
    const itemSegundaDevolucao: CustoExtraItemReal = {
      ...baseItem,
      pipeline_status: "RECEBIDO",
      justificativa_devolucao: "Segunda devolução: Valor na NF (R$ 60,00) difere do lançamento (R$ 55,00).",
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemSegundaDevolucao}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Segunda devolução: Valor na NF (R$ 60,00) difere do lançamento (R$ 55,00).")).toBeInTheDocument();
  });

  it("T07 — Registro sem justificativa: Tratamento seguro sem quebra", () => {
    const itemSemJustificativa: CustoExtraItemReal = {
      ...baseItem,
      pipeline_status: "RECEBIDO",
      justificativa_devolucao: "   ", // apenas espaços
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemSemJustificativa}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    // Não deve entrar em isDevolvidoAtivo
    expect(screen.queryByText(/Devolvido pelo Financeiro — Justificativa:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Lançamento recebido em campo aguardando primeira conferência operacional/i)).toBeInTheDocument();
  });

  it("T09 — Devolução por valor incorreto: Interface informa limitação de alteração de valor", () => {
    const itemDevolvidoValor: CustoExtraItemReal = {
      ...baseItem,
      pipeline_status: "RECEBIDO",
      justificativa_devolucao: "Valor incorreto lançado pelo encarregado.",
    };

    render(
      <MemoryRouter>
        <CustosExtrasDetalhesDrawer
          custo={itemDevolvidoValor}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Caso a pendência envolva alteração de valor ou favorecido, encaminhe a situação à administração para regularização antes de reapresentar a despesa/i)).toBeInTheDocument();
  });

  it("T11 — Preservação financeira: Lançamento devolvido (RECEBIDO) permanece inelegível para pagamento", () => {
    const rawCustoDevolvido = {
      id: "faa91987-3ce7-429c-a547-5d9aeaed11f6",
      pipeline_status: "RECEBIDO",
      status_pagamento: "A_PAGAR",
      origem_recurso: "PAGAMENTO_PENDENTE",
      total: 55.0,
      valor: 55.0,
      data: "2026-10-22",
      descricao: "HML CEX-01 - Teste Sintetico de Devolucao",
    };

    const despesaNormalizada = normalizarCustoExtra(rawCustoDevolvido, new Map());

    // Conforme GATE 5.14, RECEBIDO é classificado como EM_ANALISE (fora da fila de liberação financeira)
    expect(despesaNormalizada.situacao).toBe("EM_ANALISE");
    expect(despesaNormalizada.situacao).not.toBe("AGUARDANDO_LIBERACAO");
    expect(despesaNormalizada.situacao).not.toBe("A_PAGAR");
  });

  it("T12 — Compatibilidade de estados: Indicador de devolução não interfere em outros estados", () => {
    const estadosTerminais: CustoExtraItemReal[] = [
      { ...baseItem, pipeline_status: "FINALIZADO", justificativa_devolucao: "Antiga" },
      { ...baseItem, pipeline_status: "ENVIADO_FINANCEIRO", justificativa_devolucao: "Antiga" },
      { ...baseItem, pipeline_status: "EM_VALIDACAO", justificativa_devolucao: "Antiga" },
    ];

    for (const item of estadosTerminais) {
      const { unmount } = render(
        <MemoryRouter>
          <CustosExtrasDetalhesDrawer
            custo={item}
            open={true}
            onOpenChange={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.queryByText(/Devolvido pelo Financeiro — Justificativa:/i)).not.toBeInTheDocument();
      unmount();
    }
  });
});
