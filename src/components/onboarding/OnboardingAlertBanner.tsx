import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OnboardingAlertBannerProps {
  requiredData?: ("client" | "supplier" | "collaborator" | "rule")[];
}

export function OnboardingAlertBanner({ requiredData = ["client", "rule"] }: OnboardingAlertBannerProps) {
  const navigate = useNavigate();
  const { dataStatus, currentStep, isActive } = useOnboarding();

  if (!isActive) return null;

  const getMissingDataMessage = () => {
    const missing: string[] = [];
    
    if (requiredData.includes("client") && !dataStatus.hasClient) {
      missing.push("cliente");
    }
    if (requiredData.includes("supplier") && !dataStatus.hasSupplier) {
      missing.push("fornecedor");
    }
    if (requiredData.includes("collaborator") && !dataStatus.hasCollaborator) {
      missing.push("colaborador");
    }
    if (requiredData.includes("rule") && !dataStatus.hasRule) {
      missing.push("regra operacional");
    }

    if (missing.length === 0) return null;

    const lastItem = missing[missing.length - 1];
    const otherItems = missing.slice(0, -1).join(", ");
    const prefix = otherItems ? `${otherItems} e ` : "";
    
    return `Para continuar, você precisa cadastrar pelo menos 1 ${prefix}${lastItem}.`;
  };

  const message = getMissingDataMessage();
  if (!message) return null;

  const handleGoToOnboarding = () => {
    navigate("/onboarding");
  };

  return (
    <Alert variant="default" className="bg-amber-50 border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Setup Necessário</AlertTitle>
      <AlertDescription className="text-amber-700">
        {message}
        <Button 
          variant="link" 
          className="text-amber-700 p-0 h-auto font-semibold ml-1"
          onClick={handleGoToOnboarding}
        >
          Ver onboarding <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function OnboardingWidget() {
  const navigate = useNavigate();
  const { progressPercentage, dataStatus, isActive, currentStep } = useOnboarding();

  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={() => navigate("/onboarding")}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
          {progressPercentage}%
        </div>
        <span className="text-sm font-medium">Onboarding</span>
      </button>
    </div>
  );
}