import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Pencil, Plus, RefreshCw, Trash2, Loader2, Users, Landmark, AlertCircle, ArrowLeft, Building2, Check, CheckCircle2, Circle, Search } from "lucide-react";

const FUNCOES = ["Diarista", "Auxiliar de carga", "Ajudante", "Conferente", "Operador eventual", "Serviço extra"] as const;

const BANK_OPTIONS = [
    { code: "001", name: "Banco do Brasil" },
    { code: "033", name: "Santander" },
    { code: "104", name: "Caixa Econômica Federal" },
    { code: "237", name: "Bradesco" },
    { code: "260", name: "Nu Pagamentos" },
    { code: "341", name: "Itaú" },
    { code: "422", name: "Safra" },
    { code: "748", name: "Sicredi" },
    { code: "756", name: "Sicoob" },
] as const;

const emptyForm = {
    nome: "",
    matricula: "",
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
    chave_pix: "",
    nome_completo: "",
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const getBankLabel = (code?: string | null) => {
    const bank = BANK_OPTIONS.find((item) => item.code === code);
    return bank ? `${bank.code} - ${bank.name}` : code ? `${code} - Banco não mapeado` : "Selecionar banco";
};

const RhDiaristasGestao = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [bankSelectorOpen, setBankSelectorOpen] = useState(false);

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
    const empresaMap = useMemo(
        () => new Map((empresas as any[]).map((empresa: any) => [empresa.id, empresa.nome])),
        [empresas],
    );

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
            matricula: d.matricula ?? "",
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
            chave_pix: d.chave_pix ?? "",
            nome_completo: d.nome ?? d.nome_completo ?? "",
        });
        setOpen(true);
    };

    const bankValidation = useMemo(() => {
        const bancoOk = /^\d{3}$/.test(form.banco_codigo);
        const agenciaOk = /^\d{3,6}$/.test(form.agencia);
        const agenciaDigitoOk = /^[0-9Xx]{1,2}$/.test(form.agencia_digito);
        const contaOk = /^\d{3,20}$/.test(form.conta);
        const contaDigitoOk = /^[0-9Xx]{1,2}$/.test(form.digito_conta);
        const tipoContaOk = ["corrente", "poupanca"].includes(form.tipo_conta);
        const pixOk = form.chave_pix.trim().length > 0;

        const hasAnyBankData = [
            form.banco_codigo,
            form.agencia,
            form.agencia_digito,
            form.conta,
            form.digito_conta,
            form.tipo_conta,
            form.chave_pix,
        ].some((value) => String(value || "").trim().length > 0);

        const requiredComplete = bancoOk && agenciaOk && agenciaDigitoOk && contaOk && contaDigitoOk && tipoContaOk;
        const hasInvalidFormat = [
            form.banco_codigo && !bancoOk,
            form.agencia && !agenciaOk,
            form.agencia_digito && !agenciaDigitoOk,
            form.conta && !contaOk,
            form.digito_conta && !contaDigitoOk,
            form.tipo_conta && !tipoContaOk,
        ].some(Boolean);

        let badge = { label: "Dados incompletos", variant: "secondary" as const };
        if (requiredComplete) {
            badge = { label: "Dados válidos", variant: "success" as const };
        } else if (hasInvalidFormat) {
            badge = { label: "Formato inválido", variant: "warning" as const };
        } else if (hasAnyBankData) {
            badge = { label: "Dados incompletos", variant: "info" as const };
        }

        const checklist = [
            { key: "banco", label: "banco", done: bancoOk },
            { key: "agencia", label: "agência", done: agenciaOk },
            { key: "agencia_digito", label: "dígito agência", done: agenciaDigitoOk },
            { key: "conta", label: "conta", done: contaOk },
            { key: "digito_conta", label: "dígito conta", done: contaDigitoOk },
            { key: "tipo_conta", label: "tipo conta", done: tipoContaOk },
            { key: "pix", label: "pix", done: pixOk, optional: true },
        ];

        return { bancoOk, agenciaOk, agenciaDigitoOk, contaOk, contaDigitoOk, badge, checklist };
    }, [form]);


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
                chave_pix: form.chave_pix.trim() || null,
                nome_completo: form.nome.trim() || null,
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
                <DialogContent className="max-w-2xl p-0 overflow-hidden">
                    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <DialogTitle>{editingId ? "Editar diarista" : "Novo diarista"}</DialogTitle>
                        <DialogDescription>Preencha os dados do diarista. Os dados bancários são obrigatórios para geração de CNAB.</DialogDescription>
                    </DialogHeader>
                        <div className="mx-6 mb-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="min-w-[220px] flex-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Colaborador</p>
                                    <p className="mt-1 text-sm font-semibold text-foreground">{form.nome || "Nome ainda não informado"}</p>
                                </div>
                                <div className="min-w-[120px]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Matrícula</p>
                                    <p className="mt-1 text-sm text-foreground">{form.matricula || "Não informada"}</p>
                                </div>
                                <div className="min-w-[180px]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Empresa</p>
                                    <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        {empresaMap.get(form.empresa_id || empresaIdPadrao) || "Não selecionada"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="max-h-[76vh] overflow-y-auto px-6 pb-6">
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
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status da validação</p>
                                        <Badge variant={bankValidation.badge.variant} className="mt-2">{bankValidation.badge.label}</Badge>
                                    </div>
                                    <div className="grid min-w-[260px] grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                        {bankValidation.checklist.map((item) => (
                                            <div key={item.key} className="flex items-center gap-2 text-muted-foreground">
                                                {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-amber-500" />}
                                                <span className={cn(item.done && "text-foreground")}>
                                                    {item.label}
                                                    {item.optional ? <span className="ml-1 text-[10px] text-muted-foreground">opcional</span> : null}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Nome do titular</Label>
                                    <Input
                                        placeholder="Como consta na conta bancária"
                                        value={form.nome}
                                        readOnly
                                        aria-readonly="true"
                                        className="cursor-not-allowed border-dashed bg-muted text-muted-foreground"
                                    />
                                    <p className="text-xs text-muted-foreground">Preenchido automaticamente com o nome do colaborador e bloqueado para evitar edição bancária no colaborador errado.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Banco</Label>
                                    <Popover open={bankSelectorOpen} onOpenChange={setBankSelectorOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between font-normal">
                                                <span className="truncate">{getBankLabel(form.banco_codigo)}</span>
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[360px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Buscar banco por código ou nome..." />
                                                <CommandList>
                                                    <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
                                                    <CommandGroup>
                                                        {BANK_OPTIONS.map((bank) => (
                                                            <CommandItem
                                                                key={bank.code}
                                                                value={`${bank.code} ${bank.name}`}
                                                                onSelect={() => {
                                                                    setForm({ ...form, banco_codigo: bank.code });
                                                                    setBankSelectorOpen(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", form.banco_codigo === bank.code ? "opacity-100" : "opacity-0")} />
                                                                <span>{bank.code} - {bank.name}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Agência</Label>
                                        <Input
                                            placeholder="0001"
                                            value={form.agencia}
                                            onChange={(e) => setForm({ ...form, agencia: onlyDigits(e.target.value) })}
                                            className={cn(form.agencia && !bankValidation.agenciaOk && "border-amber-400 focus-visible:ring-amber-400")}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Díg. agência</Label>
                                        <Input
                                            placeholder="0"
                                            maxLength={2}
                                            value={form.agencia_digito}
                                            onChange={(e) => setForm({ ...form, agencia_digito: onlyDigits(e.target.value).slice(0, 2) })}
                                            className={cn(form.agencia_digito && !bankValidation.agenciaDigitoOk && "border-amber-400 focus-visible:ring-amber-400")}
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
                                            onChange={(e) => setForm({ ...form, conta: onlyDigits(e.target.value) })}
                                            className={cn(form.conta && !bankValidation.contaOk && "border-amber-400 focus-visible:ring-amber-400")}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Dígito</Label>
                                        <Input
                                            placeholder="0"
                                            maxLength={2}
                                            value={form.digito_conta}
                                            onChange={(e) => setForm({ ...form, digito_conta: onlyDigits(e.target.value).slice(0, 2) })}
                                            className={cn(form.digito_conta && !bankValidation.contaDigitoOk && "border-amber-400 focus-visible:ring-amber-400")}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Pix</Label>
                                    <Input
                                        placeholder="Chave pix"
                                        value={form.chave_pix}
                                        onChange={(e) => setForm({ ...form, chave_pix: e.target.value })}
                                    />
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
                    </div>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RhDiaristasGestao;
