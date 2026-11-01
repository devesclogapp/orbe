import React from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useContextualHelp } from '@/contexts/ContextualHelpContext';
import { cn } from '@/lib/utils';

interface ContextualHelpButtonProps {
  customGuideId?: string;
  variant?: 'ghost' | 'outline' | 'default' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export const ContextualHelpButton: React.FC<ContextualHelpButtonProps> = ({
  customGuideId,
  variant = 'ghost',
  size,
  className,
  showLabel = false,
}) => {
  const { openHelp, currentGuide } = useContextualHelp();
  const effectiveSize = size || (showLabel ? 'sm' : 'icon');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={effectiveSize}
          onClick={() => openHelp(customGuideId)}
          className={cn(
            'relative transition-all duration-200 group active:scale-95',
            effectiveSize === 'icon' && 'h-8 w-8 rounded-lg',
            effectiveSize === 'sm' && showLabel && 'h-8 px-2.5 rounded-lg gap-1.5',
            className
          )}
          aria-label="Abrir Guia e Ajuda Contextual da Tela"
        >
          <BookOpen className="h-4 w-4 text-primary shrink-0 transition-colors" />
          {showLabel && (
            <span className="text-xs font-semibold">Guia da Tela</span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="text-xs font-medium">
        {currentGuide ? `Guia: ${currentGuide.title}` : 'Guia da Tela (Ajuda Contextual)'}
      </TooltipContent>
    </Tooltip>
  );
};
