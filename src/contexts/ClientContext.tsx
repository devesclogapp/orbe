import React, { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

interface Cliente {
    id: string;
    nome: string;
    user_id: string | null;
    empresa_id: string | null;
    status: string | null;
}

interface ClientContextType {
    cliente: Cliente | null;
    isLoading: boolean;
    isClientUser: boolean;
    userRole: string | null;
    isInternalUser: boolean;
    error: Error | null;
}

const ClientContext = createContext<ClientContextType>({
    cliente: null,
    isLoading: false,
    isClientUser: false,
    userRole: null,
    isInternalUser: false,
    error: null,
});

export const ClientProvider = ({ children }: { children: ReactNode }) => {
    const { session } = useAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ["portal_client_and_role", session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return { cliente: null, role: null };

            // 1. Buscar se é um cliente vinculado
            const { data: cliente } = await supabase
                .from("clientes")
                .select("id, nome, user_id, empresa_id, status")
                .eq("user_id", session.user.id)
                .maybeSingle();

            // 2. Buscar o papel do usuário (Admin, RH, etc.)
            const { data: role } = await supabase.rpc("get_user_role");

            return { cliente: cliente as Cliente | null, role: role as string | null };
        },
        enabled: !!session?.user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const cliente = data?.cliente || null;
    const userRole = data?.role?.toLowerCase() || null;
    const internalRoles = ["admin", "rh", "financeiro", "encarregado"];
    const isInternalUser = !!userRole && internalRoles.includes(userRole);

    return (
        <ClientContext.Provider
            value={{
                cliente,
                isLoading,
                isClientUser: !!cliente,
                userRole,
                isInternalUser,
                error: error as Error | null,
            }}
        >
            {children}
        </ClientContext.Provider>
    );
};

export const useClient = () => useContext(ClientContext);
