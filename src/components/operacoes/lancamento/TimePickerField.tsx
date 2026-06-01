import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

export type TimePickerFieldProps = {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
};

export const TimePickerField = ({ label, value, onChange }: TimePickerFieldProps) => {
    const [open, setOpen] = useState(false);

    const isEntrada = label.toLowerCase().includes("entrada");
    const hasValue = !!value;

    const handleNow = () => {
        const now = new Date();
        const nextValue = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        onChange(nextValue);
        setOpen(false);
    };

    const [hourValue, minuteValue] = value?.includes(":") ? value.split(":") : ["", ""];

    const applyTime = (nextHour: string, nextMinute: string) => {
        if (!nextHour || !nextMinute) return;
        onChange(`${nextHour}:${nextMinute}`);
    };

    const handleHourSelect = (nextHour: string) => {
        if (minuteValue) {
            applyTime(nextHour, minuteValue);
            return;
        }
        onChange(`${nextHour}:00`);
    };

    const handleMinuteSelect = (nextMinute: string) => {
        if (hourValue) {
            applyTime(hourValue, nextMinute);
            setOpen(false);
            return;
        }
        onChange(`00:${nextMinute}`);
        setOpen(false);
    };

    return (
        <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {label}
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        className={cn(
                            "h-14 w-full rounded-xl justify-between px-4 font-mono text-lg transition-all active:scale-[0.98]",
                            hasValue
                                ? "bg-green-50 border-2 border-green-500 text-green-700 hover:bg-green-100"
                                : "bg-orange-50 border-2 border-orange-400 text-orange-700 hover:bg-orange-100"
                        )}
                    >
                        {hasValue ? (
                            <>
                                <span className="font-bold">{value}</span>
                                <Clock className="w-5 h-5 text-green-600" />
                            </>
                        ) : (
                            <>
                                <span className="font-black text-sm uppercase tracking-wide">
                                    {isEntrada ? "INICIAR" : "FINALIZAR"}
                                </span>
                                <Clock className="w-5 h-5 text-orange-600" />
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[280px] rounded-2xl p-0 overflow-hidden">
                    <div className="border-b px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">Escolha a hora e os minutos do ponto.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-0">
                        <div className="border-r">
                            <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                Hora
                            </div>
                            <ScrollArea className="h-56">
                                <div className="p-2 space-y-1">
                                    {HOUR_OPTIONS.map((hour) => (
                                        <Button
                                            key={hour}
                                            type="button"
                                            variant={hourValue === hour ? "default" : "ghost"}
                                            className="w-full justify-center rounded-lg font-mono"
                                            onClick={() => handleHourSelect(hour)}
                                        >
                                            {hour}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        <div>
                            <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                Minuto
                            </div>
                            <ScrollArea className="h-56">
                                <div className="p-2 space-y-1">
                                    {MINUTE_OPTIONS.map((minute) => (
                                        <Button
                                            key={minute}
                                            type="button"
                                            variant={minuteValue === minute ? "default" : "ghost"}
                                            className="w-full justify-center rounded-lg font-mono"
                                            onClick={() => handleMinuteSelect(minute)}
                                        >
                                            {minute}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t p-3">
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                            Limpar
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleNow}>
                            Agora
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};
