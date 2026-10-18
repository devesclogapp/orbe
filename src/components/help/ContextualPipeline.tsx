import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Info,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { BusinessPipeline, PipelineStepData } from '@/types/contextualHelp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccessControl } from '@/contexts/AccessControlContext';

interface ContextualPipelineProps {
  pipeline: BusinessPipeline;
  currentStepId?: string;
  className?: string;
  onNavigateStep?: (path: string) => void;
}

export const ContextualPipeline: React.FC<ContextualPipelineProps> = ({
  pipeline,
  currentStepId,
  className,
  onNavigateStep,
}) => {
  const navigate = useNavigate();

  // Obter perfil do usuário de forma segura
  let userRole: string | undefined;
  try {
    const access = useAccessControl();
    userRole = access?.role?.toUpperCase();
  } catch {
    userRole = undefined;
  }

  const handleStepClick = (step: PipelineStepData) => {
    if (!step.screenPath) return;
    if (onNavigateStep) {
      onNavigateStep(step.screenPath);
    } else {
      navigate(step.screenPath);
    }
  };

  const isRoleAllowedForScreen = (step: PipelineStepData): boolean => {
    if (!userRole) return false;
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'GESTOR') return true;

    // Encarregado só pode acessar caminhos de produção/operacional de campo
    if (userRole === 'ENCARREGADO') {
      return Boolean(step.screenPath?.startsWith('/producao'));
    }

    // RH não acessa módulos puramente financeiros ou restritos
    if (userRole === 'RH') {
      return Boolean(step.screenPath?.startsWith('/rh') || step.screenPath?.startsWith('/operacoes'));
    }

    // Financeiro acessa financeiro e operacoes
    if (userRole === 'FINANCEIRO') {
      return Boolean(step.screenPath?.startsWith('/financeiro') || step.screenPath?.startsWith('/operacoes'));
    }

    return false;
  };

  return (
    <div className={cn('space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all', className)}>
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              Fluxo do Processo
              <Badge variant="outline" className="text-[10px] font-semibold border-primary/20 text-primary bg-primary/5">
                Visão Geral
              </Badge>
            </h4>
            <p className="text-xs text-muted-foreground">{pipeline.title}</p>
          </div>
        </div>
      </div>

      {/* Nota de Esclarecimento Educativo */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground leading-relaxed">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Pipeline Educativo do Processo: </span>
          Demonstra a sequência oficial de ponta a ponta implementada no ERP, detalhando as responsabilidades e transições entre etapas.
        </div>
      </div>

      {/* Linha do Tempo Vertical Conectada */}
      <div className="relative pl-6 sm:pl-8 space-y-6 pt-2">
        {/* Linha vertical contínua de conexão */}
        <div className="absolute left-2.5 sm:left-3.5 top-5 bottom-5 w-0.5 bg-gradient-to-b from-primary/30 via-border to-border/40" />

        {pipeline.steps.map((step, index) => {
          const isCurrent = step.id === currentStepId;
          const canAccessScreen = Boolean(step.screenPath && isRoleAllowedForScreen(step));

          return (
            <div key={step.id} className="relative group">
              {/* Marcador Numérico / Ícone na Linha Vertical */}
              <div
                className={cn(
                  'absolute -left-6 sm:-left-8 top-1.5 h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border',
                  isCurrent
                    ? 'bg-primary text-primary-foreground border-primary ring-4 ring-primary/20 scale-110 shadow-md shadow-primary/30'
                    : 'bg-muted/90 text-muted-foreground border-border/80 group-hover:border-primary/40 group-hover:text-foreground'
                )}
              >
                {step.stepNumber}
              </div>

              {/* Card da Etapa */}
              <div
                className={cn(
                  'rounded-xl border p-4 transition-all duration-200',
                  isCurrent
                    ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/10'
                    : 'border-border/70 bg-card hover:border-border hover:bg-muted/10'
                )}
              >
                {/* Cabeçalho do Card */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      {step.stepNumber}. {step.name}
                    </span>

                    {/* Destaque "Você está aqui" */}
                    {isCurrent && (
                      <Badge className="bg-primary hover:bg-primary text-primary-foreground font-bold text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Você está aqui (Tela atual)
                      </Badge>
                    )}
                  </div>

                  {/* Badges de Perfis Responsáveis */}
                  <div className="flex flex-wrap gap-1">
                    {step.responsibleRole.map((role) => (
                      <Badge
                        key={role}
                        variant="secondary"
                        className={cn(
                          'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 h-4 border',
                          role === 'ENCARREGADO' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
                          role === 'RH' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
                          role === 'FINANCEIRO' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
                          (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'GESTOR') &&
                            'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                        )}
                      >
                        <UserCheck className="h-2.5 w-2.5 mr-0.5" />
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Objetivo da Etapa */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  <strong className="text-foreground/90">Objetivo: </strong>
                  {step.objective}
                </p>

                {/* Bloco de Condições e Próximo Passo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-border/50 text-[11px]">
                  {/* Condições Necessárias */}
                  <div className="rounded-lg bg-muted/30 p-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      <span>Condições para avançar:</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{step.conditionsToAdvance}</p>
                  </div>

                  {/* Próxima Etapa Possível */}
                  <div className="rounded-lg bg-muted/30 p-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      <span>Próxima etapa:</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{step.nextStepPossible}</p>
                  </div>
                </div>

                {/* Ação de Navegação para o Passo (com respeito estrito ao RBAC) */}
                {step.screenPath && !isCurrent && (
                  <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                    {canAccessScreen ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStepClick(step)}
                        className="h-7 px-2.5 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg group/btn transition-colors"
                      >
                        <span>Ir para esta tela</span>
                        <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic">
                        <Lock className="h-3 w-3" />
                        <span>Acesso restrito ao perfil {step.responsibleRole.join(' / ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
