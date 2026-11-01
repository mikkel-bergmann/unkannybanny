## 1. Structural test first

- [x] 1.1 [req: room-wake-structural-test] Add `test/room-wake.test.js` using
      only `node:test`, `node:assert/strict`, and `node:fs`. Resolve the repo
      root as `new URL("..", import.meta.url)`. Write three tests: (a) each of
      the six paths listed in plan.md's Implementation exists, the assertion
      message naming the path; (b) the first line of
      `.github/workflows/room-wake.yml` matches
      `/^# shipd-copilot v\d+\.\d+\.\d+$/`; (c) the workflow text contains
      `.github/shipd-room/skills/room/scripts/room.py`. Run `npm test` and
      observe these tests fail, because the files are not installed yet.

## 2. Install the wake set

- [x] 2.1 [req: room-wake-managed-files] From the worktree root run
      `"${CLAUDE_PLUGIN_ROOT}/bin/shipd" copilot add --room --root <worktree>`
      and confirm it prints six `wrote` lines and exits 0. Do not edit any of
      the six written files by hand.
- [x] 2.2 [req: room-wake-managed-files] Run
      `"${CLAUDE_PLUGIN_ROOT}/bin/shipd" copilot --room --root <worktree>` and
      confirm the `room wake set:` block reports all six files `installed`.
- [x] 2.3 [req: room-wake-structural-test] Run `npm test` and confirm it exits
      0 with the room wake tests passing.

## 3. Document the human settings

- [x] 3.1 [req: room-wake-setup-docs] Append a `## Room wake` section to
      `README.md` with the content fixed in plan.md's Implementation: the
      `SHIPD_ROOM_AGENT` variable with
      `gh variable set SHIPD_ROOM_AGENT --body <name>`, the
      `COPILOT_GITHUB_TOKEN` secret (a fine-grained PAT with the "Copilot
      Requests" permission), that a person sets both outside any pull
      request, and that until both exist a room task is left for a live
      session's `shipd room watch`.

## 4. Verify

- [x] 4.1 [req: *] Run `git diff --name-status main -- .github` and confirm it
      lists exactly the six wake files, all as `A`. Run `npm test` once more
      and confirm exit 0.
