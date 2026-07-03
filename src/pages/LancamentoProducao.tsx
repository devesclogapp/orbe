import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    History
} from "lucide-react";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { useAuth } from "@/contexts/AuthContext";

// Modular Components
import { RecentLaunchesList } from "@/components/operacoes/lancamento/RecentLaunchesList";
import { OperacaoForm } from "@/components/operacoes/lancamento/OperacaoForm";

const LancamentoProducao = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const empresaId = user?.user_metadata?.empresa_id || "";

    return (
        <OperationalShell
            title="Lançamento Operacional"
            hideFab
        >
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <OperacaoForm
                    mode="encarregado"
                    onCancel={() => navigate(-1)}
                />

                {/* Seção de Lançamentos Recentes */}
                <div className="space-y-4 pt-10 border-t border-slate-200">
                    <div className="flex items-center gap-2 px-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-bold">Lançamentos de Hoje</h2>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <RecentLaunchesList
                            date={new Date().toLocaleDateString('en-CA')} // Formato YYYY-MM-DD local
                            empresaId={empresaId}
                            unidadeId={""} // Since it was fetching from form logic which was removed, leaving it empty is safer; it will query correctly by org id
                        />
                    </div>
                </div>
            </div>
        </OperationalShell>
    );
};

export default LancamentoProducao;
