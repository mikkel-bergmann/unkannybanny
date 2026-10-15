import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);

const managed = [
  ".github/workflows/room-wake.yml",
  ".github/shipd-room/.claude-plugin/plugin.json",
  ".github/shipd-room/skills/room/scripts/room.py",
  ".github/shipd-room/skills/room/scripts/room_schema.py",
  ".github/shipd-room/skills/build/scripts/spec_common.py",
  ".github/shipd-room/skills/build/scripts/cli_common.py",
];

const workflow = () =>
  readFileSync(new URL(".github/workflows/room-wake.yml", root), "utf8");

test("every managed room wake file exists", () => {
  for (const path of managed) {
    assert.ok(existsSync(new URL(path, root)), `missing managed file: ${path}`);
  }
});

test("the workflow carries the shipd ownership marker", () => {
  const first = workflow().split("\n")[0];
  assert.match(first, /^# shipd-copilot v\d+\.\d+\.\d+$/);
});

test("the workflow references the bundled room runtime", () => {
  assert.ok(
    workflow().includes(".github/shipd-room/skills/room/scripts/room.py"),
  );
});
