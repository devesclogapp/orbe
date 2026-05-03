/* eslint-disable @typescript-eslint/no-explicit-any */
// Layouts Tab Component
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReportService, LayoutService } from "@/services/report.service";
import { Button } from "@/components/ui/button";
import {
    Plus,
    FileSpreadsheet,
    Edit3,
    Copy,
    Trash2,
    Columns
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { LayoutEditorModal } from "@/components/modals/LayoutEditorModal";

const LayoutsExportacao = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editingLayout, setEditingLayout] = useState<any>(null);

    const { data: layouts = [], isLoading } = useQuery({
        queryKey: ["report_layouts"],
        queryFn: () => LayoutService.getLayouts(),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => LayoutService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["report_layouts"] });
            toast.success("Layout criado com sucesso!");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => LayoutService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["report_layouts"] });
            toast.success("Layout atualizado com sucesso!");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => LayoutService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["report_layouts"] });
            toast.success("Layout excluído!");
        }
    });

    const handleSave = async (data: any) => {
        if (editingLayout) {
            await updateMutation.mutateAsync({ id: editingLayout.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }
    };

    const handleEdit = (layout: any) => {
        setEditingLayout(layout);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingLayout(null);
        setIsModalOpen(true);
    };

    const handleDuplicate = (layout: any) => {
        const { id, created_at, updated_at, ...rest } = layout;
        createMutation.mutate({ ...rest, nome: `${layout.nome} (Cópia)` });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Layouts de Exportação</h2>
                <p className="text-muted-foreground">Defina o formato e colunas para exportações customizadas</p>
            </div>
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button
                        className="font-semibold shadow-lg shadow-primary/20"
                        onClick={handleCreate}
                    >
                        <Plus className="h-4 w-4 mr-2" /> Criar Novo Layout
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="esc-card h-48 animate-pulse bg-muted/20" />
                        ))
                    ) : layouts.length > 0 ? (
                        <TooltipProvider>
                            {layouts.map((layout) => (
                                <div key={layout.id} className="esc-card group hover:border-primary/40 transition-all flex flex-col p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-primary/10 h-10 w-10 rounded-lg flex items-center justify-center text-primary">
                                            <FileSpreadsheet className="h-6 w-6" />
                                        </div>
                                        <Badge variant={layout.status === 'ativo' ? 'default' : 'secondary'} className="text-[9px] uppercase">
                                            {layout.status}
                                        </Badge>
                                    </div>

                                    <h3 className="font-display font-bold text-lg mb-1">{layout.nome}</h3>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                        <span className="capitalize font-medium">{layout.tipo}</span>
                                        <span className="h-1 w-1 bg-muted-foreground/30 rounded-full" />
                                        <span>Destino: <span className="font-medium">{layout.destino}</span></span>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-border/50 flex justify-between items-center">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                            <Columns className="h-3 w-3" />
                                            {(layout.colunas as any[])?.length || 0} Colunas
                                        </div>
                                        <div className="flex gap-1">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:text-primary"
                                                        onClick={() => handleDuplicate(layout)}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Duplicar</TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-primary hover:bg-primary-soft"
                                                        onClick={() => handleEdit(layout)}
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Editar</TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive-soft"
                                                        onClick={() => {
                                                            if (confirm('Tem certeza que deseja excluir este layout?')) {
                                                                deleteMutation.mutate(layout.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Excluir</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </TooltipProvider>
                    ) : (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-xl text-muted-foreground text-center bg-muted/5">
                            <FileSpreadsheet className="h-12 w-12 mb-4 opacity-10" />
                            <h4 className="font-display font-semibold text-foreground">Nenhum layout customizado</h4>
                            <p className="max-w-xs text-sm mt-1">Crie layouts específicos para exportação para sistemas contábeis ou de terceiros.</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                size="sm"
                                onClick={handleCreate}
                            >
                                Começar Editor
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <LayoutEditorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                layout={editingLayout}
            />
        </div>
    );
};

export default LayoutsExportacao;
