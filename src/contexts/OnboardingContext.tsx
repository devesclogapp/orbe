import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "./TenantContext";
import { useAuth } from "./AuthContext";

export type OnboardingStep = 
  | "cadastro_base"
  | "colaboradores"
  | "regras"
  | "primeira_operacao"
  | "resultados";

export interface OnboardingStepInfo {
  id: OnboardingStep;
  title: string;
  description: string;
  icon: string;
  minDataRequired: {
    hasClient: boolean;
    hasSupplier: boolean;
    hasCollaborator: boolean;
    hasRule: boolean;
    hasOperation: boolean;
  };
}

export const ONBOARDING_STEPS: OnboardingStepInfo[] = [
  {
    id: "cadastro_base",
    title: "Cadastro Base",
    description: "Configure a empresa, clientes e fornecedores",
    icon: "Building2",
    minDataRequired: {
      hasClient: true,
      hasSupplier: true,
      hasCollaborator: false,
      hasRule: false,
      hasOperation: false,
    },
  },
  {
    id: "colaboradores",
    title: "Colaboradores",
    description: "Cadastre seus colaboradores",
    icon: "Users",
    minDataRequired: {
      hasClient: true,
      hasSupplier: true,
      hasCollaborator: true,
      hasRule: false,
      hasOperation: false,
    },
  },
  {
    id: "regras",
    title: "Regras Operacionais",
    description: "Defina valores e regras de cálculo",
    icon: "Settings2",
    minDataRequired: {
      hasClient: true,
      hasSupplier: true,
      hasCollaborator: true,
      hasRule: true,
      hasOperation: false,
    },
  },
  {
    id: "primeira_operacao",
    title: "Primeira Operação",
    description: "Registre sua primeira operação",
    icon: "PlayCircle",
    minDataRequired: {
      hasClient: true,
      hasSupplier: true,
      hasCollaborator: false,
      hasRule: true,
      hasOperation: true,
    },
  },
  {
    id: "resultados",
    title: "Resultados",
    description: "Visualize o desempenho",
    icon: "BarChart3",
    minDataRequired: {
      hasClient: true,
      hasSupplier: true,
      hasCollaborator: false,
      hasRule: true,
      hasOperation: true,
    },
  },
];

interface OnboardingDataStatus {
  hasClient: boolean;
  hasSupplier: boolean;
  hasCollaborator: boolean;
  hasRule: boolean;
  hasOperation: boolean;
  hasEmpresa: boolean;
  hasTransportadora: boolean;
  totalClientes: number;
  totalFornecedores: number;
  totalColaboradores: number;
  totalRegras: number;
  totalOperacoes: number;
}

interface OnboardingContextType {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isActive: boolean;
  dataStatus: OnboardingDataStatus;
  canAdvance: boolean;
  progressPercentage: number;
  setStep: (step: OnboardingStep) => void;
  completeStep: (step: OnboardingStep) => void;
  startOnboarding: () => void;
  finishOnboarding: () => void;
  skipOnboarding: () => void;
  refetchStatus: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("cadastro_base");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [dataStatus, setDataStatus] = useState<OnboardingDataStatus>({
    hasClient: false,
    hasSupplier: false,
    hasCollaborator: false,
    hasRule: false,
    hasOperation: false,
    hasEmpresa: false,
    totalClientes: 0,
    totalFornecedores: 0,
    totalColaboradores: 0,
    totalRegras: 0,
    totalOperacoes: 0,
  });

  const fetchDataStatus = useCallback(async () => {
    console.log("[OnboardingContext] fetchDataStatus called, tenantId:", tenantId);
    if (!tenantId) {
      console.log("[OnboardingContext] No tenantId, skipping");
      return;
    }

    try {
      console.log("[OnboardingContext] Fetching data for tenant:", tenantId);
      
      const [empresasRes, transportadorasRes, fornecedoresRes, colaboradoresRes, regrasRes, operacoesRes] = await Promise.all([
        supabase.from("empresas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativa", true),
        supabase.from("transportadoras_clientes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("tipo_cadastro", "transportadora").eq("ativo", true),
        supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("colaboradores").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("fornecedor_valores_servico").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("operacoes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);

      const hasEmpresa = (empresasRes.count ?? 0) > 0;
      const hasTransportadora = (transportadorasRes.count ?? 0) > 0;
      const hasSupplier = (fornecedoresRes.count ?? 0) > 0;
      const hasCollaborator = (colaboradoresRes.count ?? 0) > 0;
      const hasRule = (regrasRes.count ?? 0) > 0;
      const hasOperation = (operacoesRes.count ?? 0) > 0;

      console.log("[OnboardingContext] Results:", {
        hasEmpresa,
        hasTransportadora,
        hasSupplier,
        hasCollaborador: hasCollaborator,
        hasRule,
        hasOperation
      });

      setDataStatus({
        hasClient: hasTransportadora, // Para manter compatibilidade, usa transportadora como "cliente"
        hasSupplier,
        hasCollaborator,
        hasRule,
        hasOperation,
        hasEmpresa,
        hasTransportadora,
        totalClientes: transportadorasRes.count ?? 0,
        totalFornecedores: fornecedoresRes.count ?? 0,
        totalColaboradores: colaboradoresRes.count ?? 0,
        totalRegras: regrasRes.count ?? 0,
        totalOperacoes: operacoesRes.count ?? 0,
      });
    } catch (error) {
      console.error("[OnboardingContext] Erro ao buscar status:", error);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && user) {
      fetchDataStatus();
      checkOnboardingStatus();
    }
  }, [tenantId, user, fetchDataStatus]);

  const checkOnboardingStatus = async () => {
    if (!user) return;
    
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_step, onboarding_completed_steps")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.warn("[OnboardingContext] Campos de onboarding não existem ainda");
        setIsActive(true);
        return;
      }

      if (profile) {
        if (profile.onboarding_completed) {
          setIsActive(false);
        } else {
          setIsActive(true);
          if (profile.onboarding_step) {
            setCurrentStep(profile.onboarding_step as OnboardingStep);
          }
          if (profile.onboarding_completed_steps) {
            setCompletedSteps(profile.onboarding_completed_steps as OnboardingStep[]);
          }
        }
      }
    } catch (error) {
      console.error("[OnboardingContext] Erro ao verificar status:", error);
    }
  };

  const saveOnboardingState = async (step: OnboardingStep, completed: OnboardingStep[]) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_step: step,
          onboarding_completed_steps: completed,
        })
        .eq("user_id", user.id);
      
      if (error) {
        console.warn("[OnboardingContext] Campos de onboarding não existem ainda - ignorando");
      }
    } catch (error) {
      console.warn("[OnboardingContext] Erro ao salvar estado:", error);
    }
  };

  const getCurrentStepRequirements = useCallback((): OnboardingStep["minDataRequired"] => {
    const stepInfo = ONBOARDING_STEPS.find(s => s.id === currentStep);
    return stepInfo?.minDataRequired || {
      hasClient: false,
      hasSupplier: false,
      hasCollaborator: false,
      hasRule: false,
      hasOperation: false,
    };
  }, [currentStep]);

  const canAdvance = useMemo(() => {
    const req = getCurrentStepRequirements();
    
    switch (currentStep) {
      case "cadastro_base":
        return dataStatus.hasEmpresa && dataStatus.hasTransportadora && dataStatus.hasSupplier;
      case "colaboradores":
        return dataStatus.hasCollaborator;
      case "regras":
        return dataStatus.hasRule;
      case "primeira_operacao":
        return dataStatus.hasOperation;
      case "resultados":
        return dataStatus.hasOperation;
      default:
        return false;
    }
  }, [currentStep, dataStatus, getCurrentStepRequirements]);

  const progressPercentage = useMemo(() => {
    // Calcular progresso baseado nos dados reais do banco
    let itemsCompleted = 0;
    let totalItems = 0;
    
    switch (currentStep) {
      case "cadastro_base":
        totalItems = 3;
        if (dataStatus.hasEmpresa) itemsCompleted++;
        if (dataStatus.hasTransportadora) itemsCompleted++;
        if (dataStatus.hasSupplier) itemsCompleted++;
        break;
      case "colaboradores":
        totalItems = 1;
        if (dataStatus.hasCollaborator) itemsCompleted = 1;
        break;
      case "regras":
        totalItems = 1;
        if (dataStatus.hasRule) itemsCompleted = 1;
        break;
      case "primeira_operacao":
        totalItems = 1;
        if (dataStatus.hasOperation) itemsCompleted = 1;
        break;
      case "resultados":
        totalItems = 1;
        if (dataStatus.hasOperation) itemsCompleted = 1;
        break;
    }
    
    // Progresso global considerando etapas anteriores completadas
    const globalProgress = (itemsCompleted / totalItems) * 100;
    return Math.round(globalProgress);
  }, [currentStep, dataStatus]);

  const setStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
    saveOnboardingState(step, completedSteps);
  }, [completedSteps]);

  const completeStep = useCallback((step: OnboardingStep) => {
    setCompletedSteps(prev => {
      if (prev.includes(step)) return prev;
      const newCompleted = [...prev, step];
      saveOnboardingState(step, newCompleted);
      return newCompleted;
    });
  }, []);

  const startOnboarding = useCallback(async () => {
    setIsActive(true);
    setCurrentStep("cadastro_base");
    setCompletedSteps([]);
    await saveOnboardingState("cadastro_base", []);
  }, []);

  const finishOnboarding = useCallback(async () => {
    setIsActive(false);
    if (user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("user_id", user.id);
        
        if (error) {
          console.warn("[OnboardingContext] Campos de onboarding não existem ainda");
        }
      } catch (e) {
        console.warn("[OnboardingContext] Erro ao finalizar onboarding");
      }
    }
  }, [user]);

  const skipOnboarding = useCallback(async () => {
    setIsActive(false);
    if (user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("user_id", user.id);
        
        if (error) {
          console.warn("[OnboardingContext] Campos de onboarding não existem ainda");
        }
      } catch (e) {
        console.warn("[OnboardingContext] Erro ao pular onboarding");
      }
    }
  }, [user]);

  const value = useMemo(() => ({
    currentStep,
    completedSteps,
    isActive,
    dataStatus,
    canAdvance,
    progressPercentage,
    setStep,
    completeStep,
    startOnboarding,
    finishOnboarding,
    skipOnboarding,
    refetchStatus: fetchDataStatus,
  }), [currentStep, completedSteps, isActive, dataStatus, canAdvance, progressPercentage, setStep, completeStep, startOnboarding, finishOnboarding, skipOnboarding, fetchDataStatus]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
};