import { useState } from "react";
import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Info,
    ChevronRight,
    MessageSquare,
    History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalService } from "@/services/financial.service";

const ClientApprovals = () => {
    const queryClient = useQueryClient();
    const [rejectionId, setRejectionId] = useState<string | null>(null);
    const [rejectionMotivo, setRejectionMotivo] = useState("");

    const { data: pendentes = [], isLoading } = useQuery({
        queryKey: ["portal_faturas_pendentes"],
        queryFn: () => PortalService.getFaturasPendentes(),
    });

    const { data: historico = [] } = useQuery({
        queryKey: ["portal_historico_faturas"],
        queryFn: () => PortalService.getHistoricoFaturas(),
    });

    const aprovaMutation = useMutation({
        mutationFn: (id: string) => PortalService.aprovarFatura(id),
        onSuccess: () => {
            toast.success("Faturamento aprovado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["portal_faturas_pendentes"] });
            queryClient.invalidateQueries({ queryKey: ["portal_historico_faturas"] });
            queryClient.invalidateQueries({ queryKey: ["portal_stats"] });
        },
        onError: () => toast.error("Erro ao aprovar. Tente novamente."),
    });

    const rejeitaMutation = useMutation({
        mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
            PortalService.rejeitarFatura(id, motivo),
        onSuccess: () => {
            toast.success("Revisão solicitada com sucesso.");
            setRejectionId(null);
            setRejectionMotivo("");
            queryClient.invalidateQueries({ queryKey: ["portal_faturas_pendentes"] });
            queryClient.invalidateQueries({ queryKey: ["portal_historico_faturas"] });
            queryClient.invalidateQueries({ queryKey: ["portal_stats"] });
        },
        onError: () => toast.error("Erro ao solicitar revisão. Tente novamente."),
    });

    const handleRejeitar = (id: string) => {
        if (!rejectionMotivo.trim()) {
            toast.error("Informe o motivo da revisão.");
            return;
        }
        rejeitaMutation.mutate({ id, motivo: rejectionMotivo });
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const statusIcon: Record<string, React.ReactNode> = {
        aprovado: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
        rejeitado: <XCircle className="w-3.5 h-3.5 text-destructive" />,
        pago: <CheckCircle2 className="w-3.5 h-3.5 text-info" />,
    };

    return (
        <PortalShell title="Aprovações Pendentes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Items pendentes */}
                <div className="lg:col-span-2 space-y-6">
                    {isLoading ? (
                        <div className="text-center py-20 text-muted-foreground text-sm">Carregando...</div>
                    ) : pendentes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/50">
                            <CheckCircle2 className="w-16 h-16 mb-4 opacity-10" />
                            <p className="font-bold text-foreground">Nada para aprovar no momento!</p>
                            <p className="text-sm">Você está em dia com suas validações.</p>
                        </div>
                    ) : (
                        pendentes.map((item: any) => (
                            <Card key={item.id} className="p-8 border-border bg-card shadow-sm overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4">
                                    <Badge variant="warning" className="uppercase tracking-tighter text-[10px] font-bold">
                                        <Clock className="w-3 h-3 mr-1" /> Aguardando Você
                                    </Badge>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-foreground">
                                            Faturamento — {item.competencia}
                                        </h3>
                                        <p className="text-muted-foreground text-sm max-w-sm">
                                            Resumo operacional referente à competência {item.competencia}.
                                        </p>
                                        <div className="flex items-center gap-4 pt-2">
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                                                <History className="w-3 h-3" />
                                                Publicado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                                            </div>
                                            {item.vencimento && (
                                                <span className="text-xs font-bold text-warning flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Vence em {new Date(item.vencimento).toLocaleDateString("pt-BR")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-muted/50 p-6 rounded-2xl text-center min-w-[180px] border border-border">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block mb-1">
                                            Valor Total
                                        </span>
                                        <span className="text-2xl font-black text-foreground">
                                            {formatCurrency(Number(item.valor))}
                                        </span>
                                    </div>
                                </div>

                                {/* Rejeição — campo de motivo */}
                                {rejectionId === item.id && (
                                    <div className="mt-6 bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                                        <p className="text-sm font-bold text-destructive mb-2">Motivo da revisão</p>
                                        <textarea
                                            value={rejectionMotivo}
                                            onChange={e => setRejectionMotivo(e.target.value)}
                                            placeholder="Descreva o que precisa ser revisado..."
                                            className="w-full text-sm bg-background border border-border rounded-lg p-3 resize-none outline-none focus:ring-2 focus:ring-primary/20 h-24"
                                        />
                                        <div className="flex gap-3 mt-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRejeitar(item.id)}
                                                disabled={rejeitaMutation.isPending}
                                            >
                                                Confirmar Revisão
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setRejectionId(null)}>
                                                Cancelar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 pt-8 border-t border-border flex flex-wrap gap-3">
                                    <Button
                                        className="bg-success-strong hover:bg-success-strong/90 gap-2 px-8 rounded-xl"
                                        onClick={() => aprovaMutation.mutate(item.id)}
                                        disabled={aprovaMutation.isPending}
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Aprovar Faturamento
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-destructive-strong border-destructive/20 hover:bg-destructive/10 gap-2 px-8 rounded-xl"
                                        onClick={() => {
                                            setRejectionId(item.id);
                                            setRejectionMotivo("");
                                        }}
                                    >
                                        <XCircle className="w-4 h-4" /> Solicitar Revisão
                                    </Button>
                                    <Button variant="ghost" className="text-muted-foreground gap-2 ml-auto rounded-xl">
                                        <MessageSquare className="w-4 h-4" /> Comentar
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Right: Info + Histórico */}
                <div className="space-y-6">
                    <Card className="p-6 border-border shadow-sm bg-brand text-brand-foreground">
                        <h4 className="font-bold mb-3 flex items-center gap-2">
                            <Info className="w-5 h-5" /> Importante
                        </h4>
                        <p className="text-sm text-brand-foreground/80 leading-relaxed">
                            Ao clicar em <strong>Aprovar</strong>, você valida que todos os serviços prestados
                            estão em conformidade e libera o sistema para gerar a cobrança bancária oficial.
                        </p>
                    </Card>

                    <Card className="p-6 border-border shadow-sm bg-card">
                        <h4 className="font-bold text-foreground mb-6 flex items-center gap-2">
                            <History className="w-5 h-5 text-muted-foreground" /> Histórico Recente
                        </h4>
                        {historico.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum histórico ainda.</p>
                        ) : (
                            <div className="space-y-4">
                                {historico.slice(0, 5).map((h: any, i: number) => (
                                    <div key={h.id} className="flex gap-4 relative">
                                        {i < historico.slice(0, 5).length - 1 && (
                                            <div className="absolute left-[7px] top-4 bottom-[-16px] w-0.5 bg-gray-100" />
                                        )}
                                        <div className="w-4 h-4 rounded-full mt-1.5 shrink-0 z-10 flex items-center justify-center">
                                            {statusIcon[h.status] || <ChevronRight className="w-3 h-3" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">
                                                Competência {h.competencia}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground capitalize">
                                                {h.status} · {h.data_pagamento
                                                    ? new Date(h.data_pagamento).toLocaleDateString("pt-BR")
                                                    : new Date(h.created_at).toLocaleDateString("pt-BR")}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </PortalShell>
    );
};

export default ClientApprovals;
