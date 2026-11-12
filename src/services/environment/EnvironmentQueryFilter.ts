import { EnvironmentService, EnvironmentScopeResolutionError } from './EnvironmentService';

export type EnvironmentScopeOptions = {
  tenantId: string;
  column?: string;
  includeNullInProduction?: boolean;
  testIds: string[];
  targetEmpresaId?: string;
  environment?: string;
};

function normalizeEnvironmentScope(
  environment?: string
): 'production' | 'homologacao' | 'todos' {
  if (!environment) {
    return EnvironmentService.getCurrentEnvironment();
  }
  const normalized = environment.trim().toLowerCase();
  if (normalized === 'homologacao' || normalized === 'homologação') {
    return 'homologacao';
  }
  if (normalized === 'todos') {
    return 'todos';
  }
  if (normalized === 'producao' || normalized === 'produção' || normalized === 'production') {
    return 'production';
  }
  return EnvironmentService.getCurrentEnvironment();
}

class EnvironmentQueryFilterClass {
  applyEmpresaScope<T>(
    query: T,
    options: EnvironmentScopeOptions
  ): T {
    const {
      tenantId,
      column = 'empresa_id',
      includeNullInProduction = false,
      testIds,
      targetEmpresaId,
      environment,
    } = options;
    
    if (!tenantId) {
      throw new EnvironmentScopeResolutionError("EnvironmentQueryFilter: Nenhum tenantId definido para a aplicacao do escopo.");
    }
    
    const env = normalizeEnvironmentScope(environment);
    
    const q = query as any;

    if (env === 'homologacao') {
      if (targetEmpresaId && !testIds.includes(targetEmpresaId)) {
        throw new EnvironmentScopeResolutionError(
          `Acesso negado: Empresa de produção (${targetEmpresaId}) não pode ser consultada no ambiente de Homologação.`,
          undefined,
          'ENVIRONMENT_MISMATCH'
        );
      }
      if (testIds.length === 0) {
        return q.eq(column, '00000000-0000-0000-0000-000000000000') as T;
      }
      return q.in(column, testIds) as T;
    } else if (env === 'todos') {
      // Visão conjunta: exibe tanto registros de produção quanto de homologação do tenant
      return q as T;
    } else {
      // PRODUCAO
      if (targetEmpresaId && testIds.includes(targetEmpresaId)) {
        throw new EnvironmentScopeResolutionError(
          `Acesso negado: Empresa de teste (${targetEmpresaId}) não pode ser consultada no ambiente de Produção. Alterne para a Base de Homologação.`,
          undefined,
          'ENVIRONMENT_MISMATCH'
        );
      }
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
