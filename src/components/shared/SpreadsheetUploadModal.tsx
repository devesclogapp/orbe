import { useState, useRef } from "react";
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";

interface SpreadsheetUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    expectedColumns?: string[];
    importOptions?: { label: string; value: string }[];
    onUpload: (data: any[], optionValue?: string) => Promise<void>;
}

export function SpreadsheetUploadModal({
    open,
    onOpenChange,
    title = "Importar Planilha",
    description = "Faça upload de um arquivo CSV ou Excel (.xlsx) contendo os dados a serem importados.",
    expectedColumns,
    importOptions,
    onUpload,
}: SpreadsheetUploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [selectedOption, setSelectedOption] = useState<string>("");
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReset = () => {
        setFile(null);
        setParsedData([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const processFile = (selectedFile: File) => {
        setFile(selectedFile);
        setIsParsing(true);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (selectedFile.name.endsWith(".csv")) {
                    // Parse CSV
                    const text = data as string;
                    Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            setParsedData(results.data);
                            setIsParsing(false);
                        },
                        error: (err: any) => {
                            toast.error("Erro ao analisar arquivo CSV");
                            console.error(err);
                            setIsParsing(false);
                        }
                    });
                } else {
                    // Parse XLSX
                    const workbook = XLSX.read(data, { type: "binary" });
                    const firstSheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[firstSheetName];
                    const results = XLSX.utils.sheet_to_json(sheet);
                    setParsedData(results);
                    setIsParsing(false);
                }
            } catch (err) {
                toast.error("Erro ao processar o arquivo. Verifique o formato.");
                setIsParsing(false);
            }
        };

        if (selectedFile.name.endsWith(".csv")) {
            reader.readAsText(selectedFile);
        } else {
            reader.readAsBinaryString(selectedFile);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleConfirm = async () => {
        if (!parsedData || parsedData.length === 0) return;

        // Optionally validate columns
        if (expectedColumns && expectedColumns.length > 0) {
            const firstRow = parsedData[0] || {};
            const actualColumns = Object.keys(firstRow).map(k => k.toLowerCase().trim());
            const missing = expectedColumns.filter(c => !actualColumns.includes(c.toLowerCase().trim()));

            if (missing.length > 0) {
                toast.error(`Planilha inválida. Faltam as colunas: ${missing.join(", ")}`);
                return;
            }
        }

        if (importOptions && importOptions.length > 0 && !selectedOption) {
            toast.error("Por favor, selecione qual o tipo de importação.");
            return;
        }

        setIsUploading(true);
        try {
            await onUpload(parsedData, selectedOption);
            onOpenChange(false);
            handleReset();
        } catch (err: any) {
            toast.error(err.message || "Ocorreu um erro durante a importação.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!isUploading) {
                onOpenChange(val);
                if (!val) handleReset();
            }
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {!file ? (
                        <div
                            className="border-2 border-dashed border-muted rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                            <p className="text-sm font-medium">Clique para fazer upload ou arraste o arquivo</p>
                            <p className="text-xs text-muted-foreground mt-1">Suporta: CSV e XLSX</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        processFile(e.target.files[0]);
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="esc-card p-4 flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                                {isParsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                    {isParsing ? (
                                        "Processando planilha..."
                                    ) : parsedData.length > 0 ? (
                                        <span className="flex items-center text-success-strong">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            {parsedData.length} registros prontos para importação
                                        </span>
                                    ) : (
                                        <span className="flex items-center text-destructive-strong">
                                            <AlertCircle className="h-3 w-3 mr-1" />
                                            Nenhum registro encontrado
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!isUploading && (
                                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleReset}>
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}

                    {file && parsedData.length > 0 && importOptions && importOptions.length > 0 && (
                        <div className="mt-4 p-4 border border-border bg-muted/50 rounded-lg space-y-3">
                            <Label className="font-semibold text-foreground">Distribuição da importação</Label>
                            <Select value={selectedOption} onValueChange={setSelectedOption}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="Selecione o destino (Ex: Ponto ou Operadores)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {importOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!file || parsedData.length === 0 || isParsing || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
                            </>
                        ) : (
                            "Confirmar Importação"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
