import { createContext, useContext, useState, ReactNode } from "react";

type SelectedKind = "colaborador" | "operacao" | null;

interface SelectionState {
  kind: SelectedKind;
  id: string | null;
  select: (kind: SelectedKind, id: string | null) => void;
  clear: () => void;
}

const Ctx = createContext<SelectionState | undefined>(undefined);

export const SelectionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<{ kind: SelectedKind; id: string | null }>({ kind: null, id: null });

  return (
    <Ctx.Provider
      value={{
        kind: state.kind,
        id: state.id,
        select: (kind, id) => setState({ kind, id }),
        clear: () => setState({ kind: null, id: null }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useSelection = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
};
