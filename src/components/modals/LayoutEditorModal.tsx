/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, FileSpreadsheet, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface Column {
    label: string;
    field: string;
}

interface LayoutEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSave: (data: any) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layout?: any;
}

export const LayoutEditorModal: React.FC<LayoutEditorModalProps> = ({
    isOpen,
    onClose,
    onSave,
    layout
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        tipo: 'csv',
        destino: '',
        status: 'ativo'
    });
    const [columns, setColumns] = useState<Column[]>([]);

    useEffect(() => {
        if (layout) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const l = layout as any;
            setFormData({
                nome: l.nome || '',
                tipo: l.tipo || 'csv',
                destino: l.destino || '',
                status: l.status || 'ativo'
            });
            setColumns(Array.isArray(l.colunas) ? l.colunas : []);
        } else {
            setFormData({ nome: '', tipo: 'csv', destino: '', status: 'ativo' });
            setColumns([]);
        }
    }, [layout, isOpen]);

    const handleAddColumn = () => {
        setColumns([...columns, { label: '', field: '' }]);
    };

    const handleRemoveColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleColumnChange = (index: number, key: keyof Column, value: string) => {
        const newColumns = [...columns];
        newColumns[index][key] = value;
        setColumns(newColumns);
    };

    const handleSubmit = async () => {
        if (!formData.nome.trim()) {
            toast.error("O nome do layout é obrigatório");
            return;
        }

        if (columns.length === 0) {
            toast.error("Adicione pelo menos uma coluna ao layout");
            return;
        }

        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                colunas: columns
            });
            onClose();
        } catch (error: any) {
            toast.error("Erro ao salvar layout", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-primary" />
                        {layout ? 'Editar Layout' : 'Novo Layout de Exportação'}
                    </DialogTitle>
                    <DialogDescription>
                        Configure o formato e mapeamento de colunas para o arquivo de exportação.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome do Layout</Label>
                            <Input
                                id="nome"
                                placeholder="Ex: Exportação Senior / Folha"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tipo">Formato</Label>
                            <select
                                id="tipo"
                                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                value={formData.tipo}
                                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                            >
                                <option value="csv">CSV (.csv)</option>
                                <option value="excel">Excel (.xlsx)</option>
                            </select>
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="destino">Destino / Sistema</Label>
                            <Input
                                id="destino"
                                placeholder="Ex: ERP Senior, Domínio Sistemas..."
                                value={formData.destino}
                                onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuração de Colunas</Label>
                            <Button variant="outline" size="sm" onClick={handleAddColumn} className="h-7 text-[10px]">
                                <Plus className="h-3 w-3 mr-1" /> Adicionar Coluna
                            </Button>
                        </div>

                        {columns.length === 0 ? (
                            <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground bg-muted/5">
                                <p className="text-xs">Nenhuma coluna definida. Clique em adicionar para começar.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {columns.map((col, idx) => (
                                    <div key={idx} className="flex gap-2 items-center group">
                                        <div className="bg-muted h-9 w-9 rounded flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                            {idx + 1}
                                        </div>
                                        <Input
                                            placeholder="Título (ex: Matrícula)"
                                            className="flex-1"
                                            value={col.label}
                                            onChange={(e) => handleColumnChange(idx, 'label', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Campo (ex: matricula)"
                                            className="flex-1 font-mono text-xs"
                                            value={col.field}
                                            onChange={(e) => handleColumnChange(idx, 'field', e.target.value)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveColumn(idx)}
                                            className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading} className="shadow-lg shadow-primary/20">
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Salvar Layout
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
