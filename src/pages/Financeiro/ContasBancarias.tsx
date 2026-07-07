import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertCircle,
    Building2,
    CreditCard,
    Edit,
    Info,
    Landmark,
    Loader2,
    Plus,
    Power,
    PowerOff,
    Search,
    ShieldCheck,
    Star,
    StarOff,
    Trash2,
    X,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { EmpresaService } from "@/services/base.service";
import {
    BankAccountService,
    BANCOS_BRASIL,
    type ContaBancariaEmpresa,
    type ContaBancariaCreatePayload,
} from "@/services/bankAccount.service";

// ============================================================
// Helpers
// ============================================================

const INITIAL_FORM: ContaBancariaCreatePayload = {
    empresa_id: "",
    banco_codigo: "",
    banco_nome: "",
    agencia: "",
    agencia_digito: "",
    conta: "",
    conta_digito: "",
    convenio: "",
    carteira: "",
    variacao_carteira: "",
    cedente_nome: "",
    cedente_cnpj: "",
    tipo_conta: "corrente",
    tipo_servico: "pagamento",
    favorecido: "",
    chave_pix: "",
    permite_cnab: true,
    ativo: true,
    is_padrao: false,
};

function formatCNPJ(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskConta(conta: string, digito?: string | null): string {
    const c = String(conta ?? "");
    if (c.length <= 2) return `${c}${digito ? `-${digito}` : ""}`;
    const masked = "*".repeat(c.length - 2) + c.slice(-2);
    return `${masked}${digito ? `-${digito}` : ""}`;
}

// ============================================================
// Page
// ============================================================

const ContasBancarias = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [filterEmpresa, setFilterEmpresa] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ContaBancariaCreatePayload>({ ...INITIAL_FORM });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Auto-fill tracking
    const manuallyEdited = useRef<Set<string>>(new Set());
    const [empresaMissingFields, setEmpresaMissingFields] = useState<string[]>([]);
    const [existingContaForEmpresa, setExistingContaForEmpresa] = useState<ContaBancariaEmpresa | null>(null);

    // -------- Queries --------
    const { data: contas = [], isLoading } = useQuery<ContaBancariaEmpresa[]>({
        queryKey: ["contas-bancarias-all"],
        queryFn: () => BankAccountService.getAllWithEmpresa(),
    });

    const { data: empresas = [] } = useQuery<any[]>({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    // -------- Filtered --------
    const filtered = useMemo(() => {
        return contas.filter((c) => {
            const matchSearch =
                !search ||
                c.banco_nome?.toLowerCase().includes(search.toLowerCase()) ||
                c.cedente_nome?.toLowerCase().includes(search.toLowerCase()) ||
                c.cedente_cnpj?.toLowerCase().includes(search.toLowerCase()) ||
                c.agencia?.toLowerCase().includes(search.toLowerCase()) ||
                c.conta?.toLowerCase().includes(search.toLowerCase()) ||
                c.empresas?.nome?.toLowerCase().includes(search.toLowerCase());
            const matchEmpresa = !filterEmpresa || c.empresa_id === filterEmpresa;
            return matchSearch && matchEmpresa;
        });
    }, [contas, search, filterEmpresa]);

    // -------- KPIs --------
    const totalContas = contas.length;
    const contasAtivas = contas.filter((c) => c.ativo).length;
    const contasCnab = contas.filter((c) => c.ativo && c.permite_cnab).length;
    const empresasComConta = new Set(contas.filter((c) => c.ativo).map((c) => c.empresa_id)).size;

    // -------- Mutations --------
    const saveMutation = useMutation({
        mutationFn: async (payload: ContaBancariaCreatePayload) => {
            if (editingId) {
                return BankAccountService.updateConta(editingId, payload);
            }
            return BankAccountService.createConta(payload);
        },
        onSuccess: () => {
            toast.success(editingId ? "Conta atualizada com sucesso." : "Conta cadastrada com sucesso.");
            queryClient.invalidateQueries({ queryKey: ["contas-bancarias-all"] });
            queryClient.invalidateQueries({ queryKey: ["contas"] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err?.message || "Erro ao salvar conta bancária.");
        },
    });

    const toggleAtivoMutation = useMutation({
        mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => BankAccountService.toggleAtivo(id, ativo),
        onSuccess: () => {
            toast.success("Status atualizado.");
            queryClient.invalidateQueries({ queryKey: ["contas-bancarias-all"] });
            queryClient.invalidateQueries({ queryKey: ["contas"] });
        },
    });

    const toggleCnabMutation = useMutation({
        mutationFn: ({ id, permite_cnab }: { id: string; permite_cnab: boolean }) =>
            BankAccountService.togglePermiteCnab(id, permite_cnab),
        onSuccess: () => {
            toast.success("Permissão CNAB atualizada.");
            queryClient.invalidateQueries({ queryKey: ["contas-bancarias-all"] });
            queryClient.invalidateQueries({ queryKey: ["contas"] });
        },
    });

    const setPadraoMutation = useMutation({
        mutationFn: ({ id, empresaId }: { id: string; empresaId: string }) =>
            BankAccountService.setPadrao(id, empresaId),
        onSuccess: () => {
            toast.success("Conta padrão definida.");
            queryClient.invalidateQueries({ queryKey: ["contas-bancarias-all"] });
            queryClient.invalidateQueries({ queryKey: ["contas"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => BankAccountService.delete(id),
        onSuccess: () => {
            toast.success("Conta excluída.");
            queryClient.invalidateQueries({ queryKey: ["contas-bancarias-all"] });
            queryClient.invalidateQueries({ queryKey: ["contas"] });
            setDeleteConfirm(null);
        },
        onError: (err: any) => {
            toast.error(err?.message || "Erro ao excluir conta.");
        },
    });

    // -------- Modal --------
    const openCreate = () => {
        setEditingId(null);
        setForm({ ...INITIAL_FORM });
        manuallyEdited.current = new Set();
        setEmpresaMissingFields([]);
        setExistingContaForEmpresa(null);
        setShowModal(true);
    };

    const openEdit = (conta: ContaBancariaEmpresa) => {
        setEditingId(conta.id);
        setForm({
            empresa_id: conta.empresa_id ?? "",
            banco_codigo: conta.banco_codigo ?? "",
            banco_nome: conta.banco_nome ?? "",
            agencia: conta.agencia ?? "",
            agencia_digito: conta.agencia_digito ?? "",
            conta: conta.conta ?? "",
            conta_digito: conta.conta_digito ?? "",
            convenio: conta.convenio ?? "",
            carteira: conta.carteira ?? "",
            variacao_carteira: conta.variacao_carteira ?? "",
            cedente_nome: conta.cedente_nome ?? "",
            cedente_cnpj: conta.cedente_cnpj ?? "",
            tipo_conta: conta.tipo_conta ?? "corrente",
            tipo_servico: conta.tipo_servico ?? "pagamento",
            favorecido: conta.favorecido ?? "",
            chave_pix: conta.chave_pix ?? "",
            permite_cnab: conta.permite_cnab ?? true,
            ativo: conta.ativo ?? true,
            is_padrao: conta.is_padrao ?? false,
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
        setForm({ ...INITIAL_FORM });
        manuallyEdited.current = new Set();
        setEmpresaMissingFields([]);
        setExistingContaForEmpresa(null);
    };

    const handleBancoChange = (codigo: string) => {
        const banco = BANCOS_BRASIL.find((b) => b.codigo === codigo);
        setForm((prev) => ({
            ...prev,
            banco_codigo: codigo,
            banco_nome: banco?.nome ?? prev.banco_nome,
        }));
    };

    const handleSubmit = () => {
        if (!form.empresa_id) return toast.error("Selecione uma empresa.");
        if (!form.banco_codigo) return toast.error("Selecione o banco.");
        if (!form.agencia) return toast.error("Informe a agência.");
        if (!form.conta) return toast.error("Informe o número da conta.");
        if (!form.cedente_nome) return toast.error("Informe o nome do favorecido/cedente.");
        if (!form.cedente_cnpj) return toast.error("Informe o CNPJ do titular.");

        saveMutation.mutate(form);
    };

    const updateField = (field: keyof ContaBancariaCreatePayload, value: any) => {
        // Track manual edits to prevent overwriting
        if (field !== "empresa_id") {
            manuallyEdited.current.add(field);
        }
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    // -------- Auto-fill from empresa --------
    const handleEmpresaChange = useCallback((empresaId: string) => {
        setForm((prev) => ({ ...prev, empresa_id: empresaId }));

        if (!empresaId) {
            setEmpresaMissingFields([]);
            setExistingContaForEmpresa(null);
            return;
        }

        const empresa = empresas.find((e: any) => e.id === empresaId);
        if (!empresa) {
            setEmpresaMissingFields([]);
            setExistingContaForEmpresa(null);
            return;
        }

        // Check for existing bank accounts for this empresa
        const existingConta = contas.find((c) => c.empresa_id === empresaId && c.ativo);
        setExistingContaForEmpresa(existingConta ?? null);

        // Build auto-fill map from empresa banking data
        const autoFillMap: Partial<ContaBancariaCreatePayload> = {};
        const missing: string[] = [];

        // Banco código
        if (empresa.banco_codigo) {
            autoFillMap.banco_codigo = empresa.banco_codigo;
            const bancoRef = BANCOS_BRASIL.find((b) => b.codigo === empresa.banco_codigo);
            autoFillMap.banco_nome = bancoRef?.nome ?? empresa.banco_codigo;
        } else {
            missing.push("Código do Banco");
        }

        // Agência
        if (empresa.agencia) {
            autoFillMap.agencia = empresa.agencia;
        } else {
            missing.push("Agência");
        }

        // Dígito Agência
        if (empresa.agencia_digito) {
            autoFillMap.agencia_digito = empresa.agencia_digito;
        }

        // Conta
        if (empresa.conta) {
            autoFillMap.conta = empresa.conta;
        } else {
            missing.push("Conta");
        }

        // Dígito Conta
        if (empresa.conta_digito) {
            autoFillMap.conta_digito = empresa.conta_digito;
        }

        // Convênio
        if (empresa.convenio_bancario) {
            autoFillMap.convenio = empresa.convenio_bancario;
        }

        // CNPJ titular from empresa
        if (empresa.cnpj) {
            autoFillMap.cedente_cnpj = empresa.cnpj;
        } else {
            missing.push("CNPJ");
        }

        // Favorecido / Cedente = razão social / nome da empresa
        if (empresa.nome) {
            autoFillMap.cedente_nome = empresa.nome;
            autoFillMap.favorecido = empresa.nome;
        } else {
            missing.push("Favorecido");
        }

        setEmpresaMissingFields(missing);

        // Apply auto-fill only to fields NOT manually edited
        setForm((prev) => {
            const updated = { ...prev, empresa_id: empresaId };
            for (const [key, value] of Object.entries(autoFillMap)) {
                const field = key as keyof ContaBancariaCreatePayload;
                if (!manuallyEdited.current.has(field)) {
                    // Only fill if currently empty
                    const currentValue = prev[field];
                    if (!currentValue || currentValue === "") {
                        (updated as any)[field] = value;
                    }
                }
            }
            return updated;
        });

        if (missing.length > 0) {
            toast.info(`${missing.length} campo(s) bancário(s) ausentes no cadastro da empresa.`, { duration: 4000 });
        }
    }, [empresas, contas]);

    // Load all fields from an existing conta
    const useExistingConta = useCallback((conta: ContaBancariaEmpresa) => {
        setForm((prev) => ({
            ...prev,
            banco_codigo: conta.banco_codigo ?? prev.banco_codigo,
            banco_nome: conta.banco_nome ?? prev.banco_nome,
            agencia: conta.agencia ?? prev.agencia,
            agencia_digito: conta.agencia_digito ?? prev.agencia_digito ?? "",
            conta: conta.conta ?? prev.conta,
            conta_digito: conta.conta_digito ?? prev.conta_digito ?? "",
            convenio: conta.convenio ?? prev.convenio ?? "",
            carteira: conta.carteira ?? prev.carteira ?? "",
            variacao_carteira: conta.variacao_carteira ?? prev.variacao_carteira ?? "",
            cedente_nome: conta.cedente_nome ?? prev.cedente_nome,
            cedente_cnpj: conta.cedente_cnpj ?? prev.cedente_cnpj,
            tipo_conta: conta.tipo_conta ?? prev.tipo_conta,
            tipo_servico: conta.tipo_servico ?? prev.tipo_servico ?? "pagamento",
            favorecido: conta.favorecido ?? prev.favorecido ?? "",
            chave_pix: conta.chave_pix ?? prev.chave_pix ?? "",
        }));
        setExistingContaForEmpresa(null);
        toast.success("Dados da conta existente carregados.");
    }, []);

    return (
        <AppShell title="Contas Bancárias" subtitle="Gerenciamento de contas e carteiras de cobrança">
            <div className="max-w-[1700px] w-full mx-auto space-y-6 animate-in fade-in duration-500">

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-5 border-border bg-card/50 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Total contas</p>
                        <p className="text-3xl font-extrabold text-foreground">{totalContas}</p>
                    </Card>
                    <Card className="p-5 border-border bg-card/50 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Ativas</p>
                        <p className="text-3xl font-extrabold text-success">{contasAtivas}</p>
                    </Card>
                    <Card className="p-5 border-border bg-card/50 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Habilitadas CNAB</p>
                        <p className="text-3xl font-extrabold text-primary">{contasCnab}</p>
                    </Card>
                    <Card className="p-5 border-border bg-card/50 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">Empresas c/ conta</p>
                        <p className="text-3xl font-extrabold text-foreground">{empresasComConta}</p>
                    </Card>
                </div>

                {/* Filters + Actions */}
                <Card className="p-4 border-border bg-card">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md flex-1 max-w-md border border-border">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar por banco, empresa, agência..."
                                    className="bg-transparent border-none outline-none text-sm w-full text-foreground font-medium"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                                <SelectTrigger className="w-[220px] h-10 bg-muted/20 border-border/50">
                                    <SelectValue placeholder="Todas as empresas" />
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
                            {(search || filterEmpresa) && (
                                <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFilterEmpresa(""); }}>
                                    Limpar filtros
                                </Button>
                            )}
                        </div>
                        <Button className="font-bold gap-2" onClick={openCreate}>
                            <Plus className="w-4 h-4" />
                            Nova Conta
                        </Button>
                    </div>
                </Card>

                {/* Table */}
                <Card className="overflow-hidden border-border bg-card shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="esc-table-header">
                            <tr className="text-left">
                                <th className="px-5 h-11 font-medium">Empresa</th>
                                <th className="px-3 h-11 font-medium">Banco</th>
                                <th className="px-3 h-11 font-medium">Agência</th>
                                <th className="px-3 h-11 font-medium">Conta</th>
                                <th className="px-3 h-11 font-medium">Tipo</th>
                                <th className="px-3 h-11 font-medium">Favorecido</th>
                                <th className="px-3 h-11 font-medium text-center">CNAB</th>
                                <th className="px-3 h-11 font-medium text-center">Status</th>
                                <th className="px-5 h-11 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                                        Carregando contas...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                                                <Landmark className="w-8 h-8 text-muted-foreground/30" />
                                            </div>
                                            <p className="text-sm">Nenhuma conta bancária cadastrada.</p>
                                            <Button variant="outline" size="sm" onClick={openCreate} className="gap-2">
                                                <Plus className="w-3 h-3" />
                                                Cadastrar primeira conta
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((conta) => (
                                    <tr key={conta.id} className="border-t border-muted hover:bg-muted/20 transition-colors">
                                        <td className="px-5 h-[56px]">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                                                <span className="font-medium text-foreground">{conta.empresas?.nome || "—"}</span>
                                                {conta.is_padrao && (
                                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] px-1.5">
                                                        PADRÃO
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3">
                                            <div>
                                                <p className="font-semibold text-foreground text-xs">{conta.banco_nome}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono">{conta.banco_codigo}</p>
                                            </div>
                                        </td>
                                        <td className="px-3 font-mono text-foreground">
                                            {conta.agencia}{conta.agencia_digito ? `-${conta.agencia_digito}` : ""}
                                        </td>
                                        <td className="px-3 font-mono text-foreground">
                                            {maskConta(conta.conta, conta.conta_digito)}
                                        </td>
                                        <td className="px-3">
                                            <Badge variant="outline" className="text-[10px] capitalize">
                                                {conta.tipo_conta}
                                            </Badge>
                                        </td>
                                        <td className="px-3 text-sm text-foreground max-w-[200px] truncate">
                                            {conta.favorecido || conta.cedente_nome || "—"}
                                        </td>
                                        <td className="px-3 text-center">
                                            {conta.permite_cnab ? (
                                                <Badge className="bg-success-soft text-success-strong text-[9px]">CNAB</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] text-muted-foreground">Não</Badge>
                                            )}
                                        </td>
                                        <td className="px-3 text-center">
                                            {conta.ativo ? (
                                                <Badge className="bg-success-soft text-success-strong text-[9px]">Ativa</Badge>
                                            ) : (
                                                <Badge className="bg-destructive-soft text-destructive-strong text-[9px]">Inativa</Badge>
                                            )}
                                        </td>
                                        <td className="px-5 text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                                    onClick={() => openEdit(conta)}
                                                >
                                                    <Edit className="w-3 h-3" />
                                                    Editar
                                                </Button>
                                                {conta.ativo && conta.empresa_id && !conta.is_padrao && (
                                                    <Button
                                                        variant="ghost" size="sm"
                                                        className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-500 gap-1"
                                                        onClick={() => setPadraoMutation.mutate({ id: conta.id, empresaId: conta.empresa_id! })}
                                                    >
                                                        <Star className="w-3 h-3" />
                                                        Padrão
                                                    </Button>
                                                )}
                                                {conta.is_padrao && (
                                                    <span className="inline-flex items-center gap-1 h-8 px-2 text-xs text-amber-500 font-medium">
                                                        <Star className="w-3 h-3 fill-amber-400" />
                                                        Padrão
                                                    </span>
                                                )}
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className={cn("h-8 px-2 text-xs gap-1", conta.permite_cnab ? "text-success hover:text-success/80" : "text-muted-foreground hover:text-primary")}
                                                    onClick={() => toggleCnabMutation.mutate({ id: conta.id, permite_cnab: !conta.permite_cnab })}
                                                >
                                                    <ShieldCheck className="w-3 h-3" />
                                                    {conta.permite_cnab ? "CNAB on" : "CNAB off"}
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className={cn("h-8 px-2 text-xs gap-1", conta.ativo ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-success")}
                                                    onClick={() => toggleAtivoMutation.mutate({ id: conta.id, ativo: !conta.ativo })}
                                                >
                                                    {conta.ativo ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                                                    {conta.ativo ? "Desativar" : "Ativar"}
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                                                    onClick={() => setDeleteConfirm(conta.id)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Excluir
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>

                {/* Delete Confirm */}
                <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Excluir conta bancária?</DialogTitle>
                            <DialogDescription>
                                Esta ação não pode ser desfeita. Se a conta já foi usada em remessas CNAB, considere desativá-la ao invés de excluir.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                            <Button
                                variant="destructive"
                                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Excluir permanentemente
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create/Edit Modal */}
                <Dialog open={showModal} onOpenChange={(open) => !open && closeModal()}>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" />
                                {editingId ? "Editar Conta Bancária" : "Nova Conta Bancária"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingId
                                    ? "Atualize os dados da conta bancária empresarial."
                                    : "Cadastre uma nova conta bancária para utilização em operações financeiras e CNAB."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-2">
                            {/* Empresa */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3" /> Empresa <span className="text-destructive">*</span>
                                </Label>
                                <Select value={form.empresa_id} onValueChange={handleEmpresaChange}>
                                    <SelectTrigger className="h-11 bg-muted/20">
                                        <SelectValue placeholder="Selecione a empresa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {empresas.map((emp: any) => (
                                            <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Existing account warning */}
                                {!editingId && existingContaForEmpresa && (
                                    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                                        <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-amber-600">
                                                Esta empresa já possui conta bancária cadastrada
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {existingContaForEmpresa.banco_nome} — Ag. {existingContaForEmpresa.agencia}
                                                {existingContaForEmpresa.agencia_digito ? `-${existingContaForEmpresa.agencia_digito}` : ""}
                                                {" "} Cc. {existingContaForEmpresa.conta}
                                                {existingContaForEmpresa.conta_digito ? `-${existingContaForEmpresa.conta_digito}` : ""}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="mt-2 h-7 text-xs font-bold border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                                                onClick={() => useExistingConta(existingContaForEmpresa)}
                                            >
                                                Usar conta existente
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Missing fields warning */}
                                {!editingId && empresaMissingFields.length > 0 && (
                                    <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-400/30 bg-orange-400/5">
                                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-orange-600">
                                                Campos ausentes no cadastro da empresa
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                {empresaMissingFields.join(", ")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Banco */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                        <Landmark className="w-3 h-3" /> Banco <span className="text-destructive">*</span>
                                    </Label>
                                    <Select value={form.banco_codigo} onValueChange={handleBancoChange}>
                                        <SelectTrigger className="h-11 bg-muted/20">
                                            <SelectValue placeholder="Selecione o banco" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {BANCOS_BRASIL.map((b) => (
                                                <SelectItem key={b.codigo} value={b.codigo}>
                                                    {b.codigo} — {b.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo de conta <span className="text-destructive">*</span></Label>
                                    <Select value={form.tipo_conta} onValueChange={(v) => updateField("tipo_conta", v)}>
                                        <SelectTrigger className="h-11 bg-muted/20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="corrente">Conta Corrente</SelectItem>
                                            <SelectItem value="poupanca">Conta Poupança</SelectItem>
                                            <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                                            <SelectItem value="salario">Conta Salário</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Agência + conta */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Agência <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={form.agencia}
                                        onChange={(e) => updateField("agencia", e.target.value.replace(/\D/g, ""))}
                                        placeholder="0001"
                                        className="h-11 bg-muted/20 font-mono"
                                        maxLength={6}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Dígito Ag</Label>
                                    <Input
                                        value={form.agencia_digito ?? ""}
                                        onChange={(e) => updateField("agencia_digito", e.target.value)}
                                        placeholder="X"
                                        className="h-11 bg-muted/20 font-mono"
                                        maxLength={2}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Conta <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={form.conta}
                                        onChange={(e) => updateField("conta", e.target.value.replace(/\D/g, ""))}
                                        placeholder="12345"
                                        className="h-11 bg-muted/20 font-mono"
                                        maxLength={12}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Dígito Cc</Label>
                                    <Input
                                        value={form.conta_digito ?? ""}
                                        onChange={(e) => updateField("conta_digito", e.target.value)}
                                        placeholder="X"
                                        className="h-11 bg-muted/20 font-mono"
                                        maxLength={2}
                                    />
                                </div>
                            </div>

                            {/* Convênio / Carteira (Banco do Brasil) */}
                            {form.banco_codigo === "001" && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Convênio</Label>
                                        <Input
                                            value={form.convenio ?? ""}
                                            onChange={(e) => updateField("convenio", e.target.value)}
                                            placeholder="Nº convênio"
                                            className="h-11 bg-muted/20 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Carteira</Label>
                                        <Input
                                            value={form.carteira ?? ""}
                                            onChange={(e) => updateField("carteira", e.target.value)}
                                            placeholder="17"
                                            className="h-11 bg-muted/20 font-mono"
                                            maxLength={3}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Variação Carteira</Label>
                                        <Input
                                            value={form.variacao_carteira ?? ""}
                                            onChange={(e) => updateField("variacao_carteira", e.target.value)}
                                            placeholder="019"
                                            className="h-11 bg-muted/20 font-mono"
                                            maxLength={3}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Favorecido / CNPJ */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Favorecido / Cedente <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={form.cedente_nome}
                                        onChange={(e) => updateField("cedente_nome", e.target.value)}
                                        placeholder="Razão social do titular"
                                        className="h-11 bg-muted/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">CNPJ Titular <span className="text-destructive">*</span></Label>
                                    <Input
                                        value={form.cedente_cnpj}
                                        onChange={(e) => updateField("cedente_cnpj", formatCNPJ(e.target.value))}
                                        placeholder="00.000.000/0001-00"
                                        className="h-11 bg-muted/20 font-mono"
                                        maxLength={18}
                                    />
                                </div>
                            </div>

                            {/* Favorecido alias + Chave PIX */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Nome do Favorecido (Alias)</Label>
                                    <Input
                                        value={form.favorecido ?? ""}
                                        onChange={(e) => updateField("favorecido", e.target.value)}
                                        placeholder="Apelido exibido no CNAB"
                                        className="h-11 bg-muted/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Chave PIX (opcional)</Label>
                                    <Input
                                        value={form.chave_pix ?? ""}
                                        onChange={(e) => updateField("chave_pix", e.target.value)}
                                        placeholder="CNPJ, e-mail, telefone ou aleatória"
                                        className="h-11 bg-muted/20"
                                    />
                                </div>
                            </div>

                            {/* Switches */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 rounded-xl border border-border/50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Conta ativa</Label>
                                    <Switch
                                        checked={form.ativo ?? true}
                                        onCheckedChange={(v) => updateField("ativo", v)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Permite CNAB</Label>
                                    <Switch
                                        checked={form.permite_cnab ?? true}
                                        onCheckedChange={(v) => updateField("permite_cnab", v)}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Conta padrão</Label>
                                    <Switch
                                        checked={form.is_padrao ?? false}
                                        onCheckedChange={(v) => updateField("is_padrao", v)}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
                            <Button
                                className="font-bold gap-2"
                                onClick={handleSubmit}
                                disabled={saveMutation.isPending}
                            >
                                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingId ? "Salvar alterações" : "Cadastrar conta"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppShell>
    );
};

export default ContasBancarias;
