import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface OnboardingRedirectProps {
  children: React.ReactNode;
}

export function OnboardingRedirect({ children }: OnboardingRedirectProps) {
  const navigate = useNavigate();
  const { isActive, isOnboardingComplete } = useOnboarding();

  useEffect(() => {
    if (isActive && !isOnboardingComplete) {
      navigate("/onboarding", { replace: true });
    }
  }, [isActive, isOnboardingComplete, navigate]);

  if (isActive && !isOnboardingComplete) {
    return null;
  }

  return <>{children}</>;
}