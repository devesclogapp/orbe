import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ReceitasService } from '../services/receitas/receitas.service';
import { supabase } from '../lib/supabase';

// Mock do supabase client
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe('FIX 13.1 — Conciliação de Receitas com RPC, Auditoria e Controle de Acesso', () => {
  const blockPath = path.resolve(__dirname, '../pages/Financeiro/components/ConciliacaoReceitasBlock.tsx');
  const servicePath = path.resolve(__dirname, '../services/receitas/receitas.service.ts');
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260913_fix13_rpc_receita_conciliar.sql');
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');

  let blockContent = '';
  let serviceContent = '';
  let migrationContent = '';
  let modalContent = '';

  beforeEach(() => {
    vi.clearAllMocks();
    blockContent = fs.readFileSync(blockPath, 'utf-8');
    serviceContent = fs.readFileSync(servicePath, 'utf-8');
    migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    modalContent = fs.readFileSync(modalPath, 'utf-8');
  });

  describe('1. Regras da RPC SQL (20260913_fix13_rpc_receita_conciliar.sql)', () => {
    it('deve definir a função rpc_receita_conciliar com SECURITY DEFINER', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION public.rpc_receita_conciliar(');
      expect(migrationContent).toContain('SECURITY DEFINER');
    });

    it('deve validar autenticação e isolamento de tenant', () => {
      expect(migrationContent).toContain('v_user_id := auth.uid();');
      expect(migrationContent).toContain('AUTH_REQUIRED');
      expect(migrationContent).toContain('TENANT_MISMATCH');
      expect(migrationContent).toContain('public.current_tenant_id()');
    });

    it('deve validar permissão de perfil (admin ou financeiro)', () => {
      expect(migrationContent).toContain("v_user_role NOT IN ('admin', 'financeiro')");
      expect(migrationContent).toContain('ROLE_NOT_AUTHORIZED');
    });

    it('deve permitir apenas o status anterior "recebido"', () => {
      expect(migrationContent).toContain("v_receita.status <> 'recebido'");
      expect(migrationContent).toContain('STATUS_INVALIDO');
    });

    it('deve ser idempotente caso a receita já esteja "conciliado"', () => {
      expect(migrationContent).toContain("v_receita.status = 'conciliado'");
      expect(migrationContent).toContain("'idempotent', true");
    });

    it('deve registrar o evento CONCILIAR_RECEITA em receitas_operacionais_historico', () => {
      expect(migrationContent).toContain('INSERT INTO public.receitas_operacionais_historico');
      expect(migrationContent).toContain("'CONCILIAR_RECEITA'");
      expect(migrationContent).toContain("'recebido'");
      expect(migrationContent).toContain("'conciliado'");
      expect(migrationContent).toContain('v_user_id');
      expect(migrationContent).toContain('Receita conciliada após conferência manual do extrato bancário.');
    });

    it('NÃO deve alterar operacoes_producao, valores ou competência', () => {
      expect(migrationContent).not.toContain('UPDATE public.operacoes_producao');
      expect(migrationContent).not.toContain('valor_total =');
      expect(migrationContent).not.toContain('competencia =');
    });
  });

  describe('2. Camada de Serviço (ReceitasService)', () => {
    it('deve implementar o método ReceitasService.conciliar chamando rpc_receita_conciliar', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: { success: true, status: 'conciliado' },
        error: null,
      });
      (supabase.rpc as any) = mockRpc;

      const receitaId = '1caa3450-d445-4ab9-930c-9c4ef2ac8076';
      const result = await ReceitasService.conciliar(receitaId);

      expect(mockRpc).toHaveBeenCalledWith('rpc_receita_conciliar', {
        p_receita_id: receitaId,
      });
      expect(result).toEqual({ success: true, status: 'conciliado' });
    });

    it('updateStatus com "conciliado" deve rotear para rpc_receita_conciliar', () => {
      expect(serviceContent).toContain("case 'conciliado':");
      expect(serviceContent).toContain("rpcName = 'rpc_receita_conciliar';");
    });
  });

  describe('3. Componente Frontend (ConciliacaoReceitasBlock.tsx)', () => {
    it('NÃO deve mais utilizar ReceitasService.update direto no mutationFn', () => {
      expect(blockContent).not.toContain('ReceitasService.update(id, { status:');
    });

    it('deve chamar ReceitasService.conciliar(id)', () => {
      expect(blockContent).toContain('ReceitasService.conciliar(id)');
    });

    it('deve aplicar controle de perfil usando useTenant (admin / financeiro)', () => {
      expect(blockContent).toContain('const { role } = useTenant();');
      expect(blockContent).toContain('const canConciliar = role === "admin" || role === "financeiro";');
    });

    it('deve desabilitar ou ocultar o botão quebrado "Desfazer (Não Caiu)" com nota técnica de fix futuro', () => {
      expect(blockContent).toContain('FIX FUTURO — reversão de recebimento precisa sincronizar Receita, Operação e histórico.');
      expect(blockContent).not.toContain('Desfazer (Não Caiu)');
    });

    it('deve renomear o card para "Aguardando Conciliação"', () => {
      expect(blockContent).toContain('Aguardando Conciliação');
      expect(blockContent).not.toContain('Aguardando Baixa Definitiva');
    });

    it('deve exibir mensagem explícita de conferência manual no extrato bancário', () => {
      expect(blockContent).toContain('Receitas marcadas como recebidas aguardam conferência manual no extrato bancário.');
      expect(blockContent).toContain('Confirme somente após verificar que este recebimento consta no extrato bancário real.');
    });

    it('deve invalidar as queries corretas de cache após a conciliação', () => {
      expect(blockContent).toContain('["receitas_para_conciliacao"]');
      expect(blockContent).toContain('["receitas-pipeline"]');
      expect(blockContent).toContain('["receita-historico"]');
      expect(blockContent).toContain('["receita-detalhes"]');
    });
  });

  describe('4. Timeline e Pipeline Visual da Receita', () => {
    it('Timeline deve exibir "Conciliado" no status de transição quando status_novo for conciliado', () => {
      expect(modalContent).toContain("h.status_novo === 'conciliado' ? 'Conciliado'");
    });

    it('no pipeline visual: recebido mantém Conciliação pendente, conciliado marca Conciliação como concluída', () => {
      expect(modalContent).toContain("receita.status === 'conciliado' ? (");
      expect(modalContent).toContain("text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded");
      expect(modalContent).toContain("Conciliação (Pendente)");
    });
  });

  describe('5. Simulação da Lógica de Cálculo dos Totais', () => {
    it('transição de recebido para conciliado deve diminuir o saldo aguardando e aumentar o total conciliado sem duplicar valor', () => {
      const receitasMock = [
        { id: '1caa3450', status: 'recebido', valor_total: 159.30 },
        { id: 'efbc272f', status: 'recebido', valor_total: 610.20 },
        { id: 'b52bca1e', status: 'recebido', valor_total: 210.00 },
        { id: '96f9cc50', status: 'recebido', valor_total: 936.00 },
      ];

      const calcularTotais = (items: typeof receitasMock) => {
        return items.reduce(
          (acc, item) => {
            const val = Number(item.valor_total || 0);
            if (item.status === 'conciliado') acc.conciliado += val;
            else if (item.status === 'recebido') acc.recebido += val;
            return acc;
          },
          { recebido: 0, conciliado: 0 }
        );
      };

      // Antes da conciliação da receita de R$ 159,30:
      const antes = calcularTotais(receitasMock);
      expect(antes.recebido).toBeCloseTo(1915.50, 2);
      expect(antes.conciliado).toBeCloseTo(0.00, 2);

      // Simulando a conciliação exclusivamente da receita 1caa3450:
      const receitasConciliadas = receitasMock.map(r => 
        r.id === '1caa3450' ? { ...r, status: 'conciliado' } : r
      );

      const depois = calcularTotais(receitasConciliadas);
      expect(depois.recebido).toBeCloseTo(1756.20, 2); // 1915.50 - 159.30
      expect(depois.conciliado).toBeCloseTo(159.30, 2);  // 0 + 159.30
      expect(depois.recebido + depois.conciliado).toBeCloseTo(1915.50, 2); // Sem duplicidade financeira!
    });
  });
});
