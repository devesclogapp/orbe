import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { supabase } from "@/lib/supabase";
import { normalizeRole } from "@/lib/access-control";

export interface ContadorScopeResult {
  isContador: boolean;
  isLoadingScope: boolean;
  empresasAutorizadasIds: string[];
  isEmpresaAutorizada: (empresaId?: string | null) => boolean;
  filterEmpresas: <T extends { id: string }>(empresas: T[]) => T[];
  validateOrFallbackEmpresaId: (currentEmpresaId: string, availableEmpresas: Array<{ id: string }>) => string;
}

/**
 * Hook de Governança Contábil (CONT-07.2 - Contador Interno ESC Logística)
 * O Contador é um profissional interno da própria ESC Logística com acesso
 * às 5 ferramentas contábeis oficiais para auditar e consolidar lançamentos
 * de todas as empresas clientes vinculadas ao tenant da organização.
 */
export function useContadorScope(): ContadorScopeResult {
  const { user } = useAuth();
  const { role, isAdmin } = useAccessControl();

  const isContador = useMemo(() => {
    return normalizeRole(role) === "contador";
  }, [role]);

  // Consulta do vínculo de empresas registradas em user_permissions (caso haja filtro customizado retroativo)
  const { data: rawScope, isLoading: isLoadingScope } = useQuery({
    queryKey: ["contador_empresa_scope", user?.id],
    enabled: isContador && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return { empresas_ids: [] };

      const { data, error } = await supabase
        .from("user_permissions")
        .select("permissions")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("[useContadorScope] Erro ao carregar vínculo contábil:", error.message);
        return { empresas_ids: [] };
      }

      const raw = data?.permissions as Record<string, unknown> | null;
      const contadorCtx = (raw?.contador_context as Record<string, unknown>) || {};
      const singleId = typeof contadorCtx.empresa_id === "string" ? contadorCtx.empresa_id : null;
      const idsArray = Array.isArray(contadorCtx.empresas_ids)
        ? (contadorCtx.empresas_ids as string[]).filter(Boolean)
        : [];

      const set = new Set<string>();
      if (singleId) set.add(singleId);
      idsArray.forEach((id) => set.add(id));

      return {
        empresas_ids: Array.from(set),
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const empresasAutorizadasIds = useMemo(() => {
    return rawScope?.empresas_ids || [];
  }, [rawScope]);

  // O Contador interno da ESC Logística tem acesso a todas as empresas do tenant por padrão.
  // A seleção por empresa funciona como filtro de origem dos lançamentos.
  const isEmpresaAutorizada = useMemo(() => {
    return (empresaId?: string | null): boolean => {
      if (!isContador || isAdmin) return true;
      if (!empresaId || empresaId === "TODAS") return true;
      if (empresasAutorizadasIds.length > 0) {
        return empresasAutorizadasIds.includes(empresaId);
      }
      return true;
    };
  }, [isContador, isAdmin, empresasAutorizadasIds]);

  const filterEmpresas = useMemo(() => {
    return <T extends { id: string }>(empresas: T[]): T[] => {
      if (!isContador || isAdmin) return empresas;
      if (empresasAutorizadasIds.length > 0) {
        return empresas.filter((e) => empresasAutorizadasIds.includes(e.id));
      }
      return empresas;
    };
  }, [isContador, isAdmin, empresasAutorizadasIds]);

  const validateOrFallbackEmpresaId = useMemo(() => {
    return (currentEmpresaId: string, availableEmpresas: Array<{ id: string }>): string => {
      if (!currentEmpresaId || currentEmpresaId === "TODAS") return currentEmpresaId;
      const exists = availableEmpresas.some((e) => e.id === currentEmpresaId);
      if (exists) return currentEmpresaId;
      return availableEmpresas[0]?.id || "";
    };
  }, []);

  return {
    isContador,
    isLoadingScope,
    empresasAutorizadasIds,
    isEmpresaAutorizada,
    filterEmpresas,
    validateOrFallbackEmpresaId,
  };
}
