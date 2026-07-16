import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEFAULT_WORKSPACE, type WorkspaceId } from "./workspaces";

// Holds the active workspace (the role/context lens over the sidebar). This is
// a pure UI preference — it re-scopes which nav groups show, never what the
// backend authorizes. Persisted so a store manager returns to "Store Retail"
// and an accountant to "Finance" without re-selecting each session.

const STORAGE_KEY = "retailos.workspace";

interface WorkspaceContextValue {
  setWorkspace: (id: WorkspaceId) => void;
  workspace: WorkspaceId;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readInitial(): WorkspaceId {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return (stored as WorkspaceId | null) ?? DEFAULT_WORKSPACE;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspaceState] =
    useState<WorkspaceId>(DEFAULT_WORKSPACE);

  // Hydrate from storage after mount to avoid SSR/client mismatch.
  useEffect(() => {
    setWorkspaceState(readInitial());
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      setWorkspace: (id) => {
        setWorkspaceState(id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, id);
        }
      },
    }),
    [workspace]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
