import React, { createContext, useContext, ReactNode, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

export interface Cliente {
  id: string;
  nome: string;
  user_id: string | null;
  empresa_id: string | null;
  status: string | null;
}

export interface AdminEmpresaOption {
  id: string;
  nome: string;
  cnpj?: string | null;
}

interface ClientContextType {
  cliente: Cliente | null;
  isLoading: boolean;
  isClientUser: boolean;
  userRole: string | null;
  isInternalUser: boolean;
  hasNoActiveVinculo: boolean;
  error: Error | null;
  adminEmpresas: AdminEmpresaOption[];
  selectedAdminEmpresaId: string | null;
  setSelectedAdminEmpresaId: (id: string | null) => void;
}

const ClientContext = createContext<ClientContextType>({
  cliente: null,
  isLoading: false,
  isClientUser: false,
  userRole: null,
  isInternalUser: false,
  hasNoActiveVinculo: false,
  error: null,
  adminEmpresas: [],
  selectedAdminEmpresaId: null,
  setSelectedAdminEmpresaId: () => {},
});

export const ClientProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [selectedAdminEmpresaId, setSelectedAdminEmpresaIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("portal_admin_preview_empresa_id");
    }
    return null;
  });

  const setSelectedAdminEmpresaId = (id: string | null) => {
    setSelectedAdminEmpresaIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem("portal_admin_preview_empresa_id", id);
      } else {
        localStorage.removeItem("portal_admin_preview_empresa_id");
      }
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal_client_and_role", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return { cliente: null, role: null };

      // 1. Buscar o papel do usuário (Admin, RH, Cliente, etc.)
      let userRole: string | null = null;
      try {
        const { data: role } = await supabase.rpc("get_user_role");
        userRole = role ? String(role).toLowerCase() : null;
      } catch (_) {
        // Fallback silencioso
      }

      // 2. Buscar vínculo canônico com a Empresa Contratante em portal_cliente_usuarios
      try {
        const { data: vinculo } = await supabase
          .from("portal_cliente_usuarios")
          .select("id, tenant_id, empresa_id, ativo")
          .eq("user_id", session.user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (vinculo?.empresa_id) {
          let nomeEmpresa = "Empresa Contratante";
          const { data: emp } = await supabase
            .from("empresas")
            .select("nome")
            .eq("id", vinculo.empresa_id)
            .maybeSingle();
          if (emp?.nome) nomeEmpresa = emp.nome;

          const clienteObj: Cliente = {
            id: vinculo.id,
            nome: nomeEmpresa,
            user_id: session.user.id,
            empresa_id: vinculo.empresa_id,
            status: "ativo",
          };
          return { cliente: clienteObj, role: userRole || "cliente" };
        }
      } catch (_) {
        // Fallback para tabela legado se existir
      }

      // 3. Fallback: Buscar se é um cliente na tabela legada clientes
      try {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("id, nome, user_id, empresa_id, status")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cliente) {
          return { cliente: cliente as Cliente, role: userRole };
        }
      } catch (_) {}

      return { cliente: null, role: userRole };
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const rawCliente = data?.cliente || null;
  const userRole = data?.role?.toLowerCase() || null;
  const internalRoles = ["admin", "rh", "financeiro", "encarregado", "gestor"];
  const isInternalUser = !!userRole && internalRoles.includes(userRole);

  // Se for usuário interno (Admin/Gestor), carregar a lista de empresas ativas do tenant para seleção
  const { data: adminEmpresasData = [] } = useQuery({
    queryKey: ["portal_admin_empresas_list"],
    enabled: isInternalUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as AdminEmpresaOption[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const adminEmpresas = adminEmpresasData;

  // Se for admin e tiver empresa selecionada, montar cliente virtual para prévia
  const effectiveCliente = useMemo(() => {
    if (isInternalUser) {
      if (!selectedAdminEmpresaId && adminEmpresas.length > 0) {
        // Selecionar por padrão a primeira se ainda não houver
        const first = adminEmpresas[0];
        return {
          id: first.id,
          nome: first.nome,
          user_id: session?.user?.id || null,
          empresa_id: first.id,
          status: "ativo",
        };
      }
      const match = adminEmpresas.find((e) => e.id === selectedAdminEmpresaId);
      if (match) {
        return {
          id: match.id,
          nome: match.nome,
          user_id: session?.user?.id || null,
          empresa_id: match.id,
          status: "ativo",
        };
      }
    }
    return rawCliente;
  }, [isInternalUser, selectedAdminEmpresaId, adminEmpresas, rawCliente, session?.user?.id]);

  const activeAdminEmpresaId = isInternalUser ? (effectiveCliente?.empresa_id || selectedAdminEmpresaId) : null;

  const hasNoActiveVinculo = !isLoading && userRole === "cliente" && !rawCliente;

  return (
    <ClientContext.Provider
      value={{
        cliente: effectiveCliente,
        isLoading,
        isClientUser: !!effectiveCliente || userRole === "cliente",
        userRole,
        isInternalUser,
        hasNoActiveVinculo,
        error: error as Error | null,
        adminEmpresas,
        selectedAdminEmpresaId: activeAdminEmpresaId,
        setSelectedAdminEmpresaId,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => useContext(ClientContext);
