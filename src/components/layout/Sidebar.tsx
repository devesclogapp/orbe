import { LayoutDashboard, ClipboardCheck, Users, Building2, Cpu, Download, AlertTriangle, CalendarCheck, BarChart3, Settings, FilePlus, UploadCloud, ExternalLink, Clock, UserCheck, Shield, ListChecks, Scale, Wallet, FileCheck, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui/Logo";

const mainItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/", end: true },
  { icon: ClipboardCheck, label: "Processamento", to: "/processamento" },
  { icon: Download, label: "Importações", to: "/importacoes" },
  { icon: AlertTriangle, label: "Inconsistências", to: "/inconsistencias" },
];

const rhItems = [
  { icon: Users, label: "Colaboradores", to: "/colaboradores" },
  { icon: Building2, label: "Empresas", to: "/empresas" },
  { icon: Cpu, label: "Coletores REP", to: "/coletores" },
];

const finItems = [
  { icon: Wallet, label: "Financeiro Geral", to: "/financeiro", end: true },
  { icon: Scale, label: "Regras de Cálculo", to: "/financeiro/regras" },
  { icon: FileCheck, label: "Faturamento", to: "/financeiro/faturamento" },
  { icon: FilePlus, label: "Remessa CNAB", to: "/financeiro/remessa" },
  { icon: UploadCloud, label: "Retorno Bancário", to: "/financeiro/retorno" },
  { icon: CalendarCheck, label: "Fechamento Mensal", to: "/fechamento" },
  { icon: BarChart3, label: "Relatórios", to: "/relatorios" },
];

const portalItems = [
  { icon: ExternalLink, label: "Portal do Cliente", to: "/cliente/dashboard" },
];

const bhItems = [
  { icon: Clock, label: "Banco de Horas", to: "/banco-horas", end: true },
  { icon: Scale, label: "Regras de Banco", to: "/banco-horas/regras" },
];

const govItems = [
  { icon: UserCheck, label: "Gestão de Usuários", to: "/governanca/usuarios" },
  { icon: Shield, label: "Perfis e Permissões", to: "/governanca/perfis" },
  { icon: ListChecks, label: "Auditoria", to: "/governanca/auditoria" },
];

export const Sidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 flex flex-col items-start">
        <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
      </div>

      <nav className="flex-1 px-2 space-y-4 overflow-y-auto pt-2">
        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Operacional</h3>
          {mainItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Recursos Humanos</h3>
          {rhItems.map(renderItem)}
          {bhItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Controladoria</h3>
          {finItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Governança</h3>
          {govItems.map(renderItem)}
        </div>

        <div>
          <h3 className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Ambiente Externo</h3>
          {portalItems.map(renderItem)}
        </div>
      </nav>

      <div className="px-2 pt-2 border-t border-sidebar-border space-y-1">
        {renderItem({ icon: Settings, label: "Configurações", to: "/configuracoes" })}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left text-red-500 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Sair do sistema</span>
        </button>
      </div>

      <div className="m-3 p-3 rounded-lg bg-background flex items-center gap-3 border border-border">
        <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-display font-semibold text-foreground text-sm">
          {userInitials}
        </div>
        <div className="leading-tight min-w-0 flex-1">
          <div className="font-display font-semibold text-foreground text-sm truncate">{userName}</div>
          <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
        </div>
      </div>

      <div className="px-4 pb-3 text-[11px] text-muted-foreground">
        v4.1 — Relatórios & Integração
      </div>
    </aside>
  );
};

const renderItem = (it: any) => {
  const Icon = it.icon;
  return (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.end}
      className={({ isActive }) =>
        cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left relative",
          isActive
            ? "bg-primary-soft text-primary font-medium"
            : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{it.label}</span>
        </>
      )}
    </NavLink>
  );
};
