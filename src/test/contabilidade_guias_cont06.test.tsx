import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  GUIA_INTEGRACAO_CONTABIL,
  GUIA_MAPEAMENTO_CONTABIL,
  GUIA_LOGS_INTEGRACAO,
  GUIA_AGENDAMENTOS_CONTABEIS,
  GUIA_LAYOUTS_EXPORTACAO,
} from "@/pages/Relatorios/components/guiasContabeisData";
import { GuiaUsoDrawer, GuiaUsoData } from "@/pages/Relatorios/components/GuiaUsoDrawer";

describe("ERP ORBE — CONT-06 | Validação dos Guias de Uso Contábeis", () => {
  const guias: Array<{ nome: string; data: GuiaUsoData }> = [
    { nome: "Integração Contábil", data: GUIA_INTEGRACAO_CONTABIL },
    { nome: "Mapeamento Contábil", data: GUIA_MAPEAMENTO_CONTABIL },
    { nome: "Logs de Integração", data: GUIA_LOGS_INTEGRACAO },
    { nome: "Agendamentos Contábeis", data: GUIA_AGENDAMENTOS_CONTABEIS },
    { nome: "Layouts de Exportação", data: GUIA_LAYOUTS_EXPORTACAO },
  ];

  describe("1. Integridade e Completude Estrutural dos 5 Guias", () => {
    it.each(guias)("o guia de $nome deve conter todas as 5 seções obrigatórias", ({ data }) => {
      // 1. Títulos e Subtítulos
      expect(data.titulo).toBeTruthy();
      expect(data.subtitulo).toBeTruthy();

      // 2. Seção 1: Para que serve
      expect(data.paraQueServe.length).toBeGreaterThan(30);

      // 3. Seção 2: Como utilizar (Passo a passo com no mínimo 3 passos)
      expect(data.comoUtilizar.length).toBeGreaterThanOrEqual(3);
      data.comoUtilizar.forEach((passo, idx) => {
        expect(passo.passo).toBe(idx + 1);
        expect(passo.titulo).toBeTruthy();
        expect(passo.desc).toBeTruthy();
      });

      // 4. Seção 3: O que observar (Regras e Bloqueios)
      expect(data.oQueObservar.length).toBeGreaterThanOrEqual(2);
      data.oQueObservar.forEach((regra) => {
        expect(regra.titulo).toBeTruthy();
        expect(regra.desc).toBeTruthy();
      });

      // 5. Seção 4: Exemplo prático
      expect(data.exemploPratico.cenario).toBeTruthy();
      expect(data.exemploPratico.acao).toBeTruthy();
      expect(data.exemploPratico.resultado).toBeTruthy();

      // 6. Seção 5: Dúvidas frequentes
      expect(data.duvidasFrequentes.length).toBeGreaterThanOrEqual(2);
      data.duvidasFrequentes.forEach((faq) => {
        expect(faq.pergunta).toBeTruthy();
        expect(faq.resposta).toBeTruthy();
      });
    });
  });

  describe("2. Renderização e Comportamento do GuiaUsoDrawer", () => {
    it("deve renderizar o Drawer quando isOpen for true com todas as seções visíveis", () => {
      const handleClose = vi.fn();

      render(
        <GuiaUsoDrawer
          isOpen={true}
          onClose={handleClose}
          data={GUIA_INTEGRACAO_CONTABIL}
        />
      );

      // Título e Subtítulo
      expect(screen.getByText(GUIA_INTEGRACAO_CONTABIL.titulo)).toBeInTheDocument();
      expect(screen.getByText(GUIA_INTEGRACAO_CONTABIL.subtitulo)).toBeInTheDocument();

      // Seções
      expect(screen.getByText("1. Para que serve")).toBeInTheDocument();
      expect(screen.getByText("2. Como utilizar (Passo a Passo)")).toBeInTheDocument();
      expect(screen.getByText("3. O que observar (Regras e Bloqueios)")).toBeInTheDocument();
      expect(screen.getByText("4. Exemplo prático de uso")).toBeInTheDocument();
      expect(screen.getByText("5. Dúvidas frequentes")).toBeInTheDocument();

      // Botão de fechar
      const fecharBtn = screen.getByRole("button", { name: /Entendi, fechar guia/i });
      expect(fecharBtn).toBeInTheDocument();
      fireEvent.click(fecharBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("não deve exibir conteúdo quando isOpen for false", () => {
      const { queryByText } = render(
        <GuiaUsoDrawer
          isOpen={false}
          onClose={vi.fn()}
          data={GUIA_MAPEAMENTO_CONTABIL}
        />
      );

      expect(queryByText(GUIA_MAPEAMENTO_CONTABIL.titulo)).not.toBeInTheDocument();
    });
  });

  describe("3. Conteúdo Específico de Governança por Ferramenta", () => {
    it("Agendamentos Contábeis deve explicitar que o processamento automático depende do executor background", () => {
      const texto = JSON.stringify(GUIA_AGENDAMENTOS_CONTABEIS);
      expect(texto).toMatch(/Aguardando ativação/i);
      expect(texto).toMatch(/executor/i);
    });

    it("Integração Contábil deve explicitar bloqueio quando não houver fechamento financeiro", () => {
      const texto = JSON.stringify(GUIA_INTEGRACAO_CONTABIL);
      expect(texto).toMatch(/FECHADO_FINANCEIRO/i);
      expect(texto).toMatch(/Diferença/i);
    });

    it("Layouts de Exportação deve esclarecer que formatos personalizados não garantem compatibilidade externa automática", () => {
      const texto = JSON.stringify(GUIA_LAYOUTS_EXPORTACAO);
      expect(texto).toMatch(/Domínio|Questor|TOTVS|compatibilidade/i);
      expect(texto).toMatch(/Restaurar Padrão ORBE/i);
    });

    it("Mapeamento Contábil deve alertar contra contas fictícias e exigir plano oficial", () => {
      const texto = JSON.stringify(GUIA_MAPEAMENTO_CONTABIL);
      expect(texto).toMatch(/Aguardando Plano de Contas/i);
      expect(texto).toMatch(/fictícias/i);
    });

    it("Logs de Integração deve evidenciar imutabilidade e auditoria com Hash", () => {
      const texto = JSON.stringify(GUIA_LOGS_INTEGRACAO);
      expect(texto).toMatch(/Hash/i);
      expect(texto).toMatch(/Imutabilidade/i);
    });
  });
});

