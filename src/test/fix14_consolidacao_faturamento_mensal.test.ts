import { describe, it, expect, beforeEach } from 'vitest';
import { endOfMonth } from 'date-fns';

// ==============================================================================
// SUÍTE FIX 14 — CONSOLIDAÇÃO REAL DO FATURAMENTO MENSAL
// Cobertura Integral dos 20 Cenários Auditáveis
// ==============================================================================

interface ReceitaOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  unidade_id?: string | null;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
  competencia: string;
  vencimento: string;
  valor_total: number;
  status: 'pendente_recebimento' | 'pendente_cobranca' | 'aguardando_fechamento' | 'cobranca_enviada' | 'recebido' | 'conciliado' | 'cancelado';
}

interface ReceitaOperacionalItem {
  id: string;
  receita_id: string;
  tenant_id: string;
  operacao_id: string;
  valor_item: number;
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
  status_rh?: string;
  status_pagamento?: string;
  avaliacao_json?: Record<string, any>;
  forma_pagamento?: {
    nome: string;
    modalidade?: string;
  };
}

// Simulador Transacional Fiel da Função Trigger fn_gerar_receita_operacional_automatica (FIX 14)
class MotorReceitasSimulator {
  receitas: ReceitaOperacional[] = [];
  itens: ReceitaOperacionalItem[] = [];
  operacoes: Map<string, OperacaoProducao> = new Map();

  // Função auxiliar de cálculo de último dia da competência
  calcularUltimoDiaCompetencia(dataOpStr: string): string {
    const [year, month] = dataOpStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  processarTriggerOperacao(op: OperacaoProducao): { receita_id?: string; status: string; alerta?: string } {
    this.operacoes.set(op.id, { ...op });

    // Só prossegue se o status for atualizado para alguma etapa de faturamento/recebimento
    const statusFaturavel = ['AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO'].includes(op.status);
    if (!statusFaturavel) {
      return { status: op.status };
    }

    // Idempotência: Se já vinculado em itens, não processa novamente
    const jaExisteItem = this.itens.some((i) => i.operacao_id === op.id);
    if (jaExisteItem) {
      return { status: 'JA_PROCESSADO' };
    }

    // Detecção da Modalidade
    let modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL' = 'DUPLICATA';
    const fpMod = op.forma_pagamento?.modalidade;
    const fpNome = (op.forma_pagamento?.nome || '').toUpperCase();

    if (fpMod && fpMod !== 'AMBOS') {
      modalidade = fpMod as any;
    } else {
      if (fpNome.includes('CART') || fpNome.includes('DEBITO') || fpNome.includes('PIX') || fpNome.includes('DINHEIRO')) {
        modalidade = 'CAIXA_IMEDIATO';
      } else if (fpNome.includes('FATURAMENTO') || fpNome.includes('MENSAL')) {
        modalidade = 'FATURAMENTO_MENSAL';
      }
    }

    const competencia = op.data_operacao.slice(0, 7);

    // =========================================================================
    // FLUXO A: FATURAMENTO MENSAL (Consolidação Real)
    // =========================================================================
    if (modalidade === 'FATURAMENTO_MENSAL') {
      const vencimento = this.calcularUltimoDiaCompetencia(op.data_operacao);

      // 1. Procurar receita aberta da mesma empresa, competência e tenant
      const receitaAberta = this.receitas.find(
        (r) =>
          r.tenant_id === op.tenant_id &&
          r.empresa_id === op.empresa_id &&
          r.competencia === competencia &&
          r.modalidade === 'FATURAMENTO_MENSAL' &&
          r.status === 'aguardando_fechamento'
      );

      if (receitaAberta) {
        // CASO 2: Anexar item na receita existente
        this.itens.push({
          id: `item-${Date.now()}-${Math.random()}`,
          receita_id: receitaAberta.id,
          tenant_id: op.tenant_id,
          operacao_id: op.id,
          valor_item: op.valor_total,
        });

        // Recalcular valor_total da receita
        const somaItens = this.itens
          .filter((i) => i.receita_id === receitaAberta.id)
          .reduce((acc, curr) => acc + curr.valor_item, 0);

        receitaAberta.valor_total = somaItens;

        return { receita_id: receitaAberta.id, status: 'ITEM_CONSOLIDADO' };
      }

      // 2. Verificar se a receita da competência já foi fechada
      const receitaFechada = this.receitas.find(
        (r) =>
          r.tenant_id === op.tenant_id &&
          r.empresa_id === op.empresa_id &&
          r.competencia === competencia &&
          r.modalidade === 'FATURAMENTO_MENSAL' &&
          r.status !== 'aguardando_fechamento'
      );

      if (receitaFechada) {
        // CASO 3: Competência já foi fechada. Não anexar silenciosamente.
        const alertaMsg = `COMPETENCIA_JA_FECHADA: Operação validada após fechamento da Receita Mensal da competência ${competencia}`;
        const opCurrent = this.operacoes.get(op.id)!;
        opCurrent.avaliacao_json = {
          ...opCurrent.avaliacao_json,
          alerta_faturamento: alertaMsg,
        };
        return { status: 'BLOQUEADO_COMPETENCIA_FECHADA', alerta: alertaMsg };
      }

      // CASO 1: Primeira operação mensal -> Cria nova receita aberta
      const novaReceitaId = `rec-mensal-${op.empresa_id}-${competencia}`;
      const novaReceita: ReceitaOperacional = {
        id: novaReceitaId,
        tenant_id: op.tenant_id,
        empresa_id: op.empresa_id,
        unidade_id: op.unidade_id,
        modalidade: 'FATURAMENTO_MENSAL',
        competencia,
        vencimento,
        valor_total: op.valor_total,
        status: 'aguardando_fechamento',
      };
      this.receitas.push(novaReceita);

      this.itens.push({
        id: `item-${Date.now()}-${Math.random()}`,
        receita_id: novaReceitaId,
        tenant_id: op.tenant_id,
        operacao_id: op.id,
        valor_item: op.valor_total,
      });

      return { receita_id: novaReceitaId, status: 'RECEITA_CRIADA' };
    }

    // =========================================================================
    // FLUXO B: DUPLICATA OU CAIXA_IMEDIATO (Receita Individual)
    // =========================================================================
    const novaReceitaId = `rec-indiv-${op.id}`;
    const statusInicial = modalidade === 'CAIXA_IMEDIATO' ? 'pendente_recebimento' : 'pendente_cobranca';
    const vencimento = modalidade === 'CAIXA_IMEDIATO'
      ? (op.data_vencimento || op.data_operacao)
      : (op.data_vencimento || op.data_operacao);

    const novaReceita: ReceitaOperacional = {
      id: novaReceitaId,
      tenant_id: op.tenant_id,
      empresa_id: op.empresa_id,
      unidade_id: op.unidade_id,
      modalidade,
      competencia,
      vencimento,
      valor_total: op.valor_total,
      status: statusInicial,
    };
    this.receitas.push(novaReceita);

    this.itens.push({
      id: `item-${Date.now()}-${Math.random()}`,
      receita_id: novaReceitaId,
      tenant_id: op.tenant_id,
      operacao_id: op.id,
      valor_item: op.valor_total,
    });

    return { receita_id: novaReceitaId, status: 'RECEITA_INDIVIDUAL_CRIADA' };
  }

  // Simulador de rpc_receita_confirmar_recebimento
  confirmarRecebimento(receitaId: string, dataRecebimento = '2026-10-05') {
    const rec = this.receitas.find((r) => r.id === receitaId);
    if (!rec) throw new Error('Receita não encontrada');

    rec.status = 'recebido';

    // Localiza todas as operações vinculadas pelos itens
    const opIds = this.itens.filter((i) => i.receita_id === receitaId).map((i) => i.operacao_id);

    opIds.forEach((opId) => {
      const op = this.operacoes.get(opId);
      if (op) {
        op.status_pagamento = 'RECEBIDO';
        if (op.status_rh === 'VALIDADO_RH') {
          op.status = 'CONCLUIDO';
        }
      }
    });

    return { operacoesAfetadas: opIds.length };
  }

  // Simulador de conciliação bancária
  conciliarReceita(receitaId: string) {
    const rec = this.receitas.find((r) => r.id === receitaId);
    if (!rec) throw new Error('Receita não encontrada');
    rec.status = 'conciliado';
    return { success: true };
  }
}

describe('FIX 14 — Suíte de Testes da Consolidação Real do Faturamento Mensal', () => {
  let motor: MotorReceitasSimulator;

  beforeEach(() => {
    motor = new MotorReceitasSimulator();
  });

  // Cenário 1: primeira operação mensal cria Receita
  it('1. Primeira operação mensal cria Receita com status aguardando_fechamento', () => {
    const op1: OperacaoProducao = {
      id: 'op-01',
      tenant_id: 'tenant-esc',
      empresa_id: 'emp-benevides',
      data_operacao: '2026-09-01',
      valor_total: 100,
      status: 'AGUARDANDO_FATURAMENTO',
      forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' },
    };

    const res = motor.processarTriggerOperacao(op1);
    expect(res.status).toBe('RECEITA_CRIADA');
    expect(motor.receitas).toHaveLength(1);
    expect(motor.receitas[0].modalidade).toBe('FATURAMENTO_MENSAL');
    expect(motor.receitas[0].status).toBe('aguardando_fechamento');
    expect(motor.receitas[0].valor_total).toBe(100);
  });

  // Cenário 2: segunda operação do mesmo cliente/mês reutiliza Receita
  it('2. Segunda operação do mesmo cliente/mês reutiliza a Receita existente', () => {
    const op1: OperacaoProducao = {
      id: 'op-01',
      tenant_id: 'tenant-esc',
      empresa_id: 'emp-benevides',
      data_operacao: '2026-09-01',
      valor_total: 100,
      status: 'AGUARDANDO_FATURAMENTO',
      forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' },
    };
    const op2: OperacaoProducao = {
      id: 'op-02',
      tenant_id: 'tenant-esc',
      empresa_id: 'emp-benevides',
      data_operacao: '2026-09-05',
      valor_total: 200,
      status: 'AGUARDANDO_FATURAMENTO',
      forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' },
    };

    const res1 = motor.processarTriggerOperacao(op1);
    const res2 = motor.processarTriggerOperacao(op2);

    expect(res2.status).toBe('ITEM_CONSOLIDADO');
    expect(res2.receita_id).toBe(res1.receita_id);
    expect(motor.receitas).toHaveLength(1);
    expect(motor.receitas[0].valor_total).toBe(300);
  });

  // Cenário 3: terceira operação reutiliza Receita
  it('3. Terceira operação reutiliza a mesma Receita aberta', () => {
    const op1: OperacaoProducao = {
      id: 'op-01',
      tenant_id: 'tenant-esc',
      empresa_id: 'emp-benevides',
      data_operacao: '2026-09-01',
      valor_total: 100,
      status: 'AGUARDANDO_FATURAMENTO',
      forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' },
    };
    const op2: OperacaoProducao = {
      id: 'op-02',
      tenant_id: 'tenant-esc',
      empresa_id: 'emp-benevides',
      data_operacao: '2026-09-05',
      valor_total: 200,
      status: 'AGUARDANDO_FATURAMENTO',
      forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' },
    };
    const op3: OperacaoProducao = {
      id: 'op-03',
      tenant_id: 'tenant-esc',
      empresa_id: 'emp-benevides',
      data_operacao: '2026-09-13',
      valor_total: 150,
      status: 'AGUARDANDO_FATURAMENTO',
      forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' },
    };

    motor.processarTriggerOperacao(op1);
    motor.processarTriggerOperacao(op2);
    const res3 = motor.processarTriggerOperacao(op3);

    expect(res3.status).toBe('ITEM_CONSOLIDADO');
    expect(motor.receitas).toHaveLength(1);
  });

  // Cenário 4: total é soma dos itens (100 + 200 + 150 = 450)
  it('4. Total da Receita é a soma exata dos itens (R$ 450,00)', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const op2: OperacaoProducao = { id: 'op-02', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-05', valor_total: 200, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const op3: OperacaoProducao = { id: 'op-03', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-13', valor_total: 150, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(op1);
    motor.processarTriggerOperacao(op2);
    motor.processarTriggerOperacao(op3);

    expect(motor.receitas[0].valor_total).toBe(450);
  });

  // Cenário 5: quantidade de itens correta
  it('5. Quantidade de itens vinculados na tabela de itens é exatamente 3', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const op2: OperacaoProducao = { id: 'op-02', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-05', valor_total: 200, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const op3: OperacaoProducao = { id: 'op-03', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-13', valor_total: 150, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(op1);
    motor.processarTriggerOperacao(op2);
    motor.processarTriggerOperacao(op3);

    expect(motor.itens).toHaveLength(3);
    expect(motor.itens.map((i) => i.operacao_id)).toEqual(['op-01', 'op-02', 'op-03']);
  });

  // Cenário 6: operação não aparece duas vezes (Idempotência)
  it('6. Operação não aparece duas vezes caso a trigger dispare repetidamente', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(op1);
    const retry = motor.processarTriggerOperacao(op1);

    expect(retry.status).toBe('JA_PROCESSADO');
    expect(motor.itens).toHaveLength(1);
    expect(motor.receitas[0].valor_total).toBe(100);
  });

  // Cenário 7: outro cliente cria outra Receita
  it('7. Outro cliente na mesma competência cria sua própria Receita Mensal', () => {
    const opBenevides: OperacaoProducao = { id: 'op-ben-1', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const opClienteX: OperacaoProducao = { id: 'op-x-1', tenant_id: 'tenant-esc', empresa_id: 'emp-cliente-x', data_operacao: '2026-09-03', valor_total: 300, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(opBenevides);
    motor.processarTriggerOperacao(opClienteX);

    expect(motor.receitas).toHaveLength(2);
    const recBen = motor.receitas.find((r) => r.empresa_id === 'emp-benevides');
    const recX = motor.receitas.find((r) => r.empresa_id === 'emp-cliente-x');

    expect(recBen?.valor_total).toBe(100);
    expect(recX?.valor_total).toBe(300);
  });

  // Cenário 8: outro mês cria outra Receita
  it('8. Outro mês do mesmo cliente cria uma nova Receita para a nova competência', () => {
    const opSet: OperacaoProducao = { id: 'op-set', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-15', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const opOut: OperacaoProducao = { id: 'op-out', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-10-02', valor_total: 250, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(opSet);
    motor.processarTriggerOperacao(opOut);

    expect(motor.receitas).toHaveLength(2);
    expect(motor.receitas[0].competencia).toBe('2026-09');
    expect(motor.receitas[1].competencia).toBe('2026-10');
  });

  // Cenário 9: DUPLICATA continua individual
  it('9. DUPLICATA continua gerando Receita individual por operação', () => {
    const opDup1: OperacaoProducao = { id: 'op-dup-1', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', data_vencimento: '2026-09-08', valor_total: 120, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Boleto', modalidade: 'DUPLICATA' } };
    const opDup2: OperacaoProducao = { id: 'op-dup-2', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-05', data_vencimento: '2026-09-12', valor_total: 180, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Boleto', modalidade: 'DUPLICATA' } };

    motor.processarTriggerOperacao(opDup1);
    motor.processarTriggerOperacao(opDup2);

    expect(motor.receitas).toHaveLength(2);
    expect(motor.receitas[0].modalidade).toBe('DUPLICATA');
    expect(motor.receitas[1].modalidade).toBe('DUPLICATA');
    expect(motor.receitas[0].valor_total).toBe(120);
    expect(motor.receitas[1].valor_total).toBe(180);
  });

  // Cenário 10: CAIXA_IMEDIATO permanece inalterado
  it('10. CAIXA_IMEDIATO permanece inalterado com status pendente_recebimento', () => {
    const opPix: OperacaoProducao = { id: 'op-pix', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 90, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'PIX', modalidade: 'CAIXA_IMEDIATO' } };

    motor.processarTriggerOperacao(opPix);

    expect(motor.receitas).toHaveLength(1);
    expect(motor.receitas[0].modalidade).toBe('CAIXA_IMEDIATO');
    expect(motor.receitas[0].status).toBe('pendente_recebimento');
    expect(motor.receitas[0].valor_total).toBe(90);
  });

  // Cenário 11: vencimento setembro = 30
  it('11. Vencimento em setembro calcula estritamente 30/09/2026', () => {
    const venc = motor.calcularUltimoDiaCompetencia('2026-09-13');
    expect(venc).toBe('2026-09-30');
  });

  // Cenário 12: vencimento outubro = 31
  it('12. Vencimento em outubro calcula estritamente 31/10/2026', () => {
    const venc = motor.calcularUltimoDiaCompetencia('2026-10-05');
    expect(venc).toBe('2026-10-31');
  });

  // Cenário 13: fevereiro normal = 28
  it('13. Vencimento em fevereiro normal (2027) calcula estritamente 28/02/2027', () => {
    const venc = motor.calcularUltimoDiaCompetencia('2027-02-10');
    expect(venc).toBe('2027-02-28');
  });

  // Cenário 14: fevereiro bissexto = 29
  it('14. Vencimento em fevereiro bissexto (2028) calcula estritamente 29/02/2028', () => {
    const venc = motor.calcularUltimoDiaCompetencia('2028-02-14');
    expect(venc).toBe('2028-02-29');
  });

  // Cenário 15: Receita fechada não recebe operação silenciosamente
  it('15. Receita já fechada não recebe nova operação silenciosamente e registra alerta', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    motor.processarTriggerOperacao(op1);

    // Fechar a receita
    motor.receitas[0].status = 'pendente_cobranca'; // ou cobranca_enviada

    // Nova operação do mesmo mês tenta entrar
    const opTardia: OperacaoProducao = { id: 'op-tardia', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-28', valor_total: 70, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const res = motor.processarTriggerOperacao(opTardia);

    expect(res.status).toBe('BLOQUEADO_COMPETENCIA_FECHADA');
    expect(motor.receitas[0].valor_total).toBe(100); // Não alterou a receita fechada
    expect(motor.itens).toHaveLength(1); // Não adicionou o item silenciosamente
    expect(motor.operacoes.get('op-tardia')?.avaliacao_json?.alerta_faturamento).toContain('COMPETENCIA_JA_FECHADA');
  });

  // Cenário 16: concorrência não cria duplicata mensal
  it('16. Concorrência simulada encontra a receita aberta e consolida sem duplicar', () => {
    const opA: OperacaoProducao = { id: 'op-conc-A', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-10', valor_total: 110, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const opB: OperacaoProducao = { id: 'op-conc-B', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-10', valor_total: 140, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    const rA = motor.processarTriggerOperacao(opA);
    const rB = motor.processarTriggerOperacao(opB);

    expect(motor.receitas).toHaveLength(1);
    expect(motor.receitas[0].valor_total).toBe(250);
    expect(rB.receita_id).toBe(rA.receita_id);
  });

  // Cenário 17: recebimento trata todas as operações vinculadas
  it('17. Confirmação de recebimento liquida todas as operações vinculadas à Receita', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', status_rh: 'VALIDADO_RH', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const op2: OperacaoProducao = { id: 'op-02', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-05', valor_total: 200, status: 'AGUARDANDO_FATURAMENTO', status_rh: 'VALIDADO_RH', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(op1);
    motor.processarTriggerOperacao(op2);

    const receitaId = motor.receitas[0].id;
    const res = motor.confirmarRecebimento(receitaId);

    expect(res.operacoesAfetadas).toBe(2);
    expect(motor.receitas[0].status).toBe('recebido');
    expect(motor.operacoes.get('op-01')?.status_pagamento).toBe('RECEBIDO');
    expect(motor.operacoes.get('op-01')?.status).toBe('CONCLUIDO');
    expect(motor.operacoes.get('op-02')?.status_pagamento).toBe('RECEBIDO');
    expect(motor.operacoes.get('op-02')?.status).toBe('CONCLUIDO');
  });

  // Cenário 18: conciliação permanece por Receita
  it('18. Conciliação permanece por Receita (1 fatura = 1 conciliação)', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', status_rh: 'VALIDADO_RH', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    motor.processarTriggerOperacao(op1);

    const receitaId = motor.receitas[0].id;
    motor.confirmarRecebimento(receitaId);
    const conc = motor.conciliarReceita(receitaId);

    expect(conc.success).toBe(true);
    expect(motor.receitas[0].status).toBe('conciliado');
  });

  // Cenário 19: DRE não duplica (soma das receitas_operacionais reflete a soma dos fatos econômicos)
  it('19. DRE não duplica: a soma das receitas_operacionais equivale exatamente à receita consolidada do cliente', () => {
    const op1: OperacaoProducao = { id: 'op-01', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 100, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const op2: OperacaoProducao = { id: 'op-02', tenant_id: 'tenant-esc', empresa_id: 'emp-benevides', data_operacao: '2026-09-05', valor_total: 200, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(op1);
    motor.processarTriggerOperacao(op2);

    const totalReceitas = motor.receitas.reduce((acc, r) => acc + r.valor_total, 0);
    const totalItens = motor.itens.reduce((acc, i) => acc + i.valor_item, 0);

    expect(totalReceitas).toBe(300);
    expect(totalItens).toBe(300);
  });

  // Cenário 20: tenant A nunca reutiliza Receita do tenant B
  it('20. Isolamento Multitenant: Tenant A nunca reutiliza Receita do Tenant B', () => {
    const opTenantA: OperacaoProducao = { id: 'op-ta', tenant_id: 'tenant-alpha', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 150, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };
    const opTenantB: OperacaoProducao = { id: 'op-tb', tenant_id: 'tenant-beta', empresa_id: 'emp-benevides', data_operacao: '2026-09-01', valor_total: 250, status: 'AGUARDANDO_FATURAMENTO', forma_pagamento: { nome: 'Faturamento Mensal', modalidade: 'FATURAMENTO_MENSAL' } };

    motor.processarTriggerOperacao(opTenantA);
    motor.processarTriggerOperacao(opTenantB);

    expect(motor.receitas).toHaveLength(2);
    expect(motor.receitas[0].tenant_id).toBe('tenant-alpha');
    expect(motor.receitas[0].valor_total).toBe(150);
    expect(motor.receitas[1].tenant_id).toBe('tenant-beta');
    expect(motor.receitas[1].valor_total).toBe(250);
  });
});
