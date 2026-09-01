"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type CurrentState =
  | "idle"
  | "typing"
  | "focus"
  | "click-burst"
  | "planning"
  | "execution"
  | "success"
  | "error";

interface CurrentContextValue {
  state: CurrentState;
  setState: (s: CurrentState) => void;
}

export const CurrentContext = createContext<CurrentContextValue>({
  state: "idle",
  setState: () => {},
});

/**
 * Code Current — the generative state of the product.
 * The field behind everything: faint characters in constant, quiet motion.
 * Its tempo follows the work: idle when waiting, typing when the user
 * writes, planning/execution when a build runs, success and error when
 * the build resolves.
 */
export function CurrentProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateState] = useState<CurrentState>("idle");

  const setState = useCallback((s: CurrentState) => {
    setStateState(s);
  }, []);

  return (
    <CurrentContext.Provider value={{ state, setState }}>{children}</CurrentContext.Provider>
  );
}

export function useCurrent() {
  return useContext(CurrentContext);
}