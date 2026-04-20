import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmpresaService, AIService, ColaboradorService, OperacaoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { RightPanel } from "@/components/layout/RightPanel";
import { MetricCard } from "@/components/painel/MetricCard";
import { PontoOperacoesBlock } from "@/components/painel/PontoOperacoesBlock";
import { ResultadoBlock } from "@/components/painel/ResultadoBlock";
import { StatusIABlock } from "@/components/painel/StatusIABlock";
import { Button } from "@/components/ui/button";
import { Users, Boxes, Wallet, AlertTriangle, Calendar, Building2, PlayCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Processamento = () => {
  const queryClient = useQueryClient();
  const [processingStage, setProcessingStage] = useState<"idle" | "sync" | "ai" | "save" | "done">("idle");
  const today = new Date().toISOString().split('T')[0];

  // Busca a primeira empresa para o processamento (simplificação MVP)
  const { data: empresas = [], isLoading: isLoadingEmpresas, isError: isErrorEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
    retry: 1
  });

  const { data: cols = [], isLoading: isLoadingCols, isError: isErrorCols } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: () => ColaboradorService.getAll(),
    retry: 1
  });

  const { data: ops = [], isLoading: isLoadingOps, isError: isErrorOps } = useQuery({
    queryKey: ["operacoes", today],
    queryFn: () => OperacaoService.getByDate(today),
    retry: 1
  });

  const isLoading = isLoadingEmpresas || isLoadingCols || isLoadingOps;
  const isError = isErrorEmpresas || isErrorCols || isErrorOps;

  const totalCalculado = ops.reduce((acc, op) => acc + (Number(op.quantidade) * Number(op.valor_unitario || 0)), 0);
  const inconsistencias = ops.filter(o => o.status === 'inconsistente').length;

  const mutation = useMutation({
    mutationFn: (empresaId: string) => AIService.processDay(today, empresaId),
    onMutate: () => {
      setProcessingStage("sync");
    },
    onSuccess: (res) => {
      setProcessingStage("done");
      toast.success("Dia processado!", {
        description: `Resultado: R$ ${res.resultado?.[0]?.valor_total_calculado?.toLocaleString('pt-BR') || '0,00'}`
      });
      // Invalida as queries para atualizar os cards e tabelas
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["ponto"] });

      // Volta para idle após um tempo
      setTimeout(() => setProcessingStage("idle"), 3000);
    },
    onError: (err: any) => {
      setProcessingStage("idle");
      toast.error("Erro ao processar", { description: err.message });
    }
  });

  // Simulação de estágios granulares durante o processamento
  useEffect(() => {
    if (mutation.isPending) {
      const timer1 = setTimeout(() => setProcessingStage("ai"), 1500);
      const timer2 = setTimeout(() => setProcessingStage("save"), 3500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [mutation.isPending]);

  const handleProcessar = () => {
    if (empresas.length === 0) {
      toast.error("Nenhuma empresa encontrada");
      return;
    }
    mutation.mutate(empresas[0].id);
  };

  return (
    <AppShell
      title="Painel de Processamento Operacional"
      subtitle={`Validar e processar operações do dia · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      rightPanel={<RightPanel />}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FilterPill icon={Calendar} label={new Date().toLocaleDateString('pt-BR')} />
            <FilterPill icon={Building2} label={empresas[0]?.nome || "Carregando..."} />
          </div>
          <Button
            size="lg"
            className="h-10 px-6 font-display font-semibold"
            onClick={handleProcessar}
            disabled={mutation.isPending}
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
          <div className="flex flex-col items-center justify-center p-20 esc-card">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground animate-pulse">Sincronizando dados operacionais...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card text-center">
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground">Falha na sincronização</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
              Ocorreu um erro ao carregar os dados do dia. Isso pode ser devido a políticas de segurança ou instabilidade na conexão.
            </p>
            <Button onClick={() => queryClient.invalidateQueries()} className="h-10 px-8">
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Colaboradores" value={cols.length.toString()} icon={Users} delta={{ value: "+1", positive: true }} />
              <MetricCard label="Operações" value={ops.length.toString()} icon={Boxes} delta={{ value: "+30%", positive: true }} />
              <MetricCard label="Total do dia" value={`R$ ${totalCalculado.toLocaleString('pt-BR')}`} icon={Wallet} delta={{ value: "+12%", positive: true }} accent />
              <MetricCard label="Inconsistências" value={inconsistencias.toString()} icon={AlertTriangle} delta={{ value: "-2", positive: true }} />
            </div>

            <PontoOperacoesBlock />
            <ResultadoBlock />
            <StatusIABlock stage={processingStage} />
          </>
        )}

        <div className="h-2" />
      </div>
    </AppShell>
  );
};

const FilterPill = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <button className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-card border border-border text-sm text-foreground hover:bg-secondary transition-colors">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    {label}
  </button>
);

export default Processamento;
