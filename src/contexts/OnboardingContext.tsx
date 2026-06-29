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
    hasDiaristaRule?: boolean;
    hasPagamento?: boolean;
    hasTaxa?: boolean;
    hasProduct: boolean;
    hasPeriodos: boolean;
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
      hasProduct: false,
      hasPeriodos: false,
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
      hasProduct: false,
      hasPeriodos: false,
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
      hasDiaristaRule: true,
      hasPagamento: true,
      hasTaxa: true,
      hasProduct: true,
      hasPeriodos: true,
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
      hasProduct: true,
      hasPeriodos: true,
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
      hasProduct: true,
      hasPeriodos: true,
      hasOperation: true,
    },
  },
];

interface OnboardingDataStatus {
  hasClient: boolean;
  hasSupplier: boolean;
  hasCollaborator: boolean;
  hasClt: boolean;
  hasOperational: boolean;
  hasDiarista: boolean;
  hasRule: boolean;
  hasDiaristaRule: boolean;
  hasPagamento: boolean;
  hasTaxa: boolean;
  hasProduct: boolean;
  hasPeriodos: boolean;
  hasOperation: boolean;
  hasEmpresa: boolean;
  hasTransportadora: boolean;
  totalClientes: number;
  totalFornecedores: number;
  totalProdutos: number;
  totalColaboradores: number;
  totalClt: number;
  totalCltPendentes: number;
  totalOperational: number;
  totalDiaristas: number;
  totalPontoImportado: number;
  totalRegras: number;
  totalPeriodos: number;
  totalOperacoes: number;
}

interface OnboardingContextType {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isActive: boolean;
  dataStatus: OnboardingDataStatus;
  canAdvance: boolean;
  isSystemReady: boolean;
  isOnboardingComplete: boolean;
  isDataLoaded: boolean;
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
  const { tenantId, role } = useTenant();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("cadastro_base");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [dataStatus, setDataStatus] = useState<OnboardingDataStatus>({
    hasClient: false,
    hasSupplier: false,
    hasCollaborator: false,
    hasClt: false,
    hasOperational: false,
    hasDiarista: false,
    hasRule: false,
    hasDiaristaRule: false,
    hasPagamento: false,
    hasTaxa: false,
    hasProduct: false,
    hasPeriodos: false,
    hasOperation: false,
    hasEmpresa: false,
    hasTransportadora: false,
    totalClientes: 0,
    totalFornecedores: 0,
    totalProdutos: 0,
    totalColaboradores: 0,
    totalClt: 0,
    totalCltPendentes: 0,
    totalOperational: 0,
    totalDiaristas: 0,
    totalPontoImportado: 0,
    totalRegras: 0,
    totalPeriodos: 0,
    totalOperacoes: 0,
  });

  const fetchDataStatus = useCallback(async () => {
    console.log("[OnboardingContext] fetchDataStatus called, tenantId:", tenantId, "role:", role);
    if (!tenantId) {
      console.log("[OnboardingContext] No tenantId, skipping");
      return;
    }

    if (role && role !== "admin" && role !== "super_admin") {
      console.log("[OnboardingContext] Skipping full data check for non-admin user");
      setDataStatus(prev => ({
        ...prev,
        hasEmpresa: true,
        hasTransportadora: true,
        hasSupplier: true,
        hasClt: true,
        hasOperational: true,
        hasDiarista: true,
        hasRule: true,
        hasDiaristaRule: true,
        hasPagamento: true,
        hasTaxa: true,
        hasProduct: true,
        hasPeriodos: true,
        hasOperation: true,
      }));
      setIsDataLoaded(true);
      return;
    }

    try {
      console.log("[OnboardingContext] Fetching data for tenant:", tenantId);

      const promises = [
        supabase.from("empresas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "ativa"),
        supabase.from("transportadoras_clientes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        // Colaboradores - Busca detalhada (SEM filtro de status para detecção inicial)
        supabase.from("colaboradores").select("id, status, status_cadastro, cadastro_provisorio, tipo_colaborador, origem_cadastro, permitir_lancamento_operacional").eq("tenant_id", tenantId),
        supabase.from("fornecedor_valores_servico").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("operacoes_producao").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("regras_marcacao_diaristas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("regras_dados").select("id, regras_modulos!inner(slug)").eq("tenant_id", tenantId).in("regras_modulos.slug", ["taxas_impostos", "taxas-impostos"]),
        supabase.from("produtos_carga").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("servicos_especificos_regras").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true),
        supabase.from("formas_pagamento_operacional").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("ativo", true)
      ];

      const results = await Promise.all(promises);

      const tables = ["empresas", "transportadoras_clientes", "fornecedores", "colaboradores", "fornecedor_valores_servico", "operacoes_producao", "regras_marcacao_diaristas", "regras_dados", "produtos_carga", "servicos_especificos_regras", "formas_pagamento_operacional"];
      results.forEach((res, idx) => {
        if (res.error) {
          console.error(`[OnboardingContext] Error fetching ${tables[idx]}:`, res.error);
        }
      });

      const [empresasRes, transportadorasRes, fornecedoresRes, colaboradoresRes, regrasRes, operacoesRes, diaristasRes, modulosRes, produtosRes, periodosRes, formasPagamentoRes] = results;

      const hasEmpresa = (empresasRes.count ?? 0) > 0;
      const hasTransportadora = (transportadorasRes.count ?? 0) > 0;
      const hasSupplier = (fornecedoresRes.count ?? 0) > 0;
      const hasRule = (regrasRes.count ?? 0) > 0;
      const hasOperation = (operacoesRes.count ?? 0) > 0;
      const hasDiaristaRule = (diaristasRes.count ?? 0) > 0;
      const hasProduct = (produtosRes?.count ?? 0) > 0;
      const hasPeriodos = (periodosRes?.count ?? 0) > 0;
      const hasPagamento = (formasPagamentoRes.count ?? 0) > 0;

      // Processamento granular de colaboradores
      const allColaboradores = (colaboradoresRes.data || []) as any[];

      const isClt = (c: any) =>
        String(c.tipo_colaborador || '').toUpperCase() === 'CLT' ||
        c.origem_cadastro === 'ponto_importado' ||
        c.origem_cadastro === 'importacao_ponto';

      const isPendente = (c: any) =>
        c.status !== 'ativo' ||
        c.status_cadastro === 'pendente_complemento' ||
        c.cadastro_provisorio === true;

      const cltColabs = allColaboradores.filter(isClt);
      const cltPendentes = cltColabs.filter(isPendente);

      // Critérios Operacionais exigem status ATIVO
      const operationalColabs = allColaboradores.filter(c =>
        c.status === 'ativo' &&
        c.permitir_lancamento_operacional === true &&
        String(c.tipo_colaborador || '').toUpperCase() !== 'DIARISTA'
      );
      const diaristaColabs = allColaboradores.filter(c =>
        c.status === 'ativo' &&
        String(c.tipo_colaborador || '').toUpperCase() === 'DIARISTA' &&
        c.permitir_lancamento_operacional === true
      );

      const pontoImportadoColabs = allColaboradores.filter(c =>
        c.origem_cadastro === 'ponto_importado' ||
        c.origem_cadastro === 'importacao_ponto'
      );

      const hasClt = cltColabs.length > 0;
      const hasOperational = operationalColabs.length > 0;
      const hasDiarista = diaristaColabs.length > 0;
      const hasCollaborator = hasClt && hasOperational && hasDiarista;

      const dadosRecuperados = (modulosRes.data || []) as any[];
      const hasTaxa = dadosRecuperados.some(d => d.regras_modulos?.slug === 'taxas_impostos' || d.regras_modulos?.slug === 'taxas-impostos');

      console.log("[OnboardingContext] Results:", {
        hasEmpresa,
        hasTransportadora,
        hasSupplier,
        hasClt,
        hasOperational,
        hasDiarista,
        hasRule,
        hasProduct,
        hasPeriodos,
        hasOperation
      });

      setDataStatus({
        hasClient: hasTransportadora,
        hasSupplier,
        hasCollaborator,
        hasClt,
        hasOperational,
        hasDiarista,
        hasRule,
        hasDiaristaRule,
        hasPagamento,
        hasTaxa,
        hasProduct,
        hasPeriodos,
        hasOperation,
        hasEmpresa,
        hasTransportadora,
        totalClientes: transportadorasRes.count ?? 0,
        totalFornecedores: fornecedoresRes.count ?? 0,
        totalProdutos: produtosRes?.count ?? 0,
        totalColaboradores: allColaboradores.length,
        totalClt: cltColabs.length,
        totalCltPendentes: cltPendentes.length,
        totalOperational: operationalColabs.length,
        totalDiaristas: diaristaColabs.length,
        totalPontoImportado: pontoImportadoColabs.length,
        totalRegras: regrasRes.count ?? 0,
        totalPeriodos: periodosRes?.count ?? 0,
        totalOperacoes: operacoesRes.count ?? 0,
      });
      setIsDataLoaded(true);
    } catch (error) {
      console.error("[OnboardingContext] Erro ao buscar status:", error);
    }
  }, [tenantId, role]);

  useEffect(() => {
    if (tenantId && user && role) {
      fetchDataStatus();
      checkOnboardingStatus();
    }
  }, [tenantId, user, role, fetchDataStatus]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    if (role && role !== "admin" && role !== "super_admin") {
      setIsActive(false);
      return;
    }

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

  const getCurrentStepRequirements = useCallback((): OnboardingStepInfo["minDataRequired"] => {
    const stepInfo = ONBOARDING_STEPS.find(s => s.id === currentStep);
    return stepInfo?.minDataRequired || {
      hasClient: false,
      hasSupplier: false,
      hasCollaborator: false,
      hasProduct: false,
      hasPeriodos: false,
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
        return dataStatus.hasClt && dataStatus.hasOperational && dataStatus.hasDiarista;
      case "regras":
        return dataStatus.hasProduct && dataStatus.hasRule && dataStatus.hasDiaristaRule && dataStatus.hasPagamento && dataStatus.hasTaxa && dataStatus.hasPeriodos;
      case "primeira_operacao":
        return dataStatus.hasOperation;
      case "resultados":
        return dataStatus.hasOperation;
      default:
        return false;
    }
  }, [currentStep, dataStatus, getCurrentStepRequirements]);

  const isSystemReady = useMemo(() => {
    return (
      dataStatus.hasEmpresa &&
      dataStatus.hasTransportadora &&
      dataStatus.hasSupplier &&
      dataStatus.hasOperational &&
      dataStatus.hasRule &&
      dataStatus.hasProduct &&
      dataStatus.hasPeriodos
    );
  }, [dataStatus]);

  const isOnboardingComplete = useMemo(() => {
    return (
      dataStatus.hasEmpresa &&
      dataStatus.hasTransportadora &&
      dataStatus.hasSupplier &&
      dataStatus.hasClt &&
      dataStatus.hasOperational &&
      dataStatus.hasDiarista &&
      dataStatus.hasRule &&
      dataStatus.hasDiaristaRule &&
      dataStatus.hasPagamento &&
      dataStatus.hasTaxa &&
      dataStatus.hasProduct &&
      dataStatus.hasPeriodos &&
      dataStatus.hasOperation
    );
  }, [dataStatus]);

  const progressPercentage = useMemo(() => {
    const flags = [
      dataStatus.hasEmpresa,
      dataStatus.hasTransportadora,
      dataStatus.hasSupplier,
      dataStatus.hasClt,
      dataStatus.hasOperational,
      dataStatus.hasDiarista,
      dataStatus.hasRule,
      dataStatus.hasDiaristaRule,
      dataStatus.hasPagamento,
      dataStatus.hasTaxa,
      dataStatus.hasProduct,
      dataStatus.hasPeriodos,
      dataStatus.hasOperation
    ];

    const itemsCompleted = flags.filter(Boolean).length;
    const totalItems = flags.length; // 6 items totais para o onboarding ser completo

    const globalProgress = (itemsCompleted / totalItems) * 100;
    return Math.round(globalProgress);
  }, [dataStatus]);

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
    // Apenas pode pular na parte de sistema se dados estiverem validos (prevenindo burla)
    if (!isOnboardingComplete) {
      console.warn("[OnboardingContext] Tenant tentou pular onboarding mas faltam dados obrigatórios");
      return;
    }

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
  }, [user, isOnboardingComplete]);

  useEffect(() => {
    if (isDataLoaded && (role === "admin" || role === "super_admin") && !isSystemReady && !isActive) {
      console.log("[OnboardingContext] Forcing onboarding active because system is not ready (base data missing)");
      setIsActive(true);
    }
  }, [isDataLoaded, role, isSystemReady, isActive]);

  const value = useMemo(() => ({
    currentStep,
    completedSteps,
    isActive,
    dataStatus,
    canAdvance,
    isSystemReady,
    isOnboardingComplete,
    isDataLoaded,
    progressPercentage,
    setStep,
    completeStep,
    startOnboarding,
    finishOnboarding,
    skipOnboarding,
    refetchStatus: fetchDataStatus,
  }), [currentStep, completedSteps, isActive, dataStatus, canAdvance, isSystemReady, isOnboardingComplete, isDataLoaded, progressPercentage, setStep, completeStep, startOnboarding, finishOnboarding, skipOnboarding, fetchDataStatus]);

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
