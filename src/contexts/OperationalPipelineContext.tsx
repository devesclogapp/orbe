import { createContext, useCallback, useContext, useState, ReactNode } from "react";

// ─── Pipeline Step Types ──────────────────────────────────────────────────────

export type PipelineStepStatus = "done" | "current" | "pending" | "blocked";

export type PipelineStep = {
    id: string;
    label: string;
    description: string;
    status: PipelineStepStatus;
    timestamp?: string;     // ISO string, shown for done steps
    responsible?: string;   // "RH" | "Financeiro" | "Admin" etc.
    route?: string;         // navigation target for this step
};

export type PipelineFlow =
    | "FOLHA_VARIAVEL"
    | "BANCO_HORAS"
    | "APROVACAO_FINANCEIRA"
    | "CNAB_REMESSA";

export type PipelineContext = {
    competencia: string;   // e.g. "maio/2026"
    empresa: string;       // e.g. "ESC Log"
    fluxo: string;         // human-readable
};

export type PipelineTrigger = {
    context: PipelineContext;
    steps: PipelineStep[];
    completedStage?: {
        label: string;
        description: string;
    };
    nextAction?: {
        label: string;           // button text, e.g. "Ir para Financeiro"
        description: string;     // what happens next
        route: string;           // navigation target
    };
};

// ─── Context Interface ────────────────────────────────────────────────────────

type OperationalPipelineContextValue = {
    isOpen: boolean;
    payload: PipelineTrigger | null;
    openPipeline: (trigger: PipelineTrigger) => void;
    closePipeline: () => void;
};

const OperationalPipelineContext = createContext<OperationalPipelineContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const OperationalPipelineProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [payload, setPayload] = useState<PipelineTrigger | null>(null);

    const openPipeline = useCallback((trigger: PipelineTrigger) => {
        setPayload(trigger);
        setIsOpen(true);
    }, []);

    const closePipeline = useCallback(() => {
        setIsOpen(false);
        // Delay clearing payload to allow exit animation
        setTimeout(() => setPayload(null), 300);
    }, []);

    return (
        <OperationalPipelineContext.Provider value={{ isOpen, payload, openPipeline, closePipeline }}>
            {children}
        </OperationalPipelineContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useOperationalPipeline = (): OperationalPipelineContextValue => {
    const ctx = useContext(OperationalPipelineContext);
    if (!ctx) throw new Error("useOperationalPipeline must be used inside OperationalPipelineProvider");
    return ctx;
};

// ─── Pipeline Factory Helpers ─────────────────────────────────────────────────

export const buildFolhaVariavelPipeline = (params: {
    competencia: string;
    empresa: string;
    // NOTE: 'importacao' is always shown as 'done' — it precedes all RH steps.
    // The currentStep determines which step is 'current'; everything before it is 'done'.
    currentStep: "importacao" | "rh_processado" | "fechamento_rh" | "envio_financeiro" | "aprovacao_financeira" | "cnab" | "retorno";
}): PipelineTrigger => {
    const { competencia, empresa, currentStep } = params;

    // ⚠️ KEY FIX: stepKeys MUST match the step array indices exactly (1:1 mapping).
    // Steps array has 7 items — stepKeys must also have 7 entries in the same order.
    const stepKeys = ["importacao", "rh_processado", "fechamento_rh", "envio_financeiro", "aprovacao_financeira", "cnab", "retorno"];
    const currentIndex = stepKeys.indexOf(currentStep);
    const now = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    const getStatus = (index: number): PipelineStepStatus => {
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const steps: PipelineStep[] = [
        {
            id: "importacao",            // index 0
            label: "Importação de planilha",
            description: "Planilha importada e colaboradores identificados.",
            status: getStatus(0),
            timestamp: getStatus(0) === "done" ? now : undefined,
            route: "/pontos",
        },
        {
            id: "rh_processado",         // index 1
            label: "Processamento no RH",
            description: "Pontos processados, banco de horas e saldos calculados.",
            status: getStatus(1),
            timestamp: getStatus(1) === "done" ? now : undefined,
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "fechamento_rh",         // index 2
            label: "Validação e fechamento",
            description: "Banco de horas validado e competência fechada pelo RH.",
            status: getStatus(2),
            timestamp: getStatus(2) === "done" ? now : undefined,
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "envio_financeiro",      // index 3
            label: "Envio ao Financeiro",
            description: "Lote aprovado e enviado para fila de pagamento.",
            status: getStatus(3),
            responsible: "RH",
            route: "/financeiro",
        },
        {
            id: "aprovacao_financeira",  // index 4
            label: "Aprovação Financeira",
            description: "Lote revisado e aprovado pelo setor financeiro.",
            status: getStatus(4),
            responsible: "Financeiro / Admin",
            route: "/financeiro",
        },
        {
            id: "cnab",                  // index 5
            label: "Preparação CNAB",
            description: "Remessa bancária gerada e enviada ao banco.",
            status: getStatus(5),
            responsible: "Financeiro",
            route: "/bancario",
        },
        {
            id: "retorno",               // index 6
            label: "Retorno e conciliação",
            description: "Retorno bancário recebido e pagamentos conciliados.",
            status: getStatus(6),
            responsible: "Financeiro",
            route: "/bancario",
        },
    ];

    const nextActionMap: Record<string, { label: string; description: string; route: string }> = {
        importacao: {
            label: "Ir para Processamento RH",
            description: "Planilha importada. Inicie o processamento RH para calcular banco de horas.",
            route: "/banco-horas/processamento",
        },
        rh_processado: {
            label: "Ir para Banco de Horas",
            description: "Processamento RH concluído. Revise os saldos e valide a competência antes de enviar ao Financeiro.",
            route: "/banco-horas",
        },
        fechamento_rh: {
            label: "Aprovar Competência →",
            description: "Competência validada. Aprove e envie o lote ao Financeiro para iniciar o pagamento.",
            route: "/financeiro",
        },
        envio_financeiro: {
            label: "Ir para Central Financeira →",
            description: "O lote foi enviado. O Financeiro pode analisar e aprovar agora.",
            route: "/financeiro",
        },
        aprovacao_financeira: {
            label: "Preparar Remessa CNAB →",
            description: "O lote foi aprovado. Gere agora a remessa bancária CNAB240.",
            route: "/bancario",
        },
        cnab: {
            label: "Verificar Retorno Bancário →",
            description: "A remessa foi enviada. Aguarde o retorno do banco para conciliação.",
            route: "/bancario",
        },
        retorno: {
            label: "Ver histórico →",
            description: "O fluxo foi concluído. Verifique o histórico de remessas.",
            route: "/financeiro/remessa/historico",
        },
    };

    return {
        context: { competencia, empresa, fluxo: "Folha Variável" },
        steps,
        completedStage: {
            label: currentStep === "rh_processado" ? "Processamento RH concluído" : stepKeys[currentIndex] ?? "",
            description: currentStep === "rh_processado"
                ? "Registros processados com sucesso. Banco de horas atualizado e pronto para validação."
                : "Etapa concluída com sucesso.",
        },
        nextAction: nextActionMap[currentStep],
    };
};

export const buildOperationalStagePipeline = (params: {
    competencia: string;
    empresa: string;
    completedStage: "cadastros" | "processamento_rh" | "banco_horas" | "fechamento_mensal";
}): PipelineTrigger => {
    const { competencia, empresa, completedStage } = params;
    const doneAt = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    const completedStageMap = {
        cadastros: {
            label: "Cadastros operacionais completos",
            description: "Colaboradores completos, sem bloqueios operacionais e sem pendencias cadastrais.",
        },
        processamento_rh: {
            label: "Processamento RH concluido",
            description: "Registros processados e competencia pronta para a validacao do banco de horas.",
        },
        banco_horas: {
            label: "Banco de Horas validado",
            description: "Saldos revisados, sem alertas criticos e prontos para o fechamento mensal.",
        },
        fechamento_mensal: {
            label: "Competencia fechada",
            description: "A competencia foi consolidada e pode seguir para a trilha financeira.",
        },
    } as const;

    const nextActionMap = {
        cadastros: {
            label: "Ir para Processamento RH",
            description: "Inicie o Processamento RH para continuar o fluxo operacional.",
            route: "/banco-horas/processamento",
        },
        processamento_rh: {
            label: "Ir para Banco de Horas",
            description: "Valide o Banco de Horas para liberar o fechamento mensal.",
            route: "/banco-horas",
        },
        banco_horas: {
            label: "Ir para Fechamento Mensal",
            description: "Feche a competencia para encaminhar o fluxo a etapa seguinte.",
            route: "/fechamento",
        },
        fechamento_mensal: {
            label: "Ir para Central Financeira",
            description: "Continue o fluxo na Central Financeira.",
            route: "/financeiro",
        },
    } as const;

    const steps: PipelineStep[] = [
        {
            id: "cadastros",
            label: "Central de Cadastros",
            description: "Cadastros operacionais completos e liberados para o fluxo.",
            status: "done",
            timestamp: doneAt,
            route: "/cadastros",
            responsible: "Administracao",
        },
        {
            id: "processamento_rh",
            label: "Processamento RH",
            description: "Processamento e consolidacao operacional da competencia.",
            status:
                completedStage === "cadastros"
                    ? "current"
                    : completedStage === "processamento_rh" || completedStage === "banco_horas" || completedStage === "fechamento_mensal"
                        ? "done"
                        : "pending",
            timestamp:
                completedStage === "processamento_rh" || completedStage === "banco_horas" || completedStage === "fechamento_mensal"
                    ? doneAt
                    : undefined,
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "banco_horas",
            label: "Banco de Horas",
            description: "Validacao de saldos, vencimentos e risco operacional.",
            status:
                completedStage === "processamento_rh"
                    ? "current"
                    : completedStage === "banco_horas" || completedStage === "fechamento_mensal"
                        ? "done"
                        : "pending",
            timestamp:
                completedStage === "banco_horas" || completedStage === "fechamento_mensal"
                    ? doneAt
                    : undefined,
            route: "/banco-horas",
            responsible: "RH",
        },
        {
            id: "fechamento_mensal",
            label: "Fechamento Mensal",
            description: "Consolidacao final da competencia operacional.",
            status: completedStage === "banco_horas" ? "current" : completedStage === "fechamento_mensal" ? "done" : "pending",
            timestamp: completedStage === "fechamento_mensal" ? doneAt : undefined,
            route: "/fechamento",
            responsible: "RH / Operacoes",
        },
        {
            id: "central_financeira",
            label: "Central Financeira",
            description: "Acompanhamento, aprovacao e continuidade financeira da competencia.",
            status: completedStage === "fechamento_mensal" ? "current" : "pending",
            route: "/financeiro",
            responsible: "Financeiro",
        },
    ];

    return {
        context: { competencia, empresa, fluxo: "Pipeline Operacional" },
        steps,
        completedStage: completedStageMap[completedStage],
        nextAction: nextActionMap[completedStage],
    };
};
