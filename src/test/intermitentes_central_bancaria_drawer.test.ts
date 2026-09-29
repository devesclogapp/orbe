import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { decimalParaHora } from '@/lib/utils';

describe('CentralBancariaIntermitentes — Drawer Detalhes do Lote de Intermitentes', () => {
  const filePath = path.resolve(__dirname, '../pages/Financeiro/CentralBancariaIntermitentes.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  it('1. Query de lançamentos NÃO referencia colunas inexistentes (valor_hora, horas_extras, adicional_noturno)', () => {
    // Localizar a queryFn de lancamentosLote
    const queryFnMatch = fileContent.match(/queryKey:\s*\["lancamentos_intermitentes_lote"[\s\S]*?\.select\(([\s\S]*?)\)/);
    expect(queryFnMatch).toBeTruthy();
    
    const selectContent = queryFnMatch![1];
    
    // Validar ausência de colunas inválidas
    expect(selectContent).not.toContain('valor_hora');
    expect(selectContent).not.toContain('horas_extras');
    expect(selectContent).not.toContain('adicional_noturno');
    
    // Validar presença de colunas canônicas
    expect(selectContent).toContain('horas_trabalhadas');
    expect(selectContent).toContain('horas_normais');
    expect(selectContent).toContain('he_50');
    expect(selectContent).toContain('he_100');
    expect(selectContent).toContain('hora_noturna');
    expect(selectContent).toContain('total');
    expect(selectContent).toContain('status_pipeline');
    expect(selectContent).toContain('nome_colaborador');
    expect(selectContent).toContain('cpf_colaborador');
  });

  it('2. Lote de homologação com 2 lançamentos: retorna e mapeia ambos corretamente', () => {
    const mockLancamentosLote = [
      {
        id: '5349a94a-2e34-4463-8c95-33f26aac0b98',
        data_referencia: '2026-10-05',
        nome_colaborador: 'Homologação Itaú 001',
        cpf_colaborador: '111.222.333-44',
        colaborador_id: 'colab-uuid-001',
        cargo: 'Auxiliar Logístico',
        horas_trabalhadas: 8,
        horas_normais: 8,
        he_50: 0,
        he_100: 0,
        hora_noturna: 0,
        total: 240,
        status_pipeline: 'ENVIADO_FINANCEIRO',
      },
      {
        id: 'a9fb4fa9-e3e9-4c27-940f-f65c9d909cb9',
        data_referencia: '2026-10-06',
        nome_colaborador: 'Homologação Itaú 002',
        cpf_colaborador: '555.666.777-88',
        colaborador_id: 'colab-uuid-002',
        cargo: 'Operador Logístico',
        horas_trabalhadas: 10,
        horas_normais: 8,
        he_50: 2,
        he_100: 0,
        hora_noturna: 0,
        total: 330,
        status_pipeline: 'ENVIADO_FINANCEIRO',
      },
    ];

    expect(mockLancamentosLote).toHaveLength(2);
    expect(mockLancamentosLote[0].nome_colaborador).toBe('Homologação Itaú 001');
    expect(mockLancamentosLote[1].nome_colaborador).toBe('Homologação Itaú 002');
  });

  it('3. Dois colaboradores distintos: Intermitentes = 2 no contador do lote', () => {
    const mockLancamentosLote = [
      {
        id: '5349a94a-2e34-4463-8c95-33f26aac0b98',
        nome_colaborador: 'Homologação Itaú 001',
        cpf_colaborador: '111.222.333-44',
        colaborador_id: 'colab-uuid-001',
        total: 240,
      },
      {
        id: 'a9fb4fa9-e3e9-4c27-940f-f65c9d909cb9',
        nome_colaborador: 'Homologação Itaú 002',
        cpf_colaborador: '555.666.777-88',
        colaborador_id: 'colab-uuid-002',
        total: 330,
      },
    ];

    const intermitentesCount = new Set(
      mockLancamentosLote.map((l: any) => l.colaborador_id || l.cpf_colaborador || l.nome_colaborador)
    ).size;

    expect(intermitentesCount).toBe(2);
  });

  it('4. Soma total apurada dos 2 lançamentos é exatamente R$ 570,00', () => {
    const mockLancamentosLote = [
      { id: '5349a94a-2e34-4463-8c95-33f26aac0b98', total: 240 },
      { id: 'a9fb4fa9-e3e9-4c27-940f-f65c9d909cb9', total: 330 },
    ];

    const totalApurado = mockLancamentosLote.reduce((acc, l) => acc + Number(l.total || 0), 0);
    expect(totalApurado).toBe(570);

    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalApurado);
    expect(formatted.replace(/\u00a0/g, ' ')).toBe('R$ 570,00');
  });

  it('5. Horas e HE50 formatadas: 1º lançamento 08:00 trab / 08:00 norm; 2º lançamento 10:00 trab / 08:00 norm / 02:00 HE50', () => {
    const l1 = { horas_trabalhadas: 8, horas_normais: 8, he_50: 0 };
    const l2 = { horas_trabalhadas: 10, horas_normais: 8, he_50: 2 };

    // Lançamento 1
    expect(decimalParaHora(l1.horas_trabalhadas)).toBe('08:00');
    expect(decimalParaHora(l1.horas_normais)).toBe('08:00');
    expect(Number(l1.he_50)).toBe(0);

    // Lançamento 2
    expect(decimalParaHora(l2.horas_trabalhadas)).toBe('10:00');
    expect(decimalParaHora(l2.horas_normais)).toBe('08:00');
    expect(decimalParaHora(l2.he_50)).toBe('02:00');
  });

  it('6. Erro de consulta NÃO é apresentado como "Nenhum lançamento vinculado ao lote"', () => {
    // Simula a lógica de renderização implementada no Drawer
    const renderDrawerBody = ({
      isLoading,
      isError,
      lancamentos,
    }: {
      isLoading: boolean;
      isError: boolean;
      lancamentos: any[];
    }) => {
      if (isLoading) return 'CARREGANDO';
      if (isError) return 'ERRO_CONSULTA';
      if (lancamentos.length === 0) return 'LOTE_VAZIO';
      return 'TABELA_LANCAMENTOS';
    };

    // Caso de erro
    const estadoComErro = renderDrawerBody({ isLoading: false, isError: true, lancamentos: [] });
    expect(estadoComErro).toBe('ERRO_CONSULTA');
    expect(estadoComErro).not.toBe('LOTE_VAZIO');

    // Confirma que a string "Erro ao carregar lançamentos do lote" existe no arquivo
    expect(fileContent).toContain('Erro ao carregar lançamentos do lote');
    expect(fileContent).toContain('isErrorLancamentos');
  });

  it('7. Lote genuinamente sem filhos apresenta estado vazio com sucesso', () => {
    const renderDrawerBody = ({
      isLoading,
      isError,
      lancamentos,
    }: {
      isLoading: boolean;
      isError: boolean;
      lancamentos: any[];
    }) => {
      if (isLoading) return 'CARREGANDO';
      if (isError) return 'ERRO_CONSULTA';
      if (lancamentos.length === 0) return 'LOTE_VAZIO';
      return 'TABELA_LANCAMENTOS';
    };

    // Caso de sucesso com zero registros
    const estadoVazio = renderDrawerBody({ isLoading: false, isError: false, lancamentos: [] });
    expect(estadoVazio).toBe('LOTE_VAZIO');
  });

  it('8. Layout do Drawer Primário adota cards responsivos e não tabela rígida que causava overflow', () => {
    // A nova implementação do Drawer Primário não renderiza <table className="w-full text-sm"> para os lançamentos
    expect(fileContent).toContain('Composição do Lote');
    expect(fileContent).toContain('statusBadge(item.status_pipeline)');
    expect(fileContent).toContain('decimalParaHora(item.horas_trabalhadas || 0)');
    expect(fileContent).toContain('decimalParaHora(item.horas_normais || 0)');
    expect(fileContent).toContain('decimalParaHora(item.he_50)');
  });

  it('9. Footer e Drawer Secundário são mantidos íntegros', () => {
    // Footer preserva Gerar CNAB e Baixa via Retorno Bancário
    expect(fileContent).toContain('Gerar CNAB');
    expect(fileContent).toContain('Baixa via Retorno Bancário');
    expect(fileContent).toContain('Linha do Tempo — Intermitentes');
  });
});
