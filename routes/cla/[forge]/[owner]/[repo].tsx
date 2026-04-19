// deno-lint-ignore-file react-no-danger
// @deno/gfm sanitizes the HTML it produces, so dangerouslySetInnerHTML is safe here.
import { page } from "fresh";
import { render } from "@deno/gfm";
import { define } from "../../../../utils.ts";
import { getRepoFile } from "../../../../lib/github.ts";
import { parseCLA, type ParsedCLA } from "../../../../lib/cla.ts";
import SignBox from "../../../../islands/SignBox.tsx";

const FORGE_WEB: Record<string, string> = {
  github: "https://github.com",
  codeberg: "https://codeberg.org",
};

type CLAData =
  | {
    ok: true;
    cla: ParsedCLA;
    forge: string;
    owner: string;
    repo: string;
  }
  | {
    ok: false;
    heading: string;
    message: string;
    forge: string;
    owner: string;
    repo: string;
  };

export const handler = define.handlers({
  async GET(ctx) {
    const { forge, owner, repo } = ctx.params;

    const fetched = await getRepoFile(forge, owner, repo, "CLA.md");
    if (fetched.status === "not_found") {
      return page<CLAData>({
        ok: false,
        heading: "No CLA here.",
        message:
          `${owner}/${repo} doesn't have a CLA.md at its repo root. A maintainer needs to add one before contributors can sign.`,
        forge,
        owner,
        repo,
      }, { status: 404 });
    }
    if (fetched.status === "error") {
      return page<CLAData>({
        ok: false,
        heading: "Couldn't reach the repo.",
        message: fetched.message,
        forge,
        owner,
        repo,
      }, { status: 502 });
    }

    const result = parseCLA(fetched.content);
    if (!result.ok) {
      return page<CLAData>({
        ok: false,
        heading: "CLA.md needs attention.",
        message: result.issues.join("; "),
        forge,
        owner,
        repo,
      }, { status: 422 });
    }

    return {
      data: {
        ok: true,
        cla: result.cla,
        forge,
        owner,
        repo,
      } satisfies CLAData,
    };
  },
});

export default define.page<typeof handler>(function CLAPage({ data }) {
  if (!data.ok) return <ErrorView data={data} />;
  const { cla, forge, owner, repo } = data;
  const repoUrl = FORGE_WEB[forge]
    ? `${FORGE_WEB[forge]}/${owner}/${repo}`
    : null;
  const bodyHtml = render(cla.body);

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
              <em>{cla.name}</em>
              <br />
              <span class="doc-heading-sub">
                Contributor<br />License<br />Agreement
              </span>
            </h1>
            <div class="mt-6 flex items-center gap-3 text-[12.5px] text-ink font-mono">
              <span>v{cla.version}</span>
            </div>
          </div>

          <div class="hair mb-8"></div>

          <div
            class="cla-body space-y-5"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          <div class="hair mt-12 mb-6"></div>

          <div class="flex items-center justify-between text-[12px] text-muted eyebrow">
            <span>End of agreement</span>
            <span>{cla.name}&nbsp;v{cla.version}</span>
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
                    You authorize GitHub. We fork{" "}
                    <span class="font-mono text-ink">{owner}/{repo}</span>{" "}
                    to your account.
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
                    A pull request opens against{" "}
                    <span class="font-mono text-ink">{owner}/{repo}</span>. CI
                    validates schema &amp; signature; a maintainer reviews and
                    merges.
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
          <span>Made with Sigil</span>
          <div class="flex items-center gap-5">
            <a
              href={repoUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-ink transition-colors"
            >
              Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
});

function ErrorView(
  { data }: {
    data: Extract<CLAData, { ok: false }>;
  },
) {
  const repoUrl = FORGE_WEB[data.forge]
    ? `${FORGE_WEB[data.forge]}/${data.owner}/${data.repo}`
    : null;

  return (
    <div>
      <header class="max-w-[1200px] mx-auto px-6 pt-16 pb-8 flex items-end justify-between">
        <div class="flex items-center gap-3">
          <a href="/" class="wordmark">Sigil</a>
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
        </div>
      </header>

      <main class="max-w-[720px] mx-auto px-6 pt-8 pb-24">
        <div class="eyebrow mb-3 text-muted">
          {data.forge}: {data.owner}/{data.repo}
        </div>
        <h1 class="doc-heading" style={{ fontSize: "56px" }}>
          {data.heading}
        </h1>

        <div class="hair mt-10 mb-8"></div>

        <p class="cla-body text-[17px] text-ink2 leading-[1.6] mb-8">
          {data.message}
        </p>

        <div class="flex items-center gap-3">
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="btn-ghost px-4 py-2.5 text-[13px] font-medium inline-flex items-center gap-2"
            >
              Open on {data.forge}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width={2.5}
              >
                <path d="M7 17L17 7M17 7H8M17 7v9" />
              </svg>
            </a>
          )}
          <a
            href="/"
            class="px-4 py-2.5 text-[13px] text-muted hover:text-ink transition-colors"
          >
            ← Home
          </a>
        </div>
      </main>

      <footer class="border-t-2 border-ink">
        <div class="max-w-[1200px] mx-auto px-6 py-6 flex items-center justify-between text-[12px] text-muted">
          <span>Made with Sigil</span>
        </div>
      </footer>
    </div>
  );
}
