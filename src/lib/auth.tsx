import { type ComponentChildren, createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Auth } from "./sessions.ts";

const Ctx = createContext<Auth | null | undefined>(undefined);

export function GithubAuthProvider(
  { value, children }: {
    value: Auth | null;
    children: ComponentChildren;
  },
) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** GitHub session for the current request, or null if the contributor isn't signed in. */
export function useGithubAuth(): Auth | null {
  const v = useContext(Ctx);
  if (v === undefined) throw new Error("GithubAuthProvider missing");
  return v;
}
