export interface Session {
  token: string;
  login: string;
  forge: string;
}

export const SESSION_TTL_MS = 30 * 60 * 1000;

const kv = await Deno.openKv();

export function sessionCookieName(forge: string): string {
  return `session_${forge}`;
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function createSession(data: Session): Promise<string> {
  const id = generateSessionId();
  await kv.set(["sessions", id], data, { expireIn: SESSION_TTL_MS });
  return id;
}

export async function getSession(id: string): Promise<Session | null> {
  const res = await kv.get<Session>(["sessions", id]);
  return res.value ?? null;
}

export async function deleteSession(id: string): Promise<void> {
  await kv.delete(["sessions", id]);
}
