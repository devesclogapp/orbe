import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SpreadsheetValidationResult {
  validRows: any[];
  errors: string[];
  warnings: string[];
  previewRows?: any[];
}

interface SpreadsheetUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  expectedColumns?: string[];
  importOptions?: { label: string; value: string }[];
  templateColumns?: string[];
  templateFileName?: string;
  requireValidation?: boolean;
  unsupportedMessage?: string;
  onDownloadTemplate?: () => void | Promise<void>;
  validateData?: (data: any[]) => SpreadsheetValidationResult | Promise<SpreadsheetValidationResult>;
  onUpload: (data: any[], optionValue?: string) => Promise<void>;
}

const normalizeColumnName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .toUpperCase();

const isRowEmpty = (row: Record<string, unknown>) =>
  Object.values(row).every((value) => String(value ?? "").trim() === "");

export function SpreadsheetUploadModal({
  open,
  onOpenChange,
  title = "Importar Planilha",
  description = "Faça upload de um arquivo CSV ou Excel (.xlsx) contendo os dados a serem importados.",
  expectedColumns,
  importOptions,
  templateColumns,
  templateFileName = "modelo_importacao.xlsx",
  requireValidation = false,
  unsupportedMessage,
  onDownloadTemplate,
  validateData,
  onUpload,
}: SpreadsheetUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<SpreadsheetValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsExplicitValidation = requireValidation || !!validateData;
  const hasValidatedRows = (validationResult?.validRows?.length ?? 0) > 0;

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setSelectedOption("");
    setValidationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setParsedData([]);
    setValidationResult(null);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;

        if (selectedFile.name.endsWith(".csv")) {
          Papa.parse(data as string, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const rows = (results.data as Record<string, unknown>[]).filter((row) => !isRowEmpty(row));
              setParsedData(rows);
              setIsParsing(false);
            },
            error: (err: unknown) => {
              console.error(err);
              toast.error("Erro ao analisar arquivo CSV");
              setIsParsing(false);
            },
          });
          return;
        }

        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils
          .sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false })
          .filter((row) => !isRowEmpty(row));

        setParsedData(rows);
        setIsParsing(false);
      } catch {
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

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      processFile(event.dataTransfer.files[0]);
    }
  };

  const buildBaseValidationResult = (): SpreadsheetValidationResult => {
    if (expectedColumns && expectedColumns.length > 0) {
      const firstRow = parsedData[0] || {};
      const actualColumns = Object.keys(firstRow).map((key) => normalizeColumnName(key));
      const missingColumns = expectedColumns.filter(
        (column) => !actualColumns.includes(normalizeColumnName(column)),
      );

      if (missingColumns.length > 0) {
        return {
          validRows: [],
          errors: [`Faltam as colunas obrigatórias: ${missingColumns.join(", ")}.`],
          warnings: [],
        };
      }
    }

    return {
      validRows: parsedData,
      errors: [],
      warnings: [],
    };
  };

  const handleValidate = async () => {
    if (!parsedData.length) {
      toast.error("Selecione um arquivo com dados antes de validar.");
      return;
    }

    setIsValidating(true);

    try {
      const baseResult = buildBaseValidationResult();
      if (baseResult.errors.length > 0) {
        setValidationResult(baseResult);
        toast.error("Planilha inválida. Revise os erros encontrados.");
        return;
      }

      const result = validateData ? await validateData(parsedData) : baseResult;
      setValidationResult(result);

      if (result.errors.length > 0) {
        toast.error("Validação concluída com erros.");
      } else if (result.warnings.length > 0) {
        toast.warning("Validação concluída com alertas.");
      } else {
        toast.success("Planilha validada com sucesso.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível validar a planilha.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      if (onDownloadTemplate) {
        await onDownloadTemplate();
        return;
      }

      const columns = templateColumns ?? expectedColumns;
      if (!columns?.length) {
        toast.error("Nenhum modelo disponível para download.");
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet([Object.fromEntries(columns.map((column) => [column, ""]))]);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
      XLSX.writeFile(workbook, templateFileName);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível gerar o modelo.");
    }
  };

  const handleConfirm = async () => {
    const rowsToUpload = needsExplicitValidation ? validationResult?.validRows ?? [] : parsedData;
    if (!rowsToUpload.length) return;

    if (importOptions?.length && !selectedOption) {
      toast.error("Por favor, selecione qual o tipo de importação.");
      return;
    }

    if (needsExplicitValidation && !hasValidatedRows) {
      toast.error("Valide a planilha antes de confirmar a importação.");
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(rowsToUpload, selectedOption);
      onOpenChange(false);
      handleReset();
    } catch (err: any) {
      toast.error(err?.message || "Ocorreu um erro durante a importação.");
    } finally {
      setIsUploading(false);
    }
  };

  const previewRows = validationResult?.previewRows ?? validationResult?.validRows?.slice(0, 5) ?? [];
  const canConfirm =
    !unsupportedMessage &&
    !isParsing &&
    !isValidating &&
    !isUploading &&
    !!file &&
    (needsExplicitValidation
      ? hasValidatedRows && (validationResult?.errors.length ?? 0) === 0
      : parsedData.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isUploading) {
          onOpenChange(nextOpen);
          if (!nextOpen) handleReset();
        }
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate} disabled={!!unsupportedMessage || isUploading}>
              <Download className="mr-2 h-4 w-4" />
              Baixar modelo
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!unsupportedMessage || isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar arquivo
            </Button>
            {needsExplicitValidation ? (
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={!!unsupportedMessage || !file || isParsing || isUploading || isValidating}
              >
                {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Validar planilha
              </Button>
            ) : null}
          </div>

          {expectedColumns?.length ? (
            <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Colunas esperadas
              </Label>
              <p className="mt-2 text-sm text-foreground">{expectedColumns.join(" • ")}</p>
            </div>
          ) : null}

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(event) => {
              if (event.target.files && event.target.files[0]) {
                processFile(event.target.files[0]);
              }
            }}
          />

          {unsupportedMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {unsupportedMessage}
            </div>
          ) : !file ? (
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted p-8 text-center transition-colors hover:bg-muted/50"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-4 h-10 w-10 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium">Clique para fazer upload ou arraste o arquivo</p>
              <p className="mt-1 text-xs text-muted-foreground">Suporta: CSV e XLSX</p>
            </div>
          ) : (
            <div className="esc-card flex items-start gap-4 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                {isParsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6" />}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {isParsing ? (
                    "Processando planilha..."
                  ) : parsedData.length > 0 ? (
                    <span className="flex items-center text-success-strong">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {parsedData.length} registros lidos
                    </span>
                  ) : (
                    <span className="flex items-center text-destructive-strong">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Nenhum registro encontrado
                    </span>
                  )}
                </div>
              </div>
              {!isUploading ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={handleReset}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          )}

          {file && parsedData.length > 0 && importOptions?.length ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/50 p-4">
              <Label className="font-semibold text-foreground">Distribuição da importação</Label>
              <Select value={selectedOption} onValueChange={setSelectedOption}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Selecione o destino da importação" />
                </SelectTrigger>
                <SelectContent>
                  {importOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {validationResult ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Linhas lidas</p>
                  <p className="text-lg font-semibold text-foreground">{parsedData.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Válidas</p>
                  <p className="text-lg font-semibold text-foreground">{validationResult.validRows.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Erros</p>
                  <p className="text-lg font-semibold text-foreground">{validationResult.errors.length}</p>
                </div>
              </div>

              {validationResult.errors.length ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <Label className="text-sm font-semibold text-destructive">Erros</Label>
                  <ul className="mt-2 space-y-1 text-sm text-destructive">
                    {validationResult.errors.slice(0, 10).map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {validationResult.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Label className="text-sm font-semibold text-amber-900">Alertas</Label>
                  <ul className="mt-2 space-y-1 text-sm text-amber-900">
                    {validationResult.warnings.slice(0, 10).map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {previewRows.length ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="border-b border-border bg-muted/40 px-3 py-2">
                    <Label className="text-sm font-semibold text-foreground">Prévia dos dados</Label>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20">
                        <tr>
                          {Object.keys(previewRows[0] || {}).map((column) => (
                            <th key={column} className="px-3 py-2 text-left font-medium text-muted-foreground">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-border/60">
                            {Object.keys(previewRows[0] || {}).map((column) => (
                              <td key={`${rowIndex}-${column}`} className="px-3 py-2 text-foreground">
                                {String(row[column] ?? "") || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
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
