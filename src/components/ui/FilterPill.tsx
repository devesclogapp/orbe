import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIcon;
    label: string;
}

export const FilterPill = ({ icon: Icon, label, className, ...props }: FilterPillProps) => (
    <button
        className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-md bg-card border border-border text-sm text-foreground hover:bg-secondary transition-colors",
            className
        )}
        {...props}
    >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
    </button>
);
