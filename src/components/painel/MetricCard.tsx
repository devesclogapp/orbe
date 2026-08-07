import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  icon?: LucideIcon;
  chartType?: "line" | "bar" | "none"; // Let's support line or bar for variety like Finnova
  size?: "default" | "small";
  chartData?: any[];
  chartColor?: string;
  className?: string;
  onClick?: () => void;
}

export const MetricCard = ({ label, value, delta, icon: Icon, chartType = "line", size = "default", chartData, chartColor = "hsl(var(--primary))", className, onClick }: Props) => {
  const isSmall = size === "small";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] p-5 text-left w-full",
        isSmall ? "min-h-[100px] p-4 rounded-2xl" : "min-h-[220px]",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between relative z-10 w-full shrink-0">
        <div>
          <h3 className={cn(
            "font-semibold text-slate-500",
            isSmall ? "text-xs" : "text-[13px] tracking-wide"
          )}>
            {label}
          </h3>
          {(Icon && isSmall) && (
            <div className="mt-2 text-slate-400">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
        {(Icon && !isSmall) && (
          <div className="flex items-center justify-center p-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 transition-colors group-hover:bg-slate-100 group-hover:text-slate-600">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1 relative z-10 w-full grow justify-center">
        <div className={cn(
          "font-display font-bold tracking-tight text-slate-900",
          isSmall ? "text-xl" : "text-4xl"
        )}>
          {value}
        </div>

        {delta && (
          <div className={cn("inline-flex items-center gap-1 font-medium",
            isSmall ? "text-[10px]" : "text-sm",
            delta.positive ? "text-emerald-500" : "text-rose-500"
          )}>
            {delta.positive ? <ArrowUpRight className={isSmall ? "h-3 w-3" : "h-4 w-4"} /> : <ArrowDownRight className={isSmall ? "h-3 w-3" : "h-4 w-4"} />}
            {delta.value}
            <span className="font-normal text-slate-400 ml-0.5">vs. last month</span>
          </div>
        )}
      </div>

      {chartData && chartData.length > 0 && chartType !== "none" && (
        <div className={cn(
          "absolute right-0 bottom-0 left-0 transition-opacity flex items-end",
          isSmall ? "h-12 opacity-60 group-hover:opacity-100" : "h-[110px] opacity-100"
        )}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "line" ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id={`color-${label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  fill={`url(#color-${label.replace(/\s+/g, '')})`}
                  strokeWidth={isSmall ? 2 : 3}
                  activeDot={{ r: 6, fill: chartColor, stroke: "#fff", strokeWidth: 2 }}
                  dot={{ r: 4, fill: "#fff", stroke: chartColor, strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 15, left: 15, bottom: 10 }} barSize={16}>
                <Bar
                  dataKey="value"
                  radius={[4, 4, 4, 4]}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationBegin={200}
                >
                  {chartData.map((entry, index) => {
                    const isLast = index === chartData.length - 1;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={chartColor}
                        fillOpacity={isLast ? 1 : 0.3 + (index / chartData.length) * 0.4}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
