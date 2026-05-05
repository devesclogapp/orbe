import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Ban, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
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
import { RegraCampo, RegraDado, RegrasCamposService, RegrasDadosService } from "@/services/base.service";

const FIXED_FIELDS = [
  { id: "natureza", nome: "Natureza", tipo: "select", obrigatorio: true, opcoes_json: "Receita,Despesa,Custo" },
  { id: "modalidade_financeira", nome: "Modalidade Financeira", tipo: "select", obrigatorio: true, opcoes_json: "CAIXA_IMEDIATO,DUPLICATA,FATURAMENTO_MENSAL" },
  { id: "forma_pagamento", nome: "Forma de Pagamento", tipo: "select", obrigatorio: true, opcoes_json: "Dinheiro,Cartão Débito,Cartão Crédito,Transferência,Cheque,Boleto,PIX" },
  { id: "prazo_dias", nome: "Prazo (dias)", tipo: "number", obrigatorio: false },
  { id: "tipo_liquidacao", nome: "Tipo Liquidação", tipo: "select", obrigatorio: true, opcoes_json: "imediato,futuro,mensal" },
  { id: "entra_caixa_imediato", nome: "Entra Caixa Imediato", tipo: "boolean", obrigatorio: true },
  { id: "gera_conta_receber", nome: "Gera Conta a Receber", tipo: "boolean", obrigatorio: true },
  { id: "agrupa_faturamento", nome: "Agrupa no Faturamento", tipo: "boolean", obrigatorio: true },
];
import ManageFieldsModal from "./ManageFieldsModal";

interface DynamicRuleTabContentProps {
  moduloId: number;
}

const DynamicRuleTabContent: React.FC<DynamicRuleTabContentProps> = ({ moduloId }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editingDadoId, setEditingDadoId] = useState<number | null>(null);
  const [dadoToDelete, setDadoToDelete] = useState<RegraDado | null>(null);
  const [isManageFieldsModalOpen, setIsManageFieldsModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: campos = [], isLoading: isLoadingCampos } = useQuery<RegraCampo[]>({
    queryKey: ["regras_campos", moduloId],
    queryFn: () => RegrasCamposService.listarPorModulo(moduloId),
    enabled: !!moduloId,
  });

  const { data: dados = [], isLoading: isLoadingDados } = useQuery<RegraDado[]>({
    queryKey: ["regras_dados", moduloId],
    queryFn: () => RegrasDadosService.listarPorModulo(moduloId),
    enabled: !!moduloId,
  });

  const resetForm = () => {
    setFormData({});
    setEditingDadoId(null);
  };

  const createDadoMutation = useMutation({
    mutationFn: (newDado: Omit<RegraDado, "id">) => RegrasDadosService.criar(newDado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_dados", moduloId] });
      toast.success("Dado criado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao criar dado.", { description: error.message });
    },
  });

  const updateDadoMutation = useMutation({
    mutationFn: ({ id, updatedDado }: { id: number; updatedDado: Partial<RegraDado> }) =>
      RegrasDadosService.atualizar(id, updatedDado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_dados", moduloId] });
      toast.success("Dado atualizado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar dado.", { description: error.message });
    },
  });

  const deleteDadoMutation = useMutation({
    mutationFn: (id: number) => RegrasDadosService.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_dados", moduloId] });
      toast.success("Dado excluído com sucesso!");
      setDadoToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir dado.", { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { modulo_id: moduloId, dados: formData };

    if (editingDadoId) {
      updateDadoMutation.mutate({ id: editingDadoId, updatedDado: payload });
    } else {
      createDadoMutation.mutate(payload);
    }
  };

  const handleEdit = (dado: RegraDado) => {
    setEditingDadoId(dado.id);
    setFormData(dado.dados || {});
  };

  const handleChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  if (isLoadingCampos || isLoadingDados) {
    return <Card className="p-5 space-y-4 text-center text-muted-foreground">Carregando campos e dados...</Card>;
  }

  if (campos.length === 0) {
    return (
      <>
        <Card className="p-5 space-y-4 text-center text-muted-foreground">
          <p className="text-sm">Nenhum campo configurado para este módulo. Comece adicionando campos.</p>
          <Button type="button" onClick={() => setIsManageFieldsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Campos
          </Button>
        </Card>
        <ManageFieldsModal
          isOpen={isManageFieldsModalOpen}
          onClose={() => setIsManageFieldsModalOpen(false)}
          moduloId={moduloId}
        />
      </>
    );
  }

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Gerenciar Dados</h3>
          <Button type="button" variant="outline" onClick={() => setIsManageFieldsModalOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Gerenciar Campos
          </Button>
        </div>

        {!isFormOpen ? (
          <Button type="button" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Registro
          </Button>
        ) : (
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-sm">Novo Registro</h4>
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium text-sm mb-3 text-muted-foreground">Campos Fixos do Sistema</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FIXED_FIELDS.map((campo) => (
                <div key={campo.id} className="grid w-full items-center gap-1.5">
                  <Label htmlFor={`fixed-${campo.id}`}>
                    {campo.nome} {campo.obrigatorio && <span className="text-red-500">*</span>}
                  </Label>
                  {campo.tipo === "text" && (
                    <Input
                      id={`fixed-${campo.id}`}
                      type="text"
                      value={formData[campo.nome] || ""}
                      onChange={(e) => handleChange(campo.nome, e.target.value)}
                      required={campo.obrigatorio}
                    />
                  )}
                  {campo.tipo === "number" && (
                    <Input
                      id={`fixed-${campo.id}`}
                      type="number"
                      value={formData[campo.nome] !== undefined ? formData[campo.nome] : ""}
                      onChange={(e) => handleChange(campo.nome, e.target.value === "" ? null : Number(e.target.value))}
                      placeholder={campo.obrigatorio ? "Obrigatório" : "Opcional"}
                    />
                  )}
                  {campo.tipo === "boolean" && (
                    <Checkbox
                      id={`fixed-${campo.id}`}
                      checked={formData[campo.nome] || false}
                      onCheckedChange={(checked) => handleChange(campo.nome, checked)}
                    />
                  )}
                  {campo.tipo === "select" && campo.opcoes_json && (
                    <Select
                      value={formData[campo.nome] || ""}
                      onValueChange={(value) => handleChange(campo.nome, value)}
                      required={campo.obrigatorio}
                    >
                      <SelectTrigger id={`fixed-${campo.id}`}>
                        <SelectValue placeholder={`Selecione ${campo.nome}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {campo.opcoes_json.split(',').map((option) => (
                          <SelectItem key={option.trim()} value={option.trim()}>
                            {option.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
              <Button type="submit" disabled={createDadoMutation.isPending || updateDadoMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {editingDadoId ? "Atualizar Dado" : "Salvar"}
              </Button>
              {editingDadoId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
          </div>
        )}

        <h3 className="font-semibold text-lg mt-8">Dados Existentes</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {FIXED_FIELDS.map((campo) => (
                  <TableHead key={campo.id} className="text-center">{campo.nome}</TableHead>
                ))}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={FIXED_FIELDS.length + 1} className="h-24 text-center text-muted-foreground">
                    Nenhum dado cadastrado para este módulo.
                  </TableCell>
                </TableRow>
              )}
              {dados.map((dado) => (
                <TableRow key={dado.id}>
                  {FIXED_FIELDS.map((campo) => {
                    const value = dado.dados?.[campo.nome];
                    if (campo.tipo === "boolean") {
                      return <TableCell key={campo.id} className="text-center">{value ? "Sim" : "Não"}</TableCell>;
                    }
                    return <TableCell key={campo.id} className="text-center">{value?.toString() ?? "-"}</TableCell>;
                  })}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(dado)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deleteDadoMutation.isPending}
                        onClick={() => setDadoToDelete(dado)}
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

        <AlertDialog open={!!dadoToDelete} onOpenChange={(open) => !open && setDadoToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este dado?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o dado selecionado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => dadoToDelete && deleteDadoMutation.mutate(dadoToDelete.id)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      <ManageFieldsModal
        isOpen={isManageFieldsModalOpen}
        onClose={() => setIsManageFieldsModalOpen(false)}
        moduloId={moduloId}
      />
    </>
  );
};

export default DynamicRuleTabContent;
