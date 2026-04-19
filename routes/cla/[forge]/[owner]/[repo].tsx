import { define } from "../../../../utils.ts";
import SignBox from "../../../../islands/SignBox.tsx";

const FORGE_WEB: Record<string, string> = {
  github: "https://github.com",
  codeberg: "https://codeberg.org",
};

export default define.page(function CLAPage(ctx) {
  const { forge, owner, repo } = ctx.params;
  const repoUrl = FORGE_WEB[forge]
    ? `${FORGE_WEB[forge]}/${owner}/${repo}`
    : null;

  return (
    <div>
      <header class="max-w-[1200px] mx-auto px-6 pt-16 pb-8 flex items-end justify-between">
        <div class="flex items-center gap-3">
          <span class="wordmark">Sigil</span>
          <span
            class="hidden sm:inline-block"
            style={{
              display: "inline-block",
              width: "3px",
              height: "22px",
              background: "#111114",
              margin: "0 4px",
              transform: "rotate(18deg)",
            }}
          >
          </span>
          <span class="hidden sm:inline text-[11px] eyebrow">
            Signatures for open source
          </span>
          <span class="hidden md:inline text-[11px] eyebrow text-muted ml-4">
            {forge}: {repoUrl
              ? (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-ink hover:underline underline-offset-2"
                >
                  {owner}/{repo}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width={2.5}
                  >
                    <path d="M7 17L17 7M17 7H8M17 7v9" />
                  </svg>
                </a>
              )
              : <span class="text-ink">{owner}/{repo}</span>}
          </span>
        </div>
      </header>

      <main class="max-w-[1200px] mx-auto px-6 pb-24 grid grid-cols-12 gap-10">
        <article class="col-span-12 lg:col-span-7">
          <div class="mb-10">
            <h1 class="doc-heading">
              <em>Realm</em>
              <br />
              <span class="doc-heading-sub">
                Contributor<br />License<br />Agreement
              </span>
            </h1>
            <div class="mt-6 flex items-center gap-3 text-[12.5px] text-ink font-mono">
              <span>MAR 4, 2026</span>
            </div>
          </div>

          <div class="hair mb-8"></div>

          <div class="cla-body space-y-5 mb-10">
            <p class="text-[19px] leading-[1.55] text-ink2">
              This license agreement exists so copyright can be transferred to a
              foundation in the future.
            </p>
            <p>
              By submitting a contribution to this project, you agree to the
              following:
            </p>
          </div>

          <ol class="cla-body list-none p-0 m-0">
            <li class="clause">
              <span class="num">1</span>
              <p>
                <strong>Ownership.</strong>{" "}
                You confirm the contribution is your original work, or that you
                have the right to submit it under this agreement. If your
                employer has rights to code you write, you confirm they have
                permitted this contribution.
              </p>
            </li>
            <li class="clause">
              <span class="num">2</span>
              <p>
                <strong>License grant.</strong>{" "}
                You grant Max Malm and all downstream recipients a perpetual,
                worldwide, non-exclusive, royalty-free, irrevocable license to
                use, modify, and distribute your contribution.
              </p>
            </li>
            <li class="clause">
              <span class="num">3</span>
              <p>
                <strong>Patent grant.</strong>{" "}
                You grant a perpetual, worldwide, non-exclusive, royalty-free,
                irrevocable patent license covering patents you own or control
                that are necessarily infringed by your contribution, for use,
                modification, and distribution of Realm.
              </p>
            </li>
            <li class="clause">
              <span class="num">4</span>
              <p>
                <strong>Transfer.</strong>{" "}
                You grant Max Malm the right to transfer or assign the rights in
                this agreement to a successor entity established to steward
                Realm, provided that entity is bound by the same requirement:
                Realm remains licensed under AGPL-3.0 or a later version of the
                GNU AGPL.
              </p>
            </li>
            <li class="clause">
              <span class="num">5</span>
              <p>
                <strong>You keep your copyright.</strong>{" "}
                You retain all rights to your contribution and may use it
                however you wish elsewhere.
              </p>
            </li>
            <li class="clause">
              <span class="num">6</span>
              <p>
                <strong>No warranty.</strong>{" "}
                Contributions are provided "as is", without warranty of any
                kind.
              </p>
            </li>
          </ol>

          <div class="hair mt-12 mb-6"></div>

          <div class="flex items-center justify-between text-[12px] text-muted eyebrow">
            <span>End of agreement</span>
            <span>AGPL-3.0&nbsp;or&nbsp;later</span>
          </div>
        </article>

        <aside class="col-span-12 lg:col-span-5">
          <div class="lg:sticky lg:top-20">
            <SignBox />

            <div class="mt-8 brutal-box">
              <div class="px-4 py-2 border-b-2 border-ink">
                <span class="eyebrow">How this works</span>
              </div>
              <ol class="px-4 py-3 text-[12.5px]">
                <li class="py-2 flex gap-3 border-b-2 border-ink/10">
                  <span class="font-display text-ink text-[16px] leading-none w-6 shrink-0">
                    01
                  </span>
                  <span class="text-ink2">
                    You authorize GitHub. We fork the Realm repo to your
                    account.
                  </span>
                </li>
                <li class="py-2 flex gap-3 border-b-2 border-ink/10">
                  <span class="font-display text-ink text-[16px] leading-none w-6 shrink-0">
                    02
                  </span>
                  <span class="text-ink2">
                    We commit{" "}
                    <span class="font-mono text-ink font-bold">
                      .cla-signatures/&lt;you&gt;.md
                    </span>{" "}
                    to your fork — the commit is <strong>signed</strong>{" "}
                    by GitHub's web-flow key.
                  </span>
                </li>
                <li class="py-2 flex gap-3 border-b-2 border-ink/10">
                  <span class="font-display text-ink text-[16px] leading-none w-6 shrink-0">
                    03
                  </span>
                  <span class="text-ink2">
                    A pull request opens against Realm. CI validates schema
                    &amp; signature; a maintainer reviews and merges.
                  </span>
                </li>
                <li class="py-2 flex gap-3">
                  <span class="font-display text-ink text-[16px] leading-none w-6 shrink-0">
                    04
                  </span>
                  <span class="text-ink2">
                    Your signature is now public and verifiable — forever.
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </aside>
      </main>

      <footer class="border-t-2 border-ink">
        <div class="max-w-[1200px] mx-auto px-6 py-6 flex items-center justify-between text-[12px] text-muted">
          <span>Made by Realm</span>
          <div class="flex items-center gap-5">
            <a href="#" class="hover:text-ink transition-colors">Source</a>
            <a href="#" class="hover:text-ink transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
});
