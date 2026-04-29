import { ReactNode } from "react";
import { LogOut, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface OperationalShellProps {
    children: ReactNode;
    title?: string;
    unitName?: string;
}

export const OperationalShell = ({ children, title = "Coletor Orbe", unitName }: OperationalShellProps) => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        toast.success("Sessão encerrada");
        navigate("/login/operacional");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Topbar Simplificada */}
            <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-brand flex items-center justify-center text-white shadow-lg shadow-brand/20">
                        <Zap className="h-5 w-5 fill-current" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black font-display text-foreground uppercase tracking-tight leading-none">
                            {title}
                        </h1>
                        {unitName && (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {unitName}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end mr-2">
                        <span className="text-[10px] font-bold text-foreground leading-none">{user?.email?.split('@')[0]}</span>
                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Encarregado</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Conteúdo Centralizado e Focado */}
            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
                {children}
            </main>

            {/* Footer Minimalista */}
            <footer className="py-4 border-t border-border bg-muted/30 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                    Produção em Campo · Sistema Orbe ERP
                </p>
            </footer>
        </div>
    );
};
