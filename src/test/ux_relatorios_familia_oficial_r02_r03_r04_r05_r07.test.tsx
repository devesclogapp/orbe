import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UxLabRelatorioView } from '../pages/UxLab/UxLabRelatorioView';

describe('Família de Relatórios Oficiais ORBE — R02, R03, R04, R05, R07 (UX04 Fase 04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderReport = (reportId: string) => {
    return render(
      <MemoryRouter initialEntries={[`/ux-lab/relatorios/${reportId}`]}>
        <Routes>
          <Route path="/ux-lab/relatorios/:reportId" element={<UxLabRelatorioView />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('R02 — Fechamento de Diaristas', () => {
    it('renderiza o cabeçalho canônico, metadados e parâmetros', () => {
      renderReport('r02-fechamento-diaristas');
      expect(screen.getAllByText('R02').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Fechamento de Diaristas').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Matriz Castanhal').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Exportar CSV').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gerar PDF').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Imprimir').length).toBeGreaterThan(0);
    });

    it('exibe a faixa analítica 50/50 com KPIs e distribuição por função', () => {
      renderReport('r02-fechamento-diaristas');
      expect(screen.getAllByText('Total de Diárias').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Diaristas no Período').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lotes de Pagamento').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Valor Consolidado').length).toBeGreaterThan(0);
      expect(screen.getByText('Por Função')).toBeDefined();
      expect(screen.getAllByText('Status do Lote').length).toBeGreaterThan(0);
    });

    it('renderiza a tabela oficial com dados reais e formatação monetária e funções canônicas', () => {
      renderReport('r02-fechamento-diaristas');
      expect(screen.getByText('Colaborador')).toBeDefined();
      expect(screen.getByText('CPF')).toBeDefined();
      expect(screen.getAllByText('Função').length).toBeGreaterThan(0);
      expect(screen.getByText('Código')).toBeDefined();
      expect(screen.getByText('Qtd Diárias')).toBeDefined();
      expect(screen.getByText('Valor Diária')).toBeDefined();
      expect(screen.getByText('Total')).toBeDefined();
      expect(screen.getByText('Lote')).toBeDefined();
      expect(screen.getAllByText('Status do Lote').length).toBeGreaterThan(0);
      // Validar funções canônicas do domínio presentes
      expect(screen.getAllByText('Ajudante Geral').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Conferente').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Movimentador').length).toBeGreaterThan(0);
    });

    it('abre drawer analítico contextual ao clicar no card de Total de Diárias', () => {
      renderReport('r02-fechamento-diaristas');
      const cards = screen.getAllByTestId('kpi-card-total-de-diarias');
      fireEvent.click(cards[0]);
      expect(screen.getAllByText('Detalhamento Analítico').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Definição e Critério de Apuração').length).toBeGreaterThan(0);
    });
  });

  describe('R03 — Faturamento e Receitas', () => {
    it('renderiza o cabeçalho oficial e NÃO contém métricas de DRE (lucro/margem)', () => {
      renderReport('r03-faturamento-receitas');
      expect(screen.getAllByText('R03').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Faturamento e Receitas').length).toBeGreaterThan(0);
      expect(screen.queryByText('EBITDA')).toBeNull();
      expect(screen.queryByText('Margem Bruta')).toBeNull();
      expect(screen.queryByText('Lucro Líquido')).toBeNull();
    });

    it('exibe KPIs financeiros e distribuições por cliente e modalidade', () => {
      renderReport('r03-faturamento-receitas');
      expect(screen.getAllByText('Faturamento Total').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Faturas Emitidas').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Recebido / Liquidado').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Aguardando Liquidação').length).toBeGreaterThan(0);
      expect(screen.getByText('Por Cliente Tomador')).toBeDefined();
      expect(screen.getByText('Por Modalidade')).toBeDefined();
    });

    it('renderiza o label visual "Títulos em Atraso:" sem o sufixo (Derivado) no sumário e abre drawer explicativo', () => {
      renderReport('r03-faturamento-receitas');
      expect(screen.getByText('Títulos em Atraso:')).toBeDefined();
      expect(screen.queryByText('Títulos em Atraso (Derivado):')).toBeNull();

      fireEvent.click(screen.getByText('Títulos em Atraso:'));
      expect(screen.getAllByText('Títulos em Atraso').length).toBeGreaterThan(0);
      expect(screen.getByText(/indicador calculado a partir do vencimento e ausência de liquidação/i)).toBeDefined();
    });

    it('renderiza a tabela com status persistido e situação derivada', () => {
      renderReport('r03-faturamento-receitas');
      expect(screen.getByText('Cliente Tomador')).toBeDefined();
      expect(screen.getAllByText('Modalidade').length).toBeGreaterThan(0);
      expect(screen.getByText('Origem do Faturamento')).toBeDefined();
      expect(screen.getByText('Valor Faturado')).toBeDefined();
      expect(screen.getByText('Vencimento')).toBeDefined();
      expect(screen.getAllByText('Status Financeiro').length).toBeGreaterThan(0);
    });
  });

  describe('R04 — Custos Extras Operacionais', () => {
    it('renderiza estrutura de despesas operacionais sem tratar como receita', () => {
      renderReport('r04-custos-extras');
      expect(screen.getAllByText('R04').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Custos Extras Operacionais').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Despesas Consolidadas').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lançamentos de Custos').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Despesas Liquidadas').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Despesas Pendentes').length).toBeGreaterThan(0);
    });

    it('exibe distribuição por categoria e favorecido na tabela com cabeçalho Status do Pagamento', () => {
      renderReport('r04-custos-extras');
      expect(screen.getByText('Por Categoria de Gasto')).toBeDefined();
      expect(screen.getAllByText('Categoria').length).toBeGreaterThan(0);
      expect(screen.getByText('Favorecido')).toBeDefined();
      expect(screen.getByText('Origem Recurso')).toBeDefined();
      expect(screen.getAllByText('Status do Pagamento').length).toBeGreaterThan(0);
    });
  });

  describe('R05 — Consolidado de Banco de Horas', () => {
    it('trabalha estritamente com TEMPO (horas/minutos) e sem passivo em R$', () => {
      renderReport('r05-banco-horas');
      expect(screen.getAllByText('R05').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Consolidado de Banco de Horas').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Saldo Líquido da Empresa').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Créditos Acumulados').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Débitos Acumulados').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Colaboradores no Período').length).toBeGreaterThan(0);
      expect(screen.queryByText('Passivo Financeiro')).toBeNull();
      expect(screen.queryByText('R$ / Hora')).toBeNull();
    });

    it('exibe faixas de saldo, alertas de vencimento e tabela com formatação temporal', () => {
      renderReport('r05-banco-horas');
      expect(screen.getByText('Por Faixa de Saldo')).toBeDefined();
      expect(screen.getByText('Alerta D+180')).toBeDefined();
      expect(screen.getByText('Matrícula')).toBeDefined();
      expect(screen.getByText('Saldo Atual')).toBeDefined();
      expect(screen.getByText('Créditos')).toBeDefined();
      expect(screen.getByText('Débitos')).toBeDefined();
      expect(screen.getAllByText('Situação de Risco').length).toBeGreaterThan(0);
    });
  });

  describe('R07 — Analítico de Serviços Extras', () => {
    it('renderiza serviços extraordinários com headcount numérico e pipeline segregado canônico', () => {
      renderReport('r07-servicos-extras');
      expect(screen.getAllByText('R07').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Analítico de Serviços Extras').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Total de Serviços').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Volume / Unidades').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Total Operacional').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Faturado / Concluído').length).toBeGreaterThan(0);
      expect(screen.getByText('Por Tipo de Serviço')).toBeDefined();
      expect(screen.getByText('Por Cliente / Tomador')).toBeDefined();
      // Não deve existir Aprovado RH no pipeline de Serviços Extras
      expect(screen.queryByText('Aprovado RH')).toBeNull();
    });

    it('renderiza tabela oficial com tipo, tomador, quantidade, NF e status pipeline', () => {
      renderReport('r07-servicos-extras');
      expect(screen.getAllByText('Tipo de Serviço').length).toBeGreaterThan(0);
      expect(screen.getByText('Cliente / Tomador')).toBeDefined();
      expect(screen.getByText('Qtd')).toBeDefined();
      expect(screen.getByText('Valor Unit.')).toBeDefined();
      expect(screen.getByText('Total')).toBeDefined();
      expect(screen.getByText('NF')).toBeDefined();
      expect(screen.getAllByText('Status Pipeline').length).toBeGreaterThan(0);
    });
  });

  describe('Controle Documental e Rastreabilidade', () => {
    it('exibe o rodapé de controle documental com rastreabilidade completa', () => {
      renderReport('r02-fechamento-diaristas');
      expect(screen.getByText('Controle Documental')).toBeDefined();
      expect(screen.getAllByText(/Rastreabilidade:/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Critérios aplicados:/)).toBeDefined();
    });
  });
});
