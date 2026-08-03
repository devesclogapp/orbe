import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentService } from '../services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';
import { OperacaoProducaoService } from '../services/domain/producao.service';
import { MotorFinanceiro } from '../services/operationalEngine/MotorFinanceiro';
import { ReceitasService } from '../services/receitas/receitas.service';
import { operationalClient } from '../services/domain/base.service';

// Ignorar Logs de console no console final do vitest
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mocking dependencies
vi.mock('@/lib/supabase', () => {
    return {
      supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
      }
    };
});
vi.mock('../services/domain/base.service', async () => {
  const actual = await vi.importActual('../services/domain/base.service') as any;
  return {
    ...actual,
    getCurrentTenantId: vi.fn().mockResolvedValue('tenant-MEU'),
    requireAuthenticatedUserId: vi.fn().mockResolvedValue('user-xyz'),
    operationalClient: {
      from: vi.fn(),
      rpc: vi.fn(),
    }
  };
});

describe('Operações por Volume & Receitas - Integração e Segregação', () => {
  let mockSupabaseChain: any;
  let mockOpClientChain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    EnvironmentService.invalidate();
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
    
    const buildChain = (result: any = { data: {}, error: null }) => {
        const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue(result),
            single: vi.fn().mockResolvedValue(result),
            insert: vi.fn().mockResolvedValue(result),
            update: vi.fn().mockResolvedValue(result),
            delete: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve(result),
            catch: vi.fn().mockReturnThis(),
        };
        return chain;
    };
    
    mockSupabaseChain = buildChain();
    mockOpClientChain = buildChain();
    
    (supabase.from as any).mockImplementation(() => mockSupabaseChain);
    (operationalClient.from as any).mockImplementation(() => mockOpClientChain);
  });

  // ========== BLOCO 1: CREATE E ORDEM DE EXECUÇÃO ==========
  describe('Criação com Assert Síncrono Obrigatório', () => {
    it('Cenário 1 e 21: A ordem de execução garante que assertEmpresaAllowed conclua antes de invocar o insert', async () => {
       const assertSpy = vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);
       const insertSpy = mockOpClientChain.insert;
       
       const callOrder: string[] = [];
       assertSpy.mockImplementation(async () => { callOrder.push('assert'); });
       insertSpy.mockImplementation(() => { callOrder.push('insert'); return Promise.resolve({ data: {}, error: null }); });

       await OperacaoProducaoService.create({ empresa_id: 'emp-123' });
       
       expect(callOrder).toEqual(['assert', 'insert']);
       expect(assertSpy).toHaveBeenCalledTimes(1);
    });

    it('Cenário 4 e 5: Falha no assert previne totalmente o insert', async () => {
        vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockRejectedValue(new Error('FAKE_ERROR'));
        
        await expect(OperacaoProducaoService.create({ empresa_id: 'emp-errada' })).rejects.toThrow('FAKE_ERROR');
        expect(mockOpClientChain.insert).not.toHaveBeenCalled();
    });
  });

  // ========== BLOCO 2: ATOMICIDADE COMPENSATÓRIA ==========
  describe('Atomicidade e Compensação com Colaboradores', () => {
    it('Cenário 22: Falha no insert de colaboradores estorna a operação recém-criada via deleção.', async () => {
        vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);
        
        // Simular criação com sucesso da Operacao Pai
        vi.spyOn(OperacaoProducaoService, 'create').mockResolvedValue({ id: 'op-nova' } as any);
        
        // Simular erro DENTRO da branch de colaboradores
        mockOpClientChain.insert.mockResolvedValueOnce({ data: null, error: new Error('FALHA_CONSTRAINTS') });
        
        const deleteSpy = vi.spyOn(OperacaoProducaoService, 'delete').mockResolvedValue(true as any);

        await expect(
           OperacaoProducaoService.createWithColaboradores({ empresa_id: 'emp1' }, [{ collaborator_id: 'c1', had_infraction: false }])
        ).rejects.toThrow('FALHA_CONSTRAINTS');

        expect(deleteSpy).toHaveBeenCalledWith('op-nova', undefined);
    });

    it('Cenário 23: Falha no insert de MATERIAIS estorna a operação e (por cascata no banco) colaboradores', async () => {
        vi.spyOn(OperacaoProducaoService, 'create').mockResolvedValue({ id: 'op-nova2' } as any);
        const deleteSpy = vi.spyOn(OperacaoProducaoService, 'delete').mockResolvedValue(true as any);
        
        // Primeira insercao (colaboradores) OK 
        // Segunda inserção (materiais) ERRO
        mockOpClientChain.insert.mockResolvedValueOnce({ data: {}, error: null }); // colabs
        mockOpClientChain.insert.mockResolvedValueOnce({ data: null, error: new Error('FALHA_MATERIAIS') }); // mat
        
        await expect(
           OperacaoProducaoService.createWithColaboradores({ empresa_id: 'emp1' }, 
             [{ collaborator_id: 'c1', had_infraction: false }],
             [{ material_id: 'm1', quantidade: 5, nome_snapshot: '', unidade_snapshot: '', valor_unitario_snapshot: 0, valor_total: 0 }]
           )
        ).rejects.toThrow('FALHA_MATERIAIS');

        expect(deleteSpy).toHaveBeenCalledWith('op-nova2', undefined);
    });
    
    it('Bônus Update: Snapshot é acionado caso atualização de colaboradores falhe após a deleção', async () => {
        vi.spyOn(OperacaoProducaoService, 'update').mockResolvedValue({ id: 'op-upd' } as any);
        
        // Resposta da query de snapshot: ele finge que tem 2 colaboradores
        mockOpClientChain.select.mockReturnThis();
        mockOpClientChain.eq.mockImplementation((k: string) => {
            if (k === 'production_entry_id') return { then: (res: any) => res({ data: [{ collaborator_id: 'antigo1' }], error: null }) };
            return mockOpClientChain;
        });

        // 1. Snapshot pego.
        // 2. Erro gerado propositalmente no insert atual.
        mockOpClientChain.insert.mockImplementation((payload: any) => {
            // Se o payload for os "NOVOS" geramos o erro:
            if (payload.length > 0 && payload[0].collaborator_id === 'novo1') {
                return Promise.resolve({ data: null, error: new Error('ERRO_INSERT_NOVO') });
            }
            // Se for do Catch restorativo, damos success:
            return Promise.resolve({ data: payload, error: null });
        });

        await expect(
            OperacaoProducaoService.updateWithColaboradores('op-upd', {}, [{ collaborator_id: 'novo1', had_infraction: false }])
        ).rejects.toThrow('ERRO_INSERT_NOVO');
        
        // Verifica se a function de restauracao foi chamada
        // Ele tentou fazer o insert pelo menos 2 vezes (1 p dar erro, 1 catch block restore)
        expect(mockOpClientChain.insert).toHaveBeenCalledTimes(2);
    });
  });

  // ========== BLOCO 3: UPDATES & SCOPE LOCK ==========
  describe('Update e Delete com Proteção Severa Contra Mudança de Ambiente', () => {
    it('Cenário 28 e 9: updateRevalida o escopo da operação gravada (FETCH prévio)', async () => {
       const assertSpy = vi.spyOn(EnvironmentService, 'assertEmpresaAllowed').mockResolvedValue(undefined);
       
       // Simulando existing
       mockOpClientChain.maybeSingle.mockResolvedValueOnce({ data: { empresa_id: 'emp-original' }, error: null }); // fetch prior
       (operationalClient.rpc as any).mockResolvedValueOnce({ data: {}, error: null }); // rpc call
       
       await OperacaoProducaoService.update('hash123', { empresa_id: 'emp-original' });
       
       // Garante que o assert rodou usando o "existing"
       expect(assertSpy).toHaveBeenCalledWith({ tenantId: 'tenant-MEU', empresaId: 'emp-original' });
    });
    
    it('Tentativa de excluir uma Operação inexistente no Tenant resulta em falha silenciosa prevenida (NOT_FOUND_OR_CONFLICT)', async () => {
       // O Fetch prévio retorna nulo (seja por não ser do usuario, seja inegsistencia)
       mockOpClientChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
       
       await expect(OperacaoProducaoService.delete('hashX')).rejects.toThrow('NOT_FOUND_OR_CONFLICT');
    });
  });

  // ========== BLOCO 4: MOTOR FINANCEIRO ==========
  describe('Motor Financeiro - Isolamento Direto no BD (Amostragem Total)', () => {
     it('Cenário 25 e 26: MotorFinanceiro usa o is_teste interno e recusa Lotes Misturados (ENVIRONMENT_MIXED_SOURCE)', async () => {
         // Subornar a Query principal de fechamento
         mockSupabaseChain.lt.mockResolvedValueOnce({ 
             data: [
                 { id: 'op1', tenant_id: 'tenant-MEU', empresa_id: 'emp1', empresas: { is_teste: true } },
                 { id: 'op2', tenant_id: 'tenant-MEU', empresa_id: 'emp1', empresas: { is_teste: false } }, 
             ], 
             error: null 
         });

         const res = await MotorFinanceiro.processarFechamento('2026-08', 'emp1', 'tenant-MEU');
         expect(res.success).toBe(false);
         expect(res.error?.message).toContain('Fontes mistas não são permitidas');
     });

     it('Cenário 24: Bloqueia fechar HML em janela visual PROD e vice-versa', async () => {
         // O Operacoes carregado é restritamente de HOMOLOGAÇÃO
         mockSupabaseChain.lt.mockResolvedValueOnce({ 
             data: [
                 { id: 'op1', tenant_id: 'tenant-MEU', empresa_id: 'emp1', empresas: { is_teste: true } },
             ], 
             error: null 
         });
         
         // Mas estamos no painel visual da aplicacao "production", isso eh um spoof ou exploit.
         vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
         let res = await MotorFinanceiro.processarFechamento('2026-08', 'emp1', 'tenant-MEU');
         expect(res.success).toBe(false);
         expect(res.error?.message).toContain('Operação PROD detectou registros HML');
         
         // Invertendo...
         mockSupabaseChain.lt.mockResolvedValueOnce({ 
             data: [
                 { id: 'op1', tenant_id: 'tenant-MEU', empresa_id: 'emp1', empresas: { is_teste: false } },
             ], 
             error: null 
         });
         vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
         res = await MotorFinanceiro.processarFechamento('2026-08', 'emp1', 'tenant-MEU');
         expect(res.success).toBe(false);
         expect(res.error?.message).toContain('Operação HML detectou registros PROD');
     });
     
     it('Cenário de Integração Correta (Operação HML fluindo em janela HML)', async () => {
         mockSupabaseChain.lt.mockResolvedValueOnce({ 
             data: [
                 { id: 'op1', tenant_id: 'tenant-MEU', empresa_id: 'emp-hml', valor_total: 1500, empresas: { is_teste: true } },
             ], 
             error: null 
         });
         // Console está rodando em homologacao
         vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('homologacao');
         
         // Cliente espelho e garantias basicas Mockadas
         mockSupabaseChain.maybeSingle.mockResolvedValue({ data: { id: 'cliente-hml' }, error: null });
         (supabase.rpc as any).mockResolvedValue({ error: null }); // RPCs do motor (ensure_competencia e ensure_cliente)

         const res = await MotorFinanceiro.processarFechamento('2026-08', 'emp-hml', 'tenant-MEU');
         
         // Fluiu corretamente até o commit 
         expect(res.success).toBe(true);
     });
  });

  // ========== BLOCO 5: RECEITAS SERVICE ==========
  describe('ReceitasService - Edições Sensíveis', () => {
      it('Cenário 28 e Zero-Rows Rule: updateReceita verifica via escopo cruzado de 0 rows afetadas devolvendo fail-closed', async () => {
         // Original query
         mockSupabaseChain.maybeSingle.mockResolvedValueOnce({ data: { empresa_id: 'emp2' }, error: null });
         
         // A update query vai simular "0 rows" retornando data=null from Supabase .single() (que lança fallback de nulo na stack supabase-js)
         mockSupabaseChain.single.mockResolvedValueOnce({ data: null, error: null });
         
         await expect(ReceitasService.updateReceita('tenant-MEU', 'rec1', { observacao: 'nova obs' }))
           .rejects.toThrow('Update falhou silenciosamente, 0 linhas afetadas no escopo original.');
      });
  });
});
