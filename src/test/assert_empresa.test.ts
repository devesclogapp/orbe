import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentService, EnvironmentScopeResolutionError } from '../services/environment/EnvironmentService';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    }
  };
});

describe('EnvironmentService.assertEmpresaAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EnvironmentService.invalidate();
    
    // Default current environment to PROD
    vi.spyOn(EnvironmentService, 'getCurrentEnvironment').mockReturnValue('production');
  });

  const setupSupabaseMock = (empresaResult: any = {}, testIdsResult: any[] = []) => {
    const builderMock: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    // Configurando comportamento chain de from()
    // O mock precisa diferenciar entre request para 'empresas' by ID ou by is_teste
    (supabase.from as any).mockImplementation((table: string) => {
      return {
        select: (sel: string) => {
          return {
            eq: (col: string, val: any) => {
                const chain = {
                    eq: (col2: string, val2: any) => chain,
                    maybeSingle: vi.fn().mockResolvedValue(empresaResult),
                    // para a call do testIds (que não usa maybeSingle, mas await promise directly do mock)
                    then: (resolve: any) => resolve(
                        col === 'tenant_id' ? { data: testIdsResult, error: null } : { data: null }
                    )
                };
                
                // Tratar a query getTestEmpresaIds
                if (col === 'tenant_id' && testIdsResult.length > 0) {
                   return {
                      eq: (c2: string, v2: boolean) => {
                          return Promise.resolve({ data: testIdsResult, error: null });
                      }
                   };
                }
                
                // Tratar o assertEmpresaAllowed
                return chain;
            }
          };
        }
      };
    });
  };


  it('deve rejeitar imediatamente se empresaId for nulo', async () => {
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant1', empresaId: null })
    ).rejects.toMatchObject({
      name: 'EnvironmentScopeResolutionError',
      reason: 'EMPRESA_REQUIRED'
    });
  });

  it('deve rejeitar se a empresa não existir (EMPRESA_NOT_FOUND)', async () => {
    setupSupabaseMock({ data: null, error: null });
    
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant1', empresaId: 'inexistente' })
    ).rejects.toMatchObject({
      reason: 'EMPRESA_NOT_FOUND',
      message: 'Empresa não encontrada ou não autorizada.' // User safe message
    });
  });

  it('deve rejeitar se a empresa for de outro tenant (TENANT_MISMATCH)', async () => {
    setupSupabaseMock({ data: { id: 'emp', tenant_id: 'OUTRO_TENANT' }, error: null });
    
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant-MEU', empresaId: 'emp' })
    ).rejects.toMatchObject({
      reason: 'TENANT_MISMATCH'
    });
  });

  it('deve rejeitar operação de HML na PROD (ENVIRONMENT_MISMATCH)', async () => {
    // Empresa existe no nosso tenant, mas ELA ESTÀ NOS testIds
    setupSupabaseMock(
        { data: { id: 'emp-hml', tenant_id: 'tenant-MEU' }, error: null }, 
        [{ id: 'emp-hml' }] 
    );
    
    // current environment in PROD (from beforeEach setup)
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant-MEU', empresaId: 'emp-hml' })
    ).rejects.toMatchObject({
      reason: 'ENVIRONMENT_MISMATCH'
    });
  });

  it('deve rejeitar operação de PROD na HML (ENVIRONMENT_MISMATCH)', async () => {
    setupSupabaseMock(
        { data: { id: 'emp-prod', tenant_id: 'tenant-MEU' }, error: null }, 
        [{ id: 'emp-xyz-outra' }] // a empresa-prod não está nos testIds
    );
    
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant-MEU', empresaId: 'emp-prod', environment: 'homologacao' })
    ).rejects.toMatchObject({
      reason: 'ENVIRONMENT_MISMATCH'
    });
  });

  it('deve AUTORIZAR operação regular se todos conformarem (PRODUÇÃO)', async () => {
    setupSupabaseMock(
        { data: { id: 'emp-prod', tenant_id: 'tenant-MEU' }, error: null }, 
        [{ id: 'outra-hml' }] 
    );
    
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant-MEU', empresaId: 'emp-prod', environment: 'production' })
    ).resolves.toBeUndefined();
  });
  
  it('deve AUTORIZAR operação regular se todos conformarem (HOMOLOGAÇÃO)', async () => {
    setupSupabaseMock(
        { data: { id: 'emp-hml', tenant_id: 'tenant-MEU' }, error: null }, 
        [{ id: 'emp-hml' }]
    );
    
    await expect(
      EnvironmentService.assertEmpresaAllowed({ tenantId: 'tenant-MEU', empresaId: 'emp-hml', environment: 'homologacao' })
    ).resolves.toBeUndefined();
  });
});
