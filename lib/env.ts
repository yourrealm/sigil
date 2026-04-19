import { z } from "zod";

const Schema = z.object({
  // GitHub OAuth App (create at https://github.com/settings/developers)
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
});

type Env = z.infer<typeof Schema>;

function readRaw(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(Schema.shape)) out[key] = Deno.env.get(key);
  return out;
}

const parsed = Schema.safeParse(readRaw());
if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env: Env = parsed.data;

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
}

export function oauthCreds(forge: string): OAuthCreds | null {
  const prefix = forge.toUpperCase();
  const clientId =
    (env as Record<string, string | undefined>)[`${prefix}_CLIENT_ID`];
  const clientSecret =
    (env as Record<string, string | undefined>)[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
