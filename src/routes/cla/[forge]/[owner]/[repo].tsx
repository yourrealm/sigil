// deno-lint-ignore-file react-no-danger
// @deno/gfm sanitizes the HTML it produces, so dangerouslySetInnerHTML is safe here.
import { page } from "fresh";
import type { ComponentChildren } from "preact";
import { render } from "@deno/gfm";
import { define } from "@/utils.ts";
import { getRepoFile } from "@/lib/github.ts";
import { CLAProvider, parseCLA, type ParsedCLA } from "@/lib/cla.tsx";
import { signaturePath } from "@/lib/agreement.ts";
import { GithubLogin, GithubRepoName } from "@/lib/gh-ids.ts";
import type { Auth } from "@/lib/sessions.ts";
import GithubSignBox from "@/islands/GithubSignBox.tsx";
import { Wordmark } from "@/components/wordmark.tsx";
import { Eyebrow } from "@/components/eyebrow.tsx";
import { Button } from "@/components/button.tsx";
import { DocHeading } from "@/components/doc-heading.tsx";
import { Card, CardBody, CardHead } from "@/components/card.tsx";
import { PiGithubLogoDuotone, PiGitPullRequestDuotone } from "@preact-icons/pi";

const FORGE_WEB: Record<string, string> = {
  github: "https://github.com",
  codeberg: "https://codeberg.org",
};

interface RepoTarget {
  forge: string;
  owner: string;
  repo: string;
}

type CLAData =
  | { kind: "ok"; cla: ParsedCLA; auth: Auth | null } & RepoTarget
  | { kind: "ratelimited"; returnTo: string } & RepoTarget
  | { kind: "error"; heading: string; message: string } & RepoTarget;

export const handler = define.handlers({
  async GET(ctx) {
    const { forge, owner, repo } = ctx.params;
    const target: RepoTarget = { forge, owner, repo };

    if (forge !== "github") {
      return page<CLAData>({
        kind: "error",
        ...target,
        heading: "Unknown forge.",
        message: `No handler registered for "${forge}".`,
      }, { status: 404 });
    }
    if (
      !GithubLogin.safeParse(owner).success ||
      !GithubRepoName.safeParse(repo).success
    ) {
      return page<CLAData>({
        kind: "error",
        ...target,
        heading: "Invalid repo reference.",
        message: `"${owner}/${repo}" isn't a valid GitHub owner/repo pair.`,
      }, { status: 400 });
    }
    const fetched = await getRepoFile(
      owner,
      repo,
      "CLA.md",
      ctx.state.token ?? undefined,
    );

    if (fetched.status === "not_found") {
      return page<CLAData>({
        kind: "error",
        ...target,
        heading: "No CLA here.",
        message:
          `${owner}/${repo} doesn't have a CLA.md at its repo root. A maintainer needs to add one before contributors can sign.`,
      }, { status: 404 });
    }

    if (fetched.status === "error") {
      // 403 without a token = anonymous IP rate-limit. Render the normal layout
      // with a sign-in prompt instead of an error page; signing in routes
      // through the user's 5000/hr quota and the CLA loads on the retry.
      if (fetched.httpStatus === 403 && !ctx.state.auth) {
        const url = new URL(ctx.req.url);
        return page<CLAData>({
          kind: "ratelimited",
          ...target,
          returnTo: url.pathname + url.search,
        }, { status: 200 });
      }
      return page<CLAData>({
        kind: "error",
        ...target,
        heading: "Couldn't reach the repo.",
        message: fetched.message,
      }, { status: 502 });
    }

    const result = parseCLA(fetched.content);
    if (!result.ok) {
      return page<CLAData>({
        kind: "error",
        ...target,
        heading: "CLA.md needs attention.",
        message: result.issues.join("; "),
      }, { status: 422 });
    }

    return {
      data: {
        kind: "ok",
        ...target,
        cla: result.cla,
        auth: ctx.state.auth,
      } satisfies CLAData,
    };
  },
});

export default define.page<typeof handler>(function CLAPage({ data }) {
  if (data.kind === "ok") return <SignedInView data={data} />;
  if (data.kind === "ratelimited") return <RatelimitView data={data} />;
  return <ErrorView data={data} />;
});

function SignedInView(
  { data }: { data: Extract<CLAData, { kind: "ok" }> },
) {
  const { cla, forge, owner, repo, auth } = data;
  const bodyHtml = render(cla.body);
  const repoUrl = FORGE_WEB[forge]
    ? `${FORGE_WEB[forge]}/${owner}/${repo}`
    : null;
  return (
    <CLAProvider value={{ cla, forge, owner, repo }}>
      <PageShell target={{ forge, owner, repo }} hideRepoLabel>
        <main class="max-w-[1200px] mx-auto px-6 pb-24 grid grid-cols-12 gap-10">
          <article class="col-span-12 lg:col-span-7">
            <div class="mb-10">
              <DocHeading
                accent={cla.name}
                sub={
                  <>
                    Contributor<br />License<br />Agreement
                  </>
                }
              />
              <div class="mt-6 flex items-center gap-4 text-xs text-ink font-mono leading-none">
                <span>v{cla.version}</span>
                <span class="w-1 h-1 bg-ink shrink-0"></span>
                <Eyebrow class="text-muted">{forge}:</Eyebrow>
                {repoUrl
                  ? (
                    <a
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-center gap-1.5 text-ink hover:underline underline-offset-2"
                    >
                      <PiGithubLogoDuotone class="text-sm" />
                      <span>{owner}/{repo}</span>
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
                  : (
                    <span class="flex items-center gap-1.5">
                      <PiGithubLogoDuotone class="text-sm" />
                      <span>{owner}/{repo}</span>
                    </span>
                  )}
              </div>
            </div>

            <div class="border-t-2 border-ink mb-8"></div>

            <article
              class="prose prose-lg font-serif text-ink max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            <div class="border-t-2 border-ink mt-12 mb-6"></div>

            <div class="flex items-center justify-between">
              <Eyebrow class="text-muted">End of agreement</Eyebrow>
              <Eyebrow class="text-muted">
                {cla.name}&nbsp;CLA&nbsp;v{cla.version}
              </Eyebrow>
            </div>
          </article>

          <aside class="col-span-12 lg:col-span-5">
            <div class="lg:sticky lg:top-20">
              {auth
                ? (
                  <GithubSignBox
                    auth={auth}
                    cla={cla}
                    target={{ forge, owner, repo }}
                  />
                )
                : (
                  <LoggedOutCard
                    owner={owner}
                    repo={repo}
                    returnTo={`/cla/${forge}/${owner}/${repo}`}
                    version={cla.version}
                  />
                )}
              <HowItWorks owner={owner} repo={repo} userLogin={auth?.login} />
            </div>
          </aside>
        </main>
      </PageShell>
    </CLAProvider>
  );
}

function RatelimitView(
  { data }: { data: Extract<CLAData, { kind: "ratelimited" }> },
) {
  const { forge, owner, repo, returnTo } = data;
  return (
    <PageShell target={{ forge, owner, repo }}>
      <main class="max-w-[1200px] mx-auto px-6 pb-24 grid grid-cols-12 gap-10">
        <article class="col-span-12 lg:col-span-7">
          <div class="mb-10">
            <DocHeading sub="Sign in to view">
              <em class="not-italic">CLA</em>
            </DocHeading>
            <div class="mt-6 flex items-center gap-3 text-xs text-muted font-mono">
              <span>{owner}/{repo}</span>
            </div>
          </div>

          <div class="border-t-2 border-ink mb-8"></div>

          <p class="font-serif text-base text-ink2 leading-relaxed mb-4">
            We're temporarily over GitHub's anonymous request limit (60 per hour
            per IP).
          </p>
          <p class="font-serif text-base text-ink2 leading-relaxed">
            Sign in with GitHub on the right and the agreement loads against
            your personal 5000-per-hour quota - the same authorization you'd use
            to sign anyway.
          </p>
        </article>

        <aside class="col-span-12 lg:col-span-5">
          <div class="lg:sticky lg:top-20">
            <SignInCard returnTo={returnTo} owner={owner} repo={repo} />
            <HowItWorks owner={owner} repo={repo} />
          </div>
        </aside>
      </main>
    </PageShell>
  );
}

function ErrorView(
  { data }: { data: Extract<CLAData, { kind: "error" }> },
) {
  const repoUrl = FORGE_WEB[data.forge]
    ? `${FORGE_WEB[data.forge]}/${data.owner}/${data.repo}`
    : null;

  return (
    <PageShell target={data} compact>
      <main class="max-w-[720px] mx-auto px-6 pt-8 pb-24">
        <Eyebrow class="mb-3 block text-muted">
          {data.forge}: {data.owner}/{data.repo}
        </Eyebrow>
        <h1 class="font-display uppercase tracking-tighter text-6xl leading-[0.95] text-ink">
          {data.heading}
        </h1>

        <div class="border-t-2 border-ink mt-10 mb-8"></div>

        <p class="font-serif text-base text-ink2 leading-relaxed mb-8">
          {data.message}
        </p>

        <div class="flex items-center gap-3">
          {repoUrl && (
            <Button asChild variant="ghost" class="gap-2 px-4 py-2.5 text-sm">
              <a href={repoUrl} target="_blank" rel="noopener noreferrer">
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
            </Button>
          )}
          <a
            href="/"
            class="px-4 py-2.5 text-sm text-muted hover:text-ink transition-colors"
          >
            ← Home
          </a>
        </div>
      </main>
    </PageShell>
  );
}

interface PageShellProps {
  target: RepoTarget;
  /** Compact = error pages: hide the right-side forge label in the header. */
  compact?: boolean;
  /** Hide the header forge label when the page renders it elsewhere (e.g. next to the version). */
  hideRepoLabel?: boolean;
  children?: ComponentChildren;
}

function PageShell(
  { target, compact, hideRepoLabel, children }: PageShellProps,
) {
  const { forge, owner, repo } = target;
  const repoUrl = FORGE_WEB[forge]
    ? `${FORGE_WEB[forge]}/${owner}/${repo}`
    : null;

  return (
    <div>
      <header class="max-w-[1200px] mx-auto px-6 pt-8 pb-16 flex items-end justify-between">
        <div class="flex items-center gap-3">
          <Wordmark
            href="/"
            tagline="Signatures for open source"
            class="text-lg"
          />
          {!compact && !hideRepoLabel && (
            <span class="hidden md:inline text-xs ml-4">
              <Eyebrow class="text-muted">{forge}:</Eyebrow> {repoUrl
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
          )}
        </div>
      </header>

      {children}

      <footer class="border-t-2 border-ink">
        <div class="max-w-[1200px] mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted">
          <span>Made in the EU</span>
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 hover:text-ink transition-colors"
            >
              <PiGithubLogoDuotone class="text-sm" />
              <span>Source</span>
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

function HowItWorks(
  { owner, repo, userLogin }: {
    owner: string;
    repo: string;
    userLogin?: string;
  },
) {
  return (
    <details class="group mt-8 border-2 border-ink bg-paper shadow-sm">
      <summary class="px-4 py-2 border-b-2 border-transparent group-open:border-ink flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <Eyebrow>How this works</Eyebrow>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width={2.5}
          class="transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <ol class="px-4 py-3 text-xs">
        <Step n="01">
          You authorize GitHub. We fork{" "}
          <span class="font-mono text-ink">{owner}/{repo}</span>{" "}
          to your account.
        </Step>
        <Step n="02">
          We commit{" "}
          <span class="font-mono text-ink font-bold">
            {signaturePath(userLogin ?? "<you>")}
          </span>{" "}
          to your fork - the commit is <strong>signed</strong>{" "}
          by GitHub's web-flow key.
        </Step>
        <Step n="03">
          A pull request opens against{" "}
          <span class="font-mono text-ink">{owner}/{repo}</span>. CI validates
          schema &amp; signature; a maintainer reviews and merges.
        </Step>
        <Step n="04" last>
          Your signature is now public and verifiable - forever.
        </Step>
      </ol>
    </details>
  );
}

function Step(
  { n, last, children }: {
    n: string;
    last?: boolean;
    children: ComponentChildren;
  },
) {
  return (
    <li
      class={`py-2 flex gap-3 ${last ? "" : "border-b-2 border-ink/10"}`}
    >
      <span class="font-display text-ink text-base leading-none w-6 shrink-0">
        {n}
      </span>
      <span class="text-ink2">{children}</span>
    </li>
  );
}

function LoggedOutCard(
  { owner, repo, returnTo, version }: {
    owner: string;
    repo: string;
    returnTo: string;
    version: string;
  },
) {
  const loginHref = `/auth/github/login?return=${encodeURIComponent(returnTo)}`;
  return (
    <Card state="loggedOut">
      <CardHead>
        <div>
          <div class="font-display text-3xl leading-none tracking-tight [&_em]:not-italic">
            Sign <em>CLA</em>
          </div>
        </div>
        <div class="text-right">
          <Eyebrow class="opacity-80">Ver.</Eyebrow>
          <div class="font-display text-xl leading-none mt-1">{version}</div>
        </div>
      </CardHead>
      <CardBody>
        <p class="text-sm text-ink2 leading-relaxed mb-5">
          Signing opens a pull request against{" "}
          <span class="font-mono text-ink">{owner}/{repo}</span>{" "}
          that adds your signature.
        </p>
        <Button
          asChild
          class="w-full py-3.5 text-sm gap-2"
          icon={<PiGitPullRequestDuotone class="text-xl" />}
        >
          <a href={loginHref}>
            <PiGithubLogoDuotone class="text-xl" />
            Sign in with GitHub
          </a>
        </Button>
      </CardBody>
    </Card>
  );
}

function SignInCard(
  { returnTo, owner, repo }: {
    returnTo: string;
    owner: string;
    repo: string;
  },
) {
  const loginHref = `/auth/github/login?return=${encodeURIComponent(returnTo)}`;
  return (
    <div class="border-2 border-ink bg-paper shadow-md overflow-hidden">
      <div class="bg-ink text-paper border-b-2 border-ink px-6 pt-5 pb-5 flex items-start justify-between gap-4">
        <div>
          <Eyebrow class="mb-2 block opacity-80 text-paper">Locked</Eyebrow>
          <div class="font-display text-3xl leading-none tracking-tight">
            Sign in to <em class="not-italic">read</em>
          </div>
        </div>
      </div>
      <div class="p-6">
        <p class="text-sm text-ink2 leading-relaxed mb-5">
          Authorize GitHub to load{" "}
          <span class="font-mono text-ink">{owner}/{repo}</span>'s CLA on your
          quota.
        </p>
        <Button asChild class="w-full py-3.5 text-sm gap-2">
          <a href={loginHref}>
            <PiGithubLogoDuotone class="text-xl" />
            Sign in with GitHub
          </a>
        </Button>
      </div>
    </div>
  );
}
