import { useMemo } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";

/**
 * Retorna { tenantId } para uso em queries que suportam filtro por tenant_id diretamente.
 * Na maioria dos casos, o RLS do Supabase garante o isolamento automaticamente.
 */
export const useTenantQueryFilter = () => {
  const { tenantId } = useTenant();

  return useMemo(() => {
    if (!tenantId) return {};
    return { tenantId };
  }, [tenantId]);
};

// REMOVIDO: useEmpresaFilter() — referenciava `empresaIds` inexistente no TenantContext,
// causando filtro sempre vazio (vulnerabilidade de isolamento de tenant).
// Use tenantId do TenantContext + query de empresas quando precisar de filtro por empresa.

/**
 * Helper assíncrono para adicionar filtro tenant a uma query Supabase.
 * Tabelas com empresa_id intermediário são filtradas via lista de IDs de empresa do tenant.
 * Demais tabelas são filtradas diretamente por tenant_id.
 * O RLS do banco é a defesa primária; este filtro é defesa em profundidade.
 */
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
      return query.in("empresa_id", empresas.map((e: { id: string }) => e.id));
    }
    return query.eq("empresa_id", "none");
  }

  return query.eq("tenant_id", profile.tenant_id);
};