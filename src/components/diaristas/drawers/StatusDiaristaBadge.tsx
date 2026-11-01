import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_DIARISTA_MAP } from "./types";

export const StatusDiaristaBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status) return null;
    const entry = STATUS_DIARISTA_MAP[status];
    return (
        <Badge variant="outline" className={cn(
            "h-6 px-2 text-[11px] font-medium border shadow-none",
            entry?.cls ?? "bg-muted text-muted-foreground"
        )}>
            {entry?.label ?? status}
        </Badge>
    );
};
