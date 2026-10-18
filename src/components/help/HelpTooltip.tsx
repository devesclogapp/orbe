import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  text: string;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children?: React.ReactNode;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  text,
  className,
  iconClassName,
  side = 'top',
  children,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children ? (
          <span className={cn('inline-flex items-center cursor-help', className)}>
            {children}
          </span>
        ) : (
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors cursor-help p-0.5 rounded-sm focus:outline-hidden',
              className
            )}
            aria-label="Mais informações"
          >
            <HelpCircle className={cn('h-3.5 w-3.5', iconClassName)} />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs font-normal leading-relaxed text-foreground bg-popover border border-border shadow-md">
        {text}
      </TooltipContent>
    </Tooltip>
  );
};
