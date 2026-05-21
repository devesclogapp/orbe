import React from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { getOperationalStatus } from "@/constants/operationalStatus";
import { cn } from "@/lib/utils";
import {
    FileText,
    Clock,
    MapPin,
    User,
    HardDrive,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Building,
    ExternalLink,
    Database,
    RotateCcw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ImportacaoDetailsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    importacao: any;
}

export const ImportacaoDetailsDrawer: React.FC<ImportacaoDetailsDrawerProps> = ({
    open,
    onOpenChange,
    importacao
}) => {
    if (!importacao) return null;

    const status = getOperationalStatus(importacao.status);
    const logs = importacao.logs || [];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] overflow-y-auto">
                <SheetHeader className="pb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge className={cn("font-semibold", status.bg, status.color)}>
                            {status.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">#{importacao.id.substring(0, 8)}</span>
                    </div>
                    <SheetTitle className="text-2xl font-display flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Detalhes da Importação
                    </SheetTitle>
                    <SheetDescription>
                        Auditabilidade e rastreabilidade técnica do processamento.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-8">
                    {/* Sessão de Metadados */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Database className="h-4 w-4" /> Metadados
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Arquivo</span>
                                <p className="text-sm font-medium break-all">{importacao.nome_arquivo}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Origem</span>
                                <p className="text-sm font-medium capitalize">{importacao.origem.replace("_", " ")}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Formato</span>
                                <p className="text-sm font-medium uppercase">{importacao.tipo_arquivo || "EXCEL"}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Registros</span>
                                <p className="text-sm font-medium">{importacao.quantidade_registros} itens</p>
                            </div>
                        </div>
                    </section>

                    <Separator />

                    {/* Sessão de Contexto */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <MapPin className="h-4 w-4" /> Contexto Operacional
                        </h3>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Building className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">{importacao.empresas?.nome || "Todas as empresas"}</p>
                                    <p className="text-xs text-muted-foreground">Empresa Contratante</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">{importacao.unidades_operacionais?.nome || "Geral / Matriz"}</p>
                                    <p className="text-xs text-muted-foreground">Unidade Operacional</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <HardDrive className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">{importacao.coletores?.nome || "Upload Manual"}</p>
                                    <p className="text-xs text-muted-foreground">Coletor / Ponto de Entrada</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <Separator />

                    {/* Sessão Drive Link (se houver) */}
                    {(importacao.drive_file_id || importacao.drive_folder_id) && (
                        <>
                            <section className="space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <ExternalLink className="h-4 w-4" /> Integração Drive
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {importacao.drive_file_id && (
                                        <div className="text-xs font-mono bg-muted p-2 rounded border break-all">
                                            File ID: {importacao.drive_file_id}
                                        </div>
                                    )}
                                    {importacao.drive_folder_id && (
                                        <div className="text-xs font-mono bg-muted p-2 rounded border break-all">
                                            Folder ID: {importacao.drive_folder_id}
                                        </div>
                                    )}
                                </div>
                            </section>
                            <Separator />
                        </>
                    )}
                    {/* Sessão Reprocessamento (se houver) */}
                    {(importacao.parent_importacao_id || (importacao.version && importacao.version > 1)) && (
                        <>
                            <section className="space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <RotateCcw className="h-4 w-4" /> Histórico de Replay
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <span className="text-muted-foreground">Versão da Execução</span>
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                            v{importacao.version || 1}
                                        </Badge>
                                    </div>
                                    {importacao.reprocessado_motivo && (
                                        <div className="bg-muted/50 border border-border p-3 rounded-md italic text-sm text-foreground relative">
                                            <span className="absolute -top-2 left-3 bg-background px-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Motivo do Replay</span>
                                            "{importacao.reprocessado_motivo}"
                                        </div>
                                    )}
                                    {importacao.parent_importacao_id && (
                                        <p className="text-[10px] text-muted-foreground font-mono">
                                            Parent ID: {importacao.parent_importacao_id}
                                        </p>
                                    )}
                                </div>
                            </section>
                            <Separator />
                        </>
                    )}
                    {/* Sessão Timeline Logs */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Timeline de Processamento
                        </h3>

                        <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                            {logs.length > 0 ? (
                                logs.map((log: any, idx: number) => (
                                    <div key={idx} className="relative pl-8">
                                        <div className="absolute left-0 top-1.5 h-5 w-5 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-xs font-semibold uppercase">{log.status}</span>
                                            <span className="text-[10px] text-muted-foreground">{format(new Date(log.timestamp), "HH:mm:ss")}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{log.message}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="relative pl-8">
                                    <div className="absolute left-0 top-1.5 h-5 w-5 rounded-full bg-background border-2 border-success flex items-center justify-center z-10">
                                        <CheckCircle2 className="h-4 w-4 text-success" />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-xs font-semibold uppercase">COMPLETO</span>
                                        <span className="text-[10px] text-muted-foreground font-mono">Log simplificado</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">O processamento foi concluído com sucesso sem logs granulares detalhados.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <Separator />

                    {/* Sessão Responsável e Horário */}
                    <section className="bg-muted/50 p-4 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span className="text-xs">Responsável</span>
                            </div>
                            <span className="text-sm font-medium">{importacao.profiles?.full_name || "Sistema / n8n"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span className="text-xs">Data Importação</span>
                            </div>
                            <span className="text-sm font-medium">{format(new Date(importacao.created_at), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                        {importacao.processado_em && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-xs">Duração Final</span>
                                </div>
                                <span className="text-sm font-medium">{(importacao.duracao_ms / 1000).toFixed(2)} segundos</span>
                            </div>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
};
