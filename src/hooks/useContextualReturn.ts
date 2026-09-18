import { useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AccessControlContext } from '@/contexts/AccessControlContext';
import { useAuth } from '@/contexts/AuthContext';

export function isAllowedOperationalReturn(path?: string | null): boolean {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false;
  // Rotas operacionais canônicas permitidas para o Encarregado
  return path === '/producao' || path.startsWith('/producao/') || path.startsWith('/producao?');
}

export function sanitizeReturnPath(
  role: string | null | undefined,
  target?: string | null,
  fallback?: string,
  defaultFallback: string = '/producao'
): string {
  const isEncarregado = String(role || '').toLowerCase() === 'encarregado';

  if (isEncarregado) {
    if (target && isAllowedOperationalReturn(target)) {
      return target;
    }
    if (fallback && isAllowedOperationalReturn(fallback)) {
      return fallback;
    }
    return '/producao';
  }

  // Admin / RH / Financeiro / outros: permite qualquer rota interna válida
  if (target && target.startsWith('/') && !target.startsWith('//')) {
    return target;
  }
  return fallback || defaultFallback;
}

export function useContextualReturn(defaultFallback: string = '/producao') {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const access = useContext(AccessControlContext);
  const { user } = useAuth();

  const userRole = access?.role || user?.user_metadata?.role || (user as any)?.role;

  const goBackUrl = (customFallback?: string) => {
    const returnTo = searchParams.get('returnTo');
    const destination = sanitizeReturnPath(userRole, returnTo, customFallback, defaultFallback);
    navigate(destination);
  };

  const rawReturnTo = searchParams.get('returnTo');
  const returnUrl = sanitizeReturnPath(userRole, rawReturnTo, undefined, defaultFallback);

  return { goBackUrl, returnUrl };
}

