import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE UX-2B.15 — Conciliação Guiada & Drawer 1 de Confirmação', () => {
  const blockPath = path.resolve(__dirname, '../pages/Financeiro/components/ConciliacaoReceitasBlock.tsx');
  const drawerPath = path.resolve(__dirname, '../pages/Financeiro/components/ConciliacaoReceitaDrawer.tsx');
  const detalhesDrawerPath = path.resolve(__dirname, '../pages/Financeiro/components/ReceitaDetalhesDrawer.tsx');

  let blockContent = '';
  let drawerContent = '';
  let detalhesContent = '';

  beforeEach(() => {
    vi.clearAllMocks();
    blockContent = fs.readFileSync(blockPath, 'utf-8');
    drawerContent = fs.readFileSync(drawerPath, 'utf-8');
    detalhesContent = fs.readFileSync(detalhesDrawerPath, 'utf-8');
  });

  describe('1. Identificação de Componentes e Regras de Negócio Preservadas', () => {
    it('ConciliacaoReceitasBlock importa e renderiza ConciliacaoReceitaDrawer', () => {
      expect(blockContent).toContain('import { ConciliacaoReceitaDrawer } from "./ConciliacaoReceitaDrawer";');
      expect(blockContent).toContain('<ConciliacaoReceitaDrawer');
    });

    it('Reutiliza a mutation existente chamando ReceitasService.conciliar(id) sem duplicar regra de negócio', () => {
      expect(blockContent).toContain('await ReceitasService.conciliar(id)');
      expect(blockContent).toContain('onConfirmConciliacao={(id) => actionMutation.mutate({ id })}');
    });

    it('Mantém o controle de perfil com canConciliar (admin / financeiro)', () => {
      expect(blockContent).toContain('const canConciliar = role === "admin" || role === "financeiro";');
      expect(blockContent).toContain('canConciliar={canConciliar}');
      expect(drawerContent).toContain('canConciliar: boolean');
    });
  });

  describe('2. Linha Clicável e Botão não Executa Diretamente', () => {
    it('A linha inteira da tabela é clicável e abre o drawer de conciliação', () => {
      expect(blockContent).toContain('onClick={() => handleOpenDrawer(item)}');
      expect(blockContent).toContain('cursor-pointer hover:bg-muted/50');
    });

    it('O botão na linha abre o drawer e não executa a conciliação imediatamente', () => {
      expect(blockContent).toContain('onClick={(e) => {');
      expect(blockContent).toContain('e.stopPropagation();');
      expect(blockContent).toContain('handleOpenDrawer(item);');
      expect(blockContent).not.toContain('onClick={() => actionMutation.mutate(');
    });

    it('Preserva o destaque contextual de registro em FOCO', () => {
      expect(blockContent).toContain('isHighlighted ? "bg-amber-50/80 border-l-4 border-l-amber-500 shadow-sm" : ""');
      expect(blockContent).toContain('Foco');
    });
  });

  describe('3. Drawer 1 — Conferência da Conciliação (Padrão Visual Compacto)', () => {
    it('Reutiliza a largura canônica padronizada RECEITA_DRAWER_WIDTH_CLASS (480px)', () => {
      expect(drawerContent).toContain('RECEITA_DRAWER_WIDTH_CLASS');
      expect(drawerContent).toContain('cn(\n                        RECEITA_DRAWER_WIDTH_CLASS');
    });

    it('Apresenta título claro "Conciliação da Receita" e contexto "Auditoria de Faturamento"', () => {
      expect(drawerContent).toContain('Conciliação da Receita');
      expect(drawerContent).toContain('Auditoria de Faturamento');
      expect(drawerContent).toContain('CONCILIAÇÃO BANCÁRIA');
    });

    it('Apresenta status bar compacta (min-h-[48px]) com badge contextual', () => {
      expect(drawerContent).toContain('min-h-[48px]');
      expect(drawerContent).toContain('Recebido / Aguardando conciliação');
      expect(drawerContent).toContain('Pendente de conciliação bancária');
      expect(drawerContent).toContain('AGUARDANDO CONCILIAÇÃO');
    });

    it('Inclui orientação curta explícita de conferência no extrato bancário', () => {
      expect(drawerContent).toContain('Confira o crédito no extrato bancário antes de concluir a conciliação.');
      expect(drawerContent).toContain('Confirme somente após verificar que este recebimento consta no extrato bancário real.');
    });

    it('Exibe todos os Dados Essenciais necessários para a decisão financeira', () => {
      expect(drawerContent).toContain('Dados Essenciais da Receita');
      expect(drawerContent).toContain('Cliente / Empresa');
      expect(drawerContent).toContain('Valor Total');
      expect(drawerContent).toContain('Modalidade');
      expect(drawerContent).toContain('Competência');
      expect(drawerContent).toContain('Data do Recebimento');
      expect(drawerContent).toContain('Origem Operacional');
      expect(drawerContent).toContain('Referência do Lançamento');
    });
  });

  describe('4. Pipeline Compacto no Drawer 1 e Detalhes no Drawer 2', () => {
    it('Pipeline compacto no Drawer 1 exibe Receita ✓ → Recebimento ✓ → Conciliação ●', () => {
      expect(drawerContent).toContain('Contexto do Pipeline');
      expect(drawerContent).toContain('<span>Receita</span>');
      expect(drawerContent).toContain('<span>Recebimento</span>');
      expect(drawerContent).toContain('<span>Conciliação</span>');
    });

    it('Drawer 1 não renderiza timeline vertical extensa com responsáveis', () => {
      expect(drawerContent).not.toContain('● Você está aqui');
    });

    it('Reutiliza ReceitaDetalhesDrawer para o segundo nível sem criar terceira arquitetura', () => {
      expect(drawerContent).toContain('<ReceitaDetalhesDrawer');
      expect(drawerContent).toContain('isOpen={isDetalhesOpen}');
      expect(drawerContent).toContain('onClose={() => setIsDetalhesOpen(false)}');
      expect(drawerContent).toContain('initialTab="detalhes"');
    });
  });

  describe('5. Ação Definitiva e Invalidação de Cache', () => {
    it('Botão definitivo Confirmar Conciliação no rodapé do drawer executa a conciliação', () => {
      expect(drawerContent).toContain('onClick={() => onConfirmConciliacao(receita.id)}');
      expect(drawerContent).toContain('Confirmar Conciliação');
    });

    it('Após sucesso, fecha o drawer e invalida todas as queries financeiras', () => {
      expect(blockContent).toContain('setIsDrawerOpen(false);');
      expect(blockContent).toContain('setSelectedReceita(null);');
      expect(blockContent).toContain('["receitas_para_conciliacao"]');
      expect(blockContent).toContain('["receitas-pipeline"]');
      expect(blockContent).toContain('["receita-historico"]');
      expect(blockContent).toContain('["receita-detalhes"]');
    });
  });
});
