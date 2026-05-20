import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type PipelineStepStatus = "done" | "current" | "pending" | "blocked" | "devolved" | "canceled";

export type PipelineStep = {
    id: string;
    label: string;
    description: string;
    status: PipelineStepStatus;
    timestamp?: string;
    responsible?: string;
    route?: string;
};

export type PipelineFlow =
    | "FOLHA_VARIAVEL"
    | "BANCO_HORAS"
    | "APROVACAO_FINANCEIRA"
    | "CNAB_REMESSA";

export type PipelineContext = {
    competencia: string;
    empresa: string;
    fluxo: string;
};

export type PipelineTrigger = {
    context: PipelineContext;
    steps: PipelineStep[];
    title?: string;
    subtitle?: string;
    completedStage?: {
        label: string;
        description: string;
    };
    nextAction?: {
        label: string;
        description: string;
        route: string;
        autoNavigate?: boolean;
        delayMs?: number;
    };
};

type FolhaVariavelStepId =
    | "importacao"
    | "rh_processado"
    | "fechamento_rh"
    | "envio_financeiro"
    | "aprovacao_financeira"
    | "cnab"
    | "retorno";

type FolhaVariavelTimestamps = Partial<Record<FolhaVariavelStepId, string>>;

type OperationalPipelineContextValue = {
    isOpen: boolean;
    payload: PipelineTrigger | null;
    openPipeline: (trigger: PipelineTrigger) => void;
    closePipeline: () => void;
};

const OperationalPipelineContext = createContext<OperationalPipelineContextValue | null>(null);

export const OperationalPipelineProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [payload, setPayload] = useState<PipelineTrigger | null>(null);

    const openPipeline = useCallback((trigger: PipelineTrigger) => {
        setPayload(trigger);
        setIsOpen(true);
    }, []);

    const closePipeline = useCallback(() => {
        setIsOpen(false);
        setTimeout(() => setPayload(null), 300);
    }, []);

    return (
        <OperationalPipelineContext.Provider value={{ isOpen, payload, openPipeline, closePipeline }}>
            {children}
        </OperationalPipelineContext.Provider>
    );
};

export const useOperationalPipeline = (): OperationalPipelineContextValue => {
    const ctx = useContext(OperationalPipelineContext);
    if (!ctx) throw new Error("useOperationalPipeline must be used inside OperationalPipelineProvider");
    return ctx;
};

const folhaVariavelCompletedStageMap: Record<FolhaVariavelStepId, { label: string; description: string }> = {
    importacao: {
        label: "Importação concluída",
        description: "A planilha foi recebida e identificada para seguir no fluxo.",
    },
    rh_processado: {
        label: "Processamento RH concluído",
        description: "Registros processados com sucesso. Banco de horas atualizado e pronto para validação.",
    },
    fechamento_rh: {
        label: "Validação e fechamento concluídos",
        description: "A competência foi validada pelo RH e liberada para envio ao Financeiro.",
    },
    envio_financeiro: {
        label: "Envio ao Financeiro concluído",
        description: "O lote foi entregue ao Financeiro e entrou na fila de análise.",
    },
    aprovacao_financeira: {
        label: "Aprovação Financeira concluída",
        description: "O lote foi aprovado e está pronto para preparação bancária.",
    },
    cnab: {
        label: "Preparação CNAB concluída",
        description: "A remessa bancária foi gerada e o fluxo segue para retorno e conciliação.",
    },
    retorno: {
        label: "Retorno e conciliação concluídos",
        description: "O ciclo bancário foi conciliado com sucesso.",
    },
};

export const buildFolhaVariavelPipeline = (params: {
    competencia: string;
    empresa: string;
    currentStep: FolhaVariavelStepId;
    completedStage?: FolhaVariavelStepId;
    timestamps?: FolhaVariavelTimestamps;
}): PipelineTrigger => {
    const { competencia, empresa, currentStep, completedStage, timestamps = {} } = params;

    const stepKeys: FolhaVariavelStepId[] = ["importacao", "rh_processado", "fechamento_rh", "envio_financeiro", "aprovacao_financeira", "cnab", "retorno"];
    const currentIndex = stepKeys.indexOf(currentStep);

    const getStatus = (index: number): PipelineStepStatus => {
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const getTimestamp = (stepId: FolhaVariavelStepId, index: number) => {
        const status = getStatus(index);
        return status === "done" ? timestamps[stepId] : undefined;
    };

    const steps: PipelineStep[] = [
        {
            id: "importacao",
            label: "Importação de planilha",
            description: "Planilha importada e colaboradores identificados.",
            status: getStatus(0),
            timestamp: getTimestamp("importacao", 0),
            route: "/pontos",
        },
        {
            id: "rh_processado",
            label: "Processamento no RH",
            description: "Pontos processados, banco de horas e saldos calculados.",
            status: getStatus(1),
            timestamp: getTimestamp("rh_processado", 1),
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "fechamento_rh",
            label: "Validação e fechamento",
            description: "Banco de horas validado e competência fechada pelo RH.",
            status: getStatus(2),
            timestamp: getTimestamp("fechamento_rh", 2),
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "envio_financeiro",
            label: "Envio ao Financeiro",
            description: "Lote aprovado e enviado para fila de pagamento.",
            status: getStatus(3),
            timestamp: getTimestamp("envio_financeiro", 3),
            responsible: "RH",
            route: "/financeiro",
        },
        {
            id: "aprovacao_financeira",
            label: "Aprovação Financeira",
            description: "Lote revisado e aprovado pelo setor financeiro.",
            status: getStatus(4),
            timestamp: getTimestamp("aprovacao_financeira", 4),
            responsible: "Financeiro / Admin",
            route: "/financeiro",
        },
        {
            id: "cnab",
            label: "Preparação CNAB",
            description: "Remessa bancária gerada e enviada ao banco.",
            status: getStatus(5),
            timestamp: getTimestamp("cnab", 5),
            responsible: "Financeiro",
            route: "/bancario",
        },
        {
            id: "retorno",
            label: "Retorno e conciliação",
            description: "Retorno bancário recebido e pagamentos conciliados.",
            status: getStatus(6),
            timestamp: getTimestamp("retorno", 6),
            responsible: "Financeiro",
            route: "/bancario",
        },
    ];

    const nextActionMap: Record<FolhaVariavelStepId, { label: string; description: string; route: string }> = {
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
        completedStage: completedStage ? folhaVariavelCompletedStageMap[completedStage] : undefined,
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

export const buildOperationalStageReviewPipeline = (params: {
    competencia: string;
    empresa: string;
    currentStage: "cadastros" | "processamento_rh" | "banco_horas" | "fechamento_mensal" | "central_financeira";
}): PipelineTrigger => {
    const { competencia, empresa, currentStage } = params;

    const stageOrder = [
        "cadastros",
        "processamento_rh",
        "banco_horas",
        "fechamento_mensal",
        "central_financeira",
    ] as const;

    const currentIndex = stageOrder.indexOf(currentStage);

    const getStatus = (index: number): PipelineStepStatus => {
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const steps: PipelineStep[] = [
        {
            id: "cadastros",
            label: "Central de Cadastros",
            description: "Cadastros operacionais completos e liberados para o fluxo.",
            status: getStatus(0),
            route: "/cadastros",
            responsible: "Administracao",
        },
        {
            id: "processamento_rh",
            label: "Processamento RH",
            description: "Processamento e consolidacao operacional da competencia.",
            status: getStatus(1),
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        {
            id: "banco_horas",
            label: "Banco de Horas",
            description: "Validacao de saldos, vencimentos e risco operacional.",
            status: getStatus(2),
            route: "/banco-horas",
            responsible: "RH",
        },
        {
            id: "fechamento_mensal",
            label: "Fechamento Mensal",
            description: "Consolidacao final da competencia operacional.",
            status: getStatus(3),
            route: "/fechamento",
            responsible: "RH / Operacoes",
        },
        {
            id: "central_financeira",
            label: "Central Financeira",
            description: "Acompanhamento, aprovacao e continuidade financeira da competencia.",
            status: getStatus(4),
            route: "/financeiro",
            responsible: "Financeiro",
        },
    ];

    const nextActionMap = {
        cadastros: {
            label: "Ir para Processamento RH",
            description: "Cadastros revisados. O proximo passo e iniciar o Processamento RH.",
            route: "/banco-horas/processamento",
        },
        processamento_rh: {
            label: "Ir para Banco de Horas",
            description: "Revise os saldos e valide o Banco de Horas para seguir com seguranca.",
            route: "/banco-horas",
        },
        banco_horas: {
            label: "Ir para Fechamento Mensal",
            description: "Saldos validados. O proximo passo e fechar a competencia.",
            route: "/fechamento",
        },
        fechamento_mensal: {
            label: "Ir para Central Financeira",
            description: "Competencia consolidada. Continue a esteira no Financeiro.",
            route: "/financeiro",
        },
        central_financeira: {
            label: "Ir para Central Bancaria",
            description: "Apos aprovacao financeira, siga para CNAB e retorno bancario.",
            route: "/bancario",
        },
    } as const;

    return {
        context: { competencia, empresa, fluxo: "Pipeline Operacional" },
        steps,
        completedStage: {
            label: "Visao atual do pipeline",
            description: "Reabra o fluxo a qualquer momento para revisar a etapa atual e a proxima acao recomendada.",
        },
        nextAction: nextActionMap[currentStage],
    };
};

export const buildBancoHorasRhValidationPipeline = (params: {
    competencia: string;
    empresa: string;
}): PipelineTrigger => {
    const { competencia, empresa } = params;
    const doneAt = new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    return {
        context: { competencia, empresa, fluxo: "Banco de Horas -> Financeiro" },
        steps: [
            {
                id: "importacao",
                label: "Importacao",
                description: "Pontos recebidos e competencia carregada para processamento.",
                status: "done",
                timestamp: doneAt,
                route: "/pontos",
            },
            {
                id: "processamento_rh",
                label: "Processamento RH",
                description: "Registros processados e saldos consolidados pelo RH.",
                status: "done",
                timestamp: doneAt,
                route: "/banco-horas/processamento",
                responsible: "RH",
            },
            {
                id: "banco_horas_validado",
                label: "Banco de Horas validado",
                description: "Saldos revisados e competencia liberada pelo RH.",
                status: "done",
                timestamp: doneAt,
                route: "/banco-horas",
                responsible: "RH",
            },
            {
                id: "envio_financeiro",
                label: "Envio Financeiro",
                description: "Lote liberado pelo RH e em transicao para a Central Financeira.",
                status: "current",
                route: "/financeiro",
                responsible: "RH -> Financeiro",
            },
            {
                id: "aprovacao_financeira",
                label: "Aprovacao Financeira",
                description: "Analise financeira pendente apos o recebimento da competencia.",
                status: "pending",
                route: "/financeiro",
                responsible: "Financeiro",
            },
            {
                id: "cnab",
                label: "CNAB",
                description: "Etapa bancaria liberada somente apos aprovacao financeira.",
                status: "pending",
                route: "/bancario",
                responsible: "Financeiro",
            },
            {
                id: "retorno_bancario",
                label: "Retorno bancario",
                description: "Conciliacao e retorno do banco apos a remessa.",
                status: "pending",
                route: "/bancario",
                responsible: "Financeiro",
            },
        ],
        completedStage: {
            label: "Validacao RH concluida",
            description: "O RH concluiu a validacao do Banco de Horas e liberou a competencia para o Financeiro.",
        },
        nextAction: {
            label: "Ir para Central Financeira",
            description: "Envio Financeiro em andamento. A Central Financeira sera aberta para continuidade do pipeline.",
            route: "/financeiro",
            autoNavigate: true,
            delayMs: 1400,
        },
    };
};

export type DiaristaStepId =
    | "lancamento"
    | "lote_fechado"
    | "validacao_rh"
    | "central_financeira"
    | "cnab_pagamento"
    | "concluido";

type DiaristaTimestamps = Partial<Record<DiaristaStepId, string>>;

const diaristaCompletedStageMap: Record<DiaristaStepId, { label: string; description: string }> = {
    lancamento: {
        label: "Lançamento registrado",
        description: "As marcações da semana foram salvas e estão prontas para fechamento.",
    },
    lote_fechado: {
        label: "Lote fechado pelo encarregado",
        description: "O período foi encerrado e enviado para validação do RH.",
    },
    validacao_rh: {
        label: "Validação RH concluída",
        description: "O RH validou o lote de diaristas e liberou para aprovação financeira.",
    },
    central_financeira: {
        label: "Aprovação financeira concluída",
        description: "O financeiro aprovou o lote e está pronto para geração de CNAB.",
    },
    cnab_pagamento: {
        label: "CNAB gerado e enviado",
        description: "A remessa bancária foi gerada e os pagamentos estão em processamento.",
    },
    concluido: {
        label: "Fluxo concluído",
        description: "O ciclo completo de diaristas foi encerrado com sucesso.",
    },
};

export const buildDiaristasPipeline = (params: {
    competencia: string;
    empresa: string;
    currentStep: DiaristaStepId;
    timestamps?: DiaristaTimestamps;
}): PipelineTrigger => {
    const { competencia, empresa, currentStep, timestamps = {} } = params;

    const stepKeys: DiaristaStepId[] = ["lancamento", "lote_fechado", "validacao_rh", "central_financeira", "cnab_pagamento", "concluido"];
    const currentIndex = stepKeys.indexOf(currentStep);

    const getStatus = (index: number): PipelineStepStatus => {
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const getTimestamp = (stepId: DiaristaStepId, index: number) => {
        const status = getStatus(index);
        return status === "done" ? timestamps[stepId] : undefined;
    };

    const steps: PipelineStep[] = [
        {
            id: "lancamento",
            label: "Lançamento Operacional",
            description: "Encarregado registra as marcações semanais dos diaristas.",
            status: getStatus(0),
            timestamp: getTimestamp("lancamento", 0),
            route: "/producao/diaristas",
            responsible: "Encarregado",
        },
        {
            id: "lote_fechado",
            label: "Fechamento de Lote",
            description: "Período encerrado e enviado para validação.",
            status: getStatus(1),
            timestamp: getTimestamp("lote_fechado", 1),
            route: "/producao/diaristas",
            responsible: "Encarregado",
        },
        {
            id: "validacao_rh",
            label: "Validação RH",
            description: "RH valida os lançamentos e aprova o lote.",
            status: getStatus(2),
            timestamp: getTimestamp("validacao_rh", 2),
            route: "/rh/diaristas",
            responsible: "RH",
        },
        {
            id: "central_financeira",
            label: "Aprovação Financeira",
            description: "Financeiro aprova o lote para geração de remessa.",
            status: getStatus(3),
            timestamp: getTimestamp("central_financeira", 3),
            route: "/financeiro",
            responsible: "Financeiro",
        },
        {
            id: "cnab_pagamento",
            label: "CNAB / Pagamento",
            description: "Remessa bancária gerada e pagamentos processados.",
            status: getStatus(4),
            timestamp: getTimestamp("cnab_pagamento", 4),
            route: "/bancario",
            responsible: "Financeiro",
        },
        {
            id: "concluido",
            label: "Concluído",
            description: "Ciclo de diaristas encerrado com sucesso.",
            status: getStatus(5),
            timestamp: getTimestamp("concluido", 5),
            route: "/operacional/dashboard",
        },
    ];

    const nextActionMap: Record<DiaristaStepId, { label: string; description: string; route: string }> = {
        lancamento: {
            label: "Fechar Lote",
            description: "Salve os lançamentos e feche o período para seguir no fluxo.",
            route: "/producao/diaristas",
        },
        lote_fechado: {
            label: "Ir para Validação RH →",
            description: "Lote fechado. O RH pode agora validar os registros.",
            route: "/rh/diaristas",
        },
        validacao_rh: {
            label: "Ir para Central Financeira →",
            description: "Lote validado pelo RH. O Financeiro pode aprovar agora.",
            route: "/financeiro",
        },
        central_financeira: {
            label: "Gerar CNAB / Central Bancária →",
            description: "Aprovação concluída. Gere a remessa bancária para pagamento.",
            route: "/bancario",
        },
        cnab_pagamento: {
            label: "Ver Dashboard →",
            description: "Remessa enviada. Acompanhe o resultado no Dashboard.",
            route: "/operacional/dashboard",
        },
        concluido: {
            label: "Ver histórico →",
            description: "Fluxo concluído. Consulte o histórico de remessas.",
            route: "/financeiro/remessa/historico",
        },
    };

    return {
        context: { competencia, empresa, fluxo: "Diaristas" },
        steps,
        completedStage: diaristaCompletedStageMap[currentStep],
        nextAction: nextActionMap[currentStep],
    };
};

export const buildDiaristasDevolvidoPipeline = (params: {
    competencia: string;
    empresa: string;
    motivo?: string;
}): PipelineTrigger => {
    const { competencia, empresa, motivo } = params;

    return {
        context: { competencia, empresa, fluxo: "Diaristas" },
        steps: [
            {
                id: "lancamento",
                label: "Lançamento Operacional",
                description: "Marcações semanais registradas pelo encarregado.",
                status: "done",
                route: "/producao/diaristas",
                responsible: "Encarregado",
            },
            {
                id: "lote_fechado",
                label: "Fechamento de Lote",
                description: "Período encerrado e enviado ao RH.",
                status: "done",
                route: "/producao/diaristas",
                responsible: "Encarregado",
            },
            {
                id: "validacao_rh",
                label: "Validação RH",
                description: motivo ? `Devolvido: ${motivo}` : "Lote devolvido pelo RH para correção.",
                status: "devolved",
                route: "/rh/diaristas",
                responsible: "RH",
            },
            {
                id: "central_financeira",
                label: "Aprovação Financeira",
                description: "Aguardando reenvio após correção.",
                status: "pending",
                route: "/financeiro",
                responsible: "Financeiro",
            },
            {
                id: "cnab_pagamento",
                label: "CNAB / Pagamento",
                description: "Liberado após aprovação financeira.",
                status: "pending",
                route: "/bancario",
                responsible: "Financeiro",
            },
            {
                id: "concluido",
                label: "Concluído",
                description: "Aguardando resolução da devolução.",
                status: "pending",
                route: "/operacional/dashboard",
            },
        ],
        completedStage: {
            label: "Lote devolvido pelo RH",
            description: motivo
                ? `Motivo: ${motivo}. Corrija e reenvie o lote.`
                : "O RH devolveu o lote. Corrija as inconsistências e reenvie.",
        },
        nextAction: {
            label: "Corrigir e Relançar →",
            description: "Acesse o lançamento de diaristas para corrigir e reenviar o lote.",
            route: "/producao/diaristas",
        },
    };
};

export const buildOperationalFailurePipeline = (params: {
    competencia: string;
    empresa: string;
    currentStage: "cadastros" | "processamento_rh" | "banco_horas" | "fechamento_mensal" | "central_financeira";
    failureStatus?: Extract<PipelineStepStatus, "blocked" | "devolved" | "canceled">;
    failureTitle?: string;
    failureDescription: string;
    nextAction?: {
        label: string;
        description: string;
        route: string;
    };
}): PipelineTrigger => {
    const {
        competencia,
        empresa,
        currentStage,
        failureStatus = "blocked",
        failureTitle = "Falha operacional identificada",
        failureDescription,
        nextAction,
    } = params;

    const stageOrder = [
        "cadastros",
        "processamento_rh",
        "banco_horas",
        "fechamento_mensal",
        "central_financeira",
    ] as const;

    const stageMap: Record<(typeof stageOrder)[number], Omit<PipelineStep, "status">> = {
        cadastros: {
            id: "cadastros",
            label: "Central de Cadastros",
            description: "Cadastros operacionais completos e liberados para o fluxo.",
            route: "/cadastros",
            responsible: "Administracao",
        },
        processamento_rh: {
            id: "processamento_rh",
            label: "Processamento RH",
            description: "Processamento e consolidacao operacional da competencia.",
            route: "/banco-horas/processamento",
            responsible: "RH",
        },
        banco_horas: {
            id: "banco_horas",
            label: "Banco de Horas",
            description: "Validacao de saldos, vencimentos e risco operacional.",
            route: "/banco-horas",
            responsible: "RH",
        },
        fechamento_mensal: {
            id: "fechamento_mensal",
            label: "Fechamento Mensal",
            description: "Consolidacao final da competencia operacional.",
            route: "/fechamento",
            responsible: "RH / Operacoes",
        },
        central_financeira: {
            id: "central_financeira",
            label: "Central Financeira",
            description: "Acompanhamento, aprovacao e continuidade financeira da competencia.",
            route: "/financeiro",
            responsible: "Financeiro",
        },
    };

    const failureIndex = stageOrder.indexOf(currentStage);
    const steps = stageOrder.map((stageId, index) => ({
        ...stageMap[stageId],
        status:
            index < failureIndex
                ? "done"
                : index === failureIndex
                    ? failureStatus
                    : "pending",
    })) satisfies PipelineStep[];

    const fallbackNextAction = nextAction ?? {
        label: "Revisar etapa atual",
        description: "Corrija a pendencia indicada para destravar o fluxo antes de seguir.",
        route: stageMap[currentStage].route || "/fechamento",
    };

    return {
        context: { competencia, empresa, fluxo: "Pipeline Operacional" },
        title: failureTitle,
        subtitle: failureDescription,
        steps,
        completedStage: {
            label:
                failureStatus === "devolved"
                    ? "Fluxo devolvido"
                    : failureStatus === "canceled"
                        ? "Fluxo cancelado"
                        : "Fluxo bloqueado",
            description: failureDescription,
        },
        nextAction: fallbackNextAction,
    };
};

export type OperacaoVolumeStepId = "lancamento" | "validacao" | "financeiro" | "faturamento" | "recebimento" | "concluido";

export const buildOperacaoVolumePipeline = (params: {
    competencia: string;
    empresa: string;
    currentStep: OperacaoVolumeStepId;
    devolucaoMotivo?: string;
}): PipelineTrigger => {
    const { competencia, empresa, currentStep, devolucaoMotivo } = params;

    const stepOrder: OperacaoVolumeStepId[] = [
        "lancamento",
        "validacao",
        "financeiro",
        "faturamento",
        "recebimento",
        "concluido"
    ];

    const currentIndex = stepOrder.indexOf(currentStep);

    const getStatus = (index: number): import("./OperationalPipelineContext").PipelineStepStatus => {
        if (devolucaoMotivo && index === currentIndex) return "devolved";
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const getRoute = (id: OperacaoVolumeStepId) => {
        switch (id) {
            case "lancamento":
            case "validacao":
                return "/operacional/dashboard";
            case "financeiro":
            case "faturamento":
            case "recebimento":
                return "/financeiro";
            default:
                return undefined;
        }
    };

    const steps: PipelineStep[] = [
        {
            id: "lancamento",
            label: "Lançamento Operacional",
            description: "Entrada operacional da operação logística.",
            status: getStatus(0),
            route: getRoute("lancamento"),
            responsible: "Encarregado",
        },
        {
            id: "validacao",
            label: "Validação Operacional",
            description: "Aprovação de volume e operação.",
            status: getStatus(1),
            route: getRoute("validacao"),
            responsible: "Operação",
        },
        {
            id: "financeiro",
            label: "Consolidação Financeira",
            description: "Consolidação dos valores na central.",
            status: getStatus(2),
            route: getRoute("financeiro"),
            responsible: "Financeiro",
        },
        {
            id: "faturamento",
            label: "Faturamento",
            description: "Geração de títulos ou cobrança direta.",
            status: getStatus(3),
            route: getRoute("faturamento"),
            responsible: "Financeiro",
        },
        {
            id: "recebimento",
            label: "Recebimento",
            description: "Conciliação de recebimento ou liquidação.",
            status: getStatus(4),
            route: getRoute("recebimento"),
            responsible: "Financeiro",
        },
        {
            id: "concluido",
            label: "Concluído",
            description: "Refletido no Dashboard.",
            status: getStatus(5),
            route: undefined,
        },
    ];

    const isDone = currentStep === "concluido";

    return {
        context: { competencia, empresa, fluxo: "Operação por Volume" },
        steps,
        title: "Status da Operação",
        subtitle: "Acompanhe o andamento geral da operação.",
        nextAction: isDone ? undefined : {
            label: "Próxima Etapa →",
            description: "Siga para a próxima etapa.",
            route: getRoute(stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)]) || "/operacional/dashboard",
        }
    };
};

export type CustoExtraStepId = "lancamento" | "validacao_operacional" | "financeiro" | "centro_custo" | "concluido";

export const buildCustosExtrasPipeline = (params: {
    competencia: string;
    empresa: string;
    currentStep: CustoExtraStepId;
    devolucaoMotivo?: string;
}): PipelineTrigger => {
    const { competencia, empresa, currentStep, devolucaoMotivo } = params;

    const stepOrder: CustoExtraStepId[] = [
        "lancamento",
        "validacao_operacional",
        "financeiro",
        "centro_custo",
        "concluido"
    ];

    const currentIndex = stepOrder.indexOf(currentStep);

    const getStatus = (index: number): PipelineStepStatus => {
        if (devolucaoMotivo && index === currentIndex) return "devolved";
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const getRoute = (id: CustoExtraStepId) => {
        switch (id) {
            case "lancamento":
            case "validacao_operacional":
                return "/producao/custos-extras";
            case "financeiro":
            case "centro_custo":
                return "/financeiro";
            default:
                return undefined;
        }
    };

    const steps: PipelineStep[] = [
        {
            id: "lancamento",
            label: "Lançamento",
            description: "Registro da despesa operacional extraordinária.",
            status: getStatus(0),
            route: getRoute("lancamento"),
            responsible: "Encarregado",
        },
        {
            id: "validacao_operacional",
            label: "Validação Operacional",
            description: "Aprovação da legitimidade do custo.",
            status: getStatus(1),
            route: getRoute("validacao_operacional"),
            responsible: "Operação / ADM",
        },
        {
            id: "financeiro",
            label: "Financeiro",
            description: "Consolidação e liberação de pagamento.",
            status: getStatus(2),
            route: getRoute("financeiro"),
            responsible: "Financeiro",
        },
        {
            id: "centro_custo",
            label: "Centro de Custo",
            description: "Classificação e impacto contábil.",
            status: getStatus(3),
            route: getRoute("centro_custo"),
            responsible: "Financeiro",
        },
        {
            id: "concluido",
            label: "Concluído",
            description: "Refletido no Dashboard operacional.",
            status: getStatus(4),
        },
    ];

    const isDone = currentStep === "concluido";

    return {
        context: { competencia, empresa, fluxo: "Custos Extras" },
        steps,
        title: "Status do Custo Extra",
        subtitle: "Acompanhe o fluxo de aprovação e pagamento da despesa.",
        nextAction: isDone ? undefined : {
            label: "Ver Fluxo Completo →",
            description: "Acompanhe a próxima etapa de validação.",
            route: getRoute(stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)]) || "/producao/custos-extras",
        }
    };
};

export type ServicoExtraStepId = "lancamento" | "validacao_operacional" | "aprovacao" | "financeiro" | "faturamento" | "concluido";

export const buildServicosExtrasPipeline = (params: {
    competencia: string;
    empresa: string;
    currentStep: ServicoExtraStepId;
    devolucaoMotivo?: string;
}): PipelineTrigger => {
    const { competencia, empresa, currentStep, devolucaoMotivo } = params;

    const stepOrder: ServicoExtraStepId[] = [
        "lancamento",
        "validacao_operacional",
        "aprovacao",
        "financeiro",
        "faturamento",
        "concluido"
    ];

    const currentIndex = stepOrder.indexOf(currentStep);

    const getStatus = (index: number): PipelineStepStatus => {
        if (devolucaoMotivo && index === currentIndex) return "devolved";
        if (index < currentIndex) return "done";
        if (index === currentIndex) return "current";
        return "pending";
    };

    const getRoute = (id: ServicoExtraStepId) => {
        switch (id) {
            case "lancamento":
            case "validacao_operacional":
            case "aprovacao":
                return "/producao/servicos-extras";
            case "financeiro":
            case "faturamento":
                return "/financeiro";
            default:
                return undefined;
        }
    };

    const steps: PipelineStep[] = [
        {
            id: "lancamento",
            label: "Lançamento Operacional",
            description: "Entrada do serviço extra executado.",
            status: getStatus(0),
            route: getRoute("lancamento"),
            responsible: "Encarregado",
        },
        {
            id: "validacao_operacional",
            label: "Validação Operacional",
            description: "Aprovação operacional do serviço.",
            status: getStatus(1),
            route: getRoute("validacao_operacional"),
            responsible: "Operação",
        },
        {
            id: "aprovacao",
            label: "Aprovação",
            description: "Aprovação financeira/gestão.",
            status: getStatus(2),
            route: getRoute("aprovacao"),
            responsible: "ADM/Gestor",
        },
        {
            id: "financeiro",
            label: "Central Financeira",
            description: "Consolidação dos valores na central.",
            status: getStatus(3),
            route: getRoute("financeiro"),
            responsible: "Financeiro",
        },
        {
            id: "faturamento",
            label: "Faturamento",
            description: "Geração de títulos / Faturamento.",
            status: getStatus(4),
            route: getRoute("faturamento"),
            responsible: "Financeiro",
        },
        {
            id: "concluido",
            label: "Concluído",
            description: "Refletido no Dashboard.",
            status: getStatus(5),
            route: undefined,
        },
    ];

    const isDone = currentStep === "concluido";

    return {
        context: { competencia, empresa, fluxo: "Serviços Extras" },
        steps,
        title: "Status do Serviço Extra",
        subtitle: "Acompanhe o andamento da aprovação do serviço extra.",
        nextAction: isDone ? undefined : {
            label: "Próxima Etapa →",
            description: "Siga para a próxima etapa do fluxo.",
            route: getRoute(stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)]) || "/producao/servicos-extras",
        }
    };
};

export const buildServicosExtrasDevolvidoPipeline = (params: {
    competencia: string;
    empresa: string;
    motivo: string;
    stage: ServicoExtraStepId;
}): PipelineTrigger => {
    const { competencia, empresa, motivo, stage } = params;
    return buildServicosExtrasPipeline({
        competencia,
        empresa,
        currentStep: stage,
        devolucaoMotivo: motivo
    });
};

