import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  Clock,
  FileUp,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { PontoTableBlock } from "@/components/ponto/PontoTableBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmpresaService, PontoService } from "@/services/base.service";

type EmpresaOption = {
  id: string;
  nome: string;
};

const MONTH_NAME_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2026, index, 1);
  const labelBase = format(date, "MMMM", { locale: ptBR });
  return {
    value: String(index + 1).padStart(2, "0"),
    label: labelBase.charAt(0).toUpperCase() + labelBase.slice(1),
  };
});

const YEAR_OPTIONS = Array.from(
  new Set(
    Array.from({ length: 24 }, (_, index) =>
      String(startOfMonth(addMonths(new Date(), -index)).getFullYear()),
    ),
  ),
).sort((a, b) => Number(b) - Number(a));

const Pontos = () => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear()),
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState<string>(
    format(new Date(), "MM"),
  );
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");

  const selectedMonth = `${selectedYear}-${selectedMonthNumber}`;
  const selectedDate = useMemo(
    () => new Date(`${selectedMonth}-01T12:00:00`),
    [selectedMonth],
  );
  const monthLabel = format(selectedDate, "MMMM/yyyy", { locale: ptBR });
  const monthLabelCapitalized =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<EmpresaOption[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId("all");
    }
  }, [empresas, selectedEmpresaId]);

  const { data: rows = [], isLoading: isLoadingRows } = useQuery<any[]>({
    queryKey: ["ponto", selectedMonth, selectedEmpresaId],
    queryFn: () =>
      PontoService.getByMonth(
        selectedMonth,
        selectedEmpresaId === "all" ? undefined : selectedEmpresaId,
      ),
    enabled: !!selectedEmpresaId,
  });

  const colaboradoresUnicos = useMemo(
    () => new Set(rows.map((row) => row.colaborador_id).filter(Boolean)).size,
    [rows],
  );

  const inconsistencias = useMemo(
    () => rows.filter((row) => row.status === "inconsistente").length,
    [rows],
  );

  const valorTotal = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.valor_dia || 0), 0),
    [rows],
  );

  const ultimaSincronizacao = rows[0]?.updated_at || rows[0]?.created_at || null;
  const isLoading = isLoadingEmpresas || isLoadingRows;

  return (
    <AppShell
      title="Pontos"
      subtitle={`Base mensal de jornadas coletadas · ${monthLabelCapitalized}`}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Ano" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
                <SelectTrigger className="w-[180px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Mes" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAME_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="w-[280px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Selecione a empresa" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge
                className={cn(
                  "h-10 px-3 rounded-md font-semibold",
                  inconsistencias > 0
                    ? "bg-warning-soft text-warning-strong"
                    : "bg-success-soft text-success-strong",
                )}
              >
                {inconsistencias > 0
                  ? `${inconsistencias} inconsistencia(s) em aberto`
                  : "Base de ponto consistente"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/operacional/dashboard")}>
                <Clock className="mr-2 h-4 w-4" />
                Ver dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/operacional/operacoes")}>
                <FileUp className="mr-2 h-4 w-4" />
                Ir para operacoes
              </Button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 esc-card border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Carregando a base de ponto...
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Colaboradores" value={colaboradoresUnicos.toString()} icon={Users} />
              <MetricCard label="Registros" value={rows.length.toString()} icon={Clock} />
              <MetricCard
                label="Valor do mes"
                value={`R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={Wallet}
                accent
              />
              <MetricCard label="Inconsistencias" value={inconsistencias.toString()} icon={AlertTriangle} />
            </div>

            <section className="esc-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display font-semibold text-foreground">Base mensal de ponto</h2>
                  <p className="text-sm text-muted-foreground">
                    Registros coletados nas empresas e disponibilizados como fonte operacional para o dashboard.
                  </p>
                </div>
                <Badge className="bg-muted text-muted-foreground">
                  {ultimaSincronizacao
                    ? `Ultima sincronizacao ${new Date(ultimaSincronizacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Sem sincronizacao"}
                </Badge>
              </div>

              <PontoTableBlock
                month={selectedMonth}
                monthLabel={monthLabelCapitalized}
                empresaId={selectedEmpresaId}
              />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Pontos;
