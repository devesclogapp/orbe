import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

import { RegraModulo, RegrasModulosService } from "@/services/base.service";
import DynamicRuleTabContent from "./DynamicRuleTabContent";

interface DynamicRuleTabsContainerProps {
  canAccess: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const DynamicRuleTabsContainer: React.FC<DynamicRuleTabsContainerProps> = ({ canAccess, activeTab, setActiveTab }) => {
  const queryClient = useQueryClient();

  const [isNewTabModalOpen, setIsNewTabModalOpen] = useState(false);
  const [newTabForm, setNewTabForm] = useState<Partial<RegraModulo>>({
    nome: "",
    slug: "",
    descricao: "",
  });

  const { data: dynamicModules = [], isLoading: isLoadingDynamicModules } = useQuery<RegraModulo[]>({
    queryKey: ["regras_modulos"],
    queryFn: () => RegrasModulosService.listar(),
    enabled: canAccess,
  });

  const createModuloMutation = useMutation({
    mutationFn: (newModulo: Omit<RegraModulo, "id" | "ativo">) =>
      RegrasModulosService.criar(newModulo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_modulos"] });
      toast.success("Nova aba de regras criada com sucesso!");
      setIsNewTabModalOpen(false);
      setNewTabForm({ nome: "", slug: "", descricao: "" });
    },
    onError: (error: any) => {
      toast.error("Erro ao criar nova aba de regras.", { description: error.message });
    },
  });

  const handleCreateNewTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTabForm.nome || !newTabForm.slug) {
      toast.error("Nome e Slug são obrigatórios para a nova aba.");
      return;
    }

    const existingSlug = dynamicModules.some(mod => mod.slug === newTabForm.slug);
    if (existingSlug) {
        toast.error("Slug já existe. Por favor, escolha um slug único.");
        return;
    }

    createModuloMutation.mutate({
      nome: newTabForm.nome,
      slug: newTabForm.slug,
      descricao: newTabForm.descricao,
    });
  };

  return (
    <>      
      {dynamicModules.map((module) => (        
        <TabsContent key={module.slug} value={module.slug} className="m-0">
          <DynamicRuleTabContent moduloId={module.id} />
        </TabsContent>
      ))}

      {canAccess && (        
        <Dialog open={isNewTabModalOpen} onOpenChange={setIsNewTabModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Aba de Regras</DialogTitle>
              <DialogDescription>
                Defina o nome e o slug (identificador único) para sua nova aba de regras.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateNewTab} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-tab-name">Nome da Aba</Label>
                <Input
                  id="new-tab-name"
                  value={newTabForm.nome}
                  onChange={(e) => setNewTabForm({ ...newTabForm, nome: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-tab-slug">Slug (URL amigável)</Label>
                <Input
                  id="new-tab-slug"
                  value={newTabForm.slug}
                  onChange={(e) => setNewTabForm({ ...newTabForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-tab-description">Descrição (Opcional)</Label>
                <Input
                  id="new-tab-description"
                  value={newTabForm.descricao}
                  onChange={(e) => setNewTabForm({ ...newTabForm, descricao: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewTabModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createModuloMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" /> Criar Aba
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DynamicRuleTabsContainer;
