import React from "react";
import { useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { OperationalPipelineModal } from "./OperationalPipelineModal";
import { CustosExtrasContinuityDrawer } from "@/components/operacoes/CustosExtrasContinuityDrawer";

/**
 * Camada de apresentação que desacopla a decisão do formato de exibição do pipeline:
 * - Custos Extras → CustosExtrasContinuityDrawer (protótipo de drawer lateral direito de continuidade)
 * - Demais fluxos → OperationalPipelineModal (modal central genérico mantido 100% inalterado)
 */
export const OperationalPipelinePresenter: React.FC = () => {
  const { payload } = useOperationalPipeline();

  if (payload?.context?.fluxo === "Custos Extras") {
    return <CustosExtrasContinuityDrawer />;
  }

  return <OperationalPipelineModal />;
};
