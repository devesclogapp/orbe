import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Clock, Plus, RefreshCw } from "lucide-react";

import { usePreferences } from "@/contexts/PreferencesContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PontoTableBlock } from "@/components/ponto/PontoTableBlock";
import { OperacoesTableBlock } from "@/components/operacoes/OperacoesTableBlock";

export const PontoOperacoesBlock = ({
  date,
  empresaId,
  filterOperationsByDate = true,
  lockedTab,
}: {
  date: string;
  empresaId: string;
  filterOperationsByDate?: boolean;
  lockedTab?: "ponto" | "operacoes";
}) => {
  const { defaultTab } = usePreferences();
  const [tab, setTab] = useState<"ponto" | "operacoes">(lockedTab ?? defaultTab);
  const queryClient = useQueryClient();
  const activeTab = lockedTab ?? tab;

  useEffect(() => {
    if (lockedTab) {
      setTab(lockedTab);
    }
  }, [lockedTab]);

  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border gap-4 flex-wrap">
        {lockedTab ? (
          <div className="inline-flex items-center bg-muted rounded-lg p-1">
            <TabButton active icon={lockedTab === "ponto" ? <Clock className="h-3.5 w-3.5" /> : <Boxes className="h-3.5 w-3.5" />}>
              {lockedTab === "ponto" ? "Ponto" : "Operações"}
            </TabButton>
          </div>
        ) : (
          <div className="inline-flex items-center bg-muted rounded-lg p-1">
            <TabButton active={activeTab === "ponto"} onClick={() => setTab("ponto")} icon={<Clock className="h-3.5 w-3.5" />}>
              Ponto
            </TabButton>
            <TabButton active={activeTab === "operacoes"} onClick={() => setTab("operacoes")} icon={<Boxes className="h-3.5 w-3.5" />}>
              Operações
            </TabButton>
          </div>
        )}

        {activeTab === "ponto" ? (
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["ponto", date, empresaId] })}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors group"
          >
            <RefreshCw className="h-3.5 w-3.5 group-active:animate-spin" /> Atualizar dados
          </button>
        ) : (
          <Button size="sm" className="h-8" onClick={() => window.location.href = "/producao"}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova operação
          </Button>
        )}
      </header>

      {activeTab === "ponto" ? (
        <PontoTableBlock date={date} empresaId={empresaId} />
      ) : (
        <OperacoesTableBlock date={date} empresaId={empresaId} filterByDate={filterOperationsByDate} />
      )}
    </section>
  );
};

const TabButton = ({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {children}
  </button>
);
