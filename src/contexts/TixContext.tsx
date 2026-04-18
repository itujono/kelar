import { createContext, useContext } from "react";
import { useTixView } from "../hooks/useTixView";
import type { ReactNode } from "react";

type TixContextType = ReturnType<typeof useTixView>;

const TixContext = createContext<TixContextType | null>(null);

export function TixProvider({ children, isPeerMode }: { children: ReactNode; isPeerMode: boolean }) {
  const value = useTixView(isPeerMode);
  return <TixContext.Provider value={value}>{children}</TixContext.Provider>;
}

export function useTixContext() {
  const context = useContext(TixContext);
  if (!context) {
    throw new Error("useTixContext must be used within a TixProvider");
  }
  return context;
}
