import { useSignal } from "@preact/signals";
import { Button } from "@/components/button.tsx";

const GH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Parse `owner/repo`, full URLs, or `github.com/owner/repo` into a path. */
function parseRepo(raw: string): { path: string } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Enter a GitHub repo." };

  let owner: string;
  let repo: string;

  const hasScheme = /^https?:\/\//i.test(trimmed);
  const hasHost = hasScheme || trimmed.startsWith("github.com/");
  if (hasHost) {
    try {
      const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
      if (url.hostname !== "github.com") {
        return { error: "Only github.com URLs for now." };
      }
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts.length < 2) return { error: "URL is missing owner/repo." };
      [owner, repo] = parts;
    } catch {
      return { error: "That doesn't look like a URL." };
    }
  } else {
    const parts = trimmed.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length !== 2) return { error: "Use owner/repo." };
    [owner, repo] = parts;
  }

  repo = repo.replace(/\.git$/, "");
  if (!GH_SEGMENT.test(owner) || !GH_SEGMENT.test(repo)) {
    return { error: "Owner or repo name has invalid characters." };
  }
  return { path: `/cla/github/${owner}/${repo}` };
}

export default function RepoOpen() {
  const value = useSignal("");
  const error = useSignal<string | null>(null);

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const parsed = parseRepo(value.value);
    if ("error" in parsed) {
      error.value = parsed.error;
      return;
    }
    error.value = null;
    globalThis.location.assign(parsed.path);
  };

  return (
    <form onSubmit={onSubmit} class="w-full">
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex items-stretch border-2 border-ink bg-paper shadow-sm flex-1 focus-within:bg-yellow transition-colors">
          <span class="font-mono text-xs text-muted px-3 flex items-center border-r-2 border-ink bg-paper">
            github.com/
          </span>
          <input
            type="text"
            value={value.value}
            onInput={(e) => {
              value.value = (e.currentTarget as HTMLInputElement).value;
              if (error.value) error.value = null;
            }}
            placeholder="owner/repo"
            aria-label="GitHub repository"
            autocomplete="off"
            spellcheck={false}
            class="flex-1 px-3 py-3 font-mono text-sm bg-transparent text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <Button type="submit" class="px-5 py-3 text-sm shrink-0">
          Open signing page
        </Button>
      </div>
      {error.value && (
        <p class="mt-3 font-mono text-xs text-warn" role="alert">
          {error.value}
        </p>
      )}
    </form>
  );
}
