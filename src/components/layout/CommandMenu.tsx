import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Calendar,
  CalendarCheck,
  Clock,
  HardDrive,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Package,
  Receipt,
  Settings,
  Shield,
  TrendingUp,
  User,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandMenu({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const bindCommand = (command: () => void) => ({
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => runCommand(command),
    onSelect: () => runCommand(command),
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite um destino ou atalho (ex: Dashboard, Ponto, Receitas)..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* INÍCIO */}
        <CommandGroup heading="Início">
          <CommandItem {...bindCommand(() => navigate("/operacional/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-blue-600" />
            <span>Dashboard Executivo</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/operacional/pipeline"))}>
            <Layers className="mr-2 h-4 w-4 text-blue-600" />
            <span>Torre Operacional</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* OPERAÇÕES DE CAMPO */}
        <CommandGroup heading="Operações de Campo">
          <CommandItem {...bindCommand(() => navigate("/operacoes-volume"))}>
            <Package className="mr-2 h-4 w-4" />
            <span>Operações por Volume</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/operacional/servicos-extras"))}>
            <Wrench className="mr-2 h-4 w-4" />
            <span>Serviços Extras</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/operacional/custos-extras"))}>
            <Wallet className="mr-2 h-4 w-4" />
            <span>Custos Extras</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* PESSOAS & RH */}
        <CommandGroup heading="Pessoas & RH">
          <CommandItem {...bindCommand(() => navigate("/clt/pontos"))}>
            <Clock className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Ponto & Jornadas CLT</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/banco-horas/fechamento"))}>
            <Lock className="mr-2 h-4 w-4" />
            <span>Fechamento Mensal CLT</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/operacional/diaristas"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Diaristas</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/operacional/intermitentes"))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Intermitentes</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* APROVAÇÕES & FECHAMENTO */}
        <CommandGroup heading="Aprovações & Fechamento">
          <CommandItem {...bindCommand(() => navigate("/rh/aprovacoes"))}>
            <Shield className="mr-2 h-4 w-4 text-amber-600" />
            <span>Central de Aprovações</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/inconsistencias"))}>
            <AlertTriangle className="mr-2 h-4 w-4 text-rose-600" />
            <span>Central de Inconsistências</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/fechamento"))}>
            <CalendarCheck className="mr-2 h-4 w-4" />
            <span>Fechamento de Ciclos</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* FINANCEIRO & CONTROLADORIA */}
        <CommandGroup heading="Financeiro & Controladoria">
          <CommandItem {...bindCommand(() => navigate("/financeiro/receitas"))}>
            <Receipt className="mr-2 h-4 w-4" />
            <span>Receitas Operacionais</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/financeiro"))}>
            <Wallet className="mr-2 h-4 w-4" />
            <span>Despesas & Contas a Pagar</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/bancario"))}>
            <Banknote className="mr-2 h-4 w-4" />
            <span>Central Bancária</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/financeiro/inadimplencia"))}>
            <AlertCircle className="mr-2 h-4 w-4 text-rose-600" />
            <span>Inadimplência & Cobrança</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/financeiro/dre"))}>
            <TrendingUp className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Resultado Operacional (DRE)</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* CADASTROS & SISTEMA */}
        <CommandGroup heading="Cadastros & Sistema">
          <CommandItem {...bindCommand(() => navigate("/cadastros"))}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Central de Cadastros</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/cadastros/regras-operacionais"))}>
            <Wrench className="mr-2 h-4 w-4" />
            <span>Regras & Tabelas Operacionais</span>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/configuracoes"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Preferências</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem {...bindCommand(() => navigate("/governanca/auditoria"))}>
            <HardDrive className="mr-2 h-4 w-4" />
            <span>Logs de Auditoria</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
