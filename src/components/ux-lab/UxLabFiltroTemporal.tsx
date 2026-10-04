import React, { useState } from "react";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PeriodoPreset = "todos" | "hoje" | "outubro" | "setembro";

export interface FiltroTemporalValue {
  type: "preset" | "data" | "range";
  preset?: PeriodoPreset;
  data?: Date;
  range?: DateRange;
}

interface UxLabFiltroTemporalProps {
  value: FiltroTemporalValue;
  onChange: (val: FiltroTemporalValue) => void;
  className?: string;
}

export function UxLabFiltroTemporal({
  value,
  onChange,
  className,
}: UxLabFiltroTemporalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "data" | "range">("menu");
  const [selectedSingle, setSelectedSingle] = useState<Date | undefined>(
    value.type === "data" ? value.data : undefined
  );
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(
    value.type === "range" ? value.range : undefined
  );

  // Formatação do label exibido no botão
  const getButtonLabel = (): string => {
    if (value.type === "preset") {
      switch (value.preset) {
        case "hoje":
          return "Hoje (03/10)";
        case "outubro":
          return "Outubro/2026";
        case "setembro":
          return "Setembro/2026";
        case "todos":
        default:
          return "Todo o Período";
      }
    }

    if (value.type === "data" && value.data) {
      return format(value.data, "dd/MM/yyyy", { locale: ptBR });
    }

    if (value.type === "range" && value.range?.from) {
      const fromStr = format(value.range.from, "dd/MM", { locale: ptBR });
      if (value.range.to) {
        const toStr = format(value.range.to, "dd/MM", { locale: ptBR });
        return `${fromStr} – ${toStr}`;
      }
      return `${fromStr} – ...`;
    }

    return "Todo o Período";
  };

  const handleSelectPreset = (preset: PeriodoPreset) => {
    onChange({ type: "preset", preset });
    setOpen(false);
    setMode("menu");
  };

  const handleSelectSingleDate = (day: Date | undefined) => {
    if (day) {
      setSelectedSingle(day);
      onChange({ type: "data", data: day });
      setOpen(false);
      setMode("menu");
    }
  };

  const handleSelectRange = (range: DateRange | undefined) => {
    setSelectedRange(range);
    if (range?.from && range?.to) {
      onChange({ type: "range", range });
      setOpen(false);
      setMode("menu");
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setMode("menu");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Filtro Temporal"
          className={cn(
            "h-8 min-w-[165px] px-2.5 text-xs bg-card border-border font-normal justify-between gap-1.5 shrink-0",
            value.type !== "preset" || (value.preset && value.preset !== "todos")
              ? "border-royal-blue/60 text-foreground font-medium"
              : "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{getButtonLabel()}</span>
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto p-0 bg-popover border border-border shadow-lg"
      >
        {mode === "menu" && (
          <div className="p-1.5 w-56 space-y-0.5 text-xs">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Atalhos Rápidos
            </div>
            <button
              type="button"
              onClick={() => handleSelectPreset("todos")}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <span>Todo o Período</span>
              {value.type === "preset" && value.preset === "todos" && (
                <Check className="w-3.5 h-3.5 text-royal-blue" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("hoje")}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <span>Hoje (03/10)</span>
              {value.type === "preset" && value.preset === "hoje" && (
                <Check className="w-3.5 h-3.5 text-royal-blue" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("outubro")}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <span>Outubro/2026</span>
              {value.type === "preset" && value.preset === "outubro" && (
                <Check className="w-3.5 h-3.5 text-royal-blue" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("setembro")}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <span>Setembro/2026</span>
              {value.type === "preset" && value.preset === "setembro" && (
                <Check className="w-3.5 h-3.5 text-royal-blue" />
              )}
            </button>

            <div className="my-1 border-t border-border/80" />

            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Personalizado
            </div>
            <button
              type="button"
              onClick={() => setMode("data")}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <span>Selecionar data...</span>
              {value.type === "data" && (
                <span className="text-[11px] font-semibold text-royal-blue">
                  {value.data ? format(value.data, "dd/MM") : ""}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <span>Selecionar período...</span>
              {value.type === "range" && (
                <span className="text-[11px] font-semibold text-royal-blue">
                  {value.range?.from ? format(value.range.from, "dd/MM") : ""}
                </span>
              )}
            </button>
          </div>
        )}

        {mode === "data" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <span className="text-xs font-semibold text-foreground">
                Escolha o dia
              </span>
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Voltar aos atalhos
              </button>
            </div>
            <Calendar
              mode="single"
              selected={selectedSingle}
              onSelect={handleSelectSingleDate}
              defaultMonth={selectedSingle || new Date(2026, 9, 3)}
              initialFocus
              locale={ptBR}
            />
          </div>
        )}

        {mode === "range" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <span className="text-xs font-semibold text-foreground">
                Escolha o intervalo de datas
              </span>
              <button
                type="button"
                onClick={() => setMode("menu")}
                className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Voltar aos atalhos
              </button>
            </div>
            <Calendar
              mode="range"
              selected={selectedRange}
              onSelect={handleSelectRange}
              defaultMonth={selectedRange?.from || new Date(2026, 9, 1)}
              numberOfMonths={1}
              initialFocus
              locale={ptBR}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
