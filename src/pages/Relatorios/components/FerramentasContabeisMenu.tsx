import React from "react";
import {
  SlidersHorizontal,
  Activity,
  Clock,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface FerramentasContabeisMenuProps {
  buttonVariant?: "ghost" | "outline" | "secondary";
  buttonClassName?: string;
  align?: "start" | "center" | "end";
}

/**
 * Menu dropdown padronizado de Ferramentas Contábeis da Central de Relatórios.
 * Compartilhado entre a versão clássica (CentralRelatoriosOficial) e a v2.0 (CentralRelatoriosV2).
 * 
 * Governança:
 * - Funcionalidades contábeis não operacionais mantidas em 'Em breve' e desabilitadas.
 * - Central legada mantida como 'Desativada'.
 */
export function FerramentasContabeisMenu({
  buttonVariant = "ghost",
  buttonClassName = "h-8.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground",
  align = "end",
}: FerramentasContabeisMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={buttonVariant} size="sm" className={buttonClassName}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Ferramentas Contábeis</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56 z-50">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Sincronização & Agendamentos
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between">
          <span className="flex items-center">
            <Activity className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Integração Contábil
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
            Em breve
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between">
          <span className="flex items-center">
            <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Agendamentos
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
            Em breve
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between">
          <span className="flex items-center">
            <Layers className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Layouts de Exportação
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
            Em breve
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between">
          <span className="flex items-center">
            <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Mapeamento Contábil
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
            Em breve
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between">
          <span className="flex items-center">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            Logs de Integração
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
            Em breve
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between text-muted-foreground">
          <span className="flex items-center">
            <Clock className="h-3.5 w-3.5 mr-2" />
            Central Legada
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
            Desativada
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FerramentasContabeisMenu;

