import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { BHEventoService } from "@/services/v4.service";

const formatTotal = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
};

const PainelGeral = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: "",
    empresa_id: "all",
    status: "all",
    showWithoutMovement: false,
  });

  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ["bh_saldos", filters.showWithoutMovement],
    queryFn: () =>
      BHEventoService.getSaldosGerais({
        includeWithoutMovement: filters.showWithoutMovement,
      }),
  });

  const empresas = Array.from(new Set(saldos.map((saldo: any) => saldo.empresa).filter(Boolean))) as string[];

  const filteredSaldos = saldos.filter((saldo: any) => {
    const search = filters.search.toLowerCase();
    const matchesSearch =
      saldo.nome?.toLowerCase().includes(search) ||
      saldo.matricula?.toLowerCase().includes(search);
    const matchesEmpresa = filters.empresa_id === "all" || saldo.empresa === filters.empresa_id;
    const matchesStatus = filters.status === "all" || saldo.status === filters.status;

    return matchesSearch && matchesEmpresa && matchesStatus;
  });

  const totalMinutosAcumulados = filteredSaldos.reduce(
    (acc, saldo: any) => acc + (saldo.saldo_minutos > 0 ? saldo.saldo_minutos : 0),
    0,
  );
  const totalMinutosAVencer = filteredSaldos.reduce(
    (acc, saldo: any) => acc + (saldo.minutos_a_vencer_30d || 0),
    0,
  );
  const colaboradoresEmRisco = filteredSaldos.filter((saldo: any) => saldo.status === "critico").length;

  const handleExport = () => {
    toast.info("Gerando relatorio para exportacao", {
      description: "O layout CSV sera baixado em instantes.",
    });

    const headers = ["Colaborador", "Matricula", "Empresa", "Saldo (Minutos)", "Status"];
    const rows = filteredSaldos.map((saldo: any) => [
      saldo.nome,
      saldo.matricula,
      saldo.empresa,
      saldo.saldo_minutos,
      saldo.status,
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", `banco-horas-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = [
    {
      label: "Total Acumulado",
      value: isLoading ? "..." : formatTotal(totalMinutosAcumulados),
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary-soft",
    },
    {
      label: "Prestes a Vencer (30d)",
      value: isLoading ? "..." : formatTotal(totalMinutosAVencer),
      icon: AlertCircle,
      color: "text-warning",
      bg: "bg-warning-soft",
    },
    {
      label: "Colaboradores em Risco",
      value: isLoading ? "..." : colaboradoresEmRisco.toString(),
      icon: Users,
      color: "text-error",
      bg: "bg-destructive-soft",
    },
  ];

  const emptyMessage =
    saldos.length === 0
      ? "Nenhum saldo de banco de horas encontrado para este periodo."
      : "Nenhum colaborador encontrado com os filtros atuais.";

  return (
    <AppShell title="Banco de Horas" subtitle="Painel geral de saldos e compensacoes">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="esc-card flex items-start justify-between p-5">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <h3 className="font-display text-2xl font-bold text-foreground">{stat.value}</h3>
              </div>
              <div className={cn("rounded-lg p-2", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex w-full flex-1 flex-col gap-3 md:w-auto">
            <div className="flex items-center gap-3">
              <Switch
                checked={filters.showWithoutMovement}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({ ...current, showWithoutMovement: checked }))
                }
                aria-label="Mostrar colaboradores sem movimento"
              />
              <span className="text-sm text-muted-foreground">
                Mostrar colaboradores sem movimento
              </span>
            </div>

            <div className="flex w-full flex-1 gap-2 md:w-auto">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar colaborador..."
                  className="h-9 pl-9"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
              </div>

              <Select
                value={filters.empresa_id}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, empresa_id: value }))
                }
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa} value={empresa}>
                      {empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="positivo">Positivo</SelectItem>
                  <SelectItem value="critico">Critico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["bh_saldos"] })}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <section className="esc-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="h-11 px-5 font-medium">Colaborador</th>
                  <th className="h-11 px-3 font-medium">Empresa</th>
                  <th className="h-11 px-3 text-center font-medium">Saldo Atual</th>
                  <th className="h-11 px-3 text-center font-medium">Vencido</th>
                  <th className="h-11 px-3 text-center font-medium">A Vencer</th>
                  <th className="h-11 px-5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSaldos.map((saldo: any) => (
                  <tr key={saldo.id} className="group border-t border-muted hover:bg-background">
                    <td className="h-[52px] px-5">
                      <Link to={`/banco-horas/extrato/${saldo.id}`} className="hover:underline">
                        <div className="font-medium text-foreground">{saldo.nome}</div>
                        <div className="text-xs text-muted-foreground">Mat. {saldo.matricula}</div>
                      </Link>
                    </td>
                    <td className="px-3 text-muted-foreground">{saldo.empresa || "-"}</td>
                    <td className="px-3 text-center">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 font-display font-semibold",
                          saldo.saldo_minutos > 0
                            ? "text-success"
                            : saldo.saldo_minutos < 0
                              ? "text-error"
                              : "text-muted-foreground",
                        )}
                      >
                        {saldo.saldo_minutos > 0 && <ArrowUpRight className="h-3 w-3" />}
                        {saldo.saldo_minutos < 0 && <ArrowDownRight className="h-3 w-3" />}
                        {saldo.saldo_formatado}
                      </div>
                    </td>
                    <td className="px-3 text-center font-display font-medium text-error">
                      {saldo.vencido_formatado || "0h 0m"}
                    </td>
                    <td className="px-3 text-center font-display text-muted-foreground">
                      {saldo.a_vencer_formatado || "0h 0m"}
                    </td>
                    <td className="px-5 text-center">
                      <StatusChip status={saldo.status} />
                    </td>
                  </tr>
                ))}

                {filteredSaldos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center italic text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppShell>
  );
};

export default PainelGeral;
