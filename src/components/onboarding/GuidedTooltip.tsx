import { ReactNode, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GuidedTooltipProps {
  children: ReactNode;
  content: string;
  isActive?: boolean;
  variant?: "default" | "highlight";
  position?: "top" | "bottom" | "left" | "right";
}

export function GuidedTooltip({
  children,
  content,
  isActive = true,
  variant = "default",
  position = "top",
}: GuidedTooltipProps) {
  if (!isActive) return <>{children}</>;

  const positionClasses = {
    top: "mb-2",
    bottom: "mt-2",
    left: "mr-2",
    right: "ml-2",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-block",
            variant === "highlight" && "ring-2 ring-primary ring-offset-2 rounded-md animate-pulse"
          )}>
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side={position} className="max-w-xs">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm">{content}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface OnboardingGuideCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isComplete?: boolean;
}

export function OnboardingGuideCard({
  title,
  description,
  actionLabel,
  onAction,
  isComplete,
}: OnboardingGuideCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-lg border-2 transition-all duration-300",
      isComplete 
        ? "border-green-500 bg-green-50/50" 
        : "border-primary/20 bg-primary/5"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isComplete ? "bg-green-500" : "bg-primary"
        )}>
          {isComplete ? (
            <span className="text-white text-lg">✓</span>
          ) : (
            <Lightbulb className="w-4 h-4 text-white" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          {actionLabel && onAction && (
            <Button 
              size="sm" 
              variant={isComplete ? "outline" : "default"}
              className="mt-3"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface OnboardingPromptProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export function OnboardingPrompt({
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: OnboardingPromptProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-background border-2 border-primary rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h4 className="font-semibold">{title}</h4>
          </div>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction} className="w-full">
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}