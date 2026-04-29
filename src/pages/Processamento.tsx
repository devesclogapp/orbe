import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmpresaService, AIService, ColaboradorService, OperacaoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { RightPanel } from "@/components/layout/RightPanel";
import { MetricCard } from "@/components/painel/MetricCard";
import { PontoOperacoesBlock } from "@/components/painel/PontoOperacoesBlock";
import { ResultadoBlock } from "@/components/painel/ResultadoBlock";
import { StatusIABlock } from "@/components/painel/StatusIABlock";
import { Button } from "@/components/ui/button";
import { Users, Boxes, Wallet, AlertTriangle, Calendar as CalendarIcon, Building2, PlayCircle, RefreshCw, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const Processamento = () => {
  const queryClient = useQueryClient();
  const [processingStage, setProcessingStage] = useState<"idle" | "sync" | "ai" | "save" | "done">("idle");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");

  const dateValue = format(selectedDate, "yyyy-MM-dd");

  // Busca empresas para o filtro
  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<any[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  // Define a empresa inicial assim que os dados carregarem (Todas por padrão)
  useMemo(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId("all");
    }
  }, [empresas, selectedEmpresaId]);

  const { data: cols = [], isLoading: isLoadingCols } = useQuery<any[]>({
    queryKey: ["colaboradores", selectedEmpresaId],
    queryFn: () => ColaboradorService.getWithEmpresa(selectedEmpresaId === 'all' ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId
  });

  const { data: ops = [], isLoading: isLoadingOps } = useQuery<any[]>({
    queryKey: ["operacoes", dateValue, selectedEmpresaId],
    queryFn: () => OperacaoService.getPainelByDate(dateValue, selectedEmpresaId === 'all' ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId
  });

  const isLoading = isLoadingEmpresas || isLoadingCols || isLoadingOps;

  const totalCalculado = ops.reduce((acc, op) => acc + Number(op.valor_total_label ?? (Number(op.quantidade) * Number(op.valor_unitario || 0))), 0);
  const inconsistencias = ops.filter(o => o.status === 'inconsistente').length;

  const mutation = useMutation({
    mutationFn: (empresaId: string) => AIService.processDay(dateValue, empresaId),
    onMutate: () => {
      setProcessingStage("ai");
    },
    onSuccess: (res) => {
      setProcessingStage("done");
      toast.success("Dia processado!", {
        description: `Resultado: R$ ${res.resultado?.[0]?.valor_total_calculado?.toLocaleString('pt-BR') || '0,00'}`
      });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["ponto"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_mensais"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_processamento"] });

      setTimeout(() => setProcessingStage("idle"), 3000);
    },
    onError: (err: any) => {
      setProcessingStage("idle");
      toast.error("Erro ao processar", { description: err.message });
    }
  });

  const handleProcessar = () => {
    if (!selectedEmpresaId || selectedEmpresaId === 'all') {
      toast.warning("Selecione uma empresa específica", {
        description: "O processamento precisa de uma unidade operacional definida."
      });
      return;
    }
    mutation.mutate(selectedEmpresaId);
  };

  const selectedEmpresaNome = useMemo(() =>
    empresas.find(e => e.id === selectedEmpresaId)?.nome || "Selecionar empresa"
    , [empresas, selectedEmpresaId]);

  return (
    <AppShell
      title="Painel de Processamento Operacional"
      subtitle={`Validar e processar operações do dia · ${format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
      rightPanel={<RightPanel />}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Filtro de Data */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal h-10 px-4 esc-card-hover border-border border",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {/* Filtro de Empresa */}
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="w-[280px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <SelectValue placeholder="Selecione a empresa" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="lg"
            className="h-10 px-6 font-display font-semibold shadow-lg shadow-primary/20"
            onClick={handleProcessar}
            disabled={mutation.isPending || isLoading}
          >
            {mutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            {mutation.isPending ? "Processando..." : "Processar dia"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 esc-card border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Sincronizando dados operacionais...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Colaboradores" value={cols.length.toString()} icon={Users} />
              <MetricCard label="Operações" value={ops.length.toString()} icon={Boxes} />
              <MetricCard label="Total do dia" value={`R$ ${totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} accent />
              <MetricCard label="Inconsistências" value={inconsistencias.toString()} icon={AlertTriangle} delta={{ value: inconsistencias > 0 ? "Atenção" : "OK", positive: inconsistencias === 0 }} />
            </div>

            <PontoOperacoesBlock date={dateValue} empresaId={selectedEmpresaId} />
            <ResultadoBlock date={dateValue} empresaId={selectedEmpresaId} />
            <StatusIABlock stage={processingStage} />
          </>
        )}

        <div className="h-2" />
      </div>
    </AppShell>
  );
};

export default Processamento;
