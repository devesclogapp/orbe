import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
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

  const fetchTenant = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenant(null);
        setRole(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .single();

      console.log("[TenantContext] Profile carregado:", { profile, profileError, userId: user.id });
      
      if (profileError || !profile?.tenant_id) {
        console.warn("[TenantContext] Usuário sem tenant vinculado:", user.email, "Profile:", profile);
        setTenant(null);
        setRole(null);
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
        return;
      }

      setTenant(tenantData);
    } catch (error) {
      console.error("[TenantContext] Erro ao buscar tenant:", error);
      setTenant(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchTenant();
      } else {
        setTenant(null);
        setRole(null);
        setLoading(false);
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

// Hook legado — mantido por compatibilidade mas simplificado
export const useTenantFilter = () => {
  const { tenantId } = useTenant();
  return useMemo(() => {
    if (!tenantId) return {};
    return { tenant_id: tenantId };
  }, [tenantId]);
};