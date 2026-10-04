import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Building2,
  Lock,
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RELATORIOS_CATALOGO, ReportMeta } from "./relatoriosMockData";

export default function UxLabRelatoriosHub() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReports = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return RELATORIOS_CATALOGO;
    return RELATORIOS_CATALOGO.filter(
      (r) =>
        r.title.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term) ||
        r.code.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const categories = ["OPERACIONAL", "PESSOAS & RH", "FINANCEIRO & FATURAMENTO"] as const;

  const handleSidebarSelect = (id: string, label: string) => {
    if (id === "relatorios") return;
    if (id === "dashboard") {
      navigate("/ux-lab");
      return;
    }
    if (id === "torre-operacional") {
      navigate("/ux-lab/torre");
      return;
    }
    if (id === "operacoes-volume") {
      navigate("/ux-lab/operacoes-volume");
      return;
    }
    if (id === "dre") {
      navigate("/ux-lab/dre");
      return;
    }
    toast.info(`Módulo em planejamento: ${label}`, {
      description: "Este módulo especialista será prototipado em sua própria fase do UX Lab.",
    });
  };

  return (
    <UxLabShell
      activeItem="relatorios"
      onSelectItem={handleSidebarSelect}
      title="Central de Relatórios"
      subtitle="Consulte, filtre e exporte informações consolidadas dos diferentes módulos do ORBE"
    >
      <div className="max-w-[1360px] mx-auto space-y-8 pb-16">
        {/* Cabeçalho da Central / Busca */}
        <section className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-3 w-3" />
                <span>Consulta Parametrizada & Extração</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground font-display">
                Catálogo de Relatórios Oficiais
              </h2>
              <p className="text-xs text-muted-foreground">
                Selecione o relatório para definir a empresa, o período e os parâmetros de extração.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar por código, nome ou palavra-chave..."
                className="pl-9 h-10 bg-background text-xs focus-visible:ring-2 focus-visible:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Buscar relatórios por código, título ou palavra-chave"
              />
            </div>
          </div>
        </section>

        {/* Listagem por Domínios */}
        <div className="space-y-8">
          {categories.map((category) => {
            const reportsInCategory = filteredReports.filter((r) => r.category === category);
            if (reportsInCategory.length === 0) return null;

            return (
              <section key={category} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {category}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                      {reportsInCategory.length}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {reportsInCategory.map((report) => (
                    <ReportRowItem
                      key={report.id}
                      report={report}
                      onOpen={() => navigate(`/ux-lab/relatorios/${report.id}`)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filteredReports.length === 0 && (
            <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground space-y-2">
              <FileSpreadsheet className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum relatório encontrado para "{searchTerm}"</p>
              <Button variant="link" size="sm" onClick={() => setSearchTerm("")}>
                Limpar busca
              </Button>
            </div>
          )}
        </div>
      </div>
    </UxLabShell>
  );
}

function ReportRowItem({
  report,
  onOpen,
}: {
  report: ReportMeta;
  onOpen: () => void;
}) {
  const isReady = report.status === "ready";

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Abrir relatório ${report.code} — ${report.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/70 bg-card hover:bg-accent/40 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/40 transition-all cursor-pointer gap-4 shadow-2xs"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/60 group-hover:border-primary/30 transition-colors">
          <span className="font-mono text-xs font-bold text-foreground">
            {report.code}
          </span>
        </div>

        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
              {report.title}
            </h4>
            {!isReady && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60 bg-muted/40">
                Em Preparação
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {report.description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
        <div className="flex items-center gap-1.5">
          {report.outputFormats.map((fmt) => (
            <span
              key={fmt}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 text-muted-foreground font-semibold"
            >
              {fmt}
            </span>
          ))}
        </div>

        <div className="flex items-center text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform">
          <span>Abrir</span>
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </div>
      </div>
    </div>
  );
}
