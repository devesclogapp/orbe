import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding, ONBOARDING_STEPS } from "@/contexts/OnboardingContext";

export function OnboardingProgressBar() {
  const { currentStep, completedSteps, progressPercentage } = useOnboarding();

  const getStepStatus = (stepId: string) => {
    if (completedSteps.includes(stepId as any)) return "completed";
    if (currentStep === stepId) return "current";
    return "pending";
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progresso do Onboarding</span>
        <span className="font-medium">{progressPercentage}%</span>
      </div>
      
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 h-1 w-[calc(100%-2rem)] bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="relative flex justify-between">
          {ONBOARDING_STEPS.map((step, index) => {
            const status = getStepStatus(step.id);
            return (
              <div 
                key={step.id} 
                className="flex flex-col items-center"
                style={{ zIndex: 1 }}
              >
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    status === "completed" && "bg-primary border-primary text-primary-foreground",
                    status === "current" && "bg-background border-primary text-primary animate-pulse",
                    status === "pending" && "bg-background border-muted-foreground text-muted-foreground"
                  )}
                >
                  {status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : status === "current" ? (
                    <Circle className="w-3 h-3 fill-primary" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>
                <span className={cn(
                  "text-xs mt-2 font-medium text-center hidden sm:block",
                  status === "completed" && "text-primary",
                  status === "current" && "text-primary",
                  status === "pending" && "text-muted-foreground"
                )}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}