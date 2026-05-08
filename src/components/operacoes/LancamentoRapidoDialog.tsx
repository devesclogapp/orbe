import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    TipoServicoOperacionalService,
    ColaboradorService,
    OperacaoProducaoService,
    RegraMarcacaoDiaristaService,
} from "@/services/base.service";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

interface LancamentoRapidoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Marcacao = "P" | "MP" | "F" | "A";

export const LancamentoRapidoDialog = ({ open, onOpenChange }: LancamentoRapidoDialogProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [tipoServico, setTipoServico] = useState("");
    const [colaboradores, setColaboradores] = useState<any[]>([]);
    const [marcacoes, setMarcacoes] = useState<Record<string, Marcacao>>({});

    const { data: tiposServico = [] } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
    });

    const { data: colaboradoresDb = [] } = useQuery({
        queryKey: ["colaboradores_producao"],
        queryFn: () => ColaboradorService.getAllForProducao(),
    });

    const { data: regrasMarcacao = [] } = useQuery({
        queryKey: ["regras_marcacao_diaristas"],
        queryFn: () => RegraMarcacaoDiaristaService.getAll(),
    });

    const handleSelectColaborador = (colabId: string) => {
        const colab = colaboradoresDb.find((c: any) => c.id === colabId);
        if (colab && !colaboradores.some(c => c.id === colabId)) {
            setColaboradores(prev => [...prev, colab]);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!tipoServico) throw new Error("Selecione o tipo de serviço.");
            if (colaboradores.length === 0) throw new Error("Selecione pelo menos um colaborador.");

            const operacao = {
                tipo_servico_id: tipoServico,
                data_operacao: new Date().toISOString().split('T')[0],
                status: "pendente",
                responsavel_id: user?.id,
                quantidade_colaboradores: colaboradores.length,
            };

            const colabs = colaboradores.map(c => ({
                colaborador_id: c.id,
                marcacao: marcacoes[c.id] || "P", // Default to Present
            }));

            // This is a simplified version of the payload.
            // You might need a different service or a more complex payload.
            return OperacaoProducaoService.createWithColaboradores(operacao as any, colabs);
        },
        onSuccess: () => {
            toast.success("Lançamento rápido salvo com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
            onOpenChange(false);
            setStep(1);
            setTipoServico("");
            setColaboradores([]);
            setMarcacoes({});
        },
        onError: (err: any) => toast.error("Erro ao salvar.", { description: err.message }),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Lançamento Rápido</DialogTitle>
                </DialogHeader>

                {step === 1 && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de Serviço</Label>
                            <Select value={tipoServico} onValueChange={setTipoServico}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o serviço" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tiposServico.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Equipe</Label>
                            <Select onValueChange={handleSelectColaborador}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Adicione colaboradores" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradoresDb.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id} disabled={colaboradores.some(colab => colab.id === c.id)}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {colaboradores.map(colab => (
                                    <Badge key={colab.id} variant="secondary" className="flex items-center gap-2">
                                        {colab.nome}
                                        <button onClick={() => setColaboradores(prev => prev.filter(c => c.id !== colab.id))} className="text-muted-foreground hover:text-foreground">
                                            <XCircle className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-3 mb-4">
                            <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <h3 className="text-lg font-semibold">Marcar Presença</h3>
                        </div>
                        <div className="space-y-4">
                            {colaboradores.map(colab => (
                                <div key={colab.id} className="p-4 border rounded-lg">
                                    <p className="font-semibold mb-2">{colab.nome}</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                                        {(regrasMarcacao as any[]).map((regra: any) => {
                                            const isActive = marcacoes[colab.id] === regra.codigo;
                                            return (
                                                <Button
                                                    key={regra.id}
                                                    variant={isActive ? 'default' : 'outline'}
                                                    className={cn(
                                                        "h-12 text-base font-bold transition-all rounded-lg flex-1",
                                                        isActive && regra.codigo === "P" && "bg-green-500 hover:bg-green-600",
                                                        isActive && regra.codigo === "MP" && "bg-yellow-500 hover:bg-yellow-600",
                                                        isActive && (regra.codigo === "F" || regra.codigo === "A") && "bg-red-500 hover:bg-red-600 text-white",
                                                        !isActive && "text-muted-foreground"
                                                    )}
                                                    onClick={() => setMarcacoes(prev => ({ ...prev, [colab.id]: regra.codigo }))}
                                                >
                                                    {regra.codigo}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 1 && (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button onClick={() => setStep(2)} disabled={!tipoServico || colaboradores.length === 0}>Continuar</Button>
                        </>
                    )}
                    {step === 2 && (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? "Salvando..." : "Salvar"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
