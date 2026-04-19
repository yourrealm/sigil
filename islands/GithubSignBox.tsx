import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { GithubAuthProvider, useGithubAuth } from "@/lib/auth.tsx";
import { CLAProvider, type ParsedCLA, useCLA } from "@/lib/cla.tsx";
import type { Auth } from "@/lib/sessions.ts";
import { Button } from "@/components/button.tsx";
import { Eyebrow } from "@/components/eyebrow.tsx";
import { Switch } from "@/components/switch.tsx";
import {
  Card,
  CardBody,
  CardHead,
  type CardState,
} from "@/components/card.tsx";
import { Dialog, DialogHead } from "@/components/dialog.tsx";
import { Banner } from "@/components/banner.tsx";
import {
  PiGithubLogoDuotone,
  PiGitPullRequestDuotone,
  PiSealCheckDuotone,
  PiWarningOctagonDuotone,
} from "@preact-icons/pi";

const META: Record<
  CardState,
  { eyebrow: string; title: preact.JSX.Element }
> = {
  loggedOut: {
    eyebrow: "Unsigned",
    title: (
      <>
        Sign via pull&nbsp;<em>request</em>
      </>
    ),
  },
  loggedIn: {
    eyebrow: "Ready to sign",
    title: (
      <>
        Sign via pull&nbsp;<em>request</em>
      </>
    ),
  },
  resignNeeded: {
    eyebrow: "Amended",
    title: (
      <>
        Please <em>re-sign</em>
      </>
    ),
  },
  submitting: {
    eyebrow: "In flight",
    title: (
      <>
        Opening pull <em>request</em>…
      </>
    ),
  },
  signed: {
    eyebrow: "Signed",
    title: (
      <>
        Signature <em>merged</em>
      </>
    ),
  },
  revoke: {
    eyebrow: "Revoke",
    title: (
      <>
        Withdraw <em>signature</em>
      </>
    ),
  },
  revoking: {
    eyebrow: "Withdrawing",
    title: (
      <>
        Opening revocation&nbsp;<em>PR</em>…
      </>
    ),
  },
};

interface DisplayUser {
  handle: string;
  login: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toLowerCase();
  }
  return name.slice(0, 2).toLowerCase();
}

function toDisplayUser(auth: Auth): DisplayUser {
  const name = auth.name ?? auth.login;
  return {
    handle: `@${auth.login}`,
    login: auth.login,
    name,
    initials: deriveInitials(name),
    avatarUrl: auth.avatarUrl,
  };
}

function useUser(): DisplayUser {
  const auth = useGithubAuth();
  if (!auth) throw new Error("useUser requires a signed-in user");
  return toDisplayUser(auth);
}

interface GithubSignBoxProps {
  auth: Auth | null;
  cla: ParsedCLA;
  target: { owner: string; repo: string };
}

export default function GithubSignBox(
  { auth, cla, target }: GithubSignBoxProps,
) {
  const state = useSignal<CardState>(auth ? "loggedIn" : "loggedOut");
  const changesRef = useRef<HTMLDialogElement>(null!);
  const compareRef = useRef<HTMLDialogElement>(null!);

  const setState = (next: CardState) => (state.value = next);
  const meta = META[state.value];
  const openChanges = () => changesRef.current?.showModal();
  const openCompare = () => compareRef.current?.showModal();
  const headEm = state.value === "submitting"
    ? "[&_em]:not-italic [&_em]:bg-ink [&_em]:text-yellow [&_em]:px-1"
    : "[&_em]:not-italic";

  return (
    <GithubAuthProvider value={auth}>
      <CLAProvider value={{ cla, owner: target.owner, repo: target.repo }}>
        <Card id="signCard" state={state.value}>
          <CardHead>
            <div>
              <Eyebrow class="mb-2 block opacity-80">{meta.eyebrow}</Eyebrow>
              <div
                class={`font-display text-3xl leading-none tracking-tight ${headEm}`}
              >
                {meta.title}
              </div>
            </div>
            <div class="text-right mt-1">
              <Eyebrow class="opacity-80">Ver.</Eyebrow>
              <div class="font-display text-xl leading-none mt-1">
                {cla.version}
              </div>
            </div>
          </CardHead>
          <CardBody>
            <StateBody
              state={state.value}
              setState={setState}
              openChanges={openChanges}
              openCompare={openCompare}
            />
          </CardBody>
        </Card>

        {auth && (
          <>
            <ChangesDialog dialogRef={changesRef} />
            <CompareDialog dialogRef={compareRef} />
          </>
        )}
      </CLAProvider>
    </GithubAuthProvider>
  );
}

interface CardActions {
  setState: (s: CardState) => void;
  openChanges: () => void;
  openCompare: () => void;
}

function StateBody({ state, ...actions }: CardActions & { state: CardState }) {
  switch (state) {
    case "loggedOut":
      return <LoggedOut />;
    case "loggedIn":
      return (
        <LoggedIn
          setState={actions.setState}
          openChanges={actions.openChanges}
        />
      );
    case "resignNeeded":
      return (
        <ResignNeeded
          setState={actions.setState}
          openCompare={actions.openCompare}
        />
      );
    case "submitting":
      return <Submitting />;
    case "signed":
      return <Signed setState={actions.setState} />;
    case "revoke":
      return <Revoke setState={actions.setState} />;
    case "revoking":
      return <Revoking />;
  }
}

function LoggedOut() {
  return (
    <div class="animate-fade-up">
      <UpstreamLine verb="Signing" tail="that adds your signature." />
      <Button
        class="w-full py-3.5 text-sm"
        icon={<PiGithubLogoDuotone class="text-xl" />}
        onClick={() => {
          const ret = encodeURIComponent(
            globalThis.location.pathname + globalThis.location.search,
          );
          globalThis.location.href = `/auth/github/login?return=${ret}`;
        }}
      >
        Sign in with GitHub
      </Button>
    </div>
  );
}

function UpstreamLine({ verb, tail }: { verb: string; tail: string }) {
  const { owner, repo } = useCLA();
  return (
    <p class="text-sm text-ink2 leading-relaxed mb-5">
      {verb} opens a pull request against{" "}
      <span class="font-mono text-ink">{owner}/{repo}</span> {tail}
    </p>
  );
}

function Identity({ extra }: { extra?: preact.ComponentChildren }) {
  const user = useUser();
  return (
    <div class="mb-4">
      <Eyebrow class="mb-2 block">Signing as</Eyebrow>
      <div class="flex items-center gap-3 p-3 border-2 border-ink bg-paper">
        {user.avatarUrl
          ? (
            <img
              src={user.avatarUrl}
              alt=""
              class="w-10 h-10 border-2 border-ink"
              width="40"
              height="40"
            />
          )
          : (
            <div class="w-10 h-10 bg-ink text-paper grid place-items-center font-mono text-xs">
              {user.initials}
            </div>
          )}
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-ink truncate">{user.name}</div>
          <div class="text-xs text-muted font-mono">{user.handle}</div>
        </div>
        {extra}
      </div>
    </div>
  );
}

function LoggedIn(
  { setState, openChanges }: {
    setState: (s: CardState) => void;
    openChanges: () => void;
  },
) {
  const user = useUser();
  const agreed = useSignal(false);

  return (
    <div class="animate-fade-up">
      <Identity
        extra={
          <form method="POST" action="/auth/github/logout">
            <button
              type="submit"
              class="text-xs font-mono font-bold uppercase tracking-eyebrow text-muted hover:text-ink transition-colors"
            >
              Log out
            </button>
          </form>
        }
      />

      <button
        type="button"
        class="w-full mb-4 px-3 py-2.5 border-2 border-ink bg-paper shadow-sm flex items-center justify-between text-xs hover:bg-yellow transition-colors"
        onClick={openChanges}
      >
        <Eyebrow>Changes</Eyebrow>
        <span class="flex items-center gap-2 text-ink font-mono text-xs">
          <span>.cla-signatures/{user.login}.md</span>
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
        </span>
      </button>

      <Switch
        checked={agreed}
        label="I have read and agree to the agreement."
      />

      <Button
        class="w-full py-3.5 text-sm"
        disabled={!agreed.value}
        icon={<PiGitPullRequestDuotone class="text-base" />}
        onClick={() => setState("submitting")}
      >
        Open signed pull request
      </Button>
    </div>
  );
}

interface PreviousSignature {
  version: string;
  signedAt: string;
  previousEffectiveDate: string;
  clauseDiff: { before: string; after: string; num: number };
}

const STUB_PREVIOUS: PreviousSignature = {
  version: "1.3",
  signedAt: "Jun 14, 2025",
  previousEffectiveDate: "Jun 14, 2024",
  clauseDiff: {
    num: 4,
    before:
      "You grant the project author the right to transfer or assign the rights in this agreement to a successor entity.",
    after:
      "You grant the project author the right to transfer or assign the rights in this agreement to a successor entity, provided that entity is bound by the same requirement.",
  },
};

function ResignNeeded(
  { setState, openCompare }: {
    setState: (s: CardState) => void;
    openCompare: () => void;
  },
) {
  const { cla } = useCLA();
  const agreed = useSignal(false);
  const prev = STUB_PREVIOUS;

  return (
    <div class="animate-fade-up">
      <Banner
        icon={<PiWarningOctagonDuotone />}
        kicker="Signature is out of date."
        footer={
          <>
            <span class="font-mono">v{prev.version} → v{cla.version}</span>
            <span>&middot;</span>
            <button
              type="button"
              class="underline underline-offset-2 hover:text-ink transition-colors"
              onClick={openCompare}
            >
              Compare
            </button>
          </>
        }
      >
        You signed an earlier version of this agreement. Please review and sign
        again.
      </Banner>

      <Identity
        extra={
          <div class="text-right">
            <Eyebrow>Previous</Eyebrow>
            <div class="text-xs text-muted">{prev.signedAt}</div>
          </div>
        }
      />

      <Switch
        checked={agreed}
        label={`I have re-read and agree to version ${cla.version}.`}
        sublabel="Your previous signature file will be overwritten."
      />

      <Button
        class="w-full py-3.5 text-sm"
        disabled={!agreed.value}
        icon={<PiGitPullRequestDuotone class="text-base" />}
        onClick={() => setState("submitting")}
      >
        Open re-sign pull request
      </Button>
    </div>
  );
}

type StepStatus = "waiting" | "working" | "done";

const STEP_STATUS_CLASS: Record<StepStatus, string> = {
  waiting: "text-muted",
  working: "text-ink2",
  done: "text-accent-dk",
};
const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  waiting: "waiting",
  working: "working…",
  done: "done",
};

function useStepAnimation(steps: number): StepStatus[] {
  const statuses = useSignal<StepStatus[]>(Array(steps).fill("waiting"));
  useEffect(() => {
    statuses.value = Array(steps).fill("waiting");
    const timers: number[] = [];
    const timings = [320, 700, 500, 600, 550];
    let t = 120;
    for (let i = 0; i < steps; i++) {
      const start = t;
      const end = t + (timings[i] ?? 500);
      timers.push(
        setTimeout(() => {
          const next = [...statuses.value];
          next[i] = "working";
          statuses.value = next;
        }, start) as unknown as number,
      );
      timers.push(
        setTimeout(() => {
          const next = [...statuses.value];
          next[i] = "done";
          statuses.value = next;
        }, end) as unknown as number,
      );
      t = end;
    }
    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [steps]);
  return statuses.value;
}

function StepList(
  { steps, statuses }: { steps: string[]; statuses: StepStatus[] },
) {
  return (
    <ol class="space-y-2 text-sm font-mono">
      {steps.map((label, i) => {
        const status = statuses[i] ?? "waiting";
        return (
          <li
            key={label}
            class="flex items-center gap-3 p-2.5 border-2 border-ink bg-paper"
          >
            <StepDot status={status} />
            <span class="flex-1 text-ink2">{label}</span>
            <span class={`text-xs ${STEP_STATUS_CLASS[status]}`}>
              {STEP_STATUS_LABEL[status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width={3}
        class="text-accent-dk"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return <span class="w-2 h-2 bg-ink" />;
}

function Submitting() {
  const user = useUser();
  const { owner, repo } = useCLA();
  const upstream = `${owner}/${repo}`;
  const steps = [
    `Fork ${upstream} → ${user.login}/${repo}`,
    `Write .cla-signatures/${user.login}.md`,
    "Sign commit with GitHub web-flow key",
    `Open PR → ${upstream}`,
  ];
  const statuses = useStepAnimation(steps.length);
  const allDone = statuses.every((s) => s === "done");
  return (
    <div class="animate-fade-up">
      <Eyebrow class="mb-3 block">Opening pull request</Eyebrow>
      <StepList steps={steps} statuses={statuses} />
      <p class="mt-4 text-xs text-muted leading-relaxed">
        {allDone
          ? "Pull request opened. A maintainer will review and merge."
          : "Orchestrating the fork + commit + PR."}
      </p>
    </div>
  );
}

const STUB_PR = { number: 3247, date: "April 19, 2026", commit: "8f3ca91d" };

function Signed({ setState }: { setState: (s: CardState) => void }) {
  const user = useUser();
  const { cla, owner, repo } = useCLA();
  const upstream = `${owner}/${repo}`;
  return (
    <div class="animate-fade-up">
      <div class="mb-5 border-2 border-ink overflow-hidden">
        <div class="px-4 py-2.5 bg-ink text-paper flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs">
            <PiGitPullRequestDuotone class="text-base text-[#8FE0B3]" />
            <span class="font-mono">{upstream}#{STUB_PR.number}</span>
          </div>
          <a
            href="#"
            class="text-paper/70 hover:text-paper transition-colors"
            aria-label="View on GitHub"
          >
            <PiGithubLogoDuotone class="text-xl" />
          </a>
        </div>
        <div class="px-4 py-3 bg-paper">
          <div class="text-sm text-ink font-medium">
            chore(cla): sign v{cla.version} as{" "}
            <span class="font-mono">{user.handle}</span>
          </div>
          <div class="mt-2 flex items-center gap-3 text-xs text-muted font-mono">
            <span class="inline-flex items-center gap-1">
              <PiSealCheckDuotone class="text-sm text-ok" />
              Verified
            </span>
            <span>·</span>
            <span>{STUB_PR.date}</span>
          </div>
        </div>
      </div>

      <Eyebrow class="mb-2 block">Thank you</Eyebrow>
      <h3 class="font-display text-3xl leading-tight text-ink">
        Signature <em class="italic">merged</em>.
      </h3>
      <p class="mt-3 text-sm text-ink2 leading-relaxed">
        Your signature file is on{" "}
        <span class="font-mono text-ink">main</span>. Frontmatter validated,
        commit verified, merged by a maintainer. You're cleared to contribute to
        {" "}
        {cla.name}.
      </p>

      <div class="mt-5 border-2 border-ink bg-paper overflow-hidden">
        <div class="px-4 py-2 border-b-2 border-ink flex items-center justify-between">
          <Eyebrow class="text-muted">Artifact</Eyebrow>
          <span class="font-mono text-xs text-muted">{upstream}@main</span>
        </div>
        <dl class="px-4 py-3 text-xs">
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">File</dt>
            <dd class="font-mono text-ink text-right">
              .cla-signatures/{user.login}.md
            </dd>
          </div>
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">Author</dt>
            <dd class="font-mono text-ink">{user.handle}</dd>
          </div>
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">Commit</dt>
            <dd class="font-mono text-ink">{STUB_PR.commit} · verified</dd>
          </div>
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">Agreement</dt>
            <dd class="text-ink">{cla.name} CLA v{cla.version}</dd>
          </div>
          <div class="py-2 flex justify-between">
            <dt class="text-muted">Status</dt>
            <dd class="text-ink">Merged to main</dd>
          </div>
        </dl>
      </div>

      <div class="mt-5 flex items-center gap-2">
        <Button asChild variant="ghost" class="flex-1 px-4 py-2.5 text-sm">
          <a href="#">View pull request</a>
        </Button>
        <button
          type="button"
          class="px-4 py-2.5 text-xs text-muted hover:text-ink transition-colors"
        >
          View signature file →
        </button>
      </div>

      <div class="mt-4 pt-4 border-t-2 border-ink/10 flex items-center justify-between text-xs">
        <span class="text-muted">Changed your mind?</span>
        <button
          type="button"
          class="text-muted hover:text-ink underline underline-offset-2 transition-colors"
          onClick={() => setState("revoke")}
        >
          Revoke signature
        </button>
      </div>
    </div>
  );
}

function Revoke({ setState }: { setState: (s: CardState) => void }) {
  const user = useUser();
  const agreed = useSignal(false);
  const reason = useSignal("");
  return (
    <div class="animate-fade-up">
      <p class="text-sm text-ink2 leading-snug mb-4">
        Revoking opens a pull request that{" "}
        <span class="font-mono text-ink">deletes</span> your signature file.
      </p>

      <ul class="space-y-2 text-sm text-ink2 leading-snug mb-5">
        <li class="flex gap-2">
          <span class="text-muted mt-[3px]">-</span>
          <span>
            Past contributions remain licensed under the version you signed.
            That grant is perpetual and cannot be withdrawn.
          </span>
        </li>
        <li class="flex gap-2">
          <span class="text-muted mt-[3px]">-</span>
          <span>
            Future pull requests from{" "}
            <span class="font-mono text-ink">{user.handle}</span>{" "}
            will be blocked by CI until you sign again.
          </span>
        </li>
        <li class="flex gap-2">
          <span class="text-muted mt-[3px]">-</span>
          <span>
            Git history preserves your original signature for audit - the file
            is only absent from the current tree.
          </span>
        </li>
      </ul>

      <div class="mb-4">
        <label class="mb-2 flex items-center justify-between">
          <Eyebrow class="text-muted">Reason</Eyebrow>
          <span class="text-muted2 font-serif text-xs">optional</span>
        </label>
        <textarea
          maxLength={200}
          rows={2}
          placeholder="e.g. Project no longer aligns with my open source priorities."
          class="w-full px-3 py-2 border-2 border-ink bg-paper text-sm text-ink placeholder:text-muted2 focus:outline-none focus:ring-2 focus:ring-yellow resize-none font-serif leading-snug"
          value={reason.value}
          onInput={(
            e,
          ) => (reason.value = (e.currentTarget as HTMLTextAreaElement).value)}
        />
        <div class="mt-1 flex items-center justify-between text-xs text-muted2 font-mono">
          <span>Posted to the PR body (not stored in the signature file).</span>
          <span>{reason.value.length}/200</span>
        </div>
      </div>

      <div class="mb-5 p-3 border-2 border-ink bg-paper2/50">
        <Eyebrow class="text-muted mb-2 block">Diff preview</Eyebrow>
        <pre class="m-0 text-xs leading-snug font-mono text-warn">
          &minus; .cla-signatures/{user.login}.md
        </pre>
      </div>

      <Switch
        checked={agreed}
        label="Yes, I want to revoke my signature."
      />

      <Button
        class="w-full px-4 py-3 text-sm"
        disabled={!agreed.value}
        icon={<PiGitPullRequestDuotone class="text-base" />}
        onClick={() => setState("revoking")}
      >
        Open revocation pull request
      </Button>

      <div class="mt-4 text-center">
        <button
          type="button"
          class="text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors"
          onClick={() => setState("signed")}
        >
          Cancel, keep signature
        </button>
      </div>
    </div>
  );
}

function Revoking() {
  const user = useUser();
  const { cla, owner, repo } = useCLA();
  const upstream = `${owner}/${repo}`;
  const steps = [
    `Delete .cla-signatures/${user.login}.md`,
    "Sign commit with GitHub web-flow key",
    `Open PR → ${upstream}`,
  ];
  const statuses = useStepAnimation(steps.length);
  const allDone = statuses.every((s) => s === "done");
  return (
    <div class="animate-fade-up">
      <Eyebrow class="mb-3 block">Opening revocation pull request</Eyebrow>
      <StepList steps={steps} statuses={statuses} />
      <p class="mt-4 text-xs text-muted leading-relaxed">
        {allDone
          ? `Revocation PR opened. Past contributions stay licensed under v${cla.version} - that grant can't be withdrawn.`
          : `Preparing the delete. Your past contributions stay licensed under v${cla.version} - that grant can't be withdrawn.`}
      </p>
    </div>
  );
}

function ChangesDialog(
  { dialogRef }: { dialogRef: preact.Ref<HTMLDialogElement> },
) {
  const user = useUser();
  const { cla } = useCLA();
  return (
    <Dialog
      dialogRef={dialogRef}
      id="changesDialog"
      class="max-w-[640px] w-[92vw]"
    >
      <div class="bg-paper">
        <DialogHead
          eyebrow="Changes"
          title={`.cla-signatures/${user.login}.md`}
        />

        <div class="px-5 py-3 border-b-2 border-ink flex items-center gap-4 text-xs text-ink2 font-mono">
          <span class="inline-flex items-center gap-1.5">
            <span class="w-2 h-2 bg-ok"></span>new file
          </span>
          <span>·</span>
          <span>+14 lines</span>
          <span class="ml-auto inline-flex items-center gap-1.5 font-bold">
            <PiSealCheckDuotone class="text-sm text-ok" />
            signed by GitHub web-flow
          </span>
        </div>

        <pre class="m-0 p-4 text-xs leading-relaxed bg-ink text-paper overflow-x-auto font-mono">
          <span class="text-muted2">---</span>
          {"\n"}
          <span class="text-[#9BB7E5]">agreement_version:</span>{" "}
          <span class="text-yellow">"{cla.version}"</span>
          {"\n"}
          <span class="text-[#9BB7E5]">client:</span> sigil@0.1.0
          {"\n"}
          <span class="text-muted2">---</span>
          {"\n\n"}
          I, {user.handle}, agree to the following {cla.name}{" "}
          Contributor License Agreement, version {cla.version}.
          {"\n\n"}
          <span class="text-muted2">---</span>
          {"\n\n"}
          <span class="text-muted2">
            …full CLA body captured at time of signing…
          </span>
        </pre>

        <div class="px-5 py-3 border-t-2 border-ink flex items-center justify-between text-xs">
          <span class="font-mono text-ink2">
            chore(cla): sign v{cla.version}
          </span>
          <form method="dialog">
            <button
              type="submit"
              class="px-3 py-1.5 text-xs border-2 border-ink bg-paper shadow-sm hover:bg-yellow transition-colors font-semibold"
            >
              Close
            </button>
          </form>
        </div>
      </div>
    </Dialog>
  );
}

function CompareDialog(
  { dialogRef }: { dialogRef: preact.Ref<HTMLDialogElement> },
) {
  const { cla } = useCLA();
  const prev = STUB_PREVIOUS;
  return (
    <Dialog
      dialogRef={dialogRef}
      id="compareDialog"
      class="max-w-[760px] w-[92vw]"
    >
      <div class="bg-paper">
        <DialogHead
          eyebrow="Amendment"
          title={`${cla.name} CLA - v${prev.version} → v${cla.version}`}
        />

        <div class="px-5 py-3 border-b-2 border-ink flex items-center gap-4 text-xs text-muted">
          <span>
            <span class="font-mono text-ink2">v{prev.version}</span>
            &nbsp;· {prev.previousEffectiveDate}
          </span>
          <span class="w-1 h-1 bg-ink"></span>
          <span>
            <span class="font-mono text-ink2">v{cla.version}</span>
          </span>
          <span class="ml-auto font-mono text-xs">1 clause changed</span>
        </div>

        <div class="grid grid-cols-2">
          <div class="p-5 border-r-2 border-ink">
            <Eyebrow class="text-muted mb-3 block">
              v{prev.version} · before
            </Eyebrow>
            <ClauseDiff
              num={prev.clauseDiff.num}
              text={prev.clauseDiff.before}
            />
          </div>
          <div class="p-5 bg-paper2/40">
            <Eyebrow class="text-muted mb-3 block">
              v{cla.version} · after
            </Eyebrow>
            <ClauseDiff
              num={prev.clauseDiff.num}
              text={prev.clauseDiff.after}
            />
          </div>
        </div>

        <div class="px-5 py-3 border-t-2 border-ink flex items-center justify-between text-xs text-muted">
          <span>Stub diff - real clause-level diff comes later.</span>
          <form method="dialog">
            <button
              type="submit"
              class="px-3 py-1.5 text-xs border-2 border-ink bg-paper shadow-sm hover:bg-yellow transition-colors font-semibold"
            >
              Close
            </button>
          </form>
        </div>
      </div>
    </Dialog>
  );
}

function ClauseDiff({ num, text }: { num: number; text: string }) {
  return (
    <div class="font-serif text-sm text-ink leading-relaxed relative pl-14">
      <span class="absolute left-0 -top-[0.05em] font-display text-3xl leading-none tracking-tight text-ink">
        {num}
      </span>
      <p>{text}</p>
    </div>
  );
}
