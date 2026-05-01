import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService,
    PerfilUsuarioService,
    EmpresaService,
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, Eye, Download, CheckCircle2, Lock, ArrowLeft } from "lucide-react";

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
    format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });

const RhDiaristasLotes = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [selectedLote, setSelectedLote] = useState<any>(null);
    const [openDetalhe, setOpenDetalhe] = useState(false);

    const { data: perfil } = useQuery({
        queryKey: ["perfil_usuario", user?.id],
        queryFn: () => (user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null)),
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const empresaId = perfil?.empresa_id ?? ((empresas as any[])[0]?.id ?? "");

    const { data: lotes = [], isLoading } = useQuery({
        queryKey: ["lotes_fechamento", empresaId],
        queryFn: () => LoteFechamentoDiaristaService.getByEmpresa(empresaId),
        enabled: !!empresaId,
    });

    const { data: lancamentosLote = [], isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ["lancamentos_lote", selectedLote?.id],
        queryFn: () => LancamentoDiaristaService.getByLoteId(selectedLote!.id),
        enabled: !!selectedLote?.id,
    });

    const marcarPagoMutation = useMutation({
        mutationFn: (id: string) => LoteFechamentoDiaristaService.marcarComoPago(id),
        onSuccess: () => {
            toast.success("Lote marcado como pago com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_lote"] });
            setOpenDetalhe(false);
            setSelectedLote(null);
        },
        onError: (err: any) => toast.error("Erro ao atualizar lote", { description: err.message }),
    });

    // Agrupar os lançamentos do lote para o detalhe summary
    const dadosAgrupados = useMemo(() => {
        const map: Record<string, {
            diarista_id: string;
            nome: string;
            funcao: string;
            totalDiarias: number;
            valorTotal: number;
            status: string;
        }> = {};

        (lancamentosLote as any[]).forEach((l) => {
            const key = l.diarista_id;
            if (!map[key]) {
                map[key] = {
                    diarista_id: l.diarista_id,
                    nome: l.nome_colaborador,
                    funcao: l.funcao_colaborador ?? "—",
                    totalDiarias: 0,
                    valorTotal: 0,
                    status: l.status,
                };
            }
            map[key].totalDiarias += Number(l.quantidade_diaria || 0);
            map[key].valorTotal += Number(l.valor_calculado || 0);
        });

        return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [lancamentosLote]);

    const handleOpenDetalhe = (lote: any) => {
        setSelectedLote(lote);
        setOpenDetalhe(true);
    };

    const exportarXlsx = async () => {
        if (!selectedLote || dadosAgrupados.length === 0) return;
        try {
            const { utils, writeFile } = await import("xlsx");
            const rows = dadosAgrupados.map((g) => ({
                Colaborador: g.nome,
                "Função": g.funcao,
                "Total Diárias": g.totalDiarias.toFixed(1),
                "Valor Total": g.valorTotal,
                Status: g.status,
            }));

            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Pagamentos");

            const nomeArq = `lote_${selectedLote.id.substring(0, 6)}_${selectedLote.periodo_inicio}_a_${selectedLote.periodo_fim}.xlsx`;
            writeFile(wb, nomeArq);
            toast.success("Planilha de pagamento exportada.");
        } catch {
            toast.error("Instale a dependência: npm install xlsx");
        }
    };

    return (
        <AppShell title="Lotes de Pagamento" subtitle="Gestão financeira dos fechamentos de diaristas">
            <div className="space-y-4">
                <section className="esc-card overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Carregando...</p>
                        </div>
                    ) : (lotes as any[]).length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                            <Lock className="h-10 w-10 text-muted-foreground" />
                            <p className="font-medium text-foreground">Nenhum lote de fechamento encontrado</p>
                            <p className="text-sm text-muted-foreground">Feche um período no painel para gerar um lote.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Lote / Período</th>
                                    <th className="px-3 h-11 font-medium text-center">Qtd Diaristas</th>
                                    <th className="px-3 h-11 font-medium text-right">Valor Total</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(lotes as any[]).map((l: any) => (
                                    <tr key={l.id} className="border-t border-muted hover:bg-background">
                                        <td className="px-5 h-14">
                                            <p className="font-mono text-xs text-muted-foreground mb-0.5">#{l.id.substring(0, 8)}</p>
                                            <p className="font-medium text-foreground">
                                                {formatDate(l.periodo_inicio)} até {formatDate(l.periodo_fim)}
                                            </p>
                                        </td>
                                        <td className="px-3 text-center font-mono">
                                            {l.total_registros} <span className="text-xs text-muted-foreground ml-1">registros</span>
                                        </td>
                                        <td className="px-3 text-right font-mono font-bold text-base">
                                            {formatCurrency(Number(l.valor_total))}
                                        </td>
                                        <td className="px-5 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
                                                l.status === "fechado" && "bg-blue-500/15 text-blue-700",
                                                l.status === "pago" && "bg-emerald-500/15 text-emerald-700",
                                                l.status === "cancelado" && "bg-muted text-muted-foreground",
                                            )}>
                                                {l.status === "fechado" && "Fechado"}
                                                {l.status === "pago" && "Pago"}
                                                {l.status === "cancelado" && "Cancelado"}
                                            </span>
                                        </td>
                                        <td className="px-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleOpenDetalhe(l)}>
                                                    <Eye className="h-4 w-4 mr-1.5" /> Detalhes
                                                </Button>
                                                {l.status !== "pago" && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => {
                                                            if (confirm("Confirmar pagamento deste lote?")) {
                                                                marcarPagoMutation.mutate(l.id);
                                                            }
                                                        }}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Pago
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>

            <Dialog open={openDetalhe} onOpenChange={(v) => { setOpenDetalhe(v); if (!v) setSelectedLote(null); }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Detalhes do Lote
                            {selectedLote?.status === "pago" && (
                                <span className="bg-emerald-500/15 text-emerald-700 text-xs px-2 py-0.5 rounded-full flex items-center">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                                </span>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Período: {selectedLote ? `${formatDate(selectedLote.periodo_inicio)} até ${formatDate(selectedLote.periodo_fim)}` : ""}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        {isLoadingLancamentos ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : (
                            <div className="border border-border/50 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="esc-table-header bg-muted/50">
                                        <tr className="text-left">
                                            <th className="px-4 py-2 font-medium">Diarista</th>
                                            <th className="px-3 py-2 font-medium">Função</th>
                                            <th className="px-3 py-2 font-medium text-center">Diárias</th>
                                            <th className="px-4 py-2 font-medium text-right">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="max-h-[400px] overflow-y-auto block w-full table-fixed">
                                        {/* A simple trick to just show rows cleanly without scroll headers if possible, otherwise let it flow */}
                                    </tbody>
                                    <tbody className="divide-y divide-border/50">
                                        {dadosAgrupados.map((g) => (
                                            <tr key={g.diarista_id} className="hover:bg-muted/30">
                                                <td className="px-4 py-2.5 font-medium">{g.nome}</td>
                                                <td className="px-3 py-2.5 text-muted-foreground text-xs">{g.funcao}</td>
                                                <td className="px-3 py-2.5 text-center font-mono text-xs">{g.totalDiarias.toFixed(1)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatCurrency(g.valorTotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted border-t border-border/50">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-3 font-bold text-right pt-3">TOTAL GERAL:</td>
                                            <td className="px-3 py-3 text-center font-mono font-bold text-sm">
                                                {dadosAgrupados.reduce((a, g) => a + g.totalDiarias, 0).toFixed(1)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-lg text-emerald-600">
                                                {formatCurrency(Number(selectedLote?.valor_total || 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                        <Button variant="outline" onClick={exportarXlsx}>
                            <Download className="h-4 w-4 mr-2" /> Exportar Planilha
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setOpenDetalhe(false)}>Fechar</Button>
                            {selectedLote?.status !== "pago" && (
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => marcarPagoMutation.mutate(selectedLote.id)}
                                    disabled={marcarPagoMutation.isPending}
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    {marcarPagoMutation.isPending ? "Salvando..." : "Marcar como pago"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RhDiaristasLotes;
