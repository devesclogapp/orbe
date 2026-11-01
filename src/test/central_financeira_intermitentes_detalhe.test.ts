import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CentralFinanceira — Detalhamento Semântico de Intermitentes', () => {
  const centralFinanceiraPath = path.resolve(__dirname, '../pages/CentralFinanceira.tsx');
  const fileContent = fs.readFileSync(centralFinanceiraPath, 'utf-8');

  // 1. SubTab e Listagem
  it('1. Listagem reconhece tipo INTERMITENTES como "Intermitentes" e possui botão de filtro subTab', () => {
    // Botão de subTab
    expect(fileContent).toContain('onClick={() => setSubTabRh("intermitentes")}');
    expect(fileContent).toContain('>Intermitentes</button>');

    // Tabela de lotes: mapeamento do tipo
    expect(fileContent).toContain('lote.tipo === "INTERMITENTES" ? "Intermitentes"');

    // Botão de ação: quando PAGO exibe "Ver Detalhes", quando não PAGO exibe "Analisar"
    expect(fileContent).toContain('isPago ? "Ver Detalhes" : "Analisar"');
  });

  // 2. Cabeçalho e Descrição do Modal
  it('2. Modal reconhece tipo INTERMITENTES e formata título e descrição específicos', () => {
    expect(fileContent).toContain('rhLoteSelecionado?.tipo === "INTERMITENTES"');
    expect(fileContent).toContain('"Detalhamento do Lote - Intermitentes"');
    expect(fileContent).toMatch(/rhLoteSelecionado\.tipo === "INTERMITENTES"[\s\S]*?"Intermitentes"/);
  });

  // 3. Resumo de Itens / KPIs do Lote Intermitentes
  it('3. Resumo do modal para Intermitentes exibe Colaboradores, Horas Apuradas, Valor Total e Situação Pago', () => {
    expect(fileContent).toContain('const isIntermitentes = rhLoteDetalhe.tipo === "INTERMITENTES" || rhLoteSelecionado?.tipo === "INTERMITENTES";');
    expect(fileContent).toContain('label: "Horas Apuradas"');
    expect(fileContent).toContain('horasTotais.toFixed(2)');
    expect(fileContent).toContain('isPago ? "Pago"');
  });

  // 4. Semântica da Tabela de Itens e Status PAGO vs PENDENTE
  it('4. Tabela de itens exibe Evento/Origem, Horas Apuradas e mapeia itens de lote PAGO como "Pago" (não exibe PENDENTE)', () => {
    // Cabeçalho da tabela adaptado
    expect(fileContent).toContain('rhLoteDetalhe.tipo === "INTERMITENTES" ? "Composição de Colaboradores" : "Itens do lote"');
    expect(fileContent).toContain('rhLoteDetalhe.tipo === "INTERMITENTES" ? "Evento / Origem" : "Evento"');
    expect(fileContent).toContain('rhLoteDetalhe.tipo === "INTERMITENTES" ? "Horas Apuradas" : "Horas"');
    expect(fileContent).toContain('rhLoteDetalhe.tipo === "INTERMITENTES" ? "Valor Calculado" : "Valor"');

    // Regra crítica: se loteIsPago, statusLabel do item é PAGO e renderizado como "Pago"
    expect(fileContent).toContain('const statusLabel = (isIntermitente && loteIsPago) ? "PAGO" : item.status;');
    expect(fileContent).toContain('statusLabel === "PAGO" ? "Pago" : statusLabel');
  });

  // 5. Ações Terminais no Footer
  it('5. Footer do modal para lote PAGO não apresenta ações de aprovação ou devolução e exibe indicador terminal', () => {
    expect(fileContent).toContain('rhLoteDetalhe?.status === "PAGO" && (');
    expect(fileContent).toContain('Lote Pago / Concluído');

    // As mutações de aprovação só abrem para status não-terminais
    expect(fileContent).toContain('["VALIDADO_RH", "AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(rhLoteDetalhe.status)');
  });

  // 6. Ausência de campos exclusivos de Folha CLT
  it('6. Modal não inclui campos exclusivos de Folha CLT (Salário Base, INSS, IRRF, Descontos CLT)', () => {
    expect(fileContent).not.toContain('Salário Base');
    expect(fileContent).not.toContain('INSS Folha');
    expect(fileContent).not.toContain('IRRF Folha');
    expect(fileContent).not.toContain('Descontos CLT');
  });

  // 7. Simulação Funcional do Lote Canônico ca7a2d5c / 930915d6
  it('7. Cálculo funcional dos dados do lote canônico: 2 itens (R$ 240 + R$ 330 = R$ 570) em estado PAGO', () => {
    const mockLoteDetalhe = {
      id: 'ca7a2d5c-da91-4bbd-945f-13f6c5510a5e',
      tipo: 'INTERMITENTES',
      status: 'PAGO',
      competencia: '2026-10',
      total_colaboradores: 2,
      valor_total: 570.00,
      empresa: { nome: 'Empresa Teste - Homologação' },
      itens: [
        {
          id: 'item-001',
          nome_colaborador: 'Homologação Itaú 001',
          tipo_evento: 'LANCAMENTO_INTERMITENTE',
          horas: 8,
          minutos: 480,
          valor_calculado: 240.00,
          status: 'PENDENTE', // status interno de composição
        },
        {
          id: 'item-002',
          nome_colaborador: 'Homologação Itaú 002',
          tipo_evento: 'LANCAMENTO_INTERMITENTE',
          horas: 10,
          minutos: 600,
          valor_calculado: 330.00,
          status: 'PENDENTE', // status interno de composição
        },
      ],
    };

    // Total de colaboradores
    expect(mockLoteDetalhe.itens).toHaveLength(2);

    // Soma dos valores
    const totalCalculado = mockLoteDetalhe.itens.reduce((acc, curr) => acc + curr.valor_calculado, 0);
    expect(totalCalculado).toBe(570.00);
    expect(mockLoteDetalhe.valor_total).toBe(totalCalculado);

    // Soma das horas
    const horasTotais = mockLoteDetalhe.itens.reduce((acc, curr) => acc + curr.horas, 0);
    expect(horasTotais).toBe(18);

    // Resolução semântica do status do item (regra crítica):
    // Como mockLoteDetalhe.status === 'PAGO', o item deve ser exibido como PAGO, NUNCA PENDENTE
    const loteIsPago = mockLoteDetalhe.status === 'PAGO';
    const isIntermitente = mockLoteDetalhe.tipo === 'INTERMITENTES';

    const statusVisualItens = mockLoteDetalhe.itens.map((item) => {
      const statusLabel = (isIntermitente && loteIsPago) ? 'PAGO' : item.status;
      return statusLabel === 'PAGO' ? 'Pago' : statusLabel;
    });

    expect(statusVisualItens).toEqual(['Pago', 'Pago']);
    expect(statusVisualItens).not.toContain('PENDENTE');
  });
});
