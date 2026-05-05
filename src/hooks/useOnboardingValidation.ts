import { useOnboarding } from "@/contexts/OnboardingContext";
import { toast } from "sonner";

export function useOnboardingValidation() {
  const { dataStatus, isActive } = useOnboarding();

  const validateOperation = (): boolean => {
    if (!dataStatus.hasClient) {
      toast.warning("Para criar operações, é necessário cadastrar pelo menos 1 cliente.");
      return false;
    }

    if (!dataStatus.hasRule) {
      toast.warning("Para criar operações, é necessário criar pelo menos 1 regra de valor de serviço.");
      return false;
    }

    return true;
  };

  const validateFornecedor = (): boolean => {
    if (!dataStatus.hasSupplier) {
      toast.warning("Para continuar, é necessário cadastrar pelo menos 1 fornecedor.");
      return false;
    }
    return true;
  };

  const validateColaborador = (): boolean => {
    if (!dataStatus.hasCollaborator) {
      toast.warning("Para continuar, é necessário cadastrar pelo menos 1 colaborador.");
      return false;
    }
    return true;
  };

  const validateRegras = (): boolean => {
    if (!dataStatus.hasRule) {
      toast.warning("Para continuar, é necessário criar pelo menos 1 regra operacional.");
      return false;
    }
    return true;
  };

  return {
    dataStatus,
    isActive,
    validateOperation,
    validateFornecedor,
    validateColaborador,
    validateRegras,
  };
}