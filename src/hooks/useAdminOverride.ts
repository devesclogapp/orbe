import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OverrideConfig {
  onUpdate: (id: string, payload: any, justification: string) => Promise<any>;
  lockedStatuses?: string[];
}

export const useAdminOverride = ({ 
  onUpdate, 
  lockedStatuses = ['processado', 'fechado', 'pago', 'consolidado'] 
}: OverrideConfig) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; payload: any; status: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkAndExecute = useCallback((id: string, payload: any, currentStatus: string) => {
    // Se o status for um dos travados, abre o modal
    if (lockedStatuses.includes(currentStatus)) {
      setPendingAction({ id, payload, status: currentStatus });
      setIsOpen(true);
      return true; // Indica que o fluxo foi interrompido pelo modal
    }
    
    return false; // Indica que o fluxo pode seguir normalmente (sem override)
  }, [lockedStatuses]);

  const handleConfirm = async (justification: string) => {
    if (!pendingAction) return;

    setIsUpdating(true);
    try {
      await onUpdate(pendingAction.id, pendingAction.payload, justification);
      toast.success('Alteração realizada com sucesso (Override registrado)');
      setIsOpen(false);
      setPendingAction(null);
    } catch (error: any) {
      console.error('Erro no override:', error);
      toast.error(error.message || 'Erro ao realizar alteração com override');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPendingAction(null);
  };

  return {
    isOpen,
    isUpdating,
    pendingStatus: pendingAction?.status,
    checkAndExecute,
    handleConfirm,
    handleClose
  };
};
