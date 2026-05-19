# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\pages\BancoHoras\ProcessamentoRH.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Envolver handleConfirmOperationalAction
action_target = """  const handleConfirmOperationalAction = async () => {
    if (!actionComposer || !selectedColaborador?.colaborador_id) return;

    const { evento, action, mode } = actionComposer;
    const actionKey = evento?.id || `direto:${selectedColaborador.colaborador_id}`;
    setActionLoading((current) => ({ ...current, [actionKey]: action }));

    try {
      if (mode === "evento" && evento) {"""

action_replacement = """  const handleConfirmOperationalAction = async (forcedJustificativa?: string) => {
    if (!actionComposer || !selectedColaborador?.colaborador_id) return;

    const { evento, action, mode } = actionComposer;
    const actionKey = evento?.id || `direto:${selectedColaborador.colaborador_id}`;
    
    // Se o período está fechado e ainda não temos uma justificativa validada, 
    // paramos o fluxo aqui e chamamos o modal
    if (isPeriodoFechado && !forcedJustificativa) {
        return requiresAdminJustification(
            async (j) => handleConfirmOperationalAction(j),
            mode === "evento" 
                ? operationalActionMetaMap[action as OperationalActionType].title 
                : directRhActionMetaMap[action].title,
            action
        );
    }
    
    setActionLoading((current) => ({ ...current, [actionKey]: action }));

    try {
      const finalObservation = forcedJustificativa 
        ? `${actionObservation} | Motivo Override: ${forcedJustificativa}`
        : actionObservation;
        
      if (mode === "evento" && evento) {"""

content = content.replace(action_target, action_replacement)

# Update the actionObservation parameter inside handleConfirmOperationalAction
content = content.replace('      observacao: actionObservation,', '      observacao: finalObservation,')

# 2. Add the JSX for JustificationModal at the end of the file
render_target = """    </AppShell>
  );
};

export default ProcessamentoRH;"""

render_replacement = """      {adminJustificationPayload && (
        <JustificationModal
          isOpen={adminJustificationModalOpen}
          onClose={() => {
            setAdminJustificationModalOpen(false);
            setAdminJustificationPayload(null);
          }}
          onConfirm={async (justificativa) => {
            await adminJustificationPayload.callback(justificativa);
            setAdminJustificationModalOpen(false);
            setAdminJustificationPayload(null);
          }}
          title={adminJustificationPayload.actionLabel}
          description="ATENÇÃO: A competência selecionada já possui validação e/ou fechamento. Esta alteração será registrada no log de auditoria operacional do Admin."
        />
      )}
    </AppShell>
  );
};

export default ProcessamentoRH;"""

content = content.replace(render_target, render_replacement)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Admin Justification logic injected into operational actions")
