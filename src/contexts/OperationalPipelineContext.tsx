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
    currentStep: "rh_processado" | "fechamento_rh" | "envio_financeiro" | "aprovacao_financeira" | "cnab" | "retorno";
}): PipelineTrigger => {
    const { competencia, empresa, currentStep } = params;

    const stepKeys = ["rh_processado", "fechamento_rh", "envio_financeiro", "aprovacao_financeira", "cnab", "retorno"];
    const currentIndex = stepKeys.indexOf(currentStep);
    const now = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

    const getStatus = (index: number): PipelineStepStatus => {
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const steps: PipelineStep[] = [
        {
            id: "importacao",
            label: "Importação de planilha",
            description: "Planilha importada com sucesso.",
            status: getStatus(0),
            timestamp: getStatus(0) === "done" ? now : undefined,
        },
        {
            id: "processamento_rh",
            label: "Processamento no RH",
            description: "Dados processados e cálculos concluídos.",
            status: getStatus(1),
            timestamp: getStatus(1) === "done" ? now : undefined,
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "fechamento_rh",
            label: "Validação e fechamento",
            description: "Banco de horas validado e competência fechada.",
            status: getStatus(2),
            timestamp: getStatus(2) === "done" ? now : undefined,
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "envio_financeiro",
            label: "Envio ao Financeiro",
            description: "Aguardando envio do lote para aprovação financeira.",
            status: getStatus(3),
            responsible: "RH",
            route: "/financeiro",
        },
        {
            id: "aprovacao_financeira",
            label: "Aprovação Financeira",
            description: "Aguardando aprovação do lote pelo Financeiro.",
            status: getStatus(4),
            responsible: "Financeiro / Admin",
            route: "/financeiro",
        },
        {
            id: "cnab",
            label: "Preparação CNAB",
            description: "Aguardando geração da remessa bancária.",
            status: getStatus(5),
            responsible: "Financeiro",
            route: "/bancario",
        },
        {
            id: "retorno",
            label: "Retorno e conciliação",
            description: "Aguardando retorno bancário e baixa financeira.",
            status: getStatus(6),
            responsible: "Financeiro",
            route: "/bancario",
        },
    ];

    const nextActionMap = {
        rh_processado: {
            label: "Validar Fechamento",
            description: "Valide e feche a competência do RH para liberar o fluxo ao Financeiro.",
            route: "/banco-horas/processamento",
        },
        fechamento_rh: {
            label: "Enviar ao Financeiro →",
            description: "Envie o lote ao Financeiro para iniciar a aprovação financeira.",
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
        nextAction: nextActionMap[currentStep],
    };
};
