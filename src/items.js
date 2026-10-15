export class ItemValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ItemValidationError";
    this.code = "invalid-item";
  }
}

const KEYS = ["title", "done", "tags"];
const TAG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkObject(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ItemValidationError("item must be a JSON object");
  }
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) throw new ItemValidationError(`unknown field: ${key}`);
  }
}

function checkTitle(title) {
  if (typeof title !== "string" || title.trim().length < 1 || title.trim().length > 200) {
    throw new ItemValidationError("title must be a string of 1 to 200 characters");
  }
}

function checkDone(done) {
  if (typeof done !== "boolean") throw new ItemValidationError("done must be a boolean");
}

function checkTags(tags) {
  if (!Array.isArray(tags)) throw new ItemValidationError("tags must be an array");
  if (tags.length > 10) throw new ItemValidationError("tags must hold at most 10 entries");
  for (const tag of tags) {
    if (typeof tag !== "string" || !TAG.test(tag)) {
      throw new ItemValidationError("tags entries must be lowercase letters, digits, and single hyphens");
    }
  }
  if (new Set(tags).size !== tags.length) {
    throw new ItemValidationError("tags must not contain duplicates");
  }
}

function checkPresent(input) {
  if ("title" in input) checkTitle(input.title);
  if ("done" in input) checkDone(input.done);
  if ("tags" in input) checkTags(input.tags);
}

export function validateNewItem(input) {
  checkObject(input);
  if (!("title" in input)) throw new ItemValidationError("title is required");
  checkPresent(input);
  const { title, done, tags } = input;
  return { title: title.trim(), done: done ?? false, tags: tags ? [...tags] : [] };
}

export function validateItemPatch(input) {
  checkObject(input);
  if (!KEYS.some((k) => k in input)) {
    throw new ItemValidationError("patch must set title, done, or tags");
  }
  checkPresent(input);
  const out = {};
  if ("title" in input) out.title = input.title.trim();
  if ("done" in input) out.done = input.done;
  if ("tags" in input) out.tags = [...input.tags];
  return out;
}
