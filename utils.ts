import { createDefine } from "fresh";

// Typed ctx.state shared across middleware, layouts, and routes.
// Keep intentionally empty until a real cross-cutting value (e.g. session) lands.
// deno-lint-ignore no-empty-interface
export interface State {}

export const define = createDefine<State>();
