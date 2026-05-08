import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";
import {
  AccessAction,
  AccessModule,
  PermissionMatrix,
  buildPresetPermissions,
  canAccessModule,
  normalizePermissionMatrix,
  normalizeRole,
} from "@/lib/access-control";

type UserAccessRecord = {
  role: string;
  status: string;
  permissions: PermissionMatrix | null;
};

interface AccessControlContextValue {
  role: string | null;
  status: string;
  permissions: PermissionMatrix;
  loading: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  canAccess: (moduleId: AccessModule, action?: AccessAction) => boolean;
  refetch: () => Promise<unknown>;
}

const AccessControlContext = createContext<AccessControlContextValue | undefined>(
  undefined,
);

export const AccessControlProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading: authLoading } = useAuth();
  const { role: tenantRole, loading: tenantLoading } = useTenant();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["user_access_control", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: accessData, error } = await supabase
        .from("user_permissions")
        .select("role, status, permissions")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        const message = String(error.message || "");
        const relationMissing =
          message.includes("relation") && message.includes("user_permissions");

        if (relationMissing) {
          return null;
        }

        throw error;
      }

      return (accessData as UserAccessRecord | null) ?? null;
    },
    staleTime: 1000 * 60 * 2,
  });

  const effectiveRole = normalizeRole(data?.role ?? tenantRole ?? "user");
  const permissions = useMemo(() => {
    if (effectiveRole === "admin") {
      return buildPresetPermissions("admin");
    }

    return normalizePermissionMatrix(data?.permissions, effectiveRole);
  }, [data?.permissions, effectiveRole]);

  const status = (data?.status || "ativo").toLowerCase();
  const value = useMemo<AccessControlContextValue>(
    () => ({
      role: effectiveRole,
      status,
      permissions,
      loading: authLoading || tenantLoading || isLoading,
      isAdmin: effectiveRole === "admin",
      isBlocked: status === "bloqueado",
      canAccess: (moduleId: AccessModule, action: AccessAction = "ver") => {
        if (effectiveRole === "admin") return true;
        if (status === "bloqueado") return false;
        return canAccessModule(permissions, moduleId, action);
      },
      refetch,
    }),
    [authLoading, effectiveRole, isLoading, permissions, refetch, status, tenantLoading],
  );

  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  );
};

export const useAccessControl = () => {
  const context = useContext(AccessControlContext);

  if (!context) {
    throw new Error(
      "useAccessControl must be used within an AccessControlProvider",
    );
  }

  return context;
};
