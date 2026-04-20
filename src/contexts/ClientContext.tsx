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
    error: Error | null;
}

const ClientContext = createContext<ClientContextType>({
    cliente: null,
    isLoading: false,
    isClientUser: false,
    error: null,
});

export const ClientProvider = ({ children }: { children: ReactNode }) => {
    const { session } = useAuth();

    const { data: cliente = null, isLoading, error } = useQuery({
        queryKey: ["portal_cliente", session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return null;
            const { data, error } = await supabase
                .from("clientes")
                .select("id, nome, user_id, empresa_id, status")
                .eq("user_id", session.user.id)
                .maybeSingle();
            if (error) throw error;
            return data as Cliente | null;
        },
        enabled: !!session?.user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return (
        <ClientContext.Provider
            value={{
                cliente,
                isLoading,
                isClientUser: !!cliente,
                error: error as Error | null,
            }}
        >
            {children}
        </ClientContext.Provider>
    );
};

export const useClient = () => useContext(ClientContext);
