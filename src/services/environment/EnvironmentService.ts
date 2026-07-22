import { supabase } from '@/lib/supabase';

export type EnvironmentMode = 'production' | 'homologacao';

export type TestEmpresaCacheEntry = {
  ids: string[];
  loadedAt: number;
};

class EnvironmentServiceClass {
  private cache = new Map<string, TestEmpresaCacheEntry>();

  getCurrentEnvironment(): EnvironmentMode {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return 'production';
    }
    const env = localStorage.getItem('esc-log-environment');
    return (env === 'HOMOLOGACAO' || env === 'homologacao') ? 'homologacao' : 'production';
  }

  async getTestEmpresaIds(tenantId: string): Promise<string[]> {
    const safeFallbackIds = ['00000000-0000-0000-0000-000000000000'];

    if (!tenantId) {
      return safeFallbackIds;
    }

    const cached = this.cache.get(tenantId);
    if (cached && (Date.now() - cached.loadedAt < 1000 * 60 * 5)) {
      return cached.ids;
    }

    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_teste', true);
        
      if (error) {
        console.error("EnvironmentService: Erro ao buscar empresas de teste.", error);
        return safeFallbackIds;
      }
      
      const testIds = data?.map(e => e.id) || [];
      const ids = testIds.length > 0 ? testIds : safeFallbackIds;
      
      this.cache.set(tenantId, {
        ids,
        loadedAt: Date.now()
      });
      return ids;
    } catch {
      return safeFallbackIds;
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
