import React from "react";
import { Sparkles, Calendar, Building2, RefreshCw, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MOCK_EMPRESAS_OPTIONS,
  MOCK_COMPETENCIAS_OPTIONS,
} from "@/pages/UxLab/mockData";
import { useUxLabTheme } from "./UxLabThemeContext";

interface UxLabTopbarProps {
  title: string;
  subtitle?: string;
  competencia: string;
  onCompetenciaChange: (val: string) => void;
  empresa: string;
  onEmpresaChange: (val: string) => void;
  onRefresh?: () => void;
}

export const UxLabTopbar: React.FC<UxLabTopbarProps> = ({
  title,
  subtitle,
  competencia,
  onCompetenciaChange,
  empresa,
  onEmpresaChange,
  onRefresh,
}) => {
  const { toggleTheme, isDark } = useUxLabTheme();

  return (
    <header className="sticky top-0 z-30 flex flex-col justify-center border-b border-border bg-card/95 dark:bg-[#0D1014]/95 dark:border-white/[0.04] px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 transition-colors duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Título e Identificação do Módulo */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-blue-500/40 bg-blue-50 dark:bg-white/[0.04] text-blue-700 dark:text-blue-400 dark:border-blue-500/30 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              UX LAB · PROTÓTIPO
            </Badge>
            <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
              Ambiente de Homologação Visual
            </span>
          </div>
          <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground md:text-2xl truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Controles de Contexto: Empresa, Mês/Competência, Alternador Light/Dark e Ações */}
        <div className="flex flex-wrap items-center gap-2 p-1 rounded-lg dark:bg-[#111419] dark:border dark:border-white/[0.04]">
          {/* Seletor de Empresa / Unidade */}
          <div className="w-[190px] sm:w-[210px]">
            <Select value={empresa} onValueChange={onEmpresaChange}>
              <SelectTrigger className="h-8 text-xs font-medium bg-card text-foreground border-border dark:border-white/[0.05] dark:bg-[#15191F] dark:text-[#F1F3F5]">
                <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecione Unidade" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border dark:border-white/[0.06] dark:bg-[#1A1F27]">
                {MOCK_EMPRESAS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de Competência */}
          <div className="w-[160px] sm:w-[180px]">
            <Select value={competencia} onValueChange={onCompetenciaChange}>
              <SelectTrigger className="h-8 text-xs font-medium bg-card text-foreground border-border dark:border-white/[0.05] dark:bg-[#15191F] dark:text-[#F1F3F5]">
                <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border dark:border-white/[0.06] dark:bg-[#1A1F27]">
                {MOCK_COMPETENCIAS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Controle Discreto de Tema Light / Dark (V3.1+) */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border dark:border-white/[0.05] dark:bg-[#15191F] dark:text-[#A0A7B2] dark:hover:text-[#F1F3F5] hover:bg-muted/50 dark:hover:bg-[#1A1F27]"
            title={isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
            aria-label={isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform duration-200 hover:rotate-45" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300 transition-transform duration-200 hover:-rotate-12" />
            )}
            <span className="hidden lg:inline text-[11px] font-medium ml-1.5">
              {isDark ? "Claro" : "Escuro"}
            </span>
          </Button>

          {/* Botão de Atualizar / Simular Recarga */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border dark:border-white/[0.05] dark:bg-[#15191F] dark:text-[#A0A7B2] dark:hover:text-[#F1F3F5] hover:bg-muted/50 dark:hover:bg-[#1A1F27]"
            title="Recarregar dados demonstrativos"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
