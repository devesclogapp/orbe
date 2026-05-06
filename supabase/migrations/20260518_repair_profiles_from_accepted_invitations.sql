-- ============================================================
-- REPAIR: Sincronizar profiles com convites aceitos
-- Data: 2026-05-18
-- Objetivo:
--   1. Corrigir role de usuarios que aceitaram convite de encarregado
--   2. Reconciliar tenant_id quando o profile ficou divergente do convite
--   3. Recuperar casos antigos aceitos antes do ajuste da function
-- ============================================================

WITH latest_accepted_invitation AS (
  SELECT DISTINCT ON (lower(ti.email))
    lower(ti.email) AS email_norm,
    ti.tenant_id,
    ti.role,
    ti.accepted_at
  FROM public.tenant_invitations ti
  WHERE ti.accepted_at IS NOT NULL
    AND ti.role IN ('admin', 'rh', 'financeiro', 'encarregado', 'user')
  ORDER BY lower(ti.email), ti.accepted_at DESC
)
UPDATE public.profiles p
SET
  tenant_id = lai.tenant_id,
  role = lai.role
FROM auth.users au
JOIN latest_accepted_invitation lai
  ON lai.email_norm = lower(au.email)
WHERE p.user_id = au.id
  AND (
    p.tenant_id IS DISTINCT FROM lai.tenant_id
    OR p.role IS DISTINCT FROM lai.role
  );
