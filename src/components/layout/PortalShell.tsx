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
        <div className="flex bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
            {/* Sidebar do Portal */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 bg-[#FD4C00] rounded-lg flex items-center justify-center text-white font-bold">O</div>
                        <span className="font-bold text-xl tracking-tight">ORBE <span className="text-[#FD4C00]">CLIENTE</span></span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl mb-8 flex items-center gap-3 border border-slate-100">
                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>CL</AvatarFallback>
                        </Avatar>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">Logística Global SA</p>
                            <p className="text-xs text-slate-400 truncate">Sessão: 2024.04</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${location.pathname === item.path
                                        ? "bg-[#FD4C00]/5 text-[#FD4C00] shadow-[inset_3px_0_0_0_#FD4C00]"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Suporte</span>
                        </div>
                        <p className="text-xs text-blue-600 mb-3">Dúvidas sobre o faturamento?</p>
                        <button className="w-full py-2 bg-white text-blue-700 text-xs font-bold rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50 transition-colors">
                            Falar com o Gestor
                        </button>
                    </div>

                    <button className="w-full flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium px-4 py-2">
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 pb-12">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h1 className="text-lg font-bold text-slate-800">{title}</h1>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-full relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-1"></div>
                        <div className="flex items-center gap-3">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-600">Matriz Campinas</span>
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
