import React from "react";
import { useNavigate } from "react-router-dom";
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
import { useAccessControl } from "@/contexts/AccessControlContext";
import { normalizeRole } from "@/lib/access-control";

interface FerramentasContabeisMenuProps {
  buttonVariant?: "ghost" | "outline" | "secondary";
  buttonClassName?: string;
  align?: "start" | "center" | "end";
  empresaId?: string;
  competencia?: string;
}

/**
 * Menu dropdown padronizado de Ferramentas Contábeis da Central de Relatórios.
 * Compartilhado entre a versão clássica (CentralRelatoriosOficial), v2.0 (CentralRelatoriosV2) e telas contábeis.
 * 
 * Governança (CONT-08):
 * - Altura padrão de 36px (h-9), ícones 16px (h-4 w-4) e tipografia Inter média.
 * - Para o perfil Contador, oculta o dropdown redundante, pois as cinco ferramentas já estão fixas na sidebar.
 * - Preservado para Admin e Financeiro.
 */
export function FerramentasContabeisMenu({
  buttonVariant = "outline",
  buttonClassName = "h-9 px-3 gap-2 text-sm font-medium text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted/50",
  align = "end",
  empresaId,
  competencia,
}: FerramentasContabeisMenuProps) {
  const navigate = useNavigate();

  let isContador = false;
  try {
    const access = useAccessControl();
    isContador = normalizeRole(access?.role) === "contador";
  } catch {
    isContador = false;
  }

  // CONT-08: Oculta o dropdown redundante para o Contador (sidebar já contém as 5 ferramentas)
  if (isContador) {
    return null;
  }

  const handleNavigate = (path: string) => {
    const params = new URLSearchParams();
    if (empresaId) params.set("empresa_id", empresaId);
    if (competencia) params.set("competencia", competencia);
    const qs = params.toString();
    navigate(`${path}${qs ? `?${qs}` : ""}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={buttonVariant} size="sm" className={buttonClassName}>
          <SlidersHorizontal className="h-4 w-4" />
          <span>Ferramentas Contábeis</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64 z-50">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Sincronização & Agendamentos
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Integração Contábil */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between text-foreground hover:bg-muted text-sm font-medium py-2"
          onClick={() => handleNavigate("/relatorios/integracao")}
        >
          <span className="flex items-center">
            <Activity className="h-4 w-4 mr-2 text-primary" />
            Integração Contábil
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold text-primary border-primary/30">
            Ativo
          </Badge>
        </DropdownMenuItem>

        {/* Agendamentos */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between text-foreground hover:bg-muted text-sm font-medium py-2"
          onClick={() => handleNavigate("/relatorios/agendamentos")}
        >
          <span className="flex items-center">
            <Clock className="h-4 w-4 mr-2 text-primary" />
            Agendamentos
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold text-primary border-primary/30">
            Ativo
          </Badge>
        </DropdownMenuItem>

        {/* Layouts de Exportação */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between text-foreground hover:bg-muted text-sm font-medium py-2"
          onClick={() => handleNavigate("/relatorios/layouts")}
        >
          <span className="flex items-center">
            <Layers className="h-4 w-4 mr-2 text-primary" />
            Layouts de Exportação
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold text-primary border-primary/30">
            Ativo
          </Badge>
        </DropdownMenuItem>

        {/* Mapeamento Contábil */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between text-foreground hover:bg-muted text-sm font-medium py-2"
          onClick={() => handleNavigate("/relatorios/mapeamento")}
        >
          <span className="flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
            Mapeamento Contábil
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold text-primary border-primary/30">
            Ativo
          </Badge>
        </DropdownMenuItem>

        {/* Logs de Integração */}
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between text-foreground hover:bg-muted text-sm font-medium py-2"
          onClick={() => handleNavigate("/relatorios/integracao/logs")}
        >
          <span className="flex items-center">
            <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" />
            Logs de Integração
          </span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold text-primary border-primary/30">
            Ativo
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled className="cursor-not-allowed opacity-60 flex items-center justify-between text-muted-foreground text-sm py-2">
          <span className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
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
