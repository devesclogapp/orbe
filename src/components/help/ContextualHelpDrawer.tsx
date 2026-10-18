import React from 'react';
import {
  BookOpen,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Info,
  X,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContextualHelp } from '@/contexts/ContextualHelpContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { resolvePipelineForGuide } from '@/data/contextualPipelinesData';
import { ContextualPipeline } from './ContextualPipeline';

export const ContextualHelpDrawer: React.FC = () => {
  const { isHelpOpen, closeHelp, currentGuide } = useContextualHelp();

  if (!currentGuide) return null;

  const pipelineData = resolvePipelineForGuide(currentGuide);

  return (
    <Sheet open={isHelpOpen} onOpenChange={(open) => !open && closeHelp()} modal={true}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 flex flex-col bg-background/95 backdrop-blur-md border-l border-border shadow-2xl z-50 transition-all duration-300"
      >
        {/* Cabeçalho do Drawer */}
        <SheetHeader className="p-6 border-b border-border/80 bg-muted/20 relative">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-[10px] font-bold tracking-wider uppercase border-primary/20 text-primary bg-primary/5">
                {currentGuide.category}
              </Badge>
            </div>
          </div>

          <SheetTitle className="text-xl font-bold tracking-tight text-foreground mt-2 text-left">
            {currentGuide.title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground text-left">
            Guia operacional oficial e regras da tela atual
          </SheetDescription>
        </SheetHeader>

        {/* Conteúdo com Abas de Navegação */}
        <Tabs defaultValue="visao-geral" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3 border-b border-border/60 bg-muted/10">
            <TabsList className={`grid ${pipelineData ? 'grid-cols-5' : 'grid-cols-4'} w-full h-9 bg-muted/50 p-1`}>
              <TabsTrigger value="visao-geral" className="text-xs font-medium data-[state=active]:font-bold px-1 truncate">
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="passo-a-passo" className="text-xs font-medium data-[state=active]:font-bold px-1 truncate">
                Passo a Passo
              </TabsTrigger>
              <TabsTrigger value="campos" className="text-xs font-medium data-[state=active]:font-bold px-1 truncate">
                Campos & Status
              </TabsTrigger>
              <TabsTrigger value="duvidas" className="text-xs font-medium data-[state=active]:font-bold px-1 truncate">
                Dúvidas
              </TabsTrigger>
              {pipelineData && (
                <TabsTrigger value="fluxo" className="text-xs font-medium data-[state=active]:font-bold px-1 truncate flex items-center justify-center gap-1 text-primary data-[state=active]:text-primary">
                  <Workflow className="h-3 w-3 shrink-0" />
                  <span>Fluxo</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* ABA 1: VISÃO GERAL */}
            <TabsContent value="visao-geral" className="space-y-6 m-0">
              {/* Para que serve */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Info className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Para que serve esta tela?</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                  {currentGuide.purpose}
                </p>
              </div>

              {/* Quando devo utilizar */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Quando devo utilizá-la?</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                  {currentGuide.whenToUse}
                </p>
              </div>

              {/* O que acontece depois (Pipeline) */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded-md bg-primary/20 text-primary flex items-center justify-center">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">O que acontece depois? (Próxima Etapa)</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                  {currentGuide.nextSteps}
                </p>
              </div>
            </TabsContent>

            {/* ABA 2: PASSO A PASSO */}
            <TabsContent value="passo-a-passo" className="space-y-4 m-0">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Como funciona? Passo a Passo
                </h4>
              </div>

              <div className="space-y-3">
                {currentGuide.howItWorks.map((step) => (
                  <div
                    key={step.step}
                    className="flex gap-3.5 rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/30"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                      {step.step}
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-foreground">{step.title}</h5>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ABA 3: CAMPOS E STATUS */}
            <TabsContent value="campos" className="space-y-4 m-0">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Significado dos Principais Campos & Status
                </h4>
              </div>

              <div className="grid gap-3">
                {currentGuide.fieldsAndStatus.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground font-mono">{item.term}</span>
                      {item.type && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] uppercase tracking-wider px-1.5 py-0 h-4 bg-muted/60"
                        >
                          {item.type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ABA 4: CHECKLIST E DÚVIDAS */}
            <TabsContent value="duvidas" className="space-y-6 m-0">
              {/* Checklist de Validação */}
              {currentGuide.checklist && currentGuide.checklist.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      O que conferir antes de concluir?
                    </h4>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2.5">
                    {currentGuide.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <span className="h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                          ✓
                        </span>
                        <span className="text-xs text-foreground/90 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Problemas Comuns */}
              {currentGuide.commonIssues && currentGuide.commonIssues.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Problemas Comuns & Como Resolver
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {currentGuide.commonIssues.map((issue, idx) => (
                      <div key={idx} className="rounded-xl border border-border/80 bg-card p-4 space-y-1.5">
                        <p className="text-xs font-bold text-foreground">❓ {issue.question}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-4">
                          👉 {issue.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção Visual: Fluxo do Processo (Pipeline) no final das dúvidas */}
              {pipelineData && (
                <div className="pt-6 border-t border-border/80">
                  <ContextualPipeline
                    pipeline={pipelineData.pipeline}
                    currentStepId={pipelineData.currentStepId}
                  />
                </div>
              )}
            </TabsContent>

            {/* ABA 5: FLUXO DO PROCESSO DEDICADA */}
            {pipelineData && (
              <TabsContent value="fluxo" className="space-y-4 m-0">
                <ContextualPipeline
                  pipeline={pipelineData.pipeline}
                  currentStepId={pipelineData.currentStepId}
                />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>

        {/* Rodapé Informativo */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Sistema Orbe ERP 2026 · Guia Oficial</span>
          </div>
          <Button variant="outline" size="sm" onClick={closeHelp} className="h-7 text-xs">
            Entendi, fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
