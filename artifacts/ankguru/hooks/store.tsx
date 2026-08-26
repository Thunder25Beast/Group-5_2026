import React, { createContext, useContext, useState, ReactNode } from 'react';

export type InteractionMode = 'mcq' | 'scribble' | 'voice';

export interface SessionConfig {
  mode: InteractionMode;
  range: string;       // e.g. '0-100', '0-200'
  numQuestions: number; // any positive integer
}

interface AppState {
  sessionConfig: SessionConfig | null;
  setSessionConfig: (config: SessionConfig) => void;
  clearSessionConfig: () => void;
}

const StoreContext = createContext<AppState | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessionConfig, setSessionConfigState] = useState<SessionConfig | null>(null);

  const setSessionConfig = (config: SessionConfig) => {
    setSessionConfigState(config);
  };

  const clearSessionConfig = () => {
    setSessionConfigState(null);
  };

  return (
    <StoreContext.Provider value={{ sessionConfig, setSessionConfig, clearSessionConfig }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within a StoreProvider');
  }
  return context;
}
