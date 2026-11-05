import React from "react";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Info,
  Lightbulb,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PassoComoUtilizar {
  passo: number;
  titulo: string;
  desc: string;
}

export interface RegraObservar {
  titulo: string;
  desc: string;
  tipo?: "alerta" | "info" | "bloqueio";
}

export interface ExemploPratico {
  cenario: string;
  acao: string;
  resultado: string;
}

export interface DuvidaFrequente {
  pergunta: string;
  resposta: string;
}

export interface GuiaUsoData {
  titulo: string;
  subtitulo: string;
  tagline?: string;
  paraQueServe: string;
  comoUtilizar: PassoComoUtilizar[];
  oQueObservar: RegraObservar[];
  exemploPratico: ExemploPratico;
  duvidasFrequentes: DuvidaFrequente[];
}

interface GuiaUsoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: GuiaUsoData;
}

export const GuiaUsoDrawer: React.FC<GuiaUsoDrawerProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">
        {/* Cabeçalho do Drawer */}
        <SheetHeader className="p-6 border-b border-border/80 bg-muted/20 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] font-mono tracking-wider uppercase bg-background">
              {data.tagline || "Guia de Uso Contextual"}
            </Badge>
          </div>
          <SheetTitle className="text-base font-bold text-foreground tracking-tight">
            {data.titulo}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
            {data.subtitulo}
          </SheetDescription>
        </SheetHeader>

        {/* Corpo com as 5 Seções Didáticas Obrigatórias */}
        <div className="p-6 space-y-6 flex-1 text-xs">
          {/* SEÇÃO 1: PARA QUE SERVE */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              <span>1. Para que serve</span>
            </div>
            <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 text-foreground leading-relaxed text-xs">
              {data.paraQueServe}
            </div>
          </section>

          {/* SEÇÃO 2: COMO UTILIZAR (PASSO A PASSO) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>2. Como utilizar (Passo a Passo)</span>
            </div>
            <div className="space-y-2.5">
              {data.comoUtilizar.map((item) => (
                <div
                  key={item.passo}
                  className="p-3 rounded-lg border border-border bg-card flex items-start gap-3 shadow-xs"
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {item.passo}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <span className="font-bold text-foreground text-xs block">
                      {item.titulo}
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SEÇÃO 3: O QUE OBSERVAR (REGRAS E BLOQUEIOS) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
              <span>3. O que observar (Regras e Bloqueios)</span>
            </div>
            <div className="space-y-2">
              {data.oQueObservar.map((regra, idx) => {
                const isBloqueio = regra.tipo === "bloqueio";
                const isAlerta = regra.tipo === "alerta";

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      isBloqueio
                        ? "border-destructive/30 bg-destructive/5 text-destructive-foreground"
                        : isAlerta
                        ? "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200"
                        : "border-border/80 bg-muted/30 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        {isBloqueio ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : isAlerta ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                        {regra.titulo}
                      </span>
                      {isBloqueio && (
                        <Badge variant="destructive" className="text-[9px] uppercase h-5 font-bold">
                          Bloqueio
                        </Badge>
                      )}
                      {isAlerta && (
                        <Badge variant="outline" className="text-[9px] uppercase h-5 text-amber-600 border-amber-300 dark:border-amber-700">
                          Atenção
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed pl-5">
                      {regra.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SEÇÃO 4: EXEMPLO PRÁTICO */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <span>4. Exemplo prático de uso</span>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Cenário de Negócio:
                </span>
                <p className="text-foreground font-medium">{data.exemploPratico.cenario}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <ArrowRight className="h-3 w-3" />
                  <span>Ação no Sistema:</span>
                </div>
                <p className="text-muted-foreground">{data.exemploPratico.acao}</p>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Resultado Obtido:
                </span>
                <p className="text-foreground">{data.exemploPratico.resultado}</p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 5: DÚVIDAS FREQUENTES */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>5. Dúvidas frequentes</span>
            </div>
            <div className="space-y-2">
              {data.duvidasFrequentes.map((faq, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border bg-muted/15 space-y-1"
                >
                  <span className="font-bold text-foreground block">
                    Q: {faq.pergunta}
                  </span>
                  <p className="text-muted-foreground leading-relaxed pl-3.5 border-l-2 border-primary/40 mt-1">
                    {faq.resposta}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Rodapé do Drawer */}
        <SheetFooter className="p-4 border-t border-border/80 bg-muted/20 sticky bottom-0 z-10 backdrop-blur">
          <Button
            className="w-full h-9 font-semibold text-xs"
            onClick={onClose}
          >
            Entendi, fechar guia
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

