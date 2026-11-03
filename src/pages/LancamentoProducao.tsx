import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { History } from "lucide-react";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useContextualReturn } from "@/hooks/useContextualReturn";

// Modular Components
import { RecentLaunchesList } from "@/components/operacoes/lancamento/RecentLaunchesList";
import { OperacaoForm } from "@/components/operacoes/lancamento/OperacaoForm";

const LancamentoProducao = () => {
    const { user } = useAuth();
    const { role } = useAccessControl();
    const navigate = useNavigate();
    const location = useLocation();
    const { goBackUrl } = useContextualReturn("/producao");
    const empresaId = user?.user_metadata?.empresa_id || "";

    const isOperacoesVolumeNova = location.pathname.includes("/operacoes-volume");
    const isEncarregado = role === "encarregado";
    const formMode: "admin" | "encarregado" = !isEncarregado && (role === "admin" || isOperacoesVolumeNova) ? "admin" : "encarregado";

    const content = (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <OperacaoForm
                mode={formMode}
                onCancel={() => {
                    if (isOperacoesVolumeNova) {
                        navigate("/operacoes-volume");
                    } else {
                        goBackUrl();
                    }
                }}
                onSuccess={() => {
                    if (isOperacoesVolumeNova) {
                        navigate("/operacoes-volume");
                    }
                }}
            />

            {/* Seção de Lançamentos Recentes */}
            <div className="space-y-4 pt-10 border-t border-slate-200">
                <div className="flex items-center gap-2 px-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-bold">Lançamentos de Hoje</h2>
                </div>

                <div>
                    <RecentLaunchesList
                        date={new Date().toLocaleDateString('en-CA')} // Formato YYYY-MM-DD local
                        empresaId={empresaId || undefined}
                        unidadeId={""}
                    />
                </div>
            </div>
        </div>
    );

    if (formMode === "admin") {
        return (
            <AppShell
                title="Nova Operação por Volume"
                subtitle="Lançamento administrativo de receitas e movimentações operacionais"
                backPath="/operacoes-volume"
            >
                <div className="p-4 md:p-6 lg:p-8">
                    {content}
                </div>
            </AppShell>
        );
    }

    return (
        <OperationalShell
            title="Lançamento Operacional"
            hideFab
        >
            {content}
        </OperationalShell>
    );
};

export default LancamentoProducao;
