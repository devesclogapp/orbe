import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { RegraCampo, RegrasCamposService } from "@/services/base.service";

interface ManageFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduloId: number;
}

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção (Dropdown)" },
  { value: "boolean", label: "Sim/Não (Checkbox)" },
  { value: "date", label: "Data" },
];

const ManageFieldsModal: React.FC<ManageFieldsModalProps> = ({ isOpen, onClose, moduloId }) => {
  console.log("ManageFieldsModal render:", { isOpen, moduloId });
  const queryClient = useQueryClient();

  const [currentField, setCurrentField] = useState<Partial<RegraCampo> | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<RegraCampo | null>(null);

  const { data: campos = [], isLoading: isLoadingCampos } = useQuery<RegraCampo[]>({
    queryKey: ["regras_campos", moduloId],
    queryFn: () => RegrasCamposService.listarPorModulo(moduloId),
    enabled: isOpen && !!moduloId,
  });

  useEffect(() => {
    if (!isOpen) {
      setCurrentField(null);
      setEditingFieldId(null);
      setFieldToDelete(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setCurrentField(null);
    setEditingFieldId(null);
  };

  const createCampoMutation = useMutation({
    mutationFn: (newCampo: Omit<RegraCampo, "id">) => RegrasCamposService.criar(newCampo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_campos", moduloId] });
      toast.success("Campo criado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao criar campo.", { description: error.message });
    },
  });

  const updateCampoMutation = useMutation({
    mutationFn: ({ id, updatedCampo }: { id: number; updatedCampo: Partial<RegraCampo> }) =>
      RegrasCamposService.atualizar(id, updatedCampo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_campos", moduloId] });
      toast.success("Campo atualizado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar campo.", { description: error.message });
    },
  });

  const deleteCampoMutation = useMutation({
    mutationFn: (id: number) => RegrasCamposService.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_campos", moduloId] });
      toast.success("Campo excluído com sucesso!");
      setFieldToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir campo.", { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentField?.nome || !currentField?.tipo) {
      toast.error("Nome e Tipo são obrigatórios para o campo.");
      return;
    }

    const payload: Omit<RegraCampo, "id"> = {
      modulo_id: moduloId,
      nome: currentField.nome,
      tipo: currentField.tipo,
      obrigatorio: currentField.obrigatorio ?? false,
      ordem: currentField.ordem ?? campos.length + 1,
      opcoes_json: currentField.tipo === "select" ? currentField.opcoes_json : undefined,
    };

    if (editingFieldId) {
      updateCampoMutation.mutate({ id: editingFieldId, updatedCampo: payload });
    } else {
      createCampoMutation.mutate(payload);
    }
  };

  const handleEditField = (field: RegraCampo) => {
    setEditingFieldId(field.id);
    setCurrentField(field);
  };

  const handleChange = (fieldName: keyof RegraCampo, value: any) => {
    setCurrentField((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Gerenciar Campos da Aba</h2>
            <p className="text-sm text-muted-foreground">
              Adicione, edite ou remova os campos que aparecerão nesta aba de regras dinâmica.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="field-name">Nome do Campo</Label>
                <Input
                  id="field-name"
                  value={currentField?.nome || ""}
                  onChange={(e) => handleChange("nome", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="field-type">Tipo do Campo</Label>
                <Select
                  value={currentField?.tipo || ""}
                  onValueChange={(value) => handleChange("tipo", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentField?.tipo === "select" && (
              <div className="grid gap-2">
                <Label htmlFor="field-options">Opções (separadas por vírgula)</Label>
                <Input
                  id="field-options"
                  value={currentField?.opcoes_json || ""}
                  onChange={(e) => handleChange("opcoes_json", e.target.value)}
                  placeholder="Ex: Opcao 1, Opcao 2, Outra Opcao"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2 items-center">
                <Label htmlFor="field-required" className="flex items-center gap-2">
                  <Checkbox
                    id="field-required"
                    checked={currentField?.obrigatorio || false}
                    onCheckedChange={(checked) => handleChange("obrigatorio", checked)}
                  />
                  Obrigatório
                </Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="field-order">Ordem</Label>
                <Input
                  id="field-order"
                  type="number"
                  value={currentField?.ordem || (campos.length > 0 ? Math.max(...campos.map(c => c.ordem ?? 0)) + 1 : 1)}
                  onChange={(e) => handleChange("ordem", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                {editingFieldId ? "Cancelar Edição" : "Limpar Formulário"}
              </Button>
              <Button type="submit" disabled={createCampoMutation.isPending || updateCampoMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {editingFieldId ? "Atualizar Campo" : "Adicionar Campo"}
              </Button>
            </div>
          </form>

          <h3 className="font-semibold text-lg mt-8">Campos Cadastrados</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Obrigatório</TableHead>
                  <TableHead className="text-center">Ordem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCampos && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Carregando campos...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingCampos && campos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhum campo cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {campos.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.nome}</TableCell>
                    <TableCell className="text-center">{FIELD_TYPES.find(t => t.value === field.tipo)?.label || field.tipo}</TableCell>
                    <TableCell className="text-center">{field.obrigatorio ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-center">{field.ordem ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEditField(field)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={deleteCampoMutation.isPending}
                          onClick={() => setFieldToDelete(field)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir campo "{fieldToDelete?.nome}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o campo e todos os dados associados a ele.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => fieldToDelete && deleteCampoMutation.mutate(fieldToDelete.id)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
</AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ManageFieldsModal;
