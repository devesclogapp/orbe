import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  icon?: LucideIcon;
  accent?: boolean;
  variant?: "default" | "solid";
  size?: "default" | "small";
  chartData?: any[];
  chartColor?: string;
  className?: string;
  onClick?: () => void;
}

export const MetricCard = ({ label, value, delta, icon: Icon, accent, variant = "default", size = "default", chartData, chartColor = "hsl(var(--primary))", className, onClick }: Props) => {
  const isSolid = variant === "solid";
  const isSmall = size === "small";

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden transition-all duration-200 flex flex-col justify-between text-left w-full",
        isSolid ? "esc-card bg-primary text-primary-foreground border-primary shadow-lg p-5" : "esc-card hover:shadow-md hover:cursor-pointer",
        isSmall && !isSolid ? "p-4 min-h-[90px]" : !isSmall && !isSolid ? "p-5 min-h-[140px]" : "",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between relative z-10 w-full shrink-0">
        <div className={cn(
          "uppercase tracking-wide font-medium",
          isSolid ? "text-primary-foreground/80" : "text-muted-foreground",
          isSmall ? "text-[10px]" : "text-xs"
        )}>{label}</div>
        {Icon && (
          <div className={cn("rounded-md flex items-center justify-center shrink-0 ml-2",
            isSolid ? "bg-white/20 text-white" :
              accent ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground",
            isSmall ? "h-6 w-6" : "h-8 w-8"
          )}>
            <Icon className={cn(isSmall ? "h-3 w-3" : "h-4 w-4")} />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between mt-3 gap-3 relative z-10 w-full grow">
        <div className="flex flex-col mb-1">
          <div className={cn(
            "font-display font-bold leading-none",
            isSolid ? "text-primary-foreground" : "text-foreground",
            isSmall ? "text-xl" : "text-3xl"
          )}>{value}</div>
          {delta && (
            <div className={cn("mt-2 inline-flex items-center gap-1 font-medium",
              isSmall ? "text-[10px]" : "text-xs",
              isSolid ? (delta.positive ? "text-emerald-300" : "text-red-300") :
                (delta.positive ? "text-success-strong" : "text-destructive-strong")
            )}>
              {delta.positive ? <ArrowUpRight className={isSmall ? "h-3 w-3" : "h-4 w-4"} /> : <ArrowDownRight className={isSmall ? "h-3 w-3" : "h-4 w-4"} />}
              {delta.value}
              <span className={cn("font-normal ml-1", isSolid ? "text-primary-foreground/70" : "text-muted-foreground")}>vs. ontem</span>
            </div>
          )}
        </div>

        {chartData && chartData.length > 0 && (
          <div className={cn("shrink-0 opacity-70 group-hover:opacity-100 transition-opacity", isSmall ? "h-8 w-16 mb-0" : "h-10 w-20 mb-1")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="value" stroke={isSolid ? "#ffffff" : chartColor} strokeWidth={isSmall ? 2 : 2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
