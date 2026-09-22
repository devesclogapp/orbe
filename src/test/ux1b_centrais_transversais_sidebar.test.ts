import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isRouteMatchingItem } from '@/components/layout/Sidebar';

describe('FASE UX-1B — Centrais Transversais do Sidebar', () => {
  const sidebarPath = path.resolve(__dirname, '../components/layout/Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

  it('1. "Aprovações Globais" não permanece dentro do grupo RH', () => {
    const rhIndex = sidebarContent.indexOf('id: "rh"');
    const aprovacoesIndex = sidebarContent.indexOf('id: "aprovacoes"');
    const rhBlock = sidebarContent.substring(rhIndex, aprovacoesIndex);

    expect(rhBlock).not.toContain('Aprovações Globais');
    expect(rhBlock).not.toContain('/rh/aprovacoes');
  });

  it('2. Existe entrada transversal direta: Aprovações -> /rh/aprovacoes', () => {
    const aprovacoesMatch = sidebarContent.includes('id: "aprovacoes"') &&
      sidebarContent.includes('label: "Aprovações"') &&
      sidebarContent.includes('to: "/rh/aprovacoes"');

    expect(aprovacoesMatch).toBe(true);
  });

  it('3. Existe entrada transversal direta: Fechamento -> /fechamento', () => {
    const fechamentoMatch = sidebarContent.includes('id: "fechamento"') &&
      sidebarContent.includes('label: "Fechamento"') &&
      sidebarContent.includes('to: "/fechamento"');

    expect(fechamentoMatch).toBe(true);
  });

  it('4. Fechamento não possui submenu redundante (é acesso direto de 1º nível)', () => {
    const fechamentoIndex = sidebarContent.indexOf('id: "fechamento"');
    const financeiroIndex = sidebarContent.indexOf('id: "financeiro"');
    const fechamentoBlock = sidebarContent.substring(fechamentoIndex, financeiroIndex);

    expect(fechamentoBlock).toContain('to: "/fechamento"');
    expect(fechamentoBlock).not.toContain('items: [');
  });

  it('5. RH contém Central/Processamento, Banco de Horas e Fechamento Mensal CLT', () => {
    const rhIndex = sidebarContent.indexOf('id: "rh"');
    const aprovacoesIndex = sidebarContent.indexOf('id: "aprovacoes"');
    const rhBlock = sidebarContent.substring(rhIndex, aprovacoesIndex);

    expect(rhBlock).toContain('{ icon: CalendarCheck, label: "Central / Processamento", to: "/banco-horas/processamento"');
    expect(rhBlock).toContain('{ icon: Clock, label: "Banco de Horas", to: "/banco-horas"');
    expect(rhBlock).toContain('{ icon: Lock, label: "Fechamento Mensal CLT", to: "/banco-horas/fechamento"');
  });

  it('6. /rh/aprovacoes é a rota da entrada transversal APROVAÇÕES', () => {
    const aprovacoesIndex = sidebarContent.indexOf('id: "aprovacoes"');
    const fechamentoIndex = sidebarContent.indexOf('id: "fechamento"');
    const aprovacoesBlock = sidebarContent.substring(aprovacoesIndex, fechamentoIndex);

    expect(aprovacoesBlock).toContain('to: "/rh/aprovacoes"');
    expect(aprovacoesBlock).not.toContain('items: [');
  });

  it('7. /fechamento destaca apenas FECHAMENTO transversal e não ativa subitens residuais', () => {
    const itemIntermitentesLotes = {
      icon: () => null,
      label: 'Lotes',
      to: '/fechamento',
    };
    const itemDiaristasLotes = {
      icon: () => null,
      label: 'Lotes / Pagamentos',
      to: '/fechamento',
    };

    const loc = { pathname: '/fechamento', search: '' };

    // Itens de submódulos não devem acender em /fechamento
    expect(isRouteMatchingItem(itemIntermitentesLotes as any, loc)).toBe(false);
    expect(isRouteMatchingItem(itemDiaristasLotes as any, loc)).toBe(false);
  });

  it('8. Aprovações contextuais continuam destacando seus respectivos fluxos sem conflito com a transversal', () => {
    const itemCustosAprovacoes = {
      icon: () => null,
      label: 'Aprovações',
      to: '/custos-extras/aprovacoes',
    };
    const itemServicosAprovacoes = {
      icon: () => null,
      label: 'Aprovações',
      to: '/servicos-extras/aprovacoes',
    };
    const itemOperacoesAprovacoes = {
      icon: () => null,
      label: 'Aprovações',
      to: '/operacoes-volume/aprovacoes',
    };
    const itemDiaristasAprovacoes = {
      icon: () => null,
      label: 'Aprovações',
      to: '/diaristas/aprovacoes',
    };
    const itemIntermitentesAprovacoes = {
      icon: () => null,
      label: 'Aprovações',
      to: '/intermitentes/aprovacoes',
    };
    const itemCltAprovacoes = {
      icon: () => null,
      label: 'Aprovações',
      to: '/clt/aprovacoes',
    };

    // Validar ativação contextual exata para cada um
    expect(isRouteMatchingItem(itemCustosAprovacoes as any, { pathname: '/custos-extras/aprovacoes', search: '' })).toBe(true);
    expect(isRouteMatchingItem(itemServicosAprovacoes as any, { pathname: '/servicos-extras/aprovacoes', search: '' })).toBe(true);
    expect(isRouteMatchingItem(itemOperacoesAprovacoes as any, { pathname: '/operacoes-volume/aprovacoes', search: '' })).toBe(true);
    expect(isRouteMatchingItem(itemDiaristasAprovacoes as any, { pathname: '/diaristas/aprovacoes', search: '' })).toBe(true);
    expect(isRouteMatchingItem(itemIntermitentesAprovacoes as any, { pathname: '/intermitentes/aprovacoes', search: '' })).toBe(true);
    expect(isRouteMatchingItem(itemCltAprovacoes as any, { pathname: '/clt/aprovacoes', search: '' })).toBe(true);

    // Nenhum deles deve ativar quando a rota for /rh/aprovacoes
    const locGlobal = { pathname: '/rh/aprovacoes', search: '' };
    expect(isRouteMatchingItem(itemCustosAprovacoes as any, locGlobal)).toBe(false);
    expect(isRouteMatchingItem(itemServicosAprovacoes as any, locGlobal)).toBe(false);
    expect(isRouteMatchingItem(itemOperacoesAprovacoes as any, locGlobal)).toBe(false);
    expect(isRouteMatchingItem(itemDiaristasAprovacoes as any, locGlobal)).toBe(false);
    expect(isRouteMatchingItem(itemIntermitentesAprovacoes as any, locGlobal)).toBe(false);
    expect(isRouteMatchingItem(itemCltAprovacoes as any, locGlobal)).toBe(false);
  });

  describe('Ajuste Textual Final UX-1B — AprovacoesRh.tsx', () => {
    const aprovacoesPagePath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
    const aprovacoesPageContent = fs.readFileSync(aprovacoesPagePath, 'utf-8');

    it('9. Modo global exibe Título "Aprovações" e Subtítulo "Central de validação e decisões pendentes"', () => {
      expect(aprovacoesPageContent).toContain(': "Aprovações";');
      expect(aprovacoesPageContent).toContain(': "Central de validação e decisões pendentes";');
      expect(aprovacoesPageContent).not.toContain('"Aprovações RH"');
      expect(aprovacoesPageContent).not.toContain('"Fila de aprovações do RH - decisões pendentes"');
    });

    it('10. Modos contextuais preservam identificação específica', () => {
      expect(aprovacoesPageContent).toContain('const pageTitle = isContextMode ? `Aprovações — ${currentTypeLabel}` : "Aprovações";');
      expect(aprovacoesPageContent).toContain('const pageSubtitle = isContextMode');
      expect(aprovacoesPageContent).toContain('`Fila de aprovações contextuais para ${currentTypeLabel}`');
      expect(aprovacoesPageContent).toContain(': "Central de validação e decisões pendentes";');
    });
  });
});
