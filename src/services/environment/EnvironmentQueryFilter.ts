import { EnvironmentService } from './EnvironmentService';

export type EnvironmentScopeOptions = {
  tenantId: string;
  column?: string;
  includeNullInProduction?: boolean;
};

class EnvironmentQueryFilterClass {
  async applyEmpresaScope<T>(
    query: T,
    options: EnvironmentScopeOptions
  ): Promise<T> {
    const { tenantId, column = 'empresa_id', includeNullInProduction = false } = options;
    
    if (!tenantId) {
      console.warn("EnvironmentQueryFilter: Nenhum tenantId definido. Retornando array de seguranca vazio.");
    }
    
    const env = EnvironmentService.getCurrentEnvironment();
    const safeTestIds = await EnvironmentService.getTestEmpresaIds(tenantId);
    const safeJoined = `(${safeTestIds.join(',')})`;

    const q = query as any;

    if (env === 'homologacao') {
      return q.in(column, safeTestIds) as T;
    } else {
      if (includeNullInProduction) {
        return q.or(`${column}.not.in.${safeJoined},${column}.is.null`) as T;
      } else {
        // More strict, cannot be null, must not be in safeTestIds
        return q.not(column, 'in', safeJoined) as T;
      }
    }
  }
}

export const EnvironmentQueryFilter = new EnvironmentQueryFilterClass();
