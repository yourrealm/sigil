import { type ComponentChildren, createContext } from "preact";
import { useContext } from "preact/hooks";
import { cn } from "@/lib/cn.ts";

export type CardState =
  | "loggedOut"
  | "loggedIn"
  | "resignNeeded"
  | "submitting"
  | "signed"
  | "revoke"
  | "revoking";

export interface CardStateStyle {
  /** Classes for the CardHead surface (background + text). */
  head: string;
  /** Classes for active primary buttons inside the card. */
  primaryButton: string;
  /** Classes for the Switch track when checked. */
  switchOn: string;
}

export const CARD_STATES: Record<CardState, CardStateStyle> = {
  loggedOut: {
    head: "bg-ink text-paper",
    primaryButton: "bg-ink text-paper hover:bg-ink2",
    switchOn: "bg-ink",
  },
  loggedIn: {
    head: "bg-accent text-paper",
    primaryButton: "bg-accent text-paper hover:bg-ink hover:text-paper",
    switchOn: "bg-accent",
  },
  resignNeeded: {
    head: "bg-warn text-paper",
    primaryButton: "bg-warn text-paper hover:bg-ink hover:text-paper",
    switchOn: "bg-warn",
  },
  submitting: {
    head: "bg-yellow text-ink",
    primaryButton: "bg-ink text-paper hover:bg-ink2",
    switchOn: "bg-yellow",
  },
  signed: {
    head: "bg-ok text-paper",
    primaryButton: "bg-ink text-paper hover:bg-ink2",
    switchOn: "bg-ink",
  },
  revoke: {
    head: "bg-revoke text-paper",
    primaryButton: "bg-revoke text-paper hover:bg-ink hover:text-paper",
    switchOn: "bg-revoke",
  },
  revoking: {
    head: "bg-revoke text-paper",
    primaryButton: "bg-ink text-paper hover:bg-ink2",
    switchOn: "bg-ink",
  },
};

const Ctx = createContext<CardState | null>(null);

export function useCardState(): CardState | null {
  return useContext(Ctx);
}

export function useCardStyle(): CardStateStyle {
  const state = useContext(Ctx);
  return CARD_STATES[state ?? "loggedOut"];
}

export interface CardProps {
  state: CardState;
  id?: string;
  children?: ComponentChildren;
}

export function Card({ state, id, children }: CardProps) {
  return (
    <Ctx.Provider value={state}>
      <div
        id={id}
        class="border-2 border-ink bg-paper shadow-md overflow-hidden"
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function CardHead({ children }: { children?: ComponentChildren }) {
  const style = useCardStyle();
  return (
    <div
      class={cn(
        "px-6 pt-5 pb-5 flex items-start justify-between gap-4 border-b-2 border-ink",
        style.head,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ children }: { children?: ComponentChildren }) {
  return <div class="p-6">{children}</div>;
}
