import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "@/services/report.service";
import { Button } from "@/components/ui/button";
import {
    Plus,
    FileSpreadsheet,
    Edit3,
    Copy,
    Trash2,
    Columns,
    ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LayoutsExportacao = () => {
    const { data: layouts = [], isLoading } = useQuery({
        queryKey: ["report_layouts"],
        queryFn: () => ReportService.getLayouts(),
    });

    return (
        <AppShell
            title="Layouts de Exportação"
            subtitle="Defina o formato e colunas para exportações customizadas"
            backPath="/relatorios"
        >
            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button className="font-semibold">
                        <Plus className="h-4 w-4 mr-2" /> Criar Novo Layout
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="esc-card h-48 animate-pulse bg-muted/20" />
                        ))
                    ) : layouts.length > 0 ? (
                        layouts.map((layout) => (
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
                                    <span className="capitalize">{layout.tipo}</span>
                                    <span className="h-1 w-1 bg-muted-foreground/30 rounded-full" />
                                    <span className="capitalize">Destino: {layout.destino}</span>
                                </div>

                                <div className="mt-auto pt-4 border-t border-border/50 flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                        <Columns className="h-3 w-3" />
                                        {(layout.colunas as any[])?.length || 0} Colunas
                                    </div>
                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Edit3 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed rounded-xl text-muted-foreground text-center">
                            <FileSpreadsheet className="h-12 w-12 mb-4 opacity-10" />
                            <h4 className="font-display font-semibold text-foreground">Nenhum layout customizado</h4>
                            <p className="max-w-xs text-sm mt-1">Crie layouts específicos para exportação para sistemas contábeis ou de terceiros.</p>
                            <Button variant="outline" className="mt-4" size="sm">Começar Editor</Button>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

export default LayoutsExportacao;
