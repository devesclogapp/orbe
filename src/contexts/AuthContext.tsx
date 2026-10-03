import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Timeout de segurança: impede que tela fique eternamente travada se o Supabase estiver pausado ou offline
        const safetyTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn("[AuthContext] Timeout de inicialização (5s). Liberando estado de loading.");
                setLoading(false);
            }
        }, 5000);

        // Obter e validar a sessão inicial com o servidor
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            if (!isMounted) return;

            if (error || !session) {
                setSession(null);
                setUser(null);
                setLoading(false);
                clearTimeout(safetyTimeout);
                return;
            }

            try {
                // Valida se o token não está expirado ou rejeitado (403/401)
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (!isMounted) return;

                if (userError || !userData?.user) {
                    console.warn("[AuthContext] Token expirado ou servidor Supabase inacessível:", userError?.message);
                    // Limpeza local direta sem disparar requisição remota em loop quando a rede falha
                    try {
                        localStorage.removeItem('sb-lifgjtcflzmspilhryap-auth-token');
                    } catch (_) {}
                    setSession(null);
                    setUser(null);
                } else {
                    setSession(session);
                    setUser(userData.user);
                }
            } catch (err) {
                console.error("[AuthContext] Erro ao validar usuário inicial:", err);
                if (isMounted) {
                    setSession(null);
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                    clearTimeout(safetyTimeout);
                    setLoading(false);
                }
            }
        }).catch((err) => {
            console.error("[AuthContext] Falha de conexão ao inicializar sessão:", err);
            if (isMounted) {
                clearTimeout(safetyTimeout);
                setSession(null);
                setUser(null);
                setLoading(false);
            }
        });

        // Ouvir mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (!isMounted) return;
            if (event === "SIGNED_OUT" || !newSession) {
                setSession(null);
                setUser(null);
                setLoading(false);
            } else {
                setSession(newSession);
                setUser(newSession.user ?? null);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } finally {
            setSession(null);
            setUser(null);
            setLoading(false);
        }
    };

    const updateProfile = async (data: { full_name?: string; avatar_url?: string }) => {
        const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({
            data: data
        });

        if (error) throw error;
        if (updatedUser) setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
