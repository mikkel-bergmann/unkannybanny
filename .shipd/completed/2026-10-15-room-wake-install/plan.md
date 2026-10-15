# room-wake-install
Status: verified
Epic: unkannybanny

## Idea

Install the shipd room wake (`room-wake.yml` and its bundled runtime) under
`.github/` with `shipd copilot add --room`, with a structural test and README
setup notes.

### Motivation

An agent that addresses a task to this repository's CI agent in a pull
request's room gets no reply unless a live session is running
`shipd room watch`, because nothing in the repository wakes on a room comment.
The epic needs every member's room to carry real agent traffic, so the wake
must ship as a reviewed change like any other member.

### Details

- Run `shipd copilot add --room` to write the six managed files:
  `.github/workflows/room-wake.yml` and five byte-identical runtime files
  under `.github/shipd-room/`.
- Add `test/room-wake.test.js`, a dependency-free check that the wake set is
  present and owned.
- Add a `## Room wake` section to `README.md` naming the two settings a
  person must set on GitHub.

Affected capabilities: `room-wake` (new). Impact: `.github/`, `test/`,
`README.md`; no new dependency, no change to `package.json` or `ci.yml`.

### Non-goals

- Setting `SHIPD_ROOM_AGENT` or `COPILOT_GITHUB_TOKEN` on GitHub; both are
  human steps outside this change.
- Installing the four review gate files that plain `shipd copilot add`
  writes, or any branch ruleset.
- Editing the generated workflow or runtime files by hand.

## Implementation

- **The verb writes the files; nobody edits them.** The executor runs
  `"${CLAUDE_PLUGIN_ROOT}/bin/shipd" copilot add --room --root <worktree>`
  and commits its output unchanged. The workflow's first line is the
  ownership marker `# shipd-copilot v<plugin version>`; its version is
  whatever plugin runs the build, not pinned by this plan. Rejected: copying
  the files from a plugin checkout by hand, which skips the verb's ownership
  marker and refusal checks.
- **The six managed paths** (the test's fixed list):
  - `.github/workflows/room-wake.yml`
  - `.github/shipd-room/.claude-plugin/plugin.json`
  - `.github/shipd-room/skills/room/scripts/room.py`
  - `.github/shipd-room/skills/room/scripts/room_schema.py`
  - `.github/shipd-room/skills/build/scripts/spec_common.py`
  - `.github/shipd-room/skills/build/scripts/cli_common.py`
- **Test (Q1).** `test/room-wake.test.js` uses `node:test`,
  `node:assert/strict`, and `node:fs` only, resolving paths from
  `new URL("..", import.meta.url)`. It asserts each path above exists, the
  workflow's first line matches `^# shipd-copilot v\d+\.\d+\.\d+$`, and the
  workflow references `.github/shipd-room/skills/room/scripts/room.py`. The
  epic's "starts the app on port 0" clause does not apply: this member has no
  app surface, so the test reads files only. Byte identity with the plugin is
  checked at build time with `shipd copilot --room`, not in CI, because CI
  has no plugin copy. Rejected: parsing the YAML, which needs a dependency.
- **Settings stay human (Q2).** The change sets nothing on GitHub. The README
  section says: the wake runs only when the Actions variable
  `SHIPD_ROOM_AGENT` names the CI agent
  (`gh variable set SHIPD_ROOM_AGENT --body <name>`) and the secret
  `COPILOT_GITHUB_TOKEN` holds a fine-grained PAT with the "Copilot Requests"
  permission; a person sets both outside any pull request; until both exist
  a room task is left for a live session's `shipd room watch`.
- **`npm test` is unaffected by the Python files.** `node --test` discovers
  only test-named JavaScript files, so nothing under `.github/shipd-room/`
  runs.

Risks: the workflow's guard and reply jobs check out the default branch, so
the wake works only after this change merges to `main`; that is expected and
needs no task. With `SHIPD_ROOM_AGENT` unset, every wake run skips its jobs,
which is the documented inert state.

## Questions and answers

### Q1: What test does the room wake member ship?
- **Question:** The epic says every member ships `test/<area>.test.js`, but
  this member has no app surface. Options: (1) a `node:test` file checking
  the six files exist, the workflow marker matches a semver pattern, and the
  workflow's `room.py` path exists; (2) no test, verified only by
  `shipd copilot --room` at build time; (3) a YAML-parsing test with a new
  dependency. Recommendation: (1).
- **Verdict:** ANSWER
- **Answered by:** ORACLE
- **Answer:** Option (1). The room wake is a member, every member ships
  tests, and tests use `node:test` with no added framework; option (2)
  breaks the first rule and option (3) the second. The assertions themselves
  are this plan's design.
- **Cited:** epic/unkannybanny

### Q2: Who sets the SHIPD_ROOM_AGENT variable?
- **Question:** The wake runs no job unless the Actions variable
  `SHIPD_ROOM_AGENT` is set, and the repository has none. Options: (1) a
  human step outside the change, documented in `README.md` beside the secret;
  (2) a build task runs `gh variable set SHIPD_ROOM_AGENT --body copilot-ci`,
  a settings change outside the PR diff; (3) leave it undocumented.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option (1). It matches the epic's treatment of the
  `COPILOT_GITHUB_TOKEN` secret, keeps every effect of the change inside its
  reviewed diff, and leaves the agent's name to the person who sets it.
- **Queued:** q-room-wake-agent-variable-owner

## Readiness attestation

### Problem and motivation

A room task addressed to the CI agent gets no reply without a live session,
and the epic needs the wake shipped as its own reviewed member.

Evidence:

- epic/unkannybanny, Decisions: "The room wake is a member, not a bootstrap
  step."
- epic/unkannybanny, success criteria: each merged PR shows finding tasks
  taken by an agent in the room.
- `.github/workflows/ci.yml` is the only workflow on `main`; no wake exists.

### Scope and non-goals

Six managed files, one test, and one README section; GitHub settings and the
review gate files stay out.

Evidence:

- In scope: the six paths listed in Implementation, `test/room-wake.test.js`,
  `README.md`.
- Out of scope: the review gate set (`shipd copilot --root <worktree>` lists
  it `absent`; plain `add` owns it), `.github/workflows/ci.yml`.
- epic/unkannybanny: the `COPILOT_GITHUB_TOKEN` secret is a human step
  outside the epic.

### Affected capabilities and files

One new capability, `room-wake`, covering the managed files, their test, and
the setup notes.

Evidence:

- Capability `room-wake` (new; the library is empty, so the delta is ADDED).
- Files: `.github/workflows/room-wake.yml`, `.github/shipd-room/**` (five
  files), `test/room-wake.test.js`, `README.md:1-14`.
- Runnable premise: `shipd copilot --room --root <worktree>` exited 0 and
  listed all six wake files `absent`.
- Runnable premise: in a scratch copy of the branch,
  `shipd copilot add --room --root <copy>` exited 0 with six `wrote` lines
  and touched nothing else (`git status --short` showed only
  `.github/shipd-room/` and `.github/workflows/room-wake.yml`); the report
  then showed all six `installed`; a second run exited 0 with no diff; the
  five runtime files compared equal to the plugin's with `cmp`.
- Runnable premise: `npm test` in that copy exited 0 with one passing test.
- Runnable premise: `gh variable list` and `gh secret list` on the
  repository printed nothing.

### No open task-shaping decision

Every task-shaping decision is settled.

Evidence:

- Test shape (node:test file reading the six paths): settled by the oracle,
  Q1.
- Owner of `SHIPD_ROOM_AGENT` (a person, documented in README): planner
  default, Q2.
- File content (verb output, unedited) and marker check (pattern, no pinned
  version): settled by investigation of the verb's output.
