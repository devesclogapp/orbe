import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  InfracoesCatalogoService,
  InfracaoCatalogo,
  InfracaoInput,
  CategoriaInfracao,
} from "@/services/domain/infracoesCatalogo.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Plus,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

export const InfracoesOperacionaisSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InfracaoCatalogo | null>(null);

  // Form states
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaInfracao>("OPERACIONAL");
  const [valorReferencia, setValorReferencia] = useState<number>(0);
  const [exigeDanoMaterial, setExigeDanoMaterial] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [fundamentacaoPadrao, setFundamentacaoPadrao] = useState("");
  const [ativo, setAtivo] = useState(true);

  const { data: infracoes = [], isLoading } = useQuery({
    queryKey: ["infracoes_operacionais_catalogo"],
    queryFn: () => InfracoesCatalogoService.listarTodos(),
    staleTime: 1000 * 60 * 5,
  });

  const openNewModal = () => {
    setEditingItem(null);
    setCodigo("");
    setNome("");
    setCategoria("OPERACIONAL");
    setValorReferencia(0);
    setExigeDanoMaterial(false);
    setDescricao("");
    setFundamentacaoPadrao("Art. 462 da CLT - Desconto condicionado à comprovação de culpa/dolo e dano apurado.");
    setAtivo(true);
    setModalOpen(true);
  };

  const openEditModal = (item: InfracaoCatalogo) => {
    setEditingItem(item);
    setCodigo(item.codigo);
    setNome(item.nome);
    setCategoria(item.categoria);
    setValorReferencia(Number(item.valor_referencia || 0));
    setExigeDanoMaterial(Boolean(item.exige_dano_material));
    setDescricao(item.descricao || "");
    setFundamentacaoPadrao(item.fundamentacao_padrao || "");
    setAtivo(Boolean(item.ativo));
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("O nome da infração é obrigatório.");
      if (valorReferencia < 0) throw new Error("O valor de referência não pode ser negativo.");

      const input: InfracaoInput = {
        codigo: codigo || nome.trim().toUpperCase().replace(/\s+/g, "_"),
        nome: nome.trim(),
        categoria,
        descricao: descricao.trim() || undefined,
        valor_referencia: valorReferencia,
        exige_dano_material: exigeDanoMaterial,
        fundamentacao_padrao: fundamentacaoPadrao.trim() || undefined,
        ativo,
      };

      if (editingItem) {
        return InfracoesCatalogoService.atualizar(editingItem.id, input);
      } else {
        return InfracoesCatalogoService.cadastrar(input);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infracoes_operacionais_catalogo"] });
      toast.success(editingItem ? "Infração atualizada com sucesso!" : "Infração cadastrada com sucesso!");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar infração", { description: err.message });
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ item, novoStatus }: { item: InfracaoCatalogo; novoStatus: boolean }) => {
      return InfracoesCatalogoService.atualizar(item.id, { ativo: novoStatus });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["infracoes_operacionais_catalogo"] });
      toast.success(vars.novoStatus ? "Infração ativada" : "Infração desativada");
    },
    onError: (err: any) => {
      toast.error("Falha ao alterar status", { description: err.message });
    },
  });

  const renderBadgeCategoria = (cat: CategoriaInfracao) => {
    switch (cat) {
      case "OPERACIONAL":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">Operacional</Badge>;
      case "DISCIPLINAR":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">Disciplinar</Badge>;
      case "SEGURANCA":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">Segurança</Badge>;
      case "QUALIDADE":
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">Qualidade</Badge>;
      default:
        return <Badge variant="outline">{cat}</Badge>;
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <h3 className="font-display font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Infrações Operacionais e Descontos Provisórios
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Catálogo de condutas, ocorrências e valores monetários de referência para apuração de dano e desconto provisório.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openNewModal}
          className="rounded-lg text-xs font-medium shrink-0 h-9 px-4 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Infração
        </Button>
      </div>

      <div className="bg-muted/40 p-3.5 rounded-lg border border-border/70 text-xs space-y-1 text-muted-foreground">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span>Diretriz Jurídica e de Governança (Art. 462 da CLT)</span>
        </div>
        <p>
          Os valores de referência cadastrados abaixo alimentam o <strong>desconto provisório</strong> durante o lançamento de serviços pelo Encarregado. O desconto <strong>não é automático</strong>: qualquer dedução oficial em folha de pagamento ou lote de diárias exige comprovação de dano, apuração de responsabilidade e autorização formal do Admin/RH.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando catálogo...
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="p-3">Nome / Código</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Valor Ref. (Provisório)</th>
                <th className="p-3">Exige Dano Material</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {infracoes.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-foreground">{item.nome}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{item.codigo}</div>
                  </td>
                  <td className="p-3">{renderBadgeCategoria(item.categoria)}</td>
                  <td className="p-3 font-mono font-medium text-foreground">
                    {Number(item.valor_referencia || 0) > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        R$ {Number(item.valor_referencia).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sem valor (Apenas Disciplinar)</span>
                    )}
                  </td>
                  <td className="p-3">
                    {item.exige_dano_material ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
                        Sim (Dano Físico)
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Não</span>
                    )}
                  </td>
                  <td className="p-3">
                    {item.ativo ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px] bg-emerald-50 dark:bg-emerald-950/40">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-zinc-300 text-zinc-500 text-[10px]">
                        Inativo
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-7 px-2 text-xs ${item.ativo ? "text-rose-600 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-700"}`}
                        onClick={() => toggleAtivoMutation.mutate({ item, novoStatus: !item.ativo })}
                      >
                        {item.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingItem ? "Editar Infração Operacional" : "Nova Infração Operacional"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure a infração, valor provisório de referência e requisitos legais aplicáveis para eventual ressarcimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nome da Infração *</Label>
                <Input
                  placeholder="Ex: Avaria de Pallet"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Código Identificador *</Label>
                <Input
                  placeholder="Ex: AVARIA_PALLET"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  className="text-xs h-8 font-mono"
                  disabled={!!editingItem}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={categoria} onValueChange={(val) => setCategoria(val as CategoriaInfracao)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERACIONAL">Operacional</SelectItem>
                    <SelectItem value="DISCIPLINAR">Disciplinar</SelectItem>
                    <SelectItem value="SEGURANCA">Segurança</SelectItem>
                    <SelectItem value="QUALIDADE">Qualidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Valor de Referência (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorReferencia}
                  onChange={(e) => setValorReferencia(parseFloat(e.target.value) || 0)}
                  className="text-xs h-8 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded border border-border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Exige Comprovação de Dano Material</Label>
                <p className="text-[10px] text-muted-foreground">
                  Obrigatório relatório fotográfico ou laudo técnico de avaria da mercadoria/veículo.
                </p>
              </div>
              <Switch checked={exigeDanoMaterial} onCheckedChange={setExigeDanoMaterial} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Descrição Operacional</Label>
              <Textarea
                placeholder="Detalhes de como a infração ocorre e procedimentos na doca."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Fundamentação Legal Padrão (Art. 462 CLT)</Label>
              <Textarea
                placeholder="Condições legais exigidas para desconto (previsão contratual expressa, dolo ou culpa)."
                value={fundamentacaoPadrao}
                onChange={(e) => setFundamentacaoPadrao(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs font-semibold">Infração Ativa no Catálogo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              {editingItem ? "Salvar Alterações" : "Cadastrar Infração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

