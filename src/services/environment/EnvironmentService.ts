import { supabase } from '@/lib/supabase';

export type EnvironmentMode = 'production' | 'homologacao';

export type TestEmpresaCacheEntry = {
  ids: string[];
  loadedAt: number;
};

export class EnvironmentScopeResolutionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'EnvironmentScopeResolutionError';
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
          throw new EnvironmentScopeResolutionError("Erro técnico ao buscar empresas de teste", error);
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
