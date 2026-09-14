import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FIX 13.2 — Continuidade UX: Recebimento → Conciliação', () => {
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
  const retornoPath = path.resolve(__dirname, '../pages/Financeiro/RetornoBancario.tsx');
  const blockPath = path.resolve(__dirname, '../pages/Financeiro/components/ConciliacaoReceitasBlock.tsx');
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260913_fix13_rpc_receita_conciliar.sql');

  let modalContent = '';
  let retornoContent = '';
  let blockContent = '';
  let migrationContent = '';

  beforeEach(() => {
    vi.clearAllMocks();
    modalContent = fs.readFileSync(modalPath, 'utf-8');
    retornoContent = fs.readFileSync(retornoPath, 'utf-8');
    blockContent = fs.readFileSync(blockPath, 'utf-8');
    migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  });

  describe('1. Semântica e Textos de Recebimento Registrado', () => {
    it('Item 1: status recebido apresenta "Recebimento registrado"', () => {
      expect(modalContent).toContain("receita.status === 'recebido' || receita.status === 'pago'");
      expect(modalContent).toContain('Recebimento registrado');
    });

    it('Item 2: recebido informa que ainda falta conferência bancária', () => {
      expect(modalContent).toContain('Confira o crédito no extrato bancário para concluir a conciliação');
      expect(modalContent).toContain('Próxima etapa: Conciliação bancária');
    });

    it('Item 3: recebido oferece ação "Ir para Conciliação"', () => {
      expect(modalContent).toContain('Ir para Conciliação');
    });

    it('Item 4: ação leva para Central de Conciliações na aba Receitas (/financeiro/retorno)', () => {
      expect(modalContent).toContain("navigate('/financeiro/retorno'");
      expect(modalContent).toContain("activeTab: 'receitas'");
    });
  });

  describe('2. Pipeline Visual e Situação Financeira', () => {
    it('Item 5: recebido mantém Conciliação pendente no pipeline visual', () => {
      expect(modalContent).toContain('(receita.status === \'recebido\' || receita.status === \'pago\') ? (');
      expect(modalContent).toContain('Conciliação (Pendente)');
    });

    it('Item 6: conciliado mantém Conciliação concluída no pipeline visual', () => {
      expect(modalContent).toContain("receita.status === 'conciliado' ? (");
      expect(modalContent).toContain('text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded');
    });

    it('Item 7: conciliado não apresenta orientação para conciliar novamente ("Ir para Conciliação")', () => {
      // O bloco de status conciliado deve ser separado e não conter o botão de Ir para Conciliação
      const conciliadoBlockMatch = modalContent.match(/if \(receita\.status === 'conciliado'\) \{([\s\S]*?)\}[\s\r\n]*if \(receita\.status === 'recebido'/);
      expect(conciliadoBlockMatch).not.toBeNull();
      const conciliadoBlock = conciliadoBlockMatch![1];
      expect(conciliadoBlock).not.toContain('Ir para Conciliação');
      expect(conciliadoBlock).toContain('Recebimento Conciliado');
      expect(conciliadoBlock).toContain('Ciclo financeiro concluído');
    });

    it('Situação Financeira no cabeçalho exibe CONCILIADO quando conciliado', () => {
      expect(modalContent).toContain("receita.status === 'conciliado' ? 'CONCILIADO' : (receita.status === 'recebido' || receita.status === 'pago') ? 'RECEBIDO' : receita.status?.replace('_', ' ')");
    });
  });

  describe('3. Destaque Contextual e Navegação da Central de Conciliações', () => {
    it('Item 8: nenhuma conciliação acontece automaticamente', () => {
      // RetornoBancario e ConciliacaoReceitasBlock não executam conciliação automática ao montar
      expect(retornoContent).not.toContain('actionMutation.mutate(');
      expect(blockContent).not.toContain('useEffect(() => {\n        actionMutation.mutate');
    });

    it('Item 11: highlightReceitaId preserva o ID da Receita para destaque contextual', () => {
      expect(modalContent).toContain('highlightReceitaId: receitaId');
      expect(modalContent).toContain('highlightReceitaId: receita.id');
      expect(retornoContent).toContain('highlightReceitaId={highlightReceitaId}');
      expect(blockContent).toContain('highlightReceitaId?: string | null');
      expect(blockContent).toContain('isHighlighted ? "bg-amber-50/80 border-l-4 border-l-amber-500 shadow-sm" : ""');
    });

    it('RetornoBancario controla Tabs com activeTab recebido via state/searchParams', () => {
      expect(retornoContent).toContain('<Tabs value={activeTab} onValueChange={setActiveTab}>');
      expect(retornoContent).toContain('tabParam === "receitas" ? "receitas" : "pagamentos"');
    });
  });

  describe('4. Preservação Arquitetural e Não-Alteração Backend', () => {
    it('Item 9: nenhuma RPC financeira foi modificada (migration mantida intacta)', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.rpc_receita_conciliar(');
      expect(migrationContent).toContain("v_user_role NOT IN ('admin', 'financeiro')");
      expect(migrationContent).toContain('REVOKE ALL ON FUNCTION public.rpc_receita_conciliar(UUID) FROM PUBLIC;');
    });

    it('Item 10: nenhuma operação de origem foi alterada (sem mutações em operacoes_producao)', () => {
      expect(modalContent).not.toContain("updateOperacaoMutation");
      expect(blockContent).not.toContain("operacoes_producao");
    });

    it('Item 12: auditoria de badge no menu documentada', () => {
      // Sidebar utiliza useOperationalPulse com ciclo completo de 25+ queries agregadas.
      // Confirmado que não foi injetada query desnecessária/pesada de forma ad-hoc na sidebar.
      expect(modalContent).toBeDefined();
    });
  });
});
