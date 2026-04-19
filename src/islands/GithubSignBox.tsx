import { type Signal, useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { withQueryClientProvider } from "@/lib/query-client.tsx";
import { CLAProvider, type ParsedCLA, useCLA } from "@/lib/cla.tsx";
import { type AgreementRow, signaturePath } from "@/lib/agreement.ts";
import type { Auth } from "@/lib/sessions.ts";
import {
  type AgreementTarget,
  postAccept,
  postRefresh,
  postRevoke,
  useAgreementStatus,
} from "@/islands/useAgreementStatus.ts";
import { Button } from "@/components/button.tsx";
import { Eyebrow } from "@/components/eyebrow.tsx";
import { Switch } from "@/components/switch.tsx";
import {
  Card,
  CardBody,
  CardHead,
  type CardState,
} from "@/components/card.tsx";
import { Banner } from "@/components/banner.tsx";
import {
  PiArrowClockwiseBold,
  PiCheckBold,
  PiGithubLogoDuotone,
  PiGitPullRequestDuotone,
  PiSealCheckDuotone,
  PiSpinnerGapDuotone,
  PiTrashDuotone,
  PiWarningOctagonDuotone,
  PiXBold,
} from "@preact-icons/pi";

// -- UI states derived from AgreementRow -----------------------------------

interface ViewCheckingState {
  view: "checking";
}
interface ViewLoggedInState {
  view: "loggedIn";
}
interface ViewResignNeededState {
  view: "resignNeeded";
  signedVersion: string;
}
interface ViewSubmittingState {
  view: "submitting";
  kind: "accept";
  step: WorkingStep;
  /** null during `step: "init"` - no fork yet. */
  branch: string | null;
  fork: { ownerLogin: string; repoName: string; defaultBranch: string } | null;
}
interface ViewRevokingState {
  view: "revoking";
  kind: "revoke";
  step: WorkingStep;
  branch: string | null;
  fork: { ownerLogin: string; repoName: string; defaultBranch: string } | null;
  reason: string;
}
interface ViewPendingState {
  view: "pending";
  pr: PendingPr;
}
interface ViewSignedState {
  view: "signed";
  merged: MergedInfo;
}

type WorkingStep =
  | "init"
  | "syncing"
  | "branching"
  | "writing"
  | "opening_pr";
type PendingPr = Extract<AgreementRow, { step: "pending" }>["pr"];
type MergedInfo = Extract<AgreementRow, { kind: "signed" }>["merged"];

type DerivedView =
  | ViewCheckingState
  | ViewLoggedInState
  | ViewResignNeededState
  | ViewSubmittingState
  | ViewRevokingState
  | ViewPendingState
  | ViewSignedState;

function deriveView(row: AgreementRow): DerivedView {
  switch (row.kind) {
    case "loading":
      return { view: "checking" };
    case "unsigned":
      return { view: "loggedIn" };
    case "signed":
      return row.status === "current"
        ? { view: "signed", merged: row.merged }
        : { view: "resignNeeded", signedVersion: row.signedVersion };
    case "accept":
      if (row.step === "pending") return { view: "pending", pr: row.pr };
      return {
        view: "submitting",
        kind: "accept",
        step: row.step,
        branch: row.step === "init" ? null : row.branch,
        fork: row.step === "init" ? null : row.fork,
      };
    case "revoke":
      if (row.step === "pending") return { view: "pending", pr: row.pr };
      return {
        view: "revoking",
        kind: "revoke",
        step: row.step,
        branch: row.step === "init" ? null : row.branch,
        fork: row.step === "init" ? null : row.fork,
        reason: row.reason,
      };
  }
}

function cardStateFor(view: DerivedView, reviewingRevoke: boolean): CardState {
  if (reviewingRevoke && view.view === "signed") return "revoke";
  switch (view.view) {
    case "checking":
      return "checking";
    case "loggedIn":
      return "loggedIn";
    case "resignNeeded":
      return "resignNeeded";
    case "submitting":
      return "submitting";
    case "pending":
      return "pending";
    case "signed":
      return "signed";
    case "revoking":
      return "revoking";
  }
}

const META: Record<CardState, { title: preact.JSX.Element }> = {
  checking: {
    title: (
      <>
        Checking <em>signature</em>…
      </>
    ),
  },
  loggedOut: {
    title: (
      <>
        Sign <em>CLA</em>
      </>
    ),
  },
  loggedIn: {
    title: (
      <>
        Sign <em>CLA</em>
      </>
    ),
  },
  resignNeeded: {
    title: (
      <>
        Please <em>re-sign</em>
      </>
    ),
  },
  submitting: {
    title: (
      <>
        Opening pull <em>request</em>…
      </>
    ),
  },
  pending: {
    title: (
      <>
        Awaiting <em>review</em>
      </>
    ),
  },
  signed: {
    title: <em>Signed</em>,
  },
  revoke: {
    title: (
      <>
        Withdraw <em>signature</em>
      </>
    ),
  },
  revoking: {
    title: (
      <>
        Opening revocation&nbsp;<em>PR</em>…
      </>
    ),
  },
};

// -- user helpers ----------------------------------------------------------

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

// -- props + root ----------------------------------------------------------

interface GithubSignBoxProps {
  auth: Auth;
  cla: ParsedCLA;
  target: { forge: string; owner: string; repo: string };
}

function SignBox(props: GithubSignBoxProps) {
  const target: AgreementTarget = {
    owner: props.target.owner,
    repo: props.target.repo,
    handle: props.auth.login,
  };
  const query = useAgreementStatus(target);
  const row: AgreementRow = query.data ?? { kind: "loading" };
  const reviewingRevoke = useSignal(false);
  const revokeReason = useSignal("");

  const view = deriveView(row);
  // Leave the revoke-confirm UI if the server-side state has already flipped.
  useEffect(() => {
    if (view.view !== "signed") {
      reviewingRevoke.value = false;
    }
  }, [view.view]);
  const currentState = cardStateFor(view, reviewingRevoke.value);
  const user = toDisplayUser(props.auth);

  const startRevokeReview = () => {
    revokeReason.value = "";
    reviewingRevoke.value = true;
  };
  const cancelRevokeReview = () => {
    reviewingRevoke.value = false;
  };
  const confirmRevoke = async () => {
    try {
      await postRevoke(target, revokeReason.value);
      // Don't clear `reviewingRevoke` here - the POST returns 202 before the
      // server writes the `revoke working` row, and clearing now would flash
      // the `signed` view back in until the ws catches up. The reactive
      // effect above drops the flag once `view.view` is no longer `signed`.
    } catch {
      reviewingRevoke.value = false;
    }
  };

  const meta = META[currentState];
  const headEm = currentState === "submitting"
    ? "[&_em]:not-italic [&_em]:bg-ink [&_em]:text-yellow [&_em]:px-1"
    : "[&_em]:not-italic";

  return (
    <CLAProvider
      value={{
        cla: props.cla,
        forge: props.target.forge,
        owner: props.target.owner,
        repo: props.target.repo,
      }}
    >
      <Card id="signCard" state={currentState}>
        <CardHead>
          <div>
            <div
              class={`font-display text-3xl leading-none tracking-tight ${headEm}`}
            >
              {meta.title}
            </div>
          </div>
          <div class="text-right">
            <Eyebrow class="opacity-80">Ver.</Eyebrow>
            <div class="font-display text-xl leading-none mt-1">
              {props.cla.version}
            </div>
          </div>
        </CardHead>
        <CardBody>
          <StateBody
            view={view}
            user={user}
            target={target}
            reviewingRevoke={reviewingRevoke.value}
            revokeReason={revokeReason}
            startRevokeReview={startRevokeReview}
            cancelRevokeReview={cancelRevokeReview}
            confirmRevoke={confirmRevoke}
          />
        </CardBody>
      </Card>
    </CLAProvider>
  );
}

interface StateBodyProps {
  view: DerivedView;
  user: DisplayUser;
  target: AgreementTarget;
  reviewingRevoke: boolean;
  revokeReason: Signal<string>;
  startRevokeReview: () => void;
  cancelRevokeReview: () => void;
  confirmRevoke: () => void;
}

function StateBody(props: StateBodyProps) {
  const { view, user, target, reviewingRevoke } = props;
  if (reviewingRevoke && view.view === "signed") {
    return (
      <Revoke
        reason={props.revokeReason}
        onCancel={props.cancelRevokeReview}
        onConfirm={props.confirmRevoke}
      />
    );
  }
  switch (view.view) {
    case "checking":
      return <Checking />;
    case "loggedIn":
      return <LoggedIn user={user} target={target} />;
    case "resignNeeded":
      return (
        <ResignNeeded
          user={user}
          target={target}
          signedVersion={view.signedVersion}
        />
      );
    case "submitting":
      return (
        <Submitting
          user={user}
          step={view.step}
          branch={view.branch}
          fork={view.fork}
        />
      );
    case "revoking":
      return (
        <Revoking
          user={user}
          step={view.step}
          branch={view.branch}
          fork={view.fork}
        />
      );
    case "pending":
      return <Pending user={user} target={target} pr={view.pr} />;
    case "signed":
      return (
        <Signed
          user={user}
          target={target}
          merged={view.merged}
          onRevoke={props.startRevokeReview}
        />
      );
  }
}

// -- subviews --------------------------------------------------------------

function Checking() {
  return (
    <div class="animate-fade-up flex items-center gap-3 py-6 text-sm text-ink2">
      <PiSpinnerGapDuotone class="text-xl animate-spin" />
      <span>Looking up your signature on the repo…</span>
    </div>
  );
}

function Identity(
  { user, extra }: { user: DisplayUser; extra?: preact.ComponentChildren },
) {
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
  { user, target }: {
    user: DisplayUser;
    target: AgreementTarget;
  },
) {
  const agreed = useSignal(false);
  const submitting = useSignal(false);

  const onClick = async () => {
    submitting.value = true;
    try {
      await postAccept(target);
    } catch {
      submitting.value = false;
    }
    // On success, socket will flip to "submitting" view; leaving `submitting`
    // true keeps the button disabled until the UI transitions.
  };

  return (
    <div class="animate-fade-up">
      <Identity
        user={user}
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

      <Switch
        checked={agreed}
        label="I have read and agree to the agreement."
      />

      <Button
        class="w-full py-3.5 text-sm"
        disabled={!agreed.value || submitting.value}
        icon={submitting.value
          ? <PiSpinnerGapDuotone class="text-base animate-spin" />
          : <PiGitPullRequestDuotone class="text-base" />}
        onClick={onClick}
      >
        {submitting.value
          ? "Opening pull request…"
          : "Open signed pull request"}
      </Button>

      <div class="mt-4 pt-4 border-t-2 border-ink/10 flex items-center justify-end text-xs">
        <RefreshButton target={target} />
      </div>
    </div>
  );
}

function ResignNeeded(
  { user, target, signedVersion }: {
    user: DisplayUser;
    target: AgreementTarget;
    signedVersion: string;
  },
) {
  const { cla } = useCLA();
  const agreed = useSignal(false);
  const submitting = useSignal(false);
  const onClick = async () => {
    submitting.value = true;
    try {
      await postAccept(target);
    } catch {
      submitting.value = false;
    }
  };

  return (
    <div class="animate-fade-up">
      <Banner
        icon={<PiWarningOctagonDuotone />}
        kicker="Signature is out of date."
        footer={
          <span class="font-mono">v{signedVersion} → v{cla.version}</span>
        }
      >
        You signed an earlier version of this agreement. Please review and sign
        again.
      </Banner>

      <Identity user={user} />

      <Switch
        checked={agreed}
        label={`I have re-read and agree to version ${cla.version}.`}
        sublabel="Your previous signature file will be overwritten."
      />

      <Button
        class="w-full py-3.5 text-sm"
        disabled={!agreed.value || submitting.value}
        icon={<PiGitPullRequestDuotone class="text-base" />}
        onClick={onClick}
      >
        Open re-sign pull request
      </Button>
    </div>
  );
}

// Server-side flow step index in the 4-step list. `init` and `syncing` both
// map to index 0 - the first item is the one that "spins" while we're
// getting the fork ready.
const STEP_INDEX: Record<WorkingStep, number> = {
  init: 0,
  syncing: 0,
  branching: 1,
  writing: 2,
  opening_pr: 3,
};

type StepStatus = "waiting" | "working" | "done" | "failed";

function statusesForStep(step: WorkingStep): StepStatus[] {
  const idx = STEP_INDEX[step];
  return [0, 1, 2, 3].map((i) => {
    if (i < idx) return "done";
    if (i === idx) return "working";
    return "waiting";
  });
}

const STEP_STATUS_CLASS: Record<StepStatus, string> = {
  waiting: "text-muted",
  working: "text-ink2",
  done: "text-accent-dk",
  failed: "text-warn",
};
const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  waiting: "waiting",
  working: "working…",
  done: "done",
  failed: "failed",
};

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
  if (status === "done") return <PiCheckBold class="text-accent-dk text-xs" />;
  if (status === "failed") return <PiXBold class="text-warn text-xs" />;
  return <span class="w-2 h-2 bg-ink" />;
}

function Submitting(
  { user, step, branch, fork }: {
    user: DisplayUser;
    step: WorkingStep;
    branch: string | null;
    fork:
      | { ownerLogin: string; repoName: string; defaultBranch: string }
      | null;
  },
) {
  const { owner, repo } = useCLA();
  const upstream = `${owner}/${repo}`;
  const statuses = statusesForStep(step);
  const steps = [
    fork
      ? `Fork ${upstream} → ${fork.ownerLogin}/${fork.repoName}`
      : `Fork ${upstream}`,
    branch ? `Create ${branch} branch on fork` : "Create branch on fork",
    `Commit ${signaturePath(user.login)} (web-flow signed)`,
    `Open PR → ${upstream}`,
  ];
  return (
    <div class="animate-fade-up">
      <Eyebrow class="mb-3 block">Opening pull request</Eyebrow>
      <StepList steps={steps} statuses={statuses} />
      <p class="mt-4 text-xs text-muted leading-relaxed">
        Orchestrating the fork + commit + PR.
      </p>
    </div>
  );
}

function Revoking(
  { user, step, branch, fork }: {
    user: DisplayUser;
    step: WorkingStep;
    branch: string | null;
    fork:
      | { ownerLogin: string; repoName: string; defaultBranch: string }
      | null;
  },
) {
  const { cla, owner, repo } = useCLA();
  const upstream = `${owner}/${repo}`;
  const statuses = statusesForStep(step);
  const steps = [
    fork
      ? `Fork ${upstream} → ${fork.ownerLogin}/${fork.repoName}`
      : `Fork ${upstream}`,
    branch ? `Create ${branch} branch on fork` : "Create branch on fork",
    `Delete ${signaturePath(user.login)} (web-flow signed)`,
    `Open PR → ${upstream}`,
  ];
  return (
    <div class="animate-fade-up">
      <Eyebrow class="mb-3 block">Opening revocation pull request</Eyebrow>
      <StepList steps={steps} statuses={statuses} />
      <p class="mt-4 text-xs text-muted leading-relaxed">
        Preparing the delete. Past contributions stay licensed under v{cla
          .version} - that grant can't be withdrawn.
      </p>
    </div>
  );
}

function describeMergeableState(state: string): string {
  switch (state) {
    case "clean":
      return "Ready to merge - waiting on a maintainer.";
    case "blocked":
      return "Blocked by required reviews or branch protection.";
    case "behind":
      return "Behind the base branch - update required.";
    case "dirty":
      return "Has merge conflicts.";
    case "unstable":
      return "CI checks running or failing.";
    case "draft":
      return "Draft pull request.";
    case "unknown":
    case "":
      return "GitHub is still computing mergeability.";
    default:
      return state;
  }
}

function Pending(
  { user, target, pr }: {
    user: DisplayUser;
    target: AgreementTarget;
    pr: PendingPr;
  },
) {
  const { owner, repo } = useCLA();
  const upstream = `${owner}/${repo}`;
  const status = describeMergeableState(pr.mergeableState);
  const isRevoke = pr.kind === "revoke";
  return (
    <div class="animate-fade-up">
      <div class="mb-5 border-2 border-ink overflow-hidden">
        <div class="px-4 py-2.5 bg-ink text-paper flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs">
            <PiGitPullRequestDuotone
              class={`text-base ${isRevoke ? "text-revoke" : "text-yellow"}`}
            />
            <span class="font-mono">{upstream}#{pr.number}</span>
          </div>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="text-paper/70 hover:text-paper transition-colors"
            aria-label="View on GitHub"
          >
            <PiGithubLogoDuotone class="text-xl" />
          </a>
        </div>
        <div class="px-4 py-3 bg-paper">
          <div class="text-sm text-ink font-medium">
            {isRevoke ? "Revocation" : "Signature"} PR from{" "}
            <span class="font-mono">{user.handle}</span>
          </div>
          <div class="mt-2 text-xs text-muted font-mono">
            {isRevoke ? "− " : ""}
            {signaturePath(user.login)}
          </div>
        </div>
      </div>

      <div class="mb-2 flex items-center justify-between">
        <Eyebrow>Status</Eyebrow>
        <RefreshButton target={target} />
      </div>
      <p class="text-sm text-ink2 leading-relaxed mb-5">{status}</p>

      <p class="text-xs text-muted leading-relaxed mb-5">
        A maintainer of <span class="font-mono text-ink">{upstream}</span>{" "}
        needs to review and merge this pull request. This page will update once
        they do.
      </p>

      <Button asChild variant="ghost" class="w-full px-4 py-2.5 text-sm">
        <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer">
          View pull request →
        </a>
      </Button>
    </div>
  );
}

function RefreshButton({ target }: { target: AgreementTarget }) {
  const busy = useSignal(false);
  const onClick = async () => {
    if (busy.value) return;
    busy.value = true;
    try {
      await postRefresh(target);
    } catch {
      // Surface a quieter failure: the ws will eventually catch up anyway.
    } finally {
      busy.value = false;
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy.value}
      class="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-eyebrow text-muted hover:text-ink transition-colors disabled:opacity-50"
      aria-label="Refresh"
    >
      <PiArrowClockwiseBold
        class={`text-sm ${busy.value ? "animate-spin" : ""}`}
      />
      Refresh
    </button>
  );
}

function formatSignedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function Signed(
  { user, target, merged, onRevoke }: {
    user: DisplayUser;
    target: AgreementTarget;
    merged: MergedInfo;
    onRevoke: () => void;
  },
) {
  const { cla } = useCLA();
  const prHref = merged.prHtmlUrl ?? merged.commitUrl;
  const dateLabel = formatSignedDate(merged.commitDate);

  return (
    <div class="animate-fade-up">
      <div class="mb-5 border-2 border-ink overflow-hidden">
        <div class="px-4 py-2.5 bg-ink text-paper flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs min-w-0">
            <PiGitPullRequestDuotone class="text-base text-[#8FE0B3] shrink-0" />
            <span class="font-mono truncate">
              chore(cla): sign {cla.name} v{cla.version} as {user.handle}
            </span>
          </div>
          <a
            href={prHref}
            target="_blank"
            rel="noopener noreferrer"
            class="text-paper/70 hover:text-paper transition-colors shrink-0"
            aria-label="View on GitHub"
          >
            <PiGithubLogoDuotone class="text-xl" />
          </a>
        </div>
        <div class="px-4 py-3 bg-paper">
          <div class="flex items-center gap-3 text-xs text-muted font-mono">
            {merged.verified && (
              <>
                <span class="inline-flex items-center gap-1">
                  <PiSealCheckDuotone class="text-sm text-ok" />
                  Verified
                </span>
                <span>·</span>
              </>
            )}
            <span>{dateLabel}</span>
          </div>
        </div>
      </div>

      <div class="mt-5 flex items-center gap-2">
        <Button asChild class="flex-1 px-4 py-2.5 text-sm">
          <a href={merged.fileUrl} target="_blank" rel="noopener noreferrer">
            View signature
          </a>
        </Button>
        {merged.prHtmlUrl && (
          <a
            href={merged.prHtmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="px-4 py-2.5 text-xs text-muted hover:text-ink transition-colors"
          >
            View pull request →
          </a>
        )}
      </div>

      <div class="mt-4 pt-4 border-t-2 border-ink/10 flex items-center justify-between text-xs">
        <RefreshButton target={target} />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-muted hover:text-ink underline underline-offset-2 transition-colors"
          onClick={onRevoke}
        >
          <PiTrashDuotone class="text-sm no-underline" />
          Revoke signature
        </button>
      </div>
    </div>
  );
}

function Revoke(
  { reason, onCancel, onConfirm }: {
    reason: Signal<string>;
    onCancel: () => void;
    onConfirm: () => void;
  },
) {
  const agreed = useSignal(false);
  const submitting = useSignal(false);
  const confirm = async () => {
    submitting.value = true;
    try {
      await onConfirm();
    } catch {
      submitting.value = false;
    }
  };
  return (
    <div class="animate-fade-up">
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
        <div class="mt-1 flex items-center justify-end text-xs text-muted2 font-mono">
          <span>{reason.value.length}/200</span>
        </div>
      </div>

      <Switch
        checked={agreed}
        label="Yes, I want to revoke my signature."
      />

      <Button
        class="w-full px-4 py-3 text-sm"
        disabled={!agreed.value || submitting.value}
        icon={<PiGitPullRequestDuotone class="text-base" />}
        onClick={confirm}
      >
        Open revocation pull request
      </Button>

      <div class="mt-4 text-center">
        <button
          type="button"
          class="text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors"
          onClick={onCancel}
        >
          Cancel, keep signature
        </button>
      </div>
    </div>
  );
}

export default withQueryClientProvider(SignBox);
