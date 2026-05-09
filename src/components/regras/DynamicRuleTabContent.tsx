import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Ban, Save, X, Copy } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegraCampo, RegraDado, RegrasCamposService, RegrasDadosService, RegraModulo, RegrasModulosService } from "@/services/base.service";

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

const FIXED_FIELDS_TAX = [
  { id: "nome_taxa", nome: "Nome da Taxa", tipo: "text", obrigatorio: true },
  { id: "tipo_incidencia", nome: "Tipo de Incidência", tipo: "select", obrigatorio: true, opcoes_json: "Monetário,Percentual,Multiplicador" },
  { id: "percentual", nome: "Percentual", tipo: "number", obrigatorio: false },
  { id: "base_calculo", nome: "Base de Cálculo", tipo: "select", obrigatorio: true, opcoes_json: "Valor do serviço,Valor final,Faturamento,Valor bruto" },
  { id: "municipio", nome: "Município", tipo: "text", obrigatorio: false },
  { id: "vigencia_inicial", nome: "Vigência Inicial", tipo: "date", obrigatorio: true },
  { id: "vigencia_final", nome: "Vigência Final", tipo: "date", obrigatorio: false },
  { id: "status", nome: "Status", tipo: "select", obrigatorio: true, opcoes_json: "Ativo,Inativo" },
];

import ManageFieldsModal from "./ManageFieldsModal";

interface DynamicRuleTabContentProps {
  moduloId: number;
  title?: string;
  description?: string;
}

const DynamicRuleTabContent: React.FC<DynamicRuleTabContentProps> = ({ moduloId, title, description }) => {
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

  const sortedDados = useMemo(() => {
    return [...dados].sort((a, b) => {
      const orderA = Number(a.dados?._order) || (a.id * 100000);
      const orderB = Number(b.dados?._order) || (b.id * 100000);
      if (orderA === orderB) {
        return b.id - a.id;
      }
      return orderA - orderB;
    });
  }, [dados]);

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
      setIsFormOpen(false);
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
      setIsFormOpen(false);
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
    const payload = { modulo_id: moduloId, dados: { ...formData } };

    if (editingDadoId) {
      updateDadoMutation.mutate({ id: editingDadoId, updatedDado: payload });
    } else {
      if (payload.dados._order === undefined) {
        payload.dados._order = Date.now();
      }
      createDadoMutation.mutate(payload);
    }
  };

  const handleEdit = (dado: RegraDado) => {
    setEditingDadoId(dado.id);
    setFormData(dado.dados || {});
    setIsFormOpen(true);
  };

  const handleDuplicate = (dado: RegraDado) => {
    const originalOrder = Number(dado.dados?._order) || (dado.id * 100000);
    const duplicatedDados = { ...dado.dados, _order: originalOrder - 1 };
    createDadoMutation.mutate({ modulo_id: moduloId, dados: duplicatedDados });
  };

  const handleChange = (fieldName: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldName]: value };

      const currentFields = isFixedSchema ? customFixedFields : campos;
      const fieldDef = currentFields.find(c => c.nome === fieldName);

      if (fieldDef?.tipo === "boolean" && value === true) {
        if (modulo?.module_type === 'financial') {
          currentFields.filter(c => c.tipo === "boolean" && c.nome !== fieldName).forEach(c => {
            next[c.nome] = false;
          });
        }
      }

      return next;
    });
  };

  const { data: modulo } = useQuery<RegraModulo | null>({
    queryKey: ["regras_modulo", moduloId],
    queryFn: () => RegrasModulosService.buscarPorId(moduloId),
    enabled: !!moduloId,
  });

  const isFixedSchema = modulo?.module_type && ['system_fixed', 'financial', 'tax', 'operational', 'rh'].includes(modulo.module_type);

  const isTaxSchema = modulo?.module_type === 'tax';
  const customFixedFields = isTaxSchema ? FIXED_FIELDS_TAX : FIXED_FIELDS;

  if (isLoadingCampos || isLoadingDados) {
    return <Card className="p-5 space-y-4 text-center text-muted-foreground">Carregando campos e dados...</Card>;
  }

  if (campos.length === 0 && !isFixedSchema) {
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-foreground">{title || "Regras cadastradas"}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="flex w-full md:w-auto items-center gap-2">
            {!isFixedSchema && (
              <Button type="button" variant="outline" className="shrink-0" onClick={() => setIsManageFieldsModalOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Gerenciar Campos
              </Button>
            )}
            <Button type="button" className="shrink-0" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova Regra
            </Button>
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDadoId ? "Editar Registro" : "Novo Registro"}</DialogTitle>
              <DialogDescription>
                Preencha os campos abaixo para salvar o registro no módulo {modulo?.nome}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(isFixedSchema ? customFixedFields : campos).map((campo) => (
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
                    {campo.tipo === "date" && (
                      <Input
                        id={`fixed-${campo.id}`}
                        type="date"
                        value={formData[campo.nome] || ""}
                        onChange={(e) => handleChange(campo.nome, e.target.value)}
                        required={campo.obrigatorio}
                      />
                    )}
                    {campo.tipo === "number" && (
                      <div className="relative">
                        <Input
                          id={`fixed-${campo.id}`}
                          type="number"
                          className={campo.nome.toLowerCase() === "percentual" ? "pr-8" : ""}
                          step="any"
                          value={formData[campo.nome] !== undefined ? formData[campo.nome] : ""}
                          onChange={(e) => handleChange(campo.nome, e.target.value === "" ? null : Number(e.target.value))}
                          placeholder={campo.obrigatorio ? "Obrigatório" : "Opcional"}
                        />
                        {campo.nome.toLowerCase() === "percentual" && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        )}
                      </div>
                    )}
                    {campo.tipo === "boolean" && (
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id={`fixed-${campo.id}`}
                          checked={formData[campo.nome] || false}
                          onCheckedChange={(checked) => handleChange(campo.nome, checked)}
                        />
                        <Label htmlFor={`fixed-${campo.id}`} className="font-normal cursor-pointer">Sim / Ativo</Label>
                      </div>
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

              <DialogFooter className="mt-6 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createDadoMutation.isPending || updateDadoMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {createDadoMutation.isPending || updateDadoMutation.isPending ? "Salvando..." : (editingDadoId ? "Atualizar Dado" : "Salvar Registro")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {(isFixedSchema ? customFixedFields : campos).map((campo) => (
                  <TableHead key={campo.id} className="text-center text-[10px] uppercase font-bold text-muted-foreground">{campo.nome}</TableHead>
                ))}
                <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(isFixedSchema ? customFixedFields : campos).length + 1} className="h-24 text-center text-muted-foreground">
                    Nenhuma regra cadastrada para este módulo.
                  </TableCell>
                </TableRow>
              )}
              {sortedDados.map((dado) => (
                <TableRow key={dado.id}>
                  {(isFixedSchema ? customFixedFields : campos).map((campo) => {
                    const value = dado.dados?.[campo.nome];

                    if (campo.tipo === "boolean") {
                      return (
                        <TableCell key={campo.id} className="text-center">
                          <span className="flex justify-center">
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase ${value ? "border-transparent bg-emerald-100 text-emerald-800" : "border-transparent bg-zinc-100 text-zinc-800"}`}>
                              {value ? "Sim" : "Não"}
                            </span>
                          </span>
                        </TableCell>
                      );
                    }
                    if (campo.nome.toLowerCase().includes("percentual") && value !== undefined && value !== null && value !== "") {
                      return <TableCell key={campo.id} className="text-center font-medium">{value}%</TableCell>;
                    }
                    if (campo.nome.toLowerCase() === "status") {
                      const isAtivo = value === "Ativo" || value === true;
                      return (
                        <TableCell key={campo.id} className="text-center">
                          <span className="flex justify-center">
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase ${isAtivo ? 'border-transparent bg-emerald-100 text-emerald-800' : 'border-transparent bg-zinc-100 text-zinc-800'}`}>
                              {value?.toString() || "Inativo"}
                            </span>
                          </span>
                        </TableCell>
                      );
                    }
                    return <TableCell key={campo.id} className="text-center font-medium">{value?.toString() ?? "-"}</TableCell>;
                  })}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => handleEdit(dado)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Duplicar" onClick={() => handleDuplicate(dado)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Excluir"
                        disabled={deleteDadoMutation.isPending}
                        onClick={() => setDadoToDelete(dado)}
                      >
                        <Trash2 className="h-4 w-4" />
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
