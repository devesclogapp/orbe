import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CONV-16 — ETAPA 02A: Composição Visual Controlada do Painel RH de Diaristas', () => {
  const painelPath = path.resolve(__dirname, '../pages/Rh/RhDiaristasPainel.tsx');
  const content = fs.readFileSync(painelPath, 'utf8');

  it('1. Deve renderizar AppShell com título "Diaristas" e subtítulo oficial', () => {
    expect(content).toContain('title="Diaristas"');
    expect(content).toContain('subtitle="Acompanhe os lançamentos semanais, confira as apurações e valide os lotes da operação."');
  });

  it('2. Deve conter a Região 01: Cabeçalho com Filtros Compactos no padrão homologado', () => {
    expect(content).toContain('empresaFiltroId');
    expect(content).toContain('periodoRapido');
    expect(content).toContain('statusFiltro');
    expect(content).toContain('funcaoFiltro');
    expect(content).toContain('nomeFiltro');
    expect(content).toContain('exportarXlsx');
    expect(content).toContain('refetch()');
    expect(content).toContain('setOpenFechamento(true)');
  });

  it('3. Deve conter a Região 02: 4 KPIs Executivos com ExecutiveMetricCard', () => {
    expect(content).toContain('ExecutiveMetricCard');
    expect(content).toContain('label="Diárias Apuradas"');
    expect(content).toContain('label="Diaristas Ativos"');
    expect(content).toContain('label="Valor Apurado"');
    expect(content).toContain('label="Situação dos Lotes"');
  });

  it('4. Deve conter a Região 03: 4 Abas de Trabalho Compactas', () => {
    expect(content).toContain('tabPrincipal === "grade_semanal"');
    expect(content).toContain('tabPrincipal === "diarista"');
    expect(content).toContain('tabPrincipal === "lotes"');
    expect(content).toContain('tabPrincipal === "auditoria"');
    expect(content).toContain('Grade Semanal');
    expect(content).toContain('Por Diarista');
    expect(content).toContain('Lotes & Ciclos');
    expect(content).toContain('Auditoria & Governança');
  });

  it('5. Deve conter a Matriz da Grade Semanal com dias da semana e badges de marcação', () => {
    expect(content).toContain('diasDaSemanaBase.map');
    expect(content).toContain('Diária completa (1.0)');
    expect(content).toContain('Meia diária (0.5)');
    expect(content).toContain('totalDiarias.toFixed(1)');
  });

  it('6. Deve conter a Região 04: Modais Funcionais Preservados (Reabertura, Edição Admin, Fechamento)', () => {
    // Modal 1: Reabertura
    expect(content).toContain('openReabertura');
    expect(content).toContain('reabrirMutation.mutate');
    expect(content).toContain('tipoReabertura');

    // Modal 2: Edição Administrativa
    expect(content).toContain('openEdicao');
    expect(content).toContain('editarMutation.mutate');
    expect(content).toContain('recalcularValor');
    expect(content).toContain('motivo_edicao');

    // Modal 3: Fechamento
    expect(content).toContain('openFechamento');
    expect(content).toContain('fecharMutation.mutate');
  });

  it('7. Preserva todas as mutations e regras de negócio sem bypass', () => {
    expect(content).toContain('LancamentoDiaristaService.updateAdmin');
    expect(content).toContain('LoteFechamentoDiaristaService.fecharPeriodo');
    expect(content).toContain('LoteFechamentoDiaristaService.validarPeriodo');
    expect(content).toContain('LoteFechamentoDiaristaService.aprovarFinanceiro');
    expect(content).toContain('LoteFechamentoDiaristaService.reabrirPeriodo');
    expect(content).toContain('DiaristaCicloService.updateRegraFechamento');
  });

  it('8. FIX 01.1: Não deve conter referências desprovidas de import a React.Fragment em tempo de execução', () => {
    expect(content).not.toContain('<React.Fragment');
    expect(content).not.toContain('</React.Fragment>');
    expect(content).toContain('import React, { useMemo, useState, Fragment } from "react"');
  });

  it('9. FIX 01.2: Grade Semanal possui contenção horizontal e coluna de Colaborador fixa (sticky)', () => {
    expect(content).toContain('overflow-x-auto');
    expect(content).toContain('sticky left-0 z-20');
    expect(content).toContain('sticky left-0 z-10');
    expect(content).toContain('min-w-max');
    expect(content).toContain('shadow-');
  });

  it('10. FIX 01.3: Cabeçalho com identificação no conteúdo principal e filtros refinados', () => {
    expect(content).toContain('<h1 className="text-xl font-bold font-display text-foreground tracking-tight">');
    expect(content).toContain('Acompanhe os lançamentos semanais, confira as apurações e valide os lotes da operação.');
  });

  it('11. FIX 01.4: Auditoria contém timeline com scroll restrito e separação de Políticas com proteção de acesso', () => {
    expect(content).toContain('max-h-[540px] overflow-y-auto');
    expect(content).toContain('(isAdmin || isRh)');
    expect(content).toContain('Configurações Administrativas');
  });

  it('12. FIX 02 (FASE D): Preserva continuidade funcional encaminhando lotes para rotas canônicas por estado', () => {
    // Lote VALIDADO_RH vai para Aprovação Financeira existente
    expect(content).toContain('tab", "lotes-rh"');
    expect(content).toContain('navigate(`/financeiro?${params.toString()}`);');
    expect(content).toContain('Ver no Financeiro');

    // Lote aprovado vai para Remessa Bancária correspondente
    expect(content).toContain('tab", "diaristas"');
    expect(content).toContain('origem", "DIARISTA"');
    expect(content).toContain('navigate(`/bancario?${params.toString()}`);');
    expect(content).toContain('Ver no Bancário');

    // Lote pago permite consulta e rastreabilidade na conciliação
    expect(content).toContain('tab", "CONCILIACAO"');
    expect(content).toContain('Conciliado');
  });

  it('13. ETAPA 02B: Região 04 integra os 3 Drawers canônicos modulares', () => {
    expect(content).toContain('DrawerReaberturaDiarista');
    expect(content).toContain('DrawerEdicaoDiarista');
    expect(content).toContain('DrawerFechamentoDiarista');
  });

  it('14. ETAPA 02B: Preserva integridade de confirmações críticas e justificativas obrigatórias nos Drawers', () => {
    const fechamentoPath = path.resolve(__dirname, '../components/diaristas/drawers/DrawerFechamentoDiarista.tsx');
    const edicaoPath = path.resolve(__dirname, '../components/diaristas/drawers/DrawerEdicaoDiarista.tsx');
    const reaberturaPath = path.resolve(__dirname, '../components/diaristas/drawers/DrawerReaberturaDiarista.tsx');

    const fechamentoContent = fs.readFileSync(fechamentoPath, 'utf8');
    const edicaoContent = fs.readFileSync(edicaoPath, 'utf8');
    const reaberturaContent = fs.readFileSync(reaberturaPath, 'utf8');

    // Confirmação com FECHAR
    expect(fechamentoContent).toContain('confirmText !== "FECHAR"');

    // Justificativa de edição mínima de 5 caracteres
    expect(edicaoContent).toContain('motivo_edicao.trim().length < 5');

    // Justificativa de reabertura obrigatória
    expect(reaberturaContent).toContain('!motivoReabertura.trim()');
  });

  it('15. ETAPA 02B (PEND-03): Orientação contextual em Por Diarista reage ao estado real de liquidação/permissão', () => {
    expect(content).toContain('Registros liquidados — edição bloqueada pela política financeira.');
    expect(content).toContain('Visualização de conferência — edição administrativa restrita ao RH/Admin.');
    expect(content).toContain('Clique no ícone de engrenagem para realizar edição administrativa autorizada.');
  });
});
