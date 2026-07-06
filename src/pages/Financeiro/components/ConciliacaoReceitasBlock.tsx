import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ArrowRightLeft, FileCheck2, Loader2, RotateCcw, Search, XCircle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getCurrentTenantId } from "@/services/domain/base.service";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { ReceitaOperacional } from "@/types/receitas.types";

const formatCurrency = (value?: number | null) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export function ConciliacaoReceitasBlock() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [filtroStatus, setFiltroStatus] = useState<"todos" | "recebido" | "conciliado">("recebido");

    const [dialogAcao, setDialogAcao] = useState<{
        open: boolean;
        item: (ReceitaOperacional & { empresas?: { nome: string } }) | null;
        acao: "conciliado" | "pendente";
        observacao: string;
    }>({
        open: false,
        item: null,
        acao: "conciliado",
        observacao: "",
    });

    const { data: receitasRaw = [], isLoading } = useQuery({
        queryKey: ["receitas_para_conciliacao"],
        queryFn: async () => {
            const tenantId = await getCurrentTenantId();
            const { data, error } = await supabase
                .from('receitas_operacionais')
                .select(`
                    *,
                    empresas (nome)
                `)
                .eq('tenant_id', tenantId)
                .in('status', ['recebido', 'conciliado'])
                .order('updated_at', { ascending: false })
                .limit(1000);

            if (error) throw error;
            return (data || []) as (ReceitaOperacional & { empresas?: { nome: string } })[];
        },
    });

    // Filtragem local
    const receitasList = useMemo(() => {
        let filtered = receitasRaw;

        if (filtroStatus !== 'todos') {
            if (filtroStatus === 'recebido') {
                filtered = filtered.filter(r => r.status === 'recebido');
            } else if (filtroStatus === 'conciliado') {
                filtered = filtered.filter(r => r.status === 'conciliado');
            }
        }

        const term = search.trim().toLowerCase();
        if (term) {
            filtered = filtered.filter(r => {
                const nome = String(r.empresas?.nome || "").toLowerCase();
                return nome.includes(term) || r.id.toLowerCase().includes(term);
            });
        }

        return filtered;
    }, [receitasRaw, filtroStatus, search]);

    const resumo = useMemo(() => {
        return receitasRaw
            .filter(r => ['recebido', 'conciliado'].includes(r.status))
            .reduce(
                (acc, item) => {
                    const val = Number(item.valor_total || 0);
                    if (item.status === 'conciliado') acc.conciliado += val;
                    else acc.recebido += val; // pendente de conciliar
                    return acc;
                },
                { recebido: 0, conciliado: 0 }
            );
    }, [receitasRaw]);

    // Mutations
    const actionMutation = useMutation({
        mutationFn: async ({ id, acao, obs }: { id: string, acao: string, obs: string }) => {
            const tenantId = await getCurrentTenantId();
            // Atualiza o status
            await ReceitasService.update(id, { status: acao === 'conciliado' ? 'conciliado' : 'recebido' });
            // Registra o evento
            const logAcao = acao === 'conciliado' ? 'Receita Conciliada' : 'Recebimento Desfeito (Divergência)';
            const msgOpcional = obs ? ` | Obs: ${obs}` : '';
            await ReceitasService.logEvent(tenantId, id, logAcao, `A situação bancária foi atualizada para ${acao.toUpperCase()}.${msgOpcional}`);
            return true;
        },
        onSuccess: () => {
            toast.success("Operação de conciliação confirmada com sucesso.");
            void queryClient.invalidateQueries({ queryKey: ["receitas_para_conciliacao"] });
            void queryClient.invalidateQueries({ queryKey: ["receitas"] });
            void queryClient.invalidateQueries({ queryKey: ["receitas-painel"] });
            setDialogAcao({ open: false, item: null, acao: "conciliado", observacao: "" });
        },
        onError: (err: any) => {
            toast.error(err.message || "Erro ao processar a ação");
        }
    });

    const submitAcaoDialog = () => {
        if (!dialogAcao.item) return;
        if (dialogAcao.acao === 'pendente' && !dialogAcao.observacao.trim()) {
            toast.error("Obrigatório registrar observação ao apontar divergência/desfazer.");
            return;
        }

        actionMutation.mutate({
            id: dialogAcao.item.id,
            acao: dialogAcao.acao,
            obs: dialogAcao.observacao.trim()
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Card className="space-y-6 p-6 xl:col-span-1">
                    <div className="space-y-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                            <ArrowRightLeft className="h-4 w-4" /> Sobre a Conciliação
                        </h3>

                        <div className="rounded-2xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                            O saldo reportado como <strong>Recebido</strong> pelas faturas só se torna definitivo após a inspeção e verificação física nos <strong>Extratos do Banco (Real)</strong>.
                        </div>

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <div className="text-xs uppercase text-blue-700">Aguardando Baixa Definitiva</div>
                            <div className="mt-1 text-2xl font-bold text-blue-800">{formatCurrency(resumo.recebido)}</div>
                        </div>

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="text-xs uppercase text-emerald-700">Total Conciliado</div>
                            <div className="mt-1 text-2xl font-bold text-emerald-800">{formatCurrency(resumo.conciliado)}</div>
                        </div>

                    </div>
                </Card>

                <Card className="space-y-5 p-6 xl:col-span-2">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h3 className="flex items-center gap-2 text-lg font-semibold">
                                <FileCheck2 className="h-5 w-5 text-primary" /> Auditoria de Faturamento
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Revise os lançamentos notificados como recebidos.
                            </p>
                        </div>

                        <div className="flex grid-cols-1 gap-3 sm:grid-cols-2">
                            <Select value={filtroStatus} onValueChange={(value: any) => setFiltroStatus(value)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filtro" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos Registros</SelectItem>
                                    <SelectItem value="recebido">Aguardando Avaliação</SelectItem>
                                    <SelectItem value="conciliado">Já Conciliados</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="relative flex-1 min-w-[250px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Pesquisar cliente..."
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/20">
                                <TableRow>
                                    <TableHead>Identificação do Cliente</TableHead>
                                    <TableHead>Competência</TableHead>
                                    <TableHead className="text-right">Valor Final</TableHead>
                                    <TableHead>Status Fatura</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : receitasList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                            Nenhuma receita pendente nas aberturas atuais.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    receitasList.map((item) => {
                                        const isConciliado = item.status === 'conciliado';
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="min-w-[220px]">
                                                    <div className="font-medium">{item.empresas?.nome || "Sem identificação"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Mod: {item.modalidade.replace(/_/g, ' ')}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.competencia || "Avulso"}</TableCell>
                                                <TableCell className="text-right font-semibold text-emerald-700">
                                                    {formatCurrency(item.valor_total)}
                                                </TableCell>
                                                <TableCell>
                                                    {isConciliado ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Conciliado</Badge>
                                                    ) : (
                                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Recebido</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end gap-2">
                                                        {!isConciliado ? (
                                                            <>
                                                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setDialogAcao({ open: true, item, acao: 'conciliado', observacao: '' })}>
                                                                    <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmar Baixa
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="text-amber-700" onClick={() => setDialogAcao({ open: true, item, acao: 'pendente', observacao: '' })}>
                                                                    <ArrowRightLeft className="mr-1 h-4 w-4" /> Desfazer (Não Caiu)
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button size="sm" variant="outline" onClick={() => setDialogAcao({ open: true, item, acao: 'pendente', observacao: 'Revertendo conciliação' })}>
                                                                <RotateCcw className="mr-1 h-4 w-4" /> Reverter
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            <Dialog open={dialogAcao.open} onOpenChange={(open) => {
                if (!open) setDialogAcao({ open: false, item: null, acao: "conciliado", observacao: "" });
            }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>{dialogAcao.acao === 'conciliado' ? 'Efetivar Baixa Bancária' : 'Apontar Divergência Bancária'}</DialogTitle>
                        <DialogDescription>
                            {dialogAcao.acao === 'conciliado'
                                ? 'Você confirmou visualmente no extrato bancário (PJ) que o valor abaixo já creditou com sucesso?'
                                : 'Você está desassociando este registro revertendo ao status Pendente, informe o ocorrido operacional:'}
                        </DialogDescription>
                    </DialogHeader>

                    {dialogAcao.item && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                                <div className="text-lg font-bold text-center text-emerald-700 mb-2">{formatCurrency(dialogAcao.item.valor_total)}</div>
                                <div className="text-sm font-medium text-center">{dialogAcao.item.empresas?.nome || 'Operação Oculta'}</div>
                            </div>

                            {dialogAcao.acao === 'pendente' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Motivo / Observação Obrigatória</label>
                                    <Textarea
                                        required
                                        value={dialogAcao.observacao}
                                        onChange={(event) => setDialogAcao((prev) => ({ ...prev, observacao: event.target.value }))}
                                        placeholder="Ex: Não identifiquei o PIX ou transação devolvida."
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogAcao({ open: false, item: null, acao: "conciliado", observacao: "" })}>Cancelar</Button>
                        <Button onClick={submitAcaoDialog} disabled={actionMutation.isPending} className={dialogAcao.acao === 'conciliado' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700 text-white'}>
                            {actionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar Execução'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
