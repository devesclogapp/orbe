import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Fechamento from '@/pages/Fechamento';
import {
  FechamentoCiclosOficialService,
  CicloFechamentoItem,
} from '@/services/fechamentoCiclosOficial.service';
import { supabase } from '@/lib/supabase';

// Mock do AppShell
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ title, subtitle, children }: any) => (
    <div data-testid="app-shell">
      <header>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <main>{children}</main>
    </div>
  ),
}));

// Mock do JustificationModal
vi.mock('@/components/modals/JustificationModal', () => ({
  JustificationModal: ({ isOpen, onClose, onConfirm, title }: any) =>
    isOpen ? (
      <div data-testid="justification-modal">
        <p>{title}</p>
        <button onClick={() => onConfirm('Justificativa de teste')} data-testid="confirm-justification-btn">
          Confirmar
        </button>
        <button onClick={onClose} data-testid="cancel-justification-btn">
          Cancelar
        </button>
      </div>
    ) : null,
}));

// Mock do contexto de pipeline operacional
vi.mock('@/contexts/OperationalPipelineContext', () => ({
  useOperationalPipeline: () => ({
    openPipeline: vi.fn(),
  }),
  buildOperationalStagePipeline: vi.fn(),
  buildOperationalStageReviewPipeline: vi.fn(),
  buildOperationalFailurePipeline: vi.fn(),
}));

// Mock de hook do pipeline
vi.mock('@/hooks/useOperationalPipelineAutoTrigger', () => ({
  useOperationalPipelineAutoTrigger: vi.fn(),
  buildOperationalPipelineSeenKey: vi.fn(),
}));

// Mock do CicloOperacionalService
vi.mock('@/services/operationalEngine/CicloOperacionalService', () => ({
  CicloOperacionalService: {
    getCiclosDaCompetencia: vi.fn().mockResolvedValue([]),
    fecharCiclo: vi.fn().mockResolvedValue({ sucesso: true, mensagem: 'Ciclo fechado com sucesso' }),
    revalidarCiclo: vi.fn().mockResolvedValue({ sucesso: true, inconsistencias_encontradas: 0 }),
  },
}));

// Mock do Supabase
vi.mock('@/lib/supabase', () => {
  const createQueryBuilder = (table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(() => {
      if (table === 'empresas') {
        return Promise.resolve({
          data: [
            { id: 'emp-01', nome: 'ESC LOG Matriz' },
            { id: 'emp-02', nome: 'Operadora Norte Logistica' },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    }),
    single: vi.fn().mockImplementation(() => {
      if (table === 'profiles') {
        return Promise.resolve({
          data: { tenant_id: 'tenant-esc-log-01' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  });

  return {
    supabase: {
      from: vi.fn((table: string) => createQueryBuilder(table)),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    },
  };
});

const MOCK_CICLOS_TESTE: CicloFechamentoItem[] = [
  {
    id: 'ciclo-op-01',
    dominio: 'OPERACIONAL',
    titulo: 'Ciclo Operacional Semanal',
    subtitulo: 'Semanas operacionais de carga, descarga e conferência',
    periodo: 'Semana 41 · 05/10 a 11/10/2026',
    competencia: '2026-10',
    empresaId: 'emp-01',
    empresaNome: 'ESC LOG Matriz',
    estadoVisual: 'PRONTO_PARA_FECHAR',
    statusMotorOriginal: 'ABERTO',
    grandezaResumo: '45.200 un · 18 op',
    valorTotal: 18450.0,
    responsavelPapel: 'Operações / Coordenação',
    responsavelNome: 'Coord. Regional Logística',
    totalImpedimentos: 0,
    ctaTexto: 'Revisar e Fechar',
    ctaTipo: 'FECHAMENTO',
    semanasTimeline: [
      { numero: 1, periodo: '01 a 07/10', status: 'fechado', volume: 12000, horas: 160, valor: 4800, inconsistencias: 0 },
      { numero: 2, periodo: '08 a 14/10', status: 'pronto', volume: 15000, horas: 180, valor: 6200, inconsistencias: 0 },
      { numero: 3, periodo: '15 a 21/10', status: 'bloqueado', volume: 10000, horas: 140, valor: 4100, inconsistencias: 2 },
      { numero: 4, periodo: '22 a 28/10', status: 'aberto', volume: 8200, horas: 110, valor: 3350, inconsistencias: 0 },
      { numero: 5, periodo: '29 a 31/10', status: 'aberto', volume: 0, horas: 0, valor: 0, inconsistencias: 0 },
    ],
    checklist: [
      { id: 'chk-1', titulo: 'Conferência física 100% realizada', tipo: 'sucesso' },
      { id: 'chk-2', titulo: 'Zero divergências de pesagem ou avarias', tipo: 'sucesso' },
    ],
    consolidacao: {
      colaboradores: 14,
      quantidadePrincipal: '45.200 unidades movimentadas',
      valorTotal: 18450.0,
    },
    efeitoFechamento: 'Consolida a semana operacional e avança o ciclo para a continuidade do fluxo.',
    rastreabilidade: {
      empresa: 'ESC LOG Matriz',
      competencia: 'Outubro / 2026',
      periodo: 'Semana 41',
      responsavel: 'Coord. Regional Logística',
      dataHoraRevisao: '07/10/2026 10:00',
    },
    raw: { tipoMotor: 'OPERACIONAL', dadosOriginais: {} },
  },
  {
    id: 'lote-dia-01',
    dominio: 'DIARISTAS',
    titulo: 'Diaristas — Lote Semanal',
    subtitulo: 'Apuração semanal de diárias operacionais e produção eventual',
    periodo: 'Semana 40 · 28/09 a 04/10/2026',
    competencia: '2026-10',
    empresaId: 'emp-01',
    empresaNome: 'ESC LOG Matriz',
    estadoVisual: 'BLOQUEADO',
    statusMotorOriginal: 'EM_ABERTO',
    grandezaResumo: '8 diaristas · 42 diárias',
    valorTotal: 6300.0,
    responsavelPapel: 'RH / Financeiro',
    responsavelNome: 'Analista de DP',
    totalImpedimentos: 2,
    ctaTexto: 'Ver 2 bloqueios',
    ctaTipo: 'INCONSISTENCIAS',
    ctaRota: '/inconsistencias',
    checklist: [
      { id: 'chk-dia-1', titulo: '2 apontamentos sem confirmação de presença', tipo: 'bloqueio' },
      { id: 'chk-dia-2', titulo: 'Cadastros bancários e PIX íntegros', tipo: 'sucesso' },
    ],
    consolidacao: {
      colaboradores: 8,
      quantidadePrincipal: '42 diárias apuradas',
      valorTotal: 6300.0,
    },
    efeitoFechamento: 'Consolida as presenças dos diaristas para análise e continuidade do processamento.',
    rastreabilidade: {
      empresa: 'ESC LOG Matriz',
      competencia: 'Outubro / 2026',
      periodo: 'Semana 40',
      responsavel: 'Analista de DP',
      dataHoraRevisao: '07/10/2026 10:00',
    },
    raw: { tipoMotor: 'DIARISTAS', dadosOriginais: {} },
  },
  {
    id: 'lote-int-01',
    dominio: 'INTERMITENTES',
    titulo: 'Contrato Intermitente — Lote Quinzenal',
    subtitulo: 'Convocação, aceite e horas de contratos sob demanda',
    periodo: '1ª Quinzena · 01/10 a 15/10/2026',
    competencia: '2026-10',
    empresaId: 'emp-01',
    empresaNome: 'ESC LOG Matriz',
    estadoVisual: 'AGUARDANDO_APROVACAO',
    statusMotorOriginal: 'PENDENTE_APROVACAO',
    grandezaResumo: '5 convocados · 190h',
    valorTotal: 4750.0,
    responsavelPapel: 'RH Master',
    responsavelNome: 'Gestor de Gente & Gestão',
    totalImpedimentos: 0,
    ctaTexto: 'Abrir Aprovações',
    ctaTipo: 'APROVACOES',
    ctaRota: '/rh/aprovacoes',
    checklist: [
      { id: 'chk-int-1', titulo: 'Convocações aceitas dentro do prazo legal', tipo: 'sucesso' },
      { id: 'chk-int-2', titulo: 'Aguardando validação formal da liderança', tipo: 'aviso' },
    ],
    consolidacao: {
      colaboradores: 5,
      quantidadePrincipal: '190 horas trabalhadas',
      valorTotal: 4750.0,
    },
    efeitoFechamento: 'Avança o lote quinzenal para a etapa seguinte após a aprovação formal do RH.',
    rastreabilidade: {
      empresa: 'ESC LOG Matriz',
      competencia: 'Outubro / 2026',
      periodo: '1ª Quinzena',
      responsavel: 'Gestor de Gente & Gestão',
      dataHoraRevisao: '07/10/2026 10:00',
    },
    raw: { tipoMotor: 'INTERMITENTES', dadosOriginais: {} },
  },
  {
    id: 'lote-clt-01',
    dominio: 'CLT',
    titulo: 'CLT — Folha Mensal & Banco de Horas',
    subtitulo: 'Espelho de ponto, adicionais, banco de horas e encargos CLT',
    periodo: 'Competência Setembro / 2026',
    competencia: '2026-09',
    empresaId: 'emp-01',
    empresaNome: 'ESC LOG Matriz',
    estadoVisual: 'FECHADO',
    statusMotorOriginal: 'FECHADO',
    grandezaResumo: '22 colaboradores · 3.872h',
    valorTotal: 48900.0,
    responsavelPapel: 'RH Master / DP',
    responsavelNome: 'Coordenadora de DP',
    totalImpedimentos: 0,
    ctaTexto: 'Ver Fechamento',
    ctaTipo: 'CONSULTA',
    checklist: [
      { id: 'chk-clt-1', titulo: 'Espelhos de ponto 100% assinados e apurados', tipo: 'sucesso' },
      { id: 'chk-clt-2', titulo: 'Banco de horas compensado e homologado', tipo: 'sucesso' },
    ],
    consolidacao: {
      colaboradores: 22,
      quantidadePrincipal: '3.872 horas consolidadas',
      valorTotal: 48900.0,
    },
    efeitoFechamento: 'Lote formalmente fechado. Registros congelados para histórico e governança.',
    rastreabilidade: {
      empresa: 'ESC LOG Matriz',
      competencia: 'Setembro / 2026',
      periodo: 'Mensal',
      responsavel: 'Coordenadora de DP',
      dataHoraRevisao: '30/09/2026 18:00',
      fechadoEm: '30/09/2026 18:30',
      fechadoPor: 'Coordenadora de DP',
    },
    raw: { tipoMotor: 'CLT', dadosOriginais: {} },
  },
];

describe('CONV-08 — Fechamento de Ciclos (Hub Transversal Oficial)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(FechamentoCiclosOficialService, 'carregarCiclosDaCompetencia').mockResolvedValue(MOCK_CICLOS_TESTE);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/fechamento']}>
          <Routes>
            <Route path="/fechamento" element={<Fechamento />} />
            <Route path="/inconsistencias" element={<div data-testid="inconsistencias-page">Central de Inconsistências</div>} />
            <Route path="/rh/aprovacoes" element={<div data-testid="aprovacoes-page">Central de Aprovações</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('1. Renderiza o cabeçalho oficial com título e descrição canônica', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Fechamento de Ciclos' })).toBeInTheDocument();
      expect(
        screen.getByText('Consolidação e encerramento dos ciclos operacionais e de pessoal da competência.')
      ).toBeInTheDocument();
    });
  });

  it('2. Exibe os 4 motores canônicos de fechamento', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Operacional Semanal')).toBeInTheDocument();
      expect(screen.getByText('Diaristas — Lote Semanal')).toBeInTheDocument();
      expect(screen.getByText('Contrato Intermitente — Lote Quinzenal')).toBeInTheDocument();
      expect(screen.getByText('CLT — Folha Mensal & Banco de Horas')).toBeInTheDocument();
    });
  });

  it('3. PROIBIÇÃO ARQUITETURAL: Não existe botão "Fechar Tudo" ou "Fechar Competência" ou "Consolidar Geral"', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Operacional Semanal')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Fechar Tudo/i)).toBeNull();
    expect(screen.queryByText(/Fechar Competência/i)).toBeNull();
    expect(screen.queryByText(/Consolidar Geral/i)).toBeNull();
    expect(screen.queryByText(/Fechamento em Massa/i)).toBeNull();
  });

  it('4. Exibe os 4 KPIs compactos da competência com contagens reais', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclos / Lotes')).toBeInTheDocument();
      expect(screen.getByText('Prontos para Fechar')).toBeInTheDocument();
      expect(screen.getByText('Bloqueados')).toBeInTheDocument();
      expect(screen.getByText('Já Fechados')).toBeInTheDocument();
    });

    // 4 ciclos no total no mock
    expect(screen.getByText('4')).toBeInTheDocument(); // total ciclos
    expect(screen.getByText('acompanhados na competência')).toBeInTheDocument();
  });

  it('5. KPIs são INVARIANTES a busca textual ou clique nas pills de domínio', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclos / Lotes')).toBeInTheDocument();
    });

    // Filtra pelo domínio DIARISTAS
    const btnDiaristas = screen.getByRole('button', { name: /Diaristas \(1\)/i });
    fireEvent.click(btnDiaristas);

    // O card de Diaristas deve estar visível, CLT não
    expect(screen.getByText('Diaristas — Lote Semanal')).toBeInTheDocument();
    expect(screen.queryByText('CLT — Folha Mensal & Banco de Horas')).toBeNull();

    // Mas os KPIs continuam mostrando o total da competência (4)
    expect(screen.getByText('4')).toBeInTheDocument();

    // Digita na busca
    const inputBusca = screen.getByPlaceholderText('Buscar ciclo, período ou responsável...');
    fireEvent.change(inputBusca, { target: { value: 'InexistenteXYZ' } });

    // Mensagem de nenhum resultado na listagem
    expect(screen.getByText(/Nenhum ciclo ou lote encontrado/i)).toBeInTheDocument();

    // Porém os KPIs permanecem intactos refletindo a competência
    expect(screen.getByText('Ciclos / Lotes')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('6. Representa os 4 estados visuais canônicos de UX', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('PRONTO PARA FECHAR')).toBeInTheDocument();
      expect(screen.getByText('BLOQUEADO')).toBeInTheDocument();
      expect(screen.getByText('AGUARDANDO APROVAÇÃO')).toBeInTheDocument();
      expect(screen.getByText('FECHADO')).toBeInTheDocument();
    });
  });

  it('7. Exibe a timeline S1..S5 com indicadores visuais no Ciclo Operacional', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Semanas da Competência')).toBeInTheDocument();
      expect(screen.getByText('S1')).toBeInTheDocument();
      expect(screen.getByText('S2')).toBeInTheDocument();
      expect(screen.getByText('S3')).toBeInTheDocument();
      expect(screen.getByText('S4')).toBeInTheDocument();
      expect(screen.getByText('S5')).toBeInTheDocument();
    });
  });

  it('8. Ciclo BLOQUEADO oferece CTA que despacha para Inconsistências (/inconsistencias)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ver 2 bloqueios')).toBeInTheDocument();
    });

    const ctaBloqueio = screen.getByText('Ver 2 bloqueios');
    fireEvent.click(ctaBloqueio);

    expect(screen.getByTestId('inconsistencias-page')).toBeInTheDocument();
  });

  it('9. Ciclo AGUARDANDO_APROVACAO despacha para Central de Aprovações (/rh/aprovacoes)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Abrir Aprovações')).toBeInTheDocument();
    });

    const ctaAprovacao = screen.getByText('Abrir Aprovações');
    fireEvent.click(ctaAprovacao);

    expect(screen.getByTestId('aprovacoes-page')).toBeInTheDocument();
  });

  it('10. Ciclo PRONTO_PARA_FECHAR abre o FechamentoDrawer de revisão', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Revisar e Fechar')).toBeInTheDocument();
    });

    const ctaRevisar = screen.getByText('Revisar e Fechar');
    fireEvent.click(ctaRevisar);

    expect(screen.getByText('O que será consolidado?')).toBeInTheDocument();
    expect(screen.getByText('Checklist de Prontidão')).toBeInTheDocument();
    expect(screen.getByText('Efeito do Fechamento')).toBeInTheDocument();
    expect(screen.getByText('Rastreabilidade & Governança')).toBeInTheDocument();
    expect(screen.getByText('Aviso Institucional')).toBeInTheDocument();
  });

  it('11. FechamentoDrawer exibe o checklist e os dados da consolidação factual', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Revisar e Fechar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revisar e Fechar'));

    expect(screen.getAllByText('Conferência física 100% realizada').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Zero divergências de pesagem ou avarias').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('45.200 un · 18 op').length).toBeGreaterThanOrEqual(1);
  });

  it('12. Confirmação explícita em duas etapas para fechar o ciclo', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Revisar e Fechar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revisar e Fechar'));

    // Botão inicial no drawer
    const btnConfirmar = screen.getByRole('button', { name: 'Confirmar Fechamento' });
    fireEvent.click(btnConfirmar);

    // Etapa 2 de confirmação
    expect(screen.getByText(/Confirmar fechamento do lote de/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, Confirmar Fechamento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('13. Ciclo FECHADO é apresentado em modo somente leitura (Ver Fechamento)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ver Fechamento')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver Fechamento'));

    expect(screen.getByText('Lote Consolidado (Modo Leitura)')).toBeInTheDocument();
  });

  it('14. "Fechar não significa pagar": deixa explícito o escopo de consolidação operacional', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Revisar e Fechar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revisar e Fechar'));

    expect(
      screen.getByText(/Fechar um ciclo consolida os registros operacionais e de pessoal/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Não gera ordens de pagamento automáticas nem remessas bancárias imediatas/i)
    ).toBeInTheDocument();
  });

  it('15. Não existem "Operações por Volume", "Serviços Extras" ou "Custos Extras" como motores autônomos de fechamento', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclos / Lotes')).toBeInTheDocument();
    });

    // Nas pills de domínio
    expect(screen.queryByRole('button', { name: /Serviços Extras/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Custos Extras/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Operações por Volume \(Lote/i })).toBeNull();
  });

  it('16. Barra de contexto permite filtrar os ciclos por domínio', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclos / Lotes')).toBeInTheDocument();
    });

    const btnOperacional = screen.getByRole('button', { name: /Operacional \(1\)/i });
    fireEvent.click(btnOperacional);

    expect(screen.getByText('Ciclo Operacional Semanal')).toBeInTheDocument();
    expect(screen.queryByText('Diaristas — Lote Semanal')).toBeNull();
    expect(screen.queryByText('Contrato Intermitente — Lote Quinzenal')).toBeNull();
    expect(screen.queryByText('CLT — Folha Mensal & Banco de Horas')).toBeNull();
  });

  it('17. Barra de contexto possui seletor de empresa e competência', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Empresa:')).toBeInTheDocument();
      expect(screen.getByText('Competência:')).toBeInTheDocument();
    });
  });

  it('18. CONV-08-FIX01: Não existem dois CTAs simultâneos com o rótulo "Revalidar Semana"', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclos / Lotes')).toBeInTheDocument();
    });

    // Garante que não existem botões duplicados com o mesmo texto "Revalidar Semana"
    const botoesRevalidar = screen.queryAllByRole('button', { name: /Revalidar Semana/i });
    expect(botoesRevalidar.length).toBeLessThanOrEqual(1);
  });

  it('19. CONV-08-FIX01: Card operacional bloqueado diferencia despacho de inconsistências da ação de revalidação', async () => {
    const ciclosComOperacionalBloqueado: CicloFechamentoItem[] = [
      {
        ...MOCK_CICLOS_TESTE[0],
        estadoVisual: 'BLOQUEADO',
        totalImpedimentos: 2,
        ctaTexto: 'Ver 2 bloqueios',
        ctaTipo: 'INCONSISTENCIAS',
        ctaRota: '/inconsistencias',
      },
    ];

    vi.spyOn(FechamentoCiclosOficialService, 'carregarCiclosDaCompetencia').mockResolvedValue(
      ciclosComOperacionalBloqueado
    );

    queryClient.clear();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Operacional Semanal')).toBeInTheDocument();
    });

    // 1. O botão de despacho para inconsistências está presente com seu rótulo correto
    const ctaDespacho = screen.getByRole('button', { name: 'Ver 2 bloqueios' });
    expect(ctaDespacho).toBeInTheDocument();

    // 2. A ação operacional de revalidar semana permanece disponível com tratamento próprio
    const ctaRevalidar = screen.getByRole('button', { name: 'Revalidar Semana' });
    expect(ctaRevalidar).toBeInTheDocument();

    // 3. Os dois botões são perfeitamente distinguíveis (zero duplicidade semântica)
    expect(ctaDespacho).not.toEqual(ctaRevalidar);

    // 4. Clicar no despacho navega para a Central de Inconsistências
    fireEvent.click(ctaDespacho);
    expect(screen.getByTestId('inconsistencias-page')).toBeInTheDocument();
  });
});
