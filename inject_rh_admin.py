# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\pages\BancoHoras\ProcessamentoRH.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
states_target = """  const [isSavingJustification, setIsSavingJustification] = useState(false);
  const [isReprocessingIndividual, setIsReprocessingIndividual] = useState(false);"""

states_replacement = """  const [isSavingJustification, setIsSavingJustification] = useState(false);
  const [isReprocessingIndividual, setIsReprocessingIndividual] = useState(false);
  
  // Governança Admin
  const [adminJustificationModalOpen, setAdminJustificationModalOpen] = useState(false);
  const [adminJustificationPayload, setAdminJustificationPayload] = useState<{
    actionType: string;
    actionLabel: string;
    callback: (justificativa: string) => Promise<void>;
  } | null>(null);"""

content = content.replace(states_target, states_replacement)

# Create helper function to check period closing status
helper_target = """  const invalidateRhQueries = async () => {"""

helper_replacement = """  // Retorna true se a competência atual já foi fechada/enviada ao financeiro
  const isPeriodoFechado = useMemo(() => {
    // Se o logs do mês têm um lote aprovado (ou competência aprovada), está fechado.
    // Como simplificação robusta, verificamos se o mês tem lote financeiro aprovado
    if (!approvalValidation) return false;
    return approvalValidation?.impedimentos?.length === 0 && processamentoRhConcluido;
  }, [approvalValidation, processamentoRhConcluido]);

  const requiresAdminJustification = async (actionFn: (justificativa: string) => Promise<void>, actionLabel: string, actionType: string) => {
    // Se o período está fechado e a ação vai afetar dados financeiros passados
    // Necessita justificativa obrigatória e registro na tabela de auditoria overrides
    setAdminJustificationPayload({
       actionType,
       actionLabel,
       callback: actionFn
    });
    setAdminJustificationModalOpen(true);
  };

  const invalidateRhQueries = async () => {"""

content = content.replace(helper_target, helper_replacement)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Admin Justification states and helpers injected")
