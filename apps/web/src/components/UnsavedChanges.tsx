/* eslint-disable react-refresh/only-export-components -- provider and consumer hook form one state boundary */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type UnsavedChangesState = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmDiscard: (action: () => void) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesState>({ dirty: false, setDirty: () => undefined, confirmDiscard: (action) => action() });

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const confirmDiscard = useCallback((action: () => void) => {
    if (dirty && !window.confirm('Discard unsaved membership changes?')) return;
    setDirty(false);
    action();
  }, [dirty]);
  const value = useMemo(() => ({ dirty, setDirty, confirmDiscard }), [confirmDiscard, dirty]);
  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() { return useContext(UnsavedChangesContext); }
