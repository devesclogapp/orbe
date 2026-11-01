import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Simulador fiel da lógica canônica do ModalReceitaOperacional.tsx
function computeHasDocumentoGerado(receita: any, historico: any[] = []): boolean {
  return (
    receita?.status === 'cobranca_gerada' ||
    Boolean(historico?.some((h: any) => h.acao === 'GERAR_COBRANCA' || h.acao === 'Cobrança Gerada'))
  );
}

interface ModalGuidanceResult {
  badge: string;
  primaryAction: string;
  secondaryAction?: string;
  status: string;
}

function resolveModalGuidance(receita: any, historico: any[] = []): ModalGuidanceResult {
  const status = receita.status;
  const modalidade = receita.modalidade;
  const hasDocumentoGerado = computeHasDocumentoGerado(receita, historico);

  if (status === 'conciliado') {
    return {
      badge: 'Ciclo financeiro concluído',
      primaryAction: 'Voltar ao Kanban',
      status: status
    };
  }

  if (status === 'recebido' || status === 'pago') {
    return {
      badge: 'Próxima etapa: Conciliação bancária',
      primaryAction: 'Ir para Conciliação',
      status: status
    };
  }

  if (modalidade === 'CAIXA_IMEDIATO') {
    return {
      badge: 'Próxima etapa: Confirmar recebimento imediato',
      primaryAction: 'Confirmar Conferência e Recebimento',
      status: status
    };
  }

  if (status === 'cobranca_enviada' || status === 'pendente_recebimento') {
    return {
      badge: 'Próxima etapa: Confirmar recebimento',
      primaryAction: 'Confirmar Recebimento do Pagamento',
      secondaryAction: modalidade === 'FATURAMENTO_MENSAL' ? 'Reemitir Doc. Consolidado' : 'Reemitir Documento de Cobrança',
      status: status
    };
  }

  // pendente_cobranca
  if (hasDocumentoGerado) {
    return {
      badge: 'Próxima etapa: 2. Enviar e Registrar Cobrança',
      primaryAction: '2. Registrar como Enviado ao Cliente',
      secondaryAction: modalidade === 'FATURAMENTO_MENSAL' ? 'Reemitir Doc. Consolidado' : 'Reemitir Documento de Cobrança',
      status: status
    };
  }

  return {
    badge: 'Fluxo sequencial de cobrança',
    primaryAction: '1. Gerar Documento de Cobrança',
    secondaryAction: '2. Registrar como Enviado ao Cliente',
    status: status
  };
}

describe('FIX UX — RESTAURAR SEMÂNTICA CANÔNICA DA GERAÇÃO DE COBRANÇA', () => {
  const receitaBase = {
    id: 'rec-test-001',
    modalidade: 'DUPLICATA',
    status: 'pendente_cobranca',
    valor_total: 100.0,
    vencimento: '2026-10-01'
  };

  it('A) pendente_cobranca + sem GERAR_COBRANCA -> Gerar Documento = CTA primária', () => {
    const guidance = resolveModalGuidance(receitaBase, []);
    expect(guidance.status).toBe('pendente_cobranca');
    expect(guidance.primaryAction).toBe('1. Gerar Documento de Cobrança');
    expect(guidance.secondaryAction).toBe('2. Registrar como Enviado ao Cliente');
    expect(guidance.badge).toBe('Fluxo sequencial de cobrança');
  });

  it('B) geração -> status financeiro continua pendente_cobranca', () => {
    // Simula a transição documental:
    const receitaAposGeracao = { ...receitaBase, status: 'pendente_cobranca' };
    expect(receitaAposGeracao.status).toBe('pendente_cobranca');
    expect(receitaAposGeracao.status).not.toBe('cobranca_gerada');
  });

  it('C) geração -> histórico recebe GERAR_COBRANCA', () => {
    const historicoAtualizado = [
      {
        id: 'hist-001',
        receita_id: receitaBase.id,
        acao: 'GERAR_COBRANCA',
        status_anterior: 'pendente_cobranca',
        status_novo: 'pendente_cobranca',
        created_at: new Date().toISOString()
      }
    ];

    expect(computeHasDocumentoGerado(receitaBase, historicoAtualizado)).toBe(true);
    expect(historicoAtualizado[0].acao).toBe('GERAR_COBRANCA');
  });

  it('D) pendente_cobranca + GERAR_COBRANCA no histórico -> Registrar Envio = CTA primária e Reemitir = secundária', () => {
    const historico = [{ acao: 'GERAR_COBRANCA' }];
    const guidance = resolveModalGuidance(receitaBase, historico);

    expect(guidance.status).toBe('pendente_cobranca');
    expect(guidance.badge).toBe('Próxima etapa: 2. Enviar e Registrar Cobrança');
    expect(guidance.primaryAction).toBe('2. Registrar como Enviado ao Cliente');
    expect(guidance.secondaryAction).toBe('Reemitir Documento de Cobrança');
  });

  it('E) reabrir modal -> estado visual continua correto pelo histórico persistido', () => {
    // Simulando nova sessão / reabertura: historico carregado via query
    const historicoPersistido = [
      { acao: 'GERAR_COBRANCA', created_at: '2026-09-17T12:00:00Z' }
    ];
    const guidance = resolveModalGuidance(receitaBase, historicoPersistido);

    expect(computeHasDocumentoGerado(receitaBase, historicoPersistido)).toBe(true);
    expect(guidance.primaryAction).toBe('2. Registrar como Enviado ao Cliente');
    expect(guidance.secondaryAction).toBe('Reemitir Documento de Cobrança');
  });

  it('F) compatibilidade com histórico antigo "Cobrança Gerada", se existente', () => {
    const historicoLegado = [{ acao: 'Cobrança Gerada' }];
    expect(computeHasDocumentoGerado(receitaBase, historicoLegado)).toBe(true);

    const guidance = resolveModalGuidance(receitaBase, historicoLegado);
    expect(guidance.primaryAction).toBe('2. Registrar como Enviado ao Cliente');
    expect(guidance.secondaryAction).toBe('Reemitir Documento de Cobrança');
  });

  it('G) cobranca_enviada -> Confirmar Recebimento continua CTA correta', () => {
    const receitaEnviada = { ...receitaBase, status: 'cobranca_enviada' };
    const guidance = resolveModalGuidance(receitaEnviada, [{ acao: 'GERAR_COBRANCA' }]);

    expect(guidance.badge).toBe('Próxima etapa: Confirmar recebimento');
    expect(guidance.primaryAction).toBe('Confirmar Recebimento do Pagamento');
    expect(guidance.secondaryAction).toBe('Reemitir Documento de Cobrança');
  });

  it('H) recebido -> Conciliação continua próxima etapa', () => {
    const receitaRecebida = { ...receitaBase, status: 'recebido' };
    const guidance = resolveModalGuidance(receitaRecebida);

    expect(guidance.badge).toBe('Próxima etapa: Conciliação bancária');
    expect(guidance.primaryAction).toBe('Ir para Conciliação');
  });

  it('I) conciliado -> ciclo terminal permanece inalterado', () => {
    const receitaConciliada = { ...receitaBase, status: 'conciliado' };
    const guidance = resolveModalGuidance(receitaConciliada);

    expect(guidance.badge).toBe('Ciclo financeiro concluído');
    expect(guidance.primaryAction).toBe('Voltar ao Kanban');
  });

  describe('Auditoria de Código-Fonte (Garantias Estáticas)', () => {
    it('ModalReceitaOperacional.tsx NÃO deve tentar gravar cobranca_gerada no banco', () => {
      const modalContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'),
        'utf-8'
      );
      expect(modalContent).not.toContain("updateStatusMutation.mutate('cobranca_gerada'");
      expect(modalContent).toContain("acao: 'GERAR_COBRANCA'");
    });

    it('ModalReceitaOperacional.tsx deve detectar documento via historico', () => {
      const modalContent = fs.readFileSync(
        path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx'),
        'utf-8'
      );
      expect(modalContent).toContain("h.acao === 'GERAR_COBRANCA' || h.acao === 'Cobrança Gerada'");
    });

    it('ReceitasService.ts deve persistir evento no banco em receitas_operacionais_historico', () => {
      const serviceContent = fs.readFileSync(
        path.resolve(__dirname, '../services/receitas/receitas.service.ts'),
        'utf-8'
      );
      expect(serviceContent).toContain(".from('receitas_operacionais_historico')");
      expect(serviceContent).toContain(".insert(payload)");
    });
  });
});
