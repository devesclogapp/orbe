import { describe, it, expect } from 'vitest';

// ==============================================================================
// SUÍTE FIX 14.7B — UX GUIADA POR ESTADO DA RECEITA OPERACIONAL
// ==============================================================================

interface ModalStateConfig {
  proximaEtapaBadge: string;
  acaoPrincipal: string;
  acaoSecundaria?: string;
  orientacaoTexto?: string;
  passos?: string[];
}

// Simulador das regras de composição da UX guiada do ModalReceitaOperacional.tsx
function getModalGuidance(modalidade: 'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL', status: string): ModalStateConfig {
  if (status === 'conciliado') {
    return {
      proximaEtapaBadge: 'Ciclo financeiro concluído',
      acaoPrincipal: 'Voltar ao Kanban',
      orientacaoTexto: 'A conferência no extrato bancário foi confirmada e o ciclo financeiro está concluído.'
    };
  }

  if (status === 'recebido' || status === 'pago') {
    return {
      proximaEtapaBadge: 'Próxima etapa: Conciliação bancária',
      acaoPrincipal: 'Ir para Conciliação',
      orientacaoTexto: 'O pagamento foi informado como recebido no ORBE. Confira o crédito no extrato bancário para concluir a conciliação.'
    };
  }

  switch (modalidade) {
    case 'CAIXA_IMEDIATO':
      return {
        proximaEtapaBadge: 'Próxima etapa: Confirmar recebimento imediato',
        acaoPrincipal: 'Confirmar Conferência e Recebimento',
        orientacaoTexto: 'Operação com liquidação imediata. Confirme a conferência e o recebimento com os dados do comprovante (PIX, dinheiro ou cartão).'
      };

    case 'DUPLICATA':
      if (status === 'cobranca_enviada') {
        return {
          proximaEtapaBadge: 'Próxima etapa: Confirmar recebimento',
          acaoPrincipal: 'Confirmar Recebimento do Pagamento',
          acaoSecundaria: 'Reemitir Documento de Cobrança',
          orientacaoTexto: 'A duplicata/fatura foi enviada. Somente confirme o recebimento após o pagamento ter sido efetivamente identificado (comprovante ou liquidação bancária).'
        };
      }
      return {
        proximaEtapaBadge: 'Fluxo sequencial de cobrança',
        acaoPrincipal: '1. Gerar Documento de Cobrança',
        acaoSecundaria: '2. Registrar como Enviado ao Cliente',
        passos: [
          '1. Gerar documento de cobrança',
          '2. Enviar externamente ao cliente',
          '3. Registrar envio no ORBE'
        ]
      };

    case 'FATURAMENTO_MENSAL':
      if (status === 'aguardando_fechamento') {
        return {
          proximaEtapaBadge: 'Próxima etapa: Consolidar e fechar a competência',
          acaoPrincipal: '1. Consolidar Competência & Fechamento',
          acaoSecundaria: 'Pré-visualizar Documento Consolidado (Rascunho)',
          orientacaoTexto: 'As operações de faturamento mensal deste ciclo foram apuradas. Para dar início ao processo de cobrança, consolide a competência e defina o vencimento padrão.'
        };
      }
      if (status === 'cobranca_enviada') {
        return {
          proximaEtapaBadge: 'Próxima etapa: Confirmar recebimento',
          acaoPrincipal: 'Confirmar Recebimento do Pagamento',
          acaoSecundaria: 'Reemitir Doc. Consolidado',
          orientacaoTexto: 'A fatura consolidada foi enviada ao cliente. Somente confirme o recebimento após o pagamento ter sido efetivamente identificado (comprovante ou extrato preliminar).'
        };
      }
      // pendente_cobranca
      return {
        proximaEtapaBadge: 'Fluxo sequencial de cobrança',
        acaoPrincipal: '1. Gerar Documento de Cobrança',
        acaoSecundaria: '2. Registrar como Enviado ao Cliente',
        passos: [
          '1. Gerar documento de cobrança',
          '2. Enviar externamente ao cliente',
          '3. Registrar envio no ORBE'
        ]
      };
  }
}

describe('FIX 14.7B — UX Guiada por Estado da Receita Operacional', () => {
  describe('1. FATURAMENTO MENSAL', () => {
    it('aguardando_fechamento: deve orientar consolidação como próxima etapa obrigatória', () => {
      const guidance = getModalGuidance('FATURAMENTO_MENSAL', 'aguardando_fechamento');

      expect(guidance.proximaEtapaBadge).toBe('Próxima etapa: Consolidar e fechar a competência');
      expect(guidance.acaoPrincipal).toContain('1. Consolidar Competência & Fechamento');
      expect(guidance.acaoSecundaria).toContain('Pré-visualizar');
      expect(guidance.orientacaoTexto).toContain('consolide a competência');
    });

    it('pendente_cobranca: deve guiar o fluxo em 3 etapas com geração antes do registro de envio', () => {
      const guidance = getModalGuidance('FATURAMENTO_MENSAL', 'pendente_cobranca');

      expect(guidance.proximaEtapaBadge).toBe('Fluxo sequencial de cobrança');
      expect(guidance.passos).toHaveLength(3);
      expect(guidance.passos![0]).toBe('1. Gerar documento de cobrança');
      expect(guidance.passos![1]).toBe('2. Enviar externamente ao cliente');
      expect(guidance.passos![2]).toBe('3. Registrar envio no ORBE');

      // Ação principal deve ser Gerar Documento, antes de Registrar como Enviado
      expect(guidance.acaoPrincipal).toBe('1. Gerar Documento de Cobrança');
      expect(guidance.acaoSecundaria).toBe('2. Registrar como Enviado ao Cliente');
    });

    it('cobranca_enviada: deve orientar confirmação de recebimento somente após identificação', () => {
      const guidance = getModalGuidance('FATURAMENTO_MENSAL', 'cobranca_enviada');

      expect(guidance.proximaEtapaBadge).toBe('Próxima etapa: Confirmar recebimento');
      expect(guidance.acaoPrincipal).toBe('Confirmar Recebimento do Pagamento');
      expect(guidance.acaoSecundaria).toBe('Reemitir Doc. Consolidado');
      expect(guidance.orientacaoTexto).toContain('efetivamente identificado');
    });
  });

  describe('2. DUPLICATA', () => {
    it('pendente_cobranca: deve apresentar roteiro de emissão e registro de envio', () => {
      const guidance = getModalGuidance('DUPLICATA', 'pendente_cobranca');

      expect(guidance.proximaEtapaBadge).toBe('Fluxo sequencial de cobrança');
      expect(guidance.acaoPrincipal).toBe('1. Gerar Documento de Cobrança');
      expect(guidance.acaoSecundaria).toBe('2. Registrar como Enviado ao Cliente');
    });

    it('cobranca_enviada: deve orientar recebimento como ação principal e reemissão como secundária', () => {
      const guidance = getModalGuidance('DUPLICATA', 'cobranca_enviada');

      expect(guidance.proximaEtapaBadge).toBe('Próxima etapa: Confirmar recebimento');
      expect(guidance.acaoPrincipal).toBe('Confirmar Recebimento do Pagamento');
      expect(guidance.acaoSecundaria).toBe('Reemitir Documento de Cobrança');
    });
  });

  describe('3. CAIXA IMEDIATO', () => {
    it('pendente_recebimento: deve orientar conferência e recebimento imediato', () => {
      const guidance = getModalGuidance('CAIXA_IMEDIATO', 'pendente_recebimento');

      expect(guidance.proximaEtapaBadge).toBe('Próxima etapa: Confirmar recebimento imediato');
      expect(guidance.acaoPrincipal).toBe('Confirmar Conferência e Recebimento');
    });
  });

  describe('4. ESTADOS FINAIS UNIVERSAIS', () => {
    it('recebido: deve orientar conciliação bancária como próxima etapa', () => {
      const guidance = getModalGuidance('FATURAMENTO_MENSAL', 'recebido');

      expect(guidance.proximaEtapaBadge).toBe('Próxima etapa: Conciliação bancária');
      expect(guidance.acaoPrincipal).toBe('Ir para Conciliação');
      expect(guidance.orientacaoTexto).toContain('extrato bancário');
    });

    it('conciliado: ciclo concluído sem apresentar falsa próxima ação', () => {
      const guidance = getModalGuidance('FATURAMENTO_MENSAL', 'conciliado');

      expect(guidance.proximaEtapaBadge).toBe('Ciclo financeiro concluído');
      expect(guidance.orientacaoTexto).toContain('ciclo financeiro está concluído');
      // Não exibe botões de alteração de fluxo financeiro
      expect(guidance.acaoPrincipal).toBe('Voltar ao Kanban');
    });
  });
});
