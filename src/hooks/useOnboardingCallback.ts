import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";

const ONBOARDING_RETURN_PARAM = "onboarding_return";

export function useOnboardingCallback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetchStatus } = useOnboarding();
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const setOnboardingReturn = () => {
    const currentParams = new URLSearchParams(searchParams);
    currentParams.set(ONBOARDING_RETURN_PARAM, "true");
    setSearchParams(currentParams);
  };

  const clearOnboardingReturn = () => {
    const currentParams = new URLSearchParams(searchParams);
    currentParams.delete(ONBOARDING_RETURN_PARAM);
    setSearchParams(currentParams);
  };

  const isOnboardingReturn = searchParams.get(ONBOARDING_RETURN_PARAM) === "true";

  const handleOnboardingReturn = async () => {
    console.log("[OnboardingCallback] handleOnboardingReturn called, isOnboardingReturn:", isOnboardingReturn);
    if (isOnboardingReturn) {
      // Don't clear immediately, we might need it for the modal logic if we want to be safe, 
      // but the component state showSuccessModal will handle the UI.
      console.log("[OnboardingCallback] Calling refetchStatus...");
      await refetchStatus();
      console.log("[OnboardingCallback] refetchStatus completed");
      setShowSuccessModal(true);
      return true;
    }
    return false;
  };

  return {
    setOnboardingReturn,
    clearOnboardingReturn,
    isOnboardingReturn,
    handleOnboardingReturn,
    showSuccessModal,
    setShowSuccessModal,
  };
}