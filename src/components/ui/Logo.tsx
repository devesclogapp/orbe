import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    showSlogan?: boolean;
    sloganSize?: "xs" | "sm";
    align?: "left" | "center";
}

export const Logo: React.FC<LogoProps> = ({ className, showSlogan = false, sloganSize = "xs", align = "left" }) => {
    return (
        <div className={cn(
            "flex flex-col gap-1",
            align === "center" ? "items-center text-center" : "items-start text-left",
            className
        )}>
            <span className="text-3xl font-black tracking-tighter uppercase">
                <span className="text-[#FD4C00]">N</span>
                <span className="text-muted-foreground">ATO</span>
            </span>
            {showSlogan && (
                <p className={cn(
                    "font-bold text-muted-foreground uppercase tracking-wider leading-tight",
                    align === "center" ? "text-center" : "text-left",
                    sloganSize === "xs" ? "text-[8px]" : "text-[10px]"
                )}>
                    <span className="whitespace-nowrap">Gestão Operacional</span><br />
                    <span className="whitespace-nowrap">Inteligente</span>
                </p>
            )}
        </div>
    );
};
