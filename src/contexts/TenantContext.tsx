import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Tenant {
  id: string;
  name: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  empresaIds: string[] | null;
  loading: boolean;
  isAdmin: boolean;
  setTenant: (tenant: Tenant | null) => void;
  refetchTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenant(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, tenant_id, role, full_name")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) {
        setTenant(null);
        setLoading(false);
        return;
      }

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("id", profile.tenant_id)
        .single();

      if (tenantData) {
        setTenant(tenantData);
      }
    } catch (error) {
      console.error("Erro ao buscar tenant:", error);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, []);

  const value = useMemo(() => ({
    tenant,
    tenantId: tenant?.id || null,
    empresaIds: null,
    loading,
    isAdmin: false,
    setTenant,
    refetchTenant: fetchTenant
  }), [tenant, loading]);

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
  const { tenantId, empresaIds } = useTenant();
  
  return useMemo(() => {
    if (!tenantId) return {};
    return { tenant_id: tenantId, empresa_ids: empresaIds };
  }, [tenantId, empresaIds]);
};