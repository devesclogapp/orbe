import React from "react";
import { useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { OperationalPipelineModal } from "./OperationalPipelineModal";
import { CustosExtrasContinuityDrawer } from "@/components/operacoes/CustosExtrasContinuityDrawer";
import { ServicosExtrasContinuityDrawer } from "@/components/operacoes/ServicosExtrasContinuityDrawer";

/**
 * Camada de apresentação que desacopla a decisão do formato de exibição do pipeline:
 * - Custos Extras → CustosExtrasContinuityDrawer (drawer lateral direito de continuidade)
 * - Serviços Extras → ServicosExtrasContinuityDrawer (drawer lateral direito especialista em receitas)
 * - Demais fluxos → OperationalPipelineModal (modal central genérico mantido 100% inalterado)
 */
export const OperationalPipelinePresenter: React.FC = () => {
  const { payload } = useOperationalPipeline();

  if (payload?.context?.fluxo === "Custos Extras") {
    return <CustosExtrasContinuityDrawer />;
  }

  if (payload?.context?.fluxo === "Serviços Extras") {
    return <ServicosExtrasContinuityDrawer />;
  }

  return <OperationalPipelineModal />;
};
