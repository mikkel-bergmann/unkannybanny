#!/usr/bin/env node
import { parseArgs } from "node:util";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createStore } from "../src/store.js";
import { serializeExport } from "../src/routes/export.js";
import { computeStats } from "../src/routes/stats.js";
import { validateNewItem, validateItemPatch, validateItemMove, ItemValidationError } from "../src/items.js";
import { validateNewColumn, validateColumnPatch } from "../src/columns.js";

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

function formatColumn(column) {
  return `${column.id}  ${column.name}`;
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
      const columns = await store.listColumns();
      const json = columns.length > 0 ? { items, columns } : { items };
      return { json, text: serializeExport(items, columns).trimEnd() };
    },
  },
  stats: {
    usage: "banny stats",
    options: {},
    async run({ args, store }) {
      if (args.length > 0) throw new UsageError("stats takes no arguments");
      const stats = computeStats(await store.list());
      return {
        json: stats,
        text: `total: ${stats.total}\ndone: ${stats.done}\nopen: ${stats.open}\ntags: ${stats.tags}`,
      };
    },
  },
  columns: {
    usage: "banny columns",
    options: {},
    async run({ args, store }) {
      if (args.length > 0) throw new UsageError("columns takes no arguments");
      const columns = await store.listColumns();
      return { json: { columns }, text: columns.map(formatColumn).join("\n") };
    },
  },
  column: {
    usage:
      "banny column add <name...> | rename <id> <name...> | move <id> <position> | remove <id>",
    options: {},
    async run({ args, store }) {
      const [sub, ...rest] = args;
      if (sub === "add") {
        if (rest.length === 0) throw new UsageError("column add needs a name");
        const column = await store.createColumn(validateNewColumn({ name: rest.join(" ") }));
        return { json: column, text: formatColumn(column) };
      }
      if (sub === "rename") {
        if (rest.length < 2) throw new UsageError("column rename needs an id and a name");
        const [id, ...words] = rest;
        const column = await store.updateColumn(id, validateColumnPatch({ name: words.join(" ") }));
        if (!column) throw new NotFoundError(`no column with id ${id}`);
        return { json: column, text: formatColumn(column) };
      }
      if (sub === "move") {
        if (rest.length !== 2) throw new UsageError("column move needs an id and a position");
        const [id, rawPosition] = rest;
        const position = Number(rawPosition);
        const columns = await store.listColumns();
        const index = columns.findIndex((c) => c.id === id);
        if (index === -1) throw new NotFoundError(`no column with id ${id}`);
        if (!Number.isInteger(position) || position < 1 || position > columns.length) {
          throw new UsageError("position must be between 1 and the column count");
        }
        const ids = columns.map((c) => c.id);
        ids.splice(index, 1);
        ids.splice(position - 1, 0, id);
        const reordered = await store.reorderColumns(ids);
        return { json: { columns: reordered }, text: reordered.map(formatColumn).join("\n") };
      }
      if (sub === "remove") {
        if (rest.length !== 1) throw new UsageError("column remove needs an id");
        const [id] = rest;
        if (!(await store.removeColumn(id))) throw new NotFoundError(`no column with id ${id}`);
        return { json: { id, removed: true }, text: "removed " + id };
      }
      throw new UsageError(`unknown column sub-verb: ${sub ?? "(none)"}`);
    },
  },
  move: {
    usage: "banny move <item-id> <column-id> | <item-id> --none [--before <item-id>]",
    options: { none: { type: "boolean" }, before: { type: "string" } },
    async run({ args, values, store }) {
      if (values.none) {
        if (args.length !== 1) throw new UsageError("move --none needs exactly one item id");
      } else if (args.length !== 2) {
        throw new UsageError("move needs an item id and a column id, or --none");
      }
      const id = args[0];
      const columnId = values.none ? null : args[1];
      if (columnId !== null && !(await store.getColumn(columnId))) {
        throw new NotFoundError(`no column with id ${columnId}`);
      }
      if (!(await store.get(id))) throw new NotFoundError(`no item with id ${id}`);
      const before = values.before ?? null;
      if (before !== null) {
        const target = await store.get(before);
        if (!target) throw new NotFoundError(`no item with id ${before}`);
        if (before === id) throw new ItemValidationError("before must not be the moved item");
        if (target.columnId !== columnId) {
          throw new ItemValidationError("before must be in the target column");
        }
      }
      const item = await store.moveItem(id, validateItemMove({ columnId, before }));
      if (!item) throw new NotFoundError(`no item with id ${id}`);
      return { json: item, text: formatItem(item) };
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
