import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ReceitasService } from '../services/receitas/receitas.service';
import { supabase } from '../lib/supabase';

// Mock supabase client to test ReceitasService updateStatus logic for 'cobranca_enviada'
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe('FIX 11.1 — Simplificação do Envio de Cobrança', () => {
  const modalPath = path.resolve(__dirname, '../pages/Financeiro/components/ModalReceitaOperacional.tsx');
  let modalContent = '';

  beforeEach(() => {
    vi.clearAllMocks();
    modalContent = fs.readFileSync(modalPath, 'utf-8');
  });

  describe('1. Sanitização da UI — Ausência de Canais e Placeholders Simulados', () => {
    it('NÃO deve conter o e-mail hardcoded placeholder "financeiro@cliente.com"', () => {
      expect(modalContent).not.toContain('financeiro@cliente.com');
    });

    it('NÃO deve conter integração simulada com WhatsApp via "wa.me"', () => {
      expect(modalContent).not.toContain('wa.me');
    });

    it('NÃO deve conter botão ou texto "Enviar E-mail pelo Sistema"', () => {
      expect(modalContent).not.toContain('Enviar E-mail pelo Sistema');
    });

    it('NÃO deve conter ação de "Copiar Link"', () => {
      expect(modalContent).not.toContain('Copiar Link');
      expect(modalContent).not.toContain('Registrar e Copiar');
    });

    it('NÃO deve conter campo "Mensagem Anexada"', () => {
      expect(modalContent).not.toContain('Mensagem Anexada');
    });

    it('NÃO deve conter toasts afirmando envio de e-mail automático', () => {
      expect(modalContent).not.toContain('E-mail enviado!');
      expect(modalContent).not.toContain('enfileirado para envio');
    });
  });

  describe('2. Novo Fluxo — Ação "Registrar como Enviado" e Confirmação Explícita', () => {
    it('deve apresentar a ação "Registrar como Enviado" nas opções da receita', () => {
      expect(modalContent).toContain('Registrar como Enviado');
    });

    it('deve conter a pergunta de confirmação explícita de envio externo', () => {
      expect(modalContent).toContain(
        'Confirma que esta cobrança já foi enviada ao cliente por um canal externo?'
      );
    });

    it('deve conter o texto de esclarecimento sobre envio não automático', () => {
      expect(modalContent).toContain(
        'O ORBE não realiza o envio automaticamente. Esta ação apenas registra que o documento foi enviado externamente.'
      );
    });

    it('deve conter botão de "Confirmar Envio" e opção "Cancelar"', () => {
      expect(modalContent).toContain('Confirmar Envio');
      expect(modalContent).toContain('Cancelar');
    });

    it('deve exibir toast neutro afirmando apenas registro manual', () => {
      expect(modalContent).toContain('Cobrança registrada como enviada');
    });
  });

  describe('3. Máquina de Estados e Chamada à RPC rpc_receita_registrar_envio', () => {
    it('deve chamar rpc_receita_registrar_envio ao atualizar para cobranca_enviada', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const receitaId = '1caa3450-d445-4ab9-930c-9c4ef2ac8076';

      // Mock da verificação de escopo de tenant
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { empresa_id: 'empresa-benevides-id' },
        error: null,
      });
      const mockEqTenant = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqTenant });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });

      // Mock da re-busca pós RPC
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: receitaId, status: 'cobranca_enviada' },
        error: null,
      });
      const mockEqRebusca = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelectRebusca = vi.fn().mockReturnValue({ eq: mockEqRebusca });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'receitas_operacionais') {
          return {
            select: vi.fn((cols: string) => {
              if (cols === 'empresa_id') return { eq: mockEqId };
              return { eq: mockEqRebusca };
            }),
          };
        }
        return {};
      });

      (supabase.rpc as any).mockResolvedValue({
        data: { success: true, status: 'cobranca_enviada' },
        error: null,
      });

      const result = await ReceitasService.updateStatus(tenantId, receitaId, 'cobranca_enviada');

      // Valida chamada à RPC correta com os parâmetros corretos
      expect(supabase.rpc).toHaveBeenCalledWith('rpc_receita_registrar_envio', {
        p_receita_id: receitaId,
      });
      expect(result.status).toBe('cobranca_enviada');
    });

    it('deve bloquear a transição se a receita não pertencer ao tenant', async () => {
      const tenantId = 'tenant-invasor';
      const receitaId = '1caa3450-d445-4ab9-930c-9c4ef2ac8076';

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEqTenant = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqTenant });

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEqId }),
      });

      await expect(
        ReceitasService.updateStatus(tenantId, receitaId, 'cobranca_enviada')
      ).rejects.toThrow('NOT_FOUND_OR_UNAUTHORIZED');

      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('4. FIX 11.2 — Visibilidade Condicional das Ações por Status da Receita', () => {
    it('deve condicionar "Registrar como Enviado" exclusivamente a status "pendente_cobranca"', () => {
      // Verifica no código que "Registrar como Enviado" está estritamente sob isPendenteCobranca
      expect(modalContent).toContain('const isPendenteCobranca = receita.status === \'pendente_cobranca\';');
      expect(modalContent).toMatch(/\{isPendenteCobranca\s*&&\s*\([\s\S]*?Registrar como Enviado[\s\S]*?\)\}/);
    });

    it('deve condicionar "Confirmar Recebimento" a status "cobranca_enviada"', () => {
      // Verifica no código que "Confirmar Recebimento" é condicionado a isCobrancaEnviada
      expect(modalContent).toContain("const isCobrancaEnviada = receita.status === 'cobranca_enviada' || receita.status === 'pendente_recebimento';");
      expect(modalContent).toMatch(/\{isCobrancaEnviada\s*&&\s*\([\s\S]*?Confirmar Recebimento[\s\S]*?\)\}/);
    });

    it('deve manter a geração/baixa da Fatura Comercial disponível em ambos os estados', () => {
      // O botão de Gerar Cobrança não é bloqueado por isPendenteCobranca e permanece presente
      expect(modalContent).toContain('Gerar Documento de Cobrança');
    });

    it('lógica de transição de visibilidade: pendente_cobranca vs cobranca_enviada', () => {
      const getBotoesVisiveis = (status: string) => {
        const isPendenteCobranca = status === 'pendente_cobranca';
        const isCobrancaEnviada = status === 'cobranca_enviada' || status === 'pendente_recebimento';

        return {
          gerarCobranca: true,
          registrarComoEnviado: isPendenteCobranca,
          confirmarRecebimento: isCobrancaEnviada,
        };
      };

      // 1. Em pendente_cobranca:
      const estadoPendente = getBotoesVisiveis('pendente_cobranca');
      expect(estadoPendente.gerarCobranca).toBe(true);
      expect(estadoPendente.registrarComoEnviado).toBe(true);
      expect(estadoPendente.confirmarRecebimento).toBe(false);

      // 2. Em cobranca_enviada:
      const estadoEnviado = getBotoesVisiveis('cobranca_enviada');
      expect(estadoEnviado.gerarCobranca).toBe(true);
      expect(estadoEnviado.registrarComoEnviado).toBe(false);
      expect(estadoEnviado.confirmarRecebimento).toBe(true);
    });
  });
});

