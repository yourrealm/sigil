import { assertEquals, assertMatch } from "jsr:@std/assert@^1.0.0";
import { dispatch } from "../index.mts";
import type { PRFile } from "../index.mts";
import type { Context } from "../gh.mts";
import type { ContributionResult } from "../contribution.mts";

const BODY = "By submitting a contribution, you agree to the terms.\n";

function claText(version: string, body = BODY): string {
  return `---\nname: Realm\nversion: ${version}\n---\n\n${body}`;
}

function sigText(version: string, body = BODY): string {
  return `---\nagreement_version: ${version}\nclient: sigil@test\n---\n\n${body}`;
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

interface MockResp {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type RouteMap = Record<string, MockResp>;

function mockFetch(routes: RouteMap): void {
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.replace("https://api.github.com", "");
    const hit = routes[path];
    if (!hit) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    const status = hit.status ?? 200;
    const body = hit.body != null ? JSON.stringify(hit.body) : null;
    return Promise.resolve(
      new Response(body, {
        status,
        headers: {
          "content-type": "application/json",
          ...(hit.headers || {}),
        },
      }),
    );
  }) as typeof globalThis.fetch;
}

function contentsResp(text: string): MockResp {
  return { body: { content: b64(text), encoding: "base64" } };
}

function makeCtx(overrides: Partial<Context> = {}): Context {
  return {
    token: "fake",
    baseUrl: "https://withsigil.eu",
    owner: "y",
    repo: "s",
    prNumber: 1,
    baseSha: "b",
    headSha: "h",
    prAuthor: "benjick",
    ...overrides,
  };
}

Deno.test("passes on a valid own-signature PR", async () => {
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.cla.ok, true);
  assertEquals(result.signature.ok, true);
  assertEquals(result.contribution.ok, true);
});

Deno.test("signature fails on version mismatch", async () => {
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("2.0")),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertMatch(result.signature.summary, /does not match current CLA version/);
});

Deno.test("signature fails on body drift", async () => {
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0", "Old body\n"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(
      claText("1.0", "New body\n"),
    ),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertMatch(result.signature.summary, /does not match/);
});

Deno.test("signature passes on revocation (file absent at head)", async () => {
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": { status: 404 },
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, true);
  assertEquals(result.signature.summary, "revocation");
});

Deno.test("contribution fails when PR author is unsigned", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": { status: 404 },
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, false);
  const c = result.contribution as ContributionResult;
  assertEquals(c.unsigned, ["benjick"]);
});

Deno.test("contribution passes when all authors signed", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, true);
});

Deno.test("rejects PR that modifies another contributor's signature", async () => {
  const files: PRFile[] = [{ filename: ".signatures/cla/alice.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertMatch(result.signature.summary, /another contributor/);
});

Deno.test("cla integrity fails on body change without version bump", async () => {
  mockFetch({
    "/repos/y/s/contents/CLA.md?ref=b": contentsResp(
      claText("1.0", "Old body\n"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(
      claText("1.0", "New body\n"),
    ),
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": { status: 404 },
  });

  const files: PRFile[] = [{ filename: "CLA.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.cla.ok, false);
  assertMatch(result.cla.summary, /without a version bump/);
});

Deno.test("cla integrity passes on body change with version bump", async () => {
  mockFetch({
    "/repos/y/s/contents/CLA.md?ref=b": contentsResp(
      claText("1.0", "Old body\n"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(
      claText("2.0", "New body\n"),
    ),
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("2.0", "New body\n"),
    ),
  });

  const files: PRFile[] = [{ filename: "CLA.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.cla.ok, true);
});

Deno.test("contribution fails on commits with unlinked emails", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": {
      body: [
        {
          sha: "abc1234",
          author: null,
          committer: null,
          commit: {
            author: { email: "ghost@example.com" },
            committer: { email: "ghost@example.com" },
          },
        },
      ],
    },
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, false);
  const c = result.contribution as ContributionResult;
  assertEquals(c.unlinked.length, 2);
  assertEquals(c.unlinked[0].email, "ghost@example.com");
});

Deno.test("contribution ignores Co-authored-by trailers in commit messages", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": {
      body: [
        {
          sha: "abc1234",
          author: { login: "benjick", type: "User" },
          committer: { login: "benjick", type: "User" },
          commit: {
            author: { email: "b@e.com" },
            committer: { email: "b@e.com" },
            message:
              "fix: tweak\n\nCo-authored-by: Unknown Person <unknown@example.com>\n",
          },
        },
      ],
    },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, true);
});

Deno.test("contribution filters web-flow (GitHub UI commits) from the author set", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": {
      body: [
        {
          sha: "abc1234",
          author: { login: "benjick", type: "User" },
          committer: { login: "web-flow", type: "User" },
          commit: {
            author: { email: "b@e.com" },
            committer: { email: "noreply@github.com" },
          },
        },
      ],
    },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, true);
});

Deno.test("contribution filters bot logins from the author set", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": {
      body: [
        {
          sha: "abc1234",
          author: { login: "dependabot[bot]", type: "Bot" },
          committer: { login: "dependabot[bot]", type: "Bot" },
          commit: {
            author: {
              email: "49699333+dependabot[bot]@users.noreply.github.com",
            },
            committer: {
              email: "49699333+dependabot[bot]@users.noreply.github.com",
            },
          },
        },
      ],
    },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, true);
});

Deno.test("contribution flags stale signatures (signed against older CLA)", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(
      claText("2.0", "New body\n"),
    ),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0", "Old body\n"),
    ),
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, false);
  const c = result.contribution as ContributionResult;
  assertEquals(c.stale, ["benjick"]);
  assertEquals(c.unsigned, []);
});

Deno.test("handles mixed PR: own signature + code in one PR", async () => {
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
  });

  const files: PRFile[] = [
    { filename: ".signatures/cla/benjick.md" },
    { filename: "README.md" },
  ];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, true);
  assertEquals(result.contribution.ok, true);
  assertEquals(result.cla.ok, true);
});

Deno.test("cla integrity passes when CLA.md is first added", async () => {
  mockFetch({
    "/repos/y/s/contents/CLA.md?ref=b": { status: 404 },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
  });

  const files: PRFile[] = [{ filename: "CLA.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.cla.ok, true);
  assertEquals(result.cla.summary, "CLA.md added");
});

Deno.test("cla integrity fails when CLA.md is being removed", async () => {
  mockFetch({
    "/repos/y/s/contents/CLA.md?ref=b": contentsResp(claText("1.0")),
    "/repos/y/s/contents/CLA.md?ref=h": { status: 404 },
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
  });

  const files: PRFile[] = [{ filename: "CLA.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.cla.ok, false);
  assertMatch(result.cla.summary, /being removed/);
});

Deno.test("signature fails when signature file has no frontmatter", async () => {
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      "just a body with no frontmatter\n",
    ),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertMatch(result.signature.summary, /missing frontmatter/);
});

Deno.test("signature fails when agreement_version is missing from frontmatter", async () => {
  const sigNoVer = `---\nclient: sigil@test\n---\n\n${BODY}`;
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigNoVer,
    ),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertMatch(result.signature.summary, /agreement_version/);
});

Deno.test("signature fails when CLA.md has no version field", async () => {
  const claNoVer = `---\nname: Realm\n---\n\n${BODY}`;
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claNoVer),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertMatch(result.signature.summary, /frontmatter or version/);
});

Deno.test("version `1` normalizes to match `1.0`", async () => {
  const sigIntVer =
    `---\nagreement_version: 1\nclient: sigil@test\n---\n\n${BODY}`;
  const claDotVer = `---\nname: Realm\nversion: 1.0\n---\n\n${BODY}`;
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigIntVer,
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claDotVer),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, true);
});

Deno.test("CRLF body matches LF body after normalization", async () => {
  const bodyLF = "Line one\nLine two\n";
  const bodyCRLF = "Line one\r\nLine two\r\n";
  mockFetch({
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0", bodyCRLF),
    ),
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0", bodyLF)),
  });

  const files: PRFile[] = [{ filename: ".signatures/cla/benjick.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, true);
});

Deno.test("empty PR (zero files) passes all axes trivially", async () => {
  const result = await dispatch(makeCtx(), []);

  assertEquals(result.cla.ok, true);
  assertEquals(result.cla.summary, "no CLA.md changes");
  assertEquals(result.signature.ok, true);
  assertEquals(result.signature.summary, "no signature changes");
  assertEquals(result.contribution.ok, true);
  assertEquals(result.contribution.summary, "no code changes");
});

Deno.test("files at nested paths route to contribution axis", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": { body: [] },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
  });

  const files: PRFile[] = [
    { filename: "src/lib/utils.ts" },
    { filename: ".github/workflows/ci.yml" },
  ];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, true);
  assertEquals(result.signature.summary, "no signature changes");
  assertEquals(result.contribution.ok, true);
});

Deno.test("others-sig reject wins regardless of file order", async () => {
  const files: PRFile[] = [
    { filename: ".signatures/cla/benjick.md" },
    { filename: ".signatures/cla/alice.md" },
    { filename: "README.md" },
  ];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.signature.ok, false);
  assertEquals(result.signature.details, ".signatures/cla/alice.md");
  assertEquals(result.contribution.summary, "skipped");
});

Deno.test("contribution follows Link pagination across commit pages", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": {
      body: [
        {
          sha: "page1",
          author: { login: "alice", type: "User" },
          committer: { login: "alice", type: "User" },
          commit: { author: { email: "a" }, committer: { email: "a" } },
        },
      ],
      headers: {
        link:
          '<https://api.github.com/repos/y/s/pulls/1/commits?per_page=100&page=2>; rel="next"',
      },
    },
    "/repos/y/s/pulls/1/commits?per_page=100&page=2": {
      body: [
        {
          sha: "page2",
          author: { login: "bob", type: "User" },
          committer: { login: "bob", type: "User" },
          commit: { author: { email: "b" }, committer: { email: "b" } },
        },
      ],
    },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/.signatures/cla/alice.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/.signatures/cla/bob.md?ref=h": { status: 404 },
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, false);
  const c = result.contribution as ContributionResult;
  assertEquals(c.unsigned, ["bob"]);
});

Deno.test("contribution reports only unsigned authors from a mixed set", async () => {
  mockFetch({
    "/repos/y/s/pulls/1/commits?per_page=100": {
      body: [
        {
          sha: "abc1234",
          author: { login: "alice", type: "User" },
          committer: { login: "alice", type: "User" },
          commit: {
            author: { email: "a@e.com" },
            committer: { email: "a@e.com" },
          },
        },
        {
          sha: "def5678",
          author: { login: "bob", type: "User" },
          committer: { login: "bob", type: "User" },
          commit: {
            author: { email: "b@e.com" },
            committer: { email: "b@e.com" },
          },
        },
      ],
    },
    "/repos/y/s/contents/CLA.md?ref=h": contentsResp(claText("1.0")),
    "/repos/y/s/contents/.signatures/cla/benjick.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/.signatures/cla/alice.md?ref=h": contentsResp(
      sigText("1.0"),
    ),
    "/repos/y/s/contents/.signatures/cla/bob.md?ref=h": { status: 404 },
  });

  const files: PRFile[] = [{ filename: "README.md" }];
  const result = await dispatch(makeCtx(), files);

  assertEquals(result.contribution.ok, false);
  const c = result.contribution as ContributionResult;
  assertEquals(c.unsigned, ["bob"]);
  assertEquals(c.stale, []);
});
