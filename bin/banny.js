#!/usr/bin/env node
import { parseArgs } from "node:util";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createStore } from "../src/store.js";
import { serializeExport } from "../src/routes/export.js";
import { validateNewItem, validateItemPatch, ItemValidationError } from "../src/items.js";

const SAMPLE_ITEMS = Object.freeze([
  { title: "Peel the bananas", tags: ["kitchen"] },
  { title: "Buy more bananas", tags: ["shop", "kitchen"] },
  { title: "Water the banana plant", tags: ["garden"] },
  { title: "Write the board README", done: true, tags: ["docs"] },
  { title: "Plan the banana bread bake-off" },
]);

class UsageError extends Error {
  code = "usage";
}

class NotFoundError extends Error {
  code = "not-found";
}

const EXIT = { usage: 2, "invalid-item": 3, "not-found": 4, "store-corrupt": 1, internal: 1 };

const GLOBAL_OPTIONS = {
  json: { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

function formatItem(item) {
  const line = `${item.id}  [${item.done ? "x" : " "}] ${item.title}`;
  return item.tags.length > 0 ? line + "  " + item.tags.map((t) => "#" + t).join(" ") : line;
}

export const commands = {
  list: {
    usage: "banny list",
    options: {},
    async run({ args, store }) {
      if (args.length > 0) throw new UsageError("list takes no arguments");
      const items = await store.list();
      return { json: { items }, text: items.map(formatItem).join("\n") };
    },
  },
  add: {
    usage: "banny add <title words...> [--tag <tag>]...",
    options: { tag: { type: "string", multiple: true } },
    async run({ args, values, store }) {
      if (args.length === 0) throw new UsageError("add needs a title");
      const item = await store.create(
        validateNewItem({ title: args.join(" "), tags: values.tag ?? [] }),
      );
      return { json: item, text: formatItem(item) };
    },
  },
  done: {
    usage: "banny done <id> [--undo]",
    options: { undo: { type: "boolean" } },
    async run({ args, values, store }) {
      if (args.length !== 1) throw new UsageError("done needs exactly one id");
      const item = await store.update(args[0], validateItemPatch({ done: !values.undo }));
      if (!item) throw new NotFoundError(`no item with id ${args[0]}`);
      return { json: item, text: formatItem(item) };
    },
  },
  remove: {
    usage: "banny remove <id>",
    options: {},
    async run({ args, store }) {
      if (args.length !== 1) throw new UsageError("remove needs exactly one id");
      const id = args[0];
      if (!(await store.remove(id))) throw new NotFoundError(`no item with id ${id}`);
      return { json: { id, removed: true }, text: "removed " + id };
    },
  },
  seed: {
    usage: "banny seed",
    options: {},
    async run({ args, store }) {
      if (args.length > 0) throw new UsageError("seed takes no arguments");
      if ((await store.list()).length > 0) {
        return { json: { items: [] }, text: "store is not empty; nothing seeded" };
      }
      const inputs = SAMPLE_ITEMS.map((s) => validateNewItem(s));
      const items = [];
      for (const input of inputs) items.push(await store.create(input));
      return { json: { items }, text: items.map(formatItem).join("\n") };
    },
  },
  export: {
    usage: "banny export",
    options: {},
    async run({ args, store }) {
      if (args.length > 0) throw new UsageError("export takes no arguments");
      const items = await store.list();
      return { json: { items }, text: serializeExport(items).trimEnd() };
    },
  },
};

export async function main(
  argv,
  { stdout = process.stdout, stderr = process.stderr, store } = {},
) {
  const end = argv.indexOf("--");
  const flags = end === -1 ? argv : argv.slice(0, end);
  const asJson = flags.includes("--json");
  try {
    if (flags.includes("--help") || flags.includes("-h")) {
      stdout.write(
        ["usage:", ...Object.values(commands).map((c) => "  " + c.usage)].join("\n") + "\n",
      );
      return 0;
    }
    const verb = argv.find((a) => !a.startsWith("-"));
    if (verb === undefined || !Object.hasOwn(commands, verb)) {
      throw new UsageError(verb === undefined ? "missing verb" : `unknown verb: ${verb}`);
    }
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        options: { ...GLOBAL_OPTIONS, ...commands[verb].options },
        allowPositionals: true,
        strict: true,
      });
    } catch (err) {
      if (typeof err.code === "string" && err.code.startsWith("ERR_PARSE_ARGS")) {
        throw new UsageError(err.message);
      }
      throw err;
    }
    const { values, positionals } = parsed;
    if (positionals[0] !== verb) throw new UsageError(`unexpected argument: ${positionals[0]}`);
    const { json, text } = await commands[verb].run({
      args: positionals.slice(1),
      values,
      store: store ?? createStore(),
    });
    if (asJson) stdout.write(JSON.stringify(json) + "\n");
    else if (text) stdout.write(text + "\n");
    return 0;
  } catch (err) {
    const code =
      err instanceof ItemValidationError
        ? "invalid-item"
        : ["usage", "not-found", "store-corrupt"].includes(err.code)
          ? err.code
          : "internal";
    stderr.write(
      asJson
        ? JSON.stringify({ error: { code, message: err.message } }) + "\n"
        : `banny: ${err.message}\n`,
    );
    return EXIT[code];
  }
}

function isEntryPoint(entry) {
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isEntryPoint(process.argv[1])) {
  process.exitCode = await main(process.argv.slice(2));
}
