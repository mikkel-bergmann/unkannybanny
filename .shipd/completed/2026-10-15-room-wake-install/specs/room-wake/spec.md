## ADDED Requirements

### Requirement: Room wake managed files are installed
id: room-wake-managed-files

The repository SHALL carry the six room wake files that `shipd copilot add
--room` writes: `.github/workflows/room-wake.yml` and the bundled runtime
under `.github/shipd-room/` (`.claude-plugin/plugin.json`,
`skills/room/scripts/room.py`, `skills/room/scripts/room_schema.py`,
`skills/build/scripts/spec_common.py`, `skills/build/scripts/cli_common.py`),
each exactly as the verb wrote it. The change SHALL NOT add, edit, or remove
any other file under `.github/`.

#### Scenario: The report shows the whole wake set installed
- **WHEN** `shipd copilot --room --root <repo>` runs on the change's branch
- **THEN** its `room wake set:` block reports all six files as `installed`,
  the workflow line naming `shipd-copilot v<version>` and each runtime line
  reading `byte-identical to the plugin's copy`

#### Scenario: Nothing else under .github changes
- **WHEN** the change's diff against `main` is listed for `.github/`
- **THEN** it holds exactly the six wake files as added files, and
  `.github/workflows/ci.yml` is unchanged

### Requirement: npm test checks the wake set is present
id: room-wake-structural-test

The test suite SHALL include `test/room-wake.test.js`, using only
`node:test`, `node:assert/strict`, and `node:fs`, which SHALL fail when any
of the six wake files is missing, when the first line of
`.github/workflows/room-wake.yml` does not match
`^# shipd-copilot v\d+\.\d+\.\d+$`, or when the workflow does not reference
`.github/shipd-room/skills/room/scripts/room.py`.

#### Scenario: The suite passes with the wake installed
- **WHEN** `npm test` runs on the change's branch
- **THEN** it exits 0 and the room wake tests pass

#### Scenario: A missing runtime file fails the suite
- **WHEN** `.github/shipd-room/skills/room/scripts/room_schema.py` is deleted
  and `npm test` runs
- **THEN** a room wake test fails naming the missing path and `npm test`
  exits non-zero

#### Scenario: The marker check does not pin a version
- **WHEN** the workflow's first line is `# shipd-copilot v0.7.0`
- **THEN** the marker test passes

### Requirement: README names the two settings the wake needs
id: room-wake-setup-docs

`README.md` SHALL carry a `## Room wake` section stating that the wake runs
only when the repository Actions variable `SHIPD_ROOM_AGENT` names the CI
agent and the repository secret `COPILOT_GITHUB_TOKEN` holds a fine-grained
PAT with the "Copilot Requests" permission, that both are set by a person
outside the repository's pull requests, and that until then a room task is
left for a live session's `shipd room watch`.

#### Scenario: The README documents both settings
- **WHEN** a reader opens `README.md`
- **THEN** a `## Room wake` section names `SHIPD_ROOM_AGENT` with the
  `gh variable set SHIPD_ROOM_AGENT --body <name>` command and
  `COPILOT_GITHUB_TOKEN` as a repository secret, and names
  `shipd room watch` as the path while either is unset
