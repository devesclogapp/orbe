import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CONV-16 — FIX 05: Compactação do Cabeçalho e Alinhamento dos Filtros — Diaristas', () => {
  const painelPath = path.resolve(__dirname, '../pages/Rh/RhDiaristasPainel.tsx');
  const content = fs.readFileSync(painelPath, 'utf8');

  // 1. Cabeçalho com Atualizar e Exportar
  it('1. Move os botões Atualizar e Exportar para o cabeçalho oficial à direita do título', () => {
    // Título e subtítulo preservados
    expect(content).toContain('Diaristas');
    expect(content).toContain('Acompanhe os lançamentos semanais, confira as apurações e valide os lotes da operação.');

    // Presença dos botões no cabeçalho com handlers íntegros
    expect(content).toContain('onClick={() => refetch()}');
    expect(content).toContain('Atualizar');
    expect(content).toContain('onClick={exportarXlsx}');
    expect(content).toContain('disabled={dadosAgrupados.length === 0}');
    expect(content).toContain('Exportar');
  });

  // 2. Seção de Filtros em Linha Única
  it('2. Organiza a seção de filtros em linha única com os 8 campos na ordem exata', () => {
    const orderIndexEmpresa = content.indexOf('/* 1. Empresa */');
    const orderIndexPeriodo = content.indexOf('/* 2. Período');
    const orderIndexInicio = content.indexOf('/* 3. Início */');
    const orderIndexFim = content.indexOf('/* 4. Fim */');
    const orderIndexSituacao = content.indexOf('/* 5. Situação */');
    const orderIndexFuncao = content.indexOf('/* 6. Função */');
    const orderIndexColaborador = content.indexOf('/* 7. Colaborador');
    const orderIndexFechar = content.indexOf('/* 8. Fechar Período — Extremo Direito da Seção */');

    expect(orderIndexEmpresa).toBeGreaterThan(-1);
    expect(orderIndexPeriodo).toBeGreaterThan(orderIndexEmpresa);
    expect(orderIndexInicio).toBeGreaterThan(orderIndexPeriodo);
    expect(orderIndexFim).toBeGreaterThan(orderIndexInicio);
    expect(orderIndexSituacao).toBeGreaterThan(orderIndexFim);
    expect(orderIndexFuncao).toBeGreaterThan(orderIndexSituacao);
    expect(orderIndexColaborador).toBeGreaterThan(orderIndexFuncao);
    expect(orderIndexFechar).toBeGreaterThan(orderIndexColaborador);
  });

  // 3. Alinhamento de Base e Altura Uniforme
  it('3. Compartilha a mesma linha de base (items-end) e altura uniforme de controles (h-9)', () => {
    expect(content).toContain('items-end gap-2 xl:gap-2.5');
    expect(content).toContain('SelectTrigger className="h-9 w-full');
    expect(content).toContain('className="h-9 w-full text-xs font-mono bg-background border-border"');
  });

  // 4. Fechar Período no Extremo Direito
  it('4. Botão Fechar Período permanece no extremo direito da seção, alinhado à base dos controles', () => {
    expect(content).toContain('<Lock className="h-3.5 w-3.5 mr-1.5" /> Fechar Período');
    expect(content).toContain('tooltipFechamentoMsg');
  });

  // 5. Eliminação da Segunda Linha de Botões
  it('5. Não possui segunda linha de botões dentro da barra de filtros', () => {
    // Não existem mais os botões de ação duplicados no rodapé da barra de filtros
    const matchesAtualizar = (content.match(/Atualizar\s*<\/Button>/g) || []).length;
    expect(matchesAtualizar).toBe(1);
    const matchesExportar = (content.match(/Exportar\s*<\/Button>/g) || []).length;
    expect(matchesExportar).toBe(1);
  });

  // 6. Proporção e Legibilidade dos Filtros (Período Ampliado e Busca em Tela Útil)
  it('6. Garante largura ampliada para o filtro de Período e campo de busca preenchendo a tela útil com flex-1', () => {
    expect(content).toContain('/* 2. Período (Largura Ampliada para Legibilidade) */');
    expect(content).toContain('w-full sm:w-[155px] xl:w-[168px] shrink-0');
    expect(content).toContain('/* 7. Colaborador (Expansível para preencher a largura útil da tela) */');
    expect(content).toContain('min-w-[160px] flex-1');
    expect(content).toContain('placeholder="Buscar por colaborador..."');
  });
});
