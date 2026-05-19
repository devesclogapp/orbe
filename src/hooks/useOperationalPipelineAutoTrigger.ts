import { useEffect } from "react";

import { PipelineTrigger, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";

const STORAGE_KEY = "orbe_operational_pipeline_seen_v1";

const readSeenMap = (): Record<string, string> => {
    if (typeof window === "undefined") return {};

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const markAsSeen = (key: string) => {
    if (typeof window === "undefined") return;

    const next = {
        ...readSeenMap(),
        [key]: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const buildOperationalPipelineSeenKey = (params: {
    etapa: string;
    competencia: string;
    empresa: string;
}) => `${params.etapa}::${params.competencia}::${params.empresa}`;

export const useOperationalPipelineAutoTrigger = (params: {
    enabled: boolean;
    storageKey: string;
    trigger: PipelineTrigger | null;
}) => {
    const { enabled, storageKey, trigger } = params;
    const { isOpen, openPipeline } = useOperationalPipeline();

    useEffect(() => {
        if (!enabled || !trigger || typeof window === "undefined") return;

        const seenMap = readSeenMap();
        if (seenMap[storageKey]) return;

        if (isOpen) {
            markAsSeen(storageKey);
            return;
        }

        markAsSeen(storageKey);
        openPipeline(trigger);
    }, [enabled, isOpen, openPipeline, storageKey, trigger]);
};
