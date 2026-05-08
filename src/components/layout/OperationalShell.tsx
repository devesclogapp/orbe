import { ReactNode } from "react";
import { LogOut, Zap, ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface OperationalShellProps {
    children: ReactNode;
    title?: string;
    unitName?: string;
    showBack?: boolean;
    onBack?: () => void;
}

export const OperationalShell = ({ children, title = "Coletor Orbe", unitName, showBack: propShowBack, onBack }: OperationalShellProps) => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        toast.success("Sessão encerrada");
        navigate("/login/operacional");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Topbar Operacional */}
            <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-3">
                    {propShowBack === true && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (onBack) {
                                    onBack();
                                } else {
                                    navigate(-1);
                                }
                            }}
                            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg active:bg-muted/80"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                        <Zap className="h-5 w-5 fill-current" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-black text-foreground leading-tight truncate max-w-[120px] sm:max-w-none">
                            {title}
                        </h1>
                        {unitName && (
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                                <span className="truncate max-w-[100px]">{unitName}</span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end mr-1">
                        <span className="text-[10px] font-bold text-foreground leading-none hidden sm:block">{user?.email?.split('@')[0]}</span>
                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">Encarregado</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all active:bg-destructive/10"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Conteúdo Centralizado e Focado */}
            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8 xl:px-10">
                {children}
            </main>

            {/* Botão de Ação Flutuante */}
            <div className="fixed bottom-8 right-6 z-50 sm:bottom-6">
                <Button
                    className="w-16 h-16 rounded-full bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-500/30 flex items-center justify-center transition-all duration-200 active:scale-95"
                    onClick={() => navigate("/producao")}
                >
                    <Plus className="w-8 h-8" />
                </Button>
            </div>

            {/* Footer Minimalista */}
            <footer className="py-4 border-t border-border bg-muted/30 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                    Produção em Campo · Sistema Orbe ERP
                </p>
            </footer>
        </div>
    );
};
