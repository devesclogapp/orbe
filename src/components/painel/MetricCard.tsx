import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  icon?: LucideIcon;
  accent?: boolean;
}

export const MetricCard = ({ label, value, delta, icon: Icon, accent }: Props) => {
  return (
    <div className="esc-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        {Icon && (
          <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", accent ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground")}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="mt-3 font-display font-bold text-[28px] leading-none text-foreground">{value}</div>
      {delta && (
        <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", delta.positive ? "text-success-strong" : "text-destructive-strong")}>
          {delta.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {delta.value}
          <span className="text-muted-foreground font-normal ml-1">vs. ontem</span>
        </div>
      )}
    </div>
  );
};
