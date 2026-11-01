import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpGuideData } from '@/types/contextualHelp';
import { getHelpGuideForPath, CONTEXTUAL_HELP_CATALOG } from '@/data/contextualHelpData';
import { useAccessControl } from '@/contexts/AccessControlContext';

interface ContextualHelpContextType {
  isHelpOpen: boolean;
  openHelp: (customGuideId?: string) => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  currentGuide: HelpGuideData | null;
  setCustomGuideId: (id: string | null) => void;
}

const ContextualHelpContext = createContext<ContextualHelpContextType | undefined>(undefined);

export const ContextualHelpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [customGuideId, setCustomGuideId] = useState<string | null>(null);
  const location = useLocation();

  // Leitura segura do role para ambientes de teste ou telas isoladas
  let role: string | undefined;
  try {
    const access = useAccessControl();
    role = access?.role;
  } catch {
    role = undefined;
  }

  const currentGuide = useMemo(() => {
    if (customGuideId) {
      const explicit = CONTEXTUAL_HELP_CATALOG.find((g) => g.id === customGuideId);
      if (explicit) return explicit;
    }
    return getHelpGuideForPath(location.pathname, role || undefined);
  }, [customGuideId, location.pathname, role]);

  const openHelp = useCallback((guideId?: string) => {
    if (guideId) {
      setCustomGuideId(guideId);
    } else {
      setCustomGuideId(null);
    }
    setIsHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false);
    setCustomGuideId(null);
  }, []);

  const toggleHelp = useCallback(() => {
    setIsHelpOpen((prev) => !prev);
  }, []);

  return (
    <ContextualHelpContext.Provider
      value={{
        isHelpOpen,
        openHelp,
        closeHelp,
        toggleHelp,
        currentGuide,
        setCustomGuideId,
      }}
    >
      {children}
    </ContextualHelpContext.Provider>
  );
};

export const useContextualHelp = () => {
  const context = useContext(ContextualHelpContext);
  if (!context) {
    throw new Error('useContextualHelp deve ser utilizado dentro de um ContextualHelpProvider');
  }
  return context;
};
