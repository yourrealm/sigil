import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

type CardState =
  | "loggedOut"
  | "loggedIn"
  | "resignNeeded"
  | "submitting"
  | "signed"
  | "revoke"
  | "revoking";

const STATES: CardState[] = [
  "loggedOut",
  "loggedIn",
  "resignNeeded",
  "submitting",
  "signed",
  "revoke",
  "revoking",
];

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

interface Demo {
  project: string;
  upstream: string;
  currentVersion: string;
  previousVersion: string;
  effectiveDate: string;
  user: {
    handle: string;
    login: string;
    name: string;
    initials: string;
    previousSignedDate: string;
  };
  demoPR: { number: number; date: string; commit: string };
}

const DEMO: Demo = {
  project: "Realm",
  upstream: "yourrealm/realm",
  currentVersion: "2.1",
  previousVersion: "1.3",
  effectiveDate: "MAR 4, 2026",
  user: {
    handle: "@benjick",
    login: "benjick",
    name: "Benjamin Jick",
    initials: "bj",
    previousSignedDate: "Jun 14, 2025",
  },
  demoPR: { number: 3247, date: "April 19, 2026", commit: "8f3ca91d" },
};

export default function SignBox() {
  const state = useSignal<CardState>("loggedOut");
  const agreed = useSignal(false);
  const reason = useSignal("");
  const changesRef = useRef<HTMLDialogElement | null>(null);
  const compareRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cla-state") as CardState | null;
    if (saved && STATES.includes(saved)) state.value = saved;

    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.matches("input, textarea") || tgt.isContentEditable)) {
        return;
      }
      const map: Record<string, CardState> = {
        "1": "loggedOut",
        "2": "loggedIn",
        "3": "resignNeeded",
        "4": "submitting",
        "5": "signed",
        "6": "revoke",
        "7": "revoking",
      };
      if (map[e.key]) setState(map[e.key]);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function setState(next: CardState) {
    state.value = next;
    agreed.value = false;
    reason.value = "";
    localStorage.setItem("cla-state", next);
  }

  const meta = META[state.value];

  return (
    <>
      <DevBar current={state.value} onPick={setState} />

      <div
        id="signCard"
        class="ruled-card overflow-hidden"
        data-card-state={state.value}
      >
        <div class="ruled-head px-6 pt-5 pb-5 flex items-start justify-between gap-4">
          <div>
            <div class="eyebrow mb-2">{meta.eyebrow}</div>
            <div class="deed-label">{meta.title}</div>
          </div>
          <div class="text-right mt-1">
            <div class="eyebrow">Ver.</div>
            <div class="ver-num mt-1">{DEMO.currentVersion}</div>
          </div>
        </div>

        <div class="p-6">
          <StateBody
            state={state.value}
            agreed={agreed}
            reason={reason}
            setState={setState}
            openChanges={() => changesRef.current?.showModal()}
            openCompare={() => compareRef.current?.showModal()}
          />
        </div>
      </div>

      <dialog
        ref={changesRef}
        id="changesDialog"
        class="max-w-[640px] w-[92vw]"
      >
        <div class="bg-paper">
          <div class="dialog-title-bar px-5 py-4 flex items-center justify-between">
            <div>
              <div class="eyebrow mb-1">Changes</div>
              <div class="font-display text-[22px] leading-none">
                .cla-signatures/{DEMO.user.login}.md
              </div>
            </div>
            <form method="dialog">
              <button
                type="submit"
                class="w-8 h-8 grid place-items-center hover:bg-yellow hover:text-ink transition-colors"
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width={2.5}
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </form>
          </div>

          <div class="px-5 py-3 border-b-2 border-ink flex items-center gap-4 text-[12px] text-ink2 font-mono">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2 h-2 bg-ok"></span>new file
            </span>
            <span>·</span>
            <span>+14 lines</span>
            <span class="ml-auto inline-flex items-center gap-1.5 font-bold">
              <i
                class="ph-duotone ph-seal-check text-[13px]"
                style={{ color: "#007A3D" }}
              >
              </i>
              signed by GitHub web-flow
            </span>
          </div>

          <pre class="m-0 p-4 text-[11.5px] leading-[1.65] bg-ink text-paper overflow-x-auto font-mono">
            <span class="text-muted2">---</span>
            {"\n"}
            <span style={{ color: "#9BB7E5" }}>agreement_version:</span>{" "}
            <span style={{ color: "#FFD400" }}>"{DEMO.currentVersion}"</span>
            {"\n"}
            <span style={{ color: "#9BB7E5" }}>client:</span> sigil@0.1.0
            {"\n"}
            <span class="text-muted2">---</span>
            {"\n\n"}
            <span class="text-muted2">
              # {DEMO.project} CLA · v{DEMO.currentVersion}
            </span>
            {"\n\n"}
            This license agreement exists so copyright can be
            {"\n"}
            transferred to a foundation in the future.
            {"\n\n"}
            <span class="text-muted2">
              …full CLA body captured at time of signing…
            </span>
          </pre>

          <div class="px-5 py-3 border-t-2 border-ink flex items-center justify-between text-[12px]">
            <span class="font-mono text-ink2">
              chore(cla): sign v{DEMO.currentVersion}
            </span>
            <form method="dialog">
              <button
                type="submit"
                class="btn-ghost px-3 py-1.5 text-[12px]"
              >
                Close
              </button>
            </form>
          </div>
        </div>
      </dialog>

      <dialog
        ref={compareRef}
        id="compareDialog"
        class="max-w-[760px] w-[92vw]"
      >
        <div class="bg-paper">
          <div class="dialog-title-bar px-5 py-4 flex items-center justify-between">
            <div>
              <div class="eyebrow mb-1">Amendment</div>
              <div class="font-display text-[22px] leading-none">
                {DEMO.project} CLA — v{DEMO.previousVersion} → v
                {DEMO.currentVersion}
              </div>
            </div>
            <form method="dialog">
              <button
                type="submit"
                class="w-8 h-8 grid place-items-center hover:bg-yellow hover:text-ink transition-colors"
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width={2.5}
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </form>
          </div>

          <div class="px-5 py-3 border-b-2 border-ink flex items-center gap-4 text-[12px] text-muted">
            <span>
              <span class="font-mono text-ink2">
                v{DEMO.previousVersion}
              </span>
              &nbsp;· Jun 14, 2024
            </span>
            <span class="w-1 h-1 bg-ink"></span>
            <span>
              <span class="font-mono text-ink2">
                v{DEMO.currentVersion}
              </span>
              &nbsp;· {DEMO.effectiveDate}
            </span>
            <span class="ml-auto font-mono text-[11px]">1 clause changed</span>
          </div>

          <div class="grid grid-cols-2">
            <div class="p-5 border-r-2 border-ink">
              <div class="eyebrow text-muted mb-3">
                v{DEMO.previousVersion} · before
              </div>
              <div class="cla-body text-[14px]">
                <div class="clause">
                  <span class="num">4</span>
                  <p>
                    <strong>Transfer.</strong>{" "}
                    You grant Max Malm the right to transfer or assign the
                    rights in this agreement to a successor entity established
                    to steward {DEMO.project}
                    <span class="diff-rem">.</span>
                  </p>
                </div>
              </div>
            </div>
            <div class="p-5 bg-paper2/40">
              <div class="eyebrow text-muted mb-3">
                v{DEMO.currentVersion} · after
              </div>
              <div class="cla-body text-[14px]">
                <div class="clause">
                  <span class="num">4</span>
                  <p>
                    <strong>Transfer.</strong>{" "}
                    You grant Max Malm the right to transfer or assign the
                    rights in this agreement to a successor entity established
                    to steward {DEMO.project}
                    <span class="diff-add">
                      , provided that entity is bound by the same requirement:
                      {" "}
                      {DEMO.project}{" "}
                      remains licensed under AGPL-3.0 or a later version of the
                      GNU AGPL
                    </span>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="px-5 py-3 border-t-2 border-ink flex items-center justify-between text-[12px] text-muted">
            <span>
              Amendment adds an AGPL-perpetuity condition on any successor
              entity.
            </span>
            <form method="dialog">
              <button
                type="submit"
                class="btn-ghost px-3 py-1.5 text-[12px]"
              >
                Close
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}

function DevBar(
  { current, onPick }: { current: CardState; onPick: (s: CardState) => void },
) {
  return (
    <div class="devbar fixed top-0 left-0 right-0 z-40 bg-ink text-paper">
      <div class="max-w-[1200px] mx-auto px-6 py-2 flex items-center gap-3 text-[11px]">
        <span class="text-paper2/60">dev&nbsp;preview&nbsp;//&nbsp;state:</span>
        <div class="flex gap-1">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              class={"pill " + (current === s ? "active" : "")}
              onClick={() => onPick(s)}
            >
              {labelFor(s)}
            </button>
          ))}
        </div>
        <span class="ml-auto text-paper2/40 hidden sm:inline">
          toggle via these buttons or{" "}
          <kbd class="px-1 border border-paper2/20">1</kbd>
          <kbd class="px-1 border border-paper2/20">2</kbd>
          <kbd class="px-1 border border-paper2/20">3</kbd>
          <kbd class="px-1 border border-paper2/20">4</kbd>
        </span>
      </div>
    </div>
  );
}

function labelFor(s: CardState): string {
  switch (s) {
    case "loggedOut":
      return "logged out";
    case "loggedIn":
      return "logged in";
    case "resignNeeded":
      return "re-sign needed";
    case "submitting":
      return "submitting";
    case "signed":
      return "signed";
    case "revoke":
      return "revoke";
    case "revoking":
      return "revoking";
  }
}

interface BodyProps {
  state: CardState;
  agreed: { value: boolean };
  reason: { value: string };
  setState: (s: CardState) => void;
  openChanges: () => void;
  openCompare: () => void;
}

function StateBody(props: BodyProps) {
  switch (props.state) {
    case "loggedOut":
      return <LoggedOut setState={props.setState} />;
    case "loggedIn":
      return (
        <LoggedIn
          agreed={props.agreed}
          setState={props.setState}
          openChanges={props.openChanges}
        />
      );
    case "resignNeeded":
      return (
        <ResignNeeded
          agreed={props.agreed}
          setState={props.setState}
          openCompare={props.openCompare}
        />
      );
    case "submitting":
      return <Submitting />;
    case "signed":
      return <Signed setState={props.setState} />;
    case "revoke":
      return (
        <Revoke
          agreed={props.agreed}
          reason={props.reason}
          setState={props.setState}
        />
      );
    case "revoking":
      return <Revoking />;
  }
}

function LoggedOut({ setState }: { setState: (s: CardState) => void }) {
  return (
    <div class="fade-up">
      <p class="text-[14px] text-ink2 leading-relaxed mb-5">
        Signing opens a pull request against{" "}
        <span class="font-mono text-ink">{DEMO.upstream}</span>{" "}
        that adds your signature.
      </p>
      <button
        type="button"
        class="w-full flex items-center justify-center gap-3 py-3.5 btn-sign text-[14.5px] font-medium"
        onClick={() => setState("loggedIn")}
      >
        <i class="ph-duotone ph-github-logo text-[20px]"></i>
        <span>Sign in with GitHub</span>
      </button>
    </div>
  );
}

function Identity(
  { extra }: { extra?: preact.ComponentChildren },
) {
  return (
    <div class="mb-4">
      <div class="eyebrow mb-2">Signing as</div>
      <div class="flex items-center gap-3 p-3 border-2 border-ink bg-paper">
        <div class="w-10 h-10 bg-ink text-paper grid place-items-center font-mono text-[13px]">
          {DEMO.user.initials}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[14px] font-medium text-ink truncate">
            {DEMO.user.name}
          </div>
          <div class="text-[12.5px] text-muted font-mono">
            {DEMO.user.handle}
          </div>
        </div>
        {extra}
      </div>
    </div>
  );
}

function AgreeToggle({
  agreed,
  label,
  sublabel,
}: {
  agreed: { value: boolean };
  label: string;
  sublabel?: string;
}) {
  return (
    <div class="mb-4 p-4 border-2 border-ink bg-paper flex items-start gap-4">
      <button
        type="button"
        class="toggle mt-0.5"
        role="switch"
        aria-checked={agreed.value ? "true" : "false"}
        onClick={() => (agreed.value = !agreed.value)}
      >
        <span class="knob">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width={3}
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </button>
      <label
        class="text-[14px] leading-[1.45] text-ink2 cursor-pointer select-none flex-1"
        onClick={() => (agreed.value = !agreed.value)}
      >
        {label}
        {sublabel && (
          <span class="block text-[12px] text-muted mt-1">{sublabel}</span>
        )}
      </label>
    </div>
  );
}

function LoggedIn(
  { agreed, setState, openChanges }: {
    agreed: { value: boolean };
    setState: (s: CardState) => void;
    openChanges: () => void;
  },
) {
  return (
    <div class="fade-up">
      <Identity
        extra={
          <button
            type="button"
            class="text-[11.5px] eyebrow text-muted hover:text-ink transition-colors"
            onClick={() => setState("loggedOut")}
          >
            Switch
          </button>
        }
      />

      <button
        type="button"
        class="brutal-box w-full mb-4 px-3 py-2.5 flex items-center justify-between text-[12px] hover:bg-yellow transition-colors"
        onClick={openChanges}
      >
        <span class="eyebrow">Changes</span>
        <span class="flex items-center gap-2 text-ink font-mono text-[11px]">
          <span>.cla-signatures/{DEMO.user.login}.md</span>
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

      <AgreeToggle
        agreed={agreed}
        label="I have read and agree to the agreement."
      />

      <button
        type="button"
        class="w-full py-3.5 btn-sign text-[14.5px] font-medium"
        disabled={!agreed.value}
        onClick={() => setState("submitting")}
      >
        <span class="inline-flex items-center gap-2">
          <i class="ph-duotone ph-git-pull-request text-[17px]"></i>
          <span>Open signed pull request</span>
        </span>
      </button>
    </div>
  );
}

function ResignNeeded(
  { agreed, setState, openCompare }: {
    agreed: { value: boolean };
    setState: (s: CardState) => void;
    openCompare: () => void;
  },
) {
  return (
    <div class="fade-up">
      <div class="banner-resign px-4 py-3 mb-4 flex gap-3 items-start">
        <i class="ph-duotone ph-warning-octagon text-[20px] mt-0.5 flex-none kicker">
        </i>
        <div class="text-[13px] leading-[1.5]">
          <div class="font-medium mb-0.5 kicker">Signature is out of date.</div>
          You signed an earlier version of this agreement. Please review and
          sign again.
          <div class="mt-2 flex items-center gap-3 text-[11.5px] opacity-80">
            <span class="font-mono">
              v{DEMO.previousVersion} → v{DEMO.currentVersion}
            </span>
            <span>&middot;</span>
            <button
              type="button"
              class="underline underline-offset-2 hover:text-ink transition-colors"
              onClick={openCompare}
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      <Identity
        extra={
          <div class="text-right">
            <div class="eyebrow">Previous</div>
            <div class="text-[12px] text-muted">
              {DEMO.user.previousSignedDate}
            </div>
          </div>
        }
      />

      <AgreeToggle
        agreed={agreed}
        label={`I have re-read and agree to version ${DEMO.currentVersion}.`}
        sublabel="Your previous signature file will be overwritten."
      />

      <button
        type="button"
        class="w-full py-3.5 btn-sign text-[14.5px] font-medium"
        disabled={!agreed.value}
        onClick={() => setState("submitting")}
      >
        <span class="inline-flex items-center gap-2">
          <i class="ph-duotone ph-git-pull-request text-[17px]"></i>
          <span>Open re-sign pull request</span>
        </span>
      </button>
    </div>
  );
}

type StepStatus = "waiting" | "working" | "done";

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
    <ol class="space-y-2 text-[13px] font-mono">
      {steps.map((label, i) => (
        <li
          key={label}
          class="flex items-center gap-3 p-2.5 border-2 border-ink bg-paper"
        >
          <StepDot status={statuses[i] ?? "waiting"} />
          <span class="flex-1 text-ink2">{label}</span>
          <span
            class="status text-[11px]"
            style={{
              color: statuses[i] === "done"
                ? "#1B3A6B"
                : statuses[i] === "working"
                ? "#1F2025"
                : "#6E6E6A",
            }}
          >
            {statuses[i] === "done"
              ? "done"
              : statuses[i] === "working"
              ? "working…"
              : "waiting"}
          </span>
        </li>
      ))}
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
        stroke="#1B3A6B"
        stroke-width={3}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <span
      class="w-2 h-2"
      style={{ background: status === "working" ? "#111114" : "#111114" }}
    />
  );
}

function Submitting() {
  const steps = [
    `Fork ${DEMO.upstream} → ${DEMO.user.login}/${DEMO.upstream.split("/")[1]}`,
    `Write .cla-signatures/${DEMO.user.login}.md`,
    "Sign commit with GitHub web-flow key",
    `Open PR → ${DEMO.upstream}`,
  ];
  const statuses = useStepAnimation(steps.length);
  const allDone = statuses.every((s) => s === "done");
  return (
    <div class="fade-up">
      <div class="eyebrow mb-3">Opening pull request</div>
      <StepList steps={steps} statuses={statuses} />
      <p class="mt-4 text-[11.5px] text-muted leading-relaxed">
        {allDone
          ? "Pull request opened. A maintainer will review and merge."
          : "Orchestrating the fork + commit + PR. No backend state — the commit is the signature."}
      </p>
    </div>
  );
}

function Signed({ setState }: { setState: (s: CardState) => void }) {
  return (
    <div class="fade-up">
      <div class="mb-5 border-2 border-ink overflow-hidden">
        <div class="px-4 py-2.5 bg-ink text-paper flex items-center justify-between">
          <div class="flex items-center gap-2 text-[12px]">
            <i
              class="ph-duotone ph-git-pull-request text-[16px]"
              style={{ color: "#8FE0B3" }}
            >
            </i>
            <span class="font-mono">{DEMO.upstream}#{DEMO.demoPR.number}</span>
          </div>
          <a
            href="#"
            class="text-paper/70 hover:text-paper transition-colors"
            aria-label="View on GitHub"
          >
            <i class="ph-duotone ph-github-logo text-[20px]"></i>
          </a>
        </div>
        <div class="px-4 py-3 bg-paper">
          <div class="text-[14px] text-ink font-medium">
            chore(cla): sign v{DEMO.currentVersion} as{" "}
            <span class="font-mono">{DEMO.user.handle}</span>
          </div>
          <div class="mt-2 flex items-center gap-3 text-[11.5px] text-muted font-mono">
            <span class="inline-flex items-center gap-1">
              <i
                class="ph-duotone ph-seal-check text-[14px]"
                style={{ color: "#007A3D" }}
              >
              </i>
              Verified
            </span>
            <span>·</span>
            <span>{DEMO.demoPR.date}</span>
          </div>
        </div>
      </div>

      <div class="eyebrow mb-2">Thank you</div>
      <h3 class="font-display text-[30px] leading-[1.1] text-ink">
        Signature <em class="italic">merged</em>.
      </h3>
      <p class="mt-3 text-[14px] text-ink2 leading-relaxed">
        Your signature file is on{" "}
        <span class="font-mono text-ink">main</span>. Frontmatter validated,
        commit verified, merged by a maintainer. You're cleared to contribute to
        {" "}
        {DEMO.project}.
      </p>

      <div class="mt-5 border-2 border-ink bg-paper overflow-hidden">
        <div class="px-4 py-2 border-b-2 border-ink eyebrow text-muted flex items-center justify-between">
          <span>Artifact</span>
          <span class="font-mono text-[10.5px]">{DEMO.upstream}@main</span>
        </div>
        <dl class="px-4 py-3 text-[12.5px]">
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">File</dt>
            <dd class="font-mono text-ink text-right">
              .cla-signatures/{DEMO.user.login}.md
            </dd>
          </div>
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">Author</dt>
            <dd class="font-mono text-ink">{DEMO.user.handle}</dd>
          </div>
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">Commit</dt>
            <dd class="font-mono text-ink">{DEMO.demoPR.commit} · verified</dd>
          </div>
          <div class="py-2 flex justify-between border-b border-ink/10">
            <dt class="text-muted">Agreement</dt>
            <dd class="text-ink">
              {DEMO.project} CLA v{DEMO.currentVersion}
            </dd>
          </div>
          <div class="py-2 flex justify-between">
            <dt class="text-muted">Status</dt>
            <dd class="text-ink">Merged to main</dd>
          </div>
        </dl>
      </div>

      <div class="mt-5 flex items-center gap-2">
        <a
          href="#"
          class="flex-1 text-center px-4 py-2.5 btn-ghost text-[13px] font-medium"
        >
          View pull request
        </a>
        <button
          type="button"
          class="px-4 py-2.5 text-[12.5px] text-muted hover:text-ink transition-colors"
        >
          View signature file →
        </button>
      </div>

      <div class="mt-4 pt-4 border-t-2 border-ink/10 flex items-center justify-between text-[11.5px]">
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

function Revoke(
  { agreed, reason, setState }: {
    agreed: { value: boolean };
    reason: { value: string };
    setState: (s: CardState) => void;
  },
) {
  return (
    <div class="fade-up">
      <p class="text-[14px] text-ink2 leading-[1.55] mb-4">
        Revoking opens a pull request that{" "}
        <span class="font-mono text-ink">deletes</span> your signature file.
      </p>

      <ul class="space-y-2 text-[13px] text-ink2 leading-[1.5] mb-5">
        <li class="flex gap-2">
          <span class="text-muted mt-[3px]">—</span>
          <span>
            Past contributions remain licensed under the version you signed.
            That grant is perpetual and cannot be withdrawn.
          </span>
        </li>
        <li class="flex gap-2">
          <span class="text-muted mt-[3px]">—</span>
          <span>
            Future pull requests from{" "}
            <span class="font-mono text-ink">{DEMO.user.handle}</span>{" "}
            will be blocked by CI until you sign again.
          </span>
        </li>
        <li class="flex gap-2">
          <span class="text-muted mt-[3px]">—</span>
          <span>
            Git history preserves your original signature for audit — the file
            is only absent from the current tree.
          </span>
        </li>
      </ul>

      <div class="mb-4">
        <label class="eyebrow text-muted mb-2 flex items-center justify-between">
          <span>Reason</span>
          <span
            class="text-muted2 normal-case tracking-normal"
            style={{
              fontFamily: '"Source Serif 4", serif',
              fontSize: "11px",
              fontWeight: 400,
            }}
          >
            optional
          </span>
        </label>
        <textarea
          maxLength={200}
          rows={2}
          placeholder="e.g. Project no longer aligns with my open source priorities."
          class="w-full px-3 py-2 border-2 border-ink bg-paper text-[13px] text-ink placeholder:text-muted2 focus:outline-none focus:ring-2 focus:ring-yellow resize-none font-serif leading-[1.5]"
          value={reason.value}
          onInput={(
            e,
          ) => (reason.value = (e.currentTarget as HTMLTextAreaElement).value)}
        />
        <div class="mt-1 flex items-center justify-between text-[10.5px] text-muted2 font-mono">
          <span>Posted to the PR body (not stored in the signature file).</span>
          <span>{reason.value.length}/200</span>
        </div>
      </div>

      <div class="mb-5 p-3 border-2 border-ink bg-paper2/50">
        <div class="eyebrow text-muted mb-2">Diff preview</div>
        <pre class="m-0 text-[11px] leading-[1.55] font-mono text-ink2">
          <span style={{ color: "#CC2F5A" }}>
            &minus; .cla-signatures/{DEMO.user.login}.md
          </span>
        </pre>
      </div>

      <AgreeToggle
        agreed={agreed}
        label="Yes, I want to revoke my signature."
      />

      <button
        type="button"
        class="btn-sign w-full px-4 py-3 text-[14px] font-medium"
        disabled={!agreed.value}
        onClick={() => setState("revoking")}
      >
        <span class="inline-flex items-center justify-center gap-2">
          <i class="ph-duotone ph-git-pull-request text-[17px]"></i>
          <span>Open revocation pull request</span>
        </span>
      </button>

      <div class="mt-4 text-center">
        <button
          type="button"
          class="text-[12px] text-muted hover:text-ink underline underline-offset-2 transition-colors"
          onClick={() => setState("signed")}
        >
          Cancel, keep signature
        </button>
      </div>
    </div>
  );
}

function Revoking() {
  const steps = [
    `Delete .cla-signatures/${DEMO.user.login}.md`,
    "Sign commit with GitHub web-flow key",
    `Open PR → ${DEMO.upstream}`,
  ];
  const statuses = useStepAnimation(steps.length);
  const allDone = statuses.every((s) => s === "done");
  return (
    <div class="fade-up">
      <div class="eyebrow mb-3">Opening revocation pull request</div>
      <StepList steps={steps} statuses={statuses} />
      <p class="mt-4 text-[11.5px] text-muted leading-relaxed">
        {allDone
          ? "Revocation PR opened. Past contributions stay licensed under v" +
            DEMO.currentVersion + " — that grant can't be withdrawn."
          : "Preparing the delete. Your past contributions stay licensed under v" +
            DEMO.currentVersion + " — that grant can't be withdrawn."}
      </p>
    </div>
  );
}
