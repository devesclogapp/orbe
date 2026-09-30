import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import RegrasBancoHorasSection from "@/pages/Configuracoes/RegrasBancoHorasSection";

const RegrasBH: React.FC = () => {
    return (
        <AppShell
            title="Regras de Banco de Horas"
            subtitle="Defina políticas de validade, vigência temporal e compensação"
        >
            <div className="space-y-4">
                <RegrasBancoHorasSection />
            </div>
        </AppShell>
    );
};

export default RegrasBH;
