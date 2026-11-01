import { describe, it, expect, beforeEach } from 'vitest';

// ==============================================================================
// SUÍTE FIX 14.5 — FECHAMENTO ATÔMICO DA COMPETÊNCIA NO FATURAMENTO MENSAL
// ==============================================================================

interface ReceitaOperacional {
  id: string;
  tenant_id: string;
  empresa_id: string;
  modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL';
  competencia: string;
  vencimento: string;
  valor_total: number;
  status: string;
  updated_at?: string;
}

interface ReceitaOperacionalItem {
  id: string;
  receita_id: string;
  tenant_id: string;
  operacao_id: string;
  valor_item: number;
}

interface ReceitaHistorico {
  id: string;
  tenant_id: string;
  receita_id: string;
  acao: string;
  status_anterior: string;
  status_novo: string;
  usuario_id: string;
  detalhes: any;
  created_at: string;
}

interface OperacaoProducao {
  id: string;
  tenant_id: string;
  empresa_id: string;
  data_operacao: string;
  valor_total: number;
  status: string;
  avaliacao_json?: any;
}

// Simulador das regras do RPC rpc_receita_fechar_competencia_mensal
class FechamentoCompetenciaMensalSimulator {
  receitas: ReceitaOperacional[] = [];
  itens: ReceitaOperacionalItem[] = [];
  historicos: ReceitaHistorico[] = [];
  operacoes: OperacaoProducao[] = [];

  // Método simulando updateReceita com a trava de segurança Domain Hardening
  updateReceita(tenantId: string, receitaId: string, payload: any) {
    // Trava de segurança: delete payload.status preservado estritamente
    delete payload.valor_total;
    delete payload.status;
    delete payload.modalidade;
    delete payload.tenant_id;
    delete payload.empresa_id;

    const rec = this.receitas.find(r => r.id === receitaId && r.tenant_id === tenantId);
    if (!rec) throw new Error('REC_NOT_FOUND');

    if (payload.vencimento) rec.vencimento = payload.vencimento;
    rec.updated_at = new Date().toISOString();
    return { ...rec };
  }

  // Execução da RPC rpc_receita_fechar_competencia_mensal
  rpcFecharCompetenciaMensal(params: {
    receitaId: string;
    vencimento?: string | null;
    usuario: { id: string; tenant_id: string; role: string } | null;
  }) {
    const { receitaId, vencimento, usuario } = params;

    // 1. Validar autenticação
    if (!usuario || !usuario.id) {
      throw new Error('AUTH_REQUIRED: Operação restrita a usuários autenticados.');
    }

    // 2. Validar tenant obrigatório
    if (!usuario.tenant_id) {
      throw new Error('TENANT_REQUIRED: Não foi possível determinar o tenant do usuário autenticado.');
    }

    // 3. Validar role: estritamente admin ou financeiro
    const roleLower = (usuario.role || '').toLowerCase();
    if (!['admin', 'financeiro'].includes(roleLower)) {
      throw new Error(`ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem fechar competências. Perfil atual: ${usuario.role}`);
    }

    // 4. Localizar receita (FOR UPDATE)
    const rec = this.receitas.find(r => r.id === receitaId);
    if (!rec) {
      throw new Error(`REC_NOT_FOUND: Receita operacional ${receitaId} não encontrada.`);
    }

    // 5. Validar tenant mismatch
    if (rec.tenant_id !== usuario.tenant_id) {
      throw new Error('TENANT_MISMATCH: Acesso negado. A receita pertence a outro tenant.');
    }

    // 6. Validar modalidade estrita
    if (rec.modalidade !== 'FATURAMENTO_MENSAL') {
      throw new Error(`MODALIDADE_INVALIDA: Apenas receitas na modalidade FATURAMENTO_MENSAL podem ser fechadas nesta rotina. Modalidade atual: ${rec.modalidade}`);
    }

    // 7. Idempotência: se já fechada, não duplicar histórico nem efeitos
    if (['pendente_cobranca', 'cobranca_gerada', 'cobranca_enviada', 'recebido', 'conciliado'].includes(rec.status)) {
      return {
        success: true,
        idempotent: true,
        status: rec.status,
        vencimento: rec.vencimento,
        message: 'Competência já se encontra fechada previamente. (Idempotente)'
      };
    }

    // 8. Máquina de estados: apenas aguardando_fechamento
    if (rec.status !== 'aguardando_fechamento') {
      throw new Error(`STATUS_INVALIDO: Apenas receitas em status AGUARDANDO_FECHAMENTO podem ser fechadas. Status atual: ${rec.status}`);
    }

    // 9. Atualizar status e vencimento
    const statusAnterior = rec.status;
    rec.status = 'pendente_cobranca';
    if (vencimento) {
      rec.vencimento = vencimento;
    }
    rec.updated_at = new Date().toISOString();

    // 10. Gravar histórico atômico
    const hist: ReceitaHistorico = {
      id: `hist-${Date.now()}-${Math.random()}`,
      tenant_id: rec.tenant_id,
      receita_id: rec.id,
      acao: 'FECHAR_COMPETENCIA',
      status_anterior: statusAnterior,
      status_novo: 'pendente_cobranca',
      usuario_id: usuario.id,
      detalhes: {
        texto: 'Competência mensal consolidada e fechada com sucesso. Pronta para cobrança.',
        vencimento: rec.vencimento,
        competencia: rec.competencia,
        origem: 'Financeiro / Faturamento Mensal'
      },
      created_at: new Date().toISOString()
    };
    this.historicos.push(hist);

    return {
      success: true,
      idempotent: false,
      status: 'pendente_cobranca',
      vencimento: rec.vencimento,
      message: 'Competência consolidada e fechada com sucesso.'
    };
  }

  // Simulador do trigger FIX 14 após o fechamento
  processarNovaOperacao(op: OperacaoProducao) {
    const comp = op.data_operacao.slice(0, 7);

    // 1. Procurar receita aberta
    const receitaAberta = this.receitas.find(r =>
      r.tenant_id === op.tenant_id &&
      r.empresa_id === op.empresa_id &&
      r.competencia === comp &&
      r.modalidade === 'FATURAMENTO_MENSAL' &&
      r.status === 'aguardando_fechamento'
    );

    if (receitaAberta) {
      // Anexa na aberta
      this.itens.push({
        id: `item-${Date.now()}`,
        receita_id: receitaAberta.id,
        tenant_id: op.tenant_id,
        operacao_id: op.id,
        valor_item: op.valor_total
      });
      receitaAberta.valor_total += op.valor_total;
      return { status: 'ANEXADA', receita_id: receitaAberta.id };
    }

    // 2. Verificar se existe receita fechada nesta competência
    const receitaFechada = this.receitas.find(r =>
      r.tenant_id === op.tenant_id &&
      r.empresa_id === op.empresa_id &&
      r.competencia === comp &&
      r.modalidade === 'FATURAMENTO_MENSAL' &&
      r.status !== 'aguardando_fechamento'
    );

    if (receitaFechada) {
      // Regra FIX 14: COMPETENCIA_JA_FECHADA
      op.avaliacao_json = {
        alerta_faturamento: `COMPETENCIA_JA_FECHADA: Operação validada após fechamento da Receita Mensal da competência ${comp}`
      };
      return { status: 'BLOQUEADA_COMPETENCIA_FECHADA', alerta: op.avaliacao_json.alerta_faturamento };
    }

    // 3. Caso não exista nenhuma, cria nova aberta
    const novaRec: ReceitaOperacional = {
      id: `rec-${Date.now()}`,
      tenant_id: op.tenant_id,
      empresa_id: op.empresa_id,
      modalidade: 'FATURAMENTO_MENSAL',
      competencia: comp,
      vencimento: `${comp}-30`,
      valor_total: op.valor_total,
      status: 'aguardando_fechamento'
    };
    this.receitas.push(novaRec);
    this.itens.push({
      id: `item-${Date.now()}`,
      receita_id: novaRec.id,
      tenant_id: op.tenant_id,
      operacao_id: op.id,
      valor_item: op.valor_total
    });
    return { status: 'CRIADA_NOVA', receita_id: novaRec.id };
  }
}

describe('FIX 14.5 — Fechamento Atômico da Competência Mensal', () => {
  let sim: FechamentoCompetenciaMensalSimulator;
  const tenantId = 'tenant-esc-log-01';
  const empresaId = 'empresa-benevides-01';
  const adminUser = { id: 'usr-admin', tenant_id: tenantId, role: 'admin' };
  const financeiroUser = { id: 'usr-fin', tenant_id: tenantId, role: 'financeiro' };
  const encarregadoUser = { id: 'usr-enc', tenant_id: tenantId, role: 'encarregado' };

  beforeEach(() => {
    sim = new FechamentoCompetenciaMensalSimulator();

    // Estado inicial: Receita BENEVIDES / Setembro 2026 com 2 operações (R$ 415,62)
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';
    sim.receitas.push({
      id: recId,
      tenant_id: tenantId,
      empresa_id: empresaId,
      modalidade: 'FATURAMENTO_MENSAL',
      competencia: '2026-09',
      vencimento: '2026-09-30',
      valor_total: 415.62,
      status: 'aguardando_fechamento'
    });

    sim.itens.push({
      id: 'item-1',
      receita_id: recId,
      tenant_id: tenantId,
      operacao_id: 'op-1',
      valor_item: 124.02
    });

    sim.itens.push({
      id: 'item-2',
      receita_id: recId,
      tenant_id: tenantId,
      operacao_id: 'op-2',
      valor_item: 291.60
    });
  });

  it('1. Deve impedir que updateReceita() altere o status (Domain Hardening preservado)', () => {
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';
    
    // Tenta atualizar status diretamente via updateReceita
    const res = sim.updateReceita(tenantId, recId, {
      vencimento: '2026-09-30',
      status: 'pendente_cobranca'
    });

    // Vencimento é atualizado, mas status permanece aguardando_fechamento
    expect(res.vencimento).toBe('2026-09-30');
    expect(res.status).toBe('aguardando_fechamento');
    expect(sim.receitas[0].status).toBe('aguardando_fechamento');
  });

  it('2. Deve rejeitar fechamento por usuários não autenticados ou sem perfil Financeiro/Admin', () => {
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';

    // Sem autenticação
    expect(() => {
      sim.rpcFecharCompetenciaMensal({
        receitaId: recId,
        vencimento: '2026-09-30',
        usuario: null
      });
    }).toThrowError('AUTH_REQUIRED');

    // Encarregado operacional (sem permissão de fechamento financeiro)
    expect(() => {
      sim.rpcFecharCompetenciaMensal({
        receitaId: recId,
        vencimento: '2026-09-30',
        usuario: encarregadoUser
      });
    }).toThrowError('ROLE_NOT_AUTHORIZED');
  });

  it('3. Deve rejeitar fechamento se houver tentativa de violação de Tenant', () => {
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';
    const outroTenantUser = { id: 'usr-invasor', tenant_id: 'tenant-outro-99', role: 'admin' };

    expect(() => {
      sim.rpcFecharCompetenciaMensal({
        receitaId: recId,
        vencimento: '2026-09-30',
        usuario: outroTenantUser
      });
    }).toThrowError('TENANT_MISMATCH');
  });

  it('4. Deve rejeitar fechamento em receitas que não sejam FATURAMENTO_MENSAL', () => {
    const dupRecId = 'rec-duplicata-01';
    sim.receitas.push({
      id: dupRecId,
      tenant_id: tenantId,
      empresa_id: empresaId,
      modalidade: 'DUPLICATA',
      competencia: '2026-09',
      vencimento: '2026-09-20',
      valor_total: 500,
      status: 'aguardando_fechamento'
    });

    expect(() => {
      sim.rpcFecharCompetenciaMensal({
        receitaId: dupRecId,
        vencimento: '2026-09-30',
        usuario: financeiroUser
      });
    }).toThrowError('MODALIDADE_INVALIDA');
  });

  it('5. Deve executar fechamento com sucesso por operador financeiro e gravar histórico atômico', () => {
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';

    const res = sim.rpcFecharCompetenciaMensal({
      receitaId: recId,
      vencimento: '2026-09-30',
      usuario: financeiroUser
    });

    expect(res.success).toBe(true);
    expect(res.idempotent).toBe(false);
    expect(res.status).toBe('pendente_cobranca');
    expect(res.vencimento).toBe('2026-09-30');

    // Validação da receita após o fechamento
    const rec = sim.receitas.find(r => r.id === recId)!;
    expect(rec.status).toBe('pendente_cobranca');
    expect(rec.valor_total).toBe(415.62);
    expect(rec.competencia).toBe('2026-09');

    // Validação dos itens (devem permanecer intactos)
    const itens = sim.itens.filter(i => i.receita_id === recId);
    expect(itens.length).toBe(2);
    expect(itens.reduce((sum, i) => sum + i.valor_item, 0)).toBe(415.62);

    // Validação do histórico gravado atomicamente
    expect(sim.historicos.length).toBe(1);
    const hist = sim.historicos[0];
    expect(hist.receita_id).toBe(recId);
    expect(hist.acao).toBe('FECHAR_COMPETENCIA');
    expect(hist.status_anterior).toBe('aguardando_fechamento');
    expect(hist.status_novo).toBe('pendente_cobranca');
    expect(hist.usuario_id).toBe(financeiroUser.id);
    expect(hist.detalhes.origem).toBe('Financeiro / Faturamento Mensal');
    expect(hist.detalhes.vencimento).toBe('2026-09-30');
  });

  it('6. Deve ser rigorosamente idempotente em chamadas subsequentes', () => {
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';

    // 1ª execução
    sim.rpcFecharCompetenciaMensal({
      receitaId: recId,
      vencimento: '2026-09-30',
      usuario: adminUser
    });
    expect(sim.historicos.length).toBe(1);

    // 2ª execução (re-tentativa)
    const res2 = sim.rpcFecharCompetenciaMensal({
      receitaId: recId,
      vencimento: '2026-09-30',
      usuario: adminUser
    });

    expect(res2.success).toBe(true);
    expect(res2.idempotent).toBe(true);
    expect(res2.status).toBe('pendente_cobranca');
    expect(res2.message).toContain('Idempotente');

    // Não deve duplicar histórico nem alterar dados
    expect(sim.historicos.length).toBe(1);
    expect(sim.itens.length).toBe(2);
    expect(sim.receitas.length).toBe(1);
  });

  it('7. Após o fechamento, trigger deve bloquear anexação de 3ª operação e disparar COMPETENCIA_JA_FECHADA', () => {
    const recId = 'f105f927-f165-40e5-97af-c3fa9e0d0f04';

    // Fecha a competência de Setembro
    sim.rpcFecharCompetenciaMensal({
      receitaId: recId,
      vencimento: '2026-09-30',
      usuario: financeiroUser
    });

    // Uma 3ª operação de Setembro é processada tardiamente
    const op3: OperacaoProducao = {
      id: 'op-3-tardia',
      tenant_id: tenantId,
      empresa_id: empresaId,
      data_operacao: '2026-09-28',
      valor_total: 150.00,
      status: 'AGUARDANDO_FATURAMENTO'
    };

    const resOp3 = sim.processarNovaOperacao(op3);

    // Valida que a operação foi bloqueada e NÃO anexada à receita fechada
    expect(resOp3.status).toBe('BLOQUEADA_COMPETENCIA_FECHADA');
    expect(resOp3.alerta).toContain('COMPETENCIA_JA_FECHADA');

    // A receita fechada permanece congelada com 2 itens e R$ 415,62
    const itensRec = sim.itens.filter(i => i.receita_id === recId);
    expect(itensRec.length).toBe(2);
    expect(sim.receitas.find(r => r.id === recId)!.valor_total).toBe(415.62);
  });

  it('8. No Kanban de Receitas, a transição de status deve mover o card de "Em aberto" para "Cobrança gerada"', () => {
    // Definição das colunas de FATURAMENTO_MENSAL no Kanban
    const kanbanStages = [
      { id: "aguardando_fechamento", label: "Em aberto" },
      { id: "pendente_cobranca", label: "Cobrança gerada" },
      { id: "cobranca_enviada", label: "Cobrança enviada" },
      { id: "recebido", label: "Recebido" }
    ];

    const getColunaKanban = (status: string) => {
      const stage = kanbanStages.find(s => s.id === status);
      return stage ? stage.label : 'Em aberto';
    };

    const rec = sim.receitas[0];

    // Antes do fechamento
    expect(getColunaKanban(rec.status)).toBe('Em aberto');

    // Executa fechamento
    sim.rpcFecharCompetenciaMensal({
      receitaId: rec.id,
      vencimento: '2026-09-30',
      usuario: financeiroUser
    });

    // Após o fechamento
    expect(getColunaKanban(rec.status)).toBe('Cobrança gerada');
  });
});
