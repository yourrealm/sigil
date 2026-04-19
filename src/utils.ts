import { createDefine } from "fresh";
import type { Auth } from "./lib/sessions.ts";

// Typed ctx.state shared across middleware, layouts, and routes.
// Middleware populates these where relevant; handlers below read them.
export interface State {
  /** Public-safe forge session - passed to islands and rendered pages. */
  auth: Auth | null;
  /**
   * The OAuth access token, server-side only. Use for outbound forge API calls.
   * NEVER pass to islands or render into HTML.
   */
  token: string | null;
}

export const define = createDefine<State>();
