import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Calculator,
    CreditCard,
    FilePlus,
    Settings,
    User,
    Users,
    LayoutDashboard,
    ShieldCheck,
    AlertCircle,
    FileBarChart,
    Repeat,
    History,
    HardDrive
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
            <CommandInput placeholder="Digite um comando ou pesquise..." />
            <CommandList>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup heading="Atalhos Principais">
                    <CommandItem {...bindCommand(() => navigate("/"))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/operacional/pontos"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Pontos</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/operacional/operacoes"))}>
                        <Calculator className="mr-2 h-4 w-4" />
                        <span>Operações</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/cadastros"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Central de Cadastros</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/operacional/dashboard"))}>
                        <Calculator className="mr-2 h-4 w-4" />
                        <span>Dashboard Operacional</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/financeiro"))}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Central Financeira</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/bancario"))}>
                        <Repeat className="mr-2 h-4 w-4" />
                        <span>Central Bancária</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/relatorios"))}>
                        <FileBarChart className="mr-2 h-4 w-4" />
                        <span>Central de Relatórios</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/governanca"))}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>Central de Governança</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Acessos Diretos">
                    <CommandItem {...bindCommand(() => navigate("/colaboradores"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Colaboradores</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/cadastros/regras-operacionais"))}>
                        <FilePlus className="mr-2 h-4 w-4" />
                        <span>Regras Operacionais</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/inconsistencias"))}>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        <span>Inconsistências</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/fechamento"))}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>Fechamento</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Financeiro Avançado">
                    <CommandItem {...bindCommand(() => navigate("/financeiro/remessa"))}>
                        <Repeat className="mr-2 h-4 w-4" />
                        <span>CNAB Remessa</span>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/financeiro/retorno"))}>
                        <History className="mr-2 h-4 w-4" />
                        <span>CNAB Retorno</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Configurações">
                    <CommandItem {...bindCommand(() => navigate("/configuracoes?tab=conta"))}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Meu Perfil</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem {...bindCommand(() => navigate("/configuracoes?tab=preferencias"))}>
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
