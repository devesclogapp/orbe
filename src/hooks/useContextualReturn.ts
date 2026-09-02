import { useNavigate, useSearchParams } from 'react-router-dom';

export function useContextualReturn(defaultFallback: string = '/operacional/dashboard') {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const goBackUrl = (customFallback?: string) => {
    const returnTo = searchParams.get('returnTo');
    // Safely ensure the return location is an internal route
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      navigate(returnTo);
    } else {
      navigate(customFallback || defaultFallback);
    }
  };

  return { goBackUrl, returnUrl: searchParams.get('returnTo') };
}

