import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    Users,
    LayoutDashboard,
    FileText,
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

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Digite um comando ou pesquise..." />
            <CommandList>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup heading="Atalhos Principais">
                    <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/colaboradores"))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Colaboradores</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/processamento"))}>
                        <Calculator className="mr-2 h-4 w-4" />
                        <span>Processamento</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/financeiro"))}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Financeiro</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Operacional">
                    <CommandItem onSelect={() => runCommand(() => navigate("/inconsistencias"))}>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        <span>Inconsistências</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/fechamento"))}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>Fechamento</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/relatorios"))}>
                        <FileBarChart className="mr-2 h-4 w-4" />
                        <span>Relatórios</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Financeiro Avançado">
                    <CommandItem onSelect={() => runCommand(() => navigate("/financeiro/remessa"))}>
                        <Repeat className="mr-2 h-4 w-4" />
                        <span>CNAB Remessa</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/financeiro/retorno"))}>
                        <History className="mr-2 h-4 w-4" />
                        <span>CNAB Retorno</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Configurações">
                    <CommandItem onSelect={() => runCommand(() => navigate("/configuracoes?tab=conta"))}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Meu Perfil</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/configuracoes"))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configurações do Sistema</span>
                        <CommandShortcut>⌘S</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate("/governanca/auditoria"))}>
                        <HardDrive className="mr-2 h-4 w-4" />
                        <span>Logs de Auditoria</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
