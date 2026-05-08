import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { EmpresaService } from "@/services/base.service";
import { useTenant } from "@/contexts/TenantContext";
import { useOnboardingCallback } from "@/hooks/useOnboardingCallback";
import { Button } from "@/components/ui/button";
import { Plus, Building2, MapPin, Users, Cpu, Loader2, RefreshCw, Pencil, Trash2, AlertTriangle, LayoutGrid, List, Upload } from "lucide-react";
import { SpreadsheetUploadModal } from "@/components/shared/SpreadsheetUploadModal";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const VALID_DB_COLUMNS_EMPRESAS = [
  'nome', 'cnpj', 'unidade', 'cidade', 'estado',
  'status', 'banco_codigo', 'agencia', 'agencia_digito',
  'conta', 'conta_digito', 'convenio_bancario',
  'codigo_empresa_banco', 'nome_empresa_banco',
  'tenant_id', 'id', 'created_at', 'updated_at'
];

function sanitizeEmpresaPayload(form: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const key of VALID_DB_COLUMNS_EMPRESAS) {
    if (form[key] !== undefined) {
      sanitized[key] = form[key] === '' ? null : form[key];
    }
  }
  return sanitized;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function validateCNPJ(cnpj: string): { valid: boolean; reason?: string } {
  if (!cnpj || cnpj.trim() === '') return { valid: false, reason: 'CNPJ é obrigatório.' };
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return { valid: false, reason: 'CNPJ deve ter 14 dígitos.' };
  if (/^(.)\1+$/.test(digits)) return { valid: false, reason: 'CNPJ inválido.' };
  return { valid: true };
}

const Empresas = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { isOnboardingReturn, handleOnboardingReturn } = useOnboardingCallback();
  const [open, setOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    unidade: "",
    cidade: "",
    estado: "",
    banco_codigo: "",
    agencia: "",
    agencia_digito: "",
    conta: "",
    conta_digito: "",
    convenio_bancario: "",
    codigo_empresa_banco: "",
    nome_empresa_banco: "",
  });

  const reset = () => {
    setForm({
      nome: "", cnpj: "", unidade: "", cidade: "", estado: "",
      banco_codigo: "", agencia: "", agencia_digito: "", conta: "",
      conta_digito: "", convenio_bancario: "", codigo_empresa_banco: "",
      nome_empresa_banco: ""
    });
    setEditingId(null);
    setFormErrors({});
  };

  // RLS garante que a query retorna apenas empresas do tenant logado
  const { data: list = [], isLoading, isFetching, isError, error: queryError } = useQuery({
    queryKey: ["empresas", tenantId],
    queryFn: () => EmpresaService.getWithCounts(),
    retry: 1,
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => editingId
      ? EmpresaService.update(editingId, payload)
      : EmpresaService.create(payload),
    onSuccess: () => {
      toast.success(editingId ? "Empresa atualizada com sucesso." : "Empresa cadastrada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setOpen(false);
      reset();
      
      // Se veio do onboarding, redirecionar de volta
      const params = new URLSearchParams(window.location.search);
      if (params.get("onboarding_return") === "true") {
        window.location.href = "/onboarding";
      }
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('já existe')) {
        toast.error("Já existe uma empresa cadastrada com este CNPJ.", { duration: 5000 });
      } else {
        toast.error(editingId ? "Erro ao atualizar empresa." : "Erro ao salvar empresa.", { description: msg });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await EmpresaService.deleteWithCheck(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Empresa removida com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (err: any) => {
      const msg = err?.message || '';
      toast.error(msg || "Erro ao remover empresa.");
    }
  });

  const handleEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      nome: e.nome,
      cnpj: e.cnpj,
      unidade: e.unidade,
      cidade: e.cidade,
      estado: e.estado,
      banco_codigo: e.banco_codigo || "",
      agencia: e.agencia || "",
      agencia_digito: e.agencia_digito || "",
      conta: e.conta || "",
      conta_digito: e.conta_digito || "",
      convenio_bancario: e.convenio_bancario || "",
      codigo_empresa_banco: e.codigo_empresa_banco || "",
      nome_empresa_banco: e.nome_empresa_banco || "",
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta empresa? Colaboradores e registros vinculados serão afetados.")) {
      deleteMutation.mutate(id);
    }
  };

  const submit = () => {
    const errors: Record<string, string> = {};

    if (!form.nome.trim()) errors.nome = "Nome da empresa é obrigatório.";
    if (!form.cnpj.trim()) errors.cnpj = "CNPJ é obrigatório.";
    if (!form.unidade.trim()) errors.unidade = "Unidade é obrigatória.";
    if (!form.cidade.trim()) errors.cidade = "Cidade é obrigatória.";
    if (!form.estado.trim()) errors.estado = "Estado é obrigatório.";

    const cnpjValidation = validateCNPJ(form.cnpj);
    if (!cnpjValidation.valid && form.cnpj.trim()) {
      errors.cnpj = cnpjValidation.reason!;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setFormErrors({});
    const sanitizedPayload = sanitizeEmpresaPayload(form);
    createMutation.mutate(sanitizedPayload);
  };

  const handleImport = async (data: any[]) => {
    let count = 0;
    try {
      // Importa as empresas processando as colunas comuns
      for (const row of data) {
        const nome = row['Nome'] || row['nome'] || row['NOME'];
        if (!nome) continue; // Pula linhas sem nome

        const cnpj = row['CNPJ'] || row['cnpj'] || '';
        const unidade = row['Unidade'] || row['unidade'] || '';
        const cidade = row['Cidade'] || row['cidade'] || '';
        const estado = row['Estado'] || row['estado'] || '';

        await EmpresaService.create({ nome, cnpj, unidade, cidade, estado });
        count++;
      }
      toast.success(`${count} empresas importadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    } catch (e: any) {
      toast.error("Erro parcial na importação. Algumas empresas podem não ter sido inseridas.", {
        description: e.message
      });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    }
  };

  return (
    <AppShell title="Empresas" subtitle="Cadastro de empresas e unidades operacionais">
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-background p-2 rounded-lg border border-border/50">
          <div className="flex border rounded-lg overflow-hidden bg-background">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-none border-r transition-all", viewMode === 'grid' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-none transition-all", viewMode === 'table' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => queryClient.invalidateQueries({ queryKey: ["empresas"] })}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button variant="outline" className="h-9 px-4 font-medium text-sm" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Planilha
            </Button>
            <Button className="h-9 px-4 font-display font-semibold text-sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova empresa
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground animate-pulse">Carregando unidades...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card text-center">
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h3 className="font-display font-semibold text-foreground">Falha ao obter empresas</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-md">
              {(queryError as any)?.message || "Erro desconhecido ao carregar dados operacionais."}
            </p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["empresas"] })}>
              Tentar reconectar
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card border-dashed">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground italic">Nenhuma empresa cadastrada ainda.</p>
            <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
              Cadastrar primeira empresa
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((e: any) => (
              <article key={e.id} className="esc-card p-5 group relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary-soft flex items-center justify-center text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "esc-chip",
                        e.cadastro_provisorio
                          ? "bg-warning-soft text-warning-strong"
                          : e.status === "ativa"
                            ? "bg-success-soft text-success-strong"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {e.cadastro_provisorio ? "Provisório" : e.status === "ativa" ? "Ativa" : "Inativa"}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-foreground">{e.nome}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{e.cnpj}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-2">
                  <MapPin className="h-3 w-3" /> {e.unidade} — {e.cidade}/{e.estado}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
                  <Stat icon={<Users className="h-3.5 w-3.5" />} label="Colaboradores" value={e.total_colaboradores} />
                  <Stat icon={<Cpu className="h-3.5 w-3.5" />} label="Coletores" value={e.total_coletores} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="esc-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">Empresa</th>
                  <th className="px-3 h-11 font-medium">CNPJ</th>
                  <th className="px-3 h-11 font-medium text-center">Colaboradores</th>
                  <th className="px-3 h-11 font-medium text-center">Coletores</th>
                  <th className="px-3 h-11 font-medium text-center">Status</th>
                  <th className="px-5 h-11 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {list.map((e: any) => (
                  <tr key={e.id} className="hover:bg-background group">
                    <td className="px-5 h-14">
                      <div className="font-medium text-foreground">{e.nome}</div>
                      <div className="text-xs text-muted-foreground">{e.unidade} — {e.cidade}/{e.estado}</div>
                    </td>
                    <td className="px-3 text-muted-foreground font-mono text-xs">{e.cnpj}</td>
                    <td className="px-3 text-center font-bold text-primary">{e.total_colaboradores}</td>
                    <td className="px-3 text-center">{e.total_coletores}</td>
                    <td className="px-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-tight",
                        e.cadastro_provisorio
                          ? 'bg-warning-soft text-warning-strong'
                          : e.status === 'ativa'
                            ? 'bg-success-soft text-success-strong'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {e.cadastro_provisorio ? 'provisório' : e.status}
                      </span>
                    </td>
                    <td className="px-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize as informações da unidade operacional." : "Cadastre uma nova unidade operacional no sistema."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome da Empresa <span className="text-destructive">*</span></Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => {
                  setForm({ ...form, nome: e.target.value });
                  if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' });
                }}
                className={formErrors.nome ? "border-destructive" : ""}
              />
              {formErrors.nome && <p className="text-xs text-destructive mt-1">{formErrors.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ <span className="text-destructive">*</span></Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(e) => {
                  const formatted = formatCNPJ(e.target.value);
                  setForm({ ...form, cnpj: formatted });
                  if (formErrors.cnpj) setFormErrors({ ...formErrors, cnpj: '' });
                }}
                placeholder="00.000.000/0001-00"
                className={formErrors.cnpj ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {formErrors.cnpj && <p className="text-xs text-destructive mt-1">{formErrors.cnpj}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="unidade">Unidade (Filial) <span className="text-destructive">*</span></Label>
                <Input
                  id="unidade"
                  value={form.unidade}
                  onChange={(e) => {
                    setForm({ ...form, unidade: e.target.value });
                    if (formErrors.unidade) setFormErrors({ ...formErrors, unidade: '' });
                  }}
                  className={formErrors.unidade ? "border-destructive" : ""}
                />
                {formErrors.unidade && <p className="text-xs text-destructive mt-1">{formErrors.unidade}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade <span className="text-destructive">*</span></Label>
                <Input
                  id="cidade"
                  value={form.cidade}
                  onChange={(e) => {
                    setForm({ ...form, cidade: e.target.value });
                    if (formErrors.cidade) setFormErrors({ ...formErrors, cidade: '' });
                  }}
                  className={formErrors.cidade ? "border-destructive" : ""}
                />
                {formErrors.cidade && <p className="text-xs text-destructive mt-1">{formErrors.cidade}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estado">Estado (UF) <span className="text-destructive">*</span></Label>
              <Input
                id="estado"
                value={form.estado}
                onChange={(e) => {
                  setForm({ ...form, estado: e.target.value.toUpperCase().slice(0, 2) });
                  if (formErrors.estado) setFormErrors({ ...formErrors, estado: '' });
                }}
                maxLength={2}
                className={formErrors.estado ? "border-destructive" : ""}
              />
              {formErrors.estado && <p className="text-xs text-destructive mt-1">{formErrors.estado}</p>}
            </div>

            {/* Secao Dados Bancarios */}
            <div className="col-span-full border-t pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-3">Dados Bancários</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="banco_codigo">Cód. Banco</Label>
                  <Input id="banco_codigo" value={form.banco_codigo} onChange={(e) => setForm({ ...form, banco_codigo: e.target.value })} placeholder="Ex: 341" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agencia">Agência</Label>
                  <div className="flex gap-2">
                    <Input id="agencia" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} className="flex-1" />
                    <Input id="agencia_digito" value={form.agencia_digito} onChange={(e) => setForm({ ...form, agencia_digito: e.target.value })} className="w-16" placeholder="Díg." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conta">Conta</Label>
                  <div className="flex gap-2">
                    <Input id="conta" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className="flex-1" />
                    <Input id="conta_digito" value={form.conta_digito} onChange={(e) => setForm({ ...form, conta_digito: e.target.value })} className="w-16" placeholder="Díg." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="convenio_bancario">Convênio</Label>
                  <Input id="convenio_bancario" value={form.convenio_bancario} onChange={(e) => setForm({ ...form, convenio_bancario: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SpreadsheetUploadModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Importar Empresas"
        description="Envie uma planilha CSV ou Excel com as colunas: Nome, CNPJ, Unidade, Cidade, Estado."
        onUpload={handleImport}
      />
    </AppShell>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div>
    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">{icon} {label}</div>
    <div className="font-display font-semibold text-foreground text-lg">{value}</div>
  </div>
);

export default Empresas;
