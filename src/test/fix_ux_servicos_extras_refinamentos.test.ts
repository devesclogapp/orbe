import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ==============================================================================
// SUÍTE DE TESTES: FIX — REFINAMENTOS FINAIS DE UX | SERVIÇOS EXTRAS
// 1. Ordenação canônica: created_at DESC, id DESC
// 2. Terminologia multiorigem: "lançamentos"
// 3. Pluralização gramatical no fechamento
// 4. Título dinâmico das origens base: Detalhes das Operações / Serviços Extras / Lançamentos
// ==============================================================================

describe('SUÍTE: Refinamentos de UX — Serviços Extras & Multiorigem', () => {

  // ----------------------------------------------------------------------------
  // 1. ORDENAÇÃO: MAIS RECENTEMENTE LANÇADO PRIMEIRO
  // ----------------------------------------------------------------------------
  describe('1. Ordenação Canônica (created_at DESC, id DESC)', () => {
    interface MockItem {
      id: string;
      data: string;
      created_at?: string;
      criado_em?: string;
      descricao: string;
    }

    // Função idêntica à implementada no ServicosExtrasTableBlock
    function ordenarServicosExtras(items: MockItem[]): MockItem[] {
      return [...items].sort((a, b) => {
        const timeA = new Date(a.created_at || a.criado_em || (a.data ? `${a.data}T12:00:00` : 0)).getTime();
        const timeB = new Date(b.created_at || b.criado_em || (b.data ? `${b.data}T12:00:00` : 0)).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id ?? '').localeCompare(String(a.id ?? ''));
      });
    }

    it('A.1. Lançamentos da mesma data operacional devem ordenar pelo created_at DESC (mais recente primeiro)', () => {
      const items: MockItem[] = [
        { id: 'se-1', data: '2026-09-17', created_at: '2026-09-17T10:00:00.000Z', descricao: 'Primeiro lançado' },
        { id: 'se-2', data: '2026-09-17', created_at: '2026-09-17T11:00:00.000Z', descricao: 'Segundo lançado' },
        { id: 'se-3', data: '2026-09-17', created_at: '2026-09-17T12:00:00.000Z', descricao: 'Terceiro lançado' },
      ];

      const ordenados = ordenarServicosExtras(items);

      expect(ordenados[0].id).toBe('se-3');
      expect(ordenados[1].id).toBe('se-2');
      expect(ordenados[2].id).toBe('se-1');
    });

    it('A.2. Lançamento retroativo com created_at mais recente deve aparecer no topo', () => {
      const items: MockItem[] = [
        // Lançado ontem às 10:00
        { id: 'se-antigo', data: '2026-09-17', created_at: '2026-09-17T10:00:00.000Z', descricao: 'Operação de hoje' },
        // Lançado hoje com data retroativa de 16/09, mas created_at às 14:00
        { id: 'se-retroativo', data: '2026-09-16', created_at: '2026-09-17T14:00:00.000Z', descricao: 'Retroativo de ontem' },
      ];

      const ordenados = ordenarServicosExtras(items);

      // Como foi criado mais recentemente (14:00 > 10:00), deve aparecer no topo
      expect(ordenados[0].id).toBe('se-retroativo');
      expect(ordenados[1].id).toBe('se-antigo');
    });

    it('A.3. Desempate determinístico por id DESC quando created_at coincide exatamente', () => {
      const items: MockItem[] = [
        { id: 'aaa-1', data: '2026-09-17', created_at: '2026-09-17T10:00:00.000Z', descricao: 'A' },
        { id: 'zzz-2', data: '2026-09-17', created_at: '2026-09-17T10:00:00.000Z', descricao: 'Z' },
      ];

      const ordenados = ordenarServicosExtras(items);

      expect(ordenados[0].id).toBe('zzz-2');
      expect(ordenados[1].id).toBe('aaa-1');
    });

    it('A.4. Deve suportar campo legado criado_em como fallback transparente para created_at', () => {
      const items: MockItem[] = [
        { id: 'se-1', data: '2026-09-17', criado_em: '2026-09-17T09:00:00.000Z', descricao: 'Mais antigo' },
        { id: 'se-2', data: '2026-09-17', criado_em: '2026-09-17T15:00:00.000Z', descricao: 'Mais recente' },
      ];

      const ordenados = ordenarServicosExtras(items);

      expect(ordenados[0].id).toBe('se-2');
      expect(ordenados[1].id).toBe('se-1');
    });

    it('A.5. ServicosExtrasOperacionaisService.getWithEmpresas deve conter ordenação por criado_em DESC e id DESC', () => {
      const serviceContent = fs.readFileSync(
        path.resolve(__dirname, '../services/receitas/receitas.service.ts'),
        'utf-8'
      );

      expect(serviceContent).toContain(".order('criado_em', { ascending: false })");
      expect(serviceContent).toContain(".order('id', { ascending: false })");
    });
  });

  // ----------------------------------------------------------------------------
  // 2. PLURALIZAÇÃO E CORREÇÃO GRAMATICAL DO FECHAMENTO
  // ----------------------------------------------------------------------------
  describe('2. Correção Gramatical e Pluralização no Fechamento', () => {
    function gerarTextoFechamento(totalItens: number): string {
      return totalItens === 1
        ? "Você consolidará 1 lançamento pendente para esta empresa e registrará o fechamento deste ciclo."
        : `Você consolidará ${totalItens} lançamentos pendentes para esta empresa e registrará o fechamento deste ciclo.`;
    }

    it('B.1. Singular: 1 item deve resultar em "1 lançamento pendente"', () => {
      const texto = gerarTextoFechamento(1);
      expect(texto).toBe('Você consolidará 1 lançamento pendente para esta empresa e registrará o fechamento deste ciclo.');
      expect(texto).not.toContain('1 lançamentos');
      expect(texto).not.toContain('1 operações');
      expect(texto).not.toContain('agrupará');
    });

    it('B.2. Plural: 2 itens deve resultar em "2 lançamentos pendentes"', () => {
      const texto = gerarTextoFechamento(2);
      expect(texto).toBe('Você consolidará 2 lançamentos pendentes para esta empresa e registrará o fechamento deste ciclo.');
      expect(texto).not.toContain('2 operações');
    });

    it('B.3. Plural: N itens deve manter concordância exata', () => {
      const texto = gerarTextoFechamento(15);
      expect(texto).toBe('Você consolidará 15 lançamentos pendentes para esta empresa e registrará o fechamento deste ciclo.');
    });

    it('B.4. ModalReceitaOperacional.tsx deve conter a lógica de pluralização implementada', () => {
      const modalContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'),
        'utf-8'
      );

      expect(modalContent).toContain('totalItens === 1');
      expect(modalContent).toContain('Você consolidará 1 lançamento pendente para esta empresa e registrará o fechamento deste ciclo.');
      expect(modalContent).toContain('lançamentos pendentes para esta empresa e registrará o fechamento deste ciclo.');
      expect(modalContent).not.toContain('Você agrupará');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. TERMINOLOGIA MULTIORIGEM E TÍTULO DAS ORIGENS BASE
  // ----------------------------------------------------------------------------
  describe('3. Terminologia Multiorigem e Título Dinâmico dos Itens Base', () => {
    function resolverTituloSecao(itens: Array<{ operacao_id?: string; servico_extra_id?: string }>): string {
      if (itens.length === 0) return "Detalhes dos Lançamentos";
      const temOp = itens.some(i => Boolean(i.operacao_id));
      const temSe = itens.some(i => Boolean(i.servico_extra_id));
      if (temOp && !temSe) return "Detalhes das Operações";
      if (temSe && !temOp) return "Detalhes dos Serviços Extras";
      return "Detalhes dos Lançamentos";
    }

    it('C.1. Receita exclusiva de Operações por Volume exibe "Detalhes das Operações"', () => {
      const itens = [{ operacao_id: 'op-1' }, { operacao_id: 'op-2' }];
      expect(resolverTituloSecao(itens)).toBe('Detalhes das Operações');
    });

    it('C.2. Receita exclusiva de Serviços Extras exibe "Detalhes dos Serviços Extras"', () => {
      const itens = [{ servico_extra_id: 'se-1' }];
      expect(resolverTituloSecao(itens)).toBe('Detalhes dos Serviços Extras');
    });

    it('C.3. Receita mista (Operações + Serviços Extras) exibe "Detalhes dos Lançamentos"', () => {
      const itens = [{ operacao_id: 'op-1' }, { servico_extra_id: 'se-1' }];
      expect(resolverTituloSecao(itens)).toBe('Detalhes dos Lançamentos');
    });

    it('C.4. Textos de orientação do Faturamento Mensal devem utilizar "lançamentos"', () => {
      const modalContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'),
        'utf-8'
      );

      // Verificação de textos compartilhados atualizados
      expect(modalContent).toContain('Os lançamentos de faturamento mensal deste ciclo foram apurados.');
      expect(modalContent).toContain('Emitir o PDF da fatura unificada com todos os lançamentos apurados.');
      expect(modalContent).toContain('contendo todos os lançamentos apurados.');

      // Não deve conter a formulação antiga
      expect(modalContent).not.toContain('As operações de faturamento mensal deste ciclo foram apuradas.');
      expect(modalContent).not.toContain('Emitir o PDF da fatura unificada com todas as operações apuradas.');
    });

    it('C.5. ModalReceitaOperacional.tsx deve conter o título dinâmico das origens base', () => {
      const modalContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'),
        'utf-8'
      );

      expect(modalContent).toContain('Detalhes das Operações');
      expect(modalContent).toContain('Detalhes dos Serviços Extras');
      expect(modalContent).toContain('Detalhes dos Lançamentos');
      expect(modalContent).not.toContain('Detalhes das Operações Base');
    });
  });
});
