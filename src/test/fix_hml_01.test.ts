import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentService } from '../services/environment/EnvironmentService';
import { EnvironmentQueryFilter } from '../services/environment/EnvironmentQueryFilter';
import { CustoExtraOperacionalService } from '../services/domain/despesas.service';
import { ServicosExtrasOperacionaisService } from '../services/receitas/receitas.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', app_metadata: { tenant_id: 'tenant-1' } } },
          error: null
        })
      },
      from: vi.fn(),
      rpc: vi.fn(),
    }
  };
});

describe('FIX-HML-01: Proteção e Segregação do Ambiente de Homologação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EnvironmentService.invalidate();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('1. EnvironmentService.getCurrentEnvironment & Modo TODOS', () => {
    it('deve retornar "todos" quando localStorage for "TODOS" ou "todos"', () => {
      localStorage.setItem('esc-log-environment', 'TODOS');
      expect(EnvironmentService.getCurrentEnvironment()).toBe('todos');

      localStorage.setItem('esc-log-environment', 'todos');
      expect(EnvironmentService.getCurrentEnvironment()).toBe('todos');
    });

    it('deve retornar "homologacao" quando localStorage for "HOMOLOGACAO"', () => {
      localStorage.setItem('esc-log-environment', 'HOMOLOGACAO');
      expect(EnvironmentService.getCurrentEnvironment()).toBe('homologacao');
    });

    it('deve retornar "production" por padrão quando ausente ou PRODUCAO', () => {
      localStorage.removeItem('esc-log-environment');
      expect(EnvironmentService.getCurrentEnvironment()).toBe('production');

      localStorage.setItem('esc-log-environment', 'PRODUCAO');
      expect(EnvironmentService.getCurrentEnvironment()).toBe('production');
    });
  });

  describe('2. EnvironmentQueryFilter: Visão Conjunta (TODOS) vs PROD vs HML', () => {
    const mockQuery = () => {
      const q: any = {
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
      };
      return q;
    };

    it('no modo TODOS, deve retornar a query sem restrição de testIds (visão conjunta preservando tenant)', () => {
      localStorage.setItem('esc-log-environment', 'TODOS');
      const q = mockQuery();

      const result = EnvironmentQueryFilter.applyEmpresaScope(q, {
        tenantId: 'tenant-123',
        column: 'empresa_id',
        testIds: ['emp-test-1', 'emp-test-2']
      });

      expect(result).toBe(q);
      expect(q.not).not.toHaveBeenCalled();
      expect(q.in).not.toHaveBeenCalled();
    });

    it('no modo PRODUCTION, deve filtrar e excluir testIds', () => {
      localStorage.setItem('esc-log-environment', 'PRODUCAO');
      const q = mockQuery();

      EnvironmentQueryFilter.applyEmpresaScope(q, {
        tenantId: 'tenant-123',
        column: 'empresa_id',
        testIds: ['emp-test-1']
      });

      expect(q.not).toHaveBeenCalledWith('empresa_id', 'in', '(emp-test-1)');
    });

    it('no modo HOMOLOGACAO, deve restringir apenas aos testIds', () => {
      localStorage.setItem('esc-log-environment', 'HOMOLOGACAO');
      const q = mockQuery();

      EnvironmentQueryFilter.applyEmpresaScope(q, {
        tenantId: 'tenant-123',
        column: 'empresa_id',
        testIds: ['emp-test-1']
      });

      expect(q.in).toHaveBeenCalledWith('empresa_id', ['emp-test-1']);
    });
  });

  describe('3. Validação de Escrita em Custos Extras (CustoExtraOperacionalService.createMany)', () => {
    const setupSupabaseForEmpresas = (empresaData: any, testIds: any[]) => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'empresas') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              return {
                eq: vi.fn().mockImplementation((col1: string, val1: any) => {
                  if (col1 === 'tenant_id') {
                    return {
                      eq: vi.fn().mockResolvedValue({ data: testIds, error: null })
                    };
                  }
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({ data: empresaData, error: null })
                  };
                })
              };
            })
          };
        }
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [{ id: 'custo-1' }], error: null })
          })
        };
      });
    };

    it('deve bloquear gravação de Custos Extras com empresa de teste quando o ambiente for PRODUÇÃO', async () => {
      localStorage.setItem('esc-log-environment', 'PRODUCAO');
      setupSupabaseForEmpresas(
        { id: 'emp-hml', tenant_id: 'tenant-1' },
        [{ id: 'emp-hml' }] // é empresa de teste
      );

      await expect(
        CustoExtraOperacionalService.createMany([
          {
            tenant_id: 'tenant-1',
            empresa_id: 'emp-hml',
            data_custo: '2026-10-12',
            descricao: 'Gasto teste',
            valor: 100,
            tipo_custo: 'OPERACIONAL',
            responsavel: 'Encarregado',
            status: 'PENDENTE'
          }
        ])
      ).rejects.toMatchObject({
        reason: 'ENVIRONMENT_MISMATCH'
      });
    });

    it('deve bloquear gravação de Custos Extras se a empresa pertencer a outro tenant', async () => {
      localStorage.setItem('esc-log-environment', 'PRODUCAO');
      setupSupabaseForEmpresas(
        { id: 'emp-outro-tenant', tenant_id: 'OUTRO_TENANT' },
        []
      );

      await expect(
        CustoExtraOperacionalService.createMany([
          {
            tenant_id: 'tenant-1',
            empresa_id: 'emp-outro-tenant',
            data_custo: '2026-10-12',
            descricao: 'Gasto teste',
            valor: 100,
            tipo_custo: 'OPERACIONAL',
            responsavel: 'Encarregado',
            status: 'PENDENTE'
          }
        ])
      ).rejects.toMatchObject({
        reason: 'TENANT_MISMATCH'
      });
    });
  });

  describe('4. Validação de Escrita em Serviços Extras (ServicosExtrasOperacionaisService.create)', () => {
    const validTenantId = '11111111-1111-1111-1111-111111111111';
    const validEmpresaHml = '22222222-2222-2222-2222-222222222222';

    const setupSupabaseForEmpresas = (empresaData: any, testIds: any[]) => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { tenant_id: validTenantId }, error: null })
              })
            })
          };
        }
        if (table === 'empresas') {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              return {
                eq: vi.fn().mockImplementation((col1: string, val1: any) => {
                  if (col1 === 'tenant_id') {
                    return {
                      eq: vi.fn().mockResolvedValue({ data: testIds, error: null })
                    };
                  }
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({ data: empresaData, error: null })
                  };
                })
              };
            })
          };
        }
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'servico-1' }, error: null })
            })
          })
        };
      });
    };

    it('deve bloquear gravação de Serviços Extras com empresa de teste quando em PRODUÇÃO', async () => {
      localStorage.setItem('esc-log-environment', 'PRODUCAO');
      setupSupabaseForEmpresas(
        { id: validEmpresaHml, tenant_id: validTenantId },
        [{ id: validEmpresaHml }]
      );

      await expect(
        ServicosExtrasOperacionaisService.create({
          tenant_id: validTenantId,
          empresa_id: validEmpresaHml,
          data_servico: '2026-10-12',
          descricao: 'Descarga especial teste',
          valor_total: 500,
          status: 'PENDENTE'
        })
      ).rejects.toMatchObject({
        reason: 'ENVIRONMENT_MISMATCH'
      });
    });

    it('deve autorizar gravação de Serviços Extras no ambiente correto', async () => {
      localStorage.setItem('esc-log-environment', 'HOMOLOGACAO');
      setupSupabaseForEmpresas(
        { id: validEmpresaHml, tenant_id: validTenantId },
        [{ id: validEmpresaHml }]
      );

      const result = await ServicosExtrasOperacionaisService.create({
        tenant_id: validTenantId,
        empresa_id: validEmpresaHml,
        data_servico: '2026-10-12',
        descricao: 'Descarga especial teste',
        valor_total: 500,
        status: 'PENDENTE'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('servico-1');
    });
  });
});
