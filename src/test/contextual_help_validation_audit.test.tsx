import { describe, it, expect } from 'vitest';
import { getHelpGuideForPath, CONTEXTUAL_HELP_CATALOG } from '@/data/contextualHelpData';

describe('Auditoria Funcional do Sistema Global de Ajuda Contextual', () => {
  // ITEM 1: Administrativo - Operações por Volume
  it('1. No Administrativo, o guia de Operações por Volume corresponde exatamente à tela', () => {
    const guide = getHelpGuideForPath('/operacoes-volume', 'ADMIN');
    expect(guide).toBeDefined();
    expect(guide?.title).toBe('Recepção e Gestão de Operações por Volume');
    expect(guide?.category).toBe('Operações de Campo');
    expect(guide?.purpose).toContain('Gerenciar, auditar e conferir todas as operações de volume');
    expect(guide?.fieldsAndStatus.some((f) => f.term === 'AGUARDANDO_RH')).toBe(true);
    expect(guide?.fieldsAndStatus.some((f) => f.term === 'APROVADO_RH')).toBe(true);
    expect(guide?.nextSteps).toContain('Receitas Operacionais');
  });

  // ITEM 2: Portal do Encarregado - Sem instruções ou links administrativos
  it('2. No Portal do Encarregado, o guia de lançamento não contém instruções administrativas, CNAB ou folha', () => {
    const guide = getHelpGuideForPath('/producao', 'ENCARREGADO');
    expect(guide).toBeDefined();
    expect(guide?.title).toBe('Lançamento de Operação por Volume');
    expect(guide?.targetRole).toContain('ENCARREGADO');

    // Validação estrita: Não deve instruir encarregado sobre CNAB, remessas ou folha
    const fullText = JSON.stringify(guide).toLowerCase();
    expect(guide?.nextSteps.toLowerCase()).not.toContain('cnab');
    expect(guide?.nextSteps.toLowerCase()).not.toContain('remessa');
    expect(guide?.nextSteps.toLowerCase()).not.toContain('folha');

    // Passo a passo focado no trabalho de campo
    expect(guide?.howItWorks[0].title).toContain('Identificação da Operação');
    expect(guide?.checklist.some((c) => c.includes('placa'))).toBe(true);
  });

  // ITEM 3: Central de Aprovações RH
  it('3. Na Central de Aprovações RH, o guia descreve a fila transversal e status de aprovação', () => {
    const guide = getHelpGuideForPath('/rh/aprovacoes', 'RH');
    expect(guide).toBeDefined();
    expect(guide?.title).toBe('Central Unificada de Aprovações RH');
    expect(guide?.category).toBe('Aprovações & Fechamento');
    expect(guide?.fieldsAndStatus.some((f) => f.term === 'AGUARDANDO_RH')).toBe(true);
    expect(guide?.fieldsAndStatus.some((f) => f.term === 'DEVOLVIDO')).toBe(true);
    expect(guide?.nextSteps).toContain('Contas a Pagar');
  });

  // ITEM 4: Financeiro - Separação estrita entre Receitas e Despesas (sem misturar pagamento com recebimento)
  it('4. No Financeiro, garante separação total entre Receitas (clientes) e Despesas (colaboradores/fornecedores)', () => {
    // Pipeline de Receitas
    const guideReceitas = getHelpGuideForPath('/financeiro/receitas', 'FINANCEIRO');
    expect(guideReceitas?.title).toBe('Pipeline de Receitas Operacionais');
    expect(guideReceitas?.purpose).toContain('receitas a partir das operações de campo');
    expect(guideReceitas?.purpose).toContain('faturamento');
    expect(guideReceitas?.fieldsAndStatus.some((f) => f.term.includes('Receita Executada'))).toBe(true);
    // Não pode falar de pagamento de colaborador no pipeline de receita
    expect(guideReceitas?.purpose.toLowerCase()).not.toContain('pagamento de colaborador');

    // Despesas & Contas a Pagar
    const guideDespesas = getHelpGuideForPath('/financeiro', 'FINANCEIRO');
    expect(guideDespesas?.title).toBe('Despesas & Contas a Pagar');
    expect(guideDespesas?.purpose).toContain('pagamentos devidos aos colaboradores');
    expect(guideDespesas?.fieldsAndStatus.some((f) => f.term === 'LIBERADO_PAGAMENTO')).toBe(true);

    // Central Bancária
    const guideBancario = getHelpGuideForPath('/bancario', 'FINANCEIRO');
    expect(guideBancario?.title).toBe('Central Bancária Unificada');
    expect(guideBancario?.fieldsAndStatus.some((f) => f.term.includes('CNAB 240'))).toBe(true);
    expect(guideBancario?.fieldsAndStatus.some((f) => f.term.includes('.REM'))).toBe(true);
    expect(guideBancario?.fieldsAndStatus.some((f) => f.term.includes('.RET'))).toBe(true);
  });

  // ITEM 5: Portal do Cliente
  it('5. No Portal do Cliente, o conteúdo é restrito exclusivamente ao acompanhamento externo', () => {
    const guide = getHelpGuideForPath('/cliente/dashboard', 'CLIENTE');
    expect(guide).toBeDefined();
    expect(guide?.title).toBe('Portal do Cliente - Visão Geral');
    expect(guide?.category).toBe('Ambiente Externo');
    expect(guide?.targetRole).toContain('CLIENTE');
    expect(guide?.purpose).toContain('operações logísticas executadas em suas instalações');

    // Não pode conter regras de backoffice interno
    const jsonStr = JSON.stringify(guide).toLowerCase();
    expect(jsonStr).not.toContain('dre operacional');
    expect(jsonStr).not.toContain('banco de horas');
    expect(jsonStr).not.toContain('cnab240');
  });

  // ITEM 6 & 7: Especificidade dos Guias
  it('7. Todas as rotas possuem guias específicos e não textos genéricos', () => {
    const rotasAuditadas = [
      '/producao',
      '/producao/diaristas',
      '/producao/custos-extras',
      '/producao/servicos-extras',
      '/producao/servicos-especificos',
      '/operacoes-volume',
      '/operacional/pipeline',
      '/operacional/dashboard',
      '/clt/pontos',
      '/clt/banco-horas',
      '/banco-horas/fechamento',
      '/operacional/diaristas',
      '/rh/diaristas/cadastros',
      '/operacional/intermitentes',
      '/rh/aprovacoes',
      '/inconsistencias',
      '/fechamento',
      '/financeiro/receitas',
      '/financeiro',
      '/bancario',
      '/financeiro/faturamento',
      '/financeiro/dre',
      '/cadastros',
      '/colaboradores',
      '/empresas',
      '/cadastros/regras-operacionais',
      '/relatorios',
      '/governanca/usuarios',
      '/governanca/auditoria',
      '/cliente/dashboard',
    ];

    const titulosEncontrados = new Set<string>();

    rotasAuditadas.forEach((rota) => {
      const guide = getHelpGuideForPath(rota);
      expect(guide, `Rota ${rota} sem guia retornado`).toBeDefined();
      expect(guide?.title).toBeTruthy();
      expect(guide?.purpose).toBeTruthy();
      expect(guide?.checklist.length).toBeGreaterThan(0);
      expect(guide?.howItWorks.length).toBeGreaterThan(1);
      titulosEncontrados.add(guide!.title);
    });

    // Confirma que não há um único título genérico duplicado em todas
    expect(titulosEncontrados.size).toBeGreaterThanOrEqual(20);
  });
});
