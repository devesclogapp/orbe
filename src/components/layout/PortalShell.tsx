import React, { ReactNode, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  LogOut,
  Building2,
  Bell,
  ArrowLeft,
  Shield,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { ContextualHelpButton } from "@/components/help/ContextualHelpButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PortalShellProps {
  children: ReactNode;
  title: string;
}

const PortalShell = ({ children, title }: PortalShellProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const {
    cliente,
    isInternalUser,
    userRole,
    adminEmpresas,
    selectedAdminEmpresaId,
    setSelectedAdminEmpresaId,
  } = useClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    {
      label: "Dashboard",
      icon: <BarChart3 className="w-5 h-5 shrink-0" />,
      path: "/cliente/dashboard",
    },
    {
      label: "Consultar Operações",
      icon: <ClipboardList className="w-5 h-5 shrink-0" />,
      path: "/cliente/operacoes",
    },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = cliente?.nome
    ? cliente.nome
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : isInternalUser
      ? "AD"
      : "CL";

  const displayName = cliente?.nome || (isInternalUser ? "Modo Administrativo" : "Carregando...");
  const displaySubtitle = isInternalUser
    ? "Visualização Administrativa"
    : "Empresa Contratante";

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      {/* Barra de Aviso para Visualização Administrativa */}
      {isInternalUser && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Visualização Administrativa
            </span>
            <span className="hidden sm:inline text-muted-foreground">—</span>
            <span className="hidden sm:inline text-muted-foreground">
              Você está visualizando a interface exatamente como a empresa contratante a vê.
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">Empresa:</span>
              <Select
                value={selectedAdminEmpresaId || ""}
                onValueChange={(val) => setSelectedAdminEmpresaId(val)}
              >
                <SelectTrigger className="h-7 w-[200px] text-xs bg-background border-border">
                  <SelectValue placeholder="Selecione empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {adminEmpresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs font-semibold border-amber-300 dark:border-amber-700 bg-background"
              onClick={() => navigate("/central")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao ERP
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar Desktop */}
        <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col fixed top-0 bottom-0 z-20 overflow-y-auto">
          <div className="p-5 flex flex-col flex-1">
            <div className="mb-6 flex flex-col items-start px-2">
              <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
            </div>

            {/* Identidade da empresa contratante */}
            <div className="bg-muted/30 p-3 rounded-2xl mb-6 flex items-center gap-3 border border-border/50">
              <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                <AvatarFallback
                  className={`text-sm font-bold ${
                    isInternalUser
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate text-foreground" title={displayName}>
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{displaySubtitle}</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {menuItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path === "/cliente/operacoes" &&
                    location.pathname === "/cliente/relatorios");

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-6 space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs mb-1">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>ESC LOG Operações</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dúvidas sobre apontamentos ou operações? Contate seu gestor operacional ESC LOG.
                </p>
              </div>

              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm font-medium px-4"
              >
                <LogOut className="w-4 h-4" /> Sair da conta
              </Button>
            </div>
          </div>
        </aside>

        {/* Sidebar Mobile Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-background/80 backdrop-blur-sm flex">
            <div className="w-72 bg-card border-r border-border p-6 flex flex-col h-full shadow-xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between mb-6">
                <Logo className="w-28" align="left" showSlogan sloganSize="xs" />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="bg-muted/30 p-3 rounded-2xl mb-6 flex items-center gap-3 border border-border">
                <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold truncate text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{displaySubtitle}</p>
                </div>
              </div>

              <nav className="space-y-1.5">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                      location.pathname === item.path
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto pt-6">
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" /> Sair
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <main className="md:ml-64 flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate">{title}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/20 text-xs font-medium text-muted-foreground">
                <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[200px]">{displayName}</span>
              </div>
              <ContextualHelpButton
                showLabel={false}
                variant="outline"
                className="h-8 w-8 p-0 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
              />
            </div>
          </header>

          <div className="p-4 sm:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PortalShell;
