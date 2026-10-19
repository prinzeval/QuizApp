import { createContext, useContext } from "react";

export interface ActiveCall {
  roomId: string;
  roomName: string;
}

/** Desktop: compact dock, a small pill, or the full-screen view. Phones show a bottom bar for "dock"/"pill". */
export type CallView = "dock" | "pill" | "full";

export interface JoinChoices {
  mic: boolean;
  cam: boolean;
}

export interface CallContextValue {
  /** The call you're in (one at a time), or null. */
  active: ActiveCall | null;
  /** Joins a room's call, leaving any other call first. Rejects with a readable message. */
  join: (call: ActiveCall, choices: JoinChoices) => Promise<void>;
  leave: () => Promise<void>;
  view: CallView;
  setView: (view: CallView) => void;
}

export const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used inside <CallProvider>");
  return context;
}
