import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface OnboardingRedirectProps {
  children: React.ReactNode;
}

export function OnboardingRedirect({ children }: OnboardingRedirectProps) {
  const navigate = useNavigate();
  const { isActive, dataStatus, progressPercentage } = useOnboarding();

  useEffect(() => {
    if (isActive && progressPercentage < 100) {
      navigate("/onboarding", { replace: true });
    }
  }, [isActive, progressPercentage, navigate]);

  if (isActive && progressPercentage < 100) {
    return null;
  }

  return <>{children}</>;
}