import { supabase } from '@/lib/supabase';

export type EnvironmentMode = 'production' | 'homologacao';

export type TestEmpresaCacheEntry = {
  ids: string[];
  loadedAt: number;
};

export type EnvironmentScopeFailureReason =
  | 'EMPRESA_REQUIRED'
  | 'EMPRESA_NOT_FOUND'
  | 'TENANT_MISMATCH'
  | 'ENVIRONMENT_MISMATCH'
  | 'SCOPE_DISCOVERY_FAILED';

export class EnvironmentScopeResolutionError extends Error {
  public readonly reason?: EnvironmentScopeFailureReason;
  public cause?: unknown;
  
  constructor(message: string, cause?: unknown, reason?: EnvironmentScopeFailureReason) {
    super(message);
    this.name = 'EnvironmentScopeResolutionError';
    this.cause = cause;
    this.reason = reason;
  }
}

class EnvironmentServiceClass {
  private cache = new Map<string, TestEmpresaCacheEntry>();
  private pendingPromises = new Map<string, Promise<string[]>>();

  getCurrentEnvironment(): EnvironmentMode {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return 'production';
    }
    const env = localStorage.getItem('esc-log-environment');
    return (env === 'HOMOLOGACAO' || env === 'homologacao') ? 'homologacao' : 'production';
  }

  async getTestEmpresaIds(tenantId: string): Promise<string[]> {
    if (!tenantId) {
      throw new EnvironmentScopeResolutionError("tenantId na resolução do escopo was undefined ou vazio");
    }

    const cached = this.cache.get(tenantId);
    if (cached && (Date.now() - cached.loadedAt < 1000 * 60 * 5)) {
      return cached.ids;
    }

    const pending = this.pendingPromises.get(tenantId);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const { data, error } = await supabase
          .from('empresas')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('is_teste', true);
          
        if (error) {
          throw new EnvironmentScopeResolutionError("Erro técnico ao buscar empresas de teste", error, 'SCOPE_DISCOVERY_FAILED');
        }
        
        const ids = data?.map(e => e.id) || [];
        
        this.cache.set(tenantId, {
          ids,
          loadedAt: Date.now()
        });
        return ids;
      } finally {
        this.pendingPromises.delete(tenantId);
      }
    })();

    this.pendingPromises.set(tenantId, promise);
    return promise;
  }

  async assertEmpresaAllowed(params: {
    tenantId: string;
    empresaId?: string | null;
    environment?: EnvironmentMode;
  }): Promise<void> {
    const { tenantId, empresaId, environment = this.getCurrentEnvironment() } = params;

    if (!empresaId) {
      throw new EnvironmentScopeResolutionError(
        'Empresa obrigatória para transações seguras.',
        undefined,
        'EMPRESA_REQUIRED'
      );
    }

    // 1. Validar a base da Empresa
    const { data: empresa, error } = await supabase
      .from('empresas')
      .select('id, tenant_id')
      .eq('id', empresaId)
      .maybeSingle();

    if (error) {
      throw new EnvironmentScopeResolutionError(
        'Falha técnica ao verificar empresa.',
        error,
        'SCOPE_DISCOVERY_FAILED'
      );
    }

    if (!empresa) {
      throw new EnvironmentScopeResolutionError(
        'Empresa não encontrada ou não autorizada.', // mensagem segura (evita vasamento)
        undefined,
        'EMPRESA_NOT_FOUND'
      );
    }

    const matchedTenant = empresa.tenant_id;
    if (matchedTenant !== tenantId) {
      // Log / auditoria pegará o Reason, usuario vera string ofuscada (escondida no service ou UI)
      throw new EnvironmentScopeResolutionError(
        'Empresa não encontrada ou não autorizada.',
        undefined,
        'TENANT_MISMATCH'
      );
    }

    // 2. Comprovar HML vs PROD com fail-closed discovery
    const testIds = await this.getTestEmpresaIds(tenantId);

    if (environment === 'homologacao') {
      if (!testIds.includes(empresaId)) {
        throw new EnvironmentScopeResolutionError(
          'Empresa não encontrada ou não autorizada.',
          undefined,
          'ENVIRONMENT_MISMATCH'
        );
      }
    } 
    
    if (environment === 'production') {
      if (testIds.includes(empresaId)) {
        throw new EnvironmentScopeResolutionError(
          'Empresa não encontrada ou não autorizada.',
          undefined,
          'ENVIRONMENT_MISMATCH'
        );
      }
    }
  }

  invalidate(tenantId?: string): void {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }

  handleEnvironmentChange(): void {
    this.invalidate(); 
  }
}

export const EnvironmentService = new EnvironmentServiceClass();
