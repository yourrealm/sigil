import { define } from "../utils.ts";

export default define.page(function Home() {
  return (
    <main class="max-w-[800px] mx-auto px-6 pt-24 pb-16">
      <div class="mb-12">
        <span class="wordmark">Sigil</span>
      </div>

      <h1 class="font-display text-[48px] leading-[1.02] text-ink mb-8">
        Signatures for{" "}
        <em
          class="not-italic bg-yellow px-2 border-2 border-ink inline-block"
          style={{ boxShadow: "4px 4px 0 #111114", transform: "rotate(-2deg)" }}
        >
          open source
        </em>.
      </h1>

      <p class="text-[16px] text-ink2 leading-relaxed mb-6 max-w-[60ch]">
        Contributor License Agreements that live in your repo. Maintainers drop
        a{" "}
        <span class="font-mono text-ink">CLA.md</span>. Contributors sign by
        opening a pull request. No database, no dashboard, no lock-in — the repo
        is the source of truth.
      </p>

      <div class="mt-12">
        <a
          href="/cla/github/yourrealm/realm"
          class="inline-flex items-center gap-3 btn-sign px-5 py-3 text-[14.5px] font-medium"
        >
          <span>See the signing page</span>
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
        <span class="ml-4 text-[12px] text-muted font-mono">
          demo: /cla/github/yourrealm/realm
        </span>
      </div>
    </main>
  );
});
