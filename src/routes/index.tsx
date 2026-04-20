import { define } from "@/utils.ts";
import type { ComponentChildren } from "preact";
import { Wordmark } from "@/components/wordmark.tsx";
import { Eyebrow } from "@/components/eyebrow.tsx";
import RepoOpen from "@/islands/RepoOpen.tsx";
import { PiGithubLogoDuotone } from "@preact-icons/pi";

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

const GATE_WORKFLOW = `name: Sigil
on: [pull_request_target]
permissions:
  pull-requests: write  # post status comment
  contents: read        # read CLA.md and signature files
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: yourrealm/sigil@main
`;

export default define.page(function Home() {
  return (
    <div>
      <main class="max-w-[800px] mx-auto px-6 pt-24 pb-24">
        <div class="mb-12">
          <Wordmark class="text-lg" />
        </div>

        <h1 class="font-display text-5xl leading-tight text-ink mb-8">
          Signatures for{" "}
          <em class="not-italic bg-yellow px-2 border-2 border-ink inline-block shadow-sm -rotate-2">
            open source
          </em>.
        </h1>

        <p class="text-base text-ink2 leading-relaxed mb-12 max-w-[60ch]">
          Contributor License Agreements that live in your repo.
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

        <section>
          <h2 class="font-display text-3xl text-ink mb-8">
            How to adopt Sigil
          </h2>

          <ol class="space-y-8">
            <HowToStep n="01" title="Drop a CLA.md in your repo root">
              Frontmatter sets the agreement's display name and version. The
              body is the legal text contributors agree to. Example:
              <pre class="mt-4 font-mono text-xs bg-paper2 border-2 border-ink p-4 overflow-x-auto leading-relaxed">
{EXAMPLE_CLA}
              </pre>
            </HowToStep>

            <HowToStep n="02" title="Install the gatekeeper Action">
              Create{" "}
              <span class="font-mono text-ink">
                .github/workflows/sigil.yml
              </span>. The gate validates signature PRs (signature validity, CLA
              integrity, contributor consent), posts a status comment, and
              fails the job if anything is wrong.
              <pre class="mt-4 font-mono text-xs bg-paper2 border-2 border-ink p-4 overflow-x-auto leading-relaxed">
{GATE_WORKFLOW}
              </pre>
            </HowToStep>

            <HowToStep n="03" title="Share your signing URL">
              Point contributors at{" "}
              <span class="font-mono text-ink break-all">
                withsigil.eu/cla/github/&lt;owner&gt;/&lt;repo&gt;
              </span>. They sign in with GitHub and Sigil opens a pull request
              against your repo that adds{" "}
              <span class="font-mono text-ink">
                .signatures/cla/&lt;handle&gt;.md
              </span>.
            </HowToStep>
          </ol>
        </section>
      </main>

      <footer class="border-t-2 border-ink">
        <div class="max-w-[800px] mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted">
          <span>Made in the EU</span>
          <a
            href="https://github.com/yourrealm/sigil"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 hover:text-ink transition-colors"
          >
            <PiGithubLogoDuotone class="text-sm" />
            <span>Source</span>
          </a>
        </div>
      </footer>
    </div>
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
