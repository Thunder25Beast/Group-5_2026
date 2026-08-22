import React, { createContext, useContext, useState, ReactNode } from 'react';

export type InteractionMode = 'mcq' | 'scribble' | 'voice';

export interface LogEntry {
  id: string;
  questionDisplay: string;
  mode: InteractionMode;
  isCorrect: boolean;
  timestamp: number;
}

export interface AppConfig {
  studentName: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface AppState {
  logs: LogEntry[];
  config: AppConfig;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  updateConfig: (config: Partial<AppConfig>) => void;
}

const StoreContext = createContext<AppState | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    studentName: 'Student',
    difficulty: 'easy',
  });

  const addLog = (log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setLogs((prev) => [
      ...prev,
      {
        ...log,
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
      },
    ]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const updateConfig = (newConfig: Partial<AppConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  return (
    <StoreContext.Provider value={{ logs, config, addLog, clearLogs, updateConfig }}>
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
