import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Tenant {
  id: string;
  name: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  setTenant: (tenant: Tenant | null) => void;
  refetchTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasResolvedInitialLoad = useRef(false);

  const fetchTenant = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? hasResolvedInitialLoad.current;

    try {
      if (!silent) {
        setLoading(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenant(null);
        setRole(null);
        hasResolvedInitialLoad.current = true;
        return;
      }

      console.log("[TenantContext] Buscando profile para:", user.id);
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .single();

      console.log("[TenantContext] Resultado profile:", { profile, profileError });
      
      if (profileError || !profile?.tenant_id) {
        console.warn("[TenantContext] Usuário sem tenant, continuando renderização.");
        setTenant(null);
        setRole(null);
        setLoading(false);
        hasResolvedInitialLoad.current = true;
        return;
      }

      console.log("[TenantContext] Role definido:", profile.role);
      setRole(profile.role ?? null);

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("id", profile.tenant_id)
        .single();

      if (tenantError || !tenantData) {
        console.warn("[TenantContext] Tenant não encontrado:", profile.tenant_id);
        setTenant(null);
        hasResolvedInitialLoad.current = true;
        return;
      }

      setTenant(tenantData);
      hasResolvedInitialLoad.current = true;
    } catch (error) {
      console.error("[TenantContext] Erro ao buscar tenant:", error);
      if (!silent) {
        setTenant(null);
        setRole(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTenant({ silent: false });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchTenant({ silent: true });
      } else {
        setTenant(null);
        setRole(null);
        setLoading(false);
        hasResolvedInitialLoad.current = true;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    tenant,
    tenantId: tenant?.id ?? null,
    loading,
    role,
    isAdmin: role === "admin",
    setTenant,
    refetchTenant: fetchTenant,
  }), [tenant, loading, role]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};

export const useTenantFilter = () => {
  const { tenantId } = useTenant();
  return useMemo(() => {
    if (!tenantId) return {};
    return { tenant_id: tenantId };
  }, [tenantId]);
};
