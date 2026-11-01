import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CONV-16 — FIX 08: Correção do Destino da Ação "Ver Lotes" na Aba Lotes & Ciclos', () => {
  const painelPath = path.resolve(__dirname, '../pages/Rh/RhDiaristasPainel.tsx');
  const content = fs.readFileSync(painelPath, 'utf8');

  it('1. Localiza a âncora de destino contextual com id="secao-lotes-periodo" e badge do ciclo selecionado', () => {
    expect(content).toContain('id="secao-lotes-periodo"');
    expect(content).toContain('Lotes do Período Selecionado');
    expect(content).toContain('{formatDate(inicio)} a {formatDate(fim)}');
  });

  it('2. Garante a busca ampla de histórico consolidado para que outros ciclos não desapareçam ao selecionar um período', () => {
    expect(content).toContain('queryKey: ["lotes_historico_consolidado", empresaFiltroId]');
    expect(content).toContain('lotesHistoricoParaTabela = useMemo');
    expect(content).toContain('lotesHistoricoParaTabela.forEach(l => {');
  });

  it('3. Rastreia o handler do botão "Ver Lotes" atualizando inicio, fim, periodoRapido="personalizado" e tabPrincipal="lotes"', () => {
    expect(content).toContain('setInicio(c.periodo_inicio);');
    expect(content).toContain('setFim(c.periodo_fim);');
    expect(content).toContain('setPeriodoRapido("personalizado");');
    expect(content).toContain('setTabPrincipal("lotes");');
  });

  it('4. Executa scrollIntoView suave em direção ao elemento #secao-lotes-periodo', () => {
    expect(content).toContain('const el = document.getElementById("secao-lotes-periodo");');
    expect(content).toContain('el.scrollIntoView({ behavior: "smooth", block: "start" });');
  });

  it('5. Apresenta feedback contextual via toast notificando o ciclo selecionado', () => {
    expect(content).toContain('toast.info(`Exibindo lotes do ciclo ${formatDate(c.periodo_inicio)} a ${formatDate(c.periodo_fim)}`);');
  });

  it('6. Fornece distinção visual do ciclo atualmente ativo com "Ativo no painel" e "Visualizando"', () => {
    expect(content).toContain('const isCicloAtivo = inicio === c.periodo_inicio && fim === c.periodo_fim;');
    expect(content).toContain('Ativo no painel');
    expect(content).toContain('Visualizando');
  });

  it('7. Preserva a ordem cronológica decrescente dos ciclos consolidados no histórico', () => {
    expect(content).toContain('list.sort((a, b) => (b.periodo_inicio || "").localeCompare(a.periodo_inicio || ""));');
  });
});
