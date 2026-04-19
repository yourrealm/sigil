import { define } from "@/utils.ts";
import { Wordmark } from "@/components/wordmark.tsx";
import { Button } from "@/components/button.tsx";

export default define.page(function Home() {
  return (
    <main class="max-w-[800px] mx-auto px-6 pt-24 pb-16">
      <div class="mb-12">
        <Wordmark />
      </div>

      <h1 class="font-display text-5xl leading-tight text-ink mb-8">
        Signatures for{" "}
        <em class="not-italic bg-yellow px-2 border-2 border-ink inline-block shadow-sm -rotate-2">
          open source
        </em>.
      </h1>

      <p class="text-base text-ink2 leading-relaxed mb-6 max-w-[60ch]">
        Contributor License Agreements that live in your repo. Maintainers drop
        a{" "}
        <span class="font-mono text-ink">CLA.md</span>. Contributors sign by
        opening a pull request. No database, no dashboard, no lock-in - the repo
        is the source of truth.
      </p>

      <div class="mt-12">
        <Button asChild class="gap-3 px-5 py-3 text-sm">
          <a href="/cla/github/yourrealm/sigil">
            See the signing page
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width={2.5}
            >
              <path d="M7 17L17 7M17 7H8M17 7v9" />
            </svg>
          </a>
        </Button>
        <span class="ml-4 text-xs text-muted font-mono">
          demo: /cla/github/yourrealm/sigil
        </span>
      </div>
    </main>
  );
});
