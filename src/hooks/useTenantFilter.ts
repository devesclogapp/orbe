import { useMemo } from "react";
import { useTenant } from "@/contexts/TenantContext";

export const useTenantQueryFilter = () => {
  const { tenantId } = useTenant();

  return useMemo(() => {
    if (!tenantId) return {};
    return { tenantId };
  }, [tenantId]);
};

export const useEmpresaFilter = () => {
  const { empresaIds } = useTenant();

  return useMemo(() => {
    if (!empresaIds || empresaIds.length === 0) return {};
    return { empresa_id: { in: empresaIds } };
  }, [empresaIds]);
};

import { supabase } from "@/lib/supabase";

export const withTenantQuery = async (table: string, query: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return query;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.tenant_id) return query;

  const tablesWithEmpresa = [
    "operacoes", "operacoes_producao", "custos_extras_operacionais",
    "colaboradores", "diaristas", "registros_ponto"
  ];

  if (tablesWithEmpresa.includes(table)) {
    const { data: empresas } = await supabase
      .from("empresas")
      .select("id")
      .eq("tenant_id", profile.tenant_id);

    if (empresas && empresas.length > 0) {
      return query.in("empresa_id", empresas.map(e => e.id));
    }
    return query.eq("empresa_id", "none");
  }

  return query.eq("tenant_id", profile.tenant_id);
};