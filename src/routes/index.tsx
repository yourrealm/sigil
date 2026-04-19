import { define } from "@/utils.ts";
import type { ComponentChildren } from "preact";
import { Wordmark } from "@/components/wordmark.tsx";
import { Eyebrow } from "@/components/eyebrow.tsx";
import RepoOpen from "@/islands/RepoOpen.tsx";

const EXAMPLE_CLA = `---
name: Realm
version: 1.0
---

By submitting a contribution to this project, you agree that:

1. **Ownership.** The contribution is your original work, or you have the
   right to submit it under this agreement.

2. **License grant.** You grant the maintainers and all downstream recipients
   a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license
   to use, modify, and distribute your contribution.

3. **You keep your copyright.** You retain all rights to your contribution
   and may use it however you wish elsewhere.
`;

export default define.page(function Home() {
  return (
    <main class="max-w-[800px] mx-auto px-6 pt-24 pb-24">
      <div class="mb-12">
        <Wordmark />
      </div>

      <h1 class="font-display text-5xl leading-tight text-ink mb-8">
        Signatures for{" "}
        <em class="not-italic bg-yellow px-2 border-2 border-ink inline-block shadow-sm -rotate-2">
          open source
        </em>.
      </h1>

      <p class="text-base text-ink2 leading-relaxed mb-12 max-w-[60ch]">
        Contributor License Agreements that live in your repo. Maintainers drop
        a{" "}
        <span class="font-mono text-ink">CLA.md</span>. Contributors sign by
        opening a pull request. No database, no dashboard, no lock-in - the repo
        is the source of truth.
      </p>

      <section class="mb-16">
        <Eyebrow class="text-muted mb-3 block">Open a signing page</Eyebrow>
        <RepoOpen />
        <p class="mt-3 font-mono text-xs text-muted">
          e.g.{" "}
          <a
            href="/cla/github/yourrealm/sigil"
            class="text-ink underline underline-offset-2 decoration-2 hover:bg-yellow"
          >
            yourrealm/sigil
          </a>
        </p>
      </section>

      <section class="mb-16">
        <h2 class="font-display text-3xl text-ink mb-8">How to adopt Sigil</h2>

        <ol class="space-y-8">
          <HowToStep n="01" title="Drop a CLA.md in your repo root">
            Frontmatter sets the agreement's display name and version. The body
            is the legal text contributors agree to. Example:
            <pre class="mt-4 font-mono text-xs bg-paper2 border-2 border-ink p-4 overflow-x-auto leading-relaxed">
{EXAMPLE_CLA}
            </pre>
          </HowToStep>

          <HowToStep n="02" title="Share your signing URL">
            Point contributors at{" "}
            <span class="font-mono text-ink break-all">
              withsigil.eu/cla/github/&lt;owner&gt;/&lt;repo&gt;
            </span>. They sign in with GitHub and Sigil opens a pull request
            against your repo that adds{" "}
            <span class="font-mono text-ink">
              .signatures/cla/&lt;handle&gt;.md
            </span>.
          </HowToStep>

          <HowToStep n="03" title="Install the gatekeeper Action">
            A reusable GitHub Action validates every signature PR against your
            current{" "}
            <span class="font-mono text-ink">CLA.md</span>: filename matches the
            commit author, the body is verbatim, and the version matches. You
            merge, and the signature is part of Git history forever.
          </HowToStep>
        </ol>
      </section>

      <section>
        <h2 class="font-display text-3xl text-ink mb-4">Why the repo?</h2>
        <p class="text-base text-ink2 leading-relaxed max-w-[60ch]">
          Because every signature, revocation, and re-sign is auditable via{" "}
          <span class="font-mono text-ink">git log</span>. Because Sigil can go
          away and your signatures stay. Because the legal record should live
          where the code lives.
        </p>
      </section>
    </main>
  );
});

function HowToStep(
  { n, title, children }: {
    n: string;
    title: string;
    children: ComponentChildren;
  },
) {
  return (
    <li class="flex gap-6">
      <span class="font-display text-2xl text-ink leading-none w-10 shrink-0 pt-1">
        {n}
      </span>
      <div class="flex-1 min-w-0">
        <h3 class="font-display text-xl text-ink mb-2 leading-tight">
          {title}
        </h3>
        <div class="text-sm text-ink2 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
