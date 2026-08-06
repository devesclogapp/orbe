import { EnvironmentService, EnvironmentScopeResolutionError } from './EnvironmentService';

export type EnvironmentScopeOptions = {
  tenantId: string;
  column?: string;
  includeNullInProduction?: boolean;
  testIds: string[];
};

class EnvironmentQueryFilterClass {
  applyEmpresaScope<T>(
    query: T,
    options: EnvironmentScopeOptions
  ): T {
    const { tenantId, column = 'empresa_id', includeNullInProduction = false, testIds } = options;
    
    if (!tenantId) {
      throw new EnvironmentScopeResolutionError("EnvironmentQueryFilter: Nenhum tenantId definido para a aplicacao do escopo.");
    }
    
    const env = EnvironmentService.getCurrentEnvironment();
    
    const q = query as any;

    if (env === 'homologacao') {
      if (testIds.length === 0) {
        return q.eq(column, '00000000-0000-0000-0000-000000000000') as T;
      }
      return q.in(column, testIds) as T;
    } else {
      if (testIds.length === 0) {
        return q as T; // Nenhum ID HML para excluir. Continua a query normal.
      }
      
      const safeJoined = `(${testIds.join(',')})`;
      
      if (includeNullInProduction) {
        return q.or(`${column}.not.in.${safeJoined},${column}.is.null`) as T;
      } else {
        const result = q.not(column, 'in', safeJoined);
        return result as T;
      }
    }
  }
}

export const EnvironmentQueryFilter = new EnvironmentQueryFilterClass();
