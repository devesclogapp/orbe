import React, { ReactNode } from "react";
import { UxLabSidebar } from "./UxLabSidebar";
import { UxLabTopbar } from "./UxLabTopbar";
import { UxLabThemeProvider } from "./UxLabThemeContext";

interface UxLabShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  activeItem?: string;
  activeSidebarItem?: string;
  onSelectItem?: (id: string, label: string) => void;
  onSelectSidebarItem?: (id: string, label: string) => void;
  competencia?: string;
  onCompetenciaChange?: (val: string) => void;
  empresa?: string;
  onEmpresaChange?: (val: string) => void;
  onRefresh?: () => void;
}

export const UxLabShell: React.FC<UxLabShellProps> = ({
  children,
  title,
  subtitle,
  activeItem,
  activeSidebarItem,
  onSelectItem,
  onSelectSidebarItem,
  competencia = "2026-10",
  onCompetenciaChange = () => {},
  empresa = "all",
  onEmpresaChange = () => {},
  onRefresh,
}) => {
  const resolvedActiveItem = activeItem || activeSidebarItem || "dashboard";
  const resolvedOnSelectItem = onSelectItem || onSelectSidebarItem;
  return (
    <UxLabThemeProvider>
      <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200">
        {/* Sidebar Experimental */}
        <UxLabSidebar activeItem={resolvedActiveItem} onSelectItem={resolvedOnSelectItem} />

        {/* Conteúdo Principal com Topbar */}
        <div className="flex flex-1 flex-col min-w-0">
          <UxLabTopbar
            title={title}
            subtitle={subtitle}
            competencia={competencia}
            onCompetenciaChange={onCompetenciaChange}
            empresa={empresa}
            onEmpresaChange={onEmpresaChange}
            onRefresh={onRefresh}
          />

          {/* Área de Trabalho com Densidade Otimizada (1366x768 / 1440+) */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="mx-auto max-w-[1560px] w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </UxLabThemeProvider>
  );
};
