import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Settings2,
  PlayCircle,
  BarChart3,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  PartyPopper,
  AlertTriangle,
} from "lucide-react";
import { useOnboarding, ONBOARDING_STEPS } from "@/contexts/OnboardingContext";
import { AppShell } from "@/components/layout/AppShell";
import { OnboardingProgressBar } from "@/components/onboarding/OnboardingProgressBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepChecklistItem {
  id: string;
  label: string;
  isComplete: boolean;
  link?: string;
  linkLabel?: string;
  isHeader?: boolean;
}

function getStepChecklist(stepId: string, dataStatus: any): StepChecklistItem[] {
  const returnParam = "?onboarding_return=true";

  switch (stepId) {
    case "cadastro_base":
      return [
        {
          id: "empresa",
          label: "Cadastrar a empresa (contratante)",
          isComplete: dataStatus.hasEmpresa,
          link: `/empresas${returnParam}`,
          linkLabel: "Ir para Empresas",
        },
        {
          id: "transportadora",
          label: "Cadastrar pelo menos 1 transportadora",
          isComplete: dataStatus.hasTransportadora,
          link: `/transportadoras?tab=transportadoras&onboarding_return=true`,
          linkLabel: "Ir para Transportadoras",
        },
        {
          id: "fornecedor",
          label: "Cadastrar pelo menos 1 fornecedor",
          isComplete: dataStatus.hasSupplier,
          link: `/fornecedores${returnParam}`,
          linkLabel: "Ir para Fornecedores",
        },
      ];
    case "colaboradores":
      return [
        {
          id: "header_detectados",
          label: "Colaboradores detectados:",
          isComplete: true,
          isHeader: true,
        },
        {
          id: "colaborador_clt",
          label: dataStatus.totalPontoImportado > 0
            ? `✓ ${dataStatus.totalPontoImportado} colaboradores importados do ponto`
            : "Colaboradores CLT detectados",
          isComplete: dataStatus.hasClt,
          link: `/colaboradores${returnParam}`,
          linkLabel: "Ver CLT",
        },
        {
          id: "header_pendencias",
          label: "Pendências para utilização do sistema:",
          isComplete: dataStatus.hasOperational && dataStatus.hasDiarista,
          isHeader: true,
        },
        {
          id: "colaborador_operacional",
          label: "Cadastrar colaborador operacional",
          isComplete: dataStatus.hasOperational,
          link: `/colaboradores${returnParam}`,
          linkLabel: "Ir para Colaboradores",
        },
        {
          id: "colaborador_diarista",
          label: "Cadastrar diarista",
          isComplete: dataStatus.hasDiarista,
          link: `/colaboradores${returnParam}`,
          linkLabel: "Ir para Colaboradores",
        },
      ];
    case "regras":
      return [
        {
          id: "regra",
          label: "Criar regra de valor de serviço",
          isComplete: dataStatus.hasRule,
          link: `/cadastros/regras-operacionais?tab=operacional&onboarding_return=true`,
          linkLabel: "Ir para Regras",
        },
        {
          id: "diarista",
          label: "Criar regra/multiplicador de diarista",
          isComplete: dataStatus.hasDiaristaRule,
          link: `/cadastros/regras-operacionais?tab=diaristas&onboarding_return=true`,
          linkLabel: "Ir para Diaristas",
        },
        {
          id: "pagamento",
          label: "Configurar meios de pagamento",
          isComplete: dataStatus.hasPagamento,
          link: `/cadastros/regras-operacionais?tab=meios-pagamento&onboarding_return=true`,
          linkLabel: "Ir para Meios Pagt.",
        },
        {
          id: "taxas",
          label: "Configurar taxas e impostos",
          isComplete: dataStatus.hasTaxa,
          link: `/cadastros/regras-operacionais?tab=taxas-impostos&onboarding_return=true`,
          linkLabel: "Ir para Taxas",
        },
        {
          id: "servicos_especificos",
          label: "Configurar serviços específicos, se aplicável",
          isComplete: true, // Opcional, consideramos sempre true para liberar mas exibimos o link para incentivar
          link: `/cadastros/regras-operacionais?tab=especificos&onboarding_return=true`,
          linkLabel: "Acessar",
        },
      ];
    case "primeira_operacao":
      return [
        {
          id: "operacao",
          label: "Registrar pelo menos 1 operação",
          isComplete: dataStatus.hasOperation,
          link: `/operacional/operacoes${returnParam}`,
          linkLabel: "Ir para Operações",
        },
      ];
    case "resultados":
      return [
        {
          id: "resultado",
          label: "Visualizar resultados no dashboard",
          isComplete: dataStatus.hasOperation,
          link: "/",
          linkLabel: "Ir para Dashboard",
        },
      ];
    default:
      return [];
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const {
    currentStep,
    completedSteps,
    dataStatus,
    canAdvance,
    progressPercentage,
    setStep,
    completeStep,
    skipOnboarding,
    finishOnboarding,
    refetchStatus,
  } = useOnboarding();

  // Refetch dados ao carregar a página
  useEffect(() => {
    refetchStatus();
  }, [refetchStatus]);

  const currentStepIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep);
  const checklist = getStepChecklist(currentStep, dataStatus);

  const handleNext = () => {
    completeStep(currentStep);
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      const nextStep = ONBOARDING_STEPS[currentStepIndex + 1].id;
      setStep(nextStep);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      const prevStep = ONBOARDING_STEPS[currentStepIndex - 1].id;
      setStep(prevStep);
    }
  };

  const isLastStep = currentStep === "resultados";
  const isFirstStep = currentStepIndex === 0;

  if (isLastStep && canAdvance) {
    return <OnboardingSuccess />;
  }

  return (
    <AppShell title="Onboarding Inicial">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Bem-vindo ao ERP Orbe!</h1>
          <p className="text-muted-foreground">
            Vamos configurar seu ambiente de trabalho em poucos passos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                {currentStepIndex + 1}
              </span>
              {ONBOARDING_STEPS[currentStepIndex].title}
            </CardTitle>
            <CardDescription>
              {ONBOARDING_STEPS[currentStepIndex].description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <OnboardingProgressBar />

            <div className="space-y-4">
              <h3 className="font-medium">O que você precisa fazer:</h3>
              <div className="space-y-3">
                {checklist.map((item) => {
                  if (item.isHeader) {
                    return (
                      <h4 key={item.id} className="text-sm font-semibold mt-4 mb-2 first:mt-0">
                        {item.label}
                      </h4>
                    );
                  }

                  return (
                    <div key={item.id} className="space-y-2">
                      <div
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          item.isComplete
                            ? "border-green-500 bg-green-50/50"
                            : "border-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {item.isComplete ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "text-sm",
                            item.isComplete && "text-muted-foreground line-through"
                          )}>
                            {item.label}
                          </span>
                          {item.isComplete && (
                            <Badge variant="outline" className="text-green-500 border-green-500">
                              Concluído
                            </Badge>
                          )}
                        </div>
                        {(!item.isComplete || item.id === 'colaborador_clt') && item.link && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(item.link!)}
                          >
                            {item.linkLabel}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                      </div>

                      {item.id === "colaborador_clt" && dataStatus.totalCltPendentes > 0 && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{dataStatus.totalCltPendentes} colaboradores precisam de complemento para liberar processamento RH</span>
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-amber-700 font-bold hover:text-amber-800"
                            onClick={() => navigate(`/colaboradores?status=pendente&onboarding_return=true`)}
                          >
                            Ver pendências CLT
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isFirstStep}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={handleNext}
                  disabled={!canAdvance}
                >
                  {isLastStep ? "Finalizar" : "Próximo"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

            {!canAdvance && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                Complete os itens acima para avançar para a próxima etapa.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visão Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {ONBOARDING_STEPS.map((step, index) => {
                const isCompleted = completedSteps.includes(step.id);
                const isCurrent = currentStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => setStep(step.id)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      isCompleted && "border-green-500 bg-green-50",
                      isCurrent && "border-primary bg-primary/5 ring-2 ring-primary",
                      !isCompleted && !isCurrent && "border-muted hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className={cn(
                          "w-5 h-5 rounded-full text-xs flex items-center justify-center",
                          isCurrent ? "bg-primary text-white" : "bg-muted"
                        )}>
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium line-clamp-1">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function OnboardingSuccess() {
  const navigate = useNavigate();
  const { finishOnboarding, skipOnboarding } = useOnboarding();

  useEffect(() => {
    const timer = setTimeout(() => {
      finishOnboarding();
    }, 100);
    return () => clearTimeout(timer);
  }, [finishOnboarding]);

  return (
    <AppShell title="Sucesso">
      <div className="max-w-2xl mx-auto text-center space-y-8 py-12">
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center animate-bounce">
            <PartyPopper className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold">Parabéns!</h1>
          <p className="text-xl text-muted-foreground">
            Você completou o onboarding e seu sistema está pronto para uso!
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-green-700">Setup inicial concluído</span>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              Agora você pode utilizar todas as funcionalidades do ERP Orbe.
              Comece pelo Dashboard para visualizar seus indicadores ou navegue pelos
              menus laterais para acessar os diferentes módulos do sistema.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate("/")} size="lg">
            <BarChart3 className="w-4 h-4 mr-2" />
            Ir para Dashboard
          </Button>
        </div>
      </div>
    </AppShell>
  );
}