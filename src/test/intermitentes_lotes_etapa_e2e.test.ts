import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntermitentesLoteService } from '@/services/domain/intermitentes.service';
import { EnvironmentService } from '@/services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-tester-id' } }, error: null }),
    },
  },
}));

vi.mock('@/services/domain/base.service', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentSessionContext: vi.fn().mockResolvedValue({ tenantId: 'tenant-test-uuid', userId: 'usr-tester-id' }),
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-test-uuid'),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-tester-id', tenant_id: 'tenant-test-uuid' }),
  };
});

describe('E2E INTERMITENTES — SANEAMENTO DA ETAPA LOTES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // 1. Sidebar e Rotas canônicas
  it('1. Sidebar e App.tsx apontam Intermitentes -> Lotes para a rota canônica /operacional/intermitentes/lotes', () => {
    const sidebarPath = path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

    const intermitentesMatch = sidebarContent.match(/id:\s*"intermitentes"[\s\S]*?items:\s*\[([\s\S]*?)\]/);
    expect(intermitentesMatch).not.toBeNull();
    const itemsBlock = intermitentesMatch![1];

    expect(itemsBlock).toContain('label: "Lotes"');
    expect(itemsBlock).toContain('to: "/operacional/intermitentes/lotes"');
    expect(itemsBlock).not.toContain('to: "/operacional/intermitentes?tab=historico"');

    const appPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    expect(appContent).toContain('path="/operacional/intermitentes/lotes"');
    expect(appContent).toContain('path="/intermitentes/lotes"');
  });

  // 2. listarLotes lista entidades de Lote enriquecidas com horas e status financeiro
  it('2. listarLotes retorna lotes agrupados com horas consolidadas e status financeiro', async () => {
    localStorage.setItem('esc-log-environment', 'HOMOLOGACAO');

    const empId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';
    vi.spyOn(EnvironmentService, 'getTestEmpresaIds').mockResolvedValue([empId]);

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        const queryObj: any = {};
        queryObj.order = vi.fn().mockReturnValue(queryObj);
        queryObj.in = vi.fn().mockReturnValue(queryObj);
        queryObj.or = vi.fn().mockReturnValue(queryObj);
        queryObj.eq = vi.fn().mockReturnValue(queryObj);
        queryObj.then = (resolve: any) =>
          Promise.resolve({
            data: [
              {
                id: loteId,
                tenant_id: 'tenant-test-uuid',
                empresa_id: empId,
                competencia: '2026-10',
                periodo_inicio: '2026-10-01',
                periodo_fim: '2026-10-31',
                quantidade_registros: 2,
                valor_total: 570,
                status: 'VALIDADO_RH',
                empresa: { id: empId, nome: 'Empresa Teste - Homologação' },
              },
            ],
            error: null,
          }).then(resolve);

        return {
          select: vi.fn().mockReturnValue(queryObj),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'lanc-1', lote_fechamento_id: loteId, horas_trabalhadas: 8, horas_normais: 8, he_50: 0, he_100: 0, total: 240 },
                { id: 'lanc-2', lote_fechamento_id: loteId, horas_trabalhadas: 10, horas_normais: 8, he_50: 2, he_100: 0, total: 330 },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'rh-lote-1', empresa_id: empId, competencia: '2026-10', status: 'AGUARDANDO_FINANCEIRO' },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const lotes = await IntermitentesLoteService.listarLotes({
      competencia: '2026-10',
      empresaId: empId,
    });

    expect(lotes).toHaveLength(1);
    const lote = lotes[0];

    // Validações do lote E2E
    expect(lote.id).toBe(loteId);
    expect(lote.quantidade_registros).toBe(2);
    expect(lote.valor_total).toBe(570);
    expect(lote.status).toBe('VALIDADO_RH');
    expect(lote.status_financeiro).toBe('AGUARDANDO_FINANCEIRO');
    expect(lote.horas_trabalhadas).toBe(18);
    expect(lote.horas_normais).toBe(16);
    expect(lote.he_50).toBe(2);
    expect(lote.empresa?.nome).toBe('Empresa Teste - Homologação');
  });

  // 3. getLoteDetalhe retorna composição de colaboradores, horas e status financeiro
  it('3. getLoteDetalhe retorna os 2 colaboradores individuais com horas e valores', async () => {
    const empId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
    const loteId = '930915d6-cb8f-4739-8001-7fa49d3009e4';

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'intermitentes_lotes_fechamento') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: loteId,
                  tenant_id: 'tenant-test-uuid',
                  empresa_id: empId,
                  competencia: '2026-10',
                  periodo_inicio: '2026-10-01',
                  periodo_fim: '2026-10-31',
                  quantidade_registros: 2,
                  valor_total: 570,
                  status: 'VALIDADO_RH',
                  empresa: { id: empId, nome: 'Empresa Teste - Homologação' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'lancamentos_intermitentes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: '5349a94a-2e34-4463-8c95-33f26aac0b98',
                    colaborador_id: 'colab-1',
                    nome_colaborador: 'Homologação Itaú 001',
                    data_referencia: '2026-10-05',
                    cargo: 'AUXILIAR DE CARGA E DESCARGA',
                    convocacao: 'CONV-HML-202610-01',
                    horas_trabalhadas: 8,
                    horas_normais: 8,
                    he_50: 0,
                    total: 240,
                    status_pipeline: 'APROVADO_RH',
                  },
                  {
                    id: 'a9fb4fa9-e3e9-4c27-940f-f65c9d909cb9',
                    colaborador_id: 'colab-2',
                    nome_colaborador: 'Homologação Itaú 002',
                    data_referencia: '2026-10-06',
                    cargo: 'AUXILIAR DE CARGA E DESCARGA',
                    convocacao: 'CONV-HML-202610-02',
                    horas_trabalhadas: 10,
                    horas_normais: 8,
                    he_50: 2,
                    total: 330,
                    status_pipeline: 'APROVADO_RH',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'rh_financeiro_lotes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { status: 'AGUARDANDO_FINANCEIRO' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const detalhe = await IntermitentesLoteService.getLoteDetalhe(loteId);

    expect(detalhe.id).toBe(loteId);
    expect(detalhe.total_colaboradores).toBe(2);
    expect(detalhe.horas_trabalhadas).toBe(18);
    expect(detalhe.horas_normais).toBe(16);
    expect(detalhe.he_50).toBe(2);
    expect(detalhe.status_financeiro).toBe('AGUARDANDO_FINANCEIRO');

    expect(detalhe.itens).toHaveLength(2);
    expect(detalhe.itens[0].nome_colaborador).toBe('Homologação Itaú 001');
    expect(detalhe.itens[0].valor_calculado).toBe(240);
    expect(detalhe.itens[0].horas).toBe(8);

    expect(detalhe.itens[1].nome_colaborador).toBe('Homologação Itaú 002');
    expect(detalhe.itens[1].valor_calculado).toBe(330);
    expect(detalhe.itens[1].horas).toBe(10);
    expect(detalhe.itens[1].he_50).toBe(2);
  });

  // 4. Validação estática de IntermitentesLotes.tsx
  it('4. IntermitentesLotes.tsx implementa DrawerPrimarioShell, DrawerSecundarioShell e Linha do Tempo', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/Operacional/IntermitentesLotes.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Tabela e colunas
    expect(content).toContain('Lotes de Intermitentes');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Lote</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Empresa</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Competência</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold text-center">Registros</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Composição Horas</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold text-right">Valor Total</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Status RH</th>');
    expect(content).toContain('th className="py-3 px-4 font-semibold">Status Financeiro</th>');

    // Drawers
    expect(content).toContain('<DrawerPrimarioShell');
    expect(content).toContain('<DrawerSecundarioShell');
    expect(content).toContain('title="Linha do Tempo — Intermitentes"');

    // Etapas da linha do tempo
    expect(content).toContain('1. Importação Tio Digital');
    expect(content).toContain('2. Fechamento de Período');
    expect(content).toContain('3. Validação do RH');
    expect(content).toContain('4. Aprovação Financeira / Remessa');
    expect(content).toContain('5. Geração de Arquivo CNAB 240');
    expect(content).toContain('6. Retorno Bancário & Quitação (PAGO)');

    // Continuidade
    expect(content).toContain('Avançar para Remessa');
    expect(content).toContain('/bancario?tab=intermitentes&origem=INTERMITENTE');
  });

  // 5. Validação de AprovacoesRh.tsx enriquecido
  it('5. AprovacoesRh.tsx exibe horas e colaboradores de Intermitentes e redireciona para Lotes', () => {
    const filePath = path.resolve(process.cwd(), 'src/pages/Rh/AprovacoesRh.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Query de detalhes
    expect(content).toContain('queryKey: ["intermitente-detalhes-aprovacao", item.id]');

    // Detalhamento de colaboradores
    expect(content).toContain('{item.tipo === "INTERMITENTE" && (');
    expect(content).toContain('Colaboradores do Lote');

    // Redirecionamento canônico
    expect(content).toContain('"INTERMITENTE": "/operacional/intermitentes/lotes"');
    expect(content).toContain('selectedLoteId: item.id');
  });
});
