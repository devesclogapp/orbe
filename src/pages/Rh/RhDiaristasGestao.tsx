import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { DiaristaService, EmpresaService } from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Pencil, Plus, RefreshCw, Trash2, Loader2, Users, Landmark, AlertCircle, ArrowLeft } from "lucide-react";

const FUNCOES = ["Diarista", "Auxiliar de carga", "Ajudante", "Conferente", "Operador eventual", "Serviço extra"] as const;

const emptyForm = {
    nome: "",
    cpf: "",
    telefone: "",
    funcao: "Diarista" as string,
    valor_diaria: "",
    status: "ativo" as "ativo" | "inativo",
    empresa_id: "",
    observacoes: "",
    // Dados bancários
    banco_codigo: "",
    agencia: "",
    agencia_digito: "",
    conta: "",
    digito_conta: "",
    tipo_conta: "corrente" as "corrente" | "poupanca",
    nome_completo: "",
};

const RhDiaristasGestao = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });

    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase.from("profiles").select("role, tenant_id").eq("user_id", user.id).maybeSingle();
            return data;
        },
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const empresaIdPadrao = (empresas as any[])[0]?.id ?? "";

    const { data: diaristas = [], isLoading, isFetching } = useQuery({
        queryKey: ["diaristas_gestao", empresaIdPadrao],
        queryFn: () => DiaristaService.getByEmpresa(empresaIdPadrao, false),
        enabled: !!empresaIdPadrao,
    });

    const reset = () => {
        setForm({ ...emptyForm, empresa_id: empresaIdPadrao });
        setEditingId(null);
    };

    const handleEdit = (d: any) => {
        setEditingId(d.id);
        setForm({
            nome: d.nome,
            cpf: d.cpf ?? "",
            telefone: d.telefone ?? "",
            funcao: d.funcao,
            valor_diaria: String(d.valor_diaria ?? ""),
            status: d.status,
            empresa_id: d.empresa_id,
            observacoes: d.observacoes ?? "",
            banco_codigo: d.banco_codigo ?? "",
            agencia: d.agencia ?? "",
            agencia_digito: d.agencia_digito ?? "",
            conta: d.conta ?? "",
            digito_conta: d.digito_conta ?? "",
            tipo_conta: d.tipo_conta ?? "corrente",
            nome_completo: d.nome_completo ?? "",
        });
        setOpen(true);
    };


    const saveMutation = useMutation({
        mutationFn: () => {
            if (!form.nome.trim()) throw new Error("Informe o nome do diarista.");
            if (!form.empresa_id) throw new Error("Selecione a empresa.");
            const valor = Number(form.valor_diaria);
            if (isNaN(valor) || valor < 0) throw new Error("Valor da diária inválido.");
            const payload = {
                nome: form.nome.trim(),
                cpf: form.cpf.trim() || null,
                telefone: form.telefone.trim() || null,
                funcao: form.funcao,
                valor_diaria: valor,
                status: form.status,
                empresa_id: form.empresa_id,
                observacoes: form.observacoes.trim() || null,
                // Dados bancários
                banco_codigo: form.banco_codigo.trim() || null,
                agencia: form.agencia.trim() || null,
                agencia_digito: form.agencia_digito.trim() || null,
                conta: form.conta.trim() || null,
                digito_conta: form.digito_conta.trim() || null,
                tipo_conta: form.tipo_conta || null,
                nome_completo: form.nome_completo.trim() || null,
            };
            return editingId
                ? DiaristaService.update(editingId, payload)
                : DiaristaService.create(payload);
        },
        onSuccess: () => {
            toast.success(editingId ? "Diarista atualizado." : "Diarista cadastrado.");
            queryClient.invalidateQueries({ queryKey: ["diaristas_gestao"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_ativos"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_lancamento"] });
            setOpen(false);
            reset();
        },
        onError: (err: any) => toast.error("Erro ao salvar.", { description: err.message }),
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: "ativo" | "inativo" }) =>
            DiaristaService.toggleStatus(id, status),
        onSuccess: () => {
            toast.success("Status atualizado.");
            queryClient.invalidateQueries({ queryKey: ["diaristas_gestao"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_ativos"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_lancamento"] });
        },
        onError: (err: any) => toast.error("Erro.", { description: err.message }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => DiaristaService.softDelete(id),
        onSuccess: () => {
            toast.success("Diarista removido.");
            queryClient.invalidateQueries({ queryKey: ["diaristas_gestao"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_ativos"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_lancamento"] });
        },
        onError: (err: any) => toast.error("Erro.", { description: err.message }),
    });

    const diaristasArray = diaristas as any[];

    return (
        <AppShell title="Gestão de Diaristas" subtitle="Cadastre e gerencie os diaristas da empresa">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/rh/diaristas")}>
                    <Users className="h-4 w-4 mr-2" />
                    Ir para o Painel
                </Button>
            </div>
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-background p-2 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{diaristasArray.length} diarista(s) cadastrado(s)</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline" size="icon" className="h-9 w-9"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["diaristas_gestao"] })}
                        >
                            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                        </Button>
                        <Button className="h-9 px-4 font-display font-semibold text-sm" onClick={() => { reset(); setOpen(true); }}>
                            <Plus className="h-4 w-4 mr-1.5" /> Novo diarista
                        </Button>
                    </div>
                </div>

                <section className="esc-card overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Carregando...</p>
                        </div>
                    ) : diaristasArray.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                            <Users className="h-10 w-10 text-muted-foreground" />
                            <p className="font-medium text-foreground">Nenhum diarista cadastrado</p>
                            <p className="text-sm text-muted-foreground">Clique em "Novo diarista" para começar.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Nome</th>
                                    <th className="px-3 h-11 font-medium">Função</th>
                                    <th className="px-3 h-11 font-medium">CPF</th>
                                    <th className="px-3 h-11 font-medium text-right">Diária</th>
                                    <th className="px-3 h-11 font-medium text-center" title="Dados bancários">Banco</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                    <th className="px-5 h-11 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {diaristasArray.map((d: any) => {
                                    const temBanco = !!(d.banco_codigo && d.agencia && d.conta && d.digito_conta && d.cpf);
                                    return (
                                        <tr key={d.id} className="border-t border-muted hover:bg-background group">
                                            <td className="px-5 h-[52px]">
                                                <p className="font-medium text-foreground">{d.nome}</p>
                                                {d.telefone && <p className="text-xs text-muted-foreground">{d.telefone}</p>}
                                            </td>
                                            <td className="px-3 text-muted-foreground">{d.funcao}</td>
                                            <td className="px-3 font-mono text-xs text-muted-foreground">{d.cpf ?? "—"}</td>
                                            <td className="px-3 text-right font-mono font-semibold text-foreground">
                                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.valor_diaria))}
                                            </td>
                                            <td className="px-3 text-center">
                                                {temBanco
                                                    ? <span title="Dados bancários completos"><Landmark className="h-4 w-4 text-emerald-600 mx-auto" /></span>
                                                    : <span title="Dados bancários incompletos"><AlertCircle className="h-4 w-4 text-amber-500 mx-auto" /></span>
                                                }
                                            </td>
                                            <td className="px-5 text-center">
                                                <button
                                                    onClick={() => toggleStatusMutation.mutate({ id: d.id, status: d.status === "ativo" ? "inativo" : "ativo" })}
                                                    className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                                                        d.status === "ativo" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {d.status === "ativo" ? "Ativo" : "Inativo"}
                                                </button>
                                            </td>
                                            <td className="px-5 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(d)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => { if (confirm(`Remover ${d.nome}?`)) deleteMutation.mutate(d.id); }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar diarista" : "Novo diarista"}</DialogTitle>
                        <DialogDescription>Preencha os dados do diarista. Os dados bancários são obrigatórios para geração de CNAB.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">

                        {/* ── Dados pessoais ── */}
                        <div className="space-y-1.5">
                            <Label>Nome completo *</Label>
                            <Input placeholder="Nome do diarista" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>CPF</Label>
                                <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Telefone</Label>
                                <Input placeholder="(00) 00000-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Função *</Label>
                                <Select value={form.funcao} onValueChange={(v) => setForm({ ...form, funcao: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {FUNCOES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Valor da diária *</Label>
                                <Input
                                    type="number" step="0.01" min="0" placeholder="120.00"
                                    value={form.valor_diaria}
                                    onChange={(e) => setForm({ ...form, valor_diaria: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Empresa *</Label>
                                <Select value={form.empresa_id || empresaIdPadrao} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {(empresas as any[]).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <Select value={form.status} onValueChange={(v: "ativo" | "inativo") => setForm({ ...form, status: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ativo">Ativo</SelectItem>
                                        <SelectItem value="inativo">Inativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ── Dados bancários ── */}
                        <div className="border-t border-border/50 pt-4">
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                                <Landmark className="h-4 w-4 text-primary" />
                                Dados Bancários
                                <span className="text-xs font-normal text-muted-foreground ml-1">(necessário para CNAB)</span>
                            </p>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label>Nome completo (bancário)</Label>
                                    <Input
                                        placeholder="Como consta na conta bancária"
                                        value={form.nome_completo}
                                        onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Banco (código)</Label>
                                        <Input
                                            placeholder="Ex: 341"
                                            maxLength={3}
                                            value={form.banco_codigo}
                                            onChange={(e) => setForm({ ...form, banco_codigo: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Agência</Label>
                                        <Input
                                            placeholder="0001"
                                            value={form.agencia}
                                            onChange={(e) => setForm({ ...form, agencia: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Tipo de conta</Label>
                                        <Select value={form.tipo_conta} onValueChange={(v: "corrente" | "poupanca") => setForm({ ...form, tipo_conta: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="corrente">Corrente</SelectItem>
                                                <SelectItem value="poupanca">Poupança</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2 space-y-1.5">
                                        <Label>Conta</Label>
                                        <Input
                                            placeholder="00000000"
                                            value={form.conta}
                                            onChange={(e) => setForm({ ...form, conta: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Dígito</Label>
                                        <Input
                                            placeholder="0"
                                            maxLength={2}
                                            value={form.digito_conta}
                                            onChange={(e) => setForm({ ...form, digito_conta: e.target.value.replace(/\D/g, '') })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Observações</Label>
                            <Textarea rows={2} placeholder="Observações sobre o diarista..." value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
                        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RhDiaristasGestao;
