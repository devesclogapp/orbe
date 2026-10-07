import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Inconsistencias from '@/pages/Inconsistencias';
import { InconsistenciaDrawer } from '@/components/inconsistencias/InconsistenciaDrawer';
import {
  InconsistenciasTransversaisService,
  ItemInconsistenciaNormalizado,
  DOMINIO_ROTAS_OFICIAIS,
} from '@/services/inconsistenciasTransversais.service';
import { EmpresaService } from '@/services/base.service';

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

const SAMPLE_INCONSISTENCIAS: ItemInconsistenciaNormalizado[] = [
  {
    id: 'op-01',
    codigo: 'OP-01ABCD',
    dominio: 'OPERACAO',
    dominioLabel: 'Operações por Volume',
    empresaId: 'emp-01',
    empresaNome: 'Empresa Alpha',
    unidadeNome: 'CD Benevides',
    referencia: 'Volume: 2.500 un · Colaborador Teste',
    colaboradorNome: 'Colaborador Teste',
    natureza: 'OPERACIONAL',
    naturezaLabel: 'Operacional de Campo',
    tituloHumano: 'Horário de início e término não informado',
    oqueEstaErrado: 'A operação foi lançada sem os horários de início e/ou término da jornada de campo.',
    impactoNoFluxo: 'Trava a validação das horas pelo RH e o faturamento comercial.',
    responsavel: 'ENCARREGADO',
    responsavelLabel: 'Encarregado (Campo)',
    detectadoEm: '2026-10-06T10:00:00Z',
    bloqueante: true,
    moduloDestino: 'Operações por Volume',
    rotaDestino: '/operacoes-volume',
    ctaLabel: 'Abrir em Operações',
    statusOrigem: 'EM_RESTRICAO',
    detalhesDrawer: {
      oqueAconteceu: 'A operação foi lançada sem os horários de início e/ou término da jornada de campo.',
      porqueFluxoParou: 'O motor de validação não pode autorizar o fluxo operacional.',
      impacto: 'A operação não avança para validação nem faturamento.',
      oquePrecisaSerFeito: 'Acessar o módulo de Operações por Volume para saneamento dos dados.',
      responsavel: 'Encarregado (Campo)',
      ondeCorrigir: 'Operações por Volume',
      depoisDaCorrecao: 'Após o preenchimento no módulo de origem, o registro poderá seguir para nova análise e continuidade do fluxo.',
      rastreabilidade: {
        origem: 'Módulo Operações por Volume',
        detectadoPor: 'Motor Operacional de Validação',
        detectadoEm: '2026-10-06T10:00:00Z',
      },
    },
  },
  {
    id: 'sx-01',
    codigo: 'SX-02BCDE',
    dominio: 'SERVICO_EXTRA',
    dominioLabel: 'Serviços Extras',
    empresaId: 'emp-01',
    empresaNome: 'Empresa Alpha',
    unidadeNome: 'Base Operacional',
    referencia: 'Enlonamento Especial · 2h',
    natureza: 'OPERACIONAL',
    naturezaLabel: 'Operacional de Campo',
    tituloHumano: 'Serviço extra devolvido para revisão',
    oqueEstaErrado: 'Devolvido: Horas divergentes da portaria.',
    impactoNoFluxo: 'Trava a autorização operacional e inclusão no faturamento.',
    responsavel: 'ENCARREGADO',
    responsavelLabel: 'Encarregado (Campo)',
    detectadoEm: '2026-10-06T11:00:00Z',
    bloqueante: true,
    moduloDestino: 'Serviços Extras',
    rotaDestino: '/operacional/servicos-extras',
    ctaLabel: 'Abrir em Serviços Extras',
    statusOrigem: 'DEVOLVIDO',
    detalhesDrawer: {
      oqueAconteceu: 'Devolvido: Horas divergentes da portaria.',
      porqueFluxoParou: 'Serviços extras devolvidos requerem ajuste nas horas ou justificativa.',
      impacto: 'O serviço não pode ser aprovado nem faturado ao cliente.',
      oquePrecisaSerFeito: 'Revisar o apontamento e reenviar no módulo de Serviços Extras.',
      responsavel: 'Encarregado (Campo)',
      ondeCorrigir: 'Operacional → Serviços Extras',
      depoisDaCorrecao: 'Após a revisão no módulo especialista, o serviço segue para reanálise e prosseguimento do fluxo.',
      rastreabilidade: {
        origem: 'Módulo Serviços Extras',
        detectadoPor: 'Supervisão Operacional',
        detectadoEm: '2026-10-06T11:00:00Z',
        motivoDevolucao: 'Horas divergentes da portaria.',
      },
    },
  },
  {
    id: 'cx-01',
    codigo: 'CX-03CDEF',
    dominio: 'CUSTO_EXTRA',
    dominioLabel: 'Custos Extras',
    empresaId: 'emp-02',
    empresaNome: 'Empresa Beta',
    unidadeNome: 'Base Operacional',
    referencia: 'Combustível Gerador · R$ 350.00',
    natureza: 'DOCUMENTAL',
    naturezaLabel: 'Documental & Anexos',
    tituloHumano: 'Despesa reprovada na conferência operacional',
    oqueEstaErrado: 'Despesa reprovada: Falta cupom fiscal.',
    impactoNoFluxo: 'Trava a aprovação da despesa e liberação no Contas a Pagar.',
    responsavel: 'ENCARREGADO',
    responsavelLabel: 'Encarregado (Campo)',
    detectadoEm: '2026-10-06T12:00:00Z',
    bloqueante: true,
    moduloDestino: 'Custos Extras',
    rotaDestino: '/operacional/custos-extras',
    ctaLabel: 'Abrir em Custos Extras',
    statusOrigem: 'REPROVADO',
    detalhesDrawer: {
      oqueAconteceu: 'Despesa reprovada: Falta cupom fiscal.',
      porqueFluxoParou: 'Nenhuma despesa ou reembolso operacional pode seguir para Contas a Pagar sem conferência.',
      impacto: 'A despesa não pode ser autorizada pelo financeiro.',
      oquePrecisaSerFeito: 'Revisar o valor, motivo ou anexar o comprovante correspondente.',
      responsavel: 'Encarregado (Campo)',
      ondeCorrigir: 'Operacional → Custos Extras',
      depoisDaCorrecao: 'Após o ajuste no módulo responsável, a despesa poderá seguir para nova conferência operacional.',
      rastreabilidade: {
        origem: 'Módulo Custos Extras',
        detectadoPor: 'Conferência Operacional',
        detectadoEm: '2026-10-06T12:00:00Z',
      },
    },
  },
  {
    id: 'dia-01',
    codigo: 'DIA-04DEFG',
    dominio: 'DIARISTA',
    dominioLabel: 'Diaristas',
    empresaId: 'emp-01',
    empresaNome: 'Empresa Alpha',
    unidadeNome: 'Base Operacional',
    referencia: 'Diarista: João Silva · R$ 160.00',
    colaboradorNome: 'João Silva',
    natureza: 'RH_PONTO',
    naturezaLabel: 'RH & Ponto',
    tituloHumano: 'Apontamento de diarista devolvido pelo RH',
    oqueEstaErrado: 'Apontamento de diária devolvido para conferência de presença e valores.',
    impactoNoFluxo: 'Trava a consolidação do lote semanal de diaristas.',
    responsavel: 'ENCARREGADO',
    responsavelLabel: 'Encarregado (Campo)',
    detectadoEm: '2026-10-06T13:00:00Z',
    bloqueante: true,
    moduloDestino: 'Diaristas',
    rotaDestino: '/operacional/diaristas',
    ctaLabel: 'Abrir em Diaristas',
    statusOrigem: 'DEVOLVIDO',
    detalhesDrawer: {
      oqueAconteceu: 'Apontamento de diária devolvido para conferência de presença e valores.',
      porqueFluxoParou: 'Divergências na presença ou duplicidade de diárias impedem o fechamento do lote.',
      impacto: 'O lote semanal de diaristas fica travado para validação do RH.',
      oquePrecisaSerFeito: 'Ajustar o apontamento de presença na grade semanal de Diaristas.',
      responsavel: 'Encarregado (Campo)',
      ondeCorrigir: 'Operacional → Diaristas',
      depoisDaCorrecao: 'Após a correção, o lote poderá ser revalidado para prosseguimento do fluxo.',
      rastreabilidade: {
        origem: 'Módulo Diaristas',
        detectadoPor: 'Conferência RH de Diaristas',
        detectadoEm: '2026-10-06T13:00:00Z',
      },
    },
  },
  {
    id: 'int-01',
    codigo: 'INT-05EFGH',
    dominio: 'INTERMITENTE',
    dominioLabel: 'Intermitentes',
    empresaId: 'emp-01',
    empresaNome: 'Empresa Alpha',
    unidadeNome: 'Departamento Operacional',
    referencia: 'Intermitente: Maria Souza · R$ 200.00',
    colaboradorNome: 'Maria Souza',
    natureza: 'CADASTRAL_VINCULO',
    naturezaLabel: 'Cadastral & Vínculo',
    tituloHumano: 'Colaborador não vinculado (órfão cadastral)',
    oqueEstaErrado: 'Colaborador não vinculado: Maria Souza (12345678900)',
    impactoNoFluxo: 'Trava o fechamento do lote quinzenal e o repasse financeiro.',
    responsavel: 'RH',
    responsavelLabel: 'RH / Departamento Pessoal',
    detectadoEm: '2026-10-06T14:00:00Z',
    bloqueante: true,
    moduloDestino: 'Central de Cadastros',
    rotaDestino: '/cadastros',
    ctaLabel: 'Completar Cadastro',
    statusOrigem: 'PENDENTE',
    detalhesDrawer: {
      oqueAconteceu: 'Colaborador não vinculado: Maria Souza (12345678900)',
      porqueFluxoParou: 'Lançamentos sem vínculo cadastral não podem gerar folha nem remessa.',
      impacto: 'O fechamento do período de intermitentes fica bloqueado.',
      oquePrecisaSerFeito: 'Completar o cadastro ou vínculo na Central de Cadastros.',
      responsavel: 'RH / Departamento Pessoal',
      ondeCorrigir: 'Central de Cadastros',
      depoisDaCorrecao: 'Após o saneamento, o lançamento poderá ser incorporado ao fechamento do período.',
      rastreabilidade: {
        origem: 'Módulo Intermitentes',
        detectadoPor: 'Validação Cadastral & RH',
        detectadoEm: '2026-10-06T14:00:00Z',
      },
    },
  },
  {
    id: 'pnt-01',
    codigo: 'PNT-06FGHI',
    dominio: 'PONTO_CLT',
    dominioLabel: 'Ponto CLT',
    empresaId: 'emp-02',
    empresaNome: 'Empresa Beta',
    unidadeNome: 'Unidade CLT',
    referencia: 'Ponto: Carlos Lima · Data: 2026-10-05',
    colaboradorNome: 'Carlos Lima',
    natureza: 'RH_PONTO',
    naturezaLabel: 'RH & Ponto',
    tituloHumano: 'Inconsistência na apuração do ponto',
    oqueEstaErrado: 'Marcação ímpar: batida de retorno de almoço ausente.',
    impactoNoFluxo: 'Trava a apuração de saldo de horas e fechamento do espelho de ponto.',
    responsavel: 'RH',
    responsavelLabel: 'RH / Departamento Pessoal',
    detectadoEm: '2026-10-06T15:00:00Z',
    bloqueante: false,
    moduloDestino: 'Ponto CLT',
    rotaDestino: '/clt/pontos',
    ctaLabel: 'Abrir em Ponto CLT',
    statusOrigem: 'INCONSISTENTE',
    detalhesDrawer: {
      oqueAconteceu: 'Marcação ímpar: batida de retorno de almoço ausente.',
      porqueFluxoParou: 'O motor de apuração bloqueia batidas incompletas para evitar passivos.',
      impacto: 'O colaborador não pode ter o espelho de ponto fechado.',
      oquePrecisaSerFeito: 'Regularizar a marcação no espelho de ponto do RH.',
      responsavel: 'RH / Departamento Pessoal',
      ondeCorrigir: 'RH → Ponto CLT',
      depoisDaCorrecao: 'Após a regularização auditada, o ponto poderá ser reprocessado pelo Motor RH.',
      rastreabilidade: {
        origem: 'Motor de Apuração de Ponto',
        detectadoPor: 'Validador de Jornada CLT',
        detectadoEm: '2026-10-06T15:00:00Z',
      },
    },
  },
];

describe('CONV-07 — Central de Inconsistências: Convergência Oficial UX09', () => {
  const pagePath = path.resolve(__dirname, '../pages/Inconsistencias.tsx');
  const servicePath = path.resolve(__dirname, '../services/inconsistenciasTransversais.service.ts');
  const drawerPath = path.resolve(__dirname, '../components/inconsistencias/InconsistenciaDrawer.tsx');
  const appPath = path.resolve(__dirname, '../App.tsx');

  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(EmpresaService, 'getAll').mockResolvedValue([
      { id: 'emp-01', nome: 'Empresa Alpha' } as any,
      { id: 'emp-02', nome: 'Empresa Beta' } as any,
    ]);

    vi.spyOn(InconsistenciasTransversaisService, 'getTodasInconsistencias').mockResolvedValue(
      SAMPLE_INCONSISTENCIAS
    );
  });

  const renderComponent = (initialEntries = ['/inconsistencias'], flowType?: string) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/inconsistencias" element={<Inconsistencias flowType={flowType} />} />
            <Route
              path="/intermitentes/inconsistencias"
              element={<Inconsistencias flowType="INTERMITENTE" lockedFlow={true} />}
            />
            <Route path="/operacoes-volume" element={<div data-testid="route-op">Operações</div>} />
            <Route path="/operacional/servicos-extras" element={<div data-testid="route-sx">Serviços</div>} />
            <Route path="/operacional/custos-extras" element={<div data-testid="route-cx">Custos</div>} />
            <Route path="/operacional/diaristas" element={<div data-testid="route-dia">Diaristas</div>} />
            <Route path="/operacional/intermitentes" element={<div data-testid="route-int">Intermitentes</div>} />
            <Route path="/clt/pontos" element={<div data-testid="route-clt">Ponto CLT</div>} />
            <Route path="/cadastros" element={<div data-testid="route-cad">Cadastros</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('1. Análise Estática de Código & Arquitetura', () => {
    it('1.1 App.tsx registra a rota oficial /inconsistencias e sub-rota /intermitentes/inconsistencias', () => {
      expect(appContent).toContain('path="/inconsistencias"');
      expect(appContent).toContain('path="/intermitentes/inconsistencias"');
    });

    it('1.2 A tela Inconsistencias.tsx NÃO contém dados mockados em produção', () => {
      expect(pageContent).not.toContain('MOCK_ITENS_INCONSISTENCIAS');
      expect(pageContent).not.toContain('MOCK_EMPRESAS_INCONSISTENCIAS');
    });

    it('1.3 A tela Inconsistencias.tsx NÃO contém botões "Liberar" nem "Editar" nem mutações diretas', () => {
      expect(pageContent).not.toContain('handleResolve');
      expect(pageContent).not.toContain('useAdminOverride');
      expect(pageContent).not.toContain('NovaOperacaoDialog');
      expect(pageContent).not.toContain('Liberar');
    });

    it('1.4 Service transversal agrega exatamente os 6 domínios reais sem mutação', () => {
      expect(serviceContent).toContain('fetchOperacoesVolume');
      expect(serviceContent).toContain('fetchServicosExtras');
      expect(serviceContent).toContain('fetchCustosExtras');
      expect(serviceContent).toContain('fetchDiaristas');
      expect(serviceContent).toContain('fetchIntermitentes');
      expect(serviceContent).toContain('fetchPontoClt');
      expect(serviceContent).not.toContain('.insert(');
      expect(serviceContent).not.toContain('.delete(');
    });

    it('1.5 Destinos primários oficiais obedecem estritamente às 7 rotas convergidas', () => {
      expect(DOMINIO_ROTAS_OFICIAIS.OPERACAO).toBe('/operacoes-volume');
      expect(DOMINIO_ROTAS_OFICIAIS.SERVICO_EXTRA).toBe('/operacional/servicos-extras');
      expect(DOMINIO_ROTAS_OFICIAIS.CUSTO_EXTRA).toBe('/operacional/custos-extras');
      expect(DOMINIO_ROTAS_OFICIAIS.DIARISTA).toBe('/operacional/diaristas');
      expect(DOMINIO_ROTAS_OFICIAIS.INTERMITENTE).toBe('/operacional/intermitentes');
      expect(DOMINIO_ROTAS_OFICIAIS.PONTO_CLT).toBe('/clt/pontos');
    });

    it('1.6 Custos Extras NÃO possuem referência a CNAB no serviço transversal nem no Drawer', () => {
      const matchCustosMethod = serviceContent.match(/fetchCustosExtras[\s\S]*?fetchDiaristas/);
      expect(matchCustosMethod?.[0]).not.toContain('CNAB');
      expect(drawerContent).not.toMatch(/CUSTO_EXTRA[\s\S]*?CNAB/i);
    });
  });

  describe('2. Renderização e KPIs Operacionais', () => {
    it('2.1 Renderiza Header institucional com título e subtítulo', async () => {
      renderComponent();

      expect(await screen.findByText('Central de Inconsistências')).toBeInTheDocument();
      expect(
        screen.getByText('Impedimentos que precisam ser corrigidos para o fluxo continuar.')
      ).toBeInTheDocument();
    });

    it('2.2 Calcula e exibe com precisão os 4 cards de KPIs da fila real', async () => {
      renderComponent();

      // Aguarda carregamento
      await screen.findByText('OP-01ABCD');

      // Card 1: Impedimentos Ativos = 6
      const cardAtivos = screen.getByRole('button', { name: /Impedimentos Ativos/i });
      expect(within(cardAtivos).getByText('6')).toBeInTheDocument();

      // Card 2: Bloqueantes = 5 (op-01, sx-01, cx-01, dia-01, int-01)
      const cardBloqueantes = screen.getByRole('button', { name: /Bloqueantes/i });
      expect(within(cardBloqueantes).getByText('5')).toBeInTheDocument();

      // Card 3: Ação de Campo = 4 (ENCARREGADO: op-01, sx-01, cx-01, dia-01)
      const cardCampo = screen.getByRole('button', { name: /Ação de Campo/i });
      expect(within(cardCampo).getByText('4')).toBeInTheDocument();

      // Card 4: Ação RH / Cadastro = 2 (RH: int-01, pnt-01)
      const cardRh = screen.getByRole('button', { name: /Ação RH \/ Cadastro/i });
      expect(within(cardRh).getByText('2')).toBeInTheDocument();
    });

    it('2.3 Cards de Síntese filtram a fila ao serem clicados', async () => {
      renderComponent();

      await screen.findByText('OP-01ABCD');

      // Clica no card Bloqueantes
      const cardBloqueantes = screen.getByRole('button', { name: /Bloqueantes/i });
      fireEvent.click(cardBloqueantes);

      // PNT-06FGHI tem bloqueante: false, não deve aparecer
      expect(screen.queryByText('PNT-06FGHI')).not.toBeInTheDocument();
      expect(screen.getByText('OP-01ABCD')).toBeInTheDocument();

      // Clica no card Ação RH / Cadastro
      const cardRh = screen.getByRole('button', { name: /Ação RH \/ Cadastro/i });
      fireEvent.click(cardRh);

      // Devem aparecer itens de responsabilidade RH (int-01, pnt-01)
      expect(screen.getByText('INT-05EFGH')).toBeInTheDocument();
      expect(screen.queryByText('OP-01ABCD')).not.toBeInTheDocument();
    });

    it('2.4 Pílulas de Domínio filtram a lista com precisão', async () => {
      renderComponent();

      await screen.findByText('OP-01ABCD');

      // Clica na pílula Ponto CLT
      const pillPonto = screen.getByRole('button', { name: /Ponto CLT/i });
      fireEvent.click(pillPonto);

      expect(screen.getByText('PNT-06FGHI')).toBeInTheDocument();
      expect(screen.queryByText('OP-01ABCD')).not.toBeInTheDocument();
      expect(screen.queryByText('SX-02BCDE')).not.toBeInTheDocument();
    });

    it('2.5 Busca textual localiza por código, referência ou texto do impedimento', async () => {
      renderComponent();

      await screen.findByText('OP-01ABCD');

      const inputBusca = screen.getByPlaceholderText(/Buscar por referência/i);
      fireEvent.change(inputBusca, { target: { value: 'Combustível Gerador' } });

      expect(screen.getByText('CX-03CDEF')).toBeInTheDocument();
      expect(screen.queryByText('OP-01ABCD')).not.toBeInTheDocument();
    });

    it('2.6 Botão "Restaurar Padrão" redefine todos os filtros', async () => {
      renderComponent();

      await screen.findByText('OP-01ABCD');

      const inputBusca = screen.getByPlaceholderText(/Buscar por referência/i);
      fireEvent.change(inputBusca, { target: { value: 'Inexistente' } });

      expect(screen.queryByText('OP-01ABCD')).not.toBeInTheDocument();

      const btnRestaurar = screen.getAllByRole('button', { name: /Restaurar Padrão/i })[0];
      fireEvent.click(btnRestaurar);

      expect(await screen.findByText('OP-01ABCD')).toBeInTheDocument();
    });
  });

  describe('3. Drawer de Diagnóstico e Despacho Contextual', () => {
    it('3.1 Linha da tabela abre o Drawer com a estrutura canônica completa', async () => {
      renderComponent();

      await screen.findByText('OP-01ABCD');

      const btnAnalisar = screen.getAllByRole('button', { name: /Analisar/i })[0];
      fireEvent.click(btnAnalisar);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('O que aconteceu?')).toBeInTheDocument();
      expect(screen.getByText('Por que o fluxo parou? (Impacto)')).toBeInTheDocument();
      expect(screen.getByText('O que precisa ser feito?')).toBeInTheDocument();
      expect(screen.getByText('Responsável pela Ação')).toBeInTheDocument();
      expect(screen.getByText('Onde Corrigir?')).toBeInTheDocument();
      expect(screen.getByText('Depois da Correção')).toBeInTheDocument();
      expect(screen.getByText('Rastreabilidade & Auditoria')).toBeInTheDocument();
    });

    it('3.2 CTA primário do Drawer despacha para a rota oficial sem mutação', async () => {
      renderComponent();

      await screen.findByText('OP-01ABCD');

      const btnAnalisar = screen.getAllByRole('button', { name: /Analisar/i })[0];
      fireEvent.click(btnAnalisar);

      const btnCta = screen.getByRole('button', { name: /Abrir em Operações/i });
      expect(btnCta).toBeInTheDocument();
      fireEvent.click(btnCta);

      // Verificação da rota de destino
      expect(await screen.findByTestId('route-op')).toBeInTheDocument();
    });

    it('3.3 Pendência cadastral despacha para /cadastros', async () => {
      renderComponent();

      await screen.findByText('INT-05EFGH');

      // Seleciona a linha do intermitente órfão
      const rowInt = screen.getByText('INT-05EFGH');
      fireEvent.click(rowInt);

      const btnCta = screen.getByRole('button', { name: /Completar Cadastro/i });
      expect(btnCta).toBeInTheDocument();
      fireEvent.click(btnCta);

      expect(await screen.findByTestId('route-cad')).toBeInTheDocument();
    });
  });

  describe('4. Compatibilidade e Estado Vazio', () => {
    it('4.1 Sub-rota /intermitentes/inconsistencias inicia com a pílula de intermitente pré-selecionada', async () => {
      renderComponent(['/intermitentes/inconsistencias']);

      await screen.findByText('INT-05EFGH');

      // Deve exibir apenas o intermitente
      expect(screen.getByText('INT-05EFGH')).toBeInTheDocument();
      expect(screen.queryByText('OP-01ABCD')).not.toBeInTheDocument();
    });

    it('4.2 Exibe estado vazio positivo quando não há inconsistências', async () => {
      vi.spyOn(InconsistenciasTransversaisService, 'getTodasInconsistencias').mockResolvedValue([]);

      renderComponent();

      expect(await screen.findByText('Fluxos sem impedimentos ativos.')).toBeInTheDocument();
      expect(
        screen.getByText(/Todos os registros operacionais, cadastrais e de ponto estão íntegros/i)
      ).toBeInTheDocument();
    });
  });
});
