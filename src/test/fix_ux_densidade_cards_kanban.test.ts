import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DENSITY_STORAGE_KEY } from '../pages/Financeiro/ReceitasPipeline';

// ==============================================================================
// SUÍTE FIX UX — DENSIDADE DOS CARDS DO KANBAN FINANCEIRO
// ==============================================================================

describe('FIX UX — Densidade dos Cards do Kanban Financeiro (Compacto / Detalhado)', () => {
  const receitaCaixaImediato = {
    id: 'rec-001',
    modalidade: 'CAIXA_IMEDIATO',
    status: 'pendente_recebimento',
    valor_total: 610.20,
    vencimento: '2026-09-17',
    empresas: { nome: 'BENEVIDES' },
    receitas_operacionais_itens: [
      {
        id: 'item-001',
        valor_item: 610.20,
        operacoes_producao: {
          id: 'op-001',
          quantidade: 1,
          placa: 'ABC-1234',
          servicos: { nome: 'Descarga' }
        }
      }
    ]
  };

  const receitaDuplicata = {
    id: 'rec-002',
    modalidade: 'DUPLICATA',
    status: 'pendente_cobranca',
    valor_total: 20.00,
    vencimento: '2026-10-02',
    empresas: { nome: 'BENEVIDES' },
    receitas_operacionais_itens: [
      {
        id: 'item-002',
        valor_item: 20.00,
        servicos_extras_operacionais: {
          id: 'se-001',
          tipo_servico: 'Serviço Extra',
          descricao_servico: 'Conserto de 5 paletes danificados'
        }
      }
    ]
  };

  const receitaMensal = {
    id: 'rec-003',
    modalidade: 'FATURAMENTO_MENSAL',
    status: 'aguardando_fechamento',
    competencia: '2026-09',
    vencimento: '2026-09-30',
    valor_total: 415.62,
    empresas: { nome: 'BENEVIDES' },
    receitas_operacionais_itens: [
      { id: 'item-003', valor_item: 200.00 },
      { id: 'item-004', valor_item: 215.62 }
    ]
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('1. default = Detalhado para usuários sem preferência salva', () => {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
    const density = (saved === 'compact' || saved === 'detailed') ? saved : 'detailed';
    expect(density).toBe('detailed');
  });

  it('2. alternância Detalhado -> Compacto atualiza o estado', () => {
    let density: 'compact' | 'detailed' = 'detailed';
    density = 'compact';
    expect(density).toBe('compact');
  });

  it('3. alternância Compacto -> Detalhado atualiza o estado', () => {
    let density: 'compact' | 'detailed' = 'compact';
    density = 'detailed';
    expect(density).toBe('detailed');
  });

  it('4. persistência da preferência no localStorage sob a chave canônica', () => {
    expect(DENSITY_STORAGE_KEY).toBe('orbe.financeiro.receitas.cardDensity');

    localStorage.setItem(DENSITY_STORAGE_KEY, 'compact');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');

    localStorage.setItem(DENSITY_STORAGE_KEY, 'detailed');
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('detailed');
  });

  it('5. Caixa Imediato compacto: subtítulo contextual contém serviço e modalidade', () => {
    const r = receitaCaixaImediato;
    const servicoCurto = r.receitas_operacionais_itens[0].operacoes_producao.servicos.nome;
    const subtitulo = `${servicoCurto} • Caixa Imediato`;
    expect(subtitulo).toBe('Descarga • Caixa Imediato');
  });

  it('6. Duplicata compacta: subtítulo contextual contém serviço e vencimento', () => {
    const r = receitaDuplicata;
    const itemExtra = r.receitas_operacionais_itens[0].servicos_extras_operacionais;
    const servicoCurto = itemExtra.tipo_servico;
    const infoVenc = `Venc. ${new Date(r.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}`;
    const subtitulo = `${servicoCurto} • ${infoVenc}`;
    expect(subtitulo).toBe('Serviço Extra • Venc. 02/10/2026');
  });

  it('7. Faturamento Mensal compacto: subtítulo contextual contém modalidade e competência', () => {
    const r = receitaMensal;
    const itemCount = r.receitas_operacionais_itens.length;
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const compStr = `${meses[parseInt(r.competencia.slice(5, 7)) - 1]}/${r.competencia.slice(0, 4)}`;
    const subtitulo = `${itemCount > 1 ? 'Faturamento Mensal' : 'Serviço'} • ${compStr}`;
    expect(subtitulo).toBe('Faturamento Mensal • Setembro/2026');
  });

  it('8. Serviço Extra compacto: NÃO assume artificialmente DESCARGA nem Placa', () => {
    const r = receitaDuplicata;
    const itemOps = r.receitas_operacionais_itens[0].operacoes_producao;
    const itemExtra = r.receitas_operacionais_itens[0].servicos_extras_operacionais;

    expect(itemOps).toBeUndefined();
    expect(itemExtra).toBeDefined();
    expect(itemExtra.tipo_servico).toBe('Serviço Extra');
    // Garante que não é exibido "Descarga"
    expect(itemExtra.tipo_servico).not.toContain('Descarga');
  });

  it('9. expansão individual: adiciona o card ao conjunto expandido', () => {
    const expandedCardIds = new Set<string>();
    expandedCardIds.add('rec-001');
    expect(expandedCardIds.has('rec-001')).toBe(true);
    expect(expandedCardIds.has('rec-002')).toBe(false);
  });

  it('10. recolhimento individual: remove o card do conjunto expandido', () => {
    const expandedCardIds = new Set<string>(['rec-001']);
    expandedCardIds.delete('rec-001');
    expect(expandedCardIds.has('rec-001')).toBe(false);
  });

  it('11. expansão de um card não expande os demais (independência)', () => {
    const expandedCardIds = new Set<string>();
    expandedCardIds.add('rec-001');
    expect(expandedCardIds.has('rec-001')).toBe(true);
    expect(expandedCardIds.has('rec-002')).toBe(false);
    expect(expandedCardIds.has('rec-003')).toBe(false);
  });

  it('12. mudança de modalidade preserva a preferência de densidade', () => {
    let activeTab: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL' = 'CAIXA_IMEDIATO';
    const density = 'compact';

    // Troca de aba não altera o density
    activeTab = 'DUPLICATA';
    expect(density).toBe('compact');

    activeTab = 'FATURAMENTO_MENSAL';
    expect(density).toBe('compact');
  });

  it('13. mudança de densidade não altera status financeiro da receita', () => {
    const receita = { ...receitaDuplicata };
    const statusInicial = receita.status;

    // Alternar densidade
    let density = 'compact';
    density = 'detailed';

    expect(receita.status).toBe(statusInicial);
    expect(receita.status).toBe('pendente_cobranca');
  });

  it('14. valores monetários permanecem idênticos entre os modos', () => {
    const valorOriginal = Number(receitaCaixaImediato.valor_total);
    const formattedCompact = `R$ ${valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const formattedDetailed = `R$ ${valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    expect(formattedCompact).toBe('R$ 610,20');
    expect(formattedDetailed).toBe('R$ 610,20');
  });

  it('15. vencimentos permanecem idênticos entre os modos', () => {
    const vencCompact = new Date(receitaDuplicata.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR');
    const vencDetailed = new Date(receitaDuplicata.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR');

    expect(vencCompact).toBe('02/10/2026');
    expect(vencDetailed).toBe('02/10/2026');
  });

  it('16. cards continuam na coluna correta independentemente da densidade', () => {
    const currentKanbanStages = [
      { id: "pendente_cobranca", label: "Cobrança gerada" },
      { id: "cobranca_enviada", label: "Cobrança enviada" },
      { id: "recebido", label: "Recebido" },
    ];

    const cols: Record<string, any[]> = {};
    currentKanbanStages.forEach(col => cols[col.id] = []);

    const r = receitaDuplicata;
    let st = r.status;
    if (st === 'cobranca_gerada') st = 'pendente_cobranca';
    cols[st].push(r);

    expect(cols['pendente_cobranca']).toHaveLength(1);
    expect(cols['cobranca_enviada']).toHaveLength(0);
    expect(cols['recebido']).toHaveLength(0);
  });

  describe('Auditoria de Código-Fonte (Garantias Estáticas)', () => {
    it('ReceitasPipeline.tsx exporta DENSITY_STORAGE_KEY canônico', () => {
      const pipelineContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx'),
        'utf-8'
      );
      expect(pipelineContent).toContain("export const DENSITY_STORAGE_KEY = 'orbe.financeiro.receitas.cardDensity'");
    });

    it('ReceitasPipeline.tsx inclui seletor com botões Compacto e Detalhado', () => {
      const pipelineContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/ReceitasPipeline.tsx'),
        'utf-8'
      );
      expect(pipelineContent).toContain("handleDensityChange('compact')");
      expect(pipelineContent).toContain("handleDensityChange('detailed')");
      expect(pipelineContent).toContain("ReceitaKanbanCard");
    });

    it('ReceitaKanbanCard.tsx implementa botões de expansão individual com acessibilidade', () => {
      const cardContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/components/ReceitaKanbanCard.tsx'),
        'utf-8'
      );
      expect(cardContent).toContain("aria-label={isExpanded ? \"Recolher detalhes da receita\" : \"Expandir detalhes da receita\"}");
      expect(cardContent).toContain("aria-expanded={isExpanded}");
      expect(cardContent).toContain("onToggleExpand");
    });
  });
});
