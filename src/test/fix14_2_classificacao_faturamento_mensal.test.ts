import { describe, it, expect, beforeEach } from 'vitest';

// ==============================================================================
// SUÍTE FIX 14.2 — BLINDAGEM DA CLASSIFICAÇÃO FATURAMENTO MENSAL E CHECK CONSTRAINT
// ==============================================================================

interface FormaPagamentoOperacional {
  id: string;
  nome: string;
  modalidade: string;
}

interface OperacaoProducao {
  id: string;
  tenant_id: string;
  empresa_id: string;
  unidade_id?: string | null;
  data_operacao: string;
  data_vencimento?: string | null;
  valor_total: number;
  status: string;
  forma_pagamento_id: string;
}

interface ReceitaOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
  competencia: string;
  vencimento: string;
  valor_total: number;
  status: string;
}

interface ReceitaOperacionalItem {
  id: string;
  receita_id: string;
  tenant_id: string;
  operacao_id: string;
  valor_item: number;
}

// Validador da CHECK Constraint de Formas de Pagamento
function validarCheckConstraintFormasPagamento(modalidade: string): boolean {
  const valoresPermitidos = ['CAIXA_IMEDIATO', 'DUPLICATA', 'AMBOS', 'FATURAMENTO_MENSAL'];
  return valoresPermitidos.includes(modalidade);
}

// Simulador Transacional do Trigger Blindado (FIX 14.2)
class MotorTriggerBlindadoSimulator {
  receitas: ReceitaOperacional[] = [];
  itens: ReceitaOperacionalItem[] = [];
  formasPagamento: Map<string, FormaPagamentoOperacional> = new Map();

  cadastrarForma(forma: FormaPagamentoOperacional) {
    if (!validarCheckConstraintFormasPagamento(forma.modalidade)) {
      throw new Error(`ERROR 23514: violates check constraint formas_pagamento_operacional_modalidade_check`);
    }
    this.formasPagamento.set(forma.id, forma);
  }

  // Lógica exata da resolução de modalidade do Trigger SQL FIX 14.2
  resolverModalidade(formaPgtoId: string): string {
    const forma = this.formasPagamento.get(formaPgtoId);
    let v_forma_pgto_nome = '';
    let v_forma_pgto_modalidade = '';
    let v_modalidade = 'DUPLICATA';

    if (forma) {
      v_forma_pgto_nome = forma.nome.trim().toUpperCase();
      v_forma_pgto_modalidade = (forma.modalidade || '').trim().toUpperCase();

      // REGRA DE PRIORIDADE BLINDADA (FIX 14.2):
      // 1. FATURAMENTO MENSAL: Identificação inequívoca por nome OU por modalidade cadastrada
      if (
        v_forma_pgto_nome.includes('FATURAMENTO') ||
        v_forma_pgto_nome.includes('MENSAL') ||
        v_forma_pgto_modalidade === 'FATURAMENTO_MENSAL'
      ) {
        v_modalidade = 'FATURAMENTO_MENSAL';
      }
      // 2. CAIXA IMEDIATO: Identificação inequívoca por nome OU por modalidade cadastrada
      else if (
        v_forma_pgto_nome.includes('DINHEIRO') ||
        v_forma_pgto_nome.includes('PIX') ||
        v_forma_pgto_nome.includes('CART') ||
        v_forma_pgto_nome.includes('DEBITO') ||
        v_forma_pgto_nome.includes('DÉBITO') ||
        v_forma_pgto_modalidade === 'CAIXA_IMEDIATO'
      ) {
        v_modalidade = 'CAIXA_IMEDIATO';
      }
      // 3. Modalidade explícita do cadastro
      else if (v_forma_pgto_modalidade && v_forma_pgto_modalidade !== 'AMBOS') {
        v_modalidade = v_forma_pgto_modalidade;
      }
      // 4. Fallback: DUPLICATA
      else {
        v_modalidade = 'DUPLICATA';
      }
    }

    return v_modalidade;
  }

  calcularUltimoDiaCompetencia(dataOpStr: string): string {
    const [year, month] = dataOpStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  processarTrigger(op: OperacaoProducao): { receita_id: string; modalidade: string; status: string } {
    const v_modalidade = this.resolverModalidade(op.forma_pagamento_id);
    const competencia = op.data_operacao.slice(0, 7);

    // FLUXO A: FATURAMENTO_MENSAL (Consolidação)
    if (v_modalidade === 'FATURAMENTO_MENSAL') {
      const vencimento = this.calcularUltimoDiaCompetencia(op.data_operacao);

      const receitaAberta = this.receitas.find(
        (r) =>
          r.tenant_id === op.tenant_id &&
          r.empresa_id === op.empresa_id &&
          r.competencia === competencia &&
          r.modalidade === 'FATURAMENTO_MENSAL' &&
          r.status === 'aguardando_fechamento'
      );

      if (receitaAberta) {
        this.itens.push({
          id: `item-${Date.now()}-${Math.random()}`,
          receita_id: receitaAberta.id,
          tenant_id: op.tenant_id,
          operacao_id: op.id,
          valor_item: op.valor_total,
        });

        const soma = this.itens
          .filter((i) => i.receita_id === receitaAberta.id)
          .reduce((acc, curr) => acc + curr.valor_item, 0);
        receitaAberta.valor_total = soma;

        return { receita_id: receitaAberta.id, modalidade: 'FATURAMENTO_MENSAL', status: 'ITEM_CONSOLIDADO' };
      }

      const novaReceitaId = `rec-mensal-${op.empresa_id}-${competencia}`;
      this.receitas.push({
        id: novaReceitaId,
        tenant_id: op.tenant_id,
        empresa_id: op.empresa_id,
        modalidade: 'FATURAMENTO_MENSAL',
        competencia,
        vencimento,
        valor_total: op.valor_total,
        status: 'aguardando_fechamento',
      });

      this.itens.push({
        id: `item-${Date.now()}-${Math.random()}`,
        receita_id: novaReceitaId,
        tenant_id: op.tenant_id,
        operacao_id: op.id,
        valor_item: op.valor_total,
      });

      return { receita_id: novaReceitaId, modalidade: 'FATURAMENTO_MENSAL', status: 'RECEITA_CRIADA' };
    }

    // FLUXO B: DUPLICATA OU CAIXA_IMEDIATO (Individual)
    const novaReceitaId = `rec-indiv-${op.id}`;
    const statusInicial = v_modalidade === 'CAIXA_IMEDIATO' ? 'pendente_recebimento' : 'pendente_cobranca';
    const vencimento = op.data_vencimento || op.data_operacao;

    this.receitas.push({
      id: novaReceitaId,
      tenant_id: op.tenant_id,
      empresa_id: op.empresa_id,
      modalidade: v_modalidade as any,
      competencia,
      vencimento,
      valor_total: op.valor_total,
      status: statusInicial,
    });

    this.itens.push({
      id: `item-${Date.now()}-${Math.random()}`,
      receita_id: novaReceitaId,
      tenant_id: op.tenant_id,
      operacao_id: op.id,
      valor_item: op.valor_total,
    });

    return { receita_id: novaReceitaId, modalidade: v_modalidade, status: 'RECEITA_INDIVIDUAL_CRIADA' };
  }
}

describe('FIX 14.2 — Suíte de Testes da Classificação Blindada de Faturamento Mensal', () => {
  let motor: MotorTriggerBlindadoSimulator;

  beforeEach(() => {
    motor = new MotorTriggerBlindadoSimulator();
  });

  describe('1. Validação da CHECK Constraint formas_pagamento_operacional_modalidade_check', () => {
    it('1.1. CHECK aceita FATURAMENTO_MENSAL com sucesso', () => {
      expect(validarCheckConstraintFormasPagamento('FATURAMENTO_MENSAL')).toBe(true);
      expect(() => {
        motor.cadastrarForma({ id: 'f-1', nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' });
      }).not.toThrow();
    });

    it('1.2. CHECK continua aceitando todos os valores anteriores (CAIXA_IMEDIATO, DUPLICATA, AMBOS)', () => {
      expect(validarCheckConstraintFormasPagamento('CAIXA_IMEDIATO')).toBe(true);
      expect(validarCheckConstraintFormasPagamento('DUPLICATA')).toBe(true);
      expect(validarCheckConstraintFormasPagamento('AMBOS')).toBe(true);

      expect(() => {
        motor.cadastrarForma({ id: 'f-caixa', nome: 'Pix', modalidade: 'CAIXA_IMEDIATO' });
        motor.cadastrarForma({ id: 'f-dup', nome: 'Boleto', modalidade: 'DUPLICATA' });
        motor.cadastrarForma({ id: 'f-ambos', nome: 'Outro Meio', modalidade: 'AMBOS' });
      }).not.toThrow();
    });

    it('1.3. CHECK rejeita estritamente valores inválidos', () => {
      expect(validarCheckConstraintFormasPagamento('VALOR_INVALIDO')).toBe(false);
      expect(validarCheckConstraintFormasPagamento('CREDITO_FANTASIA')).toBe(false);

      expect(() => {
        motor.cadastrarForma({ id: 'f-err', nome: 'Inválido', modalidade: 'VALOR_INVALIDO' });
      }).toThrow(/violates check constraint/);
    });
  });

  describe('2. Resolução e Blindagem da Trigger Autônoma', () => {
    beforeEach(() => {
      motor.cadastrarForma({ id: 'forma-fat-correta', nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' });
      motor.cadastrarForma({ id: 'forma-fat-legada', nome: 'Faturamento Mensal', modalidade: 'DUPLICATA' }); // Simula cadastro legado divergente
      motor.cadastrarForma({ id: 'forma-boleto', nome: 'Boleto Bancário', modalidade: 'DUPLICATA' });
      motor.cadastrarForma({ id: 'forma-pix', nome: 'Pix', modalidade: 'CAIXA_IMEDIATO' });
      motor.cadastrarForma({ id: 'forma-dinheiro', nome: 'Dinheiro', modalidade: 'CAIXA_IMEDIATO' });
    });

    it('2.1. Faturamento Mensal com cadastro correto resolve FATURAMENTO_MENSAL', () => {
      const mod = motor.resolverModalidade('forma-fat-correta');
      expect(mod).toBe('FATURAMENTO_MENSAL');

      const op: OperacaoProducao = {
        id: 'op-01',
        tenant_id: 'tenant-esc',
        empresa_id: 'emp-benevides',
        data_operacao: '2026-09-13',
        valor_total: 63,
        status: 'AGUARDANDO_FATURAMENTO',
        forma_pagamento_id: 'forma-fat-correta',
      };

      const res = motor.processarTrigger(op);
      expect(res.modalidade).toBe('FATURAMENTO_MENSAL');
      expect(res.status).toBe('RECEITA_CRIADA');
      expect(motor.receitas[0].modalidade).toBe('FATURAMENTO_MENSAL');
      expect(motor.receitas[0].status).toBe('aguardando_fechamento');
      expect(motor.receitas[0].vencimento).toBe('2026-09-30');
    });

    it('2.2. Blindagem: Cadastro legado divergente (modalidade="DUPLICATA") é sobreposto pelo nome semântico', () => {
      const mod = motor.resolverModalidade('forma-fat-legada');
      expect(mod).toBe('FATURAMENTO_MENSAL');

      const op: OperacaoProducao = {
        id: 'op-02',
        tenant_id: 'tenant-esc',
        empresa_id: 'emp-benevides',
        data_operacao: '2026-09-13',
        valor_total: 63,
        status: 'AGUARDANDO_FATURAMENTO',
        forma_pagamento_id: 'forma-fat-legada',
      };

      const res = motor.processarTrigger(op);
      expect(res.modalidade).toBe('FATURAMENTO_MENSAL');
      expect(motor.receitas[0].modalidade).toBe('FATURAMENTO_MENSAL');
    });

    it('2.3. Duplicata comum (Boleto) continua gerando Receita DUPLICATA individual', () => {
      const mod = motor.resolverModalidade('forma-boleto');
      expect(mod).toBe('DUPLICATA');

      const op: OperacaoProducao = {
        id: 'op-dup',
        tenant_id: 'tenant-esc',
        empresa_id: 'emp-benevides',
        data_operacao: '2026-09-13',
        data_vencimento: '2026-09-20',
        valor_total: 100,
        status: 'AGUARDANDO_FATURAMENTO',
        forma_pagamento_id: 'forma-boleto',
      };

      const res = motor.processarTrigger(op);
      expect(res.modalidade).toBe('DUPLICATA');
      expect(res.status).toBe('RECEITA_INDIVIDUAL_CRIADA');
      expect(motor.receitas[0].modalidade).toBe('DUPLICATA');
      expect(motor.receitas[0].status).toBe('pendente_cobranca');
    });

    it('2.4. Caixa Imediato (Pix / Dinheiro) continua gerando Receita CAIXA_IMEDIATO', () => {
      const mod = motor.resolverModalidade('forma-pix');
      expect(mod).toBe('CAIXA_IMEDIATO');

      const op: OperacaoProducao = {
        id: 'op-pix',
        tenant_id: 'tenant-esc',
        empresa_id: 'emp-benevides',
        data_operacao: '2026-09-13',
        valor_total: 50,
        status: 'AGUARDANDO_FATURAMENTO',
        forma_pagamento_id: 'forma-pix',
      };

      const res = motor.processarTrigger(op);
      expect(res.modalidade).toBe('CAIXA_IMEDIATO');
      expect(motor.receitas[0].modalidade).toBe('CAIXA_IMEDIATO');
      expect(motor.receitas[0].status).toBe('pendente_recebimento');
    });

    it('2.5. Duas operações de Faturamento Mensal do mesmo cliente consolidam na mesma Receita', () => {
      const op1: OperacaoProducao = {
        id: 'op-ben-1',
        tenant_id: 'tenant-esc',
        empresa_id: 'emp-benevides',
        data_operacao: '2026-09-10',
        valor_total: 63,
        status: 'AGUARDANDO_FATURAMENTO',
        forma_pagamento_id: 'forma-fat-correta',
      };
      const op2: OperacaoProducao = {
        id: 'op-ben-2',
        tenant_id: 'tenant-esc',
        empresa_id: 'emp-benevides',
        data_operacao: '2026-09-13',
        valor_total: 80,
        status: 'AGUARDANDO_FATURAMENTO',
        forma_pagamento_id: 'forma-fat-legada',
      };

      const r1 = motor.processarTrigger(op1);
      const r2 = motor.processarTrigger(op2);

      expect(r1.status).toBe('RECEITA_CRIADA');
      expect(r2.status).toBe('ITEM_CONSOLIDADO');
      expect(r2.receita_id).toBe(r1.receita_id);
      expect(motor.receitas).toHaveLength(1);
      expect(motor.receitas[0].valor_total).toBe(143);
      expect(motor.itens).toHaveLength(2);
    });

    it('2.6. Vencimento mensal calcula estritamente o último dia civil da competência', () => {
      expect(motor.calcularUltimoDiaCompetencia('2026-09-13')).toBe('2026-09-30');
      expect(motor.calcularUltimoDiaCompetencia('2026-10-05')).toBe('2026-10-31');
      expect(motor.calcularUltimoDiaCompetencia('2027-02-10')).toBe('2027-02-28');
      expect(motor.calcularUltimoDiaCompetencia('2028-02-14')).toBe('2028-02-29');
    });
  });
});
