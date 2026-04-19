export interface Forge {
  name: string;
  apiBase: string;
  oauthAuthorize: string;
  oauthToken: string;
  scopes: string[];
}

export const FORGES: Record<string, Forge> = {
  github: {
    name: "github",
    apiBase: "https://api.github.com",
    oauthAuthorize: "https://github.com/login/oauth/authorize",
    oauthToken: "https://github.com/login/oauth/access_token",
    scopes: ["public_repo", "read:user"],
  },
};

export function getForge(name: string): Forge | null {
  return FORGES[name] ?? null;
}

export { oauthCreds as getOAuthCreds } from "./env.ts";
