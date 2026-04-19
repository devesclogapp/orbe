import { ReactNode } from "react";
import {
    BarChart3,
    FileBox,
    CheckSquare,
    LogOut,
    MessageSquare,
    Building2,
    Bell
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PortalShellProps {
    children: ReactNode;
    title: string;
}

const PortalShell = ({ children, title }: PortalShellProps) => {
    const location = useLocation();

    const menuItems = [
        { label: "Dashboard", icon: <BarChart3 className="w-5 h-5" />, path: "/cliente/dashboard" },
        { label: "Relatórios", icon: <FileBox className="w-5 h-5" />, path: "/cliente/relatorios" },
        { label: "Aprovações", icon: <CheckSquare className="w-5 h-5" />, path: "/cliente/aprovacoes" },
    ];

    return (
        <div className="flex bg-background min-h-screen text-foreground font-sans">
            {/* Sidebar do Portal */}
            <aside className="w-64 bg-card border-r border-border flex flex-col fixed h-full z-20">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">O</div>
                        <span className="font-bold text-xl tracking-tight">ORBE <span className="text-brand">CLIENTE</span></span>
                    </div>

                    <div className="bg-muted/30 p-3 rounded-xl mb-8 flex items-center gap-3 border border-border/50">
                        <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>CL</AvatarFallback>
                        </Avatar>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">Logística Global SA</p>
                            <p className="text-xs text-muted-foreground truncate">Sessão: 2024.04</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${location.pathname === item.path
                                    ? "bg-primary/5 text-primary shadow-[inset_3px_0_0_0_theme(colors.primary.DEFAULT)]"
                                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 space-y-4">
                    <div className="bg-info-soft/10 p-4 rounded-xl border border-info/20">
                        <div className="flex items-center gap-2 text-info-strong mb-2">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Suporte</span>
                        </div>
                        <p className="text-xs text-info mb-3">Dúvidas sobre o faturamento?</p>
                        <button className="w-full py-2 bg-card text-info-strong text-xs font-bold rounded-lg border border-info/30 shadow-sm hover:bg-info/10 transition-colors">
                            Falar com o Gestor
                        </button>
                    </div>

                    <button className="w-full flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors text-sm font-medium px-4 py-2">
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 pb-12">
                <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
                    <h1 className="text-lg font-bold text-foreground">{title}</h1>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-muted-foreground hover:bg-muted/30 rounded-full relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
                        </button>
                        <div className="h-8 w-px bg-border mx-1"></div>
                        <div className="flex items-center gap-3">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-gray-600">Matriz Campinas</span>
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default PortalShell;
